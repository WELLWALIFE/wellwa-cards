// Product facts ("Product check"): GET read · POST AI draft from the owner's photos (T1) · PUT owner edit / confirm (+ T1b pronunciations).
// The confirmed facts are the only source of product truth for ad prompts (docs/ad-video-one-shot-spec.md §3).
import { NextResponse } from "next/server";
import sharp from "sharp";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { CATEGORIES } from "@/lib/poster-categories";
import { normalizeFacts, blockingFields, categoryKeyFor, seedFor, roleOf, UNWANTED_IN_POSITIVE, type ProductFacts, type ProductPhoto, type PhotoView } from "@/lib/media/product-facts";

export const maxDuration = 60;
const UUID = /^[0-9a-f-]{36}$/i;
const JUDGE_MODEL = process.env.JUDGE_MODEL || "gemini-3.5-flash";
const LITE_MODEL = "gemini-3.5-flash-lite";
const VIEWS: PhotoView[] = ["in_use", "front", "three_quarter", "back", "output_closeup", "installed", "packaging", "generated", "other"];
const SCRIPT_NAME: Record<string, string> = { hi: "Devanagari (Hindi)", hinglish: "Devanagari (Hindi)", mr: "Devanagari (Marathi)", gu: "Gujarati", pa: "Gurmukhi", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia" };
const COMMON_WORDS = ["WhatsApp", "demo", "offer", "free", "home"];

type Row = { id: string; user_id: string; name: string; photo_url: string | null; benefits: string[]; offer: string; category: string; photos: ProductPhoto[]; facts: Partial<ProductFacts>; facts_version: number; facts_confirmed_at: string | null };

async function load(token: string, uid: string, id: string) {
  const r = await restAsUser<Row[]>(token, `poster_products?id=eq.${id}&user_id=eq.${uid}&select=id,user_id,name,photo_url,benefits,offer,category,photos,facts,facts_version,facts_confirmed_at`);
  return r.data?.[0] ?? null;
}
async function gemini(model: string, body: unknown) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(50000) });
  const j = await r.json().catch(() => ({}));
  try { return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as Record<string, unknown>; } catch { return null; }
}
async function fetchImage(url: string) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); } catch { return null; }
}
const photosOf = (p: Row): ProductPhoto[] => (Array.isArray(p.photos) && p.photos.length ? p.photos : p.photo_url ? [{ url: p.photo_url, view: "front" as PhotoView, role: "identity" as const }] : []);

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request); if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params; if (!UUID.test(id)) return NextResponse.json({ error: "Bad product id." }, { status: 400 });
  const p = await load(me.token, me.id, id); if (!p) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const facts = p.facts && (p.facts as ProductFacts).v === 1 ? (p.facts as ProductFacts) : null;
  return NextResponse.json({ facts, facts_version: p.facts_version, confirmed_at: p.facts_confirmed_at, photos: photosOf(p), blocking: facts ? blockingFields(facts) : ["draft"] });
}

