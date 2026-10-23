// The business WhatsApp number — the WhatsApp button on the owner's V-Card / website, where customers message.
// Sign-up forms often leave it empty, so it falls back to the login mobile (owner, 23 Oct 2026): the WhatsApp connect page
// shows it and lets the owner change it, and offers the number that is actually linked.
// GET (bearer) → { number: "+91…" | "" }.  POST (bearer) { number } → every card of the owner gets that WhatsApp button.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";

type Link = { id?: string; type: string; label?: string; value: string };
type Row = { id: string; data: { links?: Link[] } | null };

const norm = (v: unknown): string => {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return "";
};

async function cardsOf(userId: string): Promise<Row[]> {
  const r = await restAsService<Row[]>(`cards?owner_id=eq.${userId}&order=created_at.desc&select=id,data`);
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const cards = await cardsOf(me.id);
  const links = cards[0]?.data?.links ?? [];
  const wa = links.find((l) => l.type === "whatsapp" && norm(l.value)) ?? links.find((l) => l.type === "phone" && norm(l.value));
  return NextResponse.json({ number: wa ? norm(wa.value) : "", hasCard: cards.length > 0 });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const number = norm(b.number);
  if (!number) return NextResponse.json({ error: "Enter a valid WhatsApp number (10 digits)." }, { status: 400 });
  const cards = await cardsOf(me.id);
  if (!cards.length) return NextResponse.json({ error: "Make your V-Card first — the number goes on its WhatsApp button." }, { status: 400 });
  let failed = 0;
  for (const c of cards) {
    const links = [...(c.data?.links ?? [])];
    const i = links.findIndex((l) => l.type === "whatsapp");
    if (i >= 0) links[i] = { ...links[i], value: number };
    else links.unshift({ id: `wa-${Date.now().toString(36)}`, type: "whatsapp", label: "WhatsApp", value: number });
    const r = await restAsService(`cards?id=eq.${c.id}&owner_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...(c.data ?? {}), links } }) });
    if (!r.ok) failed++;
  }
  if (failed === cards.length) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ ok: true, number });
}
