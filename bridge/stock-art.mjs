// Stock art for the daily poster and the status video — real photos and clips (Pexels, free for commercial use)
// instead of AI paintings, chosen by eye so they fit the business AND the day, and cached per (day-theme, business
// category) so one search serves every user in that trade. Nothing here costs credits.
//   ensureStockArt({ theme, category, kind, dateStr }) → { file, credit } | null   (1080×1440 PNG in BASE_DIR/stock)
//   ensureStockClip({ theme, category, kind, dateStr }) → { file, credit } | null  (≤15 s 1080×1920 mp4)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pexelsList } from "./stock-reel.mjs";

const run = promisify(execFile);
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* none */ }
const PEXELS = env.PEXELS_API_KEY || "", GEMINI = env.GEMINI_API_KEY || "";
// Same binary the status video uses: the server keeps ffmpeg outside PATH.
const FFMPEG = env.FFMPEG_PATH || env.WA_FFMPEG || (fs.existsSync("/opt/neuraledge/bin/ffmpeg") ? "/opt/neuraledge/bin/ffmpeg" : "ffmpeg");
const DIR = path.join(APP, "public", "poster", "base", "stock");
const CLIPS = path.join(DIR, "clips");
const JUDGE = "gemini-3.5-flash-lite";
const log = (...a) => console.log("[stock]", ...a);
const inflight = new Map();

/** What a trade sells, in words a photo search understands. Unknown categories fall back to the words themselves. */
const CATEGORY_WORDS = {
  water: "water purifier clean drinking water glass", ro: "water purifier clean drinking water", kirana: "indian grocery store shelves fresh groceries", grocery: "grocery store fresh vegetables",
  clothing: "clothing boutique fabric ethnic wear", boutique: "fashion boutique fabric", jewellery: "gold jewellery close up", jewelry: "gold jewellery close up",
  salon: "hair salon beauty care", beauty: "beauty parlour makeup", restaurant: "indian food thali restaurant", food: "indian food homemade", sweets: "indian sweets mithai", bakery: "bakery cake pastry",
  mobile: "smartphone shop accessories", electronics: "electronics gadgets shop", furniture: "modern furniture home interior", interior: "home interior design", realestate: "modern house apartment building", property: "apartment building city",
  insurance: "family protection happy indian family", finance: "savings money growth", education: "students classroom learning", school: "indian school students classroom uniform", playschool: "kids play school colourful classroom toys", coaching: "students studying books", tuition: "children studying",
  gym: "gym fitness workout", fitness: "yoga fitness morning", pharmacy: "medical store medicines", clinic: "doctor clinic healthcare", hospital: "hospital doctor care", dental: "dentist smile",
  travel: "travel india mountains road trip", tours: "travel destination india", auto: "car service garage", automobile: "car showroom", bike: "motorcycle showroom",
  agriculture: "indian farmer green field", solar: "solar panels rooftop sun", hardware: "hardware tools shop", construction: "construction building site", paint: "house painting colours",
  flowers: "flower shop bouquet", gifts: "gift box celebration", toys: "children toys shop", stationery: "stationery shop books pens", photography: "camera photographer studio", events: "wedding decoration event", wedding: "indian wedding decoration",
  mlm: "business team success handshake", network: "business team growth", default: "small business shop owner india",
};
const words = (category) => { const k = String(category || "").toLowerCase().replace(/[^a-z]/g, ""); return CATEGORY_WORDS[k] || (k ? k.replace(/s$/, "") + " shop india" : CATEGORY_WORDS.default); };

/** Occasions a stock-photo search can actually show: festivals with their own look (diyas, rangoli, colours, kites,
 *  a tree, a rakhi). A jayanti, a national day or an awareness day has no such photo on Pexels — the search came
 *  back with any Indian man in a garland for Gandhi Jayanti (seen live, 2 Oct 2026) — so those days keep the
 *  painted art made from the occasion's own theme line (charkha and round glasses, the tricolour…). */
