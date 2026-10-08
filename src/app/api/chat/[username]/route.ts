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
import { buildSystem, getBrandTraining, splitOrder, orderSummary, orderPaise, type ChatOrder } from "@/lib/wa-ai";
import { istInstant } from "@/lib/bookings";
import { createBooking } from "@/lib/bookings-server";
import { getCardByUsername } from "@/lib/sample-data";
import { getPlatformKnowledge } from "@/lib/platform";
import { agentCardLookup, agentComplete, agentContext, webState, type AgentMsg } from "@/lib/shubhora-agent-web";
import type { Card } from "@/lib/types";
import { isShubhoraCard } from "../../../../../bridge/shubhora-kb.mjs";
import { SHUBHORA_PAGE_SLUG, hasShubhoraPage } from "@/lib/shubhora-page";
import { agentTurn, firstName, v2Mode, WEB_CHIPS } from "../../../../../bridge/shubhora-agent.mjs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Msg = AgentMsg;

/** Should this conversation answer as a Shubhora seller?
 *  - `kb: "shubhora"` — the whole card is a Shubhora partner's: always yes.
 *  - `kb: "both"` — the owner also runs their own business: only on the card's own Shubhora page
 *    (/c/<user>/shubhora). On every other page the visitor is a customer of that business and gets the
 *    owner's own assistant, so the two are never mixed into one answer.
 *  The page is what the visitor is reading; it is a hint from the browser, so it can only ever turn the
 *  Shubhora side ON for a card that actually carries the Shubhora page. */
function sellsShubhora(card: Card, page: string | null): boolean {
  if (isShubhoraCard(card)) return true;
  return card.kb === "both" && page === SHUBHORA_PAGE_SLUG && hasShubhoraPage(card);
}

/** The salesman's opening for an ordinary business card (owner's call, 8 Oct 2026: "ek perfect salesman"): a greeting in
 *  the card's language, and chips that start a sale — the first products by name, prices, order, timings. */
