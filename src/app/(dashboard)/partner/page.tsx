"use client";

// Partner panel — visible only to white-label partner administrators.
// Balance, activate a member, request funds, and the full ledger.

import { useCallback, useEffect, useState } from "react";
import {
  Wallet, Plus, LoaderCircle, Check, AlertCircle, ArrowUpRight, ArrowDownRight, Users,
} from "lucide-react";
import { getAccessToken } from "@/lib/cloud";

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

type Member = { id: string; full_name: string | null; plan: string; plan_expires_at: string | null };
type Ledger = {
  id: string; kind: string; amount_paise: number; balance_after: number;
  member_email: string | null; plan: string | null; months: number | null;
  note: string | null; created_at: string;
};
type Topup = { id: string; amount_paise: number; status: string; reference: string | null; created_at: string; admin_note: string | null };
type Data = {
  partner: boolean;
  brand: { name: string; base_domain: string; rate_discount_pct: number } | null;
  balance: number;
  rates: { plan: string; price_paise: number }[];
  members: Member[]; ledger: Ledger[]; topups: Topup[];
};

export default function PartnerPage() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // activate form
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("pro");
  const [months, setMonths] = useState(12);
  // topup form
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const r = await fetch("/api/partner", { headers: { Authorization: `Bearer ${token}` } });
    setD(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(action: string, body: unknown) {
    const token = await getAccessToken();
    const r = await fetch(`/api/partner?do=${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  async function activate() {
    setBusy("activate"); setMsg(null);
    const { ok, data } = await post("activate", { email, plan, months });
    setBusy("");
    if (!ok) return setMsg({ kind: "err", text: data.error ?? "Activation failed." });
    setMsg({ kind: "ok", text: `Activated. ${rupees(data.cost)} debited — balance ${rupees(data.balance)}.` });
    setEmail(""); load();
  }

  async function topup() {
    setBusy("topup"); setMsg(null);
    const { ok, data } = await post("topup", { amount, reference });
    setBusy("");
    if (!ok) return setMsg({ kind: "err", text: data.error ?? "Could not send the request." });
    setMsg({ kind: "ok", text: "Sent for approval. Funds appear once the admin confirms." });
    setAmount(""); setReference(""); load();
  }

  if (!d) return <div className="p-10 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;

  if (!d.partner) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-card">
        <Wallet className="h-6 w-6 mx-auto text-faint" />
        <p className="font-medium mt-2">Partner area</p>
        <p className="text-sm text-muted mt-1">This is for white-label partners. Your own plan is under Settings.</p>
      </div>
    );
  }

  const rate = d.rates.find((r) => r.plan === plan)?.price_paise ?? 0;
  const disc = d.brand?.rate_discount_pct ?? 0;
  const cost = Math.round((rate * months * (100 - disc)) / 100);
  const short = cost > d.balance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{d.brand?.name} — partner</h1>
        <p className="text-muted mt-1 mono text-sm">*.{d.brand?.base_domain}</p>
      </div>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm flex items-start gap-2 border ${
          msg.kind === "err" ? "border-danger/40 bg-danger/10 text-danger" : "border-good/40 bg-good/10 text-good"}`}>
          {msg.kind === "err" ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <Check className="h-4 w-4 mt-0.5 shrink-0" />}
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-muted">Wallet balance</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{rupees(d.balance)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-muted">Members</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{d.members.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-muted">Your rate</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{disc ? `${disc}% off` : "List price"}</p>
        </div>
      </div>

      {/* ---- activate ---- */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted" /> Activate a member</h2>
        <p className="text-sm text-muted">
          They sign up first at <span className="mono">{d.brand?.base_domain}</span>, then you activate their plan here.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input className="ed-input" placeholder="member@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <select className="ed-input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
          <select className="ed-input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
          </select>
          <button onClick={activate} disabled={!email || !!busy || short}
            className="rounded-lg bg-ink text-bg px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap">
            {busy === "activate" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : `Activate · ${rupees(cost)}`}
          </button>
        </div>
        {short && <p className="text-xs text-danger">Not enough balance — add funds below.</p>}
      </section>

      {/* ---- add funds ---- */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4 text-muted" /> Add funds</h2>
        <p className="text-sm text-muted">
          Transfer the amount, then record it here. It is credited once the Shubhora admin confirms receipt.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="ed-input" placeholder="Amount in ₹" inputMode="numeric" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
          <input className="ed-input" placeholder="UTR / reference" value={reference}
            onChange={(e) => setReference(e.target.value)} />
          <button onClick={topup} disabled={!amount || !!busy}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface2 disabled:opacity-50">
            {busy === "topup" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Send for approval"}
          </button>
        </div>

        {d.topups.length > 0 && (
          <div className="pt-2 space-y-1.5">
            {d.topups.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="tabular-nums font-medium">{rupees(t.amount_paise)}</span>
                <span className="text-faint mono">{t.reference ?? "—"}</span>
                <span className={`ml-auto font-semibold uppercase ${
                  t.status === "approved" ? "text-good" : t.status === "rejected" ? "text-danger" : "text-amber"}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- ledger ---- */}
      <section className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
        <h2 className="font-semibold p-4 pb-2">Account history</h2>
        {d.ledger.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-faint mono text-xs uppercase border-b border-border">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">Detail</th>
                  <th className="px-4 py-2 font-semibold text-right">Amount</th>
                  <th className="px-4 py-2 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-muted whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2">
                      {l.member_email
                        ? <>{l.member_email} <span className="text-faint">· {l.plan} · {l.months}m</span></>
                        : (l.note ?? l.kind)}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap ${
                      l.amount_paise < 0 ? "text-danger" : "text-good"}`}>
                      <span className="inline-flex items-center gap-1">
                        {l.amount_paise < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {rupees(Math.abs(l.amount_paise))}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{rupees(l.balance_after)}</td>
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
