"use client";
// Shubhora Jewellery — home (plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK): today's rate, the two big buttons (Bill,
// Estimate), today's sale, money due and the latest bills. Built like Orders · Silai: the shop's own logins see their shop.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, FileText, Gem, Hammer, IndianRupee, LoaderCircle, Plus, ReceiptText, Settings2, Tags, TrendingUp } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { WorkspaceSwitch, useWorkspace } from "@/components/orders/orders-common";
import { inr, sellRate, type BillRow, type JwSetup, type RateBook } from "@/lib/jewellery";
import type { JwAccess } from "@/lib/jewellery-types";
import { BillRowLink } from "@/components/jewellery/bill-row";

type Home = { shop: string; setup: JwSetup; access: JwAccess; rate: RateBook | null; today: string; stats: { todaySales: number; todayPaise: number; todayEstimates: number; dueCount: number; duePaise: number; ordersOpen?: number; ordersReady?: number; ordersLate?: number }; recent: BillRow[]; error?: string };

export default function JewelleryHome() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Home | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const r = await api<Home>(`/api/jewellery${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || T("Could not load. Please try again.", "Load नहीं हुआ। फिर try करें।")); return; }
    setErr(""); setD(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  if (err) return <div className="space-y-3 py-16 text-center"><p className="font-semibold">{err}</p>{/addon_off|advanced feature/i.test(err) && <Link href="/poster/more" className="text-sm font-semibold text-brand-ink">{T("See Advanced features →", "Advanced features देखें →")}</Link>}</div>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { setup, rate, stats, access } = d;
  const can = (r: string) => access.owner || access.rights.includes(r as never);
  const stale = !rate || rate.day !== d.today;
  const shown = setup.purities.filter((p) => p.on).slice(0, 6);
  const q = ws.q ? `?${ws.q}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold">💍 {T("Jewellery", "ज्वेलरी")}</h1>
        <div className="flex items-center gap-2">
          <WorkspaceSwitch as={ws.as} setAs={ws.setAs} teams={ws.teams} hi={hi} />
          {can("setup") && <Link href={`/poster/jewellery/settings${q}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Settings2 className="h-4 w-4" /> {T("Settings", "Settings")}</Link>}
        </div>
      </div>

      {/* Today's rate: the first thing every morning. */}
      <section className={`rounded-2xl border p-4 shadow-card ${stale ? "border-amber-400 bg-amber-50/60" : "border-[#c9a227]/40 bg-gradient-to-br from-[#fffaf0] to-surface"}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-bold"><TrendingUp className="h-4 w-4 text-[#b8860b]" /> {T("Today's rate", "आज का रेट")} <span className="font-normal text-muted">· {T("per 10 g", "प्रति 10 ग्राम")}</span></p>
          {can("rate") && <Link href={`/poster/jewellery/rate${q}`} className="rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white">{stale ? T("Set today's rate", "आज का रेट डालें") : T("Change", "बदलें")}</Link>}
        </div>
        {stale && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> {rate ? T(`Last set on ${rate.day} — set today's rate before billing.`, `आख़िरी रेट ${rate.day} का है — बिल से पहले आज का रेट डालें।`) : T("No rate yet — set it once and every bill uses it.", "अभी रेट नहीं है — एक बार डालें, हर बिल उसी से बनेगा।")}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((p) => {
            const v = sellRate(rate, setup, p.key);
            return <div key={p.key} className="rounded-xl bg-surface/80 px-3 py-2"><p className="text-[11px] text-muted">{p.label}</p><p className="text-base font-bold tabular-nums">{v ? inr(v * 10) : "—"}</p></div>;
          })}
        </div>
      </section>

      {/* The two things the counter does all day. */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/poster/jewellery/bill${q}`} className="flex flex-col items-center gap-1 rounded-2xl grad-brand px-4 py-5 text-white shadow-card">
          <ReceiptText className="h-6 w-6" /><span className="text-base font-bold">{T("New bill", "नया बिल")}</span><span className="text-[11px] opacity-90">{T("Sale with GST", "GST के साथ बिक्री")}</span>
        </Link>
        <Link href={`/poster/jewellery/bill${q ? `${q}&` : "?"}kind=estimate`} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-brand/40 bg-surface px-4 py-5 shadow-card">
          <FileText className="h-6 w-6 text-brand" /><span className="text-base font-bold">{T("Estimate", "Estimate")}</span><span className="text-[11px] text-muted">{T("Price for the customer", "ग्राहक के लिए दाम")}</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{T("Today's sale", "आज की बिक्री")}</p><p className="text-lg font-bold tabular-nums">{inr(stats.todayPaise)}</p><p className="text-[11px] text-muted">{stats.todaySales} {T("bills", "बिल")} · {stats.todayEstimates} {T("estimates", "estimate")}</p></div>
        {can("reports") && (
          <Link href={`/poster/jewellery/bills${q ? `${q}&` : "?"}view=due`} className="rounded-2xl border border-border bg-surface p-3"><p className="flex items-center gap-1 text-[11px] text-muted"><IndianRupee className="h-3 w-3" /> {T("Money due (udhaar)", "बाकी पैसे (उधार)")}</p><p className="text-lg font-bold tabular-nums text-danger">{inr(stats.duePaise)}</p><p className="text-[11px] text-muted">{stats.dueCount} {T("customers", "ग्राहक")} →</p></Link>
        )}
        <Link href={`/poster/jewellery/bills${q}`} className="col-span-2 flex items-center justify-between rounded-2xl border border-border bg-surface p-3 sm:col-span-1"><span><p className="text-[11px] text-muted">{T("All bills", "सारे बिल")}</p><p className="text-sm font-bold">{T("Search, print, send", "खोजें, print, भेजें")}</p></span><ChevronRight className="h-4 w-4 text-muted" /></Link>
      </div>

      {(can("orders") || can("karigar")) && (
        <div className="grid grid-cols-2 gap-3">
          {can("orders") && (
            <Link href={`/poster/jewellery/orders${q}`} className="rounded-2xl border border-border bg-surface p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted"><Gem className="h-3 w-3" /> {T("Orders & repairs", "ऑर्डर और रिपेयर")}</p>
              <p className="text-lg font-bold tabular-nums">{stats.ordersOpen ?? 0} <span className="text-xs font-normal text-muted">{T("in the shop", "दुकान में")}</span></p>
              <p className="text-[11px]">{stats.ordersReady ? <span className="font-semibold text-good">{stats.ordersReady} {T("ready", "तैयार")} </span> : null}{stats.ordersLate ? <span className="font-semibold text-danger">· {stats.ordersLate} {T("late", "देर")}</span> : null}{!stats.ordersReady && !stats.ordersLate ? <span className="text-muted">{T("Book, track, deliver →", "बुक करें, देखें, दें →")}</span> : null}</p>
            </Link>
          )}
          {can("karigar") && (
            <Link href={`/poster/jewellery/karigars${q}`} className="rounded-2xl border border-border bg-surface p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted"><Hammer className="h-3 w-3" /> {T("Karigars", "कारीगर")}</p>
              <p className="text-sm font-bold">{T("Gold given & received", "सोना दिया-लिया")}</p>
              <p className="text-[11px] text-muted">{T("Fine-gold ledger →", "fine सोने का खाता →")}</p>
            </Link>
          )}
        </div>
      )}

      {can("stock") && (
        <Link href={`/poster/jewellery/stock${q}`} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3">
          <span><p className="flex items-center gap-1 text-[11px] text-muted"><Tags className="h-3 w-3" /> {T("Stock", "स्टॉक")}</p><p className="text-sm font-bold">{T("Tags, barcode labels, HUID", "टैग, बारकोड लेबल, HUID")}</p></span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">{T("Latest", "हाल के")}</h2>
        {d.recent.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("No bills yet. Make the first one with “New bill”.", "अभी कोई बिल नहीं। “नया बिल” से पहला बनाइए।")}</p>}
        {d.recent.map((b) => <BillRowLink key={b.id} b={b} hi={hi} q={q} />)}
      </section>

      <Link href="/help/jewellery" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" /> {T("How it works — the full guide", "कैसे चलता है — पूरी जानकारी")}</Link>
    </div>
  );
}