const PHOTO_OCCASIONS = new Set(["newyear", "sankranti", "baisakhi", "christmas", "navratri", "dussehra", "karwachauth", "dhanteras", "diwali", "govardhan", "bhaidooj", "chhath", "gurunanak", "basantpanchami", "holi", "eid", "bakrid", "rakhi", "janmashtami", "ganesh", "onam", "mothersday", "fathersday"]);
export function stockFitsOccasion(theme) {
  return theme?.kind !== "occasion" || PHOTO_OCCASIONS.has(String(theme?.slug || ""));
}

/** Search queries for the day: festival days lead with the festival, business days with the trade. */
export function stockQueries(theme, category, kind) {
  const trade = words(category);
  const fest = String(theme?.en || theme?.slug || "").replace(/[-_]/g, " ");
  if (kind === "festival") return [`${fest} celebration india`, `${fest} diya rangoli lights`, `indian festival decoration lights`, `festive lights bokeh`];
  if (kind === "benefit" || kind === "product") return [trade, `${trade} close up`, `indian ${trade}`, "clean minimal background product"];
  if (kind === "offer") return [`${trade} sale`, trade, "shopping bags happy indian family", "celebration confetti"];
  // greeting / motivation / tip
  return [`morning sunlight ${trade.split(" ")[0]}`, "good morning sunrise india", "tea cup morning light", "nature calm sunrise"];
}

async function gemini(parts) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(45000),
  }).then((x) => x.json());
  const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
  return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
}

