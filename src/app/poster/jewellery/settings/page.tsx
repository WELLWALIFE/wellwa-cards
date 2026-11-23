"use client";
// Jewellery settings: the shop on the bill (name, address, GSTIN, BIS, bank, terms), GST and numbering, the purities it sells, the
// item types with their making and wastage, the counter's discount limit and PAN limit, and each staff login's rights.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { JW_RIGHTS, METALS, paiseOf, type JwRight, type JwSetup, type MakingKind, type Metal } from "@/lib/jewellery";
import type { JwAccess } from "@/lib/jewellery-types";

type Ans = { setup: JwSetup; access: JwAccess; staff: { id: string; name: string; phone: string; role: string }[]; error?: string };

export default function JewellerySettings() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [s, setS] = useState<JwSetup | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/setup${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setMsg({ ok: false, t: r.data?.error || "Could not load." }); return; }
    setD(r.data); setS(r.data.setup);
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function save() {
    if (!s) return;
    setBusy(true); setMsg(null);
    const r = await api<{ ok?: boolean; error?: string; setup?: JwSetup }>("/api/jewellery/setup", { method: "PUT", json: { as: ws.as || undefined, setup: s } });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    if (r.data.setup) setS(r.data.setup);
    setMsg({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
  }

  if (!d || !s) return <div className="grid place-items-center py-24">{msg ? <p className="text-danger">{msg.t}</p> : <LoaderCircle className="h-6 w-6 animate-spin text-muted" />}</div>;
  const q = ws.q ? `?${ws.q}` : "";
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const box = "space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card";
  const set = (p: Partial<JwSetup>) => setS({ ...s, ...p });

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <h1 className="text-lg font-bold">{T("Jewellery settings", "ज्वेलरी settings")}</h1>

      <section className={box}>
        <h2 className="text-sm font-bold">{T("Your shop on the bill", "बिल पर आपकी दुकान")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2"><span className={lab}>{T("Shop name (empty = your business name)", "दुकान का नाम (खाली = आपका business नाम)")}</span><input className={inp} value={s.shopName} onChange={(e) => set({ shopName: e.target.value })} /></label>
          <label className="col-span-2"><span className={lab}>{T("Address", "पता")}</span><textarea className={inp} rows={2} value={s.address} onChange={(e) => set({ address: e.target.value })} /></label>
          <label><span className={lab}>{T("Phone", "फ़ोन")}</span><input className={inp} value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
          <label><span className={lab}>GSTIN</span><input className={inp} maxLength={15} value={s.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase(), stateCode: /^\d{2}/.test(e.target.value) ? e.target.value.slice(0, 2) : s.stateCode })} /></label>
          <label><span className={lab}>{T("GST state code", "GST state code")}</span><input className={inp} maxLength={2} inputMode="numeric" value={s.stateCode} onChange={(e) => set({ stateCode: e.target.value.replace(/\D/g, "") })} placeholder="06" /></label>
          <label><span className={lab}>{T("BIS / hallmark licence", "BIS / hallmark licence")}</span><input className={inp} value={s.bis} onChange={(e) => set({ bis: e.target.value })} /></label>
          <label className="col-span-2"><span className={lab}>{T("Bank / UPI (printed on the bill)", "Bank / UPI (बिल पर छपेगा)")}</span><textarea className={inp} rows={2} value={s.bank} onChange={(e) => set({ bank: e.target.value })} /></label>
          <label className="col-span-2"><span className={lab}>{T("Terms (printed on the bill)", "शर्तें (बिल पर छपेंगी)")}</span><textarea className={inp} rows={2} value={s.terms} onChange={(e) => set({ terms: e.target.value })} /></label>
        </div>
      </section>

      <section className={box}>
        <h2 className="text-sm font-bold">{T("GST, numbers and limits", "GST, नंबर और limit")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lab}>{T("GST on metal and stones %", "धातु और नग पर GST %")}</span><input className={inp} inputMode="decimal" value={s.gstBp / 100} onChange={(e) => set({ gstBp: Math.round(Number(e.target.value) * 100) || 0 })} /></label>
          <label><span className={lab}>{T("GST on making %", "मेकिंग पर GST %")}</span><input className={inp} inputMode="decimal" value={s.gstMakingBp / 100} onChange={(e) => set({ gstMakingBp: Math.round(Number(e.target.value) * 100) || 0 })} /></label>
          <label><span className={lab}>{T("Bill number prefix", "बिल नंबर prefix")}</span><input className={inp} value={s.billPrefix} onChange={(e) => set({ billPrefix: e.target.value })} /></label>
          <label><span className={lab}>{T("Estimate prefix", "Estimate prefix")}</span><input className={inp} value={s.estimatePrefix} onChange={(e) => set({ estimatePrefix: e.target.value })} /></label>
          <label><span className={lab}>{T("Round the bill to", "बिल round करें")}</span><select className={inp} value={s.roundTo} onChange={(e) => set({ roundTo: e.target.value === "10" ? 10 : 1 })}><option value={1}>₹1</option><option value={10}>₹10</option></select></label>
          <label><span className={lab}>{T("Old gold: % below 24K rate", "पुराना सोना: 24K रेट से % कम")}</span><input className={inp} inputMode="decimal" value={s.oldGoldDeductBp / 100} onChange={(e) => set({ oldGoldDeductBp: Math.round(Number(e.target.value) * 100) || 0 })} /></label>
          <label><span className={lab}>{T("Counter may give discount up to % of making", "Counter मेकिंग का कितना % छूट दे सकता")}</span><input className={inp} inputMode="decimal" value={s.counterDiscountBp / 100} onChange={(e) => set({ counterDiscountBp: Math.round(Number(e.target.value) * 100) || 0 })} /></label>
          <label><span className={lab}>{T("Ask PAN on bills from ₹", "इतने ₹ से ऊपर PAN माँगें")}</span><input className={inp} inputMode="decimal" value={s.panAbovePaise / 100} onChange={(e) => set({ panAbovePaise: paiseOf(e.target.value) })} /></label>
        </div>
        <p className="text-[11px] text-muted">{T("Confirm the GST on making with your CA. A finished-jewellery sale is usually one supply at 3%.", "मेकिंग पर GST अपने CA से confirm करें। तैयार ज्वेलरी की बिक्री आमतौर पर पूरी 3% पर होती है।")}</p>
      </section>

      <section className={box}>
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{T("Purities you sell", "आप कौन-सी purity बेचते हैं")}</h2>
          <button type="button" onClick={() => set({ purities: [...s.purities, { key: `c${Date.now().toString(36)}`, metal: "gold", label: "22K KDM", fine: 916, on: true }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" /> {T("Add", "जोड़ें")}</button></div>
        {s.purities.map((p, i) => (
          <div key={p.key} className="grid grid-cols-[auto_1fr_6rem_5rem_auto] items-center gap-1.5">
            <input type="checkbox" checked={p.on} onChange={(e) => set({ purities: s.purities.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)) })} className="h-4 w-4" aria-label="On" />
            <input className={inp} value={p.label} onChange={(e) => set({ purities: s.purities.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
            <select className={inp} value={p.metal} onChange={(e) => set({ purities: s.purities.map((x, k) => (k === i ? { ...x, metal: e.target.value as Metal } : x)) })}>{METALS.map((m) => <option key={m.key} value={m.key}>{hi ? m.hi : m.en}</option>)}</select>
            <input className={inp} inputMode="numeric" title={T("Fineness per 1000", "1000 में शुद्धता")} value={p.fine} onChange={(e) => set({ purities: s.purities.map((x, k) => (k === i ? { ...x, fine: Number(e.target.value) || 0 } : x)) })} />
            <button type="button" onClick={() => set({ purities: s.purities.filter((_, k) => k !== i) })} className="text-danger"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </section>

      <section className={box}>
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{T("Item types, making and wastage", "Item, मेकिंग और वेस्टेज")}</h2>
          <button type="button" onClick={() => set({ items: [...s.items, { key: `i${Date.now().toString(36)}`, en: "New item", hi: "नया item", making: "per_g", makingValue: 40000, wastageBp: 0, hsn: "7113" }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" /> {T("Add", "जोड़ें")}</button></div>
        <p className="text-[11px] text-muted">{T("Filled in on each bill when the item is picked; the counter can still change it.", "बिल में item चुनते ही भर जाता है; counter बदल सकता है।")}</p>
        {s.items.map((it, i) => (
          <div key={it.key} className="grid grid-cols-2 gap-1.5 rounded-xl bg-surface2/50 p-2 sm:grid-cols-[1fr_1fr_5rem_6rem_5rem_4.5rem_auto]">
            <input className={inp} value={it.en} onChange={(e) => set({ items: s.items.map((x, k) => (k === i ? { ...x, en: e.target.value } : x)) })} />
            <input className={inp} value={it.hi} onChange={(e) => set({ items: s.items.map((x, k) => (k === i ? { ...x, hi: e.target.value } : x)) })} />
            <select className={inp} value={it.making} onChange={(e) => set({ items: s.items.map((x, k) => (k === i ? { ...x, making: e.target.value as MakingKind } : x)) })}><option value="per_g">₹/g</option><option value="pct">%</option><option value="piece">₹/pc</option></select>
            <input className={inp} inputMode="decimal" title={T("Making", "मेकिंग")} value={it.makingValue / 100} onChange={(e) => set({ items: s.items.map((x, k) => (k === i ? { ...x, makingValue: Math.round(Number(e.target.value) * 100) || 0 } : x)) })} />
            <input className={inp} inputMode="decimal" title="VA %" placeholder="VA %" value={it.wastageBp / 100} onChange={(e) => set({ items: s.items.map((x, k) => (k === i ? { ...x, wastageBp: Math.round(Number(e.target.value) * 100) || 0 } : x)) })} />
            <input className={inp} title="HSN" value={it.hsn} onChange={(e) => set({ items: s.items.map((x, k) => (k === i ? { ...x, hsn: e.target.value } : x)) })} />
            <button type="button" onClick={() => set({ items: s.items.filter((_, k) => k !== i) })} className="text-danger"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </section>

      {d.access.owner && (
        <section className={box}>
          <h2 className="text-sm font-bold">{T("Staff rights", "Staff के अधिकार")}</h2>
          {d.staff.length === 0 && <p className="text-xs text-muted">{T("No staff logins yet — add them in Customers → Settings → Team (the same team as Orders).", "अभी कोई staff login नहीं — Customers → Settings → Team में जोड़ें।")}</p>}
          {d.staff.map((m) => {
            const st = s.staff[m.id] ?? { title: m.role === "manager" ? "Manager" : "Counter", rights: (m.role === "manager" ? JW_RIGHTS.map((r) => r.key) : ["bill"]) as JwRight[] };
            const toggle = (r: JwRight) => set({ staff: { ...s.staff, [m.id]: { ...st, rights: st.rights.includes(r) ? st.rights.filter((x) => x !== r) : [...st.rights, r] } } });
            return (
              <div key={m.id} className="rounded-xl bg-surface2/50 p-2">
                <p className="text-sm font-semibold">{m.name || m.phone} <span className="font-normal text-muted">· {st.title}</span></p>
                <div className="mt-1 flex flex-wrap gap-1.5">{JW_RIGHTS.map((r) => <button key={r.key} type="button" onClick={() => toggle(r.key)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${st.rights.includes(r.key) ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>{hi ? r.hi : r.en}</button>)}</div>
              </div>
            );
          })}
        </section>
      )}

      <div className="sticky bottom-0 z-40 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {msg && <p className={`flex-1 text-sm font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t}</p>}
          <button type="button" disabled={busy} onClick={() => void save()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Save settings", "Settings save करें")}</button>
        </div>
      </div>
    </div>
  );
}
