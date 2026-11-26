"use client";
// Shop expenses and the day's cash book (owner, 26 Nov 2026 — Vyapar / myBillBook have it): rent, electricity, salary, tea… are
// written in two taps, the month's total by head, and "cash that should be in the drawer" = cash in today − cash spent today.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { MsHelp } from "@/components/mobile/page-help";
import { inr, paiseOf } from "@/lib/jewellery";
import { EXPENSE_CATS, expenseCat, storeName, type DayClose, type ExpenseRow, type MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";

type Ans = { month: string; today: string; expenses: ExpenseRow[]; byCat: Record<string, number>; total: number; access: MsAccess; setup: MsSetup; error?: string };

export default function ExpensesPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  const [month, setMonth] = useState("");
  const [d, setD] = useState<Ans | null>(null);
  const [close, setClose] = useState<DayClose | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ category: "tea", amount: "", mode: "cash", note: "", day: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async (m: string) => {
    try {
      const [r, h] = await Promise.all([api<Ans>(`/api/mobile/expenses${amp}month=${m}`, { fresh: true }), api<{ close?: DayClose }>(`/api/mobile${asQ}`, { fresh: true })]);
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setD(r.data); setMonth(r.data.month); setClose(h.ok ? h.data.close ?? null : null);
    } catch { setErr("No internet."); }
  }, [amp, asQ]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(""); })(); }, [router, load]);

  async function save() {
    setNote(null);
    if (!paiseOf(f.amount)) { setNote({ ok: false, t: T("Type the amount.", "रक़म लिखें।") }); return; }
    setBusy(true);
    let store = "";
    try { store = localStorage.getItem("shubhora.ms-store") ?? ""; } catch { /* ignore */ }
    try {
      const r = await api<{ expense?: ExpenseRow; error?: string }>("/api/mobile/expenses", { method: "POST", json: { as: ws.as || undefined, category: f.category, amount_paise: paiseOf(f.amount), mode: f.mode, note: f.note, day: f.day || undefined, store } });
      setBusy(false);
      if (!r.ok) { setNote({ ok: false, t: r.data?.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
      setF({ ...f, amount: "", note: "" }); setNote({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") }); void load(month);
    } catch { setBusy(false); setNote({ ok: false, t: T("No internet.", "इंटरनेट नहीं है।") }); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { const r = await api<{ error?: string }>(`/api/mobile/expenses${amp}id=${id}`, { method: "DELETE" }); if (!r.ok) setNote({ ok: false, t: r.data?.error || T("Could not remove.", "हटा नहीं पाए।") }); else void load(month); } catch { /* offline */ }
    setBusy(false);
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const can = (r: string) => d.access.owner || d.access.rights.includes(r as never);
  const todays = d.expenses.filter((e) => e.day === d.today);
  const cashOut = todays.filter((e) => e.mode === "cash").reduce((a, e) => a + e.amount_paise, 0);
  const inp = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm";
  const lab = "block text-[12px] font-semibold text-muted";
  const chip = (on: boolean) => `rounded-xl border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-brand bg-brand text-white" : "border-border bg-surface"}`;
  const shift = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + by, 1)); return t.toISOString().slice(0, 7); };
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{T("Expenses & cash book", "ख़र्चे और रोकड़")}</h1>
      <MsHelp k="expenses" />

      {close && can("reports") && (
        <section className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-brand/40 bg-surface p-3 text-center">
          <div><p className="text-[11px] text-muted">{T("Cash in today", "आज आया cash")}</p><p className="text-base font-bold tabular-nums text-good">{inr(close.money.cash)}</p></div>
          <div><p className="text-[11px] text-muted">{T("Cash spent today", "आज cash ख़र्च")}</p><p className="text-base font-bold tabular-nums text-danger">{inr(cashOut)}</p></div>
          <div><p className="text-[11px] text-muted">{T("Should be in drawer", "दराज़ में होना चाहिए")}<FieldTip lang={lang} en="Today's cash from bills, udhaar and repair advances (returns given back taken off), minus cash expenses written today. Add the cash you started the day with." hi="आज बिल, उधार और रिपेयर advance का cash (वापसी में लौटाया घटाकर), घटा आज लिखे cash ख़र्चे। सुबह जितना cash रखा था वो इसमें जोड़ लें।" /></p><p className="text-base font-bold tabular-nums">{inr(close.money.cash - cashOut)}</p></div>
        </section>
      )}

      {can("expense") && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-3">
          <div className="flex flex-wrap gap-1.5">{EXPENSE_CATS.map((c) => <button key={c.key} type="button" onClick={() => setF({ ...f, category: c.key })} className={chip(f.category === c.key)}>{hi ? c.hi : c.en}</button>)}</div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className={lab}>{T("Amount ₹", "रक़म ₹")}<input className={inp} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
            <label className={lab}>{T("Paid by", "कैसे दिया")}<select className={inp} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option></select></label>
            <label className={lab}>{T("Date", "तारीख़")}<input type="date" className={inp} max={d.today} value={f.day || d.today} onChange={(e) => setF({ ...f, day: e.target.value })} /></label>
            <label className={lab}>{T("Note", "नोट")} <span className="font-normal">(optional)</span><input className={inp} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          </div>
          {note && <p className={`text-sm font-semibold ${note.ok ? "text-good" : "text-danger"}`}>{note.t}</p>}
          <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Save expense", "ख़र्चा Save करें")}</button>
        </section>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => void load(shift(month, -1))} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">←</button>
        <p className="text-sm font-bold">{new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}: <span className="text-danger">{inr(d.total)}</span></p>
        <button type="button" disabled={month >= d.today.slice(0, 7)} onClick={() => void load(shift(month, 1))} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-40">→</button>
      </div>
      {Object.keys(d.byCat).length > 0 && <ul className="grid gap-x-4 rounded-2xl border border-border bg-surface p-3 text-[13px] sm:grid-cols-2">{Object.entries(d.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between"><span>{expenseCat(k, hi)}</span><b className="tabular-nums">{inr(v)}</b></li>)}</ul>}
      {d.expenses.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("No expenses this month.", "इस महीने कोई ख़र्चा नहीं।")}</p>}
      <div className="space-y-1.5">
        {d.expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <span className="min-w-0"><span className="font-semibold">{expenseCat(e.category, hi)}</span>{e.note ? <span className="text-muted"> · {e.note}</span> : null}
              <span className="block text-[11px] text-muted">{new Date(`${e.day}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {e.mode.toUpperCase()} · {e.created_by_name}{d.setup.stores.length ? ` · ${storeName(d.setup, e.store, hi)}` : ""}</span></span>
            <span className="flex shrink-0 items-center gap-2"><b className="tabular-nums">{inr(e.amount_paise)}</b>{(d.access.owner || can("setup")) && <button type="button" aria-label="Remove" disabled={busy} onClick={() => void remove(e.id)} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
