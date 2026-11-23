"use client";
// Reports: pick the days (today, yesterday, this month, last month, this financial year, or any dates) and see the sale, GST,
// money in by mode, old gold, purity-wise weight, HSN and B2B — with the day close for WhatsApp and CSV files for Excel / the CA.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, LoaderCircle, MessageCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { grams, inr } from "@/lib/jewellery";
import { b2bCsv, dayCloseText, dayCsv, hsnCsv, istDate, salesCsv, type Report } from "@/lib/jewellery-reports";

type Ans = { report: Report; today: string; shop: string; stateCode: string; gstin: string; due: { count: number; paise: number }; capped: boolean; error?: string };

const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
function presets(today: string) {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = shift(monthStart, -1);
  const fyStart = `${m >= 4 ? y : y - 1}-04-01`;
  return { today: [today, today], yesterday: [shift(today, -1), shift(today, -1)], month: [monthStart, today], last: [`${lastMonthEnd.slice(0, 7)}-01`, lastMonthEnd], fy: [fyStart, today] } as Record<string, [string, string]>;
}

function save(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Reports() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const todayIst = useMemo(() => istDate(new Date().toISOString()), []);
  const [range, setRange] = useState<[string, string]>([todayIst, todayIst]);
  const [preset, setPreset] = useState("today");
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    const p = new URLSearchParams(ws.q); p.set("from", range[0]); p.set("to", range[1]);
    const r = await api<Ans>(`/api/jewellery/reports?${p}`, { fresh: true });
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [ws.q, range]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const P = presets(todayIst);
  const pick = (k: string) => { setPreset(k); setRange(P[k]); };
  const asQ = ws.q ? `?${ws.q}` : "";
  const r = d?.report;
  const tag = r ? (r.range.from === r.range.to ? r.range.from : `${r.range.from}_to_${r.range.to}`) : "";
  const card = "rounded-2xl border border-border bg-surface p-3";
  const th = "px-2 py-1.5 text-left text-[11px] font-semibold text-muted";
  const td = "px-2 py-1.5 tabular-nums";
  const modeName: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: T("Bank", "बैंक"), cheque: T("Cheque", "चेक"), other: T("Other", "अन्य") };

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <h1 className="text-lg font-bold">{T("Reports", "रिपोर्ट")}</h1>
      <div className="flex flex-wrap gap-1.5">
        {([["today", T("Today", "आज")], ["yesterday", T("Yesterday", "कल")], ["month", T("This month", "इस महीने")], ["last", T("Last month", "पिछला महीना")], ["fy", T("This financial year", "इस वित्त वर्ष")]] as [string, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => pick(k)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${preset === k ? "border-brand bg-brand/10 text-brand-ink" : "border-border"}`}>{l}</button>
        ))}
        <span className="flex items-center gap-1 text-xs">
          <input type="date" value={range[0]} max={todayIst} onChange={(e) => { setPreset(""); setRange([e.target.value, range[1]]); }} className="rounded-lg border border-border bg-surface px-2 py-1" />
          →
          <input type="date" value={range[1]} max={todayIst} onChange={(e) => { setPreset(""); setRange([range[0], e.target.value]); }} className="rounded-lg border border-border bg-surface px-2 py-1" />
        </span>
      </div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {!r || !d ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : (
        <div className={`space-y-4 ${busy ? "opacity-60" : ""}`}>
          {d.capped && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{T("Very many bills — pick fewer days for exact totals.", "बहुत ज़्यादा बिल — सही जोड़ के लिए कम दिन चुनें।")}</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className={card}><p className="text-[11px] text-muted">{T("Sale", "बिक्री")}</p><p className="text-lg font-bold tabular-nums">{inr(r.total)}</p><p className="text-[11px] text-muted">{r.bills} {T("bills", "बिल")}</p></div>
            <div className={card}><p className="text-[11px] text-muted">GST</p><p className="text-lg font-bold tabular-nums">{inr(r.gst)}</p><p className="text-[11px] text-muted">{T("taxable", "taxable")} {inr(r.taxable)}</p></div>
            <div className={card}><p className="text-[11px] text-muted">{T("Money in", "आए पैसे")}</p><p className="text-lg font-bold tabular-nums text-good">{inr(r.moneyTotal)}</p><p className="text-[11px] text-muted">{T("orders", "ऑर्डर")} {inr(r.fromOrders)}</p></div>
            <div className={card}><p className="text-[11px] text-muted">{T("Udhaar (all bills)", "उधार (सारे बिल)")}</p><p className="text-lg font-bold tabular-nums text-danger">{inr(d.due.paise)}</p><p className="text-[11px] text-muted">{d.due.count} {T("bills", "बिल")}</p></div>
          </div>

          <section className={`${card} space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{r.range.from === r.range.to && r.range.from === d.today ? T("Day close — today", "डे क्लोज़ — आज") : T("Summary", "सार")}</h2>
              <a href={`https://wa.me/?text=${encodeURIComponent(dayCloseText(r, d.shop, d.due.paise))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"><MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> {T("Send on WhatsApp", "WhatsApp पर भेजें")}</a>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {(Object.entries(r.money) as [string, number][]).filter(([, v]) => v > 0).map(([k, v]) => <p key={k} className="flex justify-between"><span className="text-muted">{modeName[k] ?? k}</span><b className="tabular-nums">{inr(v)}</b></p>)}
              {r.fromSchemes > 0 && <p className="flex justify-between"><span className="text-muted">{T("of it: gold scheme", "इनमें: गोल्ड स्कीम")}</span><span className="tabular-nums">{inr(r.fromSchemes)}</span></p>}
              {(r.girviInterest > 0 || r.girviPrincipal > 0) && <p className="flex justify-between"><span className="text-muted">{T("of it: girvi (interest / principal)", "इनमें: गिरवी (ब्याज / मूल)")}</span><span className="tabular-nums">{inr(r.girviInterest)} / {inr(r.girviPrincipal)}</span></p>}
              {r.girviGiven > 0 && <p className="flex justify-between"><span className="text-muted">{T("Girvi loans given (out)", "गिरवी लोन दिए (बाहर)")}</span><span className="tabular-nums text-danger">− {inr(r.girviGiven)}</span></p>}
              <p className="flex justify-between"><span className="text-muted">CGST</span><span className="tabular-nums">{inr(r.cgst)}</span></p>
              <p className="flex justify-between"><span className="text-muted">SGST</span><span className="tabular-nums">{inr(r.sgst)}</span></p>
              <p className="flex justify-between"><span className="text-muted">IGST</span><span className="tabular-nums">{inr(r.igst)}</span></p>
              <p className="flex justify-between"><span className="text-muted">{T("Making", "मेकिंग")}</span><span className="tabular-nums">{inr(r.making)}</span></p>
              <p className="flex justify-between"><span className="text-muted">{T("Discount", "छूट")}</span><span className="tabular-nums">{inr(r.discount)}</span></p>
              <p className="flex justify-between"><span className="text-muted">{T("Old gold taken", "पुराना सोना लिया")}</span><span className="tabular-nums">{grams(r.oldFine.gold)} · {inr(r.oldValue)}</span></p>
            </div>
          </section>

          {r.byPurity.length > 0 && (
            <section className={card}>
              <h2 className="mb-1 text-sm font-bold">{T("Sold by purity", "Purity के हिसाब से बिका")}</h2>
              <table className="w-full text-sm"><thead><tr><th className={th}>{T("Purity", "Purity")}</th><th className={th}>{T("Pcs", "पीस")}</th><th className={th}>{T("Net", "शुद्ध")}</th><th className={th}>Fine</th><th className={th}>Taxable</th></tr></thead>
                <tbody>{r.byPurity.map((p) => <tr key={p.purity} className="border-t border-border"><td className={td}>{p.label}</td><td className={td}>{p.pieces}</td><td className={td}>{grams(p.netMg)}</td><td className={td}>{grams(p.fineMg)}</td><td className={td}>{inr(p.amount)}</td></tr>)}</tbody></table>
            </section>
          )}

          <section className={card}>
            <h2 className="mb-1 text-sm font-bold">GST {d.gstin ? `· ${d.gstin}` : ""}</h2>
            <table className="w-full text-sm"><thead><tr><th className={th}>HSN</th><th className={th}>{T("Net wt", "वज़न")}</th><th className={th}>Taxable</th><th className={th}>CGST</th><th className={th}>SGST</th><th className={th}>IGST</th></tr></thead>
              <tbody>{r.hsn.map((h) => <tr key={h.hsn} className="border-t border-border"><td className={td}>{h.hsn}</td><td className={td}>{grams(h.netMg)}</td><td className={td}>{inr(h.taxable)}</td><td className={td}>{inr(h.cgst)}</td><td className={td}>{inr(h.sgst)}</td><td className={td}>{inr(h.igst)}</td></tr>)}</tbody></table>
            <p className="mt-2 text-[11px] text-muted">{T(`B2B (customer GSTIN): ${r.b2b.length} bills · B2C: ${r.b2c.map((x) => `${x.state || "—"} ${inr(x.taxable)}`).join(", ") || "—"}. Check with your CA before filing.`, `B2B (ग्राहक GSTIN): ${r.b2b.length} बिल · B2C: ${r.b2c.map((x) => `${x.state || "—"} ${inr(x.taxable)}`).join(", ") || "—"}। फ़ाइल करने से पहले CA से मिलान करें।`)}</p>
          </section>

          {r.byDay.length > 1 && (
            <section className={card}>
              <h2 className="mb-1 text-sm font-bold">{T("Day by day", "दिन के हिसाब से")}</h2>
              <table className="w-full text-sm"><thead><tr><th className={th}>{T("Date", "तारीख़")}</th><th className={th}>{T("Bills", "बिल")}</th><th className={th}>{T("Sale", "बिक्री")}</th><th className={th}>GST</th><th className={th}>{T("Money in", "आए पैसे")}</th></tr></thead>
                <tbody>{r.byDay.map((x) => <tr key={x.day} className="border-t border-border"><td className={td}>{x.day}</td><td className={td}>{x.bills}</td><td className={td}>{inr(x.total)}</td><td className={td}>{inr(x.gst)}</td><td className={td}>{inr(x.money)}</td></tr>)}</tbody></table>
            </section>
          )}

          <section className={`${card} space-y-2`}>
            <h2 className="text-sm font-bold">{T("Download for Excel / your CA", "Excel / CA के लिए डाउनलोड")}</h2>
            <div className="flex flex-wrap gap-2">
              {([["sales", T("Sales register", "बिक्री रजिस्टर"), () => salesCsv(r)], ["hsn", T("HSN summary", "HSN सार"), () => hsnCsv(r)], ["b2b", T("B2B invoices", "B2B बिल"), () => b2bCsv(r)], ["days", T("Day by day", "रोज़ का"), () => dayCsv(r)]] as [string, string, () => string][]).map(([k, l, f]) => (
                <button key={k} type="button" onClick={() => save(`${k}_${tag}.csv`, f())} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> {l}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted">{T("CSV files open in Excel and Google Sheets. For Tally, import the sales register with your Excel-to-Tally tool or give it to your accountant — a direct Tally file is not made here yet.", "CSV फ़ाइलें Excel और Google Sheets में खुलती हैं। Tally के लिए बिक्री रजिस्टर अपने Excel-to-Tally tool से import करें या अकाउंटेंट को दें — सीधी Tally फ़ाइल अभी यहाँ नहीं बनती।")}</p>
          </section>
        </div>
      )}
    </div>
  );
}
