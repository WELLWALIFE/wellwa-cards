// Script planner v2 (spec §5a): three structurally different scripts written in parallel from the owner's
// confirmed product facts → deterministic gates → one fix pass → one judge call that ranks them.
import { runGates, scenesFor, brandTokens, SPEECH_MAX, MAX_WORDS, type ScriptV2, type GateResult } from "./ad-rules";
import type { ProductFacts } from "./product-facts";
import type { ShotV2 } from "./ad-v2";

const PLAN_MODEL = process.env.PLAN_MODEL || "gemini-3.5-flash";
const JUDGE_MODEL = process.env.JUDGE_MODEL || "gemini-3.5-flash";
const FALLBACK_MODEL = process.env.PLAN_FALLBACK_MODEL || "gemini-3.5-flash-lite"; // second try when the main model is busy
export const LANG_RULE: Record<string, string> = {
  hi: "Hindi in Devanagari script only (brand/product names may stay in Latin).", hinglish: "Hinglish — conversational Hindi written in Roman/Latin letters (e.g. 'Aaj hi demo book karein'), never Devanagari.", en: "Simple Indian English.",
  mr: "Marathi in Devanagari script (brand names may stay in Latin).", gu: "Gujarati in Gujarati script (brand names may stay in Latin).", pa: "Punjabi in Gurmukhi script (brand names may stay in Latin).", bn: "Bengali in Bengali script (brand names may stay in Latin).",
  ta: "Tamil in Tamil script (brand names may stay in Latin).", te: "Telugu in Telugu script (brand names may stay in Latin).", kn: "Kannada in Kannada script (brand names may stay in Latin).", ml: "Malayalam in Malayalam script (brand names may stay in Latin).", or: "Odia in Odia script (brand names may stay in Latin).",
};
const GOAL_DEF: Record<string, string> = { leads: "get WhatsApp / call enquiries", offer: "push the offer", awareness: "introduce the product", festival: "festive greeting that leads to the product", transformation: "a truthful before → after story" };
const ANGLES: Record<string, [string, string][]> = {
  leads: [["pain_point", "person_first"], ["question", "product_first"], ["bold_number", "offer_first"]],
  offer: [["bold_number", "offer_first"], ["pain_point", "person_first"], ["question", "product_first"]],
  awareness: [["question", "product_first"], ["pain_point", "person_first"], ["did_you_know", "person_first"]],
  festival: [["festive_moment", "person_first"], ["question", "product_first"], ["bold_number", "offer_first"]],
  transformation: [["before_after", "person_first"], ["pain_point", "person_first"], ["question", "product_first"]],
};
const FIRST_VISUAL: Record<string, string> = { product_first: "scene 1 shows the product working", person_first: "scene 1 shows a person with the problem, product not visible", offer_first: "scene 1 shows a person reacting to the offer or number as the idea, product not visible" };
const SPINES: Record<number, string[]> = { 2: ["hook", "product_in_use"], 3: ["hook", "product_in_use", "proof"], 4: ["hook", "product_in_use", "benefit", "proof_or_offer"], 5: ["hook", "problem", "product_in_use", "benefit", "proof_or_offer"], 6: ["hook", "problem", "product_in_use", "benefit", "proof", "offer"] };

export type PlanBrief = { tier: string; length: number; lang: string; goal: string; audience: string; tone: string; offer: string; phone: string; brand: string; notes: string; speak_number: boolean };
export type PlannedScript = { script: ScriptV2 & { voice?: string; music?: string; template?: string; questions?: string[] }; gates: GateResult; verdict: "ready" | "needs_fix"; reason: string };

