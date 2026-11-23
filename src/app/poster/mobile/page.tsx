"use client";
// Shubhora Mobile Shop — home (plan https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd): the big New bill button, today's close
// (sale, cash and UPI apart, profit for those who may see it), udhaar, low stock and the latest bills.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, ChevronRight, FileText, IndianRupee, LoaderCircle, PackagePlus, ReceiptText, Settings2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { WorkspaceSwitch, useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import type { BillRow, DayClose, MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { MsHelp } from "@/components/mobile/page-help";
import { BillLink } from "@/components/mobile/bill-link";
import { OfflineBar } from "@/components/mobile/offline-bar";

type Home = { shop: string; setup: MsSetup; access: MsAccess; today: string; day: string; close: DayClose; items: number; low: { id: string; name: string; brand: string; variant: string; stock: number; low: number }[]; due: { count: number; paise: number }; recent: BillRow[]; error?: string };

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
      <MsHelp k="home" />
      <OfflineBar as={ws.as} onSynced={() => void load()} />
      {d.items === 0 && can("stock") && <Link href={`/poster/mobile/items${q}`} className="block rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">{T("Start here: add the items you sell (name and price) →", "यहाँ से शुरू करें: जो बेचते हैं वो items जोड़ें (नाम और दाम) →")}</Link>}

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/poster/mobile/bill${q}`} className="flex flex-col items-center gap-1 rounded-2xl grad-brand px-4 py-5 text-white shadow-card"><ReceiptText className="h-6 w-6" /><span className="text-base font-bold">{T("New bill", "नया बिल")}</span><span className="text-[11px] opacity-90">{T("Search or scan", "खोजें या scan करें")}</span></Link>
        <Link href={`/poster/mobile/bill${amp}kind=estimate`} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-brand/40 bg-surface px-4 py-5 shadow-card"><FileText className="h-6 w-6 text-brand" /><span className="text-base font-bold">Estimate</span><span className="text-[11px] text-muted">{T("Price for the customer", "ग्राहक के लिए दाम")}</span></Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={tile}><p className="text-[11px] text-muted">{T("Today's sale", "आज की बिक्री")}</p><p className="text-lg font-bold tabular-nums">{inr(close.sale)}</p><p className="text-[11px] text-muted">{close.bills} {close.bills === 1 ? T("bill", "बिल") : T("bills", "बिल")} · {close.qty} {T("pcs", "पीस")}</p></div>
        <div className={tile}><p className="text-[11px] text-muted">{T("Money in today", "आज आए पैसे")}</p><p className="text-lg font-bold tabular-nums text-good">{inr(close.moneyTotal)}</p><p className="text-[11px] text-muted">Cash {inr(close.money.cash)} · UPI {inr(close.money.upi)}{close.money.card ? ` · Card ${inr(close.money.card)}` : ""}</p></div>
        {can("cost") && <div className={tile}><p className="text-[11px] text-muted">{T("Today's profit", "आज का मुनाफ़ा")}</p><p className="text-lg font-bold tabular-nums">{inr(close.profit)}</p><p className="text-[11px] text-muted">{T("sale − cost of goods", "बिक्री − माल की लागत")}</p></div>}
        {can("reports") && <Link href={`/poster/mobile/bills${amp}view=due`} className={tile}><p className="flex items-center gap-1 text-[11px] text-muted"><IndianRupee className="h-3 w-3" /> {T("Udhaar", "उधार")}</p><p className="text-lg font-bold tabular-nums text-danger">{inr(d.due.paise)}</p><p className="text-[11px] text-muted">{d.due.count} {T("bills", "बिल")} →</p></Link>}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {can("stock") && <Link href={`/poster/mobile/items${q}`} className={`${tile} flex items-center justify-between`}><span><p className="flex items-center gap-1 text-[11px] text-muted"><Boxes className="h-3 w-3" /> {T("Items & stock", "Items और स्टॉक")}</p><p className="text-sm font-bold">{d.items} {T("items", "items")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
        {can("stock") && <Link href={`/poster/mobile/purchase${q}`} className={`${tile} flex items-center justify-between`}><span><p className="flex items-center gap-1 text-[11px] text-muted"><PackagePlus className="h-3 w-3" /> {T("Purchase", "ख़रीद")}</p><p className="text-sm font-bold">{T("Stock came in", "माल आया")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>}
        <Link href={`/poster/mobile/bills${q}`} className={`${tile} col-span-2 flex items-center justify-between sm:col-span-1`}><span><p className="text-[11px] text-muted">{T("All bills", "सारे बिल")}</p><p className="text-sm font-bold">{T("Search, print, send", "खोजें, print, भेजें")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>
      </div>

      {d.low.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> {T(`Low stock (${d.low.length})`, `कम स्टॉक (${d.low.length})`)}</p>
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
