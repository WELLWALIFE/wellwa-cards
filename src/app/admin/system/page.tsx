"use client";
// System health (Admin v2): the server, the workers (pm2), the WhatsApp bridge, the database — at a glance, refreshed every 30 s.
import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCw, Server } from "lucide-react";
import { adminApi, fmtDate } from "@/lib/admin-client";
import { Badge, Btn, Card, ErrorBox, PageHeader, Spinner, Stat, Table, td } from "@/components/admin/ui";

type Sys = {
  server: { host: string; load: number[]; cpus: number; mem: { total: number; used: number }; disk: { total: number; free: number } | null; uptime: number; appUptime: number; node: string; platform: string };
  processes: { name: string; status: string; memory: number; cpu: number; restarts: number; uptime: number | null }[];
  workers: { bridge: string; mediaQueue: number; broadcastsDue: number; waCloudAccounts: number };
  db: { ok: boolean; ms: number }; errors24h: number; at: string;
};
const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
const mb = (b: number) => `${Math.round(b / 1024 ** 2)} MB`;
const dur = (s: number | null) => (s === null ? "—" : s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);

export default function SystemPage() {
  const [d, setD] = useState<Sys | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setBusy(true); const r = await adminApi<Sys>("/api/admin/v2/system"); setBusy(false); if (r.ok) { setD(r.data); setErr(""); } else setErr(r.data.error || "Could not load."); }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 30_000); return () => clearInterval(t); }, [load]);
  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!d) return <Spinner />;
  const memPct = Math.round((d.server.mem.used / d.server.mem.total) * 100);
  const diskPct = d.server.disk ? Math.round(((d.server.disk.total - d.server.disk.free) / d.server.disk.total) * 100) : 0;
  const loadPct = Math.min(100, Math.round((d.server.load[0] / d.server.cpus) * 100));
  const tone = (p: number) => (p >= 90 ? "danger" : p >= 75 ? "warn" : "good");
  return (
    <div className="space-y-5">
      <PageHeader title="System health" sub={`${d.server.host} · ${d.server.platform} · Node ${d.server.node} · checked ${fmtDate(d.at, true)}`} actions={<Btn icon={RefreshCw} loading={busy} onClick={() => void load()}>Refresh</Btn>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="RAM" value={`${memPct}%`} hint={`${gb(d.server.mem.used)} of ${gb(d.server.mem.total)}`} icon={Server} tone={tone(memPct)} />
        <Stat label="Disk" value={d.server.disk ? `${diskPct}%` : "—"} hint={d.server.disk ? `${gb(d.server.disk.free)} free` : ""} icon={Server} tone={tone(diskPct)} />
        <Stat label="CPU load" value={`${loadPct}%`} hint={`${d.server.load.join(" · ")} on ${d.server.cpus} cores`} icon={Activity} tone={tone(loadPct)} />
        <Stat label="Database" value={d.db.ok ? `${d.db.ms} ms` : "down"} hint={d.db.ok ? "Supabase answered" : "Supabase did not answer"} icon={Database} tone={d.db.ok ? (d.db.ms > 1500 ? "warn" : "good") : "danger"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Workers & queues">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between"><span>WhatsApp bridge</span>{d.workers.bridge === "up" ? <Badge tone="good" dot>running</Badge> : <Badge tone="danger" dot>down</Badge>}</li>
            <li className="flex items-center justify-between"><span>Videos / pictures in queue</span><b>{d.workers.mediaQueue}</b></li>
            <li className="flex items-center justify-between"><span>WhatsApp broadcasts waiting</span><b>{d.workers.broadcastsDue}</b></li>
            <li className="flex items-center justify-between"><span>WhatsApp Cloud accounts</span><b>{d.workers.waCloudAccounts}</b></li>
            <li className="flex items-center justify-between"><span>Server up for</span><b>{dur(d.server.uptime)}</b></li>
            <li className="flex items-center justify-between"><span>App up for</span><b>{dur(d.server.appUptime)}</b></li>
          </ul>
        </Card>
        <Card title="Processes (pm2)" className="lg:col-span-2" pad={false}>
          <Table head={["Name", "Status", "Memory", "CPU", "Restarts", "Up"]} minW={560} empty="pm2 is not reachable from here (a different server, or not installed).">
            {d.processes.map((p) => (
              <tr key={p.name}><td className={`${td} font-mono text-xs`}>{p.name}</td><td className={td}><Badge tone={p.status === "online" ? "good" : p.status === "stopped" ? "neutral" : "danger"} dot>{p.status}</Badge></td><td className={`${td} tabular-nums`}>{p.memory ? mb(p.memory) : "—"}</td><td className={`${td} tabular-nums`}>{p.cpu}%</td><td className={`${td} tabular-nums`}>{p.restarts}</td><td className={`${td} text-muted`}>{dur(p.uptime)}</td></tr>
            ))}
          </Table>
          <p className="px-4 py-2 text-[11px] text-muted">“stopped” on a scheduled job (banner, report, autopost…) is normal: it runs at its time and stops. Many restarts on a long-running one is not.</p>
        </Card>
      </div>
    </div>
  );
}
