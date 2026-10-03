// The deeper pages a trade's website needs (owner's call, 3 Oct 2026: "Shubhora ki website professional se
// better honi chahiye" — an agency gives a school a Classes page with fees and an Admissions page, a restaurant
// a menu in courses, a shop its products in categories). Everything here is built from what the owner already
// gave: the trade's own answers (trade-questions.ts), the products and their categories, the trade data. Nothing
// is asked twice. Pure module; the composer calls it.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { CardBlock, CardPage, ProductItem } from "@/lib/types";
import type { CardFacts, SavedProduct } from "@/lib/card-facts";
import type { TradeData } from "@/lib/trade-data/types";
import { tradeOwnQuestions } from "@/lib/trade-questions";

export type Lang = "en" | "hi" | "hinglish";
const uid = () => Math.random().toString(36).slice(2, 10);
const T = (lang: Lang, en: string, hi: string) => (lang === "hi" ? hi : en);

const EDUCATION = new Set(["school", "playschool", "coaching", "college", "computer", "teacher", "dance"]);
/** Trades whose "join" page says Admissions; the rest of education says "Join a batch". */
const ADMISSIONS = new Set(["school", "playschool", "college"]);

/* ---------------- titles ---------------- */

/** What the catalogue page is called for a trade, when the generic word ("Courses") is not what a parent or a
 *  guest looks for. null = keep the generic word. */
export function catalogTitle(category: string, lang: Lang, hasFee: boolean): string | null {
  switch (category) {
    case "school": return hasFee ? T(lang, "Classes & fees", "कक्षाएँ और फ़ीस") : T(lang, "Classes", "कक्षाएँ");
    case "playschool": return T(lang, "Programmes", "प्रोग्राम");
    case "coaching": return T(lang, "Courses & batches", "कोर्स और बैच");
    case "college": case "computer": return T(lang, "Courses", "कोर्स");
    case "teacher": return T(lang, "Subjects & classes", "विषय और कक्षाएँ");
    case "dance": return T(lang, "Classes", "क्लास");
    case "hotel": return T(lang, "Rooms & tariff", "कमरे और किराया");
    case "gym": return T(lang, "Plans & memberships", "प्लान और मेंबरशिप");
    default: return null;
  }
}

/** What the services list is called for a trade whose "services" are really its facilities. */
export function servicesTitle(category: string, lang: Lang): string | null {
  switch (category) {
    case "school": case "playschool": case "college": case "hotel": case "gym": return T(lang, "Facilities", "सुविधाएँ");
    case "hospital": return T(lang, "Departments & facilities", "विभाग और सुविधाएँ");
    default: return null;
  }
}

/* ---------------- the catalogue from the trade's answers ---------------- */

const answer = (facts: CardFacts, key: string): string[] => (facts.tradeAnswers?.[key] ?? []).filter(Boolean);
const hiLabel = (category: string, qKey: string, en: string, lang: Lang) => {
  if (lang !== "hi") return en;
  const q = tradeOwnQuestions(category).find((x) => x.key === qKey);
  return q?.options?.find((o) => o.en === en)?.hi ?? en;
};

