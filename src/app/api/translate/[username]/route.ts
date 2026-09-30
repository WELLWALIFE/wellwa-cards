// On-demand card translation for visitors.
// POST { lang } → { strings: { "<original>": "<translated>", … } }
//
// The card's own text is whatever the owner typed (any language), so we send
// the visible strings to Claude and cache the result per card+language in
// memory. Falls back to the original text if AI isn't configured.

import { geminiComplete } from "@/lib/gemini";
import { fetchCloudCard, fetchCardPaused } from "@/lib/supabase/public";
import { clientKey, publicAiAllowed, rateLimited, sameOriginStrict } from "@/lib/api-security";
import { getCardByUsername } from "@/lib/sample-data";
import type { Card, CardBlock } from "@/lib/types";

export const LANGS: Record<string, string> = {
  en: "English",
  hi: "Hindi (Devanagari script)",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi (Gurmukhi script)",
};

// Two-level cache: process memory (instant) backed by a Supabase table so a
// translation is generated ONCE per card+language, ever — surviving restarts
// and shared across visitors.
const cache = new Map<string, Record<string, string>>();
const MAX_CACHE = 200;

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
function svcHeaders() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" };
}

async function loadStored(username: string, lang: string): Promise<Record<string, string> | null> {
  if (!SUPA || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPA}/rest/v1/card_translations?username=eq.${encodeURIComponent(username)}&lang=eq.${lang}&select=strings`,
      { headers: svcHeaders(), cache: "no-store" },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows?.[0]?.strings as Record<string, string>) ?? null;
  } catch {
    return null;
  }
}

async function store(username: string, lang: string, strings: Record<string, string>) {
  if (!SUPA || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPA}/rest/v1/card_translations?on_conflict=username,lang`, {
      method: "POST",
      headers: { ...svcHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ username, lang, strings, updated_at: new Date().toISOString() }),
    });
  } catch { /* best effort */ }
}

const CHUNK = 45;

/**
 * Translate one batch. The model answers with an object keyed by the input
 * index — a positional array is fragile: drop or merge a single element and
 * every later string wears its neighbour's translation (a tab once read as a
 * product name). With keys, a missing entry just stays in English. On a
 * truncated reply, salvage every complete pair.
 */
async function translateChunk(apiKey: string, target: string, part: string[]): Promise<string[]> {
  const numbered = Object.fromEntries(part.map((s, i) => [String(i), s]));
  const { text, blocked } = await geminiComplete({
    apiKey,
    maxOutputTokens: 8000,
    contents: [{
      role: "user",
      parts: [{ text: `Translate each value in this JSON object into ${target}.

Rules:
- Return ONLY a JSON object with the SAME keys ("0", "1", …); each value is that string's translation.
- Keep numbers, prices (₹), units (pH, mV, ppb, ml), model names and brand names unchanged.
- Keep the tone natural and short, as on a business card.
- If a value is already in ${target}, return it unchanged.

${JSON.stringify(numbered)}` }],
    }],
  });
  if (blocked || !text) return [];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const out: string[] = [];
  const take = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < part.length && typeof v === "string" && v.trim()) out[i] = v;
    }
  };
  try {
    take(JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>);
  } catch {
    const re = /"(\d+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    const body = text.slice(start + 1);
    while ((m = re.exec(body))) {
      try { take({ [m[1]]: JSON.parse(`"${m[2]}"`) }); } catch { /* skip a broken pair */ }
    }
  }
  return out;
}

/** Every human-readable string on a card, in render order. */
function collect(card: Card): string[] {
  const out: string[] = [card.jobTitle, card.company, card.tagline, card.about];
  for (const p of card.pages) {
    out.push(p.label);
    for (const b of p.blocks) out.push(...blockStrings(b));
  }
  return [...new Set(out.map((s) => (s ?? "").trim()).filter((s) => s.length > 1))];
}