// gemini-3.5-flash thinks before it answers and the thoughts count against maxOutputTokens — a small cap truncates the JSON mid-string.
// A 429 / 5xx from Gemini (busy model) is retried once after a short pause, and every failure is logged, so a run of
// "Could not write scripts" on the customer's screen has a reason in the server log.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function gem(model: string, prompt: string, temperature: number, maxOutputTokens = 8192): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature, maxOutputTokens } }), signal: AbortSignal.timeout(40000) });
      if (!r.ok) {
        const body = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
        console.log(`[plan] ${model} HTTP ${r.status} ${body}`);
        if ((r.status === 429 || r.status >= 500) && attempt === 0) { await sleep(1500); continue; }
        return null;
      }
      const j = await r.json(); const t = String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
      if (!t) { console.log(`[plan] ${model} empty answer ${JSON.stringify(j).slice(0, 160)}`); return null; }
      try { return JSON.parse(t); } catch { const a = t.indexOf("{"), z = t.lastIndexOf("}"); // the model sometimes appends text after the object
        for (let end = z; end > a; end = t.lastIndexOf("}", end - 1)) { try { return JSON.parse(t.slice(a, end + 1)); } catch { /* shrink */ } } throw new Error("unparseable JSON"); }
    } catch (e) { console.log(`[plan] ${model} error ${String(e).slice(0, 160)}`); if (attempt === 0 && !/unparseable/.test(String(e))) continue; return null; }
  }
  return null;
}
const cut = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
// The brand the copy names: the owner's brand from the brief ("Shubhora"), else the product's distinctive first word — never a category word like "Digital".
const brandToken = (facts: ProductFacts, brand?: string) => brandTokens(facts, brand)[0] ?? (brand?.trim() || facts.name);

/** Clamp the planner's creative choices; product look / usage never comes from here. */
export function sanitizeShot(raw: unknown, role: string, facts: ProductFacts, realistic: boolean): ShotV2 | undefined {
  if (!realistic) return undefined;
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>; const p = (s.product && typeof s.product === "object" ? s.product : {}) as Record<string, unknown>; const pe = (s.people && typeof s.people === "object" ? s.people : {}) as Record<string, unknown>;
  const mustUse = role === "product_in_use" && facts.archetype !== "static_item";
  const visible = mustUse || p.visible === true; const in_use = mustUse || (visible && p.in_use === true && facts.archetype !== "static_item");
  const framing = (["close_up", "medium", "wide"].includes(String(s.framing)) ? s.framing : "medium") as ShotV2["framing"];
  let camera = (["static", "slow_push_in", "subtle_parallax", "gentle_handheld"].includes(String(s.camera)) ? s.camera : "slow_push_in") as ShotV2["camera"];
  if (visible && camera === "gentle_handheld") camera = "slow_push_in"; if (in_use) camera = "static";
  return { setting: cut(s.setting, 30) || facts.settings?.[0] || "home", setting_desc: cut(s.setting_desc, 160), people: { faces: Math.max(0, Math.min(3, Math.trunc(Number(pe.faces) || 0))), desc: cut(pe.desc, 120) }, hands_visible: s.hands_visible === true,
    framing: in_use && framing === "wide" ? "medium" : framing, lens: /50/.test(String(s.lens)) ? "50mm" : "35mm", lighting: cut(s.lighting, 60),
    product: visible ? { visible: true, in_use, placement: cut(p.placement, 80), frame_share: Math.min(0.6, Math.max(0.25, Number(p.frame_share) || (in_use ? 0.5 : 0.35))) } : { visible: false }, hero_motion: cut(s.hero_motion, 110), camera };
}
function cleanScript(raw: Record<string, unknown>, n: number, facts: ProductFacts, realistic: boolean): PlannedScript["script"] | null {
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.slice(0, n) : []; if (scenes.length !== n) return null;
  const spine = SPINES[n] ?? SPINES[4]; const cta = (raw.cta && typeof raw.cta === "object" ? raw.cta : { text: raw.cta }) as Record<string, unknown>;
  return { angle: cut(raw.angle, 30), first_visual: cut(raw.first_visual, 30), promise: cut(raw.promise, 120), headline: cut(raw.headline, 60), why: cut(raw.why, 220),
    scenes: scenes.map((x, i) => { const sc = (x ?? {}) as Record<string, unknown>; const role = spine[i]; return { role, text: cut(sc.text, 200), caption: cut(sc.caption, 40), shot: sanitizeShot(sc.shot, role, facts, realistic) as unknown as Record<string, unknown> }; }),
    cta: { text: cut(cta.text, 200), caption: cut(cta.caption, 40) }, features: (Array.isArray(raw.features) ? raw.features : []).map((f) => cut(f, 40)).filter(Boolean).slice(0, 4), post_caption: cut(raw.post_caption, 600),
    voice: cut(raw.voice, 10), music: cut(raw.music, 40), template: cut(raw.template, 20), questions: (Array.isArray(raw.questions) ? raw.questions : []).map((q) => cut(q, 160)).filter(Boolean).slice(0, 2) };
}

