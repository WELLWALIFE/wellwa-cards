"use client";
// One job card: its steps (tap the next one), who has it, cloth given / taken back, payments, the customer's
// measurements, the WhatsApp "ready" message, and the full history.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, History, IndianRupee, LoaderCircle, MessageCircle, Pencil, Phone, Plus, Ruler, StickyNote } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { can, nextStep, receiptMessage, rupees, stepLabel, type JobEvent, type JobRow, type JobSetup, type Karigar, type Measurement } from "@/lib/jobs";
import { Fold, MeasureForm, MeasurementView, PickChips, StatusBadge, useJobSetup, useWorkspace, type Me, type Member } from "@/components/orders/orders-common";

type Detail = { job: JobRow; events: JobEvent[]; measurement: Measurement | null; measurements: Measurement[]; karigars: Karigar[]; team: Member[]; role: "owner" | "manager" | "agent"; me: Me; setup: JobSetup; shop: string; flow: string[]; error?: string };
type Notice = { sent: boolean; link: string; error?: string } | null;
type Panel = "" | "cloth_out" | "cloth_in" | "payment" | "note" | "measure" | "change" | "edit";

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [told, setTold] = useState("");
  const [panel, setPanel] = useState<Panel>("");
  const [form, setForm] = useState({ karigar_id: "", pieces: "", meters: "", amount: "", note: "" });
  const [edit, setEdit] = useState({ customer_name: "", customer_phone: "", item: "", work: "", qty: "1", amount: "", due_date: "", details: "" });
  const [fold, setFold] = useState({ measure: true, older: false, history: true });
  const setup = useJobSetup(ws.q, d?.setup ?? null);

  const load = useCallback(async () => {
    if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
    const r = await api<Detail>(`/api/jobs/${id}${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || T("Could not load.", "Load नहीं हुआ।")); return; }
    setErr(""); setD(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ws.q, router]);
  useEffect(() => { void load(); }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setErr("");
    const r = await api<{ job?: JobRow; notice?: Notice; told?: string; error?: string }>(`/api/jobs/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || T("Could not save.", "सेव नहीं हुआ।")); return false; }
    if (r.data.notice !== undefined) setNotice(r.data.notice ?? null);
    setTold(r.data.told ?? "");
    await load();
    return true;
  }

  if (!d) return err ? <p className="py-16 text-center text-sm text-danger">{err}</p> : <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { job } = d;
  const me = d.me;
  const boss = can(me, "money");
  const flow = d.flow;
  const idx = flow.indexOf(job.status);
  const next = nextStep(flow, job.status);
  const nextWho = (() => {
    const st = d.setup.steps.find((x) => x.key === next);
    return st?.who ? setup.people.find((p) => p.who === st.who)?.name ?? "" : "";
  })();
  const mineNow = job.assigned_to === me.userId;
  const karigar = d.karigars.find((k) => k.id === job.karigar_id);
  const tailor = d.team.find((m) => m.id === job.assigned_to);
  const due = Math.max(0, job.amount_paise - job.advance_paise);
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  const L = (s: string) => stepLabel(d.setup, s, hi);
  const card = "space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card";
  const lab = "text-[11px] font-semibold text-muted";
  const others = d.measurements.filter((m) => m.id !== job.measurement_id);

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center gap-2">
        <Link href="/poster/orders" className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-lg font-bold">#{job.number} · {job.customer_name}</h1>
        <StatusBadge status={job.status} hi={hi} setup={d.setup} />
      </div>

      <section className={card}>
        <p className="text-base font-bold">{[job.item, job.work].filter(Boolean).join(" · ") || T("Order", "Order")}{job.qty > 1 ? ` × ${job.qty}` : ""}</p>
        {job.details && <p className="whitespace-pre-wrap text-sm text-muted">{job.details}</p>}
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <p><span className="block text-[11px] text-muted">{T("Due", "देना है")}</span><b>{job.due_date ? new Date(`${job.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</b></p>
          {boss && <p><span className="block text-[11px] text-muted">{T("Charge", "Charge")}</span><b>{rupees(job.amount_paise)}</b></p>}
          {boss && <p><span className="block text-[11px] text-muted">{T("Paid", "मिला")}</span><b>{rupees(job.advance_paise)}</b></p>}
          {boss && <p><span className="block text-[11px] text-muted">{T("Balance", "बाकी")}</span><b className={due > 0 ? "text-amber-700" : ""}>{rupees(due)}</b></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {can(me, "edit") && <button type="button" onClick={() => { if (panel === "edit") { setPanel(""); return; } setEdit({ customer_name: job.customer_name, customer_phone: job.customer_phone.replace(/^\+91/, ""), item: job.item, work: job.work, qty: String(job.qty || 1), amount: job.amount_paise ? String(job.amount_paise / 100) : "", due_date: job.due_date ?? "", details: job.details }); setPanel("edit"); }} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" /> {T("Edit order", "Order बदलें")}</button>}
          {job.customer_phone && <a href={`https://wa.me/${job.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(receiptMessage([job], d.shop))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> {T("Send slip", "Slip भेजें")}</a>}
        </div>
        {panel === "edit" && (
          <div className="space-y-2 rounded-xl bg-bg p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className={lab}>{T("Customer", "ग्राहक")}<input className={field} value={edit.customer_name} onChange={(e) => setEdit({ ...edit, customer_name: e.target.value })} /></label>
              <label className={lab}>{T("Mobile", "मोबाइल")}<input className={field} inputMode="numeric" value={edit.customer_phone} onChange={(e) => setEdit({ ...edit, customer_phone: e.target.value })} /></label>
            </div>
            <p className={lab}>{T("Item", "Item")}</p>
            <PickChips hi={hi} options={setup.setup.items.map((x) => x.name)} value={edit.item} onPick={(v) => setEdit({ ...edit, item: v })} onAdd={setup.canEdit ? setup.addItem : undefined} newLabel={T("Item name", "Item का नाम")} />
            <p className={lab}>{T("Work", "काम")}</p>
            <PickChips hi={hi} options={setup.setup.works} value={edit.work} onPick={(v) => setEdit({ ...edit, work: v })} onAdd={setup.canEdit ? setup.addWork : undefined} newLabel={T("Work", "काम")} />
            <div className="grid grid-cols-3 gap-2">
              <label className={lab}>{T("Pieces", "Pieces")}<input className={field} inputMode="numeric" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value })} /></label>
              {boss && <label className={lab}>{T("Charge ₹", "Charge ₹")}<input className={field} inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>}
              <label className={lab}>{T("Due", "देना है")}<input type="date" className={field} value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></label>
            </div>
            <textarea className={field} rows={2} value={edit.details} onChange={(e) => setEdit({ ...edit, details: e.target.value })} placeholder={T("Details", "Detail")} />
            <div className="flex gap-2">
              <button type="button" disabled={!!busy} onClick={async () => { const { amount, ...rest } = edit; if (await act("edit", boss ? { ...rest, amount } : rest)) setPanel(""); }} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{T("Save changes", "बदलाव सेव करें")}</button>
              <button type="button" onClick={() => setPanel("")} className="rounded-xl border border-border px-4 py-2.5 text-sm">{T("Cancel", "रहने दें")}</button>
            </div>
            <p className="text-[11px] text-muted">{T("Payments are added with “Payment” below; every change is written in the history.", "पैसे नीचे “पैसे मिले” से जोड़ें; हर बदलाव history में लिखा जाता है।")}</p>
          </div>
        )}
        {job.customer_phone && (
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${job.customer_phone}`} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Phone className="h-3.5 w-3.5" /> {job.customer_phone}</a>
            <a href={`https://wa.me/${job.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
          </div>
        )}
      </section>

      {/* The steps: tap the next one. "Ready" sends the customer's WhatsApp. */}
      <section className={card}>
        <p className="text-sm font-bold">{T("Status", "काम कहाँ तक")}</p>
        <div className="flex flex-wrap gap-1.5">
          {flow.map((s, i) => {
            const done = job.status !== "cancelled" && i <= idx;
            const allowed = can(me, "edit") || s === next;
            return <button key={s} type="button" disabled={!!busy || s === job.status || !allowed} onClick={() => { if (s === next || confirm(T(`Move this job to “${L(s)}”?`, `यह job “${L(s)}” पर ले जाएँ?`))) void act("status", { status: s }); }} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${done ? "border-emerald-600 bg-emerald-50 font-semibold text-emerald-800" : "border-border bg-surface"} ${s === job.status ? "ring-2 ring-emerald-500" : ""}`}>{done && <Check className="h-3 w-3" />}{L(s)}</button>;
          })}
        </div>
        {next && (
          <button type="button" disabled={!!busy} onClick={() => void act("status", { status: next })} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy === "status" && <LoaderCircle className="h-4 w-4 animate-spin" />}{job.status === "received" ? T("Start", "शुरू करें") : T("Done", "हो गया")} → {L(next)}{nextWho ? ` (${nextWho})` : ""}{next === "ready" ? T(" — and tell the customer on WhatsApp", " — ग्राहक को WhatsApp पर बताएँ") : ""}
          </button>
        )}
        {notice && (notice.sent
          ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">✅ {T("The customer got the WhatsApp message.", "ग्राहक को WhatsApp message चला गया।")}</p>
          : <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"><p>{notice.error}</p>{notice.link && <a href={notice.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> {T("Send on WhatsApp", "WhatsApp पर भेजें")}</a>}</div>)}
        {job.status === "ready" && !notice && (
          <button type="button" disabled={!!busy} onClick={() => void act("notify")} className="text-xs font-semibold text-brand-ink underline">{job.notified_at ? T("Send the ready message again", "Ready message फिर भेजें") : T("Send the ready message on WhatsApp", "Ready message WhatsApp पर भेजें")}</button>
        )}
        {told && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">📲 {told}</p>}
        {!job.assigned_to && setup.people.length > 0 && d.setup.steps.some((x) => x.key === job.status) && !can(me, "assign") && <button type="button" disabled={!!busy} onClick={() => void act("take")} className="w-full rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">{T("I'll do this", "यह काम मैं करूँगा")}</button>}
        {mineNow && job.status !== "delivered" && job.status !== "cancelled" && <p className="text-center text-[11px] font-semibold text-emerald-700">{T("This job is with you", "यह काम आपके पास है")}</p>}
        {can(me, "cancel") && job.status !== "cancelled" && job.status !== "delivered" && <button type="button" disabled={!!busy} onClick={() => { if (confirm(T("Cancel this job?", "यह job रद्द करें?"))) void act("status", { status: "cancelled" }); }} className="text-xs text-muted underline">{T("Cancel job", "Job रद्द करें")}</button>}
      </section>

      {/* Who has it. */}
      <section className={card}>
        <p className="text-sm font-bold">{T("Who has it", "किसके पास है")}</p>
        {can(me, "assign") ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-muted">{T("Karigar", "कारीगर")}
              <select className={field} value={job.karigar_id ?? ""} onChange={(e) => void act("assign", { karigar_id: e.target.value || null })}>
                <option value="">—</option>
                {d.karigars.filter((k) => k.active || k.id === job.karigar_id).map((k) => <option key={k.id} value={k.id}>{k.name}{k.skill ? ` · ${k.skill}` : ""}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-muted">{T("Tailor in the app", "App वाला tailor")}
              <select className={field} value={job.assigned_to ?? ""} onChange={(e) => void act("assign", { assigned_to: e.target.value || null, assigned_name: d.team.find((m) => m.id === e.target.value)?.name })}>
                <option value="">—</option>
                {d.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {d.karigars.length === 0 && <Link href="/poster/orders/karigars" className="text-xs font-semibold text-brand-ink underline">+ {T("Add your karigars", "अपने कारीगर जोड़ें")}</Link>}
          </div>
        ) : <p className="text-sm">{[karigar?.name, tailor?.name].filter(Boolean).join(" · ") || "—"}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setPanel(panel === "cloth_out" ? "" : "cloth_out"); setForm({ ...form, karigar_id: job.karigar_id ?? "" }); }} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><ArrowUpRight className="h-3.5 w-3.5" /> {T("Cloth given", "कपड़ा दिया")}</button>
          <button type="button" onClick={() => { setPanel(panel === "cloth_in" ? "" : "cloth_in"); setForm({ ...form, karigar_id: job.karigar_id ?? "" }); }} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><ArrowDownLeft className="h-3.5 w-3.5" /> {T("Cloth taken back", "कपड़ा वापस लिया")}</button>
          {boss && <button type="button" onClick={() => setPanel(panel === "payment" ? "" : "payment")} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><IndianRupee className="h-3.5 w-3.5" /> {T("Payment", "पैसे मिले")}</button>}
          <button type="button" onClick={() => setPanel(panel === "note" ? "" : "note")} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><StickyNote className="h-3.5 w-3.5" /> {T("Note", "Note")}</button>
        </div>
        {(panel === "cloth_out" || panel === "cloth_in") && (
          <div className="grid gap-2 rounded-xl bg-bg p-3 sm:grid-cols-2">
            <select className={field} value={form.karigar_id} onChange={(e) => setForm({ ...form, karigar_id: e.target.value })}>
              <option value="">{T("Karigar", "कारीगर")}</option>
              {d.karigars.filter((k) => k.active).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className={field} inputMode="numeric" placeholder={T("Pieces", "Pieces")} value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} />
              <input className={field} inputMode="decimal" placeholder={T("Metres", "मीटर")} value={form.meters} onChange={(e) => setForm({ ...form, meters: e.target.value })} />
            </div>
            <input className={`${field} sm:col-span-2`} placeholder={T("Note (e.g. saree + blouse piece, lining)", "Note (जैसे साड़ी + blouse piece, lining)")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button type="button" disabled={!!busy} onClick={async () => { if (await act(panel, { karigar_id: form.karigar_id || undefined, pieces: form.pieces, meters: form.meters, note: form.note })) { setPanel(""); setForm({ karigar_id: "", pieces: "", meters: "", amount: "", note: "" }); } }} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{panel === "cloth_out" ? T("Save — cloth given", "Save — कपड़ा दिया") : T("Save — cloth taken back", "Save — कपड़ा वापस")}</button>
          </div>
        )}
        {panel === "payment" && (
          <div className="grid gap-2 rounded-xl bg-bg p-3 sm:grid-cols-2">
            <input className={field} inputMode="decimal" placeholder={T("Amount ₹", "रकम ₹")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className={field} placeholder={T("Note (cash / UPI)", "Note (cash / UPI)")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button type="button" disabled={!!busy} onClick={async () => { if (await act("payment", { amount: form.amount, note: form.note })) { setPanel(""); setForm({ karigar_id: "", pieces: "", meters: "", amount: "", note: "" }); } }} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{T("Save payment", "Payment सेव करें")}</button>
          </div>
        )}
        {panel === "note" && (
          <div className="space-y-2 rounded-xl bg-bg p-3">
            <textarea className={field} rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={T("e.g. customer wants the neck 1 inch deeper", "जैसे: ग्राहक को गला 1 इंच गहरा चाहिए")} />
            <button type="button" disabled={!!busy} onClick={async () => { if (await act("note", { note: form.note })) { setPanel(""); setForm({ karigar_id: "", pieces: "", meters: "", amount: "", note: "" }); } }} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{T("Save note", "Note सेव करें")}</button>
          </div>
        )}
      </section>

      {/* The measurements the tailor cuts from: change (a new copy, the old stays), take new, or attach an older one. */}
      <Fold hi={hi} icon={<Ruler className="h-4 w-4 text-brand" />} title={T("Measurements", "नाप")} open={fold.measure} onToggle={() => setFold({ ...fold, measure: !fold.measure })}
        summary={d.measurement ? `${d.measurement.garment} · ${new Date(d.measurement.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : T("None attached", "कोई नाप नहीं जुड़ा")}
        right={can(me, "measure") && panel !== "measure" && panel !== "change" ? <button type="button" onClick={() => { setFold({ ...fold, measure: true }); setPanel("measure"); }} className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" />{T("New", "नया")}</button> : null}>
        {panel === "change" && d.measurement
          ? <MeasureForm hi={hi} q={ws.q} phone={job.customer_phone} name={job.customer_name} jobId={job.id} item={job.item} setup={setup} from={d.measurement} onSaved={() => { setPanel(""); void load(); }} onCancel={() => setPanel("")} />
          : d.measurement ? <MeasurementView m={d.measurement} hi={hi} onEdit={can(me, "measure") ? () => setPanel("change") : undefined} />
          : panel !== "measure" && <p className="text-sm text-muted">{T("No measurement attached to this job.", "इस job से कोई नाप नहीं जुड़ा।")}</p>}
        {panel === "measure" && <MeasureForm hi={hi} q={ws.q} phone={job.customer_phone} name={job.customer_name} jobId={job.id} item={job.item} setup={setup} onSaved={() => { setPanel(""); void load(); }} onCancel={() => setPanel("")} />}
        {others.length > 0 && (
          <Fold hi={hi} tone="inner" icon={<History className="h-4 w-4 text-muted" />} title={`${T("Older measurements", "पुराने नाप")} (${others.length})`} open={fold.older} onToggle={() => setFold({ ...fold, older: !fold.older })}>
            {others.map((m) => <MeasurementView key={m.id} m={m} hi={hi} action={can(me, "measure") && <button type="button" disabled={!!busy} onClick={() => void act("edit", { measurement_id: m.id })} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold">{T("Use for this job", "इस job में लगाएँ")}</button>} />)}
          </Fold>
        )}
      </Fold>

      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {/* Everything that happened. */}
      <Fold hi={hi} icon={<History className="h-4 w-4 text-brand" />} title={T("History", "पूरा हिसाब")} summary={`${d.events.length} ${T("entries", "entries")}`} open={fold.history} onToggle={() => setFold({ ...fold, history: !fold.history })}>
        <ol className="space-y-2">
          {[...d.events].reverse().map((e) => (
            <li key={e.id} className="flex gap-3 border-l-2 border-border pl-3 text-sm">
              <span className="min-w-0 flex-1">
                <b>{e.kind === "status" ? L(e.status) : e.kind === "cloth_out" ? T("Cloth given", "कपड़ा दिया") : e.kind === "cloth_in" ? T("Cloth taken back", "कपड़ा वापस") : e.kind === "payment" ? `${T("Payment", "पैसे मिले")} ${rupees(e.amount_paise ?? 0)}` : e.kind === "assign" ? T("Assigned", "सौंपा") : e.kind === "notify" ? T("WhatsApp sent", "WhatsApp भेजा") : e.kind === "created" ? T("Order booked", "Order बना") : T("Note", "Note")}</b>
                {(e.karigar || e.pieces || e.meters) && <span className="text-muted"> · {[e.karigar, e.pieces ? `${e.pieces} pcs` : "", e.meters ? `${e.meters} m` : ""].filter(Boolean).join(" · ")}</span>}
                {e.note && e.kind !== "notify" && <span className="block whitespace-pre-wrap text-xs text-muted">{e.note}</span>}
              </span>
              <span className="shrink-0 text-right text-[11px] text-muted">{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{e.by_name && <span className="block">{e.by_name}</span>}</span>
            </li>
          ))}
        </ol>
      </Fold>
    </div>
  );
}
