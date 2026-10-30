// Orders & job cards (owner, 30 Oct 2026 — a saree showroom: sarees go to karigars for fall-pico, blouse stitching and
// alterations; measurements are noted in the app; every cloth given and taken back is recorded; the customer gets a
// WhatsApp update when it is ready; the owner sees the status of any garment at any time). Shared by the API and the UI.
// Tables: migration 0076_job_orders.sql (service role only — every route checks the owner / team role itself).

/* ---------------- the flow ----------------
 * Owner, 30 Oct 2026: the shop sets its own steps (Settings → Flow): Received → Cutting → Stitching → … → Ready → Delivered.
 * Each step can have its person (a staff login or a karigar): when a job reaches the step that person gets it in the app
 * (and a WhatsApp from the shop's number); at "Ready" the customer gets the WhatsApp. "received", "ready", "delivered" and
 * "cancelled" are fixed; the steps between are the shop's (keys a–z0–9_). Each item can use only some of them
 * (a saree for fall-pico goes only to the karigar). Migration 0077 lets job_orders.status hold the shop's own keys. */
export const FIXED = ["received", "ready", "delivered", "cancelled"] as const;
export type JobStatus = string;
export const STATUS_LABEL: Record<string, { en: string; hi: string; tone: string }> = {
  received:  { en: "Received",  hi: "आया",        tone: "bg-slate-100 text-slate-700" },
  cutting:   { en: "Cutting",   hi: "कटिंग",       tone: "bg-amber-100 text-amber-800" },
  stitching: { en: "Stitching", hi: "सिलाई",       tone: "bg-blue-100 text-blue-800" },
  finishing: { en: "Finishing", hi: "फ़िनिशिंग",     tone: "bg-violet-100 text-violet-800" },
  ready:     { en: "Ready",     hi: "तैयार",       tone: "bg-emerald-100 text-emerald-800" },
  delivered: { en: "Delivered", hi: "दे दिया",     tone: "bg-emerald-600 text-white" },
  cancelled: { en: "Cancelled", hi: "रद्द",        tone: "bg-red-100 text-red-700" },
};
const TONES = ["bg-amber-100 text-amber-800", "bg-blue-100 text-blue-800", "bg-violet-100 text-violet-800", "bg-pink-100 text-pink-800", "bg-cyan-100 text-cyan-800", "bg-orange-100 text-orange-800", "bg-lime-100 text-lime-800", "bg-indigo-100 text-indigo-800"];

/** A working step between Received and Ready. who: "a:<team row id>" (a staff login) or "k:<karigar id>", or "" (nobody fixed). */
export type FlowStep = { key: string; name: string; who: string };

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
/** The work each item usually needs — picked by itself when the item is chosen (it can be changed). */
const DEFAULT_WORK: Record<string, string> = { Saree: "Fall-pico", Dupatta: "Lace / Border", Blouse: "Stitching", Lehenga: "Stitching", "Suit / Salwar": "Stitching", Kurti: "Stitching", Gown: "Stitching", Petticoat: "Stitching" };
const DEFAULT_ITEM_STEPS: Record<string, string[]> = { Saree: ["karigar"], Dupatta: ["karigar"], Petticoat: ["cutting", "stitching"] };