/** T1 — draft the facts from the photos. Free. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request); if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  const { id } = await ctx.params; if (!UUID.test(id)) return NextResponse.json({ error: "Bad product id." }, { status: 400 });
  const p = await load(me.token, me.id, id); if (!p) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const notes = String(b.notes ?? "").trim().slice(0, 400);
  const photos = photosOf(p).slice(0, 6);
  if (!photos.length) return NextResponse.json({ error: "Add at least one product photo first." }, { status: 400 });

  const parts: Record<string, unknown>[] = [];
  let n = 0;
  for (const ph of photos) {
    const buf = await fetchImage(ph.url); if (!buf) continue;
    const small = await sharp(buf).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer().catch(() => null);
    if (!small) continue;
    n += 1; parts.push({ text: `Image ${n}: ${ph.view || "untagged"}` }, { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } });
  }
  if (!n) return NextResponse.json({ error: "Could not read the product photos." }, { status: 400 });
  const category_key = categoryKeyFor(p.category);
  const cat = CATEGORIES.find((c) => c.key === category_key);
  const { seed } = seedFor(category_key);
  const removed = ((p.facts as ProductFacts)?.removed_defaults ?? []).map((x) => x.toLowerCase());
  const seedJson = JSON.stringify({ ...seed, must_not_show: (seed.must_not_show ?? []).filter((x) => !removed.includes(x.toLowerCase())) });
  const prompt = `You are documenting one physical product sold by a small Indian business so a film crew can photograph and animate it correctly. Images 1-${n} are the owner's photos. Write every value in plain English.
Product name: ${p.name}. Category: ${cat?.en ?? (p.category || "general")}. Owner benefit lines: ${(p.benefits ?? []).slice(0, 8).join("; ") || "-"}. Owner notes: ${notes || "-"}.
Seed values (keep unless the photos contradict them): ${seedJson}

Return ONLY JSON with exactly these keys:
{"label":"<generic noun phrase, 2-4 words, never the brand, e.g. 'the water ionizer'>",
 "what_it_is":"<one sentence a stranger understands>",
 "size_class":"handheld|tabletop|countertop|floor|wall|wearable|consumable|vehicle|service",
 "appearance":"<max 60 words: colour, shape, approximate size, controls, hoses or ports, materials, where the brand is printed - only what is visible>",
 "stage_positive":"<where it naturally stands or is shown, describing ONLY the surface and backdrop, e.g. 'on a clear stretch of kitchen counter against a plain tiled wall'. Do not mention sinks, taps, other appliances or clutter.>",
 "idle_positive":"<how it looks when nobody is using it, one clause>",
 "use_positive":"<only for things a person wears, eats or holds: one sentence showing correct use; else null>",
 "output":{"part":"<the ONE part through which the product delivers its result, and where on the body it is>","part_short":"<2-4 words>","medium":"water|air|light|sound|heat|food|none","receptacle":"<what receives the result and where it is held, e.g. 'a clear glass held directly beneath the end of the hose'>","action_positive":"<one sentence of correct use as it looks on camera. Name the part and the receptacle. Mention no other object.>"} or null if the product emits nothing,
 "fixed_parts":["<2-5 short part names that must always look identical>"],
 "must_show":["<2-4 positive truths about the product itself when in use>"],
 "must_not_show":["<3-6 wrong depictions an image model is likely to produce for this product, as noun phrases without the word 'no'>"],
 "hands":"none|edge|operating","people_default":"<typical user, Indian context>","settings":["<2-4 rooms or places>"],
 "benefits":["<max 6 outcomes in the viewer's words, English>"],"banned_claims":["<claims this category must never make>"],
 "photo_views":[{"index":1,"view":"in_use|front|three_quarter|back|output_closeup|installed|packaging|other"}],
 "inferred":["<names of the keys above whose value you guessed rather than saw>"]}
Rules: describe only what is visible or stated by the owner. Never invent model numbers, prices, awards, certifications or numbers. Countertop, floor and wall products are never held in a hand.`;
  const body = (extra = "") => ({ contents: [{ parts: [...parts, { text: prompt + extra }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 8192 } });
  let raw = await gemini(JUDGE_MODEL, body()) ?? await gemini(JUDGE_MODEL, body());
  if (!raw) return NextResponse.json({ error: "Could not read the photos — try again." }, { status: 502 });
  // Image models draw whatever is named: a staging / usage sentence must never name the unwanted objects. Re-ask once, else blank it.
  const bad = (r: Record<string, unknown>) => UNWANTED_IN_POSITIVE.test(String(r.stage_positive ?? "")) || UNWANTED_IN_POSITIVE.test(String((r.output as Record<string, unknown> | null)?.action_positive ?? ""));
  if (bad(raw)) raw = (await gemini(JUDGE_MODEL, body(`\nIMPORTANT: your previous "stage_positive" or "action_positive" mentioned a tap, faucet or sink. Rewrite them so they name ONLY the product, its own part, the receptacle, the surface and the backdrop.`))) ?? raw;
  const unverified = [...new Set([...(Array.isArray(raw.inferred) ? raw.inferred.map(String) : []), ...(bad(raw) ? ["stage_positive", "output"] : [])])];
  const prev = (p.facts as ProductFacts)?.v === 1 ? (p.facts as ProductFacts) : null;
  const facts = normalizeFacts({ ...raw, unverified, proof: prev?.proof ?? [], offers: prev?.offers ?? [], removed_defaults: prev?.removed_defaults ?? [], pronunciations: prev?.pronunciations ?? {} }, { name: p.name, category: p.category, benefits: p.benefits, offer: p.offer, prev });
  // view tags suggested by the model fill only untagged ("other") photos
  const views = Array.isArray(raw.photo_views) ? (raw.photo_views as { index?: number; view?: string }[]) : [];
  const tagged = photos.map((ph, i) => { const v = views.find((x) => Number(x.index) === i + 1)?.view as PhotoView | undefined; const view = ph.view && ph.view !== "other" ? ph.view : v && VIEWS.includes(v) ? v : ph.view || "other"; return { ...ph, view, role: roleOf(view) }; });
  const w = await restAsUser(me.token, `poster_products?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ facts, photos: tagged, facts_confirmed_at: null }) });
  if (!w.ok) return NextResponse.json({ error: "Could not save the draft." }, { status: 500 });
  return NextResponse.json({ facts, photos: tagged, blocking: blockingFields(facts), facts_version: p.facts_version });
}

/** Owner edit. { facts, confirm?: boolean, langs?: string[], point?: {photo,x,y} } */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request); if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params; if (!UUID.test(id)) return NextResponse.json({ error: "Bad product id." }, { status: 400 });
  const p = await load(me.token, me.id, id); if (!p) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  if (!b.facts || typeof b.facts !== "object") return NextResponse.json({ error: "Facts are missing." }, { status: 400 });
  const prev = (p.facts as ProductFacts)?.v === 1 ? (p.facts as ProductFacts) : null;
  // everything the owner has just looked at and saved is verified
  const seen: string[] = Array.isArray(b.verified) ? b.verified.map(String) : [];
  const stillUnverified = (Array.isArray(b.facts.unverified) ? b.facts.unverified.map(String) : prev?.unverified ?? []).filter((u: string) => !seen.includes(u));
  const facts = normalizeFacts({ ...b.facts, unverified: stillUnverified }, { name: p.name, category: p.category, benefits: p.benefits, offer: p.offer, prev });
  let photos = photosOf(p);

  // Tap-to-point: crop a 40% box around the output as an extra identity reference.
  const pt = facts.output?.point;
  if (pt && photos[pt.photo] && JSON.stringify(pt) !== JSON.stringify(prev?.output?.point ?? null)) {
    const buf = await fetchImage(photos[pt.photo].url);
    const meta = buf ? await sharp(buf).rotate().metadata().catch(() => null) : null;
    if (buf && meta?.width && meta?.height) {
      const side = Math.round(Math.min(meta.width, meta.height) * 0.4);
      const left = Math.max(0, Math.min(meta.width - side, Math.round(pt.x * meta.width - side / 2)));
      const top = Math.max(0, Math.min(meta.height - side, Math.round(pt.y * meta.height - side / 2)));
      const crop = await sharp(buf).rotate().extract({ left, top, width: side, height: side }).resize(900, 900, { fit: "cover" }).png().toBuffer().catch(() => null);
      if (crop) {
        const key = `poster/${me.id}/product-${id}-output.png`;
        const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { ...serviceHeaders(), "Content-Type": "image/png", "x-upsert": "true" }, body: new Uint8Array(crop) });
        if (up.ok) photos = [...photos.filter((x) => !x.generated_crop), { url: `${SUPA_URL}/storage/v1/object/public/media/${key}?v=${Date.now()}`, view: "output_closeup", role: "identity", w: 900, h: 900, generated_crop: true }];
      }
    }
  }

  const confirm = b.confirm === true;
  const blocking = blockingFields(facts);
  if (confirm && blocking.length) return NextResponse.json({ error: "Please check the highlighted answers first.", blocking }, { status: 400 });
  if (confirm) {
    facts.confirmed_by_owner = true;
    // T1b — how the narrator says the brand, per language the owner uses (kept if already present / edited)
    const langs: string[] = (Array.isArray(b.langs) ? b.langs.map(String) : ["hinglish"]).filter((l: string) => SCRIPT_NAME[l]).slice(0, 4);
    const brandWords = p.name.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z0-9-]{2,}$/.test(w)).slice(0, 4);
    if (process.env.GEMINI_API_KEY && brandWords.length) {
      for (const lang of langs) {
        if (facts.pronunciations[lang] && brandWords.every((w) => facts.pronunciations[lang][w])) continue;
        const out = await gemini(LITE_MODEL, { contents: [{ parts: [{ text: `Write how an Indian ad narrator pronounces each of these words, spelled phonetically in ${SCRIPT_NAME[lang]} script. Return ONLY JSON {"<word>":"<spelling>"}. Words: ${[...brandWords, ...COMMON_WORDS].join(", ")}` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } });
        if (out) facts.pronunciations[lang] = { ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, String(v).slice(0, 60)]).filter(([, v]) => v && !/[A-Za-z]/.test(v))), ...(facts.pronunciations[lang] ?? {}) };
      }
    }
  }
  const patch: Record<string, unknown> = { facts, photos };
  if (confirm) { patch.facts_version = (p.facts_version ?? 0) + 1; patch.facts_confirmed_at = new Date().toISOString(); }
  else if (prev?.confirmed_by_owner) patch.facts_confirmed_at = null; // edited after confirmation → needs a fresh confirm
  const w = await restAsUser(me.token, `poster_products?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!w.ok) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ facts, photos, blocking, facts_version: confirm ? (p.facts_version ?? 0) + 1 : p.facts_version, confirmed: confirm });
}
