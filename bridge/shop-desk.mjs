// The shop's own counter on WhatsApp (owner, 26 Nov 2026 — "number 1 chatbot" list, phase 1): what no outside chatbot tool can
// answer, because only this app holds the shop's data. A customer asks and the bot answers from the shop's books:
//   status — "mera phone ban gaya?" / a job number → the repair (Mobile shop), the tailoring job (Orders) or the jewellery order
//   due    — "mera kitna baki hai?" → what they owe, bill by bill, with the bill link (it carries the UPI QR)
//   bill   — "bill bhej do" → their latest bill's link
//   book   — an appointment: pick a day, pick a free hour, booked on the owner's calendar
// The customer is known by the number they write from; a job number typed from another phone gets the status only (no money,
// no link). Free text is answered here only when the books have something for this number — otherwise the AI answers as before.
// Pure but for `rest` (a Supabase REST read handed in), so it is tested in shop-desk.test.mjs.

const rs = (p) => `₹${Math.round((Number(p) || 0) / 100).toLocaleString("en-IN")}`;
const IST = 5.5 * 3600 * 1000;
const dayOf = (ts) => new Date(ts + IST).toISOString().slice(0, 10);
const niceDay = (ymd) => new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const ten = (phone) => String(phone ?? "").replace(/\D/g, "").slice(-10);
const enc = encodeURIComponent;

/* ---------------- what is being asked ---------------- */

const STATUS_RE = /\b(status|ban\s*gaya|ban\s*gay[ia]|bana\s*kya|ready\s*(hai|hua|ho\s*gaya|kya)|taiyaa?r|kab\s*(tak\s*)?(milega|milegi|banega|ready|taiyar|hoga)|repair\s*(ho\s*gaya|hua|ka\s*kya|status)|mer[ai]\s*(phone|mobile|order|suit|blouse|kapd[ae]|ring|chain|silai))\b|स्टेटस|बन\s*गया|बन\s*गई|बना\s*क्या|तैयार|कब\s*(तक\s*)?(मिलेगा|मिलेगी|बनेगा|होगा)|रिपेयर\s*(हो\s*गया|हुआ|का\s*क्या)|मेर[ाी]\s*(फ़ोन|फोन|मोबाइल|ऑर्डर|सूट|ब्लाउज|कपड़े|सिलाई)/i;
const DUE_RE = /\b(kitn[ae]\s*(paise?\s*)?(baa?ki|udhaa?r|dene|dena|bakaya)|(baa?ki|udhaa?r|bakaya)\s*(kitn[ae]|hai\s*kya|batao|bata\s*do)|mera\s*(baa?ki|udhaa?r|hisaa?b|balance)|balance\s*(kitna|batao|due)|due\s*amount|pending\s*(amount|payment))\b|कितन[ाे]\s*(पैसे?\s*)?(बाकी|उधार|देने|देना|बकाया)|(बाकी|उधार|बकाया)\s*(कितन[ाे]|है\s*क्या|बताओ|बता\s*दो)|मेरा\s*(बाकी|उधार|हिसाब|बैलेंस)/i;
const BILL_RE = /\b((bill|invoice|receipt|raseed)\s*(bhej|send|chahiye|de\s*do|do\b|dobara|again|copy)|(bhej|send)\w*\s*(mera\s*)?(bill|invoice|receipt)|bill\s*ki\s*copy)\b|(बिल|रसीद|इनवॉइस)\s*(भेज|चाहिए|दे\s*दो|दो|दोबारा|की\s*कॉपी)|(भेज)\S*\s*(मेरा\s*)?(बिल|रसीद)/i;
const BOOK_RE = /\b(appointment|appoint?ment|slot\s*(book|chahiye|do)|book\s*(a\s*)?(slot|appointment|time)|time\s*(book|lena|chahiye)|booking\s*(karni|karna|chahiye|kar\s*do))\b|अपॉइंटमेंट|अपाइंटमेंट|समय\s*(लेना|चाहिए|बुक)|बुकिंग\s*(करनी|करना|चाहिए|कर\s*दो)|स्लॉट/i;

