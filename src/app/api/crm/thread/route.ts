// GET ?lead=<id>&as=<ownerId> (bearer) → lead + WhatsApp messages + timeline + templates + the links the owner can send
// in one tap (website, demo video and other links / files saved for the bot on Card & Website).
// Marks the thread read and refreshes AI insights when new messages arrived.
import { withView } from "@/lib/site-url";
import { publicCardUrl } from "@/lib/own-domain";
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { leadById, messagesFor, eventsFor, templatesFor, markRead, refreshInsights, resolveScope } from "@/lib/crm-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const u = new URL(request.url);
  const scope = await resolveScope(me, u.searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = await leadById(me.token, u.searchParams.get("lead") ?? "", scope.ownerId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const [messages, events, templates, links] = await Promise.all([messagesFor(me.token, scope.ownerId, lead.phone), eventsFor(me.token, lead.id), templatesFor(me.token, scope.ownerId), ownerLinks(scope.ownerId)]);
  if (lead.unread) { await markRead(scope.ownerId, lead.id); lead.unread = 0; }
  const stale = messages.length > 0 && (!lead.ai_at || (lead.last_message_at && lead.ai_at < lead.last_message_at));
  if (stale) {
    const ai = await refreshInsights(scope.ownerId, lead, messages);
    if (ai) Object.assign(lead, { ai_intent: ai.intent, ai_sentiment: ai.sentiment, ai_summary: ai.summary, ai_next: ai.next, ai_at: new Date().toISOString(), score: ai.score, _aiTags: ai.tags });
  }
  // The last note the owner wrote or spoke (the Note button, or the note after a call): shown on the Call list card before the next call
  // (owner, 24 Oct 2026: "is page per last note jo type kiya tha ya mic se kiya tha, wo dikhana chahiye").
  const own = `owner_id=eq.${scope.ownerId}&lead_id=eq.${lead.id}`;
  const [ev, cl] = await Promise.all([
    restAsService<{ text: string; created_at: string }[]>(`lead_events?${own}&kind=eq.note&select=text,created_at&order=created_at.desc&limit=1`).catch(() => null),
    restAsService<{ note: string; started_at: string }[]>(`crm_calls?${own}&note=neq.&select=note,started_at&order=started_at.desc&limit=1`).catch(() => null),
  ]);
  const n1 = ev?.ok ? ev.data?.[0] : undefined, n2 = cl?.ok ? cl.data?.[0] : undefined;
  const lastNote = n1 && (!n2 || n1.created_at >= n2.started_at) ? { text: n1.text, at: n1.created_at, call: false }
    : n2?.note?.trim() ? { text: n2.note.trim(), at: n2.started_at, call: true } : null;
  return NextResponse.json({ lead, messages, events, templates, links, lastNote });
}

type LinkRow = { label: string; url: string; kind: string };
/** Website first, then the demo video and every other link or file the owner saved for the bot. */
async function ownerLinks(ownerId: string): Promise<LinkRow[]> {
  // (There is no custom_domain column: asking for one failed the whole read, so no link showed. The own domain is card_domains.)
  const c = (await restAsService<{ id: string; username: string; data: { botSite?: string; botFiles?: { label?: string; url?: string; kind?: string }[] } | null }[]>(
    `cards?owner_id=eq.${ownerId}&order=created_at.desc&limit=1&select=id,username,data`).catch(() => null))?.data?.[0];
  if (!c) return [];
  const out: LinkRow[] = [];
  const site = c.data?.botSite?.trim();
  if (site && /^https?:\/\//.test(site)) out.push({ label: "Website", url: site, kind: "link" });
  out.push({ label: site ? "V-Card" : "Website", url: site ? withView(await publicCardUrl(c.username, c.id), "card") : await publicCardUrl(c.username, c.id), kind: "link" });
  for (const f of c.data?.botFiles ?? []) {
    const url = String(f.url ?? "").trim();
    if (!/^https?:\/\//.test(url) || out.some((o) => o.url === url)) continue;
    out.push({ label: String(f.label ?? "").trim().slice(0, 60) || (f.kind === "link" ? "Link" : "File"), url, kind: String(f.kind ?? "link") });
  }
  return out.slice(0, 20);
}
