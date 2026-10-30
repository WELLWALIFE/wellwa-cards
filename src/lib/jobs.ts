// Orders & job cards (owner, 30 Oct 2026 — a saree showroom: sarees go to karigars for fall-pico, blouse stitching and
// alterations; measurements are noted in the app; every cloth given and taken back is recorded; the customer gets a
// WhatsApp update when it is ready; the owner sees the status of any garment at any time). Shared by the API and the UI.
// Tables: migration 0076_job_orders.sql (service role only — every route checks the owner / team role itself).

export const JOB_STATUSES = ["received", "cutting", "stitching", "finishing", "ready", "delivered", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABEL: Record<JobStatus, { en: string; hi: string; tone: string }> = {
  received:  { en: "Received",  hi: "आया",        tone: "bg-slate-100 text-slate-700" },
  cutting:   { en: "Cutting",   hi: "कटिंग",       tone: "bg-amber-100 text-amber-800" },
  stitching: { en: "Stitching", hi: "सिलाई",       tone: "bg-blue-100 text-blue-800" },
  finishing: { en: "Finishing", hi: "फ़िनिशिंग",     tone: "bg-violet-100 text-violet-800" },
  ready:     { en: "Ready",     hi: "तैयार",       tone: "bg-emerald-100 text-emerald-800" },
  delivered: { en: "Delivered", hi: "दे दिया",     tone: "bg-emerald-600 text-white" },
  cancelled: { en: "Cancelled", hi: "रद्द",        tone: "bg-red-100 text-red-700" },
};
/** The working steps, in order (cancelled is not a step). */
export const FLOW: JobStatus[] = ["received", "cutting", "stitching", "finishing", "ready", "delivered"];

/** Quick picks for a saree / boutique shop; anything can still be typed. */
export const ITEM_PICKS = ["Saree", "Blouse", "Lehenga", "Suit / Salwar", "Kurti", "Dupatta", "Gown", "Petticoat"];
export const WORK_PICKS = ["Fall-pico", "Stitching", "Alteration", "Embroidery", "Lace / Border", "Tassels / Latkan", "Pre-pleating", "Dyeing"];

/** Measurement fields per garment (the tailor fills what applies; extra notes go in "notes"). */
export const MEASURE_FIELDS: Record<string, string[]> = {
  Blouse:   ["Length", "Shoulder", "Upper bust", "Bust", "Under bust", "Waist", "Armhole", "Sleeve length", "Sleeve round", "Front neck", "Back neck", "Apex"],
  Kurti:    ["Length", "Shoulder", "Bust", "Waist", "Hip", "Armhole", "Sleeve length", "Sleeve round", "Front neck", "Back neck"],
  "Suit / Salwar": ["Kameez length", "Shoulder", "Bust", "Waist", "Hip", "Armhole", "Sleeve length", "Sleeve round", "Front neck", "Bottom length", "Bottom waist", "Bottom hip", "Mohri"],
  Lehenga:  ["Length", "Waist", "Hip", "Flare / Ghera"],
  Petticoat:["Length", "Waist"],
  Gown:     ["Length", "Shoulder", "Bust", "Waist", "Hip", "Armhole", "Sleeve length", "Front neck", "Back neck"],
};
export const MEASURE_GARMENTS = Object.keys(MEASURE_FIELDS);

/** The shop's own lists (owner, 30 Oct 2026: "kaise aur kya-kya measurement karna hai, wo account decide kare"): the items it
 *  takes, the measurement fields of each (none = no measurement, e.g. Saree fall-pico), the kinds of work, and the unit.
 *  Kept in owner_prefs.crm.jobSetup; the defaults below until the shop changes them (Orders → Setup, or "+ New" while booking). */
export type ItemType = { name: string; fields: string[] };
export type JobSetup = { items: ItemType[]; works: string[]; unit: "inch" | "cm" };
export const DEFAULT_SETUP: JobSetup = {
  items: ITEM_PICKS.map((name) => ({ name, fields: MEASURE_FIELDS[name] ?? [] })),
  works: [...WORK_PICKS],
  unit: "inch",
};
const nm = (v: unknown, n = 40) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const uniq = (xs: string[]) => { const seen = new Set<string>(); return xs.filter((x) => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };
/** A setup from anything (the stored JSON, a request body): trimmed, de-duplicated, capped. */
export function cleanSetup(raw: unknown): JobSetup {
  const o = raw && typeof raw === "object" ? raw as Partial<Record<keyof JobSetup, unknown>> : null;
  if (!o || !Array.isArray(o.items)) return DEFAULT_SETUP;
  const names = new Set<string>();
  const items: ItemType[] = [];
  for (const it of o.items.slice(0, 60)) {
    const name = nm((it as ItemType)?.name);
    if (!name || names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    const fields = Array.isArray((it as ItemType).fields) ? uniq((it as ItemType).fields.slice(0, 40).map((f) => nm(f, 30))) : [];
    items.push({ name, fields });
  }
  const works = Array.isArray(o.works) ? uniq(o.works.slice(0, 60).map((w) => nm(w))) : DEFAULT_SETUP.works;
  return { items, works, unit: o.unit === "cm" ? "cm" : "inch" };
}
export const itemTypeOf = (s: JobSetup, item: string) => s.items.find((i) => i.name.toLowerCase() === item.trim().toLowerCase()) ?? null;
export const fieldsFor = (s: JobSetup, item: string) => itemTypeOf(s, item)?.fields ?? [];

export type JobRow = {
  id: string; owner_id: string; number: number; order_ref: string;
  customer_name: string; customer_phone: string; item: string; work: string; details: string;
  measurement_id: string | null; qty: number; status: JobStatus;
  karigar_id: string | null; assigned_to: string | null; due_date: string | null;
  amount_paise: number; advance_paise: number; photos: string[];
  created_by: string | null; notified_at: string | null; delivered_at: string | null; created_at: string; updated_at: string;
};
export const JOB_COLS = "id,owner_id,number,order_ref,customer_name,customer_phone,item,work,details,measurement_id,qty,status,karigar_id,assigned_to,due_date,amount_paise,advance_paise,photos,created_by,notified_at,delivered_at,created_at,updated_at";

export type JobEvent = {
  id: string; job_id: string; kind: "created" | "status" | "assign" | "cloth_out" | "cloth_in" | "payment" | "note" | "notify";
  status: string; karigar_id: string | null; karigar: string; pieces: number | null; meters: number | null;
  amount_paise: number | null; note: string; by_name: string; at: string;
};
export type Karigar = { id: string; name: string; phone: string; skill: string; active: boolean };
export type Measurement = { id: string; customer_phone: string; customer_name: string; garment: string; unit: "inch" | "cm"; values: Record<string, string>; notes: string; taken_by_name: string; created_at: string };

/** +91XXXXXXXXXX from anything a person types; "" when it is not an Indian mobile. */
export function cleanPhone(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? `+91${ten}` : "";
}
export const rupees = (paise: number) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;
export const toPaise = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };

/** The order slip the customer gets on WhatsApp when the order is booked (sent by the person from their phone). */
export function receiptMessage(jobs: Pick<JobRow, "customer_name" | "item" | "work" | "number" | "qty" | "amount_paise" | "advance_paise" | "due_date">[], shop: string): string {
  if (!jobs.length) return "";
  const lines = jobs.map((j) => `• #${j.number} ${[j.item, j.work].filter(Boolean).join(" · ")}${j.qty > 1 ? ` × ${j.qty}` : ""}${j.amount_paise ? ` — ${rupees(j.amount_paise)}` : ""}`);
  const total = jobs.reduce((a, j) => a + (j.amount_paise || 0), 0), adv = jobs.reduce((a, j) => a + (j.advance_paise || 0), 0);
  const due = jobs.map((j) => j.due_date).filter(Boolean).sort()[0];
  return [
    `नमस्ते ${jobs[0].customer_name || "जी"} 🙏`, `${shop || "हमारी दुकान"} में आपका order बुक हो गया है:`, ...lines,
    total ? `कुल: ${rupees(total)}${adv ? ` · Advance: ${rupees(adv)} · बाकी: ${rupees(Math.max(0, total - adv))}` : ""}` : "",
    due ? `देने की तारीख: ${new Date(`${due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "",
    "तैयार होते ही हम आपको WhatsApp पर बताएँगे। धन्यवाद!",
  ].filter(Boolean).join("\n");
}

/** The customer's "ready" message. */
export function readyMessage(job: Pick<JobRow, "customer_name" | "item" | "work" | "number" | "amount_paise" | "advance_paise">, shop: string): string {
  const due = Math.max(0, (job.amount_paise || 0) - (job.advance_paise || 0));
  const what = [job.item, job.work].filter(Boolean).join(" · ") || "order";
  return `नमस्ते ${job.customer_name || "जी"} 🙏\nआपका ${what} (Job #${job.number}) तैयार है। आप ${shop || "दुकान"} से ले सकते हैं।${due > 0 ? `\nबाकी राशि: ${rupees(due)}` : ""}\nधन्यवाद!`;
}
