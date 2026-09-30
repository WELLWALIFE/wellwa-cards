// Shared, dependency-free rules for ad scripts: timing budgets + deterministic gates (spec §6.1–6.2).
// Imported by the worker, the API routes and the client meters (via src/lib/media/ad-rules.ts).
export const AD_LANGS = ["hi", "hinglish", "en", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or"];
export const SPEECH_MAX = 3.8;
// syllables / second — placeholders until bridge/tts-calibrate.mjs writes tts-rates.json (PR4)
export const RATE = { en: 4.6, hi: 5.0, hinglish: 5.0, mr: 5.0, gu: 5.0, pa: 5.0, bn: 5.0, or: 5.0, ta: 5.6, te: 5.6, kn: 5.6, ml: 5.6 };
export const MAX_WORDS = { en: 10, hi: 8, hinglish: 8, mr: 7, gu: 7, pa: 7, bn: 7, or: 7, ta: 6, te: 6, kn: 6, ml: 6 };
const BLOCK = { hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], gu: [0x0a80, 0x0aff], pa: [0x0a00, 0x0a7f], bn: [0x0980, 0x09ff], or: [0x0b00, 0x0b7f], ta: [0x0b80, 0x0bff], te: [0x0c00, 0x0c7f], kn: [0x0c80, 0x0cff], ml: [0x0d00, 0x0d7f] };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Seconds a scene occupies for a spoken line of `speechSec` (clip = slot + 0.4 s crossfade). */
export const slotSec = (speechSec) => clamp((Number(speechSec) || 0) + 0.3, 2.4, 4.1);
export const ctaSlotSec = (ctaSec) => Math.max(3.5, (Number(ctaSec) || 0) + 0.6);
export function scenesFor(tier, length) {
  const L = Number(length) || 10;
  if (tier === "realistic") return L <= 10 ? 2 : L <= 20 ? 4 : 6;
  return L <= 10 ? 2 : L <= 20 ? 3 : L <= 30 ? 4 : L <= 45 ? 5 : 6;
}

const INDIC_DIGITS = /[०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯]/g;
const normDigits = (s) => String(s).replace(INDIC_DIGITS, (d) => String((d.codePointAt(0) & 0xf) % 10 === (d.codePointAt(0) & 0xf) ? d.codePointAt(0) & 0xf : 0));
const isIndic = (cp) => cp >= 0x0900 && cp <= 0x0d7f;
const VIRAMAS = new Set([0x094d, 0x09cd, 0x0a4d, 0x0acd, 0x0b4d, 0x0bcd, 0x0c4d, 0x0ccd, 0x0d4d]);
function isIndicLetter(cp) { // consonants + independent vowels (not signs/marks/digits)
  if (!isIndic(cp)) return false;
  const o = cp & 0x7f;
  return (o >= 0x05 && o <= 0x39) || (o >= 0x58 && o <= 0x61) || (o >= 0x72 && o <= 0x7f);
}
/** Syllable-ish units the TTS will speak. */
export function spokenUnits(text) {
  let units = 0;
  const t = normDigits(String(text ?? "")).replace(/[‌‍]/g, "");
  for (const raw of t.split(/[\s\-–—/]+/).filter(Boolean)) {
    let w = raw;
    if (/₹/.test(w)) units += 2;
    if (/%/.test(w)) units += 3;
    if (/\+/.test(w)) units += 2; // "plus"
    const num = w.replace(/[,₹%+.x×]/g, "");
    if (/^\d+$/.test(num) && num.length) {
      units += num.length >= 7 ? 2 * num.length : Number(num) < 100 ? 3 : 5;
      continue;
    }
    const cps = [...w].map((c) => c.codePointAt(0));
    if (cps.some(isIndic)) {
      let n = 0;
      for (let i = 0; i < cps.length; i++) if (isIndicLetter(cps[i]) && !VIRAMAS.has(cps[i + 1])) n++;
      units += Math.max(1, n);
    } else {
      const m = w.toLowerCase().replace(/[^a-z]/g, "").match(/[aeiouy]+/g);
      if (/[a-z]/i.test(w)) units += Math.max(1, m ? m.length : 1);
    }
  }
  return units;
}
export const estSec = (text, lang) => spokenUnits(text) / (RATE[lang] || RATE.hinglish);

