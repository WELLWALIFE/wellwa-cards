import "server-only";
// A dealer's brand website → everything of the BRAND'S PRODUCTS the dealer's card can use (owner, 28 Nov 2026: "jab ye dealer hai
// to main website se saari image kyo nahi late?"). chitrakaev.com had ~50 product pictures, the dealer's card got 9.
//
// Brand sites are messy: template filler ("Eiusmod quis…", a 160 km/h top speed on a 25 km/h scooter), one model's close-ups reused
// on another model's page, a landmark of every dealer town, team photos, stock bulbs. Rules cannot sort that, so the AI looks:
//   - vetPictures: every big picture of the site, seen by the AI → product / line-up are kept; places, people, stock art, campaign
//     posters (a film poster on an Amul dealer's banner, 11 Nov 2026), icons and logos are not.
//   - readModelPage: a model's own page (its text and its pictures, beside the model's catalogue photo) → the spec sheet as stated,
//     the colours, the variants with price and MRP, and which pictures show THIS model.
import sharp from "sharp";
import { fetchPublic } from "@/lib/reference-site";
import { geminiComplete, type GeminiPart } from "@/lib/gemini";

export type BrandSpec = { label: string; value: string };
export type BrandModel = { specs: BrandSpec[]; colours: string[]; variants: { name: string; price: string; mrp: string }[]; about: string; images: string[];
  /** Wide, big pictures of the model (a studio banner): the dealer's banners, not its product photos. */
  banners: string[];
  /** Every other picture the page showed (for the brand-wide look, vetPictures). */
  rest: string[] };
export type VettedPicture = { url: string; kind: "product" | "lineup" | "closeup"; w: number; h: number };

const KEY = () => process.env.GEMINI_API_KEY ?? "";
const S = (v: unknown, n: number) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\s+/g, " ").trim().slice(0, n) : "");
function parse<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  try { return m ? (JSON.parse(m[0]) as T) : null; } catch { return null; }
}
const money = (v: unknown) => { const d = S(v, 20).replace(/[^\d.]/g, ""); return d && Number(d) > 0 ? String(Math.round(Number(d))) : ""; };

