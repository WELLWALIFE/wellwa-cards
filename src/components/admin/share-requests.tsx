"use client";
// Admin → Live help → "Asking you now": people who tapped Admin under "Call for live help". Their screen arrives over the same live relay as the share
// link (long poll, no waiting for a 5-second refresh), so what shows on their phone shows here as it happens. View only.
import { useCallback, useEffect, useState } from "react";
import { Eye, Smartphone } from "lucide-react";
import { adminHeaders } from "@/lib/admin-client";
import { ScreenFeed, type Loader } from "@/components/share/screen-feed";

type Req = { token: string; name: string; phone: string; since: number; expiresAt: number; state: "live" | "paused"; why: string | null; viewers: number; idleMs: number };
const mins = (ms: number) => Math.max(0, Math.ceil(ms / 60_000));

function Watch({ token, name }: { token: string; name: string }) {
  const load = useCallback<Loader>(async ({ after, epoch, vid, ask }) =>
    fetch(`/api/admin/share/watch?token=${encodeURIComponent(token)}&after=${after}&epoch=${epoch}&v=${vid}${ask ? "&ask=1" : ""}`, { headers: await adminHeaders(), cache: "no-store" }), [token]);
  return <div className="rounded-2xl bg-[#0b0e33] pt-3 text-white"><ScreenFeed load={load} name={name || "The person"} maxWidth={1} /></div>;
}

export function ShareRequests() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [sel, setSel] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/share", { headers: await adminHeaders(), cache: "no-store" });
      if (!r.ok) return;
      setReqs(((await r.json()) as { requests: Req[] }).requests);
      setNow(Date.now());
    } catch { /* offline: next round */ }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 2_000);
    return () => clearInterval(t);
  }, [load]);

  const open = reqs.find((r) => r.token === sel) ?? null;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4 text-brand" /> Asking you now <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-ink">{reqs.length}</span></p>
      <p className="mt-1 text-xs text-muted">People who tapped “Admin” under Call for live help. Their Shubhora screen opens here live, as quick as it shows on their phone. View only; a request lasts 30 minutes.</p>
      {!reqs.length && <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted">Nobody is asking right now.</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {reqs.map((r) => (
          <button key={r.token} type="button" onClick={() => setSel(sel === r.token ? "" : r.token)}
            className={`rounded-xl border p-3 text-left ${r.token === sel ? "border-brand bg-brand-soft/40" : "border-border"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-bold">{r.name || r.phone || "A card holder"}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r.state === "live" ? "border-good/40 bg-good/15 text-good" : "border-border bg-surface2 text-muted"}`}>{r.state === "live" ? "Live" : "Paused"}</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Smartphone className="h-3.5 w-3.5" /> {r.phone || "—"} · asked {mins(now - r.since) || 0}m ago · {mins(r.expiresAt - now)}m left</p>
          </button>
        ))}
      </div>
      {open && <div className="mt-4 max-w-md"><Watch key={open.token} token={open.token} name={open.name} /></div>}
    </div>
  );
}
