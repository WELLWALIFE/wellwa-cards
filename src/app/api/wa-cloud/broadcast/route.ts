// Broadcast campaigns (approved template → many leads). GET → list. POST → create (+ queue items). PATCH { id, action: "cancel" }.
// Delivery happens in bridge/wa-broadcast.mjs (pm2 cron, every minute) so the API stays fast and Meta rate limits are respected.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService, restAsUser } from "@/lib/poster-server";
import { cloudAccount } from "@/lib/wa-cloud";

type Lead = { id: string; name: string; phone: string; city: string; status: string; tags: string[]; opted_out: boolean };
const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

function audienceOf(leads: Lead[], aud: { all?: boolean; stages?: string[]; tags?: string[]; days?: number }) {
  return leads.filter((l) => /^\+\d{10,15}$/.test(l.phone) && !l.opted_out)
    .filter((l) => aud.all || (!aud.stages?.length || aud.stages.includes(l.status)) && (!aud.tags?.length || (l.tags ?? []).some((t) => aud.tags!.includes(t))));
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsUser<Record<string, unknown>[]>(me.token, "wa_broadcasts?select=*&order=created_at.desc&limit=50");
  const u = new URL(request.url);
  if (u.searchParams.get("preview") === "1") {
    const aud = { all: u.searchParams.get("all") === "1", stages: (u.searchParams.get("stages") ?? "").split(",").filter(Boolean), tags: (u.searchParams.get("tags") ?? "").split(",").filter(Boolean) };
    const leads = (await restAsUser<Lead[]>(me.token, "leads?select=id,name,phone,city,status,tags,opted_out&limit=5000")).data ?? [];
    return NextResponse.json({ count: audienceOf(Array.isArray(leads) ? leads : [], aud).length });
  }
  return NextResponse.json({ broadcasts: Array.isArray(r.data) ? r.data : [] });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await cloudAccount(me.id);
  if (!a || !a.enabled) return NextResponse.json({ error: "Broadcasts need the official WhatsApp API — connect it in WhatsApp → Business API." }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const name = S(b.name, 80), template_name = S(b.template_name, 512), template_lang = S(b.template_lang, 10) || "en";
  if (!name || !template_name) return NextResponse.json({ error: "Campaign name and template are required." }, { status: 400 });
  const params = (Array.isArray(b.params) ? b.params : []).slice(0, 10).map((p: Record<string, unknown>) => ({ source: ["name", "city", "phone", "custom"].includes(String(p.source)) ? String(p.source) : "custom", value: S(p.value, 200) }));
  const aud = { all: b.audience?.all === true, stages: Array.isArray(b.audience?.stages) ? b.audience.stages.map(String).slice(0, 6) : [], tags: Array.isArray(b.audience?.tags) ? b.audience.tags.map(String).slice(0, 12) : [] };
  const leads = (await restAsUser<Lead[]>(me.token, "leads?select=id,name,phone,city,status,tags,opted_out&limit=5000")).data ?? [];
  const targets = audienceOf(Array.isArray(leads) ? leads : [], aud);
  if (!targets.length) return NextResponse.json({ error: "No leads match this audience (or none have a valid number)." }, { status: 400 });
  const scheduled_at = typeof b.scheduled_at === "string" && !Number.isNaN(Date.parse(b.scheduled_at)) && Date.parse(b.scheduled_at) > Date.now() ? new Date(b.scheduled_at).toISOString() : null;
  const header_image = typeof b.header_image === "string" && /^https:\/\//.test(b.header_image) ? b.header_image.slice(0, 500) : "";
  const created = await restAsService<{ id: string }[]>("wa_broadcasts?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: me.id, name, template_name, template_lang, header_image, params, audience: aud, status: scheduled_at ? "scheduled" : "sending", scheduled_at, total: targets.length }) });
  const id = Array.isArray(created.data) ? created.data[0]?.id : null;
  if (!id) return NextResponse.json({ error: created.text.slice(0, 200) || "Could not create (run migration 0039?)." }, { status: 502 });
  for (let i = 0; i < targets.length; i += 500) {
    await restAsService("wa_broadcast_items", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(targets.slice(i, i + 500).map((l) => ({ broadcast_id: id, owner_id: me.id, lead_id: l.id, phone: l.phone, name: l.name || "" }))) });
  }
  return NextResponse.json({ ok: true, id, total: targets.length, scheduled_at });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(b.id))) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  if (b.action === "cancel") {
    await restAsUser(me.token, `wa_broadcasts?id=eq.${b.id}&status=in.(scheduled,sending,draft)`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "cancelled", finished_at: new Date().toISOString() }) });
    await restAsService(`wa_broadcast_items?broadcast_id=eq.${b.id}&owner_id=eq.${me.id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", error: "cancelled" }) });
  }
  return NextResponse.json({ ok: true });
}