function blockStrings(b: CardBlock): string[] {
  const s: string[] = [b.title];
  switch (b.kind) {
    case "about": s.push(b.body); break;
    case "highlights": s.push(...b.items); break;
    case "services": b.items.forEach((i) => s.push(i.name, i.desc)); break;
    case "product":
      b.items.forEach((p) => {
        s.push(p.name, p.desc ?? "", p.badge ?? "", p.ctaLabel ?? "");
        s.push(...p.features);
        p.specs.forEach((sp) => s.push(sp.label, sp.value));
      });
      break;
    case "gallery": b.images.forEach((i) => s.push(i.label)); break;
    case "image": b.images.forEach((i) => s.push(i.caption ?? "")); break;
    case "carousel": b.images.forEach((i) => s.push(i.caption ?? "")); break;
    case "video": s.push(b.caption); break;
    case "pdf": s.push(b.fileLabel); if (b.hint) s.push(b.hint); break;
    case "testimonials": b.items.forEach((t) => s.push(t.name, t.text)); break;
    case "faq": b.items.forEach((f) => s.push(f.q, f.a)); break;
    case "hours": b.rows.forEach((r) => s.push(r.day, r.time)); break;
    case "appointment": s.push(b.note); break;
    case "location": s.push(b.address); break;
    case "offer": s.push(b.text, b.expires); break;
    case "cta": s.push(b.body ?? "", b.joinLabel); break;
    case "contact": if (b.note) s.push(b.note); break;
    case "compare": s.push(b.leftLabel, b.rightLabel); b.rows.forEach((r) => s.push(r.feature, r.left, r.right)); break;
  }
  return s;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  if (!sameOriginStrict(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(clientKey(request, "translate"), 8, 10 * 60_000)) {
    return Response.json({ error: "translation limit reached" }, { status: 429 });
  }
  const { username } = await params;
  const body = (await request.json()) as { lang?: string };
  const lang = body.lang ?? "";
  const target = LANGS[lang];
  if (!target) return Response.json({ error: "unsupported language" }, { status: 400 });
  if (lang === "en") return Response.json({ strings: {} }); // originals are the baseline

  const card = (await fetchCloudCard(username)) ?? getCardByUsername(username);
  if (!card) return Response.json({ error: "card not found" }, { status: 404 });
  // Every live card translates, free ones too (owner's report, 28 Sep 2026: the language switch did nothing on a free
  // card — this answered 402 for any card without a paid plan, while the switch is shown on all of them). Only a
  // paused card (its year ended, not renewed) is refused; its link shows the renew page anyway.
  if (await fetchCardPaused(username)) return Response.json({ error: "translation unavailable" }, { status: 402 });

  const strings = collect(card);
  const key = `${username}:${lang}:${strings.length}:${strings.join("|").length}`;

  const hit = cache.get(key);
  if (hit) return Response.json({ strings: hit, cached: "memory" });

  // Persisted from an earlier visit — only reuse if it still covers the card
  // (a stale row would miss strings the owner has since added).
  const stored = await loadStored(username, lang);
  if (stored && strings.every((s) => stored[s])) {
    cache.set(key, stored);
    return Response.json({ strings: stored, cached: "db" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ strings: {}, demo: true });
  // Platform-wide daily AI cap (owner's review, 28 Sep 2026); the card simply stays in its own language.
  if (!publicAiAllowed("translate")) return Response.json({ strings: {}, error: "daily translation limit" }, { status: 429 });

  try {
    // A full card is now hundreds of strings — far more than one model reply
    // can hold before its output cap truncates the JSON (which used to fail
    // the whole translation with "Unexpected end of JSON input"). Translate in
    // small parallel chunks and merge, so one bad chunk costs a few strings,
    // not the language.
    const chunks: string[][] = [];
    for (let i = 0; i < strings.length; i += CHUNK) chunks.push(strings.slice(i, i + CHUNK));
    const results = await Promise.all(chunks.map((part) => translateChunk(apiKey, target, part)));

    const map: Record<string, string> = {};
    chunks.forEach((part, ci) => part.forEach((s, i) => { const v = results[ci]?.[i]; if (v) map[s] = String(v); }));
    if (!Object.keys(map).length) return Response.json({ strings: {}, error: "empty translation" });

    // A model reply occasionally skips a key or two; one small follow-up call
    // for just those strings makes the card complete instead of "almost".
    const missing = strings.filter((s) => !map[s]);
    if (missing.length && missing.length <= 2 * CHUNK) {
      const again = await Promise.all(
        Array.from({ length: Math.ceil(missing.length / CHUNK) }, (_, k) => missing.slice(k * CHUNK, (k + 1) * CHUNK))
          .map((part) => translateChunk(apiKey, target, part).then((r) => [part, r] as const)),
      );
      for (const [part, r] of again) part.forEach((s, i) => { if (r[i]) map[s] = String(r[i]); });
    }

    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(key, map);
    store(username, lang, map).catch(() => {}); // persist for every future visitor
    return Response.json({ strings: map });
  } catch (e) {
    return Response.json({ strings: {}, error: e instanceof Error ? e.message : "failed" });
  }
}
