"use client";
// Karigars: each with the fine gold (and silver) they hold of the shop's, the money the shop owes them, and the orders with them.
// Add a karigar here; open one for the ledger.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { grams, inr } from "@/lib/jewellery";
import type { Karigar, KarigarBalance } from "@/lib/jewellery-orders";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { karigars: Karigar[]; balances: Record<string, KarigarBalance>; open: Record<string, number>; error?: string };

export default function KarigarsPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [add, setAdd] = useState({ name: "", phone: "", skill: "" });
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/karigars${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function save() {
    setBusy(true);
    const r = await api<{ id?: string; error?: string }>("/api/jewellery/karigars", { method: "POST", json: { as: ws.as || undefined, ...add } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || "Could not save."); return; }
    setAdd({ name: "", phone: "", skill: "" }); void load();
  }

  const q = ws.q ? `?${ws.q}` : "";
  if (err && !d) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-brand";
  const shown = d.karigars.filter((k) => k.active || showOld);
  const totalGold = Object.values(d.balances).reduce((a, b) => a + b.fine.gold, 0);
  const totalMoney = Object.values(d.balances).reduce((a, b) => a + b.money, 0);
  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery/orders${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Orders & repairs", "ऑर्डर और रिपेयर")}</Link>
      <h1 className="text-lg font-bold">👷 {T("Karigars", "कारीगर")}</h1>
      <PageHelp k="karigars" />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[#c9a227]/40 bg-[#fffaf0] p-3"><p className="text-[11px] text-muted">{T("Gold with karigars (fine)", "कारीगरों के पास सोना (fine)")}</p><p className="text-lg font-bold tabular-nums">{grams(totalGold)}</p></div>
        <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{T("Labour to pay", "मज़दूरी देनी है")}</p><p className="text-lg font-bold tabular-nums">{inr(totalMoney)}</p></div>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("No karigars yet — add the first one below.", "अभी कोई कारीगर नहीं — नीचे पहला जोड़ें।")}</p>}
        {shown.map((k) => {
          const b = d.balances[k.id];
          return (
            <Link key={k.id} href={`/poster/jewellery/karigars/${k.id}${q}`} className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 ${k.active ? "" : "opacity-60"}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2 font-bold">{k.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><b className="block truncate text-sm">{k.name}</b><span className="block truncate text-[11px] text-muted">{[k.skill, k.phone, d.open[k.id] ? T(`${d.open[k.id]} orders with them`, `${d.open[k.id]} ऑर्डर उनके पास`) : ""].filter(Boolean).join(" · ")}</span></span>
              <span className="text-right text-xs tabular-nums">
                <b className="block">{b ? grams(b.fine.gold) : "0.000 g"} {T("gold", "सोना")}</b>
                {b && b.fine.silver !== 0 && <span className="block">{grams(b.fine.silver)} {T("silver", "चाँदी")}</span>}
                {b && b.money !== 0 && <span className={`block ${b.money > 0 ? "text-danger" : "text-good"}`}>{b.money > 0 ? T("to pay ", "देना ") : T("advance ", "एडवांस ")}{inr(Math.abs(b.money))}</span>}
              </span>
            </Link>
          );
        })}
        {d.karigars.some((k) => !k.active) && <button type="button" onClick={() => setShowOld(!showOld)} className="text-xs font-semibold text-muted">{showOld ? T("Hide old karigars", "पुराने कारीगर छिपाएँ") : T("Show old karigars", "पुराने कारीगर दिखाएँ")}</button>}
      </div>
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <h2 className="text-sm font-bold">{T("Add a karigar", "कारीगर जोड़ें")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input className={inp} placeholder={T("Name", "नाम")} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <input className={inp} placeholder={T("Mobile", "मोबाइल")} inputMode="tel" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} />
          <input className={`${inp} col-span-2 sm:col-span-1`} placeholder={T("Work, e.g. Bengali, casting", "काम, जैसे बंगाली, कास्टिंग")} value={add.skill} onChange={(e) => setAdd({ ...add, skill: e.target.value })} />
        </div>
        {err && <p className="text-sm font-semibold text-danger">{err}</p>}
        <button type="button" disabled={busy || !add.name.trim()} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {T("Add", "जोड़ें")}</button>
      </section>
    </div>
  );
}