type Stage = { key: string; en: string; hi: string; age: string; ageHi: string; desc: string; descHi: string };
const STAGES: Stage[] = [
  { key: "pre", en: "Pre-primary (Play group to UKG)", hi: "प्री-प्राइमरी (प्ले ग्रुप से UKG)", age: "2 to 6 years", ageHi: "2 से 6 साल", desc: "Learning through play, rhymes, art and activities — the first school years in a safe, caring space.", descHi: "खेल, कविता, आर्ट और गतिविधियों से सीख — सुरक्षित, प्यार भरे माहौल में स्कूल के पहले साल।" },
  { key: "primary", en: "Primary (Class 1 to 5)", hi: "प्राइमरी (कक्षा 1 से 5)", age: "6 to 11 years", ageHi: "6 से 11 साल", desc: "Reading, writing and maths built strong, with regular tests, homework and parent updates.", descHi: "पढ़ना, लिखना और गणित की मज़बूत नींव — नियमित टेस्ट, होमवर्क और अभिभावकों को अपडेट।" },
  { key: "middle", en: "Middle (Class 6 to 8)", hi: "मिडिल (कक्षा 6 से 8)", age: "11 to 14 years", ageHi: "11 से 14 साल", desc: "All subjects as per the board syllabus, with labs, computer classes and sports.", descHi: "बोर्ड सिलेबस के सभी विषय — लैब, कंप्यूटर क्लास और खेल के साथ।" },
  { key: "secondary", en: "Secondary (Class 9 to 10)", hi: "सेकेंडरी (कक्षा 9 से 10)", age: "14 to 16 years", ageHi: "14 से 16 साल", desc: "Board exam preparation with extra practice, doubt classes and regular assessments.", descHi: "बोर्ड परीक्षा की तैयारी — अतिरिक्त अभ्यास, डाउट क्लास और नियमित मूल्यांकन।" },
  { key: "senior", en: "Senior secondary (Class 11 to 12)", hi: "सीनियर सेकेंडरी (कक्षा 11 से 12)", age: "16 to 18 years", ageHi: "16 से 18 साल", desc: "Streams for class 11 and 12 with focused board preparation and career guidance.", descHi: "कक्षा 11-12 की स्ट्रीम — बोर्ड की तैयारी और करियर मार्गदर्शन के साथ।" },
];
/** Which stages a "classes" answer covers. */
const STAGES_FOR: Record<string, string[]> = {
  "Play school / Nursery–KG": ["pre"],
  "Nursery–5th": ["pre", "primary"],
  "Nursery–8th": ["pre", "primary", "middle"],
  "Nursery–10th": ["pre", "primary", "middle", "secondary"],
  "Nursery–12th": ["pre", "primary", "middle", "secondary", "senior"],
  "1st–8th": ["primary", "middle"],
  "6th–12th": ["middle", "secondary", "senior"],
  "9th–12th": ["secondary", "senior"],
  "11th–12th": ["senior"],
};
const PROGRAMMES: Record<string, { age: string; ageHi: string; desc: string; descHi: string }> = {
  "Play group": { age: "1.5 to 2.5 years", ageHi: "1.5 से 2.5 साल", desc: "First steps away from home: play, songs, colours and friends, a few hours a day.", descHi: "घर से बाहर पहला कदम: खेल, गाने, रंग और दोस्त — दिन में कुछ घंटे।" },
  "Nursery": { age: "2.5 to 3.5 years", ageHi: "2.5 से 3.5 साल", desc: "Rhymes, stories, shapes and early habits, learnt through play.", descHi: "कविताएँ, कहानियाँ, आकार और शुरुआती आदतें — खेल-खेल में।" },
  "LKG": { age: "3.5 to 4.5 years", ageHi: "3.5 से 4.5 साल", desc: "Letters, numbers and pre-writing, with art, music and outdoor play every day.", descHi: "अक्षर, गिनती और लिखने की तैयारी — रोज़ आर्ट, म्यूज़िक और बाहर खेल।" },
  "UKG": { age: "4.5 to 5.5 years", ageHi: "4.5 से 5.5 साल", desc: "Reading and writing readiness for class 1, with confidence and good habits.", descHi: "कक्षा 1 के लिए पढ़ने-लिखने की तैयारी — आत्मविश्वास और अच्छी आदतों के साथ।" },
  "Daycare": { age: "after school hours", ageHi: "स्कूल के बाद", desc: "Caring supervision, meals and rest for working parents, beyond school hours.", descHi: "नौकरी करने वाले माता-पिता के लिए स्कूल के बाद देखभाल, खाना और आराम।" },
};

/** Cards for the catalogue page when the owner saved no products of their own, from the trade's answers: a
 *  school's classes by stage, a play school's programmes, a coaching centre's courses and exams, a college's
 *  courses, a gym's plans. Empty for every other trade (their services list already carries what they ticked). */
