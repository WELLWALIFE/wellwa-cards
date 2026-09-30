// POST (bearer) { lead_id, as?, action: "suggest" | "refresh", hint? }
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { leadById, messagesFor, suggestReply, refreshInsights, resolveScope } from "@/lib/crm-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = await leadById(me.token, String(b.lead_id ?? ""), scope.ownerId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const messages = await messagesFor(me.token, scope.ownerId, lead.phone);
  if (b.action === "refresh") {
    const ai = await refreshInsights(scope.ownerId, lead, messages);
    return ai ? NextResponse.json({ ai }) : NextResponse.json({ error: "Nothing to analyse yet." }, { status: 400 });
  }
  const text = await suggestReply(scope.ownerId, lead, messages, typeof b.hint === "string" ? b.hint.slice(0, 200) : undefined);
  return text ? NextResponse.json({ text }) : NextResponse.json({ error: "AI is not available right now." }, { status: 502 });
}
