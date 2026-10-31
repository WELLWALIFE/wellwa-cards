"use client";
// Flexible payments on the plan page (owner, 1 Nov 2026): (1) payment links Shubhora / the franchise made for this account, payable here;
// (2) "Pay a different amount" — an advance or a booking of the person's own choosing, kept on the account; (3) the advance balance,
// and Standard taken from it when it is enough. Nothing here needs anyone at Shubhora to do anything.
import { useCallback, useEffect, useState } from "react";
import { IndianRupee, LoaderCircle, Wallet, Check } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { PayRequestButton } from "@/components/poster/pay-request";
import { rupeesOf } from "@/lib/payments";

type Open = { code: string; kind: string; tier: string | null; months: number; amount_paise: number; title: string; effect: string; note: string; created_role: string; created_at: string };
type Mine = { open: Open[]; paid: { code: string; kind: string; amount_paise: number; title: string; paid_at: string | null }[]; balance: number; lines: { id: number; delta_paise: number; reason: string; created_at: string }[]; standardPaise: number };

export function FlexPayments({ onChanged }: { onChanged?: () => void }) {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [d, setD] = useState<Mine | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "make" | "use">("");
  const [err, setErr] = useState("");
  const [ownCode, setOwnCode] = useState<{ code: string; amount: number } | null>(null);
  const load = useCallback(async () => { const r = await api<Mine>(`/api/pay/mine?lang=${hi ? "hi" : "en"}`); if (r.ok) setD(r.data); }, [hi]);
  useEffect(() => { void load(); }, [load]);
  if (!d) return null;
  const paise = Math.round(Number(amount.replace(/[^\d.]/g, "")) * 100) || 0;
  const months = d.standardPaise ? Math.floor(d.balance / d.standardPaise) : 0;
  const box = "rounded-2xl border border-border bg-surface p-4";

  async function makeAdvance() {
    setErr(""); setBusy("make");
    const r = await api<{ ok?: boolean; code?: string; error?: string }>("/api/pay/mine", { method: "POST", json: { op: "advance", amount_paise: paise, note } });
    setBusy("");
    if (!r.ok || !r.data.code) { setErr(r.data.error || T("Could not start.", "शुरू नहीं हो पाया।")); return; }
    setOwnCode({ code: r.data.code, amount: paise });
  }
  async function payFromBalance(m: number) {
    setErr(""); setBusy("use");
    const r = await api<{ ok?: boolean; error?: string }>("/api/pay/mine", { method: "POST", json: { op: "use", months: m } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || T("Could not use the balance.", "Balance इस्तेमाल नहीं हो पाया।")); return; }
    await load(); onChanged?.();
  }

  return (
    <div className="space-y-3">
      {/* 1 · requests waiting */}
      {d.open.filter((o) => o.created_role !== "self").map((o) => (
        <section key={o.code} className="rounded-2xl border-2 border-brand/40 bg-brand-soft/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">{o.created_role === "franchise" ? T("Payment request from your Shubhora partner", "आपके Shubhora partner की payment request") : T("Payment request from Shubhora", "Shubhora की payment request")}</p>
          <div className="mt-1 flex items-baseline justify-between gap-3"><p className="text-base font-bold">{o.title}</p><p className="text-xl font-extrabold">{rupeesOf(o.amount_paise)}</p></div>
          {o.note && <p className="mt-1 text-sm text-muted">{o.note}</p>}
          <p className="mt-1 text-xs text-muted">{o.effect}</p>
          <PayRequestButton className="mt-3" code={o.code} amountPaise={o.amount_paise} hi={hi} onPaid={() => { void load(); onChanged?.(); }} />
        </section>
      ))}

      {/* 2 · balance */}
      {(d.balance > 0 || d.lines.length > 0) && (
        <section className={box}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-bold"><Wallet className="h-4 w-4 text-brand" /> {T("Your advance balance", "आपका advance balance")}</p>
            <p className="text-xl font-extrabold">{rupeesOf(d.balance)}</p>
          </div>
          {months >= 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 3, 6, 12].filter((m) => m <= months).map((m) => (
                <button key={m} type="button" disabled={!!busy} onClick={() => payFromBalance(m)} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busy === "use" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T(`Standard ${m} month${m === 1 ? "" : "s"} · ${rupeesOf(d.standardPaise * m)}`, `Standard ${m} महीने · ${rupeesOf(d.standardPaise * m)}`)}
                </button>
              ))}
            </div>
          ) : d.balance > 0 ? (
            <p className="mt-2 text-xs text-muted">{T(`Add ${rupeesOf(d.standardPaise - d.balance)} more and one month of Standard can be taken from the balance.`, `${rupeesOf(d.standardPaise - d.balance)} और जोड़ें, तो balance से Standard का एक महीना ले सकते हैं।`)}</p>
          ) : null}
          {d.lines.length > 0 && (
            <ul className="mt-3 divide-y divide-border text-xs">
              {d.lines.slice(0, 5).map((l) => <li key={l.id} className="flex items-center justify-between py-1.5"><span className="text-muted">{l.reason}</span><span className={`font-semibold tabular-nums ${l.delta_paise < 0 ? "text-danger" : "text-good"}`}>{l.delta_paise < 0 ? "−" : "+"}{rupeesOf(Math.abs(l.delta_paise))}</span></li>)}
            </ul>
          )}
        </section>
      )}

      {/* 3 · a different amount */}
      <section className={box}>
        <p className="text-sm font-bold">{T("Pay a different amount", "अलग रकम देनी है?")}</p>
        <p className="mt-0.5 text-xs text-muted">{T("An advance or a booking, any amount from ₹100. It stays on your account and pays for your plan when you take it.", "Advance या booking, ₹100 से कोई भी रकम। ये आपके account में रहती है और plan लेते समय इसी से कटती है।")}</p>
        {ownCode ? (
          <div className="mt-3 space-y-2">
            <PayRequestButton code={ownCode.code} amountPaise={ownCode.amount} hi={hi} onPaid={() => { setOwnCode(null); setAmount(""); setNote(""); void load(); onChanged?.(); }} />
            <button type="button" onClick={() => setOwnCode(null)} className="text-xs font-semibold text-muted underline">{T("Change the amount", "रकम बदलें")}</button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1"><IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="1000" className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" /></div>
              <button type="button" onClick={makeAdvance} disabled={paise < 10000 || !!busy} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "make" && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Continue", "आगे")}</button>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder={T("Note (optional) — e.g. advance for Premium", "Note (optional) — जैसे Premium के लिए advance")} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
            <div className="flex flex-wrap gap-1.5">{[500, 1000, 2999, 5999].map((v) => <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">₹{v.toLocaleString("en-IN")}</button>)}</div>
          </div>
        )}
        {err && <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{err}</p>}
      </section>
    </div>
  );
}