export function answerCatalog(category: string, facts: CardFacts, lang: Lang): ProductItem[] {
  const cta = EDUCATION.has(category) ? T(lang, "Enquire for admission", "एडमिशन के लिए पूछें") : T(lang, "Enquire on WhatsApp", "WhatsApp पर पूछें");
  const common: string[] = [];
  for (const k of ["board", "medium", "stay", "batch", "timing", "mode", "certificate", "hostel"]) for (const v of answer(facts, k)) common.push(hiLabel(category, k, v, lang));
  const card = (name: string, desc: string, extra: string[] = []): ProductItem => ({ name, desc, features: [...extra, ...common].slice(0, 5), specs: [], ctaLabel: cta });

  if (category === "school") {
    const range = answer(facts, "classes")[0];
    const keys = range ? STAGES_FOR[range] : null;
    if (!keys) return [];
    return STAGES.filter((s) => keys.includes(s.key)).map((s) => card(T(lang, s.en, s.hi), T(lang, s.desc, s.descHi), [T(lang, `Age ${s.age}`, `उम्र ${s.ageHi}`)]));
  }
  if (category === "playschool") {
    const picked = answer(facts, "programmes");
    return picked.filter((p) => PROGRAMMES[p]).map((p) => { const d = PROGRAMMES[p]; return card(hiLabel(category, "programmes", p, lang), T(lang, d.desc, d.descHi), [T(lang, `Age ${d.age}`, `उम्र ${d.ageHi}`)]); });
  }
  if (category === "coaching") {
    const classes = answer(facts, "classes").map((v) => card(hiLabel(category, "classes", v, lang), T(lang, "Regular batches with notes, tests and doubt sessions.", "नियमित बैच — नोट्स, टेस्ट और डाउट सेशन के साथ।")));
    const exams = answer(facts, "exams").map((v) => card(T(lang, `${hiLabel(category, "exams", v, lang)} preparation`, `${hiLabel(category, "exams", v, lang)} की तैयारी`), T(lang, "Complete syllabus, mock tests and performance tracking.", "पूरा सिलेबस, मॉक टेस्ट और प्रगति पर नज़र।")));
    return [...classes, ...exams].slice(0, 12);
  }
  if (category === "college" || category === "computer") {
    return answer(facts, "courses").map((v) => card(hiLabel(category, "courses", v, lang), T(lang, "Ask us for duration, eligibility and fees.", "अवधि, योग्यता और फ़ीस के लिए पूछें।"))).slice(0, 12);
  }
  if (category === "teacher") {
    const classes = answer(facts, "classes").map((v) => hiLabel(category, "classes", v, lang));
    return answer(facts, "subjects").map((v) => card(hiLabel(category, "subjects", v, lang), classes.length ? T(lang, `For ${classes.join(", ")}.`, `${classes.join(", ")} के लिए।`) : T(lang, "Ask us for timings and fees.", "समय और फ़ीस के लिए पूछें।"))).slice(0, 12);
  }
  if (category === "dance") {
    const who = answer(facts, "for").map((v) => hiLabel(category, "for", v, lang));
    return answer(facts, "classes").map((v) => card(hiLabel(category, "classes", v, lang), who.length ? T(lang, `For ${who.join(", ")}.`, `${who.join(", ")} के लिए।`) : T(lang, "Ask us for batches and fees.", "बैच और फ़ीस के लिए पूछें।"))).slice(0, 12);
  }
  if (category === "gym") {
    return answer(facts, "type").map((v) => card(hiLabel(category, "type", v, lang), T(lang, "Monthly, quarterly and yearly plans — ask us for the current rates.", "मासिक, तिमाही और सालाना प्लान — मौजूदा दरों के लिए पूछें।"))).slice(0, 12);
  }
  return [];
}

/* ---------------- the products in their categories ---------------- */

/** The catalogue page's blocks: one block per product category when the owner sorted their products into at
 *  least two (a menu in courses, a shop in ranges); otherwise the one block. `items` and `products` run in the
 *  same order (the composer builds one from the other). */
export function catalogBlocks(items: ProductItem[], products: SavedProduct[], title: string, lang: Lang): CardBlock[] {
  const cats = items.map((_, i) => (products[i]?.category ?? "").trim());
  const named = [...new Set(cats.filter(Boolean))];
  if (named.length < 2 || items.length < 4) return [{ id: uid(), kind: "product", title, items }];
  const groups: CardBlock[] = named.map((c) => ({ id: uid(), kind: "product" as const, title: c, items: items.filter((_, i) => cats[i] === c) }));
  const rest = items.filter((_, i) => !cats[i]);
  if (rest.length) groups.push({ id: uid(), kind: "product", title: T(lang, "More", "और भी"), items: rest });
  return groups;
}

/* ---------------- the join / admissions page ---------------- */

