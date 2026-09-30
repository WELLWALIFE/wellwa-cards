// Gemini TTS is unreliable on Roman-script Indian text: a Latin-only Hinglish
// line ("Wellwa Elite Maxx lata hai pure alkaline drinking water.") can come
// back finishReason:"OTHER" with no audio on every retry, and Hindi words in
// Roman letters are pronounced badly ("karein"). Rewriting the line in the
// language's own script first fixes both — verified live: every failing line
// passed once in Devanagari, with or without the style preamble.
const SCRIPT = { hi: "Devanagari (Hindi)", hinglish: "Devanagari (Hindi)", mr: "Devanagari (Marathi)", gu: "Gujarati", pa: "Gurmukhi (Punjabi)", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia" };
const cache = new Map();

/** Returns the line rewritten in the language's native script (English words and brand names phonetically), or the original when not applicable / on failure. */
export async function nativeScript(text, lang, key, glossary = null) {
  const script = SCRIPT[lang];
  const t = String(text ?? "").trim();
  if (!script || !key || !/[A-Za-z]/.test(t)) return t;
  const gl = glossary && Object.keys(glossary).length ? Object.entries(glossary).map(([k, v]) => `${k} → ${v}`).join(", ") : "";
  const ck = `${lang}|${gl}|${t}`;
  if (cache.has(ck)) return cache.get(ck);
  const prompt = `Rewrite this line in ${script} script for a text-to-speech engine. Keep the meaning and word order exactly, do not translate or add words. Write English words and brand/product names phonetically as they are pronounced in English (examples for Devanagari: "pure" → "प्योर", "home demo" → "होम डेमो", "Wellwa" → "वेलवा", "water" → "वॉटर"). ${gl ? `Use EXACTLY these spellings when these words appear: ${gl}. ` : ""}Keep digits (phone numbers, prices, %) as digits. Output only the rewritten line, nothing else.\n\n${t}`;
  // Never fail silently: a line that stays in Roman letters is pronounced badly (owner report 2026-09-17 — the API was
  // returning 429 "prepayment credits are depleted" and the old code quietly spoke the Roman text).
  const latin = (x) => (x.match(/[A-Za-z]/g) || []).length;
  let lastErr = "", prompt2 = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt + prompt2 }] }], generationConfig: { temperature: 0, maxOutputTokens: 1024 } }), signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (j.error) { lastErr = `${j.error.code} ${String(j.error.message).slice(0, 120)}`; if (/depleted|billing|API key/i.test(lastErr)) break; await new Promise((res) => setTimeout(res, 1500)); continue; }
      const out = String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/^["“']+|["”']+$/g, "").replace(/\s+/g, " ").trim();
      if (out && latin(out) === 0 && out.length >= t.length * 0.4 && out.length <= t.length * 3) { cache.set(ck, out); return out; }
      if (out && latin(out) > 0) prompt2 = ` Your last answer still contained Latin letters (${(out.match(/[A-Za-z]+/g) || []).slice(0, 4).join(", ")}). Write EVERY word, including English words like these, phonetically in ${script} script — the output must contain NO Latin letters at all.`;
      lastErr = `unusable output: ${out.slice(0, 60)}`;
    } catch (e) { lastErr = String(e?.message ?? e).slice(0, 120); }
  }
  console.error(`[tts-script] NATIVE SCRIPT FAILED (${lang}) — the line will be spoken from Roman text and may be mispronounced: ${lastErr} | "${t.slice(0, 60)}"`);
  nativeScript.lastError = lastErr;
  return t;
}
