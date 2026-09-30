// On-card AI chat. A visitor on /c/[username] asks questions; the AI answers
// grounded in that card's published data (products, offers, FAQ, links).
// Falls back to a helpful canned reply when no GEMINI_API_KEY is set.
//
// Shubhora partner cards, with the "New AI" switch on (Super Admin → Shubhora AI), get the partner playbook from
// bridge/shubhora-agent.mjs — the same one WhatsApp uses: a menu for a hello, everyday Hindi, the PDF, the joining link.

import { notify, whatsappAllowed } from "@/lib/notify";
import { geminiComplete } from "@/lib/gemini";
import { fetchCloudCard, fetchCardExpired, getPublicSupabase } from "@/lib/supabase/public";
import { clientKey, publicAiAllowed, rateLimited, sameOriginStrict } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { languageLock } from "@/lib/ai-training";
import { buildSystem, getBrandTraining } from "@/lib/wa-ai";
import { getCardByUsername } from "@/lib/sample-data";
import { getPlatformKnowledge } from "@/lib/platform";
import { agentCardLookup, agentComplete, agentContext, webState, type AgentMsg } from "@/lib/shubhora-agent-web";
import type { Card } from "@/lib/types";
import { isShubhoraCard } from "../../../../../bridge/shubhora-kb.mjs";
import { agentTurn, firstName, v2Mode, WEB_CHIPS } from "../../../../../bridge/shubhora-agent.mjs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Msg = AgentMsg;

/** What the chat box shows before the first message. Plain cards: nothing special (the box keeps its own English
 *  greeting). A Shubhora partner's card with the new AI: Hindi greeting, the menu as buttons, Hindi placeholder. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const card = (await fetchCloudCard(username)) ?? getCardByUsername(username);
  if (!card) return Response.json({ v2: false });
  const platform = await getPlatformKnowledge();
  if (v2Mode(platform.aiV2, isShubhoraCard(card), card.username) !== "shubhora") return Response.json({ v2: false });
  const seller = firstName(card.name);
  return Response.json({
    v2: true,
    title: `${seller} जी का AI असिस्टेंट`,
    subtitle: "V-Card, सर्विसेज़ और पार्टनर प्रोग्राम",
    greeting: `नमस्ते जी! 🙏 मैं ${seller} जी का AI असिस्टेंट हूँ। आप किस बारे में जानना चाहते हैं?`,
    chips: WEB_CHIPS.map((c: { label: string }) => c.label),
    placeholder: "अपना सवाल लिखिए…",
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  if (!sameOriginStrict(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(clientKey(request, "public-chat"), 12, 10 * 60_000)) {
    return Response.json({ reply: "Too many messages. Please contact the owner directly." }, { status: 429 });
  }
  // Platform-wide daily AI cap for public chats (owner's review, 28 Sep 2026): a flood can never run up the AI bill.
  if (!publicAiAllowed("chat")) {
    return Response.json({ reply: "Our assistant is resting for today 🙏 Please use the Call or WhatsApp buttons on this card — the owner will reply." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 30_000) {
    return Response.json({ error: "request too large" }, { status: 413 });
  }
  const { username } = await params;
  const { messages } = (await request.json()) as { messages: Msg[] };

  const card = (await fetchCloudCard(username)) ?? getCardByUsername(username);
  if (!card) return Response.json({ reply: "Sorry, this card was not found." }, { status: 404 });
  if (await fetchCardExpired(username)) {
    return Response.json({ reply: "This assistant is temporarily unavailable. Please use the contact buttons on the card." }, { status: 402 });
  }
  const safeMessages: Msg[] = (Array.isArray(messages) ? messages : [])
    .slice(-12)
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 1200), ...(Number.isFinite(m.at) ? { at: Number(m.at) } : {}) }));
  // One lead per conversation (its first message), not one per reply.
  const firstMessage = safeMessages.filter((m) => m.role === "user").length === 1;

  const wa = card.links.find((l) => l.type === "whatsapp")?.value?.replace(/[^0-9]/g, "");
  const key = process.env.GEMINI_API_KEY;
  const platform = await getPlatformKnowledge();

  // Shubhora partner card + new AI → the partner playbook.
  if (v2Mode(platform.aiV2, isShubhoraCard(card), card.username) === "shubhora") {
    const last = safeMessages[safeMessages.length - 1];
    if (!last || last.role !== "user" || !last.content.trim()) return Response.json({ reply: "जी, बताइए — क्या जानना चाहते हैं? 🙂" });
    const history = safeMessages.slice(0, -1);
    const out = await agentTurn({
      channel: "web", text: last.content, history, state: webState(history), contact: { known: false },
      ctx: await agentContext(card, platform), now: Date.now(), complete: agentComplete(key), cardLookup: agentCardLookup,
    });
    if (firstMessage || out.alert) logChat(card, safeMessages, { newLead: firstMessage, alert: out.alert }).catch(() => {});
    return Response.json({ reply: out.reply || "जी, बताइए — क्या जानना चाहते हैं? 🙂" });
  }

  if (key) {
    try {
      const brand = await getBrandTraining(card.username);
      const { text, blocked } = await geminiComplete({
        apiKey: key,
        maxOutputTokens: 500,
        system: buildSystem(card, wa, platform, brand)
          + languageLock(safeMessages[safeMessages.length - 1]?.content ?? ""),
        contents: safeMessages.map((m) => ({
          role: m.role === "assistant" ? "model" as const : "user" as const,
          parts: [{ text: m.content }],
        })),
      });
      if (!blocked) {
        const reply = text.trim();
        if (reply) {
          if (firstMessage) logChat(card, safeMessages, { newLead: true }).catch(() => {});
          return Response.json({ reply });
        }
      }
    } catch {
      /* fall through to canned reply */
    }
  }

  // Fallback (no key / error): friendly canned answer with card link + WhatsApp
  const last = safeMessages[safeMessages.length - 1]?.content ?? "";
  const reply =
    `Thanks for your message! For "${last.slice(0, 60)}" ${card.name.split(" ")[0]} will reply personally. ` +
    (wa ? `WhatsApp: https://wa.me/${wa} · ` : "") +
    `Full details: ${SITE}/c/${card.username}`;
  return Response.json({ reply, demo: !key });
}

