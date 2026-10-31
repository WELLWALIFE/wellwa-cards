// System health (Admin v2): the server this app runs on, its workers and queues, in one place. Needs "system.view".
//   GET → { server, processes, workers, db, at }
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "@/lib/admin-v2";
import { svc, svcCount } from "@/lib/service";

const run = promisify(execFile);
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request) {
  const g = await requireAdmin(request, "system.view"); if (!g.ok) return g.res;
  const [total, free] = [os.totalmem(), os.freemem()];
  let disk: { total: number; free: number } | null = null;
  try { const s = await fs.statfs("/"); disk = { total: Number(s.blocks) * Number(s.bsize), free: Number(s.bavail) * Number(s.bsize) }; } catch { disk = null; }
  // pm2's own list (the workers): read-only; absent when pm2 is not installed where this runs.
  let processes: { name: string; status: string; memory: number; cpu: number; restarts: number; uptime: number | null }[] = [];
  try {
    const { stdout } = await run("pm2", ["jlist"], { timeout: 4000, maxBuffer: 4 * 1024 * 1024 });
    const j = JSON.parse(stdout) as { name: string; pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number }; monit?: { memory?: number; cpu?: number } }[];
    processes = j.map((p) => ({ name: p.name, status: p.pm2_env?.status ?? "?", memory: p.monit?.memory ?? 0, cpu: p.monit?.cpu ?? 0, restarts: p.pm2_env?.restart_time ?? 0, uptime: p.pm2_env?.status === "online" && p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000) : null }));
  } catch { processes = []; }
  let bridge: "up" | "down" = "down";
  try { const r = await fetch("http://127.0.0.1:8787/", { signal: AbortSignal.timeout(1500) }); bridge = r.status < 600 ? "up" : "down"; } catch { bridge = "down"; }
  const t0 = Date.now();
  const dbOk = (await svc("profiles?select=id&limit=1")).ok;
  const dbMs = Date.now() - t0;
  const [mediaQueue, waCloud, broadcastsDue] = await Promise.all([
    svcCount("media_jobs?status=in.(queued,running)&select=id").catch(() => 0),
    svcCount("wa_cloud_accounts?select=phone_number_id").catch(() => 0),
    svcCount("wa_broadcasts?status=eq.queued&select=id").catch(() => 0),
  ]);
  const errors24h = list(await svc<{ id: string }[]>(`audit_log?action=like.error.*&at=gte.${new Date(Date.now() - 86400_000).toISOString()}&select=id&limit=200`)).length;
  return Response.json({
    server: { host: os.hostname(), load: os.loadavg().map((x) => Math.round(x * 100) / 100), cpus: os.cpus().length, mem: { total, used: total - free }, disk, uptime: Math.round(os.uptime()), appUptime: Math.round(process.uptime()), node: process.version, platform: `${os.type()} ${os.release()}` },
    processes, workers: { bridge, mediaQueue, broadcastsDue, waCloudAccounts: waCloud },
    db: { ok: dbOk, ms: dbMs }, errors24h, at: new Date().toISOString(),
  });
}