/* ---------------- staff logins and their rights ---------------- */
export const RIGHTS = [
  { key: "book",     en: "Book new orders",                 hi: "नया order बुक करना" },
  { key: "measure",  en: "Take and change measurements",    hi: "नाप लेना और बदलना" },
  { key: "all_jobs", en: "See every order (not only theirs)", hi: "सारे order देखना (सिर्फ़ अपने नहीं)" },
  { key: "money",    en: "See charges and take payments",   hi: "Charge देखना और पैसे लेना" },
  { key: "edit",     en: "Change an order",                 hi: "Order बदलना" },
  { key: "assign",   en: "Give work to staff / karigars",   hi: "Staff / कारीगर को काम देना" },
  { key: "cancel",   en: "Cancel an order",                 hi: "Order रद्द करना" },
  { key: "setup",    en: "Change items, measurements and the flow", hi: "Item, नाप और flow बदलना" },
  { key: "staff",    en: "Add staff and give rights",       hi: "Staff जोड़ना और rights देना" },
] as const;
export type Right = (typeof RIGHTS)[number]["key"];
export const ALL_RIGHTS: Right[] = RIGHTS.map((r) => r.key);
/** Ready-made roles; the rights can be changed per person. */
export const ROLE_PRESETS: { title: string; hi: string; rights: Right[] }[] = [
  { title: "Admin",              hi: "Admin",              rights: ALL_RIGHTS },
  { title: "Counter / booking",  hi: "Counter / booking",  rights: ["book", "measure", "all_jobs", "money", "edit", "assign"] },
  { title: "Measurement master", hi: "नाप लेने वाले master", rights: ["book", "measure"] },
  { title: "Cutting master",     hi: "Cutting master",     rights: ["measure"] },
  { title: "Stitching tailor",   hi: "सिलाई वाले tailor",    rights: [] },
  { title: "Finishing / packing", hi: "Finishing / packing", rights: [] },
];
export type StaffAccess = { title: string; rights: Right[] };

/* ---------------- the shop's setup ---------------- */
/** The shop's own lists (owner, 30 Oct 2026: "kaise aur kya-kya measurement karna hai, wo account decide kare"): the items it
 *  takes with their measurement fields, usual work and steps; the kinds of work; the unit; the flow; the staff's rights.
 *  Kept in owner_prefs.crm.jobSetup; the defaults below until the shop changes them. */
