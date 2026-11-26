// Shubhora Mobile Shop — repair job cards, the shared pure part (owner, 23 Nov 2026: phase 2 of the plan
// https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd; repair is the main work of a small-town mobile shop).
// A job: the customer's phone comes in (problem, condition, what came with it, estimate, advance) → work → ready → given back
// with a bill made from the parts used and the repair charge. Money in PAISE. Tested in mobile-repair.test.mjs.
import type { Payment } from "@/lib/jewellery";
import type { BillLine } from "@/lib/mobile";

export type JobStatus = "received" | "repairing" | "waiting" | "ready" | "delivered" | "returned" | "cancelled";
export const JOB_STATUSES: { key: JobStatus; en: string; hi: string; tone: string }[] = [
  { key: "received", en: "Received", hi: "जमा", tone: "bg-sky-100 text-sky-800" },
  { key: "repairing", en: "Being repaired", hi: "काम चालू", tone: "bg-indigo-100 text-indigo-800" },
  { key: "waiting", en: "Waiting for part", hi: "पार्ट का इंतज़ार", tone: "bg-amber-100 text-amber-800" },
  { key: "ready", en: "Ready", hi: "तैयार", tone: "bg-emerald-100 text-emerald-800" },
  { key: "delivered", en: "Given back", hi: "दे दिया", tone: "bg-neutral-200 text-neutral-700" },
  { key: "returned", en: "Returned, not repaired", hi: "बिना बने वापस", tone: "bg-neutral-200 text-neutral-700" },
  { key: "cancelled", en: "Cancelled", hi: "रद्द", tone: "bg-red-100 text-red-700" },
];
export const jobStatus = (k: string) => JOB_STATUSES.find((s) => s.key === k) ?? JOB_STATUSES[0];
/** Still in the shop: work may go on. */
export const jobOpen = (s: JobStatus) => s === "received" || s === "repairing" || s === "waiting" || s === "ready";

export const PROBLEMS: { key: string; en: string; hi: string }[] = [
  { key: "display", en: "Display broken", hi: "डिस्प्ले टूटी" },
  { key: "touch", en: "Touch not working", hi: "टच नहीं चल रहा" },
  { key: "battery", en: "Battery", hi: "बैटरी" },
  { key: "charging", en: "Not charging", hi: "चार्ज नहीं हो रहा" },
  { key: "dead", en: "Dead / not switching on", hi: "बंद / चालू नहीं हो रहा" },
  { key: "water", en: "Water damage", hi: "पानी में गिरा" },
  { key: "speaker", en: "Speaker / ringer", hi: "स्पीकर / रिंगर" },
  { key: "mic", en: "Mic", hi: "माइक" },
  { key: "camera", en: "Camera", hi: "कैमरा" },
  { key: "network", en: "Network / SIM", hi: "नेटवर्क / SIM" },
  { key: "software", en: "Software / hang", hi: "सॉफ़्टवेयर / हैंग" },
  { key: "button", en: "Buttons", hi: "बटन" },
  { key: "back", en: "Back glass / body", hi: "बैक ग्लास / बॉडी" },
  { key: "other", en: "Other", hi: "अन्य" },
];
/** What the counter notes when the phone comes in — it stops "it was not scratched before" arguments. */
export const CONDITIONS: { key: string; en: string; hi: string }[] = [
  { key: "scratch", en: "Scratches", hi: "खरोंचें" },
  { key: "crack", en: "Cracked screen", hi: "स्क्रीन में दरार" },
  { key: "backcrack", en: "Back broken", hi: "बैक टूटा" },
  { key: "dent", en: "Dent / bent", hi: "दबा / मुड़ा" },
  { key: "nopower", en: "Does not switch on", hi: "चालू नहीं होता" },
  { key: "sim", en: "SIM inside", hi: "SIM अंदर है" },
  { key: "memory", en: "Memory card inside", hi: "मेमोरी कार्ड अंदर है" },
  { key: "cover", en: "With cover", hi: "कवर साथ है" },
];

export type JobPart = { itemId: string; name: string; qty: number; /** price of one, tax included */ price: number; /** cost of one, never shown to the customer */ cost: number };
export type JobEvent = { at: string; by: string; text: string };
export type JobRow = {
  id: string; owner_id: string; number: number; fin_year: string; code: string; status: JobStatus;
  customer_name: string; customer_phone: string; device: string; imei: string;
  problems: string[]; problem_note: string; condition: string[]; accessories: string; lock_code: string;
  est_paise: number; labour_paise: number; parts: JobPart[]; payments: Payment[];
  due_date: string | null; tech_id: string | null; tech_name: string; notes: string; events: JobEvent[];
  bill_id: string | null; warranty_days: number; token: string;
  created_by: string | null; created_by_name: string; cancel_reason: string; delivered_at: string | null; created_at: string; updated_at: string;
  /** photos of the phone when it came in, the customer's signature (links to the app's storage), and the branch ("" = main shop) */
  photos: string[]; signature: string; store: string;
};
export const JOB_COLS = "id,owner_id,number,fin_year,code,status,customer_name,customer_phone,device,imei,problems,problem_note,condition,accessories,lock_code,est_paise,labour_paise,parts,payments,due_date,tech_id,tech_name,notes,events,bill_id,warranty_days,token,created_by,created_by_name,cancel_reason,delivered_at,created_at,updated_at,photos,signature,store";
/** At most this many photos on a job. */
export const JOB_PHOTOS = 6;

const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const keys = (v: unknown, of: { key: string }[]) => [...new Set((Array.isArray(v) ? v : []).filter((k): k is string => typeof k === "string" && of.some((o) => o.key === k)))];

