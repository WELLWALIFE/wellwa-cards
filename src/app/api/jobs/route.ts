// Orders & job cards (bearer; ?as= / body.as for a team workspace — the shop's staff logins).
//   GET  ?status=&q=&karigar=&phone=&mine=1&pool=1 (pool: waiting on a step with nobody on it) → { jobs, role, me (rights), karigars, team, counts, setup }
//   POST { customer_name, customer_phone, due_date?, advance?, details?, items: [{ item, work, details?, qty?, amount?,
//          karigar_id?, assigned_to?, measurement_id?, measure? }] } → { jobs, shop }
//        (one job card per item, one shared order_ref; with "Auto start" each goes to its first step and that step's person is told)
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { agentsFor } from "@/lib/crm-server";
import { isTeamMember } from "@/lib/crm-pro";
import { denied, forView, has, isUuid, jobsCtx, logEvent, measureRow, moveTo, nextNumber, ownFilter, personName, poolSteps, shopName } from "@/lib/jobs-server";
import { JOB_COLS, cleanPhone, flowFor, isStatus, toPaise, type JobRow, type Karigar } from "@/lib/jobs";

const enc = encodeURIComponent;
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const c = await jobsCtx(request, p.get("as")); if (!c.ok) return c.res;
  const { me, scope, setup, access } = c;
  const f = [`owner_id=eq.${scope.ownerId}`];
  const ors: string[] = [];   // PostgREST takes one "or" per query: two are joined under "and"
  const own = ownFilter(scope, setup);
  if (!has(access, "all_jobs")) ors.push(own);
  if (p.get("mine") === "1") f.push(`assigned_to=eq.${scope.userId}`);
  const pool = poolSteps(setup);
  if (p.get("pool") === "1") f.push("assigned_to=is.null", `status=in.(${pool.join(",") || "none"})`);
  const status = p.get("status");
  if (status === "open") f.push("status=not.in.(delivered,cancelled)");
  else if (isStatus(setup, status)) f.push(`status=eq.${status}`);
  const karigar = p.get("karigar"); if (isUuid(karigar)) f.push(`karigar_id=eq.${karigar}`);
  const phone = cleanPhone(p.get("phone")); if (phone) f.push(`customer_phone=eq.${enc(phone)}`);
  const q = txt(p.get("q"), 60).replace(/[(),*]/g, " ").trim();
  if (q) {
    const n = Number(q.replace(/^#/, ""));
    if (Number.isInteger(n) && n > 0 && q.replace(/^#/, "").length < 7) f.push(`number=eq.${n}`);
    else ors.push(`customer_name.ilike.*${enc(q)}*,customer_phone.ilike.*${enc(q.replace(/\D/g, "") || q)}*,item.ilike.*${enc(q)}*,work.ilike.*${enc(q)}*`);
  }
  if (ors.length === 1) f.push(`or=(${ors[0]})`);
  else if (ors.length > 1) f.push(`and=(${ors.map((o) => `or(${o})`).join(",")})`);
  const [jobs, karigars, team, all, mine, open] = await Promise.all([
    restAsService<JobRow[]>(`job_orders?${f.join("&")}&select=${JOB_COLS}&order=created_at.desc&limit=300`),
    restAsService<Karigar[]>(`job_karigars?owner_id=eq.${scope.ownerId}&select=id,name,phone,skill,active&order=name`),
    agentsFor(me.token, scope.ownerId, scope.role === "agent" ? "manager" : scope.role).catch(() => []),
    restAsService<{ status: string }[]>(`job_orders?owner_id=eq.${scope.ownerId}${has(access, "all_jobs") ? "" : `&or=(${own})`}&select=status&limit=5000`),
    restAsService<{ id: string }[]>(`job_orders?owner_id=eq.${scope.ownerId}&assigned_to=eq.${scope.userId}&status=not.in.(ready,delivered,cancelled)&select=id&limit=500`),
    pool.length ? restAsService<{ id: string }[]>(`job_orders?owner_id=eq.${scope.ownerId}&assigned_to=is.null&status=in.(${pool.join(",")})&select=id&limit=500`) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const counts: Record<string, number> = {};
  for (const r of list(all)) counts[r.status] = (counts[r.status] ?? 0) + 1;
  counts.mine = list(mine).length;
  counts.pool = list(open).length;
  return NextResponse.json({
    jobs: list(jobs).map((j) => forView(access, j)), role: scope.role, me: { ...access, userId: scope.userId }, karigars: list(karigars), counts, setup,
    team: team.filter((a) => a.agent_user_id && a.active).map((a) => ({ id: a.agent_user_id as string, name: a.name || a.phone || "Team member", role: a.role })),
  });
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { me, scope, setup, access } = c;
  if (!has(access, "book")) return denied("book orders");
  const customer_name = txt(b.customer_name, 80);
  const customer_phone = cleanPhone(b.customer_phone);
  if (!customer_name) return NextResponse.json({ error: "Write the customer's name." }, { status: 400 });
  if (b.customer_phone && !customer_phone) return NextResponse.json({ error: "That mobile number does not look right (10 digits)." }, { status: 400 });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20).filter((i: Record<string, unknown>) => txt(i?.item, 60) || txt(i?.work, 60));
  if (!items.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
  const due = typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null;
  const karigarIds = new Set(list(await restAsService<{ id: string }[]>(`job_karigars?owner_id=eq.${scope.ownerId}&select=id`)).map((k) => k.id));
  const byName = (await personName(me.id)) || (scope.role === "owner" ? "Owner" : "Team");
  const order_ref = `O${Date.now().toString(36).toUpperCase()}`;
  const money = has(access, "money"), assign = has(access, "assign");
  let advanceLeft = money ? toPaise(b.advance) : 0;
  const made: JobRow[] = [];
  const told: string[] = [];
  let number = await nextNumber(scope.ownerId);
  for (const it of items) {
    const chosen = assign && isUuid(it.assigned_to) && (await isTeamMember(scope.ownerId, it.assigned_to)) ? it.assigned_to : null;
    const karigar = assign && isUuid(it.karigar_id) && karigarIds.has(it.karigar_id) ? it.karigar_id : null;
    // The measurement taken while booking (items[].measure): saved first, so the job is cut from it.
    let measurementId: string | null = isUuid(it.measurement_id) ? it.measurement_id : null;
    if (it.measure && typeof it.measure === "object" && has(access, "measure")) {
      const mrow = measureRow(scope, { garment: it.item, ...it.measure }, customer_phone, customer_name, byName);
      if (mrow) {
        const mr = await restAsService<{ id: string }[]>(`job_measurements?select=id`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(mrow) });
        measurementId = list(mr)[0]?.id ?? measurementId;
      }
    }
    const amount = money ? toPaise(it.amount) : 0;
    const adv = Math.min(advanceLeft, amount || advanceLeft); advanceLeft -= adv;
    const row = {
      owner_id: scope.ownerId, number, order_ref, customer_name, customer_phone,
      item: txt(it.item, 60), work: txt(it.work, 60), details: txt(it.details ?? b.details, 1000),
      qty: Math.max(1, Math.min(99, Number(it.qty) || 1)), due_date: due,
      amount_paise: amount, advance_paise: adv, karigar_id: karigar, assigned_to: chosen,
      measurement_id: measurementId, created_by: me.id,
    };
    // Two people saving at the same moment can take the same number: try the next one.
    let saved: JobRow | null = null;
    for (let i = 0; i < 4 && !saved; i += 1) {
      const r = await restAsService<JobRow[]>(`job_orders?select=${JOB_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...row, number }) });
      saved = list(r)[0] ?? null;
      if (!saved) { if (r.status === 409 || /duplicate|unique/i.test(r.text)) number += 1; else return NextResponse.json({ error: /job_orders/.test(r.text) ? "Orders are not set up yet — run migration 0076 in Supabase." : "Could not save the order. Please try again." }, { status: 502 }); }
    }
    if (!saved) return NextResponse.json({ error: "Could not save the order. Please try again." }, { status: 502 });
    await logEvent(scope, saved.id, { kind: "created", status: "received", note: [saved.item, saved.work].filter(Boolean).join(" · ") }, byName);
    if (adv > 0) await logEvent(scope, saved.id, { kind: "payment", amount_paise: adv, note: "Advance" }, byName);
    // Auto start: straight to the item's first step; that step's person (or the one chosen here) gets it and is told.
    const first = flowFor(setup, saved.item)[1];
    if (setup.autoStart && first && first !== "ready") {
      const r = await moveTo(scope, setup, saved, first, byName, { assign: !chosen && !karigar });
      if (r.job) saved = r.job;
      if (r.told) told.push(`#${saved.number}: ${r.told}`);
    }
    made.push(forView(access, saved));
    number += 1;
  }
  return NextResponse.json({ jobs: made, told, shop: await shopName(scope.ownerId) });
}
