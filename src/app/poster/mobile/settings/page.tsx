"use client";
// Mobile shop settings: what prints on the bill, GST, paper size, the counter's discount limit, and each staff login's rights.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { MS_RIGHTS, type MsRight, type MsSetup } from "@/lib/mobile";
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

  const load = useCallback(async () => {
    try {
      const r = await api<Ans>(`/api/mobile/setup${asQ}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setD(r.data); setS(r.data.setup);
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
          <label className={lab}>{T("Phone", "फ़ोन")}<input className={inp} value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
          <label className={`${lab} sm:col-span-2`}>{T("Address", "पता")}<textarea className={inp} rows={2} value={s.address} onChange={(e) => set({ address: e.target.value })} /></label>
          <label className={lab}>UPI ID <span className="font-normal">(optional)</span>{tip("Printed on the bill so the customer can pay you, e.g. shopname@okaxis.", "बिल पर छपती है ताकि ग्राहक पेमेंट कर सके, जैसे shopname@okaxis।")}<input className={inp} value={s.upi} onChange={(e) => set({ upi: e.target.value })} /></label>
          <label className={lab}>{T("Paper", "Paper")}{tip("58 mm or 80 mm = a thermal roll printer. A5 / A4 = a normal printer.", "58 mm या 80 mm = थर्मल roll printer। A5 / A4 = सामान्य printer।")}
            <select className={inp} value={s.paper} onChange={(e) => set({ paper: e.target.value as MsSetup["paper"] })}><option value="58">58 mm thermal</option><option value="80">80 mm thermal</option><option value="a5">A5</option><option value="a4">A4</option></select></label>
          <label className={`${lab} sm:col-span-2`}>{T("Terms (bottom of the bill)", "शर्तें (बिल के नीचे)")}<textarea className={inp} rows={2} value={s.terms} onChange={(e) => set({ terms: e.target.value })} /></label>
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
          <label className={lab}>{T("Estimate prefix", "Estimate prefix")}<input className={inp} value={s.estimatePrefix} onChange={(e) => set({ estimatePrefix: e.target.value })} /></label>
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

      {d.access.owner && (
        <section className={card}>
          <h2 className="text-sm font-bold">{T("Staff rights", "Staff के हक़")}{tip("Tick what each staff login may do here. The owner can always do everything.", "हर staff login यहाँ क्या कर सकता है, tick करें। मालिक हमेशा सब कर सकता है।")}</h2>
          {d.staff.length === 0 && <p className="text-xs text-muted">{T("No staff logins yet — add them in Customers → Settings → Team.", "अभी कोई staff login नहीं — Customers → Settings → Team में जोड़ें।")}</p>}
          {d.staff.map((m) => {
            const st = s.staff[m.id] ?? { title: m.role === "manager" ? "Manager" : "Counter", rights: (m.role === "manager" ? MS_RIGHTS.map((r) => r.key) : ["bill"]) as MsRight[] };
            const toggle = (r: MsRight) => set({ staff: { ...s.staff, [m.id]: { ...st, rights: st.rights.includes(r) ? st.rights.filter((x) => x !== r) : [...st.rights, r] } } });
            return (
              <div key={m.id} className="rounded-xl border border-border p-2.5">
                <p className="text-sm font-semibold">{m.name} <span className="font-normal text-muted">· {m.phone}</span></p>
                <div className="mt-1.5 grid gap-1 sm:grid-cols-2">{MS_RIGHTS.map((r) => <label key={r.key} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={st.rights.includes(r.key)} onChange={() => toggle(r.key)} /> {hi ? r.hi : r.en}</label>)}</div>
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