function t2Prompt(b: PlanBrief, facts: ProductFacts, angle: string, firstVisual: string, n: number) {
  const realistic = b.tier === "realistic"; const spine = SPINES[n] ?? SPINES[4]; const minVisible = n === 2 ? 1 : 2;
  const fp = { label: facts.label, name: facts.name, what_it_is: facts.what_it_is, size_class: facts.size_class, settings: facts.settings, people_default: facts.people_default, benefits: facts.benefits, proof: facts.proof, offers: facts.offers, claims_allowed: facts.claims_allowed, banned_claims: facts.banned_claims, correct_use: facts.output?.action_positive ?? facts.use_positive ?? "", hands: facts.hands };
  const shotRule = realistic ? `
10. "shot" holds ONLY creative choices, in English. The product's look and how it works are added by the production system — do not describe them. Fill:
   setting: one of ${JSON.stringify(facts.settings?.length ? facts.settings : ["home"])}; setting_desc ≤20 words (surfaces, wall, light direction; describe only what should be seen)
   people: {faces: 0-3, desc ≤15 words, Indian}; hands_visible: true|false
   framing: close_up|medium|wide ; lens "35mm"|"50mm" ; lighting ≤8 words
   product: {visible: true|false, in_use: true|false, placement ≤12 words, frame_share 0.25-0.6}
   hero_motion: ONE thing that moves, ≤15 words, one verb, nothing new enters the frame, matches the line
   camera: static|slow_push_in|subtle_parallax when product.visible, else also gentle_handheld
   Product visible in at least ${minVisible} scenes, always in the product_in_use scene; exactly one or two scenes have in_use=true and they use close_up or medium framing. In hook/problem/benefit scenes the product may be absent. Never write text on screen.` : "";
  const shotShape = realistic ? ',"shot":{"setting":"","setting_desc":"","people":{"faces":1,"desc":""},"hands_visible":false,"framing":"medium","lens":"35mm","lighting":"","product":{"visible":true,"in_use":false,"placement":"","frame_share":0.35},"hero_motion":"","camera":"slow_push_in"}' : "";
  return `You are a senior Indian performance-ad copywriter and director. Write ONE ${b.length}-second vertical ${realistic ? "live-action" : "motion-graphics"} ad for the product below. Return ONLY JSON (shape at the end). Spoken lines and captions in: ${LANG_RULE[b.lang]}. Everything else in English.

PRODUCT FACTS — the only facts you may use. Never invent numbers, prices, awards, certifications or health outcomes.
${JSON.stringify(fp)}

BRIEF
Goal: ${b.goal} (${GOAL_DEF[b.goal] ?? GOAL_DEF.leads})   Audience: ${b.audience || facts.people_default || "Indian families"}   Tone: ${b.tone}   Brand: ${b.brand || facts.name}
Offer: ${b.offer || "(none — do not invent one)"}   Phone: ${b.phone ? "shown on the end card" : "(none)"}   Speak the number aloud: ${b.speak_number}
Owner notes: ${b.notes || "-"}

THIS SCRIPT
Hook angle: ${angle}.   First picture: ${firstVisual} = "${FIRST_VISUAL[firstVisual]}"
Exactly ${n} scenes + 1 CTA. Scene roles in order: ${spine.join(", ")}
${realistic ? `Each scene becomes ONE short video clip made from ONE still photo: one moment, one place, one action. Each spoken line must be sayable in ${SPEECH_MAX} seconds — about ${MAX_WORDS[b.lang] ?? 8} words. Shorter is better; scenes are cut to the length of the line.` : `Each scene lasts as long as its line; keep the whole ad near ${b.length} seconds (about ${Math.round(b.length * 2.1)} words before the CTA).`}

RULES
1. One promise, written first in "promise" (≤12 words). Every scene ladders to it.
2. One idea per scene: line, caption and picture say the SAME thing.
3. Scene 1 = hook: a number or a concrete noun in the first 4 words; the brand name "${brandToken(facts, b.brand)}" must NOT appear${n === 2 ? " in scene 1 unless unavoidable" : ""}; naming the product category is good.
4. Scene 2 says the brand once${n === 2 ? " (say it as briefly as possible — the line must still fit the time limit)" : ""}.
5. Benefit language, not specs. Specs go into "features" (4 labels of 2-3 English words).
6. Every factual statement must be one of claims_allowed, the offer, or a proof item. Questions and everyday situations are fine. Never criticise another product, brand or technology (no "RO", no competitor names).
7. Numbers only from proof, offers or the brief's offer. Small counts and times (1 button, 2 minutes) are allowed only if true in the facts.
8. Only the CTA mentions calling/WhatsApp. ${b.speak_number && b.phone ? "CTA = verb + channel + the number." : b.phone ? "CTA = verb + channel + 'the number is on screen' in the ad's language. Do not write the digits." : `CTA = verb + channel + the brand name "${brandToken(facts, b.brand)}" (e.g. "WhatsApp karein ${brandToken(facts, b.brand)} ko"). There is NO phone number: never say the number is on screen, never invent one.`} ≤10 words.
9. "caption": 2-5 words, ≤32 characters, digits as digits, not identical to the line.${shotRule}
11. No clichés ("best quality", "sabse behtar", "No.1"); none of: ${facts.banned_claims.join(", ") || "-"}.
12. "why": one English sentence ≤25 words for the owner.
13. If something essential is missing, add ≤2 short questions in ENGLISH in "questions" and still return the script.

JSON SHAPE
{"angle":"","first_visual":"","promise":"","headline":"<≤6 words>","why":"","scenes":[{"role":"${spine.join("|")}","text":"","caption":""${shotShape}}],"cta":{"text":"","caption":""},"post_caption":"","features":["","","",""],"voice":"male|female","music":"upbeat-corporate|festive-diwali|calm-ambient|energetic-promo|inspiring-motivational|indian-sitar","template":"bold|clean|festive|offer|trust|fresh","questions":[]}`;
}