const DOCUMENTS: Record<string, { en: string[]; hi: string[] }> = {
  school: { en: ["Birth certificate", "Previous report card or transfer certificate", "Aadhaar of the child and a parent", "Passport-size photos", "Address proof"], hi: ["जन्म प्रमाणपत्र", "पिछली रिपोर्ट कार्ड या TC", "बच्चे और अभिभावक का आधार", "पासपोर्ट साइज़ फ़ोटो", "पते का प्रमाण"] },
  playschool: { en: ["Birth certificate", "Aadhaar of the child and a parent", "Passport-size photos", "Vaccination record"], hi: ["जन्म प्रमाणपत्र", "बच्चे और अभिभावक का आधार", "पासपोर्ट साइज़ फ़ोटो", "टीकाकरण कार्ड"] },
  college: { en: ["Marksheets of class 10 and 12", "Transfer and character certificate", "Aadhaar", "Passport-size photos", "Caste / income certificate, if applicable"], hi: ["10वीं और 12वीं की मार्कशीट", "TC और चरित्र प्रमाणपत्र", "आधार", "पासपोर्ट साइज़ फ़ोटो", "जाति / आय प्रमाणपत्र, यदि लागू"] },
  default: { en: ["A photo ID", "Passport-size photos", "Previous marks, if any"], hi: ["एक फ़ोटो ID", "पासपोर्ट साइज़ फ़ोटो", "पिछले अंक, यदि हों"] },
};

/** The Admissions / Join page for an education trade: at a glance, how admission works, documents, the offer,
 *  and an enquiry box. null for every other trade. */
export function joinPage(opts: { category: string; facts: CardFacts; trade: TradeData | null; lang: Lang; offerText: string; hours: string }): CardPage | null {
  const { category, facts, trade, lang } = opts;
  if (!EDUCATION.has(category)) return null;
  const admissions = ADMISSIONS.has(category);
  const label = admissions ? T(lang, "Admissions", "एडमिशन") : T(lang, "Join a batch", "बैच जॉइन करें");
  const blocks: CardBlock[] = [];
  // At a glance: the trade's own answers as chips.
  const glance: string[] = [];
  for (const q of tradeOwnQuestions(category)) {
    if (q.type === "text" || q.key === "offerings") continue;
    const v = answer(facts, q.key);
    if (!v.length) continue;
    glance.push(`${T(lang, q.en.replace(/\?$/, ""), q.hi.replace(/\?$/, ""))}: ${v.map((x) => hiLabel(category, q.key, x, lang)).join(", ")}`);
  }
  if (glance.length) blocks.push({ id: uid(), kind: "highlights", title: T(lang, "At a glance", "एक नज़र में"), items: glance });
  // How admission works: the trade's steps.
  const steps = (trade?.steps ?? []).slice(0, 5).map((s, i) => ({ name: `${i + 1}. ${lang === "hi" ? s.hi : s.en}`, desc: lang === "hi" ? s.descHi : s.desc }));
  if (steps.length >= 3) blocks.push({ id: uid(), kind: "services", title: admissions ? T(lang, "How admission works", "एडमिशन कैसे होता है") : T(lang, "How to join", "कैसे जुड़ें"), items: steps });
  const docs = DOCUMENTS[category] ?? DOCUMENTS.default;
  blocks.push({ id: uid(), kind: "highlights", title: T(lang, "Documents needed", "ज़रूरी दस्तावेज़"), items: (lang === "hi" ? docs.hi : docs.en).map((d) => `📄 ${d}`) });
  if (opts.offerText) blocks.push({ id: uid(), kind: "offer", title: T(lang, "Admission offer", "एडमिशन ऑफ़र"), text: opts.offerText, code: "", expires: "" });
  if (opts.hours) blocks.push({ id: uid(), kind: "hours", title: T(lang, "Enquiry timings", "पूछताछ का समय"), rows: opts.hours.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 7).map((day) => ({ day, time: "" })) });
  blocks.push({
    id: uid(), kind: "contact",
    title: admissions ? T(lang, "Admission enquiry", "एडमिशन की पूछताछ") : T(lang, "Enquire about a batch", "बैच के बारे में पूछें"),
    note: admissions
      ? T(lang, "Tell us the child's age and the class you want — we reply on WhatsApp with seats, fees and a visit time.", "बच्चे की उम्र और कौन सी कक्षा चाहिए बताएँ — सीट, फ़ीस और विज़िट का समय हम WhatsApp पर बताएँगे।")
      : T(lang, "Tell us what you want to learn and your free hours — we reply on WhatsApp with the batch and fees.", "क्या सीखना है और कब समय है बताएँ — बैच और फ़ीस हम WhatsApp पर बताएँगे।"),
  });
  return { id: uid(), slug: admissions ? "admissions" : "join", label, blocks };
}
