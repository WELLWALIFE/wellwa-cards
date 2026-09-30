// Customer testimonials (→ testimonial posters). GET list, POST upsert, DELETE ?id=
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsUser<unknown[]>(me.token, `poster_testimonials?user_id=eq.${me.id}&order=created_at.desc&select=*`);
  return NextResponse.json({ testimonials: r.data ?? [] });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const rating = Math.round(Number(b.rating ?? 5));
  const row = {
    user_id: me.id,
    customer_name: String(b.customer_name ?? "").trim().slice(0, 60),
    text: String(b.text ?? "").trim().slice(0, 300),
    rating: rating >= 1 && rating <= 5 ? rating : 5,
    city: String(b.city ?? "").trim().slice(0, 40),
    photo_url: typeof b.photo_url === "string" && b.photo_url.length < 500 ? b.photo_url : null,
    approved: b.approved !== false,
  };
  if (!row.customer_name) return NextResponse.json({ error: "Customer name required" }, { status: 400 });
  if (!row.text) return NextResponse.json({ error: "Review text required" }, { status: 400 });
  const id = typeof b.id === "string" && UUID.test(b.id) ? b.id : null;
  const r = id
    ? await restAsUser<unknown[]>(me.token, `poster_testimonials?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) })
    : await restAsUser<unknown[]>(me.token, `poster_testimonials`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) }, { status: 400 });
  return NextResponse.json({ testimonial: r.data?.[0] ?? null });
}
export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await restAsUser(me.token, `poster_testimonials?id=eq.${id}&user_id=eq.${me.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
