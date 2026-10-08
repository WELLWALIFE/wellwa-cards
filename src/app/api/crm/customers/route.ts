// Customer messaging for the owner (bearer):
//   GET            → { customers, linked, prefs, nextFestivals }
//   PATCH { festival_wishes?, review_ask? } → { prefs }
//   POST  { text }  → sends the text to every customer from the owner's linked WhatsApp ({name} = first name), paced;
//                     answers at once with how many it will reach, the sending carries on behind.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService } from "@/lib/poster-server";
import { ownerPlanExpiry } from "@/lib/crm-server";
import { rateLimited } from "@/lib/api-security";
import { blast, customersOf, prefsOf, type Prefs } from "@/lib/customer-send";
import { upcomingFestivals } from "@/lib/festivals";
import { istToday } from "@/lib/bookings";
import { notify } from "@/lib/notify";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [customers, prefs, expiry] = await Promise.all([customersOf(me.id), prefsOf(me.id), ownerPlanExpiry(me.id)]);
  return NextResponse.json({ customers: customers.length, linked: !!expiry, prefs, nextFestivals: upcomingFestivals(istToday(), 3) });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Partial<Prefs>;
  const cur = await prefsOf(me.id);
  const prefs: Prefs = { festival_wishes: typeof b.festival_wishes === "boolean" ? b.festival_wishes : cur.festival_wishes, review_ask: typeof b.review_ask === "boolean" ? b.review_ask : cur.review_ask };
  const r = await restAsUser(me.token, "owner_prefs?on_conflict=owner_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: me.id, ...prefs, updated_at: new Date().toISOString() }) });
  if (!r.ok) return NextResponse.json({ error: /relation|does not exist/i.test(r.text) ? "Not set up yet (migration 0065)." : "Could not save." }, { status: 500 });
  return NextResponse.json({ prefs });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`blast:${me.id}`, 3, 24 * 3600_000)) return NextResponse.json({ error: "At most 3 messages to everyone a day — so your number stays safe." }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = String(b.text ?? "").trim().slice(0, 900);
  if (text.length < 10) return NextResponse.json({ error: "Write the message first." }, { status: 400 });
  const [list, expiry] = await Promise.all([customersOf(me.id), ownerPlanExpiry(me.id)]);
  if (!expiry) return NextResponse.json({ error: "Link your WhatsApp first (Leads → WhatsApp), then the message goes from your own number." }, { status: 409 });
  if (!list.length) return NextResponse.json({ error: "No customers with a number in your CRM yet." }, { status: 400 });
  const planned = Math.min(list.length, 150);
  void restAsService("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: me.id, lead_id: null, kind: "sent", text: `Offer to everyone (${planned}): ${text.slice(0, 200)}` }) }).catch(() => undefined);
  void blast(me.id, text, { max: 150 }).then((r) => notify(me.id, "announcement", { title: `📣 Sent to ${r.sent} customers`, body: text.slice(0, 120), path: "/poster/leads", ref: `blast:${Date.now()}`, channels: ["push"] })).catch(() => undefined);
  return NextResponse.json({ ok: true, planned, total: list.length });
}