/* ---------------- gates ---------------- */
const BANNED_LATIN = /\b(cure[sd]?|ilaaj|guarantee[d]?|100\s*%|no\.?\s*1|doctor[- ]recommended|best in|sabse behtar|world'?s)(?![a-z])/i;
const BANNED_NATIVE = ["गारंटी", "इलाज", "உத்தரவாதம்", "গ্যারান্টি", "ગેરંટી", "ਗਾਰੰਟੀ", "హామీ", "ಖಾತರಿ", "ഗ്യാരണ്ടി", "ଗ୍ୟାରେଣ୍ଟି"];
const CHANNEL_TOKENS = { en: /\b(call|whatsapp|dial|message us)\b/i, hinglish: /\b(call|whatsapp|phone kar|message kar)/i, hi: /(कॉल|व्हाट्सऐप|व्हाट्सएप|WhatsApp|फ़ोन कर|फोन कर|call)/i };
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10 };
const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);
const lower = (s) => String(s ?? "").toLowerCase();
const normNum = (s) => normDigits(String(s)).replace(/[,\s]/g, "");

/**
 * Distinctive brand token(s). The owner's brand name from the brief comes first ("Shubhora" for a product
 * called "Digital visiting Card" — its first word "Digital" is a category, not a brand); without a brief
 * brand, the first word of the product name that is not a generic noun. Pronunciation spellings ride along.
 */
const GENERIC = /^(the|a|an|alkaline|water|ionizer|purifier|new|best|premium|store|shop|clinic|salon|and|of|for|pvt|ltd|india|private|limited|digital|online|smart|mini|pro|plus|my|your)$/i;
const firstToken = (name) => words(name).find((w) => w.length >= 3 && !GENERIC.test(w));
export function brandTokens(facts, brand) {
  const first = firstToken(brand) ?? firstToken(facts?.name);
  if (!first) return [];
  const out = new Set([first]);
  for (const map of Object.values(facts?.pronunciations ?? {})) for (const [k, v] of Object.entries(map ?? {})) if (lower(k) === lower(first) && v) out.add(String(v));
  return [...out];
}
/** What counts as "the brand said": the brand, or the product's own name when it is distinctive. */
function brandOrProductTokens(facts, brand) {
  const out = new Set(brandTokens(facts, brand));
  const p = firstToken(facts?.name); if (p) out.add(p);
  const full = String(facts?.name ?? "").trim(); if (full.length >= 4) out.add(full);
  return [...out];
}
const hasToken = (text, tokens) => tokens.some((t) => lower(text).includes(lower(t)));

function checkedNumbers(text) { // numbers that make a claim: ≥3 digits, or carrying ₹ / % / x / +
  const out = [];
  const t = normDigits(String(text ?? ""));
  for (const m of t.matchAll(/(₹\s*)?(\d[\d,]*\.?\d*)(\s*(%|\+|x|×))?/g)) {
    const digits = m[2].replace(/[,.]/g, "");
    if (!digits) continue;
    if (digits.length >= 3 || m[1] || m[3]) out.push(normNum(m[2]).replace(/\.\d+$/, ""));
  }
  return out;
}
function allowedNumberPool(facts, brief) {
  const src = [...(facts?.proof ?? []).flatMap((p) => [p.text, p.number]), ...(facts?.offers ?? []), brief?.offer, brief?.phone].filter(Boolean).join(" ");
  const pool = new Set();
  for (const m of normDigits(src).matchAll(/\d[\d,]*/g)) pool.add(normNum(m[0]));
  for (const [w, n] of Object.entries(NUM_WORDS)) if (new RegExp(`\\b${w}\\b`, "i").test(src)) pool.add(String(n));
  return pool;
}
function exemptPhrases(facts, brief) { return [...(facts?.proof ?? []).map((p) => p.text), ...(facts?.offers ?? []), brief?.offer].filter(Boolean).map(lower); }

