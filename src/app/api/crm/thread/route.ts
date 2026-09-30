// GET ?lead=<id>&as=<ownerId> (bearer) → lead + WhatsApp messages + timeline + templates.
// Marks the thread read and refreshes AI insights when new messages arrived.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { leadById, messagesFor, eventsFor, templatesFor, markRead, refreshInsights, resolveScope } from "@/lib/crm-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const u = new URL(request.url);
  const scope = await resolveScope(me, u.searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = await leadById(me.token, u.searchParams.get("lead") ?? "", scope.ownerId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const [messages, events, templates] = await Promise.all([messagesFor(me.token, scope.ownerId, lead.phone), eventsFor(me.token, lead.id), templatesFor(me.token, scope.ownerId)]);
  if (lead.unread) { await markRead(scope.ownerId, lead.id); lead.unread = 0; }
  const stale = messages.length > 0 && (!lead.ai_at || (lead.last_message_at && lead.ai_at < lead.last_message_at));
  if (stale) {
    const ai = await refreshInsights(scope.ownerId, lead, messages);
    if (ai) Object.assign(lead, { ai_intent: ai.intent, ai_sentiment: ai.sentiment, ai_summary: ai.summary, ai_next: ai.next, ai_at: new Date().toISOString(), score: ai.score, _aiTags: ai.tags });
  }
  return NextResponse.json({ lead, messages, events, templates });
}