/** A small JPEG of a picture for the AI, with its real size; null when it is not a usable picture. */
async function thumb(url: string, minSide = 200): Promise<{ data: string; w: number; h: number } | null> {
  // Brand sites on small hosting drop some of many pictures asked at once: one more try after a pause.
  const r = (await fetchPublic(url, "image", 8_000_000, 15_000).catch(() => null))
    ?? (await new Promise((ok) => setTimeout(ok, 1500)).then(() => fetchPublic(url, "image", 8_000_000, 20_000)).catch(() => null));
  if (!r) return null;
  try {
    const img = sharp(r.body, { failOn: "none" }).rotate();
    const m = await img.metadata();
    const w = m.width ?? 0, h = m.height ?? 0;
    if (Math.max(w, h) < minSide || Math.min(w, h) < 120) return null;
    // A plain or gradient ground (chitrakaev.com's gradient-2.png, 1920×1280) shows nothing: never a product picture.
    const st = await sharp(r.body, { failOn: "none" }).resize(64, 64, { fit: "fill" }).flatten({ background: "#808080" }).stats();
    if (st.channels.slice(0, 3).every((c) => c.stdev < 14)) return null;
    // On grey, so a cut-out on a transparent ground is seen as it is (not as a black box).
    const buf = await img.resize({ width: 384, height: 384, fit: "inside" }).flatten({ background: "#e5e5e5" }).jpeg({ quality: 70 }).toBuffer();
    return { data: buf.toString("base64"), w, h };
  } catch { return null; }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/** Every big picture of the brand's pages, seen by the AI: only the brand's products (one, a line-up, a close-up) are kept, biggest first. */
export async function vetPictures(urls: string[], brand: string, log?: (url: string, kind: string) => void): Promise<VettedPicture[]> {
  if (!KEY() || !urls.length) return [];
  const all = await pool([...new Set(urls)].slice(0, 60), 4, async (u) => ({ u, t: await thumb(u, 300) }));
  for (const x of all) if (!x.t) log?.(x.u, "unread");
  const seen = all.filter((x) => x.t);
  if (!seen.length) return [];
  const parts: GeminiPart[] = [];
  seen.forEach((x, i) => { parts.push({ text: `Picture ${i + 1} (${x.t!.w}x${x.t!.h}):` }, { inlineData: { mimeType: "image/jpeg", data: x.t!.data } }); });
  parts.push({ text: `These pictures are from the website of ${brand || "a brand"}. A dealer who sells this brand's products will use them on their own website.
For every picture say what it is. JSON only: {"pictures":[{"n":1,"kind":"product"|"lineup"|"closeup"|"place"|"people"|"stock"|"poster"|"graphic"}]}
- product: one or two of the brand's products, clearly shown (a cut-out or a clean photo; a dark studio banner of a product counts).
- lineup: three or more of the brand's products side by side.
- closeup: a close-up of a product part (wheel, meter, seat, boot, light).
- place: a town, landmark, building, road, map. people: a person or team, a testimonial face. stock: generic concept art (bulb, target, hands).
- poster: a campaign / advertisement / event / film poster or any picture with a lot of written text. graphic: an icon, logo, pattern, plain background.` });
  try {
    const { text } = await geminiComplete({ apiKey: KEY(), tag: "dealer-brand:vet", temperature: 0, json: true, maxOutputTokens: 2000, contents: [{ role: "user", parts }] });
    const v = parse<{ pictures?: { n?: number; kind?: string }[] }>(text);
    const kindOf = new Map((v?.pictures ?? []).map((p) => [Number(p.n), String(p.kind ?? "")]));
    const out: (VettedPicture & { rank: number })[] = [];
    seen.forEach((x, i) => {
      const k = kindOf.get(i + 1);
      log?.(x.u, k ?? "?");
      if (k === "product" || k === "lineup" || k === "closeup") out.push({ url: x.u, kind: k, w: x.t!.w, h: x.t!.h, rank: x.t!.w * x.t!.h });
    });
    return out.sort((a, b) => b.rank - a.rank).map(({ rank: _r, ...p }) => { void _r; return p; });
  } catch { return []; }
}

/** The pictures of a page (img tags and CSS backgrounds), commented-out markup left out. */
export function pagePictures(html: string, base: string): { url: string; alt: string }[] {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  const out: { url: string; alt: string }[] = [];
  const abs = (s: string) => { try { return s ? new URL(s.trim(), base).toString() : ""; } catch { return ""; } };
  for (const m of clean.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\s(?:data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1] || tag.match(/\ssrc=["']([^"']+)["']/i)?.[1] || "";
    const u = abs(src);
    if (u && /^https?:/i.test(u) && !/\.(svg|gif)(\?|$)/i.test(u) && !/logo|icon|favicon/i.test(u)) out.push({ url: u, alt: tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? "" });
  }
  for (const m of clean.matchAll(/(?:data-bgimage=["']url\(|background(?:-image)?\s*:\s*url\()\s*['"]?([^'")]+)/gi)) { const u = abs(m[1]); if (u && /^https?:/i.test(u) && !/\.svg/i.test(u)) out.push({ url: u, alt: "" }); }
  const seen = new Set<string>();
  return out.filter((p) => !seen.has(p.url) && (seen.add(p.url), true));
}

/** The page's visible words, in reading order (scripts, styles and comments left out). */
function pageText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ").replace(/<header\b[\s\S]*?<\/header>|<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<(br|p|div|li|tr|h[1-6]|section|span|td|th)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8377;/g, "₹")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 9000);
}

/** The words that tell this model from the brand's others ("Chitraka Active Star" beside "Chitraka Active Pro" → "star"). */
function ownWords(name: string, others: string[]): string[] {
  const w = (n: string) => n.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 2);
  const theirs = new Set(others.flatMap(w));
  const mine = w(name);
  const own = mine.filter((x) => !theirs.has(x));
  return own.length ? own : mine;
}
/** The text names another of the brand's models and not this one (chitrakaev.com's Single Light page shows the Active Star's
 *  variants, pictures and prices — a template copied and not changed). */
function namesOther(text: string, name: string, others: string[]): boolean {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const has = (n: string, list: string[]) => ownWords(n, list).every((x) => t.includes(` ${x} `));
  return !has(name, others) && others.some((o) => has(o, [name, ...others.filter((x) => x !== o)]));
}

/** A model's own page, read by the AI beside the model's catalogue photo. `others`: the brand's other model names. */
export async function readModelPage(url: string, name: string, photo: string | undefined, others: string[] = []): Promise<BrandModel | null> {
  if (!KEY()) return null;
  const r = await fetchPublic(url, "html", 1_500_000, 12_000).catch(() => null);
  if (!r) return null;
  const html = r.body.toString("utf8");
  const pics = pagePictures(html, r.url).filter((p) => !p.alt || !namesOther(p.alt, name, others)).slice(0, 24);
  const [ref, ...thumbs] = await Promise.all([photo ? thumb(photo, 150) : Promise.resolve(null), ...pics.map((p) => thumb(p.url, 300))]);
  const shown = pics.map((p, i) => ({ ...p, t: thumbs[i] })).filter((p) => p.t);
  const parts: GeminiPart[] = [];
  if (ref) parts.push({ text: `The catalogue photo of ${name}:` }, { inlineData: { mimeType: "image/jpeg", data: ref.data } });
  shown.forEach((p, i) => parts.push({ text: `Picture ${i + 1}${p.alt ? ` (alt: ${p.alt.slice(0, 60)})` : ""}:` }, { inlineData: { mimeType: "image/jpeg", data: p.t!.data } }));
  parts.push({ text: `This is the brand's own page for the model "${name}".${others.length ? ` The brand's other models: ${others.join(", ")} — this page may wrongly carry their pictures, variants or prices (a copied template); leave those out.` : ""} Its words:
"""
${pageText(html)}
"""
Read it as the model's spec sheet for a dealer's website. JSON only:
{"specs":[{"label":"Top speed","value":"20-25 km/h"}],"colours":["Red"],"variants":[{"name":"…","price":"111000","mrp":"121000"}],"about":"…","pictures":[1,2]}
- specs: up to 10 rows of THIS model's main specification sheet, most useful first (range, top speed, battery, charging time, motor,
  brakes, loading capacity, boot, display, approvals…). Copy values as written. Leave out placeholder / lorem ipsum text, a second
  "detailed specifications" list that contradicts the main sheet or does not fit this product (e.g. a 160 km/h top speed or 40 kW motor
  on a 25 km/h scooter), and the colours (they go in colours).
- colours: the colours the page says the model comes in.
- variants: each variant with its selling price and its MRP (struck-through price) as digits only; empty if the page shows no price.
- about: one plain sentence about the model from the page (no prices), or "".
- pictures: the numbers of the pictures that show THIS model (same body and design as the catalogue photo; another colour of it is fine)
  or a close-up of its parts. Not other models, not icons, logos, backgrounds, people or text graphics. Best first.` });
  try {
    const { text } = await geminiComplete({ apiKey: KEY(), tag: "dealer-brand:model", temperature: 0, json: true, maxOutputTokens: 2500, contents: [{ role: "user", parts }] });
    const v = parse<{ specs?: { label?: unknown; value?: unknown }[]; colours?: unknown[]; variants?: { name?: unknown; price?: unknown; mrp?: unknown }[]; about?: unknown; pictures?: unknown[] }>(text);
    if (!v) return null;
    const lorem = /\b(lorem|ipsum|eiusmod|consectetur|cupidatat)\b/i;
    // "Top Speed" + "Speed: 20-25 km/h" (the page's own words) → "20-25 km/h".
    const bare = (label: string, value: string) => { const m = value.match(/^([A-Za-z /()]{2,24}):\s*(.+)$/); return m && label.toLowerCase().includes(m[1].trim().toLowerCase()) ? m[2] : value; };
    const specs = (v.specs ?? []).map((s) => ({ label: S(s?.label, 40).replace(/:$/, ""), value: S(s?.value, 80) })).map((s) => ({ ...s, value: bare(s.label, s.value) })).filter((s) => s.label && s.value && !lorem.test(`${s.label} ${s.value}`)).slice(0, 10);
    const colours = (v.colours ?? []).map((c) => S(c, 30)).filter(Boolean).slice(0, 10);
    const variants = (v.variants ?? []).map((x) => ({ name: S(x?.name, 60), price: money(x?.price), mrp: money(x?.mrp) })).filter((x) => x.name && (x.price || x.mrp) && !namesOther(x.name, name, others)).slice(0, 10);
    const picked = [...new Set((v.pictures ?? []).map((n) => shown[Number(n) - 1]).filter((p): p is NonNullable<typeof p> => !!p))];
    const wide = (p: (typeof picked)[number]) => p.t!.w >= 1200 && p.t!.w / p.t!.h >= 1.3;
    const about = S(v.about, 240);
    const chosen = new Set(picked.map((p) => p.url));
    return { specs, colours, variants, about: lorem.test(about) ? "" : about, images: picked.filter((p) => !wide(p)).map((p) => p.url).slice(0, 8), banners: picked.filter(wide).map((p) => p.url), rest: shown.map((p) => p.url).filter((u) => !chosen.has(u)) };
  } catch { return null; }
}
