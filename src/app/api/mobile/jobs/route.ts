// Repair jobs: GET the list (open / ready / late / done, search by name, mobile, job number, phone model or IMEI), POST a new job
// when a phone comes in.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { cleanPayment } from "@/lib/jewellery";
import { istDay, isUuid } from "@/lib/jewellery-server";
import { JOB_COLS, JOB_PHOTOS, cleanJobFields, type JobRow } from "@/lib/mobile-repair";
import { cleanPhotoUrl } from "@/lib/jewellery-stock";
import { SUPA_URL } from "@/lib/admin-guard";
import { msCtx, msDenied, msHas } from "@/lib/mobile-server";
import { createJob, hideJobCost, sendJob } from "@/lib/mobile-repair-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const canRepair = (a: Parameters<typeof msHas>[0]) => msHas(a, "repair") || msHas(a, "reports");

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const c = await msCtx(request, u.get("as"));
  if (!c.ok) return c.res;
  if (!canRepair(c.access)) return msDenied("see repair jobs");
  const o = c.scope.ownerId, today = istDay();
  const p: string[] = [`owner_id=eq.${o}`, `select=${JOB_COLS}`, "order=created_at.desc", "limit=200"];
  const view = u.get("view") ?? "open";
  if (view === "open") p.push("status=in.(received,repairing,waiting,ready)");
  else if (view === "ready") p.push("status=eq.ready");
  else if (view === "late") p.push("status=in.(received,repairing,waiting)", `due_date=lt.${today}`);
  else if (view === "done") p.push("status=in.(delivered,returned,cancelled)");
  const q = (u.get("q") ?? "").replace(/[^A-Za-z0-9 ऀ-ॿ/]/g, "").trim().slice(0, 30);
  if (q) { const e = encodeURIComponent(q); p.push(`or=(customer_name.ilike.*${e}*,customer_phone.ilike.*${encodeURIComponent(q.replace(/\D/g, "") || q)}*,code.ilike.*${e}*,device.ilike.*${e}*,imei.ilike.*${e}*)`); }
  const r = await restAsService<JobRow[]>(`ms_jobs?${p.join("&")}`);
  return NextResponse.json({ jobs: list(r).map((j) => hideJobCost(j, c.access)), access: c.access, today });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!msHas(access, "repair")) return msDenied("take repair jobs");
  const f = cleanJobFields(b);
  const phone = cleanPhone(b.customer_phone);
  if (!phone) return NextResponse.json({ error: "Type the customer's mobile (10 digits) — the ready message goes there." }, { status: 400 });
  if (!f.device) return NextResponse.json({ error: "Type the phone's model." }, { status: 400 });
  if (!f.problems.length && !f.problem_note) return NextResponse.json({ error: "Pick or write the problem." }, { status: 400 });
  const adv = cleanPayment(b.advance);
  let tech_id: string | null = null, tech_name = "";
  if (isUuid(b.tech_id)) {
    const t = list(await restAsService<{ id: string; name: string }[]>(`crm_agents?id=eq.${b.tech_id}&owner_id=eq.${scope.ownerId}&select=id,name&limit=1`))[0];
    if (t) { tech_id = t.id; tech_name = t.name; }
  }
  const photos = [...new Set((Array.isArray(b.photos) ? b.photos : []).map((u) => cleanPhotoUrl(u, SUPA_URL)).filter(Boolean))].slice(0, JOB_PHOTOS);
  const signature = cleanPhotoUrl(b.signature, SUPA_URL);
  const asked = typeof b.store === "string" ? b.store : "";
  const store = access.store || (setup.stores.some((s) => s.id === asked) ? asked : "");
  const job = await createJob(scope, setup, { ...f, photos, signature, store, customer_phone: phone, payments: adv ? [{ ...adv, at: new Date().toISOString() }] : [], tech_id, tech_name, created_by: scope.userId, created_by_name: access.name });
  if (!job) return NextResponse.json({ error: "Could not save the job. Please try again." }, { status: 500 });
  const sent = b.send === true ? await sendJob(scope, setup, job, "received") : null;
  return NextResponse.json({ job: hideJobCost(job, access), sent });
}
