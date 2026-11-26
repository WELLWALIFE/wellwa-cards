"use client";
// All bills: bills, estimates, or only the udhaar ones; search by name, mobile or bill number.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, MessageCircle, Search, Smartphone } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import type { BillRow } from "@/lib/mobile";
import { BillLink } from "@/components/mobile/bill-link";
import { MsHelp } from "@/components/mobile/page-help";

type View = "sale" | "estimates" | "due" | "returns";
type ImeiStory = { code: string; item: string; status: string; store: string; in: string; purchase: { supplier: string; bill_no: string; day: string } | null; jobs: { id: string; code: string; status: string; device: string; at: string }[] };
type Remind = { sent: number; skipped: number; manual: { phone: string; name: string; paise: number; link: string }[]; error?: string };
const dt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Bills() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [view, setView] = useState<View>(sp.get("view") === "due" ? "due" : sp.get("view") === "estimates" ? "estimates" : sp.get("view") === "returns" ? "returns" : "sale");
  const [q, setQ] = useState("");
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [err, setErr] = useState("");
  const [imei, setImei] = useState<ImeiStory | null>(null);
  const [rem, setRem] = useState<Remind | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (v: View, text: string) => {
    try {
      const r = await api<{ bills?: BillRow[]; imei?: ImeiStory | null; error?: string }>(`/api/mobile/bills?view=${v}&limit=100${text.trim() ? `&q=${encodeURIComponent(text.trim())}` : ""}${ws.q ? `&${ws.q}` : ""}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setBills(r.data.bills ?? []); setImei(r.data.imei ?? null);
    } catch { setErr("No internet."); }
  }, [ws.q]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(view, q), q ? 350 : 0); return () => clearTimeout(t); }, [view, q, load]);

  const tab = (v: View, label: string) => <button type="button" onClick={() => { setBills(null); setView(v); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${view === v ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{label}</button>;
  const due = (bills ?? []).reduce((a, b) => a + Math.max(0, b.balance_paise), 0);
  async function remindAll() {
    setBusy(true); setRem(null);
    try {
      const r = await api<Remind>("/api/mobile/bills/remind", { method: "POST", json: { as: ws.as || undefined } });
      setRem(r.ok ? r.data : { sent: 0, skipped: 0, manual: [], error: r.data?.error || T("Could not send.", "नहीं भेज पाए।") });
      if (r.ok) void load(view, q);
    } catch { setRem({ sent: 0, skipped: 0, manual: [], error: T("No internet.", "इंटरनेट नहीं है।") }); }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{T("Bills", "बिल")}</h1>
      <MsHelp k="bills" />
      <div className="flex flex-wrap gap-2">{tab("sale", T("Bills", "बिल"))}{tab("due", T("Udhaar", "उधार"))}{tab("estimates", "Estimates")}{tab("returns", T("Returns", "वापसी"))}</div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile, bill number or IMEI", "नाम, मोबाइल, बिल नंबर या IMEI")} /></div>
      {imei && (
        <section className="space-y-1 rounded-2xl border border-brand/40 bg-brand-soft/40 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-bold"><Smartphone className="h-4 w-4" /> IMEI {imei.code}{imei.item ? ` · ${imei.item}` : ""}</p>
          {imei.status && <p>{T("Now", "अभी")}: <b>{imei.status === "in_stock" ? T("in stock", "स्टॉक में") : imei.status === "sold" ? T("sold", "बिक चुका") : imei.status}</b>{imei.in ? ` · ${T("came in", "आया")} ${dt(imei.in)}` : ""}</p>}
          {imei.purchase && <p>{T("Bought from", "किससे ख़रीदा")}: <b>{imei.purchase.supplier || "—"}</b>{imei.purchase.bill_no ? ` · ${T("bill", "बिल")} ${imei.purchase.bill_no}` : ""} · {dt(imei.purchase.day)}</p>}
          {imei.jobs.length > 0 && <p>{T("Repairs", "रिपेयर")}: {imei.jobs.map((j) => <Link key={j.id} href={`/poster/mobile/repair/${j.id}${asQ}`} className="mr-2 font-semibold text-brand-ink">{j.code} ({dt(j.at)}) →</Link>)}</p>}
          {!imei.status && !imei.jobs.length && <p className="text-muted">{T("Only on the bills below.", "सिर्फ़ नीचे के बिलों पर है।")}</p>}
        </section>
      )}
      {view === "due" && bills && bills.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{T("Total udhaar", "कुल उधार")}: <span className="text-danger">{inr(due)}</span> · {bills.length} {T("bills", "बिल")}</p>
        <button type="button" disabled={busy} onClick={() => void remindAll()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366] bg-surface px-3 py-2 text-sm font-semibold text-[#128C7E] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {T("Remind everyone on WhatsApp", "सबको WhatsApp पर याद दिलाएँ")}</button></div>}
      {view === "due" && <p className="text-[11px] text-muted">{T("Each customer gets one message with all their bills and a UPI QR link. Anyone reminded (or billed) in the last 3 days is skipped. To send by itself every few days: Settings → Udhaar reminders.", "हर ग्राहक को एक message जाता है जिसमें उनके सारे बिल और UPI QR का लिंक होता है। पिछले 3 दिन में जिन्हें याद दिलाया (या बिल बना), वो छूट जाते हैं। हर कुछ दिन में अपने-आप भेजने के लिए: Settings → उधार की याद-दिलाई।")}</p>}
      {rem && (
        <div className="space-y-1 rounded-2xl border border-border bg-surface p-3 text-sm">
          {rem.error ? <p className="font-semibold text-danger">{rem.error}</p> : <p className="font-semibold text-good">✅ {T(`Sent to ${rem.sent} customer(s).`, `${rem.sent} ग्राहकों को भेजा।`)}{rem.skipped ? ` ${T(`${rem.skipped} skipped (reminded recently).`, `${rem.skipped} छोड़े (हाल में याद दिलाया था)।`)}` : ""}</p>}
          {rem.manual.length > 0 && <><p className="text-[12px] text-muted">{T("Your WhatsApp is not linked, so send these yourself (tap each):", "आपका WhatsApp जुड़ा नहीं है, इसलिए ये खुद भेजें (हर एक पर दबाएँ):")}</p>
            {rem.manual.map((m) => <a key={m.phone} href={m.link} target="_blank" rel="noreferrer" className="flex justify-between rounded-lg border border-border px-2 py-1.5"><span>{m.name || m.phone}</span><b className="text-[#128C7E]">{inr(m.paise)} →</b></a>)}</>}
        </div>
      )}
      {err && <p className="py-8 text-center font-semibold">{err}</p>}
      {!err && !bills && <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
      {!err && bills && bills.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("Nothing here.", "यहाँ कुछ नहीं है।")}</p>}
      <div className="space-y-2">{(bills ?? []).map((b) => <BillLink key={b.id} b={b} hi={hi} q={asQ} />)}</div>
    </div>
  );
}

export default function BillsPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Bills /></Suspense>;
}
