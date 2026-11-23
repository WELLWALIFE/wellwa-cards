"use client";
// Today's rate: the owner types the 24K (and silver) rate per 10 g; 22K, 18K… fill themselves by purity and can be changed. An
// old-gold buy rate is optional (else the 24K rate less the shop's deduction). The last 30 days below, with who set them.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImageDown, LoaderCircle, MessageCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr, paiseOf, rateMessage, sellRate, type JwSetup, type RateBook } from "@/lib/jewellery";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { rate: RateBook | null; history: { day: string; sell: Record<string, number>; set_by_name: string; updated_at: string }[]; today: string; setup: JwSetup; username?: string; error?: string };

export default function RatePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [sell, setSell] = useState<Record<string, string>>({});   // rupees per 10 g, as typed
  const [buy, setBuy] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/rates${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setMsg({ ok: false, t: r.data?.error || "Could not load." }); return; }
    setD(r.data);
    // Today's own rate, or yesterday's as a start (typed fresh each morning).
    const src = r.data.rate?.sell ?? {};
    setSell(Object.fromEntries(Object.entries(src).map(([k, v]) => [k, String(Math.round((v * 10) / 100))])));
    setBuy(Object.fromEntries(Object.entries(r.data.rate?.buy ?? {}).map(([k, v]) => [k, String(Math.round((v * 10) / 100))])));
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const setup = d?.setup;
  const purities = useMemo(() => (setup?.purities ?? []).filter((p) => p.on), [setup]);
  // The rate as it will be saved (paise per gram), with blanks worked out from the top purity of each metal.
  const book: RateBook = useMemo(() => ({ day: d?.today ?? "", sell: Object.fromEntries(Object.entries(sell).filter(([, v]) => paiseOf(v) > 0).map(([k, v]) => [k, Math.round(paiseOf(v) / 10)])), buy: {} }), [sell, d?.today]);

  async function save() {
    if (!setup) return;
    setBusy(true); setMsg(null);
    const full: Record<string, number> = {};
    for (const p of purities) { const v = sellRate(book, setup, p.key); if (v) full[p.key] = v; }
    const b: Record<string, number> = Object.fromEntries(Object.entries(buy).filter(([, v]) => paiseOf(v) > 0).map(([k, v]) => [k, Math.round(paiseOf(v) / 10)]));
    const r = await api<{ ok?: boolean; error?: string }>("/api/jewellery/rates", { method: "POST", json: { as: ws.as || undefined, sell: full, buy: b } });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    setMsg({ ok: true, t: T("✅ Saved. Every new bill uses this rate.", "✅ Save हो गया। हर नया बिल इसी रेट से बनेगा।") });
    void load();
  }

  if (!d || !setup) return <div className="grid place-items-center py-24">{msg ? <p className="text-danger">{msg.t}</p> : <LoaderCircle className="h-6 w-6 animate-spin text-muted" />}</div>;
  const q = ws.q ? `?${ws.q}` : "";
  const share = rateMessage({ ...book, sell: Object.fromEntries(purities.map((p) => [p.key, sellRate(book, setup, p.key)]).filter(([, v]) => Number(v) > 0)) }, setup, "");

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <h1 className="text-lg font-bold">{T("Today's rate", "आज का रेट")} <span className="text-sm font-normal text-muted">· {d.today}</span></h1>
      <PageHelp k="rate" />
      <p className="text-xs text-muted">{T("Type the rate per 10 grams. Leave 22K / 18K empty and they are worked out from 24K by purity.", "रेट 10 ग्राम का डालें। 22K / 18K खाली छोड़ें तो 24K से purity के हिसाब से अपने-आप बनेंगे।")}</p>

      <section className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-card">
        {purities.map((p) => {
          const auto = !sell[p.key] ? sellRate(book, setup, p.key) : 0;
          return (
            <label key={p.key} className="grid grid-cols-[1fr_9rem] items-center gap-3">
              <span className="text-sm font-semibold">{p.label}<span className="block text-[11px] font-normal text-muted">{auto ? `${T("auto", "अपने-आप")}: ${inr(auto * 10)}` : p.metal === "gold" ? T("gold", "सोना") : p.metal === "silver" ? T("silver", "चाँदी") : "platinum"}</span></span>
              <span className="flex items-center rounded-xl border border-border bg-surface px-2"><span className="text-sm text-muted">₹</span><input inputMode="decimal" value={sell[p.key] ?? ""} placeholder={auto ? String(Math.round(auto * 10 / 100)) : ""} onChange={(e) => setSell({ ...sell, [p.key]: e.target.value.replace(/[^\d.]/g, "") })} className="w-full bg-transparent px-1 py-2 text-right text-base font-bold tabular-nums outline-none" /></span>
            </label>
          );
        })}
        <details className="rounded-xl bg-surface2/60 p-2 text-sm">
          <summary className="cursor-pointer font-semibold">{T("Old gold buy rate (optional)", "पुराना सोना ख़रीद रेट (चाहें तो)")}</summary>
          <p className="mt-1 text-[11px] text-muted">{T(`Empty: today's 24K rate less ${setup.oldGoldDeductBp / 100}% (Settings).`, `खाली: आज का 24K रेट − ${setup.oldGoldDeductBp / 100}% (Settings)।`)}</p>
          {purities.filter((p) => p.metal !== "platinum").map((p) => (
            <label key={p.key} className="mt-1 grid grid-cols-[1fr_9rem] items-center gap-3">
              <span className="text-xs">{p.label}</span>
              <input inputMode="decimal" value={buy[p.key] ?? ""} onChange={(e) => setBuy({ ...buy, [p.key]: e.target.value.replace(/[^\d.]/g, "") })} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-sm tabular-nums" />
            </label>
          ))}
        </details>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Save today's rate", "आज का रेट Save करें")}</button>
          {d.username && d.rate?.day === d.today && <a href={`/api/jewellery/rate-poster/${encodeURIComponent(d.username)}?v=${encodeURIComponent(d.history[0]?.updated_at ?? d.today)}`} target="_blank" rel="noreferrer" download={`rate-${d.today}.png`} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"><ImageDown className="h-4 w-4 text-brand-ink" /> {T("Rate poster", "रेट पोस्टर")}</a>}
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-[#25D366]" /> {T("Share on WhatsApp", "WhatsApp पर भेजें")}</a>
        </div>
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t}</p>}
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-bold">{T("Last 30 days", "पिछले 30 दिन")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-muted"><th className="px-3 py-2">{T("Day", "दिन")}</th>{purities.slice(0, 4).map((p) => <th key={p.key} className="px-3 py-2 text-right">{p.label}</th>)}<th className="px-3 py-2">{T("By", "किसने")}</th></tr></thead>
            <tbody>{d.history.map((h) => (
              <tr key={h.day} className="border-t border-border">
                <td className="px-3 py-1.5">{h.day}</td>
                {purities.slice(0, 4).map((p) => { const v = sellRate({ day: h.day, sell: h.sell, buy: {} }, setup, p.key); return <td key={p.key} className="px-3 py-1.5 text-right tabular-nums">{v ? inr(v * 10) : "—"}</td>; })}
                <td className="px-3 py-1.5 text-muted">{h.set_by_name}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
