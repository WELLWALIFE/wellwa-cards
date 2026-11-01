// A customer's measurements (bearer; ?as= / body.as). Every save is a new row, so older measurements stay as history —
// "editing" a measurement saves the changed copy as the new one (base_id: the one it was changed from).
//   GET ?phone= → { measurements }
//   POST { customer_phone?, customer_name?, person?, garment, unit?, values, notes?, job_id?, base_id? } → { measurement }
//   (job_id: the job this measurement is for — it is linked to that job; without a mobile number a job is needed)
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { denied, has, isUuid, jobById, jobsCtx, logEvent, measureRow, personName } from "@/lib/jobs-server";
import { cleanPhone, type Measurement } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const MCOLS = "id,customer_phone,customer_name,garment,unit,values:sizes,notes,taken_by_name,created_at";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const c = await jobsCtx(request, p.get("as")); if (!c.ok) return c.res;
  const { scope, access } = c;
  const phone = cleanPhone(p.get("phone"));
  if (!phone) return NextResponse.json({ measurements: [], customer: null });
  // The customer too (owner, 1 Nov 2026: the mobile first — the name and the last orders come up by themselves).
  const [r, jr] = await Promise.all([
    restAsService<Measurement[]>(`job_measurements?owner_id=eq.${scope.ownerId}&customer_phone=eq.${encodeURIComponent(phone)}&select=${MCOLS}&order=created_at.desc&limit=40`),
    restAsService<{ customer_name: string; item: string; work: string; number: number; created_at: string; status: string; amount_paise: number; advance_paise: number }[]>(`job_orders?owner_id=eq.${scope.ownerId}&customer_phone=eq.${encodeURIComponent(phone)}&status=neq.cancelled&select=customer_name,item,work,number,created_at,status,amount_paise,advance_paise&order=created_at.desc&limit=50`),
  ]);
  const jobs = list(jr);
  const customer = jobs[0] ? {
    name: jobs[0].customer_name, orders: jobs.length,
    last: `#${jobs[0].number} ${[jobs[0].item, jobs[0].work].filter(Boolean).join(" · ")}`, lastAt: jobs[0].created_at,
    pendingPaise: !has(access, "money") ? 0 : jobs.reduce((a, j) => a + Math.max(0, (j.amount_paise || 0) - (j.advance_paise || 0)), 0),
  } : null;
  return NextResponse.json({ measurements: list(r), customer });
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { me, scope, access, setup } = c;
  if (!has(access, "measure")) return denied("take measurements");
  const job = isUuid(b.job_id) ? await jobById(scope, access, b.job_id, setup) : null;
  if (b.job_id && !job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const phone = cleanPhone(b.customer_phone) || job?.customer_phone || "";
  if (!phone && !job) return NextResponse.json({ error: "The customer's 10-digit mobile number is needed to keep the measurements." }, { status: 400 });
  const byName = (await personName(me.id)) || (scope.role === "owner" ? "Owner" : "Team");
  const row = measureRow(scope, b, phone, txt(b.customer_name, 80) || job?.customer_name || "", byName);
  if (!row) return NextResponse.json({ error: "Fill at least one measurement." }, { status: 400 });
  const r = await restAsService<Measurement[]>(`job_measurements?select=${MCOLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const m = list(r)[0];
  if (!m) return NextResponse.json({ error: /job_measurements/.test(r.text) ? "Orders are not set up yet — run migration 0076 in Supabase." : "Could not save. Please try again." }, { status: 502 });
  if (job) {
    await restAsService(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ measurement_id: m.id, updated_at: new Date().toISOString() }) });
    await logEvent(scope, job.id, { kind: "note", note: isUuid(b.base_id) ? `Measurement changed (${m.garment}) — the old one is kept in history` : `Measurement noted (${m.garment})` }, byName);
  }
  return NextResponse.json({ measurement: m });
}