/** A job / order number in the text: "MJ/2026-27/14", "ORD/2026-27/4", or "#102" / "job 102" (the tailoring jobs' own number). */
export function findCode(text) {
  const t = String(text ?? "");
  const full = t.match(/\b([A-Za-z][A-Za-z0-9-]{0,7})\s*\/\s*(\d{4}-\d{2})\s*\/\s*(\d{1,6})\b/);
  if (full) return { code: `${full[1].toUpperCase()}/${full[2]}/${full[3]}`, number: Number(full[3]) };
  const n = t.match(/(?:#|\b(?:job|order|token|slip|जॉब|ऑर्डर|पर्ची)\s*(?:no\.?|number|नंबर|num)?\s*[:#-]?\s*)(\d{1,6})\b/i);
  return n ? { code: "", number: Number(n[1]) } : null;
}

/** What a free-typed message asks the counter for, or null (the AI answers). Long messages are conversation, not a counter question. */
export function deskIntent(text, { book = false } = {}) {
  const t = String(text ?? "").trim();
  if (!t || t.length > 90) return null;
  if (DUE_RE.test(t)) return "due";
  if (BILL_RE.test(t)) return "bill";
  if (findCode(t) && t.length <= 40) return "status";
  if (STATUS_RE.test(t)) return "status";
  if (book && BOOK_RE.test(t)) return "book";
  return null;
}

/* ---------------- status ---------------- */

const MS_STATUS = { received: "जमा है, काम शुरू होने वाला है", repairing: "रिपेयर चल रहा है 🔧", waiting: "पार्ट का इंतज़ार है", ready: "तैयार है ✅ दुकान से ले जाइए", delivered: "आपको दे दिया गया है", returned: "बिना रिपेयर वापस किया गया", cancelled: "रद्द हुआ" };
const JOB_STATUS = { received: "जमा है", cutting: "कटिंग चल रही है", stitching: "सिलाई चल रही है", finishing: "फिनिशिंग चल रही है", ready: "तैयार है ✅ ले जाइए", delivered: "आपको दे दिया गया है", cancelled: "रद्द हुआ" };
const JW_STATUS = { booked: "ऑर्डर दर्ज है", karigar: "कारीगर के पास बन रहा है", ready: "तैयार है ✅ ले जाइए", delivered: "आपको दे दिया गया है", cancelled: "रद्द हुआ" };
const sum = (list, f) => (Array.isArray(list) ? list : []).reduce((a, x) => a + (Number(f(x)) || 0), 0);

/** One line (two with money) per piece of work. `own` = asked from the customer's own number: money and the link are shown. */
export function statusLine(kind, r, { own, site }) {
  if (kind === "ms") {
    const total = sum(r.parts, (p) => p.qty * p.price) + Math.max(0, Number(r.labour_paise) || 0), paid = sum(r.payments, (p) => p.paise);
    const money = own && total > 0 && ["ready", "repairing", "waiting"].includes(r.status) ? `\n   कुल ${rs(total)}${paid ? ` · advance ${rs(paid)} · बाकी ${rs(Math.max(0, total - paid))}` : ""}` : "";
    const due = r.due_date && ["received", "repairing", "waiting"].includes(r.status) ? ` · ${niceDay(r.due_date)} तक` : "";
    return `🔧 *${r.device || "फ़ोन"}* (${r.code}): ${MS_STATUS[r.status] ?? r.status}${due}${money}${own && r.token ? `\n   ${site}/mr/${r.id}?t=${r.token}` : ""}`;
  }
  if (kind === "job") {
    const bal = Math.max(0, (Number(r.amount_paise) || 0) - (Number(r.advance_paise) || 0));
    const due = r.due_date && !["ready", "delivered", "cancelled"].includes(r.status) ? ` · ${niceDay(r.due_date)} तक` : "";
    return `🧵 *${[r.item, r.work].filter(Boolean).join(" — ") || "काम"}* (#${r.number}): ${JOB_STATUS[r.status] ?? `${r.status} चल रहा है`}${due}${own && bal > 0 && r.status !== "delivered" ? `\n   बाकी ${rs(bal)}` : ""}`;
  }
  const what = (Array.isArray(r.items) ? r.items : []).map((i) => i?.name || i?.descr || "").filter(Boolean).slice(0, 2).join(", ") || (r.kind === "repair" ? "रिपेयर" : "ऑर्डर");
  const due = r.due_date && ["booked", "karigar"].includes(r.status) ? ` · ${niceDay(r.due_date)} तक` : "";
  return `💍 *${what}* (${r.code}): ${JW_STATUS[r.status] ?? r.status}${due}${own && r.token ? `\n   ${site}/jo/${r.id}?t=${r.token}` : ""}`;
}

const MS_COLS = "id,code,status,device,parts,labour_paise,payments,due_date,token,customer_phone,updated_at";
const JOB_COLS = "id,number,status,item,work,due_date,amount_paise,advance_paise,customer_phone,updated_at";
const JW_COLS = "id,kind,code,status,items,due_date,token,customer_phone,updated_at";

/**
 * The status answer, or null when the books have nothing to say. By job number when one is typed; else every piece of work still
 * in the shop for this number (and what was given back in the last 3 days).
 */
export async function deskStatus({ owner, phone, text, rest, site, now = Date.now() }) {
  const p10 = ten(phone), code = findCode(text);
  const o = `owner_id=eq.${owner}`;
  if (code) {
    const [ms, jw, job] = await Promise.all([
      code.code ? rest(`ms_jobs?${o}&code=eq.${enc(code.code)}&select=${MS_COLS}&limit=1`) : [],
      code.code ? rest(`jw_orders?${o}&code=eq.${enc(code.code)}&select=${JW_COLS}&limit=1`) : [],
      !code.code ? rest(`job_orders?${o}&number=eq.${code.number}&select=${JOB_COLS}&limit=1`) : [],
    ]);
    const hit = ms[0] ? ["ms", ms[0]] : jw[0] ? ["jw", jw[0]] : job[0] ? ["job", job[0]] : null;
    if (!hit) return null;
    const own = !!p10 && ten(hit[1].customer_phone) === p10;
    return statusLine(hit[0], hit[1], { own, site });
  }
  if (p10.length !== 10) return null;
  const ph = `customer_phone=eq.${enc(`+91${p10}`)}`;
  const since = new Date(now - 3 * 86400_000).toISOString();
  const [ms, job, jw] = await Promise.all([
    rest(`ms_jobs?${o}&${ph}&or=(status.in.(received,repairing,waiting,ready),updated_at.gte.${since})&status=neq.cancelled&select=${MS_COLS}&order=created_at.desc&limit=5`),
    rest(`job_orders?${o}&${ph}&or=(status.not.in.(delivered,cancelled),updated_at.gte.${since})&status=neq.cancelled&select=${JOB_COLS}&order=created_at.desc&limit=6`),
    rest(`jw_orders?${o}&${ph}&or=(status.in.(booked,karigar,ready),updated_at.gte.${since})&status=neq.cancelled&select=${JW_COLS}&order=created_at.desc&limit=5`),
  ]);
  const lines = [...ms.map((r) => statusLine("ms", r, { own: true, site })), ...job.map((r) => statusLine("job", r, { own: true, site })), ...jw.map((r) => statusLine("jw", r, { own: true, site }))];
  return lines.length ? lines.join("\n\n") : null;
}

/* ---------------- what the customer owes; their last bill ---------------- */

const BILL_COLS = "id,code,total_paise,balance_paise,token,created_at";
async function billsOf({ owner, phone, rest, dueOnly }) {
  const p10 = ten(phone);
  if (p10.length !== 10) return [];
  const q = `owner_id=eq.${owner}&customer_phone=eq.${enc(`+91${p10}`)}&kind=eq.sale&select=${BILL_COLS}&order=created_at.desc&limit=${dueOnly ? 20 : 1}${dueOnly ? "&status=eq.open&balance_paise=gt.0" : "&status=neq.cancelled"}`;
  const [ms, jw] = await Promise.all([rest(`ms_bills?${q}`), rest(`jw_bills?${q}`)]);
  return [...ms.map((b) => ({ ...b, path: "mb" })), ...jw.map((b) => ({ ...b, path: "jb" }))].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
const billDay = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** "Mera kitna baki hai": the total, bill by bill, each with its link (the bill page carries the UPI QR). Null: nothing on record. */
export async function deskDue({ owner, phone, rest, site, upi = "" }) {
  const bills = await billsOf({ owner, phone, rest, dueOnly: true });
  if (!bills.length) return null;
  const total = bills.reduce((a, b) => a + Number(b.balance_paise || 0), 0);
  const rows = bills.slice(0, 5).map((b) => `• ${b.code} (${billDay(b.created_at)}) — ${rs(b.balance_paise)}\n  ${site}/${b.path}/${b.id}?t=${b.token}`);
  if (bills.length > 5) rows.push(`…और ${bills.length - 5} बिल`);
  return [`आपका कुल बाकी: *${rs(total)}*`, ...rows, upi ? `UPI से चुका सकते हैं: ${upi} (बिल के लिंक पर QR भी है) 🙏` : "बिल के लिंक पर पूरी जानकारी है 🙏"].join("\n");
}
/** "Bill bhej do": the latest bill's link. Null: no bill on this number. */
export async function deskBill({ owner, phone, rest, site }) {
  const b = (await billsOf({ owner, phone, rest, dueOnly: false }))[0];
  if (!b) return null;
  return `ये रहा आपका बिल ${b.code} (${billDay(b.created_at)}) — ${rs(b.total_paise)}${Number(b.balance_paise) > 0 ? ` · बाकी ${rs(b.balance_paise)}` : ""}:\n${site}/${b.path}/${b.id}?t=${b.token}`;
}
/** A counter question from the menu with nothing on record for this number. */
export function deskNothing(intent) {
  if (intent === "status") return "इस नंबर पर अभी कोई काम दर्ज नहीं मिला 🙏\nपर्ची पर लिखा job / order नंबर भेज दीजिए (जैसे MJ/2026-27/14 या #102), मैं तुरंत बता दूँगा।";
  if (intent === "due") return "इस नंबर पर कोई बाकी नहीं है ✅ धन्यवाद 🙏";
  return "इस नंबर पर कोई बिल नहीं मिला 🙏 जिस नंबर से ख़रीदारी की थी, उसी से message कीजिए, या हमें बताइए।";
}

/* ---------------- appointment: a day, then a free hour ---------------- */

/** The days offered: today (only while there is an hour left) and the next ones — five in all. */
export function bookDays({ now = Date.now(), end = 20, count = 5 } = {}) {
  const out = [];
  const hourNow = new Date(now + IST).getUTCHours();
  for (let i = hourNow + 1 < end ? 0 : 1; out.length < count; i++) {
    const ymd = dayOf(now + i * 86400_000);
    out.push({ ymd, label: `${i === 0 ? "आज" : i === 1 ? "कल" : ""}${i <= 1 ? " · " : ""}${niceDay(ymd)}` });
  }
  return out;
}
const hourLabel = (h) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
/** The free hours of a day: inside the shop's hours, not already booked, and (today) at least an hour away. */
export function freeSlots({ ymd, taken = [], start = 9, end = 20, now = Date.now() }) {
  const busy = new Set(taken.map((iso) => { const d = new Date(new Date(iso).getTime() + IST); return d.toISOString().slice(0, 10) === ymd ? d.getUTCHours() : -1; }));
  const today = dayOf(now) === ymd, hourNow = new Date(now + IST).getUTCHours();
  const out = [];
  for (let h = start; h < end; h++) if (!busy.has(h) && (!today || h > hourNow)) out.push({ hour: h, label: hourLabel(h), iso: new Date(`${ymd}T${String(h).padStart(2, "0")}:00:00+05:30`).toISOString() });
  return out;
}
export const dayMenu = (days) => `📅 किस दिन आना चाहेंगे?\n\n${days.map((d, i) => `${i + 1}. ${d.label}`).join("\n")}\n\n_दिन का नंबर लिखिए_`;
export const slotMenu = (day, slots) => `${niceDay(day)} — कौन-सा समय ठीक रहेगा?\n\n${slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n")}\n\n_समय का नंबर लिखिए · 0 = दूसरा दिन_`;
export const bookedText = (day, slot, shop) => `✅ आपकी appointment पक्की हो गई\n📅 ${niceDay(day)}, ${slot.label}${shop ? `\n📍 ${shop}` : ""}\n\nसमय बदलना हो तो यहीं लिख दीजिए 🙏`;

/* ---------------- answers from the card: address and timings, the offer, products with prices ---------------- */

const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const blocksOf = (card) => (card?.pages ?? []).filter((p) => !p?.hidden).flatMap((p) => p?.blocks ?? []);
const priceOf = (p) => (p ? (/^\s*[\d,.]/.test(p) ? `₹${tidy(p)}` : tidy(p)) : "");

/** A menu option answered from the card itself. Null: the card has nothing for it (the AI answers instead). */
export function cardAnswer(kind, card, { link = "" } = {}) {
  const blocks = blocksOf(card);
  if (kind === "address") {
    const loc = blocks.find((b) => b.kind === "location" && (b.address || b.mapUrl));
    const map = loc?.mapUrl || (card?.links ?? []).find((l) => l.type === "location")?.value || "";
    const hours = blocks.find((b) => b.kind === "hours" && (b.rows ?? []).length);
    const phone = (card?.links ?? []).find((l) => l.type === "phone")?.value || "";
    const out = [];
    if (loc?.address) out.push(`📍 ${tidy(loc.address)}`);
    if (map) out.push(`🗺️ ${tidy(map)}`);
    if (hours) out.push(`🕘 ${hours.rows.map((r) => `${tidy(r.day)} ${tidy(r.time)}`.trim()).filter(Boolean).join("\n     ")}`);
    if (!out.length) return null;
    if (phone) out.push(`📞 ${tidy(phone)}`);
    return out.join("\n");
  }
  if (kind === "offer") {
    const today = dayOf(Date.now());
    const out = [];
    const n = card?.notice;
    if (n?.text && (!n.until || n.until >= today)) out.push(`📢 ${tidy(n.text)}${n.sub ? ` — ${tidy(n.sub)}` : ""}`);
    for (const b of blocks) if (b.kind === "offer" && (b.text || b.code)) out.push(`🎁 ${tidy(b.text)}${b.code ? `\n   Code: *${tidy(b.code)}*` : ""}${b.expires ? `\n   ${tidy(b.expires)} तक` : ""}`);
    return out.length ? out.slice(0, 4).join("\n\n") : null;
  }
  if (kind === "products") {
    const items = blocks.filter((b) => b.kind === "product").flatMap((b) => b.items ?? []).filter((p) => tidy(p?.name));
    if (!items.length) return null;
    const rows = items.slice(0, 10).map((p) => `• ${tidy(p.name)}${p.price || p.mrp ? ` — ${priceOf(p.price || p.mrp)}` : ""}${p.badge ? ` (${tidy(p.badge)})` : ""}`);
    if (items.length > 10) rows.push(`…और ${items.length - 10}`);
    const photos = items.map((p) => (p.images ?? [])[0] || p.imageUrl || "").filter((u) => /^https?:\/\//.test(u)).slice(0, 3);
    return [`हमारे products:`, ...rows, link ? `\nसब कुछ photo और दाम के साथ: ${link}` : "", "जो पसंद आए उसका नाम लिख दीजिए 🙂", ...photos.map((u) => `[MEDIA] ${u}`)].filter(Boolean).join("\n");
  }
  return null;
}

/* ---------------- the enquiry form: one question at a time, the answers into the CRM ---------------- */

const FORM_Q = { name: "आपका शुभ नाम?", city: "आप किस शहर / इलाक़े से हैं?", budget: "आपका budget लगभग कितना है?", when: "आपको ये कब तक चाहिए?" };
/** The questions, from AI Training → "Find out from a new customer" (botRules.ask + the owner's own question). */
export function formQuestions(rules) {
  const out = (Array.isArray(rules?.ask) ? rules.ask : []).filter((k) => FORM_Q[k]).map((k) => ({ key: k, q: FORM_Q[k] }));
  const own = tidy(rules?.askOwn);
  if (own) out.push({ key: "own", q: own });
  return out.length ? out : [{ key: "name", q: FORM_Q.name }, { key: "city", q: FORM_Q.city }, { key: "need", q: "आपको क्या चाहिए? थोड़ा बता दीजिए।" }];
}
/** "50 hazar", "1.5 lakh", "₹20,000", "25k" → paise (0 when no amount is in it). */
export function budgetPaise(text) {
  const t = String(text ?? "").toLowerCase().replace(/,/g, "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|लाख|k\b|hazaa?r|हज़ार|हजार|thousand)?/);
  if (!m) return 0;
  const mult = !m[2] ? 1 : /lakh|lac|लाख/.test(m[2]) ? 100000 : 1000;
  const rupees = Number(m[1]) * mult;
  return Number.isFinite(rupees) && rupees > 0 && rupees < 1e9 ? Math.round(rupees * 100) : 0;
}
/** What the answers change on the lead, and the owner's one-glance summary. */
export function formResult(qs, answers) {
  const patch = {};
  const lines = [];
  qs.forEach((q, i) => {
    const a = tidy(answers[i]).slice(0, 200);
    if (!a) return;
    if (q.key === "name") patch.name = a.slice(0, 80);
    if (q.key === "city") patch.address = a.slice(0, 200);
    if (q.key === "budget") { const p = budgetPaise(a); if (p) patch.budget_paise = p; }
    lines.push(`${q.key === "name" ? "Name" : q.key === "city" ? "City" : q.key === "budget" ? "Budget" : q.key === "when" ? "When" : q.key === "need" ? "Needs" : q.q.slice(0, 30)}: ${a}`);
  });
  return { patch, summary: lines.join(" · ") };
}

/* ---------------- tags by the customer's own words ---------------- */

/** rules: [{ tag, words: "repair, display, screen" }] (AI Training → More settings). The tags whose words are in the message. */
export function autoTags(text, rules) {
  const t = ` ${String(text ?? "").toLowerCase()} `;
  const out = [];
  for (const r of Array.isArray(rules) ? rules.slice(0, 12) : []) {
    const tag = tidy(r?.tag).toLowerCase().replace(/[^a-z0-9ऀ-ॿ _-]/g, "").slice(0, 24);
    const words = String(r?.words ?? "").toLowerCase().split(/[,\n]/).map((w) => w.trim()).filter((w) => w.length >= 2);
    if (tag && words.some((w) => t.includes(w)) && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/* ---------------- "how was it?" — a number first, the Google review link only to the happy ones ---------------- */

/** 1–5 from "5", "4 star", "⭐⭐⭐", "5/5"; null when the message is not a rating. */
export function parseRating(text) {
  const t = String(text ?? "").trim();
  const stars = (t.match(/⭐|🌟|★/g) ?? []).length;
  if (stars >= 1 && stars <= 5 && t.replace(/⭐|🌟|★|\s|️/g, "") === "") return stars;
  const m = t.match(/^([1-5])\s*(?:\/\s*5|stars?|स्टार|⭐)?[\s.!]*$/i);
  return m ? Number(m[1]) : null;
}
export function ratingReply(n, link) {
  if (n >= 4) return link ? `बहुत-बहुत धन्यवाद 🙏😊 अगर 1 मिनट हो तो Google पर भी यही बता दीजिए, इससे हमें बहुत मदद मिलती है:\n${link}` : "बहुत-बहुत धन्यवाद 🙏😊 आपसे फिर मिलने का इंतज़ार रहेगा।";
  return "माफ़ कीजिए कि अनुभव अच्छा नहीं रहा 🙏 क्या कमी रही, यहीं लिख दीजिए। हम खुद आपसे बात करके इसे ठीक करेंगे।";
}
