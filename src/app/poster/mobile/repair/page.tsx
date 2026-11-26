"use client";
// New repair job: the phone comes in. What is wrong, how it looks, what came with it, the estimate and the advance — then the
// customer gets a slip and a WhatsApp with a link to follow the repair.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, MessageCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { paiseOf, type Payment } from "@/lib/jewellery";
import { CONDITIONS, JOB_PHOTOS, PROBLEMS, type JobRow } from "@/lib/mobile-repair";
import { PhotoPicker, SignPad, uploadSignature } from "@/components/mobile/job-proof";
import { MsHelp } from "@/components/mobile/page-help";

type Staff = { id: string; name: string };

export default function NewJob() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [staff, setStaff] = useState<Staff[]>([]);
  const [f, setF] = useState({ name: "", phone: "", device: "", imei: "", problems: [] as string[], problem_note: "", condition: [] as string[], accessories: "", lock_code: "", est: "", adv: "", advMode: "cash" as Payment["mode"], due: "", tech: "", notes: "" });
  const [busy, setBusy] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [signed, setSigned] = useState(false);
  const pad = useRef<HTMLCanvasElement | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ staff?: Staff[] }>(`/api/mobile/setup${asQ}`).catch(() => null);
    if (r?.ok) setStaff(r.data.staff ?? []);
  }, [asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const flip = (k: "problems" | "condition", v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  async function save(send: boolean) {
    setNote("");
    const phone = f.phone.replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) { setNote(T("Type the customer's 10-digit mobile.", "ग्राहक का 10 अंकों का मोबाइल लिखें।")); return; }
    if (!f.device.trim()) { setNote(T("Type the phone's model.", "फ़ोन का model लिखें।")); return; }
    if (!f.problems.length && !f.problem_note.trim()) { setNote(T("Pick or write the problem.", "ख़राबी चुनें या लिखें।")); return; }
    setBusy(send ? "send" : "save");
    let signature = "";
    if (signed) { signature = (await uploadSignature(pad.current)) ?? ""; if (!signature) { setBusy(""); setNote(T("The signature did not upload. Check the internet and try again.", "Signature upload नहीं हुआ। इंटरनेट देखकर फिर करें।")); return; } }
    let store = "";
    try { store = localStorage.getItem("shubhora.ms-store") ?? ""; } catch { /* ignore */ }
    try {
      const r = await api<{ job?: JobRow; sent?: { sent?: boolean } | null; error?: string }>("/api/mobile/jobs", { method: "POST", json: {
        as: ws.as || undefined, customer_name: f.name, customer_phone: phone, device: f.device, imei: f.imei, problems: f.problems, problem_note: f.problem_note, condition: f.condition,
        accessories: f.accessories, lock_code: f.lock_code, est_paise: paiseOf(f.est), advance: paiseOf(f.adv) ? { mode: f.advMode, paise: paiseOf(f.adv), ref: "" } : undefined,
        due_date: f.due || undefined, tech_id: f.tech || undefined, notes: f.notes, send, photos, signature, store } });
      setBusy("");
      if (!r.ok || !r.data.job) { setNote(r.data?.error || T("Could not save.", "Save नहीं हुआ।")); return; }
      router.push(`/poster/mobile/repair/${r.data.job.id}${asQ ? `${asQ}&` : "?"}new=${send ? (r.data.sent?.sent ? "sent" : "notsent") : "1"}`);
    } catch { setBusy(""); setNote(T("No internet. A repair job needs the network.", "इंटरनेट नहीं है। रिपेयर job के लिए नेटवर्क चाहिए।")); }
  }

  const inp = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm";
  const lab = "block text-[12px] font-semibold text-muted";
  const card = "grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2";
  const chip = (on: boolean) => `rounded-xl border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-brand bg-brand text-white" : "border-border bg-surface"}`;
  const tip = (en: string, h: string) => <FieldTip lang={lang} en={en} hi={h} />;
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile/repairs${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Repair jobs", "रिपेयर jobs")}</Link>
      <h1 className="text-lg font-bold">🔧 {T("New repair job", "नया रिपेयर job")}</h1>
      <MsHelp k="repairNew" />

      <section className={card}>
        <label className={lab}>{T("Customer's mobile", "ग्राहक का मोबाइल")}{tip("The 'received' and 'ready' messages go to this number on WhatsApp.", "'जमा' और 'तैयार' के message इसी नंबर पर WhatsApp से जाते हैं।")}<input className={inp} inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="10 digits" /></label>
        <label className={lab}>{T("Customer name", "ग्राहक का नाम")}<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className={lab}>{T("Phone model", "फ़ोन का model")}{tip("Brand, model and colour, e.g. 'Redmi Note 13 Pro blue'.", "Brand, model और रंग, जैसे 'Redmi Note 13 Pro blue'।")}<input className={inp} value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })} placeholder="Vivo Y28 black" /></label>
        <label className={lab}>IMEI <span className="font-normal">(optional)</span>{tip("Dial *#06# on the phone to see it, or read the SIM tray / box. It proves which phone came in.", "फ़ोन पर *#06# दबाने से दिखता है, या SIM tray / डिब्बे पर। इससे पक्का रहता है कौन-सा फ़ोन आया था।")}<input className={`${inp} font-mono`} inputMode="numeric" value={f.imei} onChange={(e) => setF({ ...f, imei: e.target.value })} /></label>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-3">
        <div><span className={lab}>{T("What is wrong?", "क्या ख़राबी है?")}{tip("Tap all that apply. Write anything else in the box below.", "जो-जो हो सब दबाएँ। बाकी नीचे के box में लिखें।")}</span>
          <div className="mt-1 flex flex-wrap gap-1.5">{PROBLEMS.filter((p) => p.key !== "other").map((p) => <button key={p.key} type="button" onClick={() => flip("problems", p.key)} className={chip(f.problems.includes(p.key))}>{hi ? p.hi : p.en}</button>)}</div>
          <input className={inp} value={f.problem_note} onChange={(e) => setF({ ...f, problem_note: e.target.value })} placeholder={T("In the customer's words (optional)", "ग्राहक के शब्दों में (optional)")} /></div>
        <div><span className={lab}>{T("How the phone looks now", "फ़ोन अभी कैसा है")}{tip("Note scratches, cracks, SIM or memory card inside — in front of the customer. It is printed on the slip, so nobody can argue later.", "खरोंच, दरार, SIM या मेमोरी कार्ड अंदर है — ग्राहक के सामने नोट करें। ये पर्ची पर छपता है, बाद में बहस नहीं होती।")}</span>
          <div className="mt-1 flex flex-wrap gap-1.5">{CONDITIONS.map((p) => <button key={p.key} type="button" onClick={() => flip("condition", p.key)} className={chip(f.condition.includes(p.key))}>{hi ? p.hi : p.en}</button>)}</div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lab}>{T("Came with it", "साथ में क्या आया")} <span className="font-normal">(optional)</span><input className={inp} value={f.accessories} onChange={(e) => setF({ ...f, accessories: e.target.value })} placeholder={T("Charger, box…", "चार्जर, डिब्बा…")} /></label>
          <label className={lab}>{T("Lock PIN / pattern", "Lock PIN / pattern")} <span className="font-normal">(optional)</span>{tip("Only if the customer gives it, to test the phone after repair. Only your staff see it — it is never printed or shown on the customer's link.", "तभी जब ग्राहक दे, रिपेयर के बाद फ़ोन जाँचने के लिए। सिर्फ़ आपके staff को दिखता है — न छपता है, न ग्राहक के लिंक पर दिखता है।")}<input className={inp} value={f.lock_code} onChange={(e) => setF({ ...f, lock_code: e.target.value })} /></label>
        </div>
      </section>

      <section className={card}>
        <label className={lab}>{T("Estimate ₹", "अंदाज़न ख़र्च ₹")} <span className="font-normal">(optional)</span>{tip("Your rough guess for the customer. The real charge is set when the work is done.", "ग्राहक को बताने के लिए मोटा अंदाज़। असली charge काम होने पर तय होता है।")}<input className={inp} inputMode="decimal" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })} /></label>
        <label className={lab}>{T("Ready by", "कब तक तैयार")} <span className="font-normal">(optional)</span><input type="date" className={inp} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        <label className={lab}>{T("Advance ₹", "Advance ₹")} <span className="font-normal">(optional)</span>{tip("Money taken now. It comes off the bill when the phone is given back.", "अभी लिया पैसा। फ़ोन देते समय बिल से घट जाता है।")}
          <span className="mt-1 flex gap-2"><input className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm" inputMode="decimal" value={f.adv} onChange={(e) => setF({ ...f, adv: e.target.value })} /><select className="rounded-xl border border-border bg-surface px-2 text-sm" value={f.advMode} onChange={(e) => setF({ ...f, advMode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></span></label>
        {staff.length > 0 && <label className={lab}>{T("Technician", "Technician")} <span className="font-normal">(optional)</span><select className={inp} value={f.tech} onChange={(e) => setF({ ...f, tech: e.target.value })}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <label className={`${lab} sm:col-span-2`}>{T("Note for the shop", "दुकान के लिए नोट")} <span className="font-normal">(optional)</span>{tip("Only your staff see this.", "ये सिर्फ़ आपके staff को दिखता है।")}<input className={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-3">
        <div><span className={lab}>{T("Photos of the phone", "फ़ोन की photo")} <span className="font-normal">(optional)</span>{tip("Front, back and any damage — taken in front of the customer. They stay on the job as your proof.", "आगे, पीछे और जहाँ टूटा-फूटा हो — ग्राहक के सामने लें। ये job पर आपके सबूत के रूप में रहती हैं।")}</span>
          <div className="mt-1"><PhotoPicker photos={photos} setPhotos={setPhotos} max={JOB_PHOTOS} hi={hi} /></div></div>
        <div><span className={lab}>{T("Customer's signature", "ग्राहक के signature")} <span className="font-normal">(optional)</span>{tip("The customer signs that the phone's condition and the terms are right. It prints on the job slip.", "ग्राहक sign करता है कि फ़ोन की हालत और शर्तें सही हैं। ये job पर्ची पर छपता है।")}</span>
          <div className="mt-1"><SignPad padRef={pad} onChange={setSigned} hi={hi} /></div></div>
      </section>

      {note && <p className="text-sm font-semibold text-danger">{note}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!!busy} onClick={() => void save(false)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-bold disabled:opacity-50">{busy === "save" && <LoaderCircle className="h-4 w-4 animate-spin" />} Save</button>
        <button type="button" disabled={!!busy} onClick={() => void save(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Save &amp; WhatsApp</button>
      </div>
    </div>
  );
}
