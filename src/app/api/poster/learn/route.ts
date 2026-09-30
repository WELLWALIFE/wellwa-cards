// Learning loop: pairs the WhatsApp bridge captured (customer question →
// owner's hand-typed answer). Approving appends to the card's bot knowledge.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService } from "@/lib/poster-server";
const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsUser<unknown[]>(me.token, `bot_learning?user_id=eq.${me.id}&status=eq.pending&order=created_at.desc&limit=50&select=*`);
  return NextResponse.json({ items: r.data ?? [] });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? ""), action = b.action === "approve" ? "approved" : "rejected";
  if (!UUID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const row = (await restAsUser<{ question: string; answer: string }[]>(me.token, `bot_learning?id=eq.${id}&user_id=eq.${me.id}&select=question,answer`)).data?.[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (action === "approved") {
    const answer = String(b.answer ?? row.answer).trim().slice(0, 600);
    const card = (await restAsService<{ id: string; data: Record<string, unknown> }[]>(`cards?owner_id=eq.${me.id}&active=eq.true&order=created_at&limit=1&select=id,data`)).data?.[0];
    if (card) {
      const prev = String(card.data?.botKnowledge ?? "");
      const line = `Q: ${row.question.trim().slice(0, 300)}\nA: ${answer}`;
      await restAsService(`cards?id=eq.${card.id}`, { method: "PATCH", body: JSON.stringify({ data: { ...card.data, botKnowledge: (prev ? prev + "\n\n" : "") + line } }) });
    }
  }
  await restAsUser(me.token, `bot_learning?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: action }) });
  return NextResponse.json({ ok: true });
}