/** Pexels photo candidates: portrait (the classic poster art) or landscape (the Signature photo window), big enough, with a small preview for the judge. */
async function photoList(query, orientation = "portrait") {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&size=large&per_page=12&locale=en-US`, { headers: { Authorization: PEXELS }, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}));
  return (r.photos ?? []).filter((p) => (orientation === "landscape" ? p.width >= 1600 : p.height >= 1400)).map((p) => ({ id: p.id, url: p.src?.large2x || p.src?.large || p.src?.original, thumb: p.src?.medium, credit: p.photographer || "" }));
}

/** The judge sees the previews and scores each: does it fit this trade AND this day, is it clean (no text, no wrong faces)? */
async function judge(cands, { theme, category, kind, window = false }) {
  const parts = [];
  for (const [k, c] of cands.entries()) {
    try { const buf = Buffer.from(await (await fetch(c.thumb, { signal: AbortSignal.timeout(15000) })).arrayBuffer()); const small = await sharp(buf).resize({ width: 320 }).jpeg({ quality: 75 }).toBuffer(); parts.push({ text: `Photo ${k}:` }, { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }); } catch { /* skip */ }
  }
  if (!parts.length) return [];
  const want = kind === "festival" ? `a ${theme?.en || "festival"} greeting poster` : kind === "greeting" ? "a good-morning / motivational greeting poster" : `a promotional poster for a ${category || "small"} business (${words(category)})`;
  // window: the Signature layouts show the photo in its own frame — nothing is printed over it, so no calm space needed
  parts.push({ text: `These photos are candidates for the ${window ? "PHOTO of" : "BACKGROUND of"} ${want}, made for customers in INDIA.${window ? "" : " A name, phone number and a short line of text will be printed over the photo later."}
Score each photo 0–10 for FIT: does it clearly belong to this trade / occasion and look premium, bright and clean?${kind === "festival" ? ` For an occasion the photo must UNMISTAKABLY show that occasion's own symbols (its lamps, colours, food, decoration, ritual); a person, a garland, a crowd or a street that could be any day of the year scores 3 or less.` : ""} Then CLEAN true/false: no visible text, logos, watermarks or screens with writing; people, if any, look Indian / South Asian and are dressed the way an Indian family business would show them; nothing like alcohol, smoking or meat close-ups${window ? "" : "; there is calm space (sky, wall, blur) where text could sit"}.
Return ONLY JSON {"photos":[{"n":0,"fit":0,"clean":true,"note":"<max 6 words>"}]}` });
  try { const j = await gemini(parts); return (j.photos ?? []).map((p) => ({ n: Number(p.n), fit: Number(p.fit) || 0, clean: p.clean !== false })); } catch { return null; }
}

const keyFor = (theme, category, kind, dateStr) => {
  const cat = String(category || "default").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "default";
  // festivals: one art per festival+trade, reused every year; business days rotate weekly so followers see variety
  const week = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / (7 * 86400_000)) % 6;
  return kind === "festival" ? `${theme.slug}-${cat}` : `${kind}-${cat}-w${week}`;
};

async function pickPhoto(theme, category, kind, orientation = "portrait", skip = new Set()) {
  if (!PEXELS) return null;
  const used = new Set(skip);
  for (const q of stockQueries(theme, category, kind)) {
    const cands = (await photoList(q, orientation)).filter((c) => c.url && !used.has(c.id)).slice(0, 8);
    if (!cands.length) continue;
    cands.forEach((c) => used.add(c.id));
    const scores = await judge(cands, { theme, category, kind, window: orientation === "landscape" });
    if (scores === null) { log(`judge down → first result for "${q}"`); return { ...cands[0], score: 0, q }; }
    const best = scores.filter((s) => s.clean && s.fit >= 7).sort((a, b) => b.fit - a.fit)[0];
    if (best && cands[best.n]) { log(`"${q}" → photo ${best.n} fit ${best.fit}`); return { ...cands[best.n], score: best.fit, q }; }
    log(`"${q}": nothing ≥7 (${scores.map((s) => `${s.n}:${s.fit}${s.clean ? "" : "x"}`).join(" ")}) → next query`);
  }
  return null;
}

export async function ensureStockArt({ theme, category = "", kind = "greeting", dateStr }) {
  fs.mkdirSync(DIR, { recursive: true });
  const key = keyFor(theme, category, kind, dateStr);
  const file = path.join(DIR, `${key}.png`), meta = path.join(DIR, `${key}.json`);
  if (fs.existsSync(file)) { try { return { file, ...JSON.parse(fs.readFileSync(meta, "utf8")) }; } catch { return { file }; } }
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const hit = await pickPhoto(theme, category, kind);
    if (!hit) return null;
    const buf = Buffer.from(await (await fetch(hit.url, { signal: AbortSignal.timeout(30000) })).arrayBuffer());
    // top-weighted crop keeps skies and headroom; a gentle darken at the bottom third makes the printed text readable
    const png = await sharp(buf).resize(1080, 1440, { fit: "cover", position: "attention" })
      .composite([{ input: Buffer.from(`<svg width="1080" height="1440"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs><rect width="1080" height="1440" fill="url(#g)"/></svg>`), blend: "over" }])
      .png().toBuffer();
    fs.writeFileSync(file, png);
    const info = { credit: hit.credit, source: "pexels", id: hit.id, query: hit.q, score: hit.score, kind, category, at: new Date().toISOString() };
    fs.writeFileSync(meta, JSON.stringify(info));
    return { file, ...info };
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** A clean landscape photo for the Signature posters (no darkening baked in — the layout does its own): 1600×1000 JPEG,
 *  chosen and judged like the portrait art, cached per trade + kind + week (festivals per festival + trade). */
export async function ensureStockPhoto({ theme, category = "", kind = "greeting", dateStr }) {
  const dir = path.join(DIR, "photo"); fs.mkdirSync(dir, { recursive: true });
  // Business days rotate through six photos of the trade (one per day, never the same two days running); a festival
  // keeps one photo per festival + trade. Each slot is fetched once and then reused forever.
  const cat = String(category || "default").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "default";
  const day = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 86400_000);
  const key = kind === "festival" ? `${theme.slug}-${cat}-land` : `${kind}-${cat}-d${day % 6}-land`;
  const file = path.join(dir, `${key}.jpg`), meta = path.join(dir, `${key}.json`);
  if (fs.existsSync(file)) { try { return { file, ...JSON.parse(fs.readFileSync(meta, "utf8")) }; } catch { return { file }; } }
  const ik = `photo:${key}`;
  if (inflight.has(ik)) return inflight.get(ik);
  const p = (async () => {
    // the other slots' photos of this trade are skipped so the six days really differ
    const skip = new Set();
    for (const f of fs.readdirSync(dir)) if (f.startsWith(`${kind}-${cat}-`) && f.endsWith(".json")) { try { const id = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).id; if (id) skip.add(id); } catch { /* skip */ } }
    const hit = await pickPhoto(theme, category, kind, "landscape", skip);
    if (!hit) return null;
    const buf = Buffer.from(await (await fetch(hit.url, { signal: AbortSignal.timeout(30000) })).arrayBuffer());
    await sharp(buf).resize(1600, 1000, { fit: "cover", position: "attention" }).jpeg({ quality: 88, mozjpeg: true }).toFile(file);
    const info = { credit: hit.credit, source: "pexels", id: hit.id, query: hit.q, score: hit.score, kind, category, at: new Date().toISOString() };
    fs.writeFileSync(meta, JSON.stringify(info));
    log(`photo "${hit.q}" → ${hit.id} (${key})`);
    return { file, ...info };
  })().finally(() => inflight.delete(ik));
  inflight.set(ik, p);
  return p;
}

/** A 10–15 s portrait clip for the status video, same choosing and caching as the photos. */
export async function ensureStockClip({ theme, category = "", kind = "greeting", dateStr }) {
  if (!PEXELS) return null;
  fs.mkdirSync(CLIPS, { recursive: true });
  const key = keyFor(theme, category, kind, dateStr);
  const file = path.join(CLIPS, `${key}.mp4`), meta = path.join(CLIPS, `${key}.json`);
  if (fs.existsSync(file)) { try { return { file, ...JSON.parse(fs.readFileSync(meta, "utf8")) }; } catch { return { file }; } }
  const ik = `clip:${key}`;
  if (inflight.has(ik)) return inflight.get(ik);
  const p = (async () => {
    const H = { PEXELS, GEMINI, log };
    for (const q of stockQueries(theme, category, kind)) {
      const cands = (await pexelsList(H, q)).filter((c) => c.dur >= 6).slice(0, 8);
      if (!cands.length) continue;
      const scores = await judge(cands, { theme, category, kind });
      const pick = scores === null ? cands[0] : (() => { const b = scores.filter((s) => s.clean && s.fit >= 7).sort((a, b) => b.fit - a.fit)[0]; return b ? cands[b.n] : null; })();
      if (!pick) continue;
      const raw = file.replace(/\.mp4$/, "-raw.mp4");
      fs.writeFileSync(raw, Buffer.from(await (await fetch(pick.url, { signal: AbortSignal.timeout(60000) })).arrayBuffer()));
      // 12 s, 1080×1920 cover, light grade, no audio (music is added by the status render)
      try {
        await run(FFMPEG, ["-y", "-loglevel", "error", "-i", raw, "-t", "12", "-an", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.04:saturation=1.05,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], { timeout: 180_000 });
      } catch (e) {
        log(`clip ffmpeg failed (${FFMPEG}): ${e && e.message ? e.message.slice(0, 200) : e}`);
        try { fs.unlinkSync(raw); } catch { /* ignore */ }
        try { fs.unlinkSync(file); } catch { /* ignore */ }
        continue;
      }
      try { fs.unlinkSync(raw); } catch { /* ignore */ }
      const info = { credit: pick.credit, source: "pexels", id: pick.id, query: q, kind, category, at: new Date().toISOString() };
      fs.writeFileSync(meta, JSON.stringify(info));
      log(`clip "${q}" → ${pick.id}`);
      return { file, ...info };
    }
    return null;
  })().finally(() => inflight.delete(ik));
  inflight.set(ik, p);
  return p;
}

/** The day's content kind: festival days are festivals; other days rotate product / benefit / greeting / offer. */
export function rosterKind(theme, dateStr, { hasProducts = false } = {}) {
  if (theme?.kind === "occasion") return "festival";
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 Sun
  const withProducts = ["greeting", "product", "benefit", "greeting", "product", "benefit", "offer"];
  const without = ["greeting", "greeting", "tip", "greeting", "greeting", "tip", "offer"];
  return (hasProducts ? withProducts : without)[dow];
}

/* ======================= card media: photos + a short clip per trade ======================= */
// The V-Card builder fills a card that has no photos of its own with 4–6 real, judged stock photos of the trade
// and one 12-second landscape clip. Cached per category under public/poster/base/stock/card (served by
// /api/stock/…), so a trade costs a few API calls once and every later card of that trade is free.
const CARD_DIR = path.join(DIR, "card");
const CARD_URL = (f) => `/api/stock/${path.basename(f)}`;

async function landscapePhotos(query) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=15&locale=en-US`, { headers: { Authorization: PEXELS }, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}));
  return (r.photos ?? []).filter((p) => p.width >= 1600).map((p) => ({ id: p.id, url: p.src?.large2x || p.src?.large || p.src?.original, thumb: p.src?.medium, credit: p.photographer || "" }));
}
async function landscapeClips(query) {
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=landscape&size=medium&per_page=12`, { headers: { Authorization: PEXELS }, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}));
  return (r.videos ?? []).filter((v) => (v.duration ?? 0) >= 6).map((v) => { const f = (v.video_files ?? []).filter((x) => x.width >= 1280 && x.width <= 2560 && x.width > x.height && /mp4/.test(x.file_type ?? "mp4")).sort((a, b) => Math.abs(a.width - 1920) - Math.abs(b.width - 1920))[0]; return f ? { id: v.id, url: f.link, thumb: v.image, credit: v.user?.name || "", dur: Number(v.duration) || 0 } : null; }).filter(Boolean);
}
/** Judge for card media: does it show THIS trade, premium and clean, people Indian if any, no text. */
async function judgeCard(cands, label, what) {
  const parts = [];
  for (const [k, c] of cands.entries()) {
    try { const buf = Buffer.from(await (await fetch(c.thumb, { signal: AbortSignal.timeout(15000) })).arrayBuffer()); const small = await sharp(buf).resize({ width: 320 }).jpeg({ quality: 75 }).toBuffer(); parts.push({ text: `${what} ${k}:` }, { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }); } catch { /* skip */ }
  }
  if (!parts.length) return [];
  parts.push({ text: `These are candidates for the photo gallery of a "${label}" business's digital visiting card in INDIA — a customer should look and think "yes, this is that kind of business".
Score each 0–10 for FIT (clearly this trade, premium, bright, real-looking, not a stock cliché) and CLEAN true/false (no readable text, logos, watermarks or screens; people, if any, look Indian / South Asian and appropriately dressed; nothing offensive; no alcohol, smoking or gore).
Return ONLY JSON {"items":[{"n":0,"fit":0,"clean":true}]}` });
  try { const j = await gemini(parts); return (j.items ?? []).map((p) => ({ n: Number(p.n), fit: Number(p.fit) || 0, clean: p.clean !== false })); } catch { return null; }
}

/**
 * Photos and a clip for a trade. `category` is the poster category key (e.g. "salon"), `label` its English name
 * ("Salon / beauty parlour"). Returns { photos:[{url,credit}], clip:{url,credit}|null } — url paths are public.
 */
// A pool of 12 per trade, not 6, so two shops of one trade never open on the same picture (owner's call, 4 Oct
// 2026: "har site same image"); the builder picks its six from the pool by the business's name. Stored at 1800px,
// quality 85, because the hero shows it full-width. "-v2" so the older six-photo caches are made again.
export async function ensureCardMedia({ category, label = "", want = 12 }) {
  if (!PEXELS) return { photos: [], clip: null };
  fs.mkdirSync(CARD_DIR, { recursive: true });
  const cat = String(category || "other").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "other";
  const meta = path.join(CARD_DIR, `${cat}-v2.json`);
  if (fs.existsSync(meta)) {
    try { const m = JSON.parse(fs.readFileSync(meta, "utf8")); if ((m.photos ?? []).every((p) => fs.existsSync(path.join(CARD_DIR, path.basename(p.url)))) && (!m.clip || fs.existsSync(path.join(CARD_DIR, path.basename(m.clip.url))))) return m; } catch { /* rebuild */ }
  }
  const ik = `card:${cat}`;
  if (inflight.has(ik)) return inflight.get(ik);
  const p = (async () => {
    const trade = label || words(category);
    const queries = [`${trade} india`, trade, `indian ${trade} professional`, `${trade} interior`, `${trade} shop front`, `${trade} close up`];
    const photos = []; const seen = new Set();
    for (const q of queries) {
      if (photos.length >= want) break;
      const cands = (await landscapePhotos(q)).filter((c) => !seen.has(c.id)).slice(0, 12);
      if (!cands.length) continue;
      const scores = await judgeCard(cands, trade, "Photo");
      const good = scores === null ? cands.slice(0, 3).map((c) => ({ c, fit: 7 })) : scores.filter((s) => s.clean && s.fit >= 7).sort((a, b) => b.fit - a.fit).map((s) => ({ c: cands[s.n], fit: s.fit })).filter((x) => x.c);
      for (const { c } of good) {
        if (photos.length >= want || seen.has(c.id)) continue;
        seen.add(c.id);
        try {
          const buf = Buffer.from(await (await fetch(c.url, { signal: AbortSignal.timeout(40000) })).arrayBuffer());
          const file = path.join(CARD_DIR, `${cat}-v2-${photos.length + 1}.jpg`);
          await sharp(buf).resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toFile(file);
          photos.push({ url: CARD_URL(file), credit: c.credit, id: c.id });
        } catch { /* next */ }
      }
    }
    let clip = null;
    for (const q of [`${trade} india`, trade]) {
      const cands = (await landscapeClips(q)).slice(0, 8);
      if (!cands.length) continue;
      const scores = await judgeCard(cands, trade, "Clip");
      const pick = scores === null ? cands[0] : (() => { const b = scores.filter((s) => s.clean && s.fit >= 7).sort((a, b) => b.fit - a.fit)[0]; return b ? cands[b.n] : null; })();
      if (!pick) continue;
      const file = path.join(CARD_DIR, `${cat}-clip.mp4`), raw = file.replace(/\.mp4$/, "-raw.mp4");
      try {
        fs.writeFileSync(raw, Buffer.from(await (await fetch(pick.url, { signal: AbortSignal.timeout(90000) })).arrayBuffer()));
        await run(FFMPEG, ["-y", "-loglevel", "error", "-i", raw, "-t", "12", "-an", "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=contrast=1.03:saturation=1.05,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], { timeout: 180_000 });
        const poster = file.replace(/\.mp4$/, "-poster.jpg");
        await run(FFMPEG, ["-y", "-loglevel", "error", "-ss", "1", "-i", file, "-frames:v", "1", "-q:v", "3", poster], { timeout: 60_000 }).catch(() => {});
        clip = { url: CARD_URL(file), poster: fs.existsSync(poster) ? CARD_URL(poster) : "", credit: pick.credit, id: pick.id };
        break;
      } catch (e) { log(`card clip failed (${FFMPEG}): ${e && e.message ? e.message.slice(0, 160) : e}`); }
      finally { try { fs.unlinkSync(raw); } catch { /* ignore */ } }
    }
    const out = { category: cat, label: trade, photos, clip, at: new Date().toISOString() };
    if (photos.length || clip) fs.writeFileSync(meta, JSON.stringify(out));
    log(`card media ${cat}: ${photos.length} photos${clip ? " + clip" : ""}`);
    return out;
  })().finally(() => inflight.delete(ik));
  inflight.set(ik, p);
  return p;
}
