// The admin dashboard (Admin v2): the platform's numbers today, or a franchise's own numbers for a franchise login.
//   GET → { kind: "platform", users, revenue, plans, franchises, payouts, newest, audit, health }
//       | { kind: "franchise", franchise, users, balance, newest, payouts }
import os from "node:os";
import fs from "node:fs/promises";
import { requireAdmin } from "@/lib/admin-v2";
import { svc, svcCount } from "@/lib/service";
import { franchiseBalance, FR_COLS, type FranchiseRow } from "@/lib/franchise-server";
import { SAAS_PLANS } from "@/lib/billing";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };
const lastMonthStart = () => { const d = monthStart(); d.setMonth(d.getMonth() - 1); return d; };

type Newest = { id: string; full_name: string | null; username: string | null; plan: string; saas_tier: string | null; created_at: string; franchise_id: string | null };
const NEWEST = "id,full_name,username,plan,saas_tier,created_at,franchise_id";

async function health() {
  const [total, free] = [os.totalmem(), os.freemem()];
  let disk: { total: number; free: number } | null = null;
  try { const s = await fs.statfs("/"); disk = { total: Number(s.blocks) * Number(s.bsize), free: Number(s.bavail) * Number(s.bsize) }; } catch { disk = null; }
  let bridge: "up" | "down" | "unknown" = "unknown";
  try { const r = await fetch("http://127.0.0.1:8787/", { signal: AbortSignal.timeout(1500) }); bridge = r.status < 600 ? "up" : "down"; } catch { bridge = "down"; }
  return { load: os.loadavg().map((x) => Math.round(x * 100) / 100), cpus: os.cpus().length, mem: { total, used: total - free }, disk, uptime: Math.round(os.uptime()), appUptime: Math.round(process.uptime()), node: process.version, bridge, at: new Date().toISOString() };
}

export async function GET(request: Request) {
  const g = await requireAdmin(request); if (!g.ok) return g.res;
  const { me } = g;

  if (me.franchise) {
    const fid = me.franchise.id;
    const [fr, total, m, w, paid, newest, payouts, balance] = await Promise.all([
      svc<FranchiseRow[]>(`franchises?id=eq.${fid}&select=${FR_COLS}&limit=1`),
      svcCount(`profiles?franchise_id=eq.${fid}&select=id`),
      svcCount(`profiles?franchise_id=eq.${fid}&created_at=gte.${iso(monthStart())}&select=id`),
      svcCount(`profiles?franchise_id=eq.${fid}&created_at=gte.${iso(daysAgo(7))}&select=id`),
      svcCount(`profiles?franchise_id=eq.${fid}&saas_tier=neq.none&saas_expires_at=gte.${iso(new Date())}&select=id`),
      svc<Newest[]>(`profiles?franchise_id=eq.${fid}&select=${NEWEST}&order=created_at.desc&limit=8`),
      svc<Record<string, unknown>[]>(`payouts?franchise_id=eq.${fid}&select=id,amount_paise,status,utr,requested_at,paid_at&order=requested_at.desc&limit=5`),
      franchiseBalance(fid),
    ]);
    return Response.json({ kind: "franchise", franchise: list(fr)[0] ?? null, users: { total, thisMonth: m, week: w, paid }, newest: list(newest), payouts: list(payouts), balance });
  }

  const now = new Date();
  const [users, today, week, month, lastMonth, paidSaas, paidGiven, subsMonth, subsLast, tiers, frActive, frAll, payReq, payAppr, newest, auditRows, h] = await Promise.all([
    svcCount("profiles?select=id"),
    svcCount(`profiles?created_at=gte.${iso(daysAgo(1))}&select=id`),
    svcCount(`profiles?created_at=gte.${iso(daysAgo(7))}&select=id`),
    svcCount(`profiles?created_at=gte.${iso(monthStart())}&select=id`),
    svcCount(`profiles?created_at=gte.${iso(lastMonthStart())}&created_at=lt.${iso(monthStart())}&select=id`),
    svcCount(`profiles?saas_tier=neq.none&saas_expires_at=gte.${iso(now)}&select=id`),
    svcCount(`profiles?plan=in.(pro,team)&or=(plan_expires_at.is.null,plan_expires_at.gte.${iso(now)})&select=id`),
    svc<{ amount: number | null }[]>(`subscriptions?created_at=gte.${iso(monthStart())}&select=amount&limit=10000`),
    svc<{ amount: number | null }[]>(`subscriptions?created_at=gte.${iso(lastMonthStart())}&created_at=lt.${iso(monthStart())}&select=amount&limit=10000`),
    svc<{ saas_tier: string }[]>(`profiles?saas_tier=neq.none&saas_expires_at=gte.${iso(now)}&select=saas_tier&limit=20000`),
    svcCount("franchises?status=eq.active&select=id"),
    svcCount("franchises?select=id"),
    svcCount("payouts?status=eq.requested&select=id"),
    svcCount("payouts?status=eq.approved&select=id"),
    svc<Newest[]>(`profiles?select=${NEWEST}&order=created_at.desc&limit=8`),
    me.rights.includes("audit.view") ? svc<Record<string, unknown>[]>("audit_log?select=id,at,actor_email,action,target_type,target_label&order=at.desc&limit=8") : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    me.rights.includes("system.view") ? health() : Promise.resolve(null),
  ]);
  const sum = (rows: { amount: number | null }[]) => rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const byTier: Record<string, number> = {};
  for (const t of list(tiers)) byTier[t.saas_tier] = (byTier[t.saas_tier] ?? 0) + 1;
  const mrr = Object.entries(byTier).reduce((a, [t, n]) => a + n * (SAAS_PLANS[t as keyof typeof SAAS_PLANS]?.amount ?? 0), 0);
  const frMap = new Map(list(await svc<{ id: string; code: string }[]>("franchises?select=id,code")).map((f) => [f.id, f.code]));
  return Response.json({
    kind: "platform",
    users: { total: users, today, week, month, lastMonth, paid: paidSaas + paidGiven, paidSaas, paidGiven },
    revenue: { month: sum(list(subsMonth)), lastMonth: sum(list(subsLast)), mrr, byTier },
    franchises: { active: frActive, total: frAll },
    payouts: { requested: payReq, approved: payAppr },
    newest: list(newest).map((u) => ({ ...u, franchise: u.franchise_id ? frMap.get(u.franchise_id) ?? "" : "" })),
    audit: list(auditRows),
    health: h,
    rights: { audit: me.rights.includes("audit.view"), system: me.rights.includes("system.view"), billing: me.rights.includes("billing.view"), franchises: me.rights.includes("franchises.view") },
  });
}