export type ItemType = { name: string; fields: string[]; work?: string; steps?: string[] };
export type JobSetup = {
  items: ItemType[]; works: string[]; unit: "inch" | "cm";
  steps: FlowStep[];
  /** A booked order goes straight to the first step and its person is told. */
  autoStart: boolean;
  /** Rights per staff login, keyed by the team row id (crm_agents.id). */
  staff: Record<string, StaffAccess>;
};
export const DEFAULT_STEPS: FlowStep[] = [
  { key: "cutting", name: "Cutting", who: "" },
  { key: "stitching", name: "Stitching", who: "" },
  { key: "karigar", name: "With karigar", who: "" },
  { key: "finishing", name: "Finishing", who: "" },
];
export const DEFAULT_SETUP: JobSetup = {
  items: ITEM_PICKS.map((name) => ({ name, fields: MEASURE_FIELDS[name] ?? [], work: DEFAULT_WORK[name] ?? "", steps: DEFAULT_ITEM_STEPS[name] ?? ["cutting", "stitching", "finishing"] })),
  works: [...WORK_PICKS], unit: "inch", steps: DEFAULT_STEPS, autoStart: true, staff: {},
};
const nm = (v: unknown, n = 40) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const uniq = (xs: string[]) => { const seen = new Set<string>(); return xs.filter((x) => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };
/** A key for a new step's name ("Hand work" → "hand_work"), not one of the fixed ones or one in use. */
export function stepKey(name: string, used: string[]): string {
  const base = (name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24)) || "step";
  let k = base, i = 2;
  while ((FIXED as readonly string[]).includes(k) || used.includes(k)) k = `${base}_${i++}`;
  return k;
}
/** A setup from anything (the stored JSON, a request body): trimmed, de-duplicated, capped. Older setups get the new parts. */
export function cleanSetup(raw: unknown): JobSetup {
  const o = raw && typeof raw === "object" ? raw as Partial<Record<keyof JobSetup, unknown>> : null;
  if (!o || !Array.isArray(o.items)) return DEFAULT_SETUP;
  const steps: FlowStep[] = [];
  const src = Array.isArray(o.steps) ? o.steps : DEFAULT_STEPS;
  for (const st of src.slice(0, 20)) {
    const name = nm((st as FlowStep)?.name, 30); if (!name) continue;
    let key = String((st as FlowStep)?.key ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    if (!key || (FIXED as readonly string[]).includes(key) || steps.some((x) => x.key === key)) key = stepKey(name, steps.map((x) => x.key));
    const who = String((st as FlowStep)?.who ?? "");
    steps.push({ key, name, who: /^[ak]:[0-9a-f-]{36}$/i.test(who) ? who : "" });
  }
  const keys = steps.map((x) => x.key);
  const names = new Set<string>();
  const items: ItemType[] = [];
  for (const it of o.items.slice(0, 60)) {
    const x = it as ItemType;
    const name = nm(x?.name);
    if (!name || names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    const fields = Array.isArray(x.fields) ? uniq(x.fields.slice(0, 40).map((f) => nm(f, 30))) : [];
    const itemSteps = Array.isArray(x.steps) ? x.steps.filter((k) => keys.includes(k)) : undefined;
    items.push({ name, fields, work: nm(x.work ?? DEFAULT_WORK[name] ?? ""), ...(itemSteps ? { steps: itemSteps } : {}) });
  }
  const works = Array.isArray(o.works) ? uniq(o.works.slice(0, 60).map((w) => nm(w))) : DEFAULT_SETUP.works;
  const staff: Record<string, StaffAccess> = {};
  if (o.staff && typeof o.staff === "object") {
    for (const [id, v] of Object.entries(o.staff as Record<string, StaffAccess>).slice(0, 50)) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      staff[id] = { title: nm(v?.title, 40), rights: Array.isArray(v?.rights) ? v.rights.filter((r): r is Right => (ALL_RIGHTS as string[]).includes(r)) : [] };
    }
  }
  return { items, works, unit: o.unit === "cm" ? "cm" : "inch", steps, autoStart: o.autoStart !== false, staff };
}
export const itemTypeOf = (s: JobSetup, item: string) => s.items.find((i) => i.name.toLowerCase() === item.trim().toLowerCase()) ?? null;
export const fieldsFor = (s: JobSetup, item: string) => itemTypeOf(s, item)?.fields ?? [];
export const workFor = (s: JobSetup, item: string) => itemTypeOf(s, item)?.work ?? "";

/** A job's whole flow: received → its item's steps (all the shop's steps when the item has none set) → ready → delivered. */
export function flowFor(s: JobSetup, item: string, current?: string): string[] {
  const it = itemTypeOf(s, item);
  const mid = (it?.steps ?? s.steps.map((x) => x.key)).filter((k) => s.steps.some((x) => x.key === k));
  // A job already on a step that was later taken out of the item's flow still shows it.
  if (current && !(FIXED as readonly string[]).includes(current) && !mid.includes(current) && s.steps.some((x) => x.key === current)) mid.unshift(current);
  return ["received", ...mid, "ready", "delivered"];
}
export function nextStep(flow: string[], status: string): string | null {
  const i = flow.indexOf(status);
  return status !== "cancelled" && i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}
export function stepLabel(s: JobSetup | null | undefined, key: string, hi: boolean): string {
  const st = s?.steps.find((x) => x.key === key);
  if (st) return hi && STATUS_LABEL[key] && st.name === STATUS_LABEL[key].en ? STATUS_LABEL[key].hi : st.name;
  const f = STATUS_LABEL[key];
  return f ? (hi ? f.hi : f.en) : key.replace(/_/g, " ");
}
export function stepTone(s: JobSetup | null | undefined, key: string): string {
  if (STATUS_LABEL[key] && (FIXED as readonly string[]).includes(key)) return STATUS_LABEL[key].tone;
  const i = s?.steps.findIndex((x) => x.key === key) ?? -1;
  return i >= 0 ? TONES[i % TONES.length] : STATUS_LABEL[key]?.tone ?? "bg-slate-100 text-slate-700";
}
/** A step's status is valid for this shop: a fixed one or one of its steps. */
export const isStatus = (s: JobSetup, key: unknown): key is string => typeof key === "string" && ((FIXED as readonly string[]).includes(key) || s.steps.some((x) => x.key === key));

/** What the person may do in this shop's Orders (sent to the app with every answer). */
export type JobAccess = { title: string; rights: Right[]; agentId: string | null; owner: boolean };
export const can = (a: Pick<JobAccess, "rights"> | null | undefined, r: Right) => !!a?.rights.includes(r);

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
