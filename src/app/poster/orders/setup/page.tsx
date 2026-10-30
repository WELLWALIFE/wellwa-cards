"use client";
// The shop decides (owner, 30 Oct 2026): which items it takes, which measurements each item needs, the kinds of work, and the
// unit. What is set here comes up while booking an order; "+ New" while booking adds to it too. Owner / manager only.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, LoaderCircle, Plus, RotateCcw, Ruler, Trash2, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { DEFAULT_SETUP, type JobSetup } from "@/lib/jobs";
import { Fold, useJobSetup, useWorkspace } from "@/components/orders/orders-common";

export default function OrdersSetupPage() {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const api = useJobSetup(ws.q);
  const [s, setS] = useState<JobSetup | null>(null);
  const [openItem, setOpenItem] = useState<string>("");
  const [newItem, setNewItem] = useState(""); const [newWork, setNewWork] = useState("");
  const [newField, setNewField] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setS(api.setup); }, [api.setup, dirty]);

  if (!s) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const change = (next: JobSetup) => { setS(next); setDirty(true); setMsg(""); };
  const move = <V,>(xs: V[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; };
  const setFields = (name: string, fields: string[]) => change({ ...s, items: s.items.map((x) => (x.name === name ? { ...x, fields } : x)) });
  async function save() {
    setBusy(true);
    const ok = await api.save(s!);
    setBusy(false); setDirty(!ok);
    setMsg(ok ? T("Saved. New orders use this now.", "सेव हो गया। अब नए order में यही आएगा।") : T("Could not save. Only the owner or a manager can change this.", "सेव नहीं हुआ। यह सिर्फ़ owner या manager बदल सकते हैं।"));
  }
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = "inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs";
  const small = "grid h-6 w-6 place-items-center rounded-md border border-border bg-surface text-muted disabled:opacity-30";

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <Link href="/poster/orders" className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="flex-1"><h1 className="text-lg font-bold">{T("Orders setup", "Orders setup")}</h1><p className="text-xs text-muted">{T("Your items, the measurements each one needs, and your kinds of work", "आपके item, हर item के नाप, और आपके काम")}</p></div>
      </div>
      {!api.canEdit && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{T("Only the owner or a manager can change this.", "यह सिर्फ़ owner या manager बदल सकते हैं।")}</p>}

      <section className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div><p className="text-sm font-bold">{T("Measure in", "नाप किसमें")}</p><p className="text-xs text-muted">{T("Can still be changed on each measurement", "हर नाप पर बदल भी सकते हैं")}</p></div>
        <span className="inline-flex overflow-hidden rounded-full border border-border text-sm">
          {(["inch", "cm"] as const).map((u) => <button key={u} type="button" onClick={() => change({ ...s, unit: u })} className={`px-4 py-2 ${s.unit === u ? "bg-brand font-semibold text-white" : "bg-surface"}`}>{u === "inch" ? T("inch", "इंच") : "cm"}</button>)}
        </span>
      </section>

      <section className="space-y-2">
        <p className="px-1 text-sm font-bold">{T("Items and their measurements", "Item और उनके नाप")}</p>
        {s.items.map((it, i) => (
          <Fold key={it.name} hi={hi} open={openItem === it.name} onToggle={() => setOpenItem(openItem === it.name ? "" : it.name)}
            icon={<Ruler className={`h-4 w-4 ${it.fields.length ? "text-brand" : "text-muted"}`} />}
            title={it.name}
            summary={it.fields.length ? `${it.fields.length} ${T("measurements", "नाप")}: ${it.fields.slice(0, 4).join(", ")}${it.fields.length > 4 ? "…" : ""}` : T("No measurement (e.g. fall-pico)", "नाप नहीं (जैसे fall-pico)")}
            right={<span className="flex gap-1">
              <button type="button" className={small} disabled={i === 0} onClick={() => change({ ...s, items: move(s.items, i, -1) })} aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" className={small} disabled={i === s.items.length - 1} onClick={() => change({ ...s, items: move(s.items, i, 1) })} aria-label="Down"><ArrowDown className="h-3.5 w-3.5" /></button>
            </span>}>
            <div className="flex flex-wrap gap-1.5">
              {it.fields.map((f, j) => (
                <span key={f} className={chip}>
                  {j > 0 && <button type="button" onClick={() => setFields(it.name, move(it.fields, j, -1))} aria-label="Move left" className="text-muted">‹</button>}
                  {f}
                  <button type="button" onClick={() => setFields(it.name, it.fields.filter((x) => x !== f))} aria-label="Remove" className="text-muted"><X className="h-3 w-3" /></button>
                </span>
              ))}
              {!it.fields.length && <p className="text-xs text-muted">{T("No measurement is asked for this item.", "इस item के लिए नाप नहीं पूछा जाएगा।")}</p>}
            </div>
            <div className="flex gap-2">
              <input className={field} placeholder={T("Add a measurement (e.g. Neck depth)", "नाप जोड़ें (जैसे Neck depth)")} value={newField[it.name] ?? ""} onChange={(e) => setNewField({ ...newField, [it.name]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = (newField[it.name] ?? "").trim(); if (v && !it.fields.some((x) => x.toLowerCase() === v.toLowerCase())) setFields(it.name, [...it.fields, v]); setNewField({ ...newField, [it.name]: "" }); } }} />
              <button type="button" onClick={() => { const v = (newField[it.name] ?? "").trim(); if (v && !it.fields.some((x) => x.toLowerCase() === v.toLowerCase())) setFields(it.name, [...it.fields, v]); setNewField({ ...newField, [it.name]: "" }); }} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => { if (confirm(T(`Remove “${it.name}” from the list? Old orders keep it.`, `“${it.name}” list से हटाएँ? पुराने order में रहेगा।`))) change({ ...s, items: s.items.filter((x) => x.name !== it.name) }); }} className="inline-flex items-center gap-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> {T("Remove this item", "यह item हटाएँ")}</button>
          </Fold>
        ))}
        <div className="flex gap-2">
          <input className={field} placeholder={T("New item (e.g. Sherwani, Frock)", "नया item (जैसे Sherwani, Frock)")} value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button type="button" onClick={() => { const v = newItem.trim(); if (v && !s.items.some((x) => x.name.toLowerCase() === v.toLowerCase())) { change({ ...s, items: [...s.items, { name: v, fields: [] }] }); setOpenItem(v); } setNewItem(""); }} className="shrink-0 rounded-xl grad-brand px-4 text-sm font-semibold text-white">{T("Add", "जोड़ें")}</button>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <p className="text-sm font-bold">{T("Kinds of work", "काम")}</p>
        <div className="flex flex-wrap gap-1.5">
          {s.works.map((w) => <span key={w} className={chip}>{w}<button type="button" onClick={() => change({ ...s, works: s.works.filter((x) => x !== w) })} aria-label="Remove" className="text-muted"><X className="h-3 w-3" /></button></span>)}
        </div>
        <div className="flex gap-2">
          <input className={field} placeholder={T("New work (e.g. Zari work)", "नया काम (जैसे Zari work)")} value={newWork} onChange={(e) => setNewWork(e.target.value)} />
          <button type="button" onClick={() => { const v = newWork.trim(); if (v && !s.works.some((x) => x.toLowerCase() === v.toLowerCase())) change({ ...s, works: [...s.works, v] }); setNewWork(""); }} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /></button>
        </div>
      </section>

      <button type="button" onClick={() => { if (confirm(T("Go back to the starting lists? Your changes here are lost.", "शुरू वाली list पर वापस जाएँ? यहाँ के बदलाव हट जाएँगे।"))) change(DEFAULT_SETUP); }} className="inline-flex items-center gap-1 text-xs text-muted underline"><RotateCcw className="h-3.5 w-3.5" /> {T("Back to the starting lists", "शुरू वाली list पर वापस")}</button>

      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg px-4">
        {msg && <p className="mb-2 rounded-xl bg-surface px-3 py-2 text-center text-xs font-semibold shadow-card">{msg}</p>}
        {dirty && api.canEdit && <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand px-4 py-3.5 text-sm font-bold text-white shadow-card disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{T("Save setup", "Setup सेव करें")}</button>}
      </div>
    </div>
  );
}
