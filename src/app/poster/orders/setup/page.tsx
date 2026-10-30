"use client";
// The shop decides (owner, 30 Oct 2026): the flow (Received → its own steps → Ready → Delivered, and whose each step is),
// which items it takes with their usual work, steps and measurements, the kinds of work, and the unit. "setup" right.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, GitBranch, LoaderCircle, Plus, RotateCcw, Ruler, Shirt, Trash2, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { DEFAULT_SETUP, stepKey, stepLabel, type JobSetup } from "@/lib/jobs";
import { Fold, useJobSetup, useWorkspace } from "@/components/orders/orders-common";

export default function OrdersSetupPage() {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const api = useJobSetup(ws.q);
  const [s, setS] = useState<JobSetup | null>(null);
  const [openItem, setOpenItem] = useState<string>("");
  const [open, setOpen] = useState({ flow: true, items: true, works: false });
  const [newItem, setNewItem] = useState(""); const [newWork, setNewWork] = useState(""); const [newStep, setNewStep] = useState("");
  const [newField, setNewField] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty && api.loaded) setS(api.setup); }, [api.setup, api.loaded, dirty]);

  if (!s) return api.error ? <p className="py-16 text-center text-sm text-danger">{api.error}</p> : <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const change = (next: JobSetup) => { setS(next); setDirty(true); setMsg(""); };
  const move = <V,>(xs: V[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; };
  const setItem = (name: string, patch: Partial<JobSetup["items"][number]>) => change({ ...s, items: s.items.map((x) => (x.name === name ? { ...x, ...patch } : x)) });
  const addField = (name: string, fields: string[]) => { const v = (newField[name] ?? "").trim(); if (v && !fields.some((x) => x.toLowerCase() === v.toLowerCase())) setItem(name, { fields: [...fields, v] }); setNewField({ ...newField, [name]: "" }); };
  async function save() {
    setBusy(true);
    const e = await api.save(s!);
    setBusy(false); setDirty(!!e);
    setMsg(e || T("Saved. New orders follow this now.", "सेव हो गया। अब नए order इसी हिसाब से चलेंगे।"));
  }
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = "inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs";
  const small = "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted disabled:opacity-30";
  const fixed = (label: string, hint: string) => (
    <li className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-bg px-3 py-2 text-sm"><span className="font-semibold">{label}</span><span className="text-[11px] text-muted">{hint}</span></li>
  );
  const staff = api.people.filter((p) => p.kind === "staff"), karigars = api.people.filter((p) => p.kind === "karigar");

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center gap-2">
        <Link href="/poster/orders" className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="flex-1"><h1 className="text-lg font-bold">{T("Setup & flow", "Setup · Flow")}</h1><p className="text-xs text-muted">{T("How work moves in your shop, your items and their measurements", "आपकी दुकान में काम कैसे चलता है, आपके item और उनके नाप")}</p></div>
      </div>
      {!api.canEdit && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{T("You can see this but not change it.", "आप यह देख सकते हैं, बदल नहीं सकते।")}</p>}

      {/* 1 · The flow */}
      <Fold hi={hi} icon={<GitBranch className="h-4 w-4 text-brand" />} title={T("1 · The flow (steps)", "1 · Flow (काम के step)")} open={open.flow} onToggle={() => setOpen({ ...open, flow: !open.flow })}
        summary={["received", ...s.steps.map((x) => x.key), "ready", "delivered"].map((k) => stepLabel(s, k, hi)).join(" → ")}>
        <p className="text-xs text-muted">{T("When a job reaches a step, that step's person gets it in the app and on WhatsApp. At Ready the customer gets the WhatsApp.", "Job जिस step पर पहुँचे, उस step वाले को app और WhatsApp पर काम मिल जाता है। Ready होते ही ग्राहक को WhatsApp जाता है।")}</p>
        <ol className="space-y-2">
          {fixed(`1. ${stepLabel(s, "received", hi)}`, T("order booked at the counter", "counter पर order बुक"))}
          {s.steps.map((st, i) => (
            <li key={st.key} className="space-y-2 rounded-xl border border-border bg-surface p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-5 text-center text-xs font-bold text-muted">{i + 2}.</span>
                <input className={`${field} py-2`} value={st.name} onChange={(e) => change({ ...s, steps: s.steps.map((x) => (x.key === st.key ? { ...x, name: e.target.value } : x)) })} />
                <button type="button" className={small} disabled={i === 0} onClick={() => change({ ...s, steps: move(s.steps, i, -1) })} aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className={small} disabled={i === s.steps.length - 1} onClick={() => change({ ...s, steps: move(s.steps, i, 1) })} aria-label="Down"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" className={small} onClick={() => { if (confirm(T(`Remove the step “${st.name}”? Jobs on it stay there.`, `“${st.name}” step हटाएँ? जो job उस पर हैं वहीं रहेंगे।`))) change({ ...s, steps: s.steps.filter((x) => x.key !== st.key), items: s.items.map((it) => (it.steps ? { ...it, steps: it.steps.filter((k) => k !== st.key) } : it)) }); }} aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <label className="flex items-center gap-2 pl-6 text-[11px] font-semibold text-muted">{T("Whose work", "किसका काम")}
                <select className={`${field} py-1.5 text-xs`} value={st.who} onChange={(e) => change({ ...s, steps: s.steps.map((x) => (x.key === st.key ? { ...x, who: e.target.value } : x)) })}>
                  <option value="">{T("Nobody fixed — give per job", "कोई तय नहीं — हर job पर दें")}</option>
                  {staff.length > 0 && <optgroup label={T("Staff (app login)", "Staff (app login)")}>{staff.map((p) => <option key={p.who} value={p.who}>{p.name}{p.title ? ` · ${p.title}` : ""}{p.joined ? "" : T(" (not joined yet)", " (अभी जुड़े नहीं)")}</option>)}</optgroup>}
                  {karigars.length > 0 && <optgroup label={T("Karigars (WhatsApp only)", "कारीगर (सिर्फ़ WhatsApp)")}>{karigars.map((p) => <option key={p.who} value={p.who}>{p.name}{p.title ? ` · ${p.title}` : ""}</option>)}</optgroup>}
                </select>
              </label>
            </li>
          ))}
          <li className="flex gap-2">
            <input className={field} placeholder={T("New step (e.g. Hand work, Ironing)", "नया step (जैसे Hand work, Press)")} value={newStep} onChange={(e) => setNewStep(e.target.value)} />
            <button type="button" onClick={() => { const v = newStep.trim(); if (v) change({ ...s, steps: [...s.steps, { key: stepKey(v, s.steps.map((x) => x.key)), name: v, who: "" }] }); setNewStep(""); }} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /></button>
          </li>
          {fixed(`${s.steps.length + 2}. ${stepLabel(s, "ready", hi)}`, T("customer gets the WhatsApp", "ग्राहक को WhatsApp"))}
          {fixed(`${s.steps.length + 3}. ${stepLabel(s, "delivered", hi)}`, T("handed over", "ग्राहक को दे दिया"))}
        </ol>
        {(staff.length === 0 || karigars.length === 0) && <p className="text-[11px] text-muted">{staff.length === 0 && <Link href="/poster/orders/staff" className="font-semibold text-brand-ink underline">{T("Add staff logins", "Staff login बनाएँ")}</Link>}{staff.length === 0 && karigars.length === 0 ? " · " : ""}{karigars.length === 0 && <Link href="/poster/orders/karigars" className="font-semibold text-brand-ink underline">{T("Add karigars", "कारीगर जोड़ें")}</Link>}</p>}
        <label className="flex items-start gap-2 rounded-xl bg-bg p-3 text-sm">
          <input type="checkbox" className="mt-0.5" checked={s.autoStart} onChange={(e) => change({ ...s, autoStart: e.target.checked })} />
          <span><b>{T("Start by itself", "अपने-आप शुरू")}</b><span className="block text-xs text-muted">{T("A booked order goes straight to its first step and that person is told. Off: it waits at Received until someone taps Start.", "Order बुक होते ही पहले step पर चला जाए और उस व्यक्ति को बता दिया जाए। बंद: Received पर रुकेगा, कोई “शुरू करें” दबाए तब।")}</span></span>
        </label>
      </Fold>

      {/* 2 · Items */}
      <Fold hi={hi} icon={<Shirt className="h-4 w-4 text-brand" />} title={T("2 · Items — work, steps, measurements", "2 · Item — काम, step, नाप")} open={open.items} onToggle={() => setOpen({ ...open, items: !open.items })} summary={s.items.map((x) => x.name).join(", ")}>
        {s.items.map((it, i) => {
          const steps = it.steps ?? s.steps.map((x) => x.key);
          return (
            <Fold key={it.name} hi={hi} tone="inner" open={openItem === it.name} onToggle={() => setOpenItem(openItem === it.name ? "" : it.name)}
              icon={<Ruler className={`h-4 w-4 ${it.fields.length ? "text-brand" : "text-muted"}`} />} title={it.name}
              summary={[it.work, steps.map((k) => stepLabel(s, k, hi)).join(" → "), it.fields.length ? `${it.fields.length} ${T("measurements", "नाप")}` : T("no measurement", "नाप नहीं")].filter(Boolean).join(" · ")}
              right={<span className="flex gap-1">
                <button type="button" className={small} disabled={i === 0} onClick={() => change({ ...s, items: move(s.items, i, -1) })} aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className={small} disabled={i === s.items.length - 1} onClick={() => change({ ...s, items: move(s.items, i, 1) })} aria-label="Down"><ArrowDown className="h-3.5 w-3.5" /></button>
              </span>}>
              <label className="block text-[11px] font-semibold text-muted">{T("Usual work (picked by itself)", "आम काम (अपने-आप चुना जाएगा)")}
                <select className={field} value={it.work ?? ""} onChange={(e) => setItem(it.name, { work: e.target.value })}>
                  <option value="">—</option>
                  {s.works.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted">{T("Steps for this item", "इस item के step")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.steps.map((st) => {
                    const on = steps.includes(st.key);
                    return <button key={st.key} type="button" onClick={() => setItem(it.name, { steps: on ? steps.filter((k) => k !== st.key) : s.steps.map((x) => x.key).filter((k) => k === st.key || steps.includes(k)) })} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand font-semibold text-white" : "border-border bg-surface text-muted line-through"}`}>{st.name}</button>;
                  })}
                </div>
                <p className="text-[11px] text-muted">{[stepLabel(s, "received", hi), ...steps.map((k) => stepLabel(s, k, hi)), stepLabel(s, "ready", hi)].join(" → ")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted">{T("Measurements", "नाप")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {it.fields.map((f, j) => (
                    <span key={f} className={chip}>
                      {j > 0 && <button type="button" onClick={() => setItem(it.name, { fields: move(it.fields, j, -1) })} aria-label="Move left" className="text-muted">‹</button>}
                      {f}
                      <button type="button" onClick={() => setItem(it.name, { fields: it.fields.filter((x) => x !== f) })} aria-label="Remove" className="text-muted"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {!it.fields.length && <p className="text-xs text-muted">{T("No measurement is asked for this item.", "इस item के लिए नाप नहीं पूछा जाएगा।")}</p>}
                </div>
                <div className="flex gap-2">
                  <input className={field} placeholder={T("Add a measurement (e.g. Neck depth)", "नाप जोड़ें (जैसे Neck depth)")} value={newField[it.name] ?? ""} onChange={(e) => setNewField({ ...newField, [it.name]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(it.name, it.fields); } }} />
                  <button type="button" onClick={() => addField(it.name, it.fields)} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <button type="button" onClick={() => { if (confirm(T(`Remove “${it.name}” from the list? Old orders keep it.`, `“${it.name}” list से हटाएँ? पुराने order में रहेगा।`))) change({ ...s, items: s.items.filter((x) => x.name !== it.name) }); }} className="inline-flex items-center gap-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> {T("Remove this item", "यह item हटाएँ")}</button>
            </Fold>
          );
        })}
        <div className="flex gap-2">
          <input className={field} placeholder={T("New item (e.g. Sherwani, Frock)", "नया item (जैसे Sherwani, Frock)")} value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button type="button" onClick={() => { const v = newItem.trim(); if (v && !s.items.some((x) => x.name.toLowerCase() === v.toLowerCase())) { change({ ...s, items: [...s.items, { name: v, fields: [], work: "" }] }); setOpenItem(v); } setNewItem(""); }} className="shrink-0 rounded-xl grad-brand px-4 text-sm font-semibold text-white">{T("Add", "जोड़ें")}</button>
        </div>
      </Fold>

      {/* 3 · Kinds of work and the unit */}
      <Fold hi={hi} title={T("3 · Kinds of work · unit", "3 · काम · नाप की इकाई")} open={open.works} onToggle={() => setOpen({ ...open, works: !open.works })} summary={`${s.works.join(", ")} · ${s.unit}`}>
        <div className="flex flex-wrap gap-1.5">
          {s.works.map((w) => <span key={w} className={chip}>{w}<button type="button" onClick={() => change({ ...s, works: s.works.filter((x) => x !== w) })} aria-label="Remove" className="text-muted"><X className="h-3 w-3" /></button></span>)}
        </div>
        <div className="flex gap-2">
          <input className={field} placeholder={T("New work (e.g. Zari work)", "नया काम (जैसे Zari work)")} value={newWork} onChange={(e) => setNewWork(e.target.value)} />
          <button type="button" onClick={() => { const v = newWork.trim(); if (v && !s.works.some((x) => x.toLowerCase() === v.toLowerCase())) change({ ...s, works: [...s.works, v] }); setNewWork(""); }} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{T("Measure in", "नाप किसमें")}</p>
          <span className="inline-flex overflow-hidden rounded-full border border-border text-sm">
            {(["inch", "cm"] as const).map((u) => <button key={u} type="button" onClick={() => change({ ...s, unit: u })} className={`px-4 py-2 ${s.unit === u ? "bg-brand font-semibold text-white" : "bg-surface"}`}>{u === "inch" ? T("inch", "इंच") : "cm"}</button>)}
          </span>
        </div>
      </Fold>

      <button type="button" onClick={() => { if (confirm(T("Go back to the starting lists and flow? Staff rights stay.", "शुरू वाली list और flow पर वापस जाएँ? Staff के rights रहेंगे।"))) change({ ...DEFAULT_SETUP, staff: s.staff }); }} className="inline-flex items-center gap-1 text-xs text-muted underline"><RotateCcw className="h-3.5 w-3.5" /> {T("Back to the starting setup", "शुरू वाले setup पर वापस")}</button>

      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg px-4">
        {msg && <p className="mb-2 rounded-xl bg-surface px-3 py-2 text-center text-xs font-semibold shadow-card">{msg}</p>}
        {dirty && api.canEdit && <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand px-4 py-3.5 text-sm font-bold text-white shadow-card disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{T("Save setup", "Setup सेव करें")}</button>}
      </div>
    </div>
  );
}
