"use client";
// Orders and repairs: In the shop (booked / with karigar / ready) · Late · Ready · Delivered; search; the two "new" buttons.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Hammer, LoaderCircle, Plus, Search, Wrench } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { OrderRowLink } from "@/components/jewellery/order-row";
import type { Karigar, OrderRow } from "@/lib/jewellery-orders";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { orders: OrderRow[]; karigars: Karigar[]; today: string; error?: string };

function OrdersList() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [tab, setTab] = useState<string>(sp.get("view") || "open");
  const [kind, setKind] = useState<string>("");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q);
    p.set("view", tab);
    if (kind) p.set("kind", kind);
    if (q.trim()) p.set("q", q.trim());
    const r = await api<Ans>(`/api/jewellery/orders?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [ws.q, tab, kind, q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  const names = useMemo(() => Object.fromEntries((d?.karigars ?? []).map((k) => [k.id, k.name])), [d]);

  const asQ = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  const tabs: [string, string][] = [["open", T("In the shop", "दुकान में")], ["late", T("Late", "देर")], ["ready", T("Ready", "तैयार")], ["delivered", T("Delivered", "दे दिए")]];
  return (
    <div className="space-y-3">
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <h1 className="text-lg font-bold">{T("Orders & repairs", "ऑर्डर और रिपेयर")}</h1>
      <PageHelp k="orders" />
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/poster/jewellery/order${asQ}`} className="flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {T("New order", "नया ऑर्डर")}</Link>
        <Link href={`/poster/jewellery/order${amp}kind=repair`} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-brand/40 bg-surface px-3 py-3 text-sm font-bold"><Wrench className="h-4 w-4 text-brand" /> {T("New repair", "नया रिपेयर")}</Link>
      </div>
      <div className="flex gap-1 rounded-xl border border-border bg-surface2/50 p-1">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${tab === k ? "bg-surface shadow-card" : "text-muted"} ${k === "late" && tab !== k ? "text-danger" : ""}`}>{l}</button>)}
      </div>
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile or number", "नाम, मोबाइल या नंबर")} className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl border border-border bg-surface px-2 text-sm"><option value="">{T("All", "सब")}</option><option value="order">{T("Orders", "ऑर्डर")}</option><option value="repair">{T("Repairs", "रिपेयर")}</option></select>
      </div>
      <Link href={`/poster/jewellery/karigars${asQ}`} className="flex items-center gap-2 text-xs font-semibold text-brand-ink"><Hammer className="h-3.5 w-3.5" /> {T("Karigars and their gold ledger →", "कारीगर और उनका सोने का हिसाब →")}</Link>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {!d ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : (
        <div className="space-y-2">
          {d.orders.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{tab === "late" ? T("Nothing late. 👍", "कुछ भी देर से नहीं। 👍") : T("Nothing here yet.", "अभी यहाँ कुछ नहीं।")}</p>}
          {d.orders.map((o) => <OrderRowLink key={o.id} o={o} hi={hi} q={asQ} today={d.today} karigar={o.karigar_id ? names[o.karigar_id] : undefined} />)}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><OrdersList /></Suspense>;
}
