// A customer's measurements (bearer; ?as= / body.as). Every save is a new row, so older measurements stay as history.
//   GET ?phone= → { measurements }        POST { customer_phone, customer_name?, garment, unit?, values, notes?, job_id? } → { measurement }
//   (job_id: the job this measurement is for — it is linked to that job)
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { addonGate } from "@/lib/addons-server";
import { resolveScope } from "@/lib/crm-server";
import { isUuid, jobById, logEvent, personName } from "@/lib/jobs-server";
import { cleanPhone, type Measurement } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const MCOLS = "id,customer_phone,customer_name,garment,unit,values:sizes,notes,taken_by_name,created_at";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return gate;
  const phone = cleanPhone(p.get("phone"));
  if (!phone) return NextResponse.json({ measurements: [] });
  const r = await restAsService<Measurement[]>(`job_measurements?owner_id=eq.${scope.ownerId}&customer_phone=eq.${encodeURIComponent(phone)}&select=${MCOLS}&order=created_at.desc&limit=30`);
  return NextResponse.json({ measurements: list(r) });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return gate;
  const phone = cleanPhone(b.customer_phone);
  if (!phone) return NextResponse.json({ error: "The customer's 10-digit mobile number is needed to keep the measurements." }, { status: 400 });
  const values: Record<string, string> = {};
  if (b.values && typeof b.values === "object") {
    for (const [k, v] of Object.entries(b.values as Record<string, unknown>).slice(0, 40)) {
      const key = txt(k, 40), val = txt(v, 20);
      if (key && val) values[key] = val;
    }
  }
  if (!Object.keys(values).length && !txt(b.notes, 5)) return NextResponse.json({ error: "Fill at least one measurement." }, { status: 400 });
  const byName = (await personName(me.id)) || (scope.role === "owner" ? "Owner" : "Team");
  const r = await restAsService<Measurement[]>(`job_measurements?select=${MCOLS}`, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ owner_id: scope.ownerId, customer_phone: phone, customer_name: txt(b.customer_name, 80), garment: txt(b.garment, 40) || "Blouse", unit: b.unit === "cm" ? "cm" : "inch", sizes: values, notes: txt(b.notes, 500), taken_by: me.id, taken_by_name: byName }),
  });
  const m = list(r)[0];
  if (!m) return NextResponse.json({ error: /job_measurements/.test(r.text) ? "Orders are not set up yet — run migration 0076 in Supabase." : "Could not save. Please try again." }, { status: 502 });
  if (isUuid(b.job_id)) {
    const job = await jobById(scope, b.job_id);
    if (job) {
      await restAsService(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ measurement_id: m.id, updated_at: new Date().toISOString() }) });
      await logEvent(scope, job.id, { kind: "note", note: `Measurement noted (${m.garment})` }, byName);
    }
  }
  return NextResponse.json({ measurement: m });
}