function scriptShare(text, lang, strip) {
  let t = String(text ?? "");
  for (const s of strip) if (s) t = t.split(s).join(" ");
  t = t.replace(/[\d\s\p{P}\p{S}]/gu, "");
  const cps = [...t].map((c) => c.codePointAt(0));
  if (!cps.length) return 1;
  const [lo, hi] = BLOCK[lang] ?? [0, 0];
  return cps.filter((cp) => cp >= lo && cp <= hi).length / cps.length;
}

const BAD_MOTION = /orbit|rotat|spin|whip|dolly|zoom out|pull back|\bpan\b|fast|dramatic|cinematic/i;
const BAD_NOUNS = /\b(tap|faucet|sink|bottle|jug|purifier)\b/i;

/**
 * script: { scenes:[{text, caption, shot?}], cta:{text, caption} }   ctx: { tier, length, lang, facts, brief:{offer, phone}, speak_number }
 * → { ok, errors:[{gate, scene, msg}], est:{per_scene_sec[], cta_sec, total_sec} }
 */
export function runGates(script, ctx) {
  const { tier = "template", length = 10, lang = "hinglish", facts = null, brief = {}, speak_number = false } = ctx ?? {};
  const errors = []; const E = (gate, scene, msg) => errors.push({ gate, scene, msg });
  const scenes = Array.isArray(script?.scenes) ? script.scenes : [];
  const cta = script?.cta ?? {};
  const realistic = tier === "realistic";
  const per = scenes.map((s) => estSec(s?.text, lang));
  const ctaSec = estSec(cta?.text, lang);
  const total = realistic ? per.reduce((a, s) => a + slotSec(s), 0) + ctaSlotSec(ctaSec) : per.reduce((a, b) => a + b, 0) + ctaSec;

  // G1 scene count / real length
  const want = scenesFor(tier, length);
  if (scenes.length !== want) E("G1", null, `This length needs ${want} scenes (found ${scenes.length}).`);
  if (realistic && total > Number(length) + 2) E("G1", null, `The video would run ${total.toFixed(1)} s — longer than ${length} s.`);
  // G2 speech budget
  if (realistic) per.forEach((s, i) => { if (s > SPEECH_MAX) E("G2", i, `Line is too long to say in one scene (${s.toFixed(1)} s, max ${SPEECH_MAX} s).`); });
  else if (per.reduce((a, b) => a + b, 0) > 0.85 * Number(length)) E("G2", null, "The lines are too long for this video length.");
  // G3 captions
  scenes.forEach((s, i) => {
    const c = String(s?.caption ?? "").trim(); const n = words(c).length;
    if (n < 2 || n > 5 || c.length > 32) E("G3", i, "On-screen caption must be 2–5 words (max 32 characters).");
    else if (lower(c) === lower(s?.text).replace(/[.!?।]+$/, "")) E("G3", i, "Caption should be a keyword card, not the full line.");
  });
  // G4 exactly one CTA; no channel words elsewhere (en/hi/hinglish)
  if (!String(cta?.text ?? "").trim()) E("G4", null, "The ad needs one closing call-to-action line.");
  const ch = CHANNEL_TOKENS[lang];
  if (ch) scenes.forEach((s, i) => { if (ch.test(String(s?.text ?? ""))) E("G4", i, "Keep call / WhatsApp for the closing line only."); });
  // G5 phone digits
  const phoneDigits = normNum(brief?.phone ?? "").replace(/\D/g, "");
  const longRuns = (t) => [...normDigits(String(t ?? "")).replace(/[\s-]/g, "").matchAll(/\d{7,}/g)].map((m) => m[0]);
  scenes.forEach((s, i) => { if (longRuns(s?.text).length) E("G5", i, "Do not speak a phone number outside the closing line."); });
  const ctaRuns = longRuns(cta?.text);
  if (speak_number && phoneDigits && !ctaRuns.some((r) => phoneDigits.endsWith(r) || r.endsWith(phoneDigits.slice(-10)))) E("G5", "cta", "The closing line should say your phone number.");
  if (!speak_number && ctaRuns.length) E("G5", "cta", "The number is shown on screen — remove it from the spoken line (or switch on “Speak phone number”).");
  // G6 banned claims (exempt when vouched for in proof / offers / brief.offer)
  const exempt = exemptPhrases(facts, brief);
  const banned = (facts?.banned_claims ?? []).map(lower).filter(Boolean);
  [...scenes.map((s, i) => [s?.text, i]), [cta?.text, "cta"], ...scenes.map((s, i) => [s?.caption, i])].forEach(([t, i]) => {
    const tx = lower(t); if (!tx) return;
    const hit = tx.match(BANNED_LATIN)?.[0] || BANNED_NATIVE.find((b) => String(t).includes(b)) || banned.find((b) => new RegExp(`(^|[^a-z])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(tx));
    if (hit && !exempt.some((p) => p.includes(lower(hit)) && tx.includes(p))) E("G6", i, `“${hit}” is a claim we cannot make. Add it to “Numbers I vouch for” to use it.`);
  });
  // G7 numbers must be vouched for
  const pool = allowedNumberPool(facts, brief);
  [...scenes.map((s, i) => [`${s?.text ?? ""} ${s?.caption ?? ""}`, i]), [`${cta?.text ?? ""}`, "cta"]].forEach(([t, i]) => {
    for (const n of checkedNumbers(t)) { if (phoneDigits && (phoneDigits.includes(n) || n.length >= 7)) continue; if (!pool.has(n)) E("G7", i, `The number ${n} is not in your product facts or offer.`); }
  });
  // G8 script block
  const strip = [...brandOrProductTokens(facts, brief?.brand), ...Object.values(facts?.pronunciations ?? {}).flatMap((m) => Object.keys(m ?? {}))];
  [...scenes.map((s, i) => [s?.text, i]), [cta?.text, "cta"]].forEach(([t, i]) => {
    if (!t) return;
    if (lang === "hinglish") { if (/[ऀ-ॿ]/.test(t)) E("G8", i, "Hinglish lines are written in Roman letters."); }
    else if (BLOCK[lang] && scriptShare(t, lang, strip) < 0.6) E("G8", i, "This line is not in the selected language's script.");
  });
  // G9 brand: not in the hook, present by scene 2 (the brand itself, or the product's own name)
  const bt = brandTokens(facts, brief?.brand);
  if (bt.length && scenes.length) {
    if (scenes.length > 2 && hasToken(scenes[0]?.text, bt)) E("G9", 0, "Open with the viewer's problem — bring the brand name in from scene 2.");
    const by2 = scenes.slice(0, 2).some((s) => hasToken(s?.text, brandOrProductTokens(facts, brief?.brand)));
    if (!by2) E("G9", 1, "Say the brand name by scene 2.");
  }
  // G11 (realistic) motion + unwanted nouns next to a visible product. G10 (shot whitelist) arrives with the planner in PR4.
  if (realistic) scenes.forEach((s, i) => {
    const sh = s?.shot; if (!sh) return;
    const hm = String(sh.hero_motion ?? "");
    if (words(hm).length > 15 || BAD_MOTION.test(hm)) E("G11", i, "Scene motion must be one small, slow movement.");
    if (sh.product?.visible && [sh.setting_desc, sh.placement, hm].some((x) => BAD_NOUNS.test(String(x ?? "")))) E("G11", i, "The scene description names an object that must not appear next to the product.");
  });
  return { ok: errors.length === 0, errors, est: { per_scene_sec: per.map((s) => +s.toFixed(2)), cta_sec: +ctaSec.toFixed(2), total_sec: +total.toFixed(1) } };
}

/** v2 input → the flat shape the legacy engines read (String(inp.cta) must never see an object). */
export function legacyView(input) {
  if (!input || input.v !== 2) return input;
  const sc = input.script ?? {};
  const scenes = (sc.scenes ?? []).map((s) => ({ text: s.text, caption_text: s.caption }));
  return { ...input.brief, ...input.options, product: input.facts?.name || input.brief?.product || "", headline: sc.headline, features: sc.features ?? [], scenes, cta: sc.cta?.text ?? "", script: [...scenes.map((s) => s.text), sc.cta?.text].filter(Boolean), caption: sc.post_caption ?? "" };
}
