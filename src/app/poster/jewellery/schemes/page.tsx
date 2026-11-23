"use client";
// Gold scheme: members (running / used on a bill / closed), who is behind, and a new member on one of the shop's plans.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, Plus, Search } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr, paiseOf, type Payment } from "@/lib/jewellery";
import type { SchemePlan, SchemeRow, SchemeState } from "@/lib/jewellery-finance";
import { JwTip } from "@/components/jewellery/jw-tip";

type Row = SchemeRow & { state: SchemeState };
type Ans = { schemes: Row[]; plans: SchemePlan[]; today: string; error?: string };

export default function Schemes() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [view, setView] = useState("active");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<{ plan: string; name: string; phone: string; address: string; nominee: string; mode: Payment["mode"]; amount: string; send: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q); p.set("view", view); if (q.trim()) p.set("q", q.trim());
    const r = await api<Ans>(`/api/jewellery/schemes?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [ws.q, view, q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  async function enrol() {
    if (!form) return;
    setBusy(true); setErr("");
    const amt = paiseOf(form.amount);
    const r = await api<{ scheme?: SchemeRow; error?: string }>("/api/jewellery/schemes", { method: "POST", json: { as: ws.as || undefined, plan: form.plan, customer_name: form.name, customer_phone: form.phone, customer_address: form.address, nominee: form.nominee, payment: amt ? { mode: form.mode, paise: amt, ref: "" } : undefined, send: form.send } });
    setBusy(false);
    if (!r.ok || !r.data.scheme) { setErr(r.data.error || T("Could not save.", "Save नहीं हुआ।")); return; }
    router.push(`/poster/jewellery/schemes/${r.data.scheme.id}${ws.q ? `?${ws.q}&` : "?"}new=1`);
  }

  const asQ = ws.q ? `?${ws.q}` : "";
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const plan = d?.plans.find((p) => p.key === form?.plan);
  return (
    <div className="space-y-3">
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{T("Gold scheme", "गोल्ड स्कीम")}</h1>
        {d && d.plans.length > 0 && !form && <button type="button" onClick={() => setForm({ plan: d.plans[0].key, name: "", phone: "", address: "", nominee: "", mode: "cash", amount: String(d.plans[0].monthlyPaise / 100), send: true })} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {T("New member", "नया मेंबर")}</button>}
      </div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {form && d && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
          <div className="flex flex-wrap gap-1.5">{d.plans.map((p) => <button key={p.key} type="button" onClick={() => setForm({ ...form, plan: p.key, amount: String(p.monthlyPaise / 100) })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${form.plan === p.key ? "border-brand bg-brand/10 text-brand-ink" : "border-border"}`}>{p.name} · {inr(p.monthlyPaise)} × {p.months}{p.bonusPaise ? ` + ${inr(p.bonusPaise)}` : ""}</button>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className={lab}>{T("Name", "नाम")}<JwTip k="Name" /></span><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label><span className={lab}>{T("Mobile", "मोबाइल")}<JwTip k="Mobile" /></span><input className={inp} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label><span className={lab}>{T("Address", "पता")}<JwTip k="Address" /></span><input className={inp} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label><span className={lab}>{T("Nominee", "नॉमिनी")}<JwTip k="Nominee" /></span><input className={inp} value={form.nominee} onChange={(e) => setForm({ ...form, nominee: e.target.value })} /></label>
            <label><span className={lab}>{T("First instalment", "पहली किस्त")}<JwTip k="First instalment" /></span><span className="flex gap-1"><select className="rounded-lg border border-border bg-surface px-1 text-sm" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option></select><input className={inp} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></span></label>
            <label className="flex items-end gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={form.send} onChange={(e) => setForm({ ...form, send: e.target.checked })} /> {T("Send the passbook on WhatsApp", "पासबुक WhatsApp पर भेजें")}</label>
          </div>
          {plan && <p className="text-[11px] text-muted">{T(`${inr(plan.monthlyPaise)} every month for ${plan.months} months${plan.bonusPaise ? `; the shop adds ${inr(plan.bonusPaise)} as a discount when all are paid` : ""}. No interest or cash return is promised.`, `${plan.months} महीने तक हर महीने ${inr(plan.monthlyPaise)}${plan.bonusPaise ? `; सारी किस्तें पूरी होने पर दुकान ${inr(plan.bonusPaise)} की छूट देगी` : ""}। कोई ब्याज या नकद रिटर्न का वादा नहीं।`)}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void enrol()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Enrol", "जोड़ें")}</button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">{T("Close", "बंद")}</button>
          </div>
        </section>
      )}
      <div className="flex gap-1 rounded-xl border border-border bg-surface2/50 p-1">
        {([["active", T("Running", "चालू")], ["redeemed", T("Used on bill", "बिल में लगी")], ["closed", T("Closed", "बंद")]] as [string, string][]).map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${view === k ? "bg-surface shadow-card" : "text-muted"}`}>{l}</button>)}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile or number", "नाम, मोबाइल या नंबर")} className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
      {!d ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : d.schemes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{d.plans.length ? T("No members here yet.", "यहाँ अभी कोई मेंबर नहीं।") : T("Add a plan in Settings first.", "पहले Settings में प्लान जोड़ें।")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {d.schemes.map((s) => (
            <li key={s.id}><Link href={`/poster/jewellery/schemes/${s.id}${asQ}`} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0"><span className="block text-sm font-bold">{s.customer_name} <span className="font-normal text-muted">· {s.code}</span></span>
                <span className="block text-[11px] text-muted">{s.plan.name} · {s.state.installments}/{s.plan.months} {T("paid", "जमा")}{s.state.nextDue && s.status === "active" ? ` · ${T("next", "अगली")} ${s.state.nextDue}` : ""}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{inr(s.state.paid)}</span>{s.status === "active" && s.state.behind > 0 && <span className="text-[11px] font-semibold text-danger">{s.state.behind} {T("behind", "बाकी")}</span>}{s.status === "active" && s.state.complete && <span className="text-[11px] font-semibold text-good">{s.state.matured ? T("Ready to use", "इस्तेमाल के लिए तैयार") : T("All paid", "सब जमा")}</span>}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
