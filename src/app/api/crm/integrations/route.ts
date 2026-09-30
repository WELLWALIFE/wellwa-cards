// Integrations. GET → settings + recent deliveries. PUT { outbound_url, outbound_secret?, outbound_events, active, regenerate? }.
// POST { test: true } → queues a test event so the owner can see it arrive.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService } from "@/lib/poster-server";

type Row = { owner_id: string; inbound_token: string; outbound_url: string; outbound_secret: string; outbound_events: string[]; active: boolean };
const EVENTS = ["lead.created", "lead.stage_changed", "message.received", "message.sent"];
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");

async function ensureRow(userToken: string, userId: string): Promise<Row> {
  const r = await restAsUser<Row[]>(userToken, "crm_integrations?select=owner_id,inbound_token,outbound_url,outbound_secret,outbound_events,active&limit=1");
  if (Array.isArray(r.data) && r.data[0]) return r.data[0];
  const c = await restAsUser<Row[]>(userToken, "crm_integrations?select=owner_id,inbound_token,outbound_url,outbound_secret,outbound_events,active", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: userId, inbound_token: token(), outbound_secret: token() }) });
  return (Array.isArray(c.data) && c.data[0]) as Row;
}
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const row = await ensureRow(me.token, me.id);
  if (!row) return NextResponse.json({ error: "Integrations table missing — run migration 0037." }, { status: 502 });
  const recent = await restAsUser<{ id: number; event: string; created_at: string; delivered_at: string | null; attempts: number; last_error: string }[]>(me.token, "crm_outbox?select=id,event,created_at,delivered_at,attempts,last_error&order=created_at.desc&limit=15");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com";
  return NextResponse.json({ ...row, inbound_url: `${site}/api/crm/hook/${row.inbound_token}`, events: EVENTS, recent: Array.isArray(recent.data) ? recent.data : [] });
}
export async function PUT(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  await ensureRow(me.token, me.id);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.outbound_url === "string") { const u = b.outbound_url.trim().slice(0, 500); if (u && !/^https:\/\//.test(u)) return NextResponse.json({ error: "Webhook URL must start with https://" }, { status: 400 }); patch.outbound_url = u; }
  if (typeof b.outbound_secret === "string") patch.outbound_secret = b.outbound_secret.trim().slice(0, 100);
  if (Array.isArray(b.outbound_events)) patch.outbound_events = b.outbound_events.filter((e: unknown) => typeof e === "string" && EVENTS.includes(e));
  if (typeof b.active === "boolean") patch.active = b.active;
  if (b.regenerate === true) patch.inbound_token = token();
  const r = await restAsUser(me.token, `crm_integrations?owner_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const row = await ensureRow(me.token, me.id);
  if (!row?.active || !row.outbound_url) return NextResponse.json({ error: "Save an https webhook URL and switch it on first." }, { status: 400 });
  const r = await restAsService("rpc/crm_queue", { method: "POST", body: JSON.stringify({ p_owner: me.id, p_event: row.outbound_events[0] || "lead.created", p_payload: { test: true, id: "test", name: "Test Lead", phone: "+919999999999", city: "Delhi", source: "test", stage: "new", tags: ["test"], score: 50, message: "This is a test event from Shubhora", value: 0, created_at: new Date().toISOString() } }) });
  if (!r.ok) return NextResponse.json({ error: `Could not queue: ${r.text.slice(0, 160)}` }, { status: 502 });
  return NextResponse.json({ ok: true, note: "Queued — delivered within a minute." });
}