/** What the counter may type on a job (new or changed). Money is in paise. */
export function cleanJobFields(b: Record<string, unknown>) {
  return {
    customer_name: txt(b.customer_name, 80), device: txt(b.device, 80), imei: String(b.imei ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
    problems: keys(b.problems, PROBLEMS), problem_note: txt(b.problem_note, 300), condition: keys(b.condition, CONDITIONS),
    accessories: txt(b.accessories, 120), lock_code: txt(b.lock_code, 40), est_paise: int(b.est_paise, 0, 1e10, 0),
    due_date: typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null, notes: txt(b.notes, 300),
  };
}

export type JobTotals = { parts: number; labour: number; total: number; paid: number; due: number; cost: number };
/** The job's money: parts used + the repair charge; what came as advance; what is left. */
export function jobTotals(j: Pick<JobRow, "parts" | "labour_paise" | "payments">): JobTotals {
  const parts = (j.parts ?? []).reduce((a, p) => a + p.qty * p.price, 0);
  const cost = (j.parts ?? []).reduce((a, p) => a + p.qty * (p.cost || 0), 0);
  const labour = Math.max(0, j.labour_paise || 0);
  const paid = (j.payments ?? []).reduce((a, p) => a + Math.max(0, p.paise), 0);
  return { parts, labour, total: parts + labour, paid, due: parts + labour - paid, cost };
}

const names = (ks: string[], of: { key: string; en: string; hi: string }[], hi: boolean) => ks.map((k) => { const o = of.find((x) => x.key === k); return o ? (hi ? o.hi : o.en) : ""; }).filter(Boolean);
export const problemText = (j: Pick<JobRow, "problems" | "problem_note">, hi = false) => [...names(j.problems ?? [], PROBLEMS.filter((p) => p.key !== "other"), hi), j.problem_note].filter(Boolean).join(", ");
export const conditionText = (j: Pick<JobRow, "condition">, hi = false) => names(j.condition ?? [], CONDITIONS, hi).join(", ");

/** The bill made when the phone is given back: one line per part, and one for the repair work. */
export function jobBillLines(j: Pick<JobRow, "parts" | "labour_paise" | "device" | "problems" | "problem_note" | "code">): BillLine[] {
  const base = { hsn: "", discount: 0, gstBp: 1800, imei: "", unitId: "", warrantyMonths: 0, cost: 0 };
  const out: BillLine[] = (j.parts ?? []).map((p) => ({ ...base, itemId: p.itemId, name: p.name, qty: p.qty, price: p.price }));
  if (j.labour_paise > 0 || !out.length) out.push({ ...base, itemId: "", name: `Repair: ${[j.device, problemText(j)].filter(Boolean).join(" — ")}`.slice(0, 120), hsn: "9987", qty: 1, price: Math.max(0, j.labour_paise) });
  return out;
}

/** The job without what the customer must not see — for the tracking link. */
export function publicJob(j: JobRow): JobRow {
  return { ...j, lock_code: "", notes: "", tech_id: null, created_by: null, parts: (j.parts ?? []).map((p) => ({ ...p, cost: 0 })), events: (j.events ?? []).map((e) => ({ ...e, by: "" })) };
}

export type JobNote = "received" | "ready" | "status";
export function jobMessage(j: Pick<JobRow, "code" | "customer_name" | "device" | "status" | "est_paise" | "parts" | "labour_paise" | "payments">, shop: string, link: string, what: JobNote, hi = true): string {
  const rs = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  const name = j.customer_name?.trim() ? (hi ? `${j.customer_name.trim()} जी` : j.customer_name.trim()) : "";
  const t = jobTotals(j);
  const dev = j.device || (hi ? "फ़ोन" : "phone");
  if (what === "received") return (hi
    ? [`नमस्ते ${name} 🙏`, `${shop} में आपका ${dev} रिपेयर के लिए जमा हुआ।`, `Job नंबर: ${j.code}`, j.est_paise ? `अंदाज़न ख़र्च: ${rs(j.est_paise)}` : "", t.paid ? `Advance मिला: ${rs(t.paid)}` : "", `Status देखें: ${link}`]
    : [`Hello ${name} 🙏`, `Your ${dev} is received for repair at ${shop}.`, `Job no: ${j.code}`, j.est_paise ? `Estimate: ${rs(j.est_paise)}` : "", t.paid ? `Advance received: ${rs(t.paid)}` : "", `Track it: ${link}`]).filter(Boolean).join("\n");
  if (what === "ready") return (hi
    ? [`नमस्ते ${name} 🙏`, `आपका ${dev} तैयार है ✅ (${j.code})`, t.total ? `कुल: ${rs(t.total)}${t.paid ? ` · Advance: ${rs(t.paid)} · बाकी: ${rs(Math.max(0, t.due))}` : ""}` : "", `${shop} से ले जाएँ।`, link]
    : [`Hello ${name} 🙏`, `Your ${dev} is ready ✅ (${j.code})`, t.total ? `Total: ${rs(t.total)}${t.paid ? ` · Advance: ${rs(t.paid)} · To pay: ${rs(Math.max(0, t.due))}` : ""}` : "", `Please collect it from ${shop}.`, link]).filter(Boolean).join("\n");
  const st = jobStatus(j.status);
  return hi ? [`नमस्ते ${name} 🙏`, `${dev} (${j.code}) — ${st.hi}`, `देखें: ${link}`].join("\n") : [`Hello ${name} 🙏`, `${dev} (${j.code}) — ${st.en}`, `See: ${link}`].join("\n");
}

/** Open jobs past their promised day (India date "YYYY-MM-DD"). */
export const jobLate = (j: Pick<JobRow, "status" | "due_date">, today: string) => jobOpen(j.status) && j.status !== "ready" && !!j.due_date && j.due_date < today;
