"use client";

// Super Admin → Funds. Approve partner top-ups, adjust balances, and see where
// every activation was spent.

import { useCallback, useEffect, useState } from "react";
import { Wallet, LoaderCircle, Check, X, AlertCircle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

type WalletRow = { id: string; name: string; base_domain: string; balance_paise: number; rate_discount_pct: number };
type Topup = {
  id: string; brand_id: string; amount_paise: number; method: string;
  reference: string | null; note: string | null; status: string; created_at: string;
};
type Ledger = {
  id: string; brand_id: string; kind: string; amount_paise: number; balance_after: number;
  member_email: string | null; plan: string | null; note: string | null; created_at: string;
};

export default function AdminWallets() {
  const [d, setD] = useState<{ wallets: WalletRow[]; topups: Topup[]; ledger: Ledger[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/wallet", { headers: await adminHeaders() });
    setD(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, body: unknown) {
    setBusy(JSON.stringify(body)); setErr("");
    const r = await fetch(`/api/admin/wallet?do=${action}`, {
      method: "POST", headers: await adminHeaders(), body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) setErr(j.error ?? "Failed.");
    load();
  }

  async function adjust(w: WalletRow) {
    const v = prompt(`Adjust ${w.name}'s balance by how much (₹)? Use a minus sign to debit.`);
    if (!v) return;
    const note = prompt("Reason (shows in their history):") ?? "Manual adjustment";
    act("adjust", { brandId: w.id, amount: Number(v), note });
  }

  if (!d) return <div className="p-10 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;

  const pending = (d.topups ?? []).filter((t) => t.status === "pending");
  const brandName = (id: string) => d.wallets.find((w) => w.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Funds</h1>
        <p className="text-muted mt-1">Partner balances, fund approvals and activation history.</p>
      </div>

      {err && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {err}
        </p>
      )}

      {/* ---- pending approvals first: this is the action queue ---- */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-semibold flex items-center gap-2">
          Fund requests
          {pending.length > 0 && (
            <span className="rounded-full bg-amber/20 text-amber px-2 py-0.5 text-xs font-semibold">{pending.length} pending</span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted mt-2">Nothing waiting.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pending.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{brandName(t.brand_id)} — {rupees(t.amount_paise)}</p>
                  <p className="text-xs text-muted mono">
                    {t.method}{t.reference ? ` · ${t.reference}` : ""} · {new Date(t.created_at).toLocaleString("en-IN")}
                  </p>
                  {t.note && <p className="text-xs text-muted mt-0.5">{t.note}</p>}
                </div>
                <button onClick={() => act("approve", { id: t.id })} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-lg bg-good text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button onClick={() => act("reject", { id: t.id, note: prompt("Reason?") ?? null })} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- balances ---- */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-muted" /> Partner balances</h2>
        {d.wallets.length === 0 ? (
          <p className="text-sm text-muted mt-2">No white-label partners yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {d.wallets.map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-muted mono">
                    *.{w.base_domain}{w.rate_discount_pct ? ` · ${w.rate_discount_pct}% partner rate` : ""}
                  </p>
                </div>
                <p className="tabular-nums font-semibold">{rupees(w.balance_paise)}</p>
                <button onClick={() => adjust(w)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2">
                  Adjust
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- ledger ---- */}
      <section className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
        <h2 className="font-semibold p-4 pb-2">Recent activity</h2>
        {(d.ledger ?? []).length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-faint mono text-xs uppercase border-b border-border">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">Partner</th>
                  <th className="px-4 py-2 font-semibold">Detail</th>
                  <th className="px-4 py-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-muted whitespace-nowrap">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-2">{brandName(l.brand_id)}</td>
                    <td className="px-4 py-2">{l.member_email ?? l.note ?? l.kind}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap ${
                      l.amount_paise < 0 ? "text-danger" : "text-good"}`}>
                      <span className="inline-flex items-center gap-1">
                        {l.amount_paise < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {rupees(Math.abs(l.amount_paise))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
