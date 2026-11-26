"use client";
// One repair job: where it stands, the parts used and the charge, the advance, and the next step — tell the customer it is
// ready, give it back (this makes the bill), or return it unrepaired.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Link2, LoaderCircle, MessageCircle, Phone, Printer, Search, Trash2, Undo2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { MsHelp } from "@/components/mobile/page-help";
import { JobSlip } from "@/components/mobile/job-slip";
import { inr, paiseOf, type Payment } from "@/lib/jewellery";
import { itemMatches, itemTitle, type ItemRow, type MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { PhotoPicker, SignPad, uploadSignature } from "@/components/mobile/job-proof";
import { JOB_PHOTOS, JOB_STATUSES, conditionText, jobLate, jobOpen, jobStatus, jobTotals, problemText, type JobRow, type JobStatus } from "@/lib/mobile-repair";

type Item = ItemRow & { stock: number };
type Ans = { job: JobRow; setup: MsSetup; access: MsAccess; shop: string; link: string; staff: { id: string; name: string }[]; today: string; error?: string };
type Res = { job?: JobRow; sent?: boolean | { sent?: boolean; link?: string; error?: string } | null; link?: string; billId?: string; error?: string };

function JobView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const made = sp.get("new");
  const [d, setD] = useState<Ans | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState<{ ok: boolean; t: string; link?: string; open?: string } | null>(
    made === "sent" ? { ok: true, t: T("✅ Saved and sent on WhatsApp.", "✅ Save हुआ और WhatsApp पर भेज दिया।") }
      : made === "notsent" ? { ok: false, t: T("Saved. But it did not go on WhatsApp — use the button below.", "Save हो गया। पर WhatsApp पर नहीं गया — नीचे के बटन से भेजें।") }
      : made ? { ok: true, t: T("✅ Saved. Print the slip for the customer.", "✅ Save हो गया। ग्राहक के लिए पर्ची print करें।") } : null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [labour, setLabour] = useState("");
  const [adv, setAdv] = useState({ amount: "", mode: "cash" as Payment["mode"] });
  const [tell, setTell] = useState(true);
  const [give, setGive] = useState({ open: false, amount: "", mode: "cash" as Payment["mode"] });
  const [closing, setClosing] = useState<"" | "return" | "cancel">("");
  const [reason, setReason] = useState("");
  const [signed, setSigned] = useState(false);
  const pad = useRef<HTMLCanvasElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Ans>(`/api/mobile/jobs/${id}${asQ}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setD(r.data); setLabour(r.data.job.labour_paise ? String(r.data.job.labour_paise / 100) : "");
    } catch { setErr("No internet."); }
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);
  // The item list for "parts used" loads only when the search box is first used.
  const needItems = q.trim().length > 0 && !items;
  useEffect(() => { if (!needItems) return; void api<{ items?: Item[] }>(`/api/mobile/items${asQ}`, { fresh: true }).then((r) => setItems(r.ok ? r.data.items ?? [] : [])).catch(() => setItems([])); }, [needItems, asQ]);
  const found = useMemo(() => (q.trim() && items ? items.filter((i) => i.active && !i.serial && i.kind !== "service" && itemMatches(i, q)).slice(0, 15) : []), [q, items]);

  async function act(action: string, extra: Record<string, unknown> = {}): Promise<Res | null> {
    setBusy(action); setNote(null);
    let r: { ok: boolean; data: Res };
    try { r = await api<Res>(`/api/mobile/jobs/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } }); }
    catch { setBusy(""); setNote({ ok: false, t: T("No internet. Try again when the network is back.", "इंटरनेट नहीं है। नेटवर्क आने पर फिर करें।") }); return null; }
    setBusy("");
    if (action === "send") {
      setNote(r.data.sent === true ? { ok: true, t: T("✅ Sent on WhatsApp.", "✅ WhatsApp पर भेज दिया।") } : { ok: false, t: r.data.error || T("Not sent.", "नहीं गया।"), link: r.data.link });
      return r.data;
    }
    if (!r.ok) { setNote({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return null; }
    if (r.data.job) setD((x) => (x ? { ...x, job: r.data.job! } : x));
    const s = r.data.sent && typeof r.data.sent === "object" ? r.data.sent : null;
    setNote(s ? (s.sent ? { ok: true, t: T("✅ Saved and the customer was told on WhatsApp.", "✅ Save हुआ और ग्राहक को WhatsApp पर बता दिया।") } : { ok: false, t: T("Saved. The WhatsApp did not go —", "Save हो गया। WhatsApp नहीं गया —"), link: s.link }) : { ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
    return r.data;
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { job, setup, access } = d;
  const can = (r: string) => access.owner || access.rights.includes(r as never);
  const open = jobOpen(job.status);
  const st = jobStatus(job.status);
  const t = jobTotals({ ...job, labour_paise: open ? paiseOf(labour) : job.labour_paise });
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const inp = "rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  const card = "space-y-2 rounded-2xl border border-border bg-surface p-3 print:hidden";
  const slip = setup.paper === "58" || setup.paper === "80";
  const row = (k: string, v: string) => (v ? <p className="text-[13px]"><span className="text-muted">{k}: </span><span className="font-semibold">{v}</span></p> : null);

  return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } .ms-doc, .ms-doc * { visibility: visible !important; } .ms-doc { position: absolute; left: 0; top: 0; } @page { margin: ${slip ? "2mm" : "8mm"}; } }`}</style>
      <Link href={`/poster/mobile/repairs${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted print:hidden"><ArrowLeft className="h-4 w-4" /> {T("Repair jobs", "रिपेयर jobs")}</Link>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-lg font-bold">🔧 {job.code}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.tone}`}>{hi ? st.hi : st.en}</span>
      </div>
      <MsHelp k="repairView" />
      {jobLate(job, d.today) && <p className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 print:hidden"><AlertTriangle className="h-4 w-4" /> {T(`Promised for ${job.due_date} — it is late.`, `${job.due_date} का वादा था — देर हो गई है।`)}</p>}

      <section className={card}>
        <p className="text-base font-bold">{job.device}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-sm"><span className="font-semibold">{job.customer_name || T("Customer", "ग्राहक")}</span><a href={`tel:${job.customer_phone}`} className="inline-flex items-center gap-1 font-semibold text-brand-ink"><Phone className="h-3.5 w-3.5" /> {job.customer_phone}</a></p>
        {row(T("Problem", "ख़राबी"), problemText(job, hi))}
        {row(T("Condition", "हालत"), conditionText(job, hi))}
        {row("IMEI", job.imei)}
        {row(T("Came with", "साथ आया"), job.accessories)}
        {row(T("Lock PIN / pattern", "Lock PIN / pattern"), job.lock_code)}
        {row(T("Estimate", "अंदाज़"), job.est_paise ? inr(job.est_paise) : "")}
        {row(T("Ready by", "कब तक"), job.due_date ?? "")}
        {row(T("Shop note", "दुकान का नोट"), job.notes)}
        {open && d.staff.length > 0 && <label className="flex items-center gap-2 text-[13px] text-muted">Technician: <select className={inp} value={job.tech_id ?? ""} onChange={(e) => void act("update", { tech_id: e.target.value || null })}><option value="">—</option>{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        {!open && row("Technician", job.tech_name)}
        {job.cancel_reason && <p className="rounded-lg bg-red-50 px-2 py-1 text-[13px] text-red-700">{job.cancel_reason}</p>}
      </section>

      {can("repair") && (
        <section className={card}>
          <p className="text-sm font-bold">{T("Photos & signature", "Photo और signature")}<FieldTip lang={lang} en="Photos of the phone as it came in, and the customer's signature. Your proof if there is an argument later." hi="फ़ोन जैसा आया था उसकी photo, और ग्राहक के signature। बाद में बहस हो तो ये आपका सबूत है।" /></p>
          <PhotoPicker photos={job.photos ?? []} hi={hi} max={JOB_PHOTOS} setPhotos={(p) => void act("photos", { photos: p, keep: p })} />
          {job.signature ? <div><p className="text-[12px] text-muted">{T("Customer's signature", "ग्राहक के signature")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.signature} alt="" className="h-16 w-auto rounded-lg border border-border bg-white" /></div>
            : <div className="space-y-1"><SignPad padRef={pad} onChange={setSigned} hi={hi} />
              {signed && <button type="button" disabled={!!busy} onClick={async () => { setBusy("photos"); const u = await uploadSignature(pad.current); setBusy(""); if (!u) { setNote({ ok: false, t: T("The signature did not upload.", "Signature upload नहीं हुआ।") }); return; } void act("photos", { signature: u }); }} className="rounded-lg grad-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{T("Save signature", "Signature save करें")}</button>}</div>}
        </section>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-4 w-4" /> {T("Print slip", "पर्ची print")}</button>
        <button type="button" disabled={!!busy} onClick={() => void act("send", { what: job.status === "ready" ? "ready" : job.status === "received" ? "received" : "status" })} className={`${btn} !border-[#25D366] !text-[#128C7E]`}>{busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {T("Tell on WhatsApp", "WhatsApp पर बताएँ")}</button>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(d.link).catch(() => {}); setNote({ ok: true, t: T("✅ Customer's tracking link copied.", "✅ ग्राहक का tracking लिंक कॉपी हो गया।"), open: d.link }); }} className={btn}><Link2 className="h-4 w-4" /> {T("Copy link", "लिंक कॉपी")}</button>
        {job.bill_id && <Link href={`/poster/mobile/bill/${job.bill_id}${asQ}`} className={`${btn} grad-brand !border-transparent text-white`}>{T("Open the bill", "बिल खोलें")}</Link>}
      </div>
      {note && <p className={`text-sm font-semibold print:hidden ${note.ok ? "text-good" : "text-danger"}`}>{note.t} {note.link && <a href={note.link} target="_blank" rel="noreferrer" className="underline">{T("Send it yourself →", "खुद भेजें →")}</a>}{note.open && <a href={note.open} target="_blank" rel="noreferrer" className="underline">{T("Open →", "खोलें →")}</a>}</p>}

      {open && (
        <section className={card}>
          <p className="text-sm font-bold">{T("Where is it now?", "अभी कहाँ तक पहुँचा?")}<FieldTip lang={lang} en="Tap the step the phone is at. 'Ready' sends the customer a WhatsApp (if ticked) with the amount to pay." hi="फ़ोन जिस step पर है वो दबाएँ। 'तैयार' दबाने पर (tick हो तो) ग्राहक को WhatsApp जाता है, देने वाली रक़म के साथ।" /></p>
          <div className="flex flex-wrap gap-2">{JOB_STATUSES.filter((s) => jobOpen(s.key)).map((s) => <button key={s.key} type="button" disabled={!!busy || job.status === s.key} onClick={() => void act("status", { to: s.key as JobStatus, notify: s.key === "ready" && tell, labour_paise: paiseOf(labour) })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${job.status === s.key ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{hi ? s.hi : s.en}</button>)}</div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} /> {T("On “Ready”, tell the customer on WhatsApp", "“तैयार” पर ग्राहक को WhatsApp से बताएँ")}</label>
        </section>
      )}

      <section className={card}>
        <p className="text-sm font-bold">{T("Parts used and charge", "लगे parts और charge")}<FieldTip lang={lang} en="Search a part from your Items and tap it — it is put on this job and leaves your stock at once. Wrong part? Tap the bin; it goes back to stock." hi="अपने Items से part खोजकर दबाएँ — वो इस job पर चढ़ता है और स्टॉक से तुरंत घटता है। गलत part? डिब्बा दबाएँ; वो स्टॉक में लौट आता है।" /></p>
        {(job.parts ?? []).map((p, i) => (
          <div key={`${p.itemId}${i}`} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{p.name} ×{p.qty}</span><span className="flex shrink-0 items-center gap-2"><b className="tabular-nums">{inr(p.qty * p.price)}</b>{open && <button type="button" aria-label="Remove" disabled={!!busy} onClick={() => void act("part_remove", { index: i })} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button>}</span></div>
        ))}
        {open && <>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" /><input className={`${inp} w-full pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Add a part from your items (e.g. display redmi 13)", "अपने items से part जोड़ें (जैसे display redmi 13)")} /></div>
          {q.trim() && <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
            {!items && <LoaderCircle className="m-2 h-4 w-4 animate-spin text-muted" />}
            {found.map((i) => <button key={i.id} type="button" disabled={!!busy} onClick={async () => { if (await act("part_add", { itemId: i.id, qty: 1 })) { setQ(""); setItems(null); } }} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg"><span className="truncate font-semibold">{itemTitle(i)}</span><span className="shrink-0 text-[11px] text-muted">{inr(i.price_paise)} · {T("Stock", "स्टॉक")} {i.stock}</span></button>)}
            {items && !found.length && <p className="px-2 py-1.5 text-[13px] text-muted">{T("Not in your items. Add it in Items first, or put its price in the repair charge.", "आपके items में नहीं है। पहले Items में जोड़ें, या उसका दाम repair charge में जोड़ दें।")}</p>}
          </div>}
          <label className="flex flex-wrap items-center gap-2 text-sm">{T("Repair charge ₹", "Repair charge ₹")}<FieldTip lang={lang} en="Your labour / service charge, apart from the parts. Parts come from stock (it reduces at once)." hi="आपकी मज़दूरी / service charge, parts के अलावा। Parts स्टॉक से आते हैं (स्टॉक तुरंत घटता है)।" />
            <input className={`${inp} w-28`} inputMode="decimal" value={labour} onChange={(e) => setLabour(e.target.value)} />
            {paiseOf(labour) !== job.labour_paise && <button type="button" disabled={!!busy} onClick={() => void act("update", { labour_paise: paiseOf(labour) })} className="rounded-lg border border-border px-2 py-1.5 text-xs font-semibold">{T("Save charge", "charge save")}</button>}</label>
        </>}
        {!open && job.labour_paise > 0 && <p className="flex justify-between text-sm"><span>{T("Repair charge", "Repair charge")}</span><b>{inr(job.labour_paise)}</b></p>}
        <div className="space-y-0.5 border-t border-border pt-2 text-sm">
          <p className="flex justify-between"><span>{T("Total", "कुल")}</span><b className="tabular-nums">{inr(t.total)}</b></p>
          <p className="flex justify-between"><span>Advance</span><b className="tabular-nums text-good">{inr(t.paid)}</b></p>
          {open && t.due >= 0 && <p className="flex justify-between"><span>{T("To take", "लेना बाकी")}</span><b className="tabular-nums text-danger">{inr(t.due)}</b></p>}
          {open && t.due < 0 && <p className="flex justify-between"><span>{T("Advance is more — give back to the customer", "Advance ज़्यादा है — ग्राहक को लौटाएँ")}</span><b className="tabular-nums text-amber-700">{inr(-t.due)}</b></p>}
          {can("cost") && t.cost > 0 && <p className="text-[12px] text-muted">{T("Cost of parts", "parts की लागत")}: {inr(t.cost)} · {T("only you see this", "ये सिर्फ़ आपको दिखता है")}</p>}
        </div>
        {open && <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted">{T("More advance", "और advance")}<FieldTip lang={lang} en="If the customer gives more money before the phone is ready. All advances come off the final bill." hi="अगर ग्राहक फ़ोन तैयार होने से पहले और पैसा दे। सारे advance आख़िरी बिल से घट जाते हैं।" />:</span>
          <input className={`${inp} w-24`} inputMode="decimal" placeholder="₹" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} />
          <select className={inp} value={adv.mode} onChange={(e) => setAdv({ ...adv, mode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select>
          <button type="button" disabled={!paiseOf(adv.amount) || !!busy} onClick={async () => { if (await act("advance", { payment: { mode: adv.mode, paise: paiseOf(adv.amount), ref: "" } })) setAdv({ amount: "", mode: "cash" }); }} className="rounded-lg border border-border px-2 py-2 text-xs font-semibold disabled:opacity-50">{T("Take", "लें")}</button>
        </div>}
        {!open && job.status !== "delivered" && t.paid > 0 && <div className="rounded-xl bg-amber-50 p-2 text-[13px] text-amber-900">{T(`An advance of ${inr(t.paid)} was taken. Give it back to the customer, then tap:`, `${inr(t.paid)} advance लिया था। ग्राहक को लौटाकर ये दबाएँ:`)} <button type="button" disabled={!!busy} onClick={() => void act("refund")} className="ml-1 rounded-lg border border-amber-400 bg-white px-2 py-1 text-xs font-semibold">{T("Advance returned", "Advance लौटा दिया")}</button></div>}
      </section>

      {open && can("bill") && (
        <section className="space-y-2 rounded-2xl border-2 border-brand/40 bg-surface p-3 print:hidden">
          {!give.open ? <button type="button" onClick={() => setGive({ open: true, amount: String(Math.max(0, t.due) / 100), mode: "cash" })} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white"><Check className="h-4 w-4" /> {T("Give the phone back & make the bill", "फ़ोन दें और बिल बनाएँ")}</button> : <>
            <p className="text-sm font-bold">{T("Bill", "बिल")}: {inr(t.total)} · Advance {inr(t.paid)} · {t.due < 0 ? <span className="text-amber-700">{T("give back", "लौटाएँ")} {inr(-t.due)}</span> : <>{T("to take", "लेना")} <span className="text-danger">{inr(t.due)}</span></>}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span>{T("Received now ₹", "अभी मिला ₹")}</span><FieldTip lang={lang} en="What the customer pays now. Less than the amount to take = the rest becomes udhaar on the bill." hi="ग्राहक अभी जो दे रहा है। लेने वाली रक़म से कम = बाकी बिल पर उधार बन जाएगा।" />
              <input className={`${inp} w-28`} inputMode="decimal" value={give.amount} onChange={(e) => setGive({ ...give, amount: e.target.value })} />
              <select className={inp} value={give.mode} onChange={(e) => setGive({ ...give, mode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={!!busy} onClick={async () => { const r = await act("deliver", { labour_paise: paiseOf(labour), payments: paiseOf(give.amount) ? [{ mode: give.mode, paise: paiseOf(give.amount), ref: "" }] : [] }); if (r?.billId) router.push(`/poster/mobile/bill/${r.billId}${asQ ? `${asQ}&` : "?"}new=1`); }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === "deliver" && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Make the bill", "बिल बनाएँ")}</button>
              <button type="button" onClick={() => setGive({ ...give, open: false })} className={btn}>{T("Back", "वापस")}</button>
            </div>
          </>}
        </section>
      )}

      {open && (
        <section className="space-y-2 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setClosing(closing === "return" ? "" : "return"); setReason(""); }} className={btn}><Undo2 className="h-4 w-4" /> {T("Return unrepaired", "बिना बने वापस")}</button>
            {can("cancel") && <button type="button" onClick={() => { setClosing(closing === "cancel" ? "" : "cancel"); setReason(""); }} className={`${btn} text-danger`}>{T("Cancel job", "job रद्द")}</button>}
          </div>
          {closing && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
            <input className={`${inp} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={closing === "return" ? T("Why? (e.g. customer said no to the cost)", "क्यों? (जैसे ग्राहक ने ख़र्च से मना किया)") : T("Why is it cancelled?", "क्यों रद्द कर रहे हैं?")} />
            <button type="button" disabled={!reason.trim() || !!busy} onClick={async () => { if (await act(closing, { reason })) setClosing(""); }} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{closing === "return" ? T("Return it", "वापस करें") : T("Cancel this job", "ये job रद्द करें")}</button>
            <p className="w-full text-[12px] text-muted">{T("Parts put on this job go back into stock.", "इस job पर लगे parts स्टॉक में वापस आ जाएँगे।")}</p>
          </div>}
        </section>
      )}

      <section className={card}>
        <p className="text-sm font-bold">{T("History", "अब तक")}<FieldTip lang={lang} en="Everything done on this job, with the time and who did it. Only your staff see this." hi="इस job पर जो-जो हुआ, समय और किसने किया उसके साथ। ये सिर्फ़ आपके staff को दिखता है।" /></p>
        <ul className="space-y-0.5 text-[12px] text-muted">{[...(job.events ?? [])].reverse().map((e, i) => <li key={i}>{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {e.text}{e.by ? ` · ${e.by}` : ""}</li>)}</ul>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-border bg-neutral-100 py-3 shadow-card print:border-0 print:bg-white print:py-0 print:shadow-none"><JobSlip job={job} setup={setup} shop={d.shop} /></div>
    </div>
  );
}

export default function JobPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><JobView /></Suspense>;
}