function salesMeta(card: Card) {
  const first = card.name.split(" ")[0];
  const hindi = card.language === "hi" || /[\u0900-\u097F]/.test(`${card.tagline} ${card.about}`);
  const products: string[] = [];
  for (const pg of card.pages) for (const b of pg.blocks) if ((b.kind === "product" || b.kind === "services") && "items" in b) for (const it of b.items as { name?: string }[]) { if (it?.name && products.length < 2) products.push(it.name.slice(0, 28)); }
  const chips = hindi
    ? [...products.map((n) => `${n} का दाम?`), "ऑर्डर करना है", "टाइमिंग और पता"]
    : [...products.map((n) => `${n} price?`), "I want to order", "Timings & address"];
  return {
    title: hindi ? `${first} जी का AI सेल्समैन` : `${first}'s AI salesperson`,
    subtitle: hindi ? "दाम · ऑर्डर · बुकिंग" : "Prices · orders · bookings",
    greeting: hindi ? `नमस्ते 🙏 मैं ${first} जी का AI असिस्टेंट हूँ। दाम, ऑर्डर या बुकिंग — जो चाहिए, पूछिए।` : `Hi 👋 I am ${first}'s assistant. Ask about prices, place an order or book — I will sort it out.`,
    chips: chips.slice(0, 4),
    placeholder: hindi ? "अपना सवाल लिखिए…" : "Type your question…",
  };
}

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
  const page = new URL(_request.url).searchParams.get("page");
  if (v2Mode(platform.aiV2, sellsShubhora(card, page), card.username) !== "shubhora") return Response.json({ v2: false, sales: salesMeta(card) });
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
  const { messages, page } = (await request.json()) as { messages: Msg[]; page?: string };

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

  const shubhoraSide = sellsShubhora(card, page ?? null);

  // Shubhora partner card (or the Shubhora page of a "both" card) + new AI → the partner playbook.
  if (v2Mode(platform.aiV2, shubhoraSide, card.username) === "shubhora") {
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
        system: buildSystem(card, wa, platform, brand, "card", {
          asShubhoraSeller: shubhoraSide,
          // A "both" card's Shubhora page stands alone: the owner's own pages are not part of this answer.
          ...(shubhoraSide && !isShubhoraCard(card)
            ? { onlyPage: card.pages.find((pg) => pg.slug === SHUBHORA_PAGE_SLUG) }
            : {}),
        })
          + languageLock(safeMessages[safeMessages.length - 1]?.content ?? ""),
        contents: safeMessages.map((m) => ({
          role: m.role === "assistant" ? "model" as const : "user" as const,
          parts: [{ text: m.content }],
        })),
      });
      if (!blocked) {
        const { text: reply, order } = splitOrder(text.trim());
        if (reply || order) {
          if (firstMessage) logChat(card, safeMessages, { newLead: true }).catch(() => {});
          // The salesman closed: the owner gets a hot lead and an alert; the visitor gets the next-step buttons.
          const actions = order ? await closeOrder(card, order, safeMessages, wa).catch(() => null) : null;
          return Response.json({ reply: reply || (order ? "✅" : ""), ...(order ? { order } : {}), ...(actions ? { actions } : {}) });
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

/** What the visitor can do next, once the salesman has their order: send it to the owner on WhatsApp (prefilled), pay
 *  by UPI when the card carries a UPI id and the value is known, or call. */
type Actions = { whatsapp?: string; upi?: string; upiId?: string; call?: string };

/** The order becomes the lead: the "Card chat visitor" row this conversation opened (still nameless) is filled in, or a
 *  new hot lead is made; the owner is told on push + their WhatsApp. Returns the visitor's buttons. */
async function closeOrder(card: Card, order: ChatOrder, messages: Msg[], wa?: string): Promise<Actions> {
  const summary = orderSummary(order);
  const kindLabel = order.kind === "booking" ? "Booking" : order.kind === "callback" ? "Call back" : "Order";
  const hindi = /[\u0900-\u097F]/.test([...messages].reverse().find((m) => m.role === "user")?.content ?? "");
  const actions: Actions = {};
  if (wa) {
    const msg = hindi
      ? `नमस्ते, मैं ${order.name || "ग्राहक"}${order.phone ? ` (${order.phone})` : ""}। ${kindLabel === "Order" ? "ऑर्डर" : kindLabel === "Booking" ? "बुकिंग" : "कॉल बैक"}: ${summary}`
      : `Hi, I am ${order.name || "a customer"}${order.phone ? ` (${order.phone})` : ""}. ${kindLabel}: ${summary}`;
    actions.whatsapp = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
  }
  const upi = card.links.find((l) => l.type === "upi")?.value?.trim();
  const paise = orderPaise(order);
  if (upi && order.kind === "order") {
    actions.upiId = upi;
    actions.upi = `upi://pay?pa=${encodeURIComponent(upi).replace(/%40/g, "@")}&pn=${encodeURIComponent((card.company || card.name).slice(0, 40))}${paise ? `&am=${(paise / 100).toFixed(2)}` : ""}&cu=INR&tn=${encodeURIComponent(order.items.map((i) => i.name).join(", ").slice(0, 40) || "Order")}`;
  }
  const phone = card.links.find((l) => l.type === "phone")?.value?.replace(/[^0-9+]/g, "");
  if (phone) actions.call = `tel:${phone}`;

  const sb = getAdminSupabase();
  if (!sb) return actions;
  const { data: row } = await sb.from("cards").select("id, owner_id").eq("username", card.username).maybeSingle();
  if (!row) return actions;
  const message = `${kindLabel}: ${summary}`.slice(0, 1000);
  // Follow-up tomorrow at 11 am IST unless the owner closes it first: the CRM reminder (bridge/crm-reminders.mjs) then
  // hands the owner a tap-to-message link, so a website order never goes quiet (owner's call, 8 Oct 2026).
  const fields = { name: order.name || "Card chat visitor", phone: order.phone, message, source: "chat", status: "hot", ai_intent: kindLabel, value_paise: paise, tags: [order.kind], next_follow_up: nextFollowUp(), reminded_at: null };
  // This conversation's nameless lead (opened on its first message, within the last hours) is the one to fill in.
  const { data: prior } = await sb.from("leads").select("id").eq("card_id", row.id).eq("name", "Card chat visitor").eq("phone", "")
    .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let leadId = prior?.id as string | undefined;
  if (leadId) await sb.from("leads").update(fields).eq("id", leadId);
  else { const { data: made } = await sb.from("leads").insert({ card_id: row.id, owner_id: row.owner_id, email: "", ...fields }).select("id").maybeSingle(); leadId = made?.id; }
  // A booking with a day and time goes on the owner's calendar; the reminders cron takes it from there.
  const at = order.kind === "booking" ? istInstant(order.at) : null;
  if (at) await createBooking({ ownerId: row.owner_id, cardId: row.id, leadId: leadId ?? null, name: order.name, phone: order.phone, service: order.items.map((i) => i.name).join(", ") || order.note, startsAt: at, note: order.when, source: "chat" });
  const who = `${order.name || "A visitor"}${order.phone ? ` · ${order.phone}` : ""}`;
  await notify(row.owner_id, "new_lead", {
    title: `${order.kind === "booking" ? "📅" : order.kind === "callback" ? "📞" : "🛒"} New ${kindLabel.toLowerCase()}: ${order.name || "visitor"}`,
    body: `${summary}${order.phone ? ` · ${order.phone}` : ""}`.slice(0, 160), path: "/leads", ref: leadId ? `order:${leadId}` : undefined,
    whatsappText: `*${kindLabel} from your website* 🛒\n${who}\n${summary}\n\n${order.phone ? `Call / WhatsApp: ${order.phone}\n` : ""}${SITE}/leads`,
  }).catch(() => undefined);
  return actions;
}

/** Tomorrow 11:00 IST (or the day after when it is already evening), as an ISO instant. */
function nextFollowUp(): string {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const days = ist.getUTCHours() >= 18 ? 2 : 1;
  const d = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, 11, 0) - 5.5 * 3600_000;
  return new Date(d).toISOString();
}
