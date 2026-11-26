"use client";
// Mobile shop settings: what prints on the bill, GST, paper size, the counter's discount limit, and each staff login's rights.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { inr, paiseOf } from "@/lib/jewellery";
import { MS_RIGHTS, itemMatches, itemTitle, validUpi, type ItemRow, type MsRight, type MsSetup, type MsStaff } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { MsHelp } from "@/components/mobile/page-help";

type Ans = { setup: MsSetup; access: MsAccess; staff: { id: string; name: string; phone: string; role: string }[]; error?: string };

export default function MobileSettings() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [d, setD] = useState<Ans | null>(null);
  const [s, setS] = useState<MsSetup | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [cq, setCq] = useState<{ at: number; q: string }>({ at: -1, q: "" });
  const found = useMemo(() => (cq.q.trim() ? items.filter((i) => i.active && itemMatches(i, cq.q)).slice(0, 8) : []), [items, cq.q]);

  const load = useCallback(async () => {
    try {
      const r = await api<Ans>(`/api/mobile/setup${asQ}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setD(r.data); setS(r.data.setup);
      void api<{ items?: ItemRow[] }>(`/api/mobile/items${asQ}`, { fresh: true }).then((x) => setItems(x.ok ? x.data.items ?? [] : [])).catch(() => undefined);
    } catch { setErr("No internet."); }
  }, [asQ]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function save() {
    if (!s) return;
    setBusy(true); setNote(null);
    try {
      const r = await api<{ setup?: MsSetup; error?: string }>("/api/mobile/setup", { method: "PUT", json: { as: ws.as || undefined, setup: s } });
      setBusy(false);
      if (!r.ok || !r.data.setup) { setNote({ ok: false, t: r.data?.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
      setS(r.data.setup); setNote({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
    } catch { setBusy(false); setNote({ ok: false, t: T("No internet.", "इंटरनेट नहीं है।") }); }
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d || !s) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const canSave = d.access.owner || d.access.rights.includes("setup");
  const set = (p: Partial<MsSetup>) => setS({ ...s, ...p });
  const inp = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm";
  const lab = "block text-[12px] font-semibold text-muted";
  const card = "space-y-3 rounded-2xl border border-border bg-surface p-3";
  const tip = (en: string, h: string) => <FieldTip lang={lang} en={en} hi={h} />;
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">Settings</h1>
      <MsHelp k="settings" />

      <section className={card}>
        <h2 className="text-sm font-bold">{T("On the bill", "बिल पर")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lab}>{T("Shop name", "दुकान का नाम")}{tip("Printed big at the top of every bill. Empty = the name on your Shubhora card.", "हर बिल के ऊपर बड़ा छपता है। खाली = आपके Shubhora card का नाम।")}<input className={inp} value={s.shopName} onChange={(e) => set({ shopName: e.target.value })} /></label>
          <label className={lab}>{T("Phone", "फ़ोन")}{tip("The shop's number, printed on bills and shown on the customer's repair link.", "दुकान का नंबर, बिल पर छपता है और ग्राहक के रिपेयर लिंक पर दिखता है।")}<input className={inp} value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
          <label className={`${lab} sm:col-span-2`}>{T("Address", "पता")}<textarea className={inp} rows={2} value={s.address} onChange={(e) => set({ address: e.target.value })} /></label>
          <label className={lab}>UPI ID <span className="font-normal">(optional)</span>{tip("Your shop's UPI ID, e.g. shopname@okaxis. A QR for the exact amount then shows at the counter (pick UPI), on bills with money due, and on the customer's bill link.", "दुकान की UPI ID, जैसे shopname@okaxis। तब सही रक़म का QR counter पर (UPI चुनें), बाकी वाले बिल पर, और ग्राहक के बिल लिंक पर दिखता है।")}<input className={inp} value={s.upi} onChange={(e) => set({ upi: e.target.value })} />{s.upi.trim() && !validUpi(s.upi) && <span className="mt-0.5 block text-[11px] text-danger">{T("This does not look like a UPI ID (name@bank).", "ये UPI ID जैसा नहीं लगता (name@bank)।")}</span>}</label>
          <label className={lab}>{T("Paper", "Paper")}{tip("58 mm or 80 mm = a thermal roll printer. A5 / A4 = a normal printer.", "58 mm या 80 mm = थर्मल roll printer। A5 / A4 = सामान्य printer।")}
            <select className={inp} value={s.paper} onChange={(e) => set({ paper: e.target.value as MsSetup["paper"] })}><option value="58">58 mm thermal</option><option value="80">80 mm thermal</option><option value="a5">A5</option><option value="a4">A4</option></select></label>
          <label className={`${lab} sm:col-span-2`}>{T("Terms (bottom of the bill)", "शर्तें (बिल के नीचे)")}{tip("Your rules in one or two lines — returns, warranty. Printed at the bottom of every bill.", "आपके नियम एक-दो line में — वापसी, वारंटी। हर बिल के नीचे छपते हैं।")}<textarea className={inp} rows={2} value={s.terms} onChange={(e) => set({ terms: e.target.value })} /></label>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">GST</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.gstOn} onChange={(e) => set({ gstOn: e.target.checked })} /><span>{T("My shop has a GST number — print tax invoices", "मेरी दुकान का GST नंबर है — tax invoice छापें")}{tip("Switch on only with a GSTIN. Your prices stay the same: the tax is shown from inside the price. Without GSTIN, a plain bill prints.", "तभी चालू करें जब GSTIN हो। दाम वही रहते हैं: tax दाम के अंदर से दिखाया जाता है। GSTIN न हो तो सादा बिल छपता है।")}</span></label>
        {s.gstOn && <label className={lab}>GSTIN (15)<input className={`${inp} font-mono uppercase`} maxLength={15} value={s.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></label>}
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">{T("Numbers and limits", "नंबर और limit")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={lab}>{T("Bill prefix", "बिल prefix")}{tip("Letters before the bill number, e.g. MB → MB/2026-27/1.", "बिल नंबर के पहले के अक्षर, जैसे MB → MB/2026-27/1।")}<input className={inp} value={s.billPrefix} onChange={(e) => set({ billPrefix: e.target.value })} /></label>
          <label className={lab}>{T("Estimate prefix", "Estimate prefix")}{tip("Letters before an estimate's number, e.g. ME → ME/2026-27/1.", "estimate नंबर के पहले के अक्षर, जैसे ME → ME/2026-27/1।")}<input className={inp} value={s.estimatePrefix} onChange={(e) => set({ estimatePrefix: e.target.value })} /></label>
          <label className={lab}>{T("Staff discount limit %", "Staff की छूट limit %")}{tip("The most discount a staff login can give on a bill by itself. More needs the owner (or the 'discount' right).", "Staff login खुद से बिल पर ज़्यादा-से-ज़्यादा इतनी छूट दे सकता है। इससे ज़्यादा के लिए मालिक (या 'छूट' का हक़) चाहिए।")}<input className={inp} inputMode="decimal" value={s.counterDiscountBp / 100} onChange={(e) => set({ counterDiscountBp: Math.max(0, Math.min(100, Number(e.target.value) || 0)) * 100 })} /></label>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">🔧 {T("Repair", "रिपेयर")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={lab}>{T("Job prefix", "Job prefix")}{tip("Letters before the job number, e.g. MJ → MJ/2026-27/1.", "job नंबर के पहले के अक्षर, जैसे MJ → MJ/2026-27/1।")}<input className={inp} value={s.jobPrefix} onChange={(e) => set({ jobPrefix: e.target.value })} /></label>
          <label className={lab}>{T("Repair warranty (days)", "रिपेयर वारंटी (दिन)")}{tip("Printed on the repair bill. 0 = no warranty line.", "रिपेयर के बिल पर छपती है। 0 = वारंटी की line नहीं।")}<input className={inp} inputMode="numeric" value={s.repairWarrantyDays} onChange={(e) => set({ repairWarrantyDays: Math.max(0, Math.min(730, Math.round(Number(e.target.value) || 0))) })} /></label>
          <label className={`${lab} sm:col-span-3`}>{T("Terms on the job slip", "job पर्ची की शर्तें")}{tip("Printed on the slip the customer takes, and shown on their tracking link.", "ग्राहक की पर्ची पर छपती हैं, और उसके tracking लिंक पर दिखती हैं।")}<textarea className={inp} rows={3} value={s.repairTerms} onChange={(e) => set({ repairTerms: e.target.value })} /></label>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">💬 {T("Udhaar reminders", "उधार की याद-दिलाई")}</h2>
        <label className={lab}>{T("Remind by itself on WhatsApp", "WhatsApp पर अपने-आप याद दिलाएँ")}{tip("Every day at 11 am, customers with udhaar get one polite message with all their bills and a UPI QR link — at most once in this many days. It goes from your linked WhatsApp only. You can always remind by hand from Bills → Udhaar.", "हर दिन 11 बजे, जिन पर उधार है उन्हें एक विनम्र message जाता है जिसमें उनके सारे बिल और UPI QR का लिंक होता है — इतने दिन में ज़्यादा-से-ज़्यादा एक बार। ये सिर्फ़ आपके जुड़े WhatsApp से जाता है। हाथ से कभी भी बिल → उधार से याद दिला सकते हैं।")}
          <select className={inp} value={s.remindDays} onChange={(e) => set({ remindDays: Number(e.target.value) })}><option value={0}>{T("Off — I remind by hand", "बंद — मैं हाथ से याद दिलाऊँगा")}</option>{[3, 5, 7, 10, 15, 30].map((n) => <option key={n} value={n}>{T(`Every ${n} days`, `हर ${n} दिन में`)}</option>)}</select></label>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">⭐ {T("Loyalty points", "Loyalty points")}</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.points.on} onChange={(e) => set({ points: { ...s.points, on: e.target.checked } })} /><span>{T("Customers earn points on every bill", "ग्राहक हर बिल पर points कमाएँ")}{tip("Points come back the customer to your shop. They are earned on the bill total and used like money on the next bill (type the mobile on the bill to see them).", "Points से ग्राहक आपकी दुकान पर लौटता है। बिल के कुल पर मिलते हैं और अगले बिल पर पैसे की तरह लगते हैं (बिल पर मोबाइल लिखें तो दिखते हैं)।")}</span></label>
        {s.points.on && <div className="grid gap-3 sm:grid-cols-3">
          <label className={lab}>{T("Points for every ₹100", "हर ₹100 पर points")}<input className={inp} inputMode="numeric" value={s.points.per100} onChange={(e) => set({ points: { ...s.points, per100: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))) } })} /></label>
          <label className={lab}>{T("1 point is worth ₹", "1 point की क़ीमत ₹")}<input className={inp} inputMode="decimal" value={s.points.worth / 100} onChange={(e) => set({ points: { ...s.points, worth: Math.max(1, Math.min(10000, paiseOf(e.target.value) || 1)) } })} /></label>
          <label className={lab}>{T("Usable from (points)", "कितने points से लगें")}<input className={inp} inputMode="numeric" value={s.points.min} onChange={(e) => set({ points: { ...s.points, min: Math.max(0, Math.round(Number(e.target.value) || 0)) } })} /></label>
          <p className="text-[12px] text-muted sm:col-span-3">{T(`A ₹1,000 bill earns ${s.points.per100 * 10} points = ${inr(s.points.per100 * 10 * s.points.worth)} off later (${((s.points.per100 * s.points.worth) / 100).toFixed(1)}% back).`, `₹1,000 के बिल पर ${s.points.per100 * 10} points = बाद में ${inr(s.points.per100 * 10 * s.points.worth)} की छूट (${((s.points.per100 * s.points.worth) / 100).toFixed(1)}% वापस)।`)}</p>
        </div>}
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">🎁 {T("Combo offers", "Combo offer")}{tip("Items sold together at a lower price — like a phone + cover + glass. When all of a combo's items are on a bill, its discount comes off by itself.", "साथ में कम दाम पर बिकने वाले items — जैसे फ़ोन + कवर + ग्लास। जब combo के सारे items बिल पर हों, उसकी छूट अपने-आप लग जाती है।")}</h2>
        {s.combos.map((c, n) => (
          <div key={c.id} className="space-y-2 rounded-xl border border-border p-2.5">
            <div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={c.name} onChange={(e) => set({ combos: s.combos.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)) })} placeholder={T("Name, e.g. Cover + glass", "नाम, जैसे कवर + ग्लास")} />
              <label className="flex items-center gap-1 text-[12px] text-muted">{T("Off ₹", "छूट ₹")}<input className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" inputMode="decimal" value={c.off ? c.off / 100 : ""} onChange={(e) => set({ combos: s.combos.map((x, i) => (i === n ? { ...x, off: paiseOf(e.target.value) } : x)) })} /></label>
              <button type="button" aria-label="Remove" onClick={() => set({ combos: s.combos.filter((_, i) => i !== n) })} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button></div>
            <div className="flex flex-wrap gap-1.5">{c.items.map((id) => { const it = items.find((x) => x.id === id); return <span key={id} className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-1 text-[12px]">{it ? itemTitle(it) : "…"}<button type="button" aria-label="Remove" onClick={() => set({ combos: s.combos.map((x, i) => (i === n ? { ...x, items: x.items.filter((y) => y !== id) } : x)) })}><X className="h-3 w-3" /></button></span>; })}</div>
            {c.items.length < 6 && <div className="relative"><input className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={cq.at === n ? cq.q : ""} onChange={(e) => setCq({ at: n, q: e.target.value })} placeholder={T("+ Add an item to this combo", "+ इस combo में item जोड़ें")} />
              {cq.at === n && found.length > 0 && <div className="mt-1 space-y-0.5 rounded-lg border border-border bg-surface p-1">{found.map((i) => <button key={i.id} type="button" onClick={() => { set({ combos: s.combos.map((x, k) => (k === n && !x.items.includes(i.id) ? { ...x, items: [...x.items, i.id] } : x)) }); setCq({ at: -1, q: "" }); }} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-bg">{itemTitle(i)}</button>)}</div>}</div>}
            {(c.items.length < 2 || !c.off) && <p className="text-[11px] text-amber-700">{T("A combo needs at least 2 items and a discount — otherwise it is not saved.", "combo में कम-से-कम 2 items और छूट चाहिए — वरना save नहीं होगा।")}</p>}
          </div>
        ))}
        {s.combos.length < 30 && <button type="button" onClick={() => set({ combos: [...s.combos, { id: `c${Date.now().toString(36)}`, name: "", items: [], off: 0 }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" /> {T("Add a combo", "combo जोड़ें")}</button>}
      </section>

      {d.access.owner && (
        <section className={card}>
          <h2 className="text-sm font-bold">🏪 {T("Branches", "ब्रांच")}{tip("Have more than one shop? Add each branch. Bills, stock, repairs and expenses then keep which shop they belong to; move stock with Stock transfer; reports can show one branch. Give each staff login its branch below.", "एक से ज़्यादा दुकान है? हर ब्रांच जोड़ें। फिर बिल, स्टॉक, रिपेयर और ख़र्चे याद रखते हैं कि किस दुकान के हैं; स्टॉक ट्रांसफ़र से माल भेजें; रिपोर्ट एक ब्रांच की भी दिखती है। नीचे हर staff login को उसकी ब्रांच दें।")}</h2>
          <p className="text-[12px] text-muted">{T("Main shop", "मेन दुकान")}: <b>{s.shopName || T("(shop name above)", "(ऊपर का दुकान का नाम)")}</b></p>
          {s.stores.map((st, n) => (
            <div key={st.id} className="grid gap-2 rounded-xl border border-border p-2.5 sm:grid-cols-3">
              <input className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={st.name} onChange={(e) => set({ stores: s.stores.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)) })} placeholder={T("Branch name", "ब्रांच का नाम")} />
              <input className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={st.phone} onChange={(e) => set({ stores: s.stores.map((x, i) => (i === n ? { ...x, phone: e.target.value } : x)) })} placeholder={T("Phone", "फ़ोन")} />
              <span className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={st.address} onChange={(e) => set({ stores: s.stores.map((x, i) => (i === n ? { ...x, address: e.target.value } : x)) })} placeholder={T("Address", "पता")} />
                <button type="button" aria-label="Remove" onClick={() => set({ stores: s.stores.filter((_, i) => i !== n) })} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button></span>
            </div>
          ))}
          {s.stores.length > 0 && <p className="text-[11px] text-amber-700">{T("Before removing a branch, move its stock back to the main shop (Stock transfer).", "ब्रांच हटाने से पहले उसका स्टॉक मेन दुकान पर वापस भेजें (स्टॉक ट्रांसफ़र)।")}</p>}
          {s.stores.length < 20 && <button type="button" onClick={() => set({ stores: [...s.stores, { id: `b${Date.now().toString(36)}`, name: "", address: "", phone: "" }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" /> {T("Add a branch", "ब्रांच जोड़ें")}</button>}
        </section>
      )}

      {d.access.owner && (
        <section className={card}>
          <h2 className="text-sm font-bold">{T("Staff rights", "Staff के हक़")}{tip("Tick what each staff login may do here. The owner can always do everything.", "हर staff login यहाँ क्या कर सकता है, tick करें। मालिक हमेशा सब कर सकता है।")}</h2>
          {d.staff.length === 0 && <p className="text-xs text-muted">{T("No staff logins yet — add them in Customers → Settings → Team.", "अभी कोई staff login नहीं — Customers → Settings → Team में जोड़ें।")}</p>}
          {d.staff.map((m) => {
            const st: MsStaff = s.staff[m.id] ?? { title: m.role === "manager" ? "Manager" : "Counter", rights: (m.role === "manager" ? MS_RIGHTS.map((r) => r.key) : ["bill"]) as MsRight[], store: "", commissionBp: 0, repairBp: 0, target: 0 };
            const put = (p: Partial<MsStaff>) => set({ staff: { ...s.staff, [m.id]: { ...st, ...p } } });
            const toggle = (r: MsRight) => set({ staff: { ...s.staff, [m.id]: { ...st, rights: st.rights.includes(r) ? st.rights.filter((x) => x !== r) : [...st.rights, r] } } });
            return (
              <div key={m.id} className="rounded-xl border border-border p-2.5">
                <p className="text-sm font-semibold">{m.name} <span className="font-normal text-muted">· {m.phone}</span></p>
                <div className="mt-1.5 grid gap-1 sm:grid-cols-2">{MS_RIGHTS.map((r) => <label key={r.key} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={st.rights.includes(r.key)} onChange={() => toggle(r.key)} /> {hi ? r.hi : r.en}</label>)}</div>
                <div className="mt-2 grid gap-2 border-t border-border pt-2 sm:grid-cols-4">
                  {s.stores.length > 0 && <label className="text-[11px] font-semibold text-muted">{T("Works at", "कहाँ काम करता है")}<select className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={st.store} onChange={(e) => put({ store: e.target.value })}><option value="">{T("Main shop / any", "मेन दुकान / कहीं भी")}</option>{s.stores.map((b) => <option key={b.id} value={b.id}>{b.name || "…"}</option>)}</select></label>}
                  <label className="text-[11px] font-semibold text-muted">{T("Commission on sale %", "बिक्री पर commission %")}{tip("Worked out on the bills this login makes (after returns). See it in Reports → Staff.", "इस login के बनाए बिलों पर (वापसी घटाकर)। रिपोर्ट → Staff में दिखता है।")}<input className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" inputMode="decimal" value={st.commissionBp ? st.commissionBp / 100 : ""} onChange={(e) => put({ commissionBp: Math.max(0, Math.min(50, Number(e.target.value) || 0)) * 100 })} placeholder="0" /></label>
                  <label className="text-[11px] font-semibold text-muted">{T("On repair charge %", "रिपेयर charge पर %")}{tip("For a technician: on the repair charge of jobs given back where this person is the technician.", "Technician के लिए: जिन jobs में ये technician है, उनके दिए जाने पर repair charge पर।")}<input className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" inputMode="decimal" value={st.repairBp ? st.repairBp / 100 : ""} onChange={(e) => put({ repairBp: Math.max(0, Math.min(100, Number(e.target.value) || 0)) * 100 })} placeholder="0" /></label>
                  <label className="text-[11px] font-semibold text-muted">{T("Monthly sale target ₹", "महीने का बिक्री target ₹")}<input className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" inputMode="numeric" value={st.target ? st.target / 100 : ""} onChange={(e) => put({ target: paiseOf(e.target.value) })} placeholder="0" /></label>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {note && <p className={`text-sm font-semibold ${note.ok ? "text-good" : "text-danger"}`}>{note.t}</p>}
      {canSave && <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Save</button>}
    </div>
  );
}
