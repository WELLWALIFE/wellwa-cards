// The owner's bookings (bearer; RLS keeps everyone to their own rows).
//   GET                      → { bookings } from a week ago onwards, soonest first
//   POST  { name, phone, service, at: "YYYY-MM-DDTHH:MM" (IST), duration_min?, note? } → { booking }
//   PATCH { id, status? | at? | name? | phone? | service? | note? } → { booking }
//   DELETE ?id=              → { ok }
import { NextResponse } from "next/server";
import { restAsUser, userFromRequest } from "@/lib/poster-server";
import { BOOKING_COLS, istInstant, type Booking, type BookingStatus } from "@/lib/bookings";
import { askForReview } from "@/lib/customer-send";

const S = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES: BookingStatus[] = ["booked", "done", "cancelled", "no_show"];

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const r = await restAsUser<Booking[]>(me.token, `bookings?owner_id=eq.${me.id}&starts_at=gte.${since}&order=starts_at.asc&limit=300&select=${BOOKING_COLS}`);
  if (!r.ok) return NextResponse.json({ error: /relation|does not exist/i.test(r.text) ? "Bookings are not set up yet (migration 0064)." : "Could not load bookings." }, { status: 500 });
  return NextResponse.json({ bookings: r.data ?? [] });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const at = istInstant(S(b.at, 20));
  if (!at) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  const name = S(b.name, 80);
  if (!name) return NextResponse.json({ error: "Customer name is needed." }, { status: 400 });
  const row = { owner_id: me.id, name, phone: S(b.phone, 20), service: S(b.service, 120), starts_at: at.toISOString(), duration_min: Math.max(15, Math.min(480, Math.round(Number(b.duration_min)) || 60)), note: S(b.note, 300), source: "owner" };
  const r = await restAsUser<Booking[]>(me.token, "bookings", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (!r.ok || !r.data?.[0]) return NextResponse.json({ error: "Could not save the booking." }, { status: 400 });
  return NextResponse.json({ booking: r.data[0] });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = S(b.id, 40);
  if (!UUID.test(id)) return NextResponse.json({ error: "Which booking?" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.status === "string" && (STATUSES as string[]).includes(b.status)) patch.status = b.status;
  if (b.at !== undefined) { const at = istInstant(S(b.at, 20)); if (!at) return NextResponse.json({ error: "That time is not valid." }, { status: 400 }); patch.starts_at = at.toISOString(); patch.reminded_customer_24h = null; patch.reminded_customer_2h = null; patch.reminded_owner_at = null; }
  for (const k of ["name", "phone", "service", "note"] as const) if (b[k] !== undefined) patch[k] = S(b[k], k === "note" ? 300 : k === "service" ? 120 : 80);
  const r = await restAsUser<Booking[]>(me.token, `bookings?id=eq.${id}&owner_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!r.ok || !r.data?.[0]) return NextResponse.json({ error: "Could not update the booking." }, { status: 400 });
  // Done → thank-you with the Google review link (phase 2: review collector).
  if (patch.status === "done") void askForReview(me.id, { name: r.data[0].name, phone: r.data[0].phone }, `booking:${r.data[0].id}`);
  return NextResponse.json({ booking: r.data[0] });
}

export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Which booking?" }, { status: 400 });
  const r = await restAsUser(me.token, `bookings?id=eq.${id}&owner_id=eq.${me.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return NextResponse.json({ ok: r.ok });
}
