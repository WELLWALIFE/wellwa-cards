"use client";
// Shubhora Mobile Shop — home (plan https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd): the big New bill button, today's close
// (sale, cash and UPI apart, profit for those who may see it), udhaar, low stock and the latest bills.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Boxes, Wallet, Wrench, ChevronRight, FileText, IndianRupee, LoaderCircle, PackagePlus, ReceiptText, Settings2, Target } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { WorkspaceSwitch, useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import type { BillRow, DayClose, MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { MsHelp } from "@/components/mobile/page-help";
import { FieldTip } from "@/components/field-tip";
import { BookOpen } from "lucide-react";
import { BillLink } from "@/components/mobile/bill-link";
import { OfflineBar } from "@/components/mobile/offline-bar";
import { MobileStartList } from "@/components/mobile/start-list";

type Home = { shop: string; setup: MsSetup; access: MsAccess; today: string; day: string; close: DayClose; items: number; low: { id: string; name: string; brand: string; variant: string; stock: number; low: number }[]; due: { count: number; paise: number }; recent: BillRow[]; jobs?: { open: number; ready: number; late: number }; seeJobs?: boolean; expenses?: number | null; month?: { sale: number; target: number } | null; stores?: number; error?: string };

export default function MobileHome() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Home | null>(null);
  const [err, setErr] = useState("");
  const [offline, setOffline] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api<Home>(`/api/mobile${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load. Please try again."); return; }
      setErr(""); setOffline(false); setD(r.data);
    } catch { setOffline(true); }
  }, [ws.q]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  if (err) return <div className="space-y-3 py-16 text-center"><p className="font-semibold">{err}</p>{/advanced feature/i.test(err) && <Link href="/poster/dukaan" className="text-sm font-semibold text-brand-ink">{T("See My Shop →", "दुकान देखें →")}</Link>}</div>;
  if (!d && offline) return (
    <div className="space-y-3 py-6">
      <OfflineBar as={ws.as} onSynced={() => void load()} />
      <Link href={`/poster/mobile/bill${ws.q ? `?${ws.q}` : ""}`} className="flex flex-col items-center gap-1 rounded-2xl grad-brand px-4 py-6 text-white shadow-card"><ReceiptText className="h-6 w-6" /><span className="text-base font-bold">{T("New bill", "नया बिल")}</span></Link>
      <p className="text-center text-sm text-muted">{T("Today's numbers show when the internet is back.", "आज के आँकड़े इंटरनेट आने पर दिखेंगे।")}</p>
    </div>
  );
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { close, access } = d;
  const can = (r: string) => access.owner || access.rights.includes(r as never);
  const q = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  const tile = "rounded-2xl border border-border bg-surface p-3";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">📱 {T("Mobile shop", "मोबाइल दुकान")}</h1>
        <div className="flex items-center gap-2">
          <WorkspaceSwitch as={ws.as} setAs={ws.setAs} teams={ws.teams} hi={hi} />
          {can("setup") && <Link href={`/poster/mobile/settings${q}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Settings2 className="h-4 w-4" /> Settings</Link>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2"><MsHelp k="home" /><Link href={`/poster/mobile/guide${q}`} className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink"><BookOpen className="h-3.5 w-3.5" /> {T("Full guide: how to use", "पूरी guide: कैसे चलाएँ")}</Link></div>
      <OfflineBar as={ws.as} onSynced={() => void load()} />
      {access.owner && <MobileStartList hi={hi} q={ws.q ?? ""} auto={[!!(d.setup.shopName && d.setup.phone && d.setup.address), d.items > 0, d.recent.some((b) => b.kind === "sale"), (!!d.jobs && d.jobs.open > 0) || d.recent.some((b) => /^Repair job/.test(b.notes ?? "")), false, false, false]} />}
      {d.items === 0 && can("stock") && <Link href={`/poster/mobile/items${q}`} className="block rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">{T("Start here: add the items you sell (name and price) →", "यहाँ से शुरू करें: जो बेचते हैं वो items जोड़ें (नाम और दाम) →")}</Link>}

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/poster/mobile/bill${q}`} className="flex flex-col items-center gap-1 rounded-2xl grad-brand px-4 py-5 text-white shadow-card"><ReceiptText className="h-6 w-6" /><span className="text-base font-bold">{T("New bill", "नया बिल")}</span><span className="text-[11px] opacity-90">{T("Search or scan", "खोजें या scan करें")}</span></Link>
        <Link href={`/poster/mobile/bill${amp}kind=estimate`} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-brand/40 bg-surface px-4 py-5 shadow-card"><FileText className="h-6 w-6 text-brand" /><span className="text-base font-bold">Estimate</span><span className="text-[11px] text-muted">{T("Price for the customer", "ग्राहक के लिए दाम")}</span></Link>
      </div>

      {d.seeJobs && d.jobs && (
        <div className="grid grid-cols-2 gap-3">
          {can("repair") && <Link href={`/poster/mobile/repair${q}`} className="flex items-center gap-2 rounded-2xl border-2 border-brand/40 bg-surface px-3 py-3 shadow-card"><Wrench className="h-5 w-5 shrink-0 text-brand" /><span><span className="block text-sm font-bold">{T("New repair job", "नया रिपेयर job")}</span><span className="block text-[11px] text-muted">{T("A phone came for repair", "फ़ोन रिपेयर के लिए आया")}</span></span></Link>}
          <Link href={`/poster/mobile/repairs${q}`} className={`${tile} ${can("repair") ? "" : "col-span-2"}`}><p className="text-[11px] text-muted">{T("Repair jobs in the shop", "दुकान में रिपेयर jobs")}<FieldTip lang={lang} en="Phones that are with you for repair right now. Ready = repaired but not collected. Late = the promised day has passed." hi="जो फ़ोन अभी रिपेयर के लिए आपके पास हैं। तैयार = बन गए पर ले नहीं गए। देर = वादे का दिन निकल गया।" /></p><p className="text-lg font-bold tabular-nums">{d.jobs.open}</p>
            <p className="text-[11px]"><span className="font-semibold text-good">{d.jobs.ready} {T("ready", "तैयार")}</span>{d.jobs.late > 0 && <span className="font-semibold text-danger"> · {d.jobs.late} {T("late", "देर")}</span>} →</p></Link>
        </div>
      )}

      {d.month && d.month.target > 0 && (
        <div className={tile}>
          <p className="flex items-center gap-1 text-[11px] text-muted"><Target className="h-3 w-3" /> {T("My sale this month", "इस महीने मेरी बिक्री")}</p>
          <p className="text-sm font-bold tabular-nums">{inr(d.month.sale)} <span className="font-normal text-muted">/ {inr(d.month.target)}</span></p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full grad-brand" style={{ width: `${Math.min(100, Math.max(0, (d.month.sale * 100) / d.month.target))}%` }} /></div>
        </div>
      )}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={tile}><p className="text-[11px] text-muted">{T("Today's sale", "आज की बिक्री")}<FieldTip lang={lang} en="The total of today's bills, after anything returned today. Cancelled bills are not counted." hi="आज के बिलों का जोड़, आज की वापसी घटाकर। रद्द बिल नहीं गिने जाते।" /></p><p className="text-lg font-bold tabular-nums">{inr(close.sale)}</p><p className="text-[11px] text-muted">{close.bills} {close.bills === 1 ? T("bill", "बिल") : T("bills", "बिल")} · {close.qty} {T("pcs", "पीस")}</p></div>
        <div className={tile}><p className="text-[11px] text-muted">{T("Money in today", "आज आए पैसे")}<FieldTip lang={lang} en="Money that really came today: on today's bills, old udhaar paid today, and repair advances. Udhaar not yet paid is not here." hi="आज सच में आया पैसा: आज के बिलों का, पुराना उधार जो आज चुका, और रिपेयर के advance। जो उधार अभी नहीं आया वो इसमें नहीं है।" /></p><p className="text-lg font-bold tabular-nums text-good">{inr(close.moneyTotal)}</p><p className="text-[11px] text-muted">Cash {inr(close.money.cash)} · UPI {inr(close.money.upi)}{close.money.card ? ` · Card ${inr(close.money.card)}` : ""}{close.money.other ? ` · EMI/Other ${inr(close.money.other)}` : ""}</p></div>
        {can("cost") && <div className={tile}><p className="text-[11px] text-muted">{T("Today's profit", "आज का मुनाफ़ा")}<FieldTip lang={lang} en="Sale minus what the goods cost you. It is right only if you typed the cost on your items. Only you see it." hi="बिक्री में से माल की लागत घटाकर। ये तभी सही है जब items पर लागत लिखी हो। ये सिर्फ़ आपको दिखता है।" /></p><p className="text-lg font-bold tabular-nums">{inr(close.profit)}</p><p className="text-[11px] text-muted">{T("sale − cost of goods", "बिक्री − माल की लागत")}</p></div>}
        {can("reports") && <Link href={`/poster/mobile/bills${amp}view=due`} className={tile}><p className="flex items-center gap-1 text-[11px] text-muted"><IndianRupee className="h-3 w-3" /> {T("Udhaar", "उधार")}<FieldTip lang={lang} en="All the money customers still owe you, on every bill. Tap to see the bills." hi="ग्राहकों पर आपका कुल बाकी पैसा, सारे बिलों का। बिल देखने के लिए दबाएँ।" /></p><p className="text-lg font-bold tabular-nums text-danger">{inr(d.due.paise)}</p><p className="text-[11px] text-muted">{d.due.count} {T("bills", "बिल")} →</p></Link>}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {can("stock") && <Link href={`/poster/mobile/items${q}`} className={`${tile} flex items-center justify-between`}><span><p className="flex items-center gap-1 text-[11px] text-muted"><Boxes className="h-3 w-3" /> {T("Items & stock", "Items और स्टॉक")}</p><p className="text-sm font-bold">{d.items} {T("items", "items")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
        {can("stock") && <Link href={`/poster/mobile/purchase${q}`} className={`${tile} flex items-center justify-between`}><span><p className="flex items-center gap-1 text-[11px] text-muted"><PackagePlus className="h-3 w-3" /> {T("Purchase", "ख़रीद")}</p><p className="text-sm font-bold">{T("Stock came in", "माल आया")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
        {can("reports") && <Link href={`/poster/mobile/reports${q}`} className={`${tile} flex items-center justify-between`}><span><p className="text-[11px] text-muted">{T("Reports", "रिपोर्ट")}</p><p className="text-sm font-bold">{T("Month, GST, Excel", "महीना, GST, Excel")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
        <Link href={`/poster/mobile/bills${q}`} className={`${tile} flex items-center justify-between`}><span><p className="text-[11px] text-muted">{T("All bills", "सारे बिल")}</p><p className="text-sm font-bold">{T("Search, print, send", "खोजें, print, भेजें")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>
        {d.expenses !== null && d.expenses !== undefined && <Link href={`/poster/mobile/expenses${q}`} className={`${tile} flex items-center justify-between`}><span><p className="flex items-center gap-1 text-[11px] text-muted"><Wallet className="h-3 w-3" /> {T("Expenses & cash book", "ख़र्चे और रोकड़")}</p><p className="text-sm font-bold">{d.expenses > 0 ? `${T("Today", "आज")} ${inr(d.expenses)}` : T("Rent, tea, salary…", "किराया, चाय, तनख़्वाह…")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
        {!!d.stores && can("stock") && <Link href={`/poster/mobile/transfer${q}`} className={`${tile} flex items-center justify-between`}><span><p className="flex items-center gap-1 text-[11px] text-muted"><ArrowLeftRight className="h-3 w-3" /> {T("Stock transfer", "स्टॉक ट्रांसफ़र")}</p><p className="text-sm font-bold">{T("Between branches", "ब्रांचों के बीच")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
      </div>

      {d.low.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> {T(`Low stock (${d.low.length})`, `कम स्टॉक (${d.low.length})`)}<FieldTip lang={lang} en="Items that reached the 'Low stock at' number you set on them. Order these." hi="जो items आपके लिखे 'कम स्टॉक' नंबर तक पहुँच गए। इन्हें मँगवाएँ।" /></p>
          <ul className="mt-1 grid gap-x-4 text-[13px] sm:grid-cols-2">{d.low.slice(0, 12).map((l) => <li key={l.id} className="flex justify-between"><span className="truncate">{[l.brand, l.name, l.variant].filter(Boolean).join(" ")}</span><b className="tabular-nums">{l.stock}</b></li>)}</ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">{T("Latest", "हाल के")}</h2>
        {d.recent.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("No bills yet. Make the first one with “New bill”.", "अभी कोई बिल नहीं। “नया बिल” से पहला बनाइए।")}</p>}
        {d.recent.map((b) => <BillLink key={b.id} b={b} hi={hi} q={q} />)}
      </section>
    </div>
  );
}