/** A lead for the conversation's first message, and the owner's alert (push + their own WhatsApp) for it or for
 *  anything the assistant flagged — a call request (with the number the visitor typed), a custom-software need, a
 *  payment or account problem. */
async function logChat(card: Card, messages: Msg[], opts: { newLead: boolean; alert?: string | null }) {
  const sb = getAdminSupabase() ?? getPublicSupabase();
  if (!sb || !messages?.length) return;
  const { data: row } = await sb.from("cards").select("id, owner_id").eq("username", card.username).maybeSingle();
  if (!row) return;
  const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (opts.newLead) {
    await sb.from("leads").insert({
      card_id: row.id, owner_id: row.owner_id,
      name: "Card chat visitor", phone: "", email: "",
      message: firstUser.slice(0, 300), source: "form",
    });
  }
  const what = opts.alert ? `${opts.alert} — "${lastUser.slice(0, 120)}"` : firstUser.slice(0, 120);
  // Browser notification (admin switch "New lead"), then the hot-lead alert to the owner's WhatsApp.
  await notify(row.owner_id, "new_lead", { title: opts.alert ? "Card chat: a visitor needs you" : "New lead from your card chat", body: what.slice(0, 160), path: "/leads", channels: ["push"] }).catch(() => undefined);
  if (!(await whatsappAllowed("new_lead"))) return;
  try {
    const { data: owner } = await sb.from("profiles").select("plan,plan_expires_at").eq("id", row.owner_id).maybeSingle();
    const expiry = owner?.plan_expires_at || "2999-12-31T23:59:59.000Z";
    if (!owner || !["pro", "team"].includes(owner.plan) || Date.parse(expiry) <= Date.now()) return;
    await fetch("http://127.0.0.1:8787/notify-lead", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-neuraledge-user": row.owner_id,
        "x-neuraledge-plan-expires": expiry,
      },
      body: JSON.stringify({ card: card.username, source: "card chat", name: "Card chat visitor", message: what.slice(0, 200) }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* bridge offline — ignore */ }
}
