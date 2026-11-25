"use client";
// Super Admin → Google checks: the free Google check's runs and the leads it brought (to which card each lead went).
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminHeaders } from "@/lib/admin-client";

type Check = { created_at: string; name: string; city: string; score: number; phone: string | null; query: string | null; user_id: string | null };
type Lead = { created_at: string; name: string; phone: string; message: string; card: string };
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function GoogleChecksAdmin() {
  const [d, setD] = useState<{ checks: Check[]; leads: Lead[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { (async () => {
    const r = await fetch("/api/admin/google-checks", { headers: await adminHeaders(), cache: "no-store" });
    if (r.ok) setD(await r.json()); else setErr("Could not load.");
  })(); }, []);
  if (err) return <p className="text-danger">{err}</p>;
  if (!d) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  const th = "px-3 py-2 text-left text-xs font-semibold text-muted";
  const td = "px-3 py-2 text-sm";
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Google checks</h1>
        <p className="mt-1 text-muted">The free check at shubhora.com/google-check. A number typed in becomes a lead: on the partner&apos;s card when the visitor came from a partner&apos;s website, on the signed-in user&apos;s own card, else on the company card. Each lead also shows in that account&apos;s Customers → Leads.</p>
      </div>
      <section className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
        <h2 className="px-4 pt-4 font-semibold">Leads ({d.leads.length})</h2>
        {d.leads.length === 0 ? <p className="px-4 pb-4 pt-2 text-sm text-muted">No leads yet.</p> : (
          <table className="mt-2 w-full"><thead><tr className="border-b border-border"><th className={th}>When</th><th className={th}>Name</th><th className={th}>Phone</th><th className={th}>Went to card</th><th className={th}>Report</th></tr></thead>
            <tbody>{d.leads.map((l, i) => <tr key={i} className="border-b border-border/60 align-top"><td className={`${td} whitespace-nowrap`}>{when(l.created_at)}</td><td className={td}>{l.name}</td><td className={`${td} whitespace-nowrap`}>{l.phone}</td><td className={td}>{l.card ? <a className="text-brand underline" href={`/c/${l.card}`} target="_blank" rel="noreferrer">{l.card}</a> : "—"}</td><td className={`${td} text-muted`}>{l.message.split("\n")[0]}</td></tr>)}</tbody></table>
        )}
      </section>
      <section className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
        <h2 className="px-4 pt-4 font-semibold">All checks ({d.checks.length})</h2>
        {d.checks.length === 0 ? <p className="px-4 pb-4 pt-2 text-sm text-muted">No checks yet.</p> : (
          <table className="mt-2 w-full"><thead><tr className="border-b border-border"><th className={th}>When</th><th className={th}>Business</th><th className={th}>City</th><th className={th}>Score</th><th className={th}>Phone</th><th className={th}>Signed in</th></tr></thead>
            <tbody>{d.checks.map((c, i) => <tr key={i} className="border-b border-border/60"><td className={`${td} whitespace-nowrap`}>{when(c.created_at)}</td><td className={td}>{c.name}</td><td className={td}>{c.city}</td><td className={td}>{c.score}</td><td className={`${td} whitespace-nowrap`}>{c.phone || "—"}</td><td className={td}>{c.user_id ? "Yes" : "No"}</td></tr>)}</tbody></table>
        )}
      </section>
    </div>
  );
}