export async function planScripts(b: PlanBrief, facts: ProductFacts): Promise<PlannedScript[]> {
  const n = scenesFor(b.tier, b.length); const realistic = b.tier === "realistic";
  const ctx = { tier: b.tier, length: b.length, lang: b.lang, facts, brief: { offer: b.offer, phone: b.phone, brand: b.brand }, speak_number: b.speak_number };
  const pairs = ANGLES[b.goal] ?? ANGLES.leads;
  const drafts = await Promise.all(pairs.map(async ([angle, fv]) => {
    const raw = (await gem(PLAN_MODEL, t2Prompt(b, facts, angle, fv, n), 0.8)) ?? (await gem(FALLBACK_MODEL, t2Prompt(b, facts, angle, fv, n), 0.8)); if (process.env.PLAN_DEBUG) console.log("[plan] draft", angle, raw ? `scenes=${Array.isArray(raw.scenes) ? raw.scenes.length : "?"}` : "NULL"); if (!raw) return null;
    let script = cleanScript({ ...raw, angle, first_visual: fv }, n, facts, realistic); if (!script) return null;
    let gates = runGates(script, ctx);
    if (!gates.ok) { // T2b — one fix pass
      const fixed = await gem(PLAN_MODEL, `This ad script failed these production checks:\n${gates.errors.map((e) => `- ${e.scene === null ? "" : `scene ${typeof e.scene === "number" ? e.scene + 1 : e.scene}: `}${e.msg}`).join("\n")}\nFix ONLY the listed violations and keep everything else identical (same language and script, same promise, same scene order, same shots). Spoken lines must be sayable in ${SPEECH_MAX} seconds (about ${MAX_WORDS[b.lang] ?? 8} words). Return ONLY the corrected script JSON in the same shape.\nScript: ${JSON.stringify(script)}`, 0.3);
      const s2 = fixed ? cleanScript({ ...fixed, angle, first_visual: fv }, n, facts, realistic) : null;
      if (s2) { const g2 = runGates(s2, ctx); if (g2.errors.length < gates.errors.length) { script = s2; gates = g2; } }
    }
    return { script, gates };
  }));
  const ok = drafts.filter((d): d is { script: NonNullable<ReturnType<typeof cleanScript>>; gates: GateResult } => !!d);
  if (!ok.length) return [];
  // T9 — one judge call for all scripts
  const claims = [...facts.claims_allowed, ...facts.offers, ...facts.proof.map((p) => p.text), b.offer].filter(Boolean);
  const j = await gem(JUDGE_MODEL, `You review short vertical ads for a viewer who sees them ONCE on a phone, often muted. For each script answer yes/no with one short reason. Return ONLY JSON {"scripts":[{"i":0,"three_second_test":true,"single_promise":true,"visual_verbal_match":true,"claims_grounded":true,"ungrounded":["<line: claim>"],"sound_off_ok":true,"cta_clear":true,"natural":true,"verdict":"ready|needs_fix","reason":"<≤18 words, plain English, names the scene>"}],"ranking":[0,1,2]}
three_second_test: from scene 1's line, caption and picture alone, can the viewer name the product category or the problem? claims_grounded: every factual assertion in every line maps to CLAIMS ALLOWED, the offer or a proof item; any criticism of another product or technology = false. sound_off_ok: the captions alone tell what is sold, what is promised and what to do. natural: reads like a real ${b.lang} speaker.
CLAIMS ALLOWED: ${JSON.stringify(claims)}
SCRIPTS: ${JSON.stringify(ok.map((d, i) => ({ i, promise: d.script.promise, scenes: d.script.scenes.map((s) => ({ line: s.text, caption: s.caption, picture: (s.shot as { people?: { desc?: string }; product?: { visible?: boolean; in_use?: boolean } } | undefined) ? `${(s.shot as { people?: { desc?: string } }).people?.desc ?? ""}${(s.shot as { product?: { visible?: boolean } }).product?.visible ? " + the product" : ""}` : "" })), cta: d.script.cta })))}`, 0, 8192);
  if (process.env.PLAN_DEBUG) console.log("[plan] judge", JSON.stringify(j)?.slice(0, 900));
  const verdicts = (Array.isArray(j?.scripts) ? j!.scripts : []) as { i: number; claims_grounded?: boolean; verdict?: string; reason?: string }[];
  const ranking = (Array.isArray(j?.ranking) ? (j!.ranking as number[]) : ok.map((_, i) => i));
  const out: (PlannedScript & { rank: number })[] = [];
  ok.forEach((d, i) => {
    const v = verdicts.find((x) => Number(x.i) === i);
    if (v && v.claims_grounded === false) return; // hard fail: an ungrounded claim never reaches the owner
    const ready = d.gates.ok && (!v || v.verdict === "ready");
    out.push({ script: d.script, gates: d.gates, verdict: ready ? "ready" : "needs_fix", reason: !d.gates.ok ? d.gates.errors[0].msg : cut(v?.reason, 160), rank: (ranking.indexOf(i) + 1 || 9) + (ready ? 0 : 10) });
  });
  return out.sort((a, b2) => a.rank - b2.rank).map(({ rank: _r, ...rest }) => rest);
}
