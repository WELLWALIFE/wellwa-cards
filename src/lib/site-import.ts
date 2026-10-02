import "server-only";
// The owner's OWN website → everything a card or website needs, in one go (owner's call, 27 Sep 2026: "site se jo bhi
// mile sab lo — sabse pehle data, fir products ki photos, specification"): the business details, the logo, a cover
// picture and a few gallery photos, and the products with their price, photos and specifications.
//
// Where it looks, most reliable first:
//   1. the site's structured data (JSON-LD: Organization / LocalBusiness / Product / ItemList) — what Google reads;
//   2. shop catalogs: Shopify (/products.json) and WooCommerce (/wp-json/wc/store/v1/products);
//   3. the product pages linked from the site (their JSON-LD, meta price and the specification table);
//   4. the page itself: og:image, the logo, large pictures.
// Only the owner's own site: the card is theirs and so are these pictures. Every picture is COPIED into our media
// bucket (storeSiteMedia) — never hot-linked — so it passes the "own media" rule and keeps working if the site changes.
import sharp from "sharp";
import { fetchPublic } from "@/lib/reference-site";
import { htmlOf, looksEmpty } from "@/lib/render-page";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

export type SiteProduct = { name: string; price: string; mrp: string; description: string; specs: string[]; images: string[]; url: string };
export type SiteAddress = { street: string; city: string; region: string; pin: string; full: string };
export type SiteImport = {
  url: string;
  name: string;
  logo: string | null;
  covers: string[];          // big pictures, best first (og:image, hero / banner / slider)
  gallery: string[];         // other large pictures
  products: SiteProduct[];
  /** All the pictures that could be the logo, best first (see logoCandidates). */
  logos: string[];
  facts: string[];           // phone, email, address, opening hours, description — as the site states them
  // The same things, structured, so the build can make them the card's real address / email / timings / links
  // instead of a sentence the AI may or may not repeat (1 Oct 2026: a site's address went to the AI as prose
  // and the card's map showed only the city).
  description: string;
  phone: string;
  email: string;
  address: SiteAddress;
  hours: string[];
  social: { instagram: string; facebook: string; youtube: string };
  /** What the site itself calls its ranges — the nav's category / collection labels ("Sweets", "Namkeen", "Gift Hampers"). */
  categories: string[];
};

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : x == null ? [] : [x]);
const txt = (v: unknown, n: number) => (typeof v === "string" || typeof v === "number" ? String(v) : "")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;|&rsquo;|&#8217;/gi, "'").replace(/&quot;|&#34;/g, '"')
  .replace(/&#8211;|&ndash;/g, "–").replace(/&#8377;/g, "₹").replace(/\s+/g, " ").trim().slice(0, n);
const MAX_PRODUCTS = 12;

/** https / http absolute URL from a src (relative, protocol-relative, srcset's biggest). */
function absolute(src: string, base: string): string | null {
  const s = src.trim().replace(/&amp;/g, "&");
  if (!s || s.startsWith("data:") || s.startsWith("blob:")) return null;
  try { const u = new URL(s, base); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; }
}
const biggestFromSrcset = (srcset: string) => {
  const parts = srcset.split(",").map((p) => p.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w ?? "0", 10) || 0 }));
  return parts.sort((a, b) => b.w - a.w)[0]?.u ?? "";
};
const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")); return m?.[1] ?? m?.[2] ?? ""; };
/** "799.00" → "799", "1,299.50" → "1299.50"; "" for zero or nonsense. */
const money = (v: unknown) => { const n = Number(String(v ?? "").replace(/[₹,\s]|rs\.?|inr/gi, "")); return Number.isFinite(n) && n > 0 ? String(Number.isInteger(n) ? n : Number(n.toFixed(2))) : ""; };
const JUNK_IMG = /(sprite|icon|favicon|pixel|spacer|loader|loading|placeholder|avatar-default|badge|payment|visa|mastercard|rupay|upi|gpay|paytm|flag|arrow|star|rating|whatsapp|facebook|instagram|twitter|youtube|linkedin|\.svg(\?|$)|\.gif(\?|$))/i;

async function page(url: string) {
  const r = await fetchPublic(url, "html", 1_500_000, 10_000);
  if (!r) return null;
  // A React / Vue / Wix page arrives as an empty shell; htmlOf opens it in a real browser and returns what
  // the page actually becomes. An ordinary page is handed straight back, so nothing is spent on it.
  const raw = r.body.toString("utf8");
  const html = (await htmlOf(r.url, raw)) ?? raw;
  return { url: r.url, html, empty: looksEmpty(html) };
}

/** All JSON-LD objects on the page, @graph and arrays flattened. */
function jsonLd(html: string): Obj[] {
  const out: Obj[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      const walk = (x: unknown) => { for (const y of arr(x)) { const o = obj(y); if (Object.keys(o).length) { out.push(o); if (o["@graph"]) walk(o["@graph"]); } } };
      walk(v);
    } catch { /* a broken block — skip it */ }
  }
  return out;
}
const isType = (o: Obj, re: RegExp) => arr(o["@type"]).some((t) => re.test(String(t)));
const imageList = (v: unknown, base: string): string[] =>
  arr(v).map((x) => (typeof x === "string" ? x : txt(obj(x).url ?? obj(x).contentUrl, 500))).map((x) => absolute(x, base)).filter((x): x is string => !!x);

function productFromLd(o: Obj, base: string): SiteProduct | null {
  const name = txt(o.name, 80);
  if (!name) return null;
  const offer = obj(arr(o.offers)[0]);
  const price = txt(offer.price ?? offer.lowPrice ?? obj(offer.priceSpecification).price, 20);
  const specs = arr(o.additionalProperty).map((p) => { const q = obj(p); const k = txt(q.name, 40), v = txt(q.value, 80); return k && v ? `${k}: ${v}` : ""; }).filter(Boolean);
  for (const k of ["brand", "model", "material", "color", "size", "weight", "sku"]) {
    const v = k === "brand" ? txt(obj(o.brand).name ?? o.brand, 60) : txt(o[k], 60);
    if (v && !specs.some((s) => s.toLowerCase().startsWith(k))) specs.push(`${k[0].toUpperCase()}${k.slice(1)}: ${v}`);
  }
  return { name, price: money(price), mrp: "", description: txt(o.description, 400), specs: specs.slice(0, 10), images: imageList(o.image, base).slice(0, 4), url: absolute(txt(o.url, 500), base) ?? base };
}

/** "Key | value" rows of the page's specification tables and "Key: value" list items. */
function specsFromHtml(html: string): string[] {
  const out: string[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => txt(c[1], 80));
    if (cells.length === 2 && cells[0] && cells[1] && cells[0].length <= 40) out.push(`${cells[0]}: ${cells[1]}`);
    if (out.length >= 12) break;
  }
  for (const d of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const k = txt(d[1], 40), v = txt(d[2], 80); if (k && v) out.push(`${k}: ${v}`);
    if (out.length >= 12) break;
  }
  for (const li of html.matchAll(/<li[^>]*>\s*(?:<(?:strong|b|span)[^>]*>)([^<]{2,40})(?:<\/(?:strong|b|span)>)\s*:?\s*([^<]{1,80})<\/li>/gi)) {
    const k = txt(li[1], 40).replace(/:$/, ""), v = txt(li[2], 80).replace(/^:\s*/, ""); if (k && v) out.push(`${k}: ${v}`);
    if (out.length >= 12) break;
  }
  return [...new Set(out)].slice(0, 10);
}

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0] ?? "";
  return txt(attr(tag, "content"), 500);
}

/** Large pictures on a page: hero / banner / slider ones first. */
function pictures(html: string, base: string): { hero: string[]; other: string[] } {
  const hero: string[] = [], other: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = biggestFromSrcset(attr(tag, "srcset") || attr(tag, "data-srcset")) || attr(tag, "data-src") || attr(tag, "data-lazy-src") || attr(tag, "src");
    const u = absolute(src, base);
    if (!u || JUNK_IMG.test(u) || /logo/i.test(`${u} ${attr(tag, "class")} ${attr(tag, "alt")} ${attr(tag, "id")}`)) continue;
    const w = parseInt(attr(tag, "width"), 10), h = parseInt(attr(tag, "height"), 10);
    if ((w && w < 250) || (h && h < 180)) continue;
    const ctx = `${attr(tag, "class")} ${html.slice(Math.max(0, (m.index ?? 0) - 300), m.index ?? 0)}`;
    (/(hero|banner|slider|slide|carousel|swiper|cover|jumbotron)/i.test(ctx) ? hero : other).push(u);
  }
  // CSS background banners: style="background-image:url(…)"
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    const u = absolute(m[1], base); if (u && !JUNK_IMG.test(u) && !/logo/i.test(u)) hero.push(u);
  }
  const uniq = (a: string[]) => [...new Set(a)];
  return { hero: uniq(hero).slice(0, 8), other: uniq(other).slice(0, 20) };
}

/** Every picture that could be the site's logo, best first: the structured data's, the header's <img … logo …>
 *  tags, the apple-touch-icon. A list, not one address — haldirams.com's JSON-LD logo points at an admin URL
 *  that answers 403, and the real one is the second candidate; the caller copies the first that works. */
function logoCandidates(html: string, base: string, ld: Obj[]): string[] {
  const out: string[] = [];
  const push = (u: string | null) => { if (u && !out.includes(u)) out.push(u); };
  for (const o of ld) push(imageList(o.logo, base)[0] ?? null);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (/logo/i.test(`${attr(tag, "class")} ${attr(tag, "alt")} ${attr(tag, "id")} ${attr(tag, "src")}`)) {
      const src = biggestFromSrcset(attr(tag, "srcset") || attr(tag, "data-srcset")) || attr(tag, "src") || attr(tag, "data-src") || attr(tag, "data-lazy-src");
      const u = absolute(src, base); if (u && !/\.svg(\?|$)/i.test(u)) push(u);
    }
    if (out.length >= 5) break;
  }
  const touch = html.match(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]*>/i)?.[0];
  push(touch ? absolute(attr(touch, "href"), base) : null);
  return out;
}
function logoOf(html: string, base: string, ld: Obj[]): string | null {
  return logoCandidates(html, base, ld)[0] ?? null;
}

/** The first logo candidate that is a real, usable picture, copied into the owner's bucket. */
export async function copyLogo(userId: string, candidates: string[], n = 0): Promise<{ url: string; w: number; h: number } | null> {
  for (const src of candidates.slice(0, 5)) {
    const got = await copyImage(userId, src, "logo", n, 64).catch(() => null);
    if (got) return got;
  }
  return null;
}

/** The site's own Instagram / Facebook / YouTube pages (never share / login / intent links). */
function socialOf(html: string): { instagram: string; facebook: string; youtube: string } {
  const out = { instagram: "", facebook: "", youtube: "" };
  for (const m of html.matchAll(/<a\b[^>]+href=["']([^"'#]+)["']/gi)) {
    const u = m[1].replace(/&amp;/g, "&").trim();
    if (/\/(sharer|share|intent|login|dialog|plugins)\b|\?u=|facebook\.com\/sharer/i.test(u)) continue;
    if (!out.instagram && /^https?:\/\/(www\.)?instagram\.com\/[\w.]{2,}/i.test(u)) out.instagram = u.slice(0, 300);
    else if (!out.facebook && /^https?:\/\/(www\.|m\.)?(facebook\.com|fb\.com)\/[\w.]{2,}/i.test(u)) out.facebook = u.slice(0, 300);
    else if (!out.youtube && /^https?:\/\/(www\.)?(youtube\.com\/(@|c\/|channel\/|user\/)[\w.-]{2,}|youtu\.be\/)/i.test(u)) out.youtube = u.slice(0, 300);
  }
  return out;
}

/** Category / collection pages linked from the site, with the labels the site gives them. Shopify, WooCommerce,
 *  Wix and most Indian shop themes link their ranges this way from the header or footer. */
export function categoryLinks(html: string, base: string): { label: string; url: string }[] {
  let origin: string;
  try { origin = new URL(base).origin; } catch { return []; }
  const seen = new Map<string, string>();
  for (const m of html.matchAll(/<a\b([^>]+)>([\s\S]{0,300}?)<\/a>/gi)) {
    const href = attr(` ${m[1]}`, "href");
    const u = absolute(href, base);
    if (!u) continue;
    let p: URL;
    try { p = new URL(u); } catch { continue; }
    if (p.origin !== origin) continue;
    if (!/\/(category|categories|collections?|product-category|c|shop|range|ranges)\/[^/?#]+/i.test(p.pathname)) continue;
    if (/\/(all|new|sale|offers?|cart|checkout|account|login|wishlist)\/?$/i.test(p.pathname)) continue;
    const label = txt(m[2], 60).replace(/\s*\(\d+\)\s*$/, "").trim();
    if (label.length < 2 || label.length > 40 || /^(shop|all|view all|see all|more|home|menu|click here)$/i.test(label)) continue;
    const key = `${p.pathname}`.toLowerCase().replace(/\/$/, "");
    if (!seen.has(key)) seen.set(key, label);
    if (seen.size >= 16) break;
  }
  const out: { label: string; url: string }[] = [];
  const labels = new Set<string>();
  for (const [path, label] of seen) {
    if (labels.has(label.toLowerCase())) continue;
    labels.add(label.toLowerCase());
    out.push({ label, url: `${origin}${path}` });
  }
  return out;
}

/** A page address that is one product: /product/kaju-katli, /product/premium-sweets/kaju-katli (haldirams.com —
 *  the old one-segment rule missed every product there), /collections/x/products/y (Shopify), /product-page/y
 *  (Wix), /shop/sweets/kaju-katli, /item/… — never a cart, account, category or listing page. */
const NOT_PRODUCT = /\/(cart|checkout|account|login|register|wishlist|compare|search|blog|news|tag|tags|page|category|categories|product-category|collections?)\/?$|\/(cart|checkout|account|login|wishlist|search|blog|tag|tags)\//i;
function isProductPath(p: string): boolean {
  if (NOT_PRODUCT.test(p)) return false;
  if (/\/(products?|product-page|item|items|p|pd|dp)\/[^/?#]+(\/[^/?#]+){0,2}\/?$/i.test(p)) return true;
  if (/\/collections\/[^/]+\/products\/[^/?#]+\/?$/i.test(p)) return true;
  if (/\/shop\/[^/]+\/[^/?#]+\/?$/i.test(p)) return true;            // /shop/<range>/<item>; /shop/<range> alone is a listing
  return false;
}

/** Product page links on this site (Shopify / WooCommerce / most shop themes). */
function productLinks(html: string, base: string, max = MAX_PRODUCTS): string[] {
  let origin: string;
  try { origin = new URL(base).origin; } catch { return []; }
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]+href=["']([^"'#]+)["']/gi)) {
    const u = absolute(m[1], base);
    if (!u) continue;
    let p: URL;
    try { p = new URL(u); } catch { continue; }
    if (p.origin !== origin || !isProductPath(p.pathname)) continue;
    out.add(`${p.origin}${p.pathname}`);
    if (out.size >= max) break;
  }
  return [...out];
}

const PRICE_RE = /(?:₹|&#8377;|rs\.?|inr|mrp)\s*:?\s*([\d,]{2,9}(?:\.\d{1,2})?)/i;

/** Products as a listing page shows them: a card with a picture, a name and a price, linked to the item. Most
 *  Indian shop sites (and every Shopify / Woo theme) render their ranges this way, and many have nothing else —
 *  no JSON-LD, no catalog JSON — so this is where the products actually are. */
export function cardsFromHtml(html: string, base: string): SiteProduct[] {
  let origin: string;
  try { origin = new URL(base).origin; } catch { return []; }
  const out = new Map<string, SiteProduct>();
  // Anchors with content: an <a …>…</a> that wraps a picture and a price (cards are usually one big link), or a
  // short block right around such an anchor.
  for (const m of html.matchAll(/<a\b([^>]*?)>([\s\S]{40,2500}?)<\/a>/gi)) {
    const href = attr(` ${m[1]}`, "href");
    const url = absolute(href, base);
    if (!url) continue;
    let p: URL;
    try { p = new URL(url); } catch { continue; }
    if (p.origin !== origin || NOT_PRODUCT.test(p.pathname)) continue;
    const inner = m[2];
    const img = inner.match(/<img\b[^>]*>/i)?.[0] ?? "";
    if (!img) continue;
    // The price may sit just after the link (Woo themes close the <a> before the price): look a little past it.
    const after = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400);
    const priceM = txt(inner, 3000).match(PRICE_RE) ?? txt(after, 400).match(PRICE_RE);
    if (!priceM) continue;
    const price = money(priceM[1]);
    if (!price) continue;
    const src = biggestFromSrcset(attr(img, "srcset") || attr(img, "data-srcset")) || attr(img, "data-src") || attr(img, "data-lazy-src") || attr(img, "src");
    const image = absolute(src, base);
    if (!image || JUNK_IMG.test(image)) continue;
    const alt = txt(attr(img, "alt"), 80);
    const heading = txt(inner.match(/<(?:h[1-6]|p|span|div)\b[^>]*(?:class=["'][^"']*(?:title|name|product)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:h[1-6]|p|span|div)>/i)?.[1], 80)
      || txt(inner.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1], 80);
    const text = txt(inner, 400).replace(PRICE_RE, "").replace(/\b(add to cart|buy now|quick view|sale|new|out of stock|select options)\b/gi, "").replace(/\s+/g, " ").trim();
    const name = (heading || (alt && !/logo|icon|banner/i.test(alt) ? alt : "") || text).slice(0, 80).trim();
    if (name.length < 2 || /^(₹|rs)/i.test(name)) continue;
    const mrpM = txt(inner, 3000).match(/(?:mrp|m\.r\.p|<del|<s\b|line-through)[^₹\d]{0,40}(?:₹|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
    const mrp = mrpM ? money(mrpM[1]) : "";
    const key = `${p.origin}${p.pathname}`;
    if (!out.has(key)) out.set(key, { name, price, mrp: mrp && mrp !== price ? mrp : "", description: "", specs: [], images: [image], url: key });
    if (out.size >= MAX_PRODUCTS * 2) break;
  }
  return [...out.values()];
}

/** Product addresses from the site's sitemap, for sites whose menus are built in JavaScript or hide the shop
 *  behind a search. A sitemap index is followed into its product sitemap(s). Cheap: XML only. */
async function sitemapProducts(origin: string): Promise<string[]> {
  const readXml = async (u: string) => {
    const r = await fetchPublic(u, "xml", 2_000_000, 8_000).catch(() => null);
    return r ? r.body.toString("utf8") : "";
  };
  const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  const root = await readXml(`${origin}/sitemap.xml`);
  if (!root) return [];
  let urls = locs(root);
  if (/<sitemapindex/i.test(root)) {
    const subs = urls.filter((u) => /product/i.test(u)).slice(0, 2);
    const more = await Promise.all(subs.map(readXml));
    urls = more.flatMap(locs);
  }
  return urls.filter((u) => { try { const p = new URL(u); return p.origin === origin && isProductPath(p.pathname); } catch { return false; } }).slice(0, MAX_PRODUCTS);
}

async function shopify(origin: string): Promise<SiteProduct[]> {
  const r = await fetchPublic(`${origin}/products.json?limit=${MAX_PRODUCTS}`, "json", 3_000_000);
  if (!r) return [];
  try {
    const j = JSON.parse(r.body.toString("utf8")) as { products?: Obj[] };
    return (j.products ?? []).slice(0, MAX_PRODUCTS).map((p) => {
      const v = obj(arr(p.variants)[0]);
      const opts = arr(p.options).map((o) => { const q = obj(o); const vals = arr(q.values).map((x) => txt(x, 30)).filter((x) => x && x !== "Default Title"); return vals.length ? `${txt(q.name, 30)}: ${vals.slice(0, 6).join(", ")}` : ""; }).filter(Boolean);
      return {
        name: txt(p.title, 80), price: money(v.price), mrp: money(v.compare_at_price) !== money(v.price) ? money(v.compare_at_price) : "", description: txt(p.body_html, 400),
        specs: [...opts, ...(txt(p.vendor, 40) ? [`Brand: ${txt(p.vendor, 40)}`] : []), ...(txt(p.product_type, 40) ? [`Type: ${txt(p.product_type, 40)}`] : [])].slice(0, 10),
        images: arr(p.images).map((i) => txt(obj(i).src, 500)).filter(Boolean).slice(0, 4), url: `${origin}/products/${txt(p.handle, 120)}`,
      };
    }).filter((p) => p.name);
  } catch { return []; }
}

async function woo(origin: string): Promise<SiteProduct[]> {
  const r = await fetchPublic(`${origin}/wp-json/wc/store/v1/products?per_page=${MAX_PRODUCTS}`, "json", 3_000_000);
  if (!r) return [];
  try {
    const list = JSON.parse(r.body.toString("utf8")) as Obj[];
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_PRODUCTS).map((p) => {
      const pr = obj(p.prices); const minor = Number(pr.currency_minor_unit ?? 2);
      const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? String(Math.round(n / 10 ** minor)) : ""; };
      const price = money(pr.sale_price ?? pr.price), mrp = money(pr.regular_price);
      return {
        name: txt(p.name, 80), price, mrp: mrp && mrp !== price ? mrp : "", description: txt(p.short_description || p.description, 400),
        specs: arr(p.attributes).map((a) => { const q = obj(a); const vals = arr(q.terms).map((t) => txt(obj(t).name, 30)).filter(Boolean); return vals.length ? `${txt(q.name, 30)}: ${vals.slice(0, 6).join(", ")}` : ""; }).filter(Boolean).slice(0, 10),
        images: arr(p.images).map((i) => txt(obj(i).src, 500)).filter(Boolean).slice(0, 4), url: txt(p.permalink, 500) || origin,
      };
    }).filter((p) => p.name);
  } catch { return []; }
}

/** A product's price when the page has no price meta: microdata, the storefront's own JSON (Shopify's MoneyV2
 *  "amount" / a "price": field — headless Shopify stores such as haldirams.com carry every price only there),
 *  then the first rupee amount in the page text. */
function priceFromHtml(html: string): string {
  const micro = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i)?.[1] ?? html.match(/content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i)?.[1];
  if (micro && money(micro)) return money(micro);
  const money2 = html.match(/\\?"amount\\?":\\?"([\d.]+)\\?",\\?"currencyCode\\?":\\?"INR/i)?.[1];
  if (money2 && money(money2)) return money(money2);
  const json = html.match(/\\?"price\\?":\s*\\?"?([\d.]+)/i)?.[1];
  if (json && money(json)) return money(json);
  const text = txt(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "), 20000);
  for (const m of text.matchAll(/₹\s*([\d,]{2,9}(?:\.\d{1,2})?)/g)) { const v = money(m[1]); if (v) return v; }
  return "";
}

/** "Kaju Katli – Premium Cashew Fudge Sweet | Haldiram's" → "Kaju Katli": the brand suffix a title carries and the
 *  search-engine tail after a dash are not the product's name. */
function cleanProductName(name: string, siteName: string): string {
  let n = txt(name, 120);
  const brand = siteName.trim().toLowerCase();
  const parts = n.split(/\s+[|•·]\s+/);
  if (parts.length > 1 && brand && parts[parts.length - 1].trim().toLowerCase().replace(/[’']/g, "") === brand.replace(/[’']/g, "")) parts.pop();
  n = parts[0].trim();
  const dash = n.split(/\s+[–—]\s+|\s+-\s+/);
  if (dash.length > 1 && dash[0].trim().length >= 3) n = dash[0].trim();
  return n.slice(0, 80);
}

async function productPage(url: string, siteName = ""): Promise<SiteProduct | null> {
  const pg = await page(url);
  if (!pg) return null;
  const ld = jsonLd(pg.html).filter((o) => isType(o, /^Product$/i)).map((o) => productFromLd(o, pg.url)).find(Boolean) ?? null;
  const specs = specsFromHtml(pg.html);
  if (ld) return { ...ld, name: cleanProductName(ld.name, siteName), price: ld.price || priceFromHtml(pg.html), specs: [...new Set([...ld.specs, ...specs])].slice(0, 10), images: ld.images.length ? ld.images : [absolute(meta(pg.html, "og:image"), pg.url)].filter((x): x is string => !!x) };
  const name = meta(pg.html, "og:title") || txt(pg.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], 80);
  const img = absolute(meta(pg.html, "og:image"), pg.url);
  if (!name || !img) return null;
  return {
    name: cleanProductName(name, siteName), price: money(meta(pg.html, "product:price:amount") || meta(pg.html, "og:price:amount")) || priceFromHtml(pg.html), mrp: "",
    description: meta(pg.html, "og:description") || meta(pg.html, "description"), specs, images: [img], url: pg.url,
  };
}

/** The business itself: an Organization / LocalBusiness of any kind (Bakery, Dentist, Store …) — anything with a name
 *  and an address, phone or logo that is not a product or a page. */
function orgOf(ld: Obj[]): Obj {
  return ld.find((o) => isType(o, /(Organization|LocalBusiness|Store|Shop)$/i))
    ?? ld.find((o) => !isType(o, /^(Product|WebSite|WebPage|BreadcrumbList|ItemList|Offer|ImageObject|SearchAction|Person|Review|FAQPage|Question|Answer)$/i) && txt(o.name, 80) && (o.address || o.telephone || o.logo))
    ?? {};
}
function addressOf(org: Obj) {
  const a = obj(org.address);
  const street = txt(a.streetAddress, 120), city = txt(a.addressLocality, 60), region = txt(a.addressRegion, 60), pin = txt(a.postalCode, 12);
  return { street, city, region, pin, full: [street, city, region, pin].filter(Boolean).join(", ") };
}
/** The site's own name: structured data first, then og:site_name, then the brand part of the <title> — the short
 *  segment of "Buy Sofas Online | Urban Ladder" (usually the last), never a marketing sentence. */
function siteName(html: string, org: Obj): string {
  const known = txt(org.name, 80) || meta(html, "og:site_name") || meta(html, "application-name") || meta(html, "apple-mobile-web-app-title");
  if (known) return known;
  // The logo's alt text is very often the brand's name: <img alt="Urban Ladder" class="logo">.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(`${attr(tag, "class")} ${attr(tag, "id")} ${attr(tag, "src")}`)) continue;
    const alt = txt(attr(tag, "alt"), 60).replace(/\b(logo|brand|home|header)\b/gi, "").replace(/[-–|]+$/, "").trim();
    if (alt.length >= 2 && alt.split(/\s+/).length <= 4) return alt;
  }
  const parts = txt(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 160).split(/\s+[|–—-]\s+|\s*::\s*|\s+[•·]\s+/).map((x) => x.trim()).filter(Boolean);
  const brandish = (x: string) => x.length >= 2 && x.length <= 40 && x.split(/\s+/).length <= 4 && !/%|\bbuy\b|\bonline\b|\bshop\b|\bbest\b|\bfree\b|\boffer|\bsale\b|\bhome\b|\bwelcome\b|\bofficial\b|[:?!]/i.test(x);
  return [...parts].reverse().find(brandish) ?? "";
}

/** What the set-up's website step learns from the HOME page alone, while the person is still on the form
 *  (owner's call, 1 Oct 2026: "user ko kam se kam data dalna pade"): the name, logo, description, address and
 *  phone the site states about itself, and how many products it seems to carry. One page read (plus the cheap
 *  shop-catalog JSON), bounded; the full import still happens in the build. Null when the page cannot be opened;
 *  `empty` when it opened and was still a bare app shell after rendering. Nothing of the site's pictures or
 *  products is returned — only the logo's address, which the caller copies for an OWN site. */
export type SitePeek = {
  url: string; name: string; logo: string | null; logos: string[]; about: string; phone: string; email: string;
  address: { street: string; city: string; region: string; pin: string; full: string };
  hours: string[]; products: number; title: string; empty: boolean;
};
export async function peekSite(raw: string): Promise<SitePeek | null> {
  const home = await page(raw);
  if (!home) return null;
  const origin = new URL(home.url).origin;
  const ld = jsonLd(home.html);
  const org = orgOf(ld);
  let products = 0;
  for (const o of ld) {
    if (isType(o, /^Product$/i)) products++;
    if (isType(o, /^ItemList$/i)) for (const it of arr(o.itemListElement)) { const item = obj(obj(it).item ?? it); if (isType(item, /^Product$/i)) products++; }
  }
  // The catalogs are one JSON call each and say at once whether this is a shop with products to import.
  const [sh, wc] = await Promise.all([shopify(origin).catch(() => []), woo(origin).catch(() => [])]);
  products = Math.max(products, sh.length, wc.length);
  if (!products) products = Math.min(MAX_PRODUCTS, productLinks(home.html, home.url).length);
  return {
    url: home.url,
    name: siteName(home.html, org),
    logo: logoOf(home.html, home.url, ld),
    logos: logoCandidates(home.html, home.url, ld),
    about: txt(org.description, 400) || meta(home.html, "og:description") || meta(home.html, "description"),
    phone: txt(org.telephone, 30),
    email: txt(org.email, 80),
    address: addressOf(org),
    hours: arr(org.openingHours).map((h) => txt(h, 60)).filter(Boolean),
    products,
    title: txt(home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 120),
    empty: home.empty,
  };
}

/** Everything useful on the owner's website. Null when the home page cannot be read. Bounded: ~15 page reads. */
export async function importSite(raw: string): Promise<SiteImport | null> {
  const home = await page(raw);
  if (!home) return null;
  const origin = new URL(home.url).origin;
  const ld = jsonLd(home.html);
  const org = orgOf(ld);
  const facts: string[] = [];
  const address = addressOf(org).full;
  if (txt(org.telephone, 30)) facts.push(`Phone on the website: ${txt(org.telephone, 30)}`);
  if (txt(org.email, 80)) facts.push(`Email on the website: ${txt(org.email, 80)}`);
  if (address) facts.push(`Address on the website: ${address}`);
  const hours = arr(org.openingHours).map((h) => txt(h, 60)).filter(Boolean);
  if (hours.length) facts.push(`Opening hours on the website: ${hours.join("; ")}`);
  const desc = txt(org.description, 400) || meta(home.html, "og:description") || meta(home.html, "description");
  if (desc) facts.push(`Website description: ${desc}`);
  const cats = categoryLinks(home.html, home.url);
  if (cats.length) facts.push(`Ranges / categories on the website: ${cats.map((c) => c.label).join(", ")}`);
  const siteNameOfHome = siteName(home.html, org);

  // Products: structured data on the home page → shop catalogs → product pages.
  const byName = new Map<string, SiteProduct>();
  const add = (p: SiteProduct | null) => { if (p && p.name && !byName.has(p.name.toLowerCase()) && byName.size < MAX_PRODUCTS) byName.set(p.name.toLowerCase(), p); };
  for (const o of ld) {
    if (isType(o, /^Product$/i)) add(productFromLd(o, home.url));
    if (isType(o, /^ItemList$/i)) for (const it of arr(o.itemListElement)) { const item = obj(obj(it).item ?? it); if (isType(item, /^Product$/i)) add(productFromLd(item, home.url)); }
  }
  const [sh, wc] = await Promise.all([shopify(origin), woo(origin)]);
  [...sh, ...wc].forEach(add);
  if (byName.size < MAX_PRODUCTS) {
    // The products / shop page often lists more than the home page does — and so do the site's own range /
    // category pages (Sweets, Namkeen, Gift Hampers…), which haldirams.com-style sites link from the header.
    const cats = categoryLinks(home.html, home.url).slice(0, 5);
    const listing = await Promise.all([...["/products", "/shop", "/our-products", "/product", "/collections/all"].map((p) => `${origin}${p}`), ...cats.map((c) => c.url)]
      .map((u) => page(u).catch(() => null)));
    const read = [home, ...listing].filter((pg): pg is NonNullable<typeof pg> => !!pg);
    // 1. the listing cards themselves (name + price + picture): on most Indian shop sites this is all there is
    const cards = read.flatMap((pg) => cardsFromHtml(pg.html, pg.url));
    // 2. the product pages those cards (and any other product links) point at — richer: description, specs, MRP
    let links = [...new Set([...cards.map((c) => c.url), ...read.flatMap((pg) => productLinks(pg.html, pg.url))])];
    if (!links.length && !cards.length) links = await sitemapProducts(origin).catch(() => []);
    const pages = await pool(links.slice(0, MAX_PRODUCTS - byName.size), 4, (u) => productPage(u, siteNameOfHome).catch(() => null));
    const byUrl = new Map(pages.filter((x): x is SiteProduct => !!x).map((x) => [x.url.split("?")[0], x]));
    for (const u of links) { const pg = byUrl.get(u.split("?")[0]); if (pg) add(pg); }
    // A card whose page gave nothing (no og / JSON-LD) still counts: its name, price and picture are real.
    for (const c of cards) {
      const have = byName.get(c.name.toLowerCase());
      if (have) { if (!have.price && c.price) have.price = c.price; if (!have.images.length) have.images = c.images; continue; }
      add(c);
    }
  }

  // Pictures: og:image and hero banners first, then the big photos of home, about and gallery pages.
  const more = await Promise.all(["/about", "/about-us", "/gallery"].map((p) => page(`${origin}${p}`)));
  const og = absolute(meta(home.html, "og:image"), home.url);
  const pics = [home, ...more].filter(Boolean).map((pg) => pictures(pg!.html, pg!.url));
  const productPics = new Set([...byName.values()].flatMap((p) => p.images));
  const covers = [...new Set([og, ...pics.flatMap((p) => p.hero)].filter((x): x is string => !!x && !productPics.has(x)))].slice(0, 6);
  const gallery = [...new Set(pics.flatMap((p) => p.other))].filter((u) => !covers.includes(u) && !productPics.has(u)).slice(0, 12);

  return {
    url: home.url,
    name: siteNameOfHome,
    logo: logoOf(home.html, home.url, ld),
    logos: logoCandidates(home.html, home.url, ld),
    covers, gallery,
    products: [...byName.values()],
    facts,
    description: desc,
    phone: txt(org.telephone, 30),
    email: txt(org.email, 80) || (home.html.match(/mailto:([\w.+-]+@[\w-]+\.[\w.-]+)/i)?.[1] ?? ""),
    address: addressOf(org),
    hours,
    social: socialOf(home.html),
    categories: cats.map((c) => c.label),
  };
}

/* ---------------- copying the pictures into our media bucket ---------------- */

type Kind = "logo" | "wide" | "product";
/** One picture from the site → our bucket (resized, re-encoded). Null when it is not a usable image. */
export async function copyImage(userId: string, src: string, kind: Kind, n: number, minWidth: number): Promise<{ url: string; w: number; h: number } | null> {
  const r = await fetchPublic(src, "image", 8_000_000, 12_000);
  if (!r) return null;
  try {
    const img = sharp(r.body, { failOn: "none" }).rotate();
    const m = await img.metadata();
    const w = m.width ?? 0, h = m.height ?? 0;
    // A logo is often a wide wordmark — wellwalife.com's is 91×39 — so for a logo only the width has to be
    // real; the old rule wanted 64px of height too and threw that one away, leaving the account's old logo
    // on a card rebuilt from the site.
    if (w < minWidth || h < (kind === "logo" ? 20 : Math.min(minWidth, 120))) return null;
    const out = kind === "logo"
      ? await img.resize({ width: 600, height: 300, fit: "inside", withoutEnlargement: true }).png().toBuffer()
      : kind === "product"
      ? await img.resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
      : await img.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const ext = kind === "logo" ? "png" : "jpg";
    const key = `poster/${userId}/site-${kind}-${Date.now()}-${n}.${ext}`;
    const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, {
      method: "POST", headers: { ...serviceHeaders(), "Content-Type": ext === "png" ? "image/png" : "image/jpeg", "x-upsert": "true" }, body: new Uint8Array(out),
      signal: AbortSignal.timeout(15_000),
    });
    return up.ok ? { url: `${SUPA_URL}/storage/v1/object/public/media/${key}`, w, h } : null;
  } catch { return null; }
}

/** Runs fn over items, at most `n` at a time. */
async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

export type StoredSite = { logo: string | null; cover: string | null; gallery: string[]; products: (SiteProduct & { stored: string[] })[] };

/** Copies the logo, the best wide cover, up to 5 gallery photos and up to 2 photos per product into our bucket.
 *  A dealer's brand site (owner's call, 2 Oct 2026) gives its pictures too — a Maruti dealer's gallery shows Maruti
 *  cars, showrooms and service, not stock photos of any garage — and its logo, used only when the dealer uploads
 *  none of their own (the build decides that). The brand's address and phone never reach the dealer's card. */
export async function storeSiteMedia(userId: string, s: SiteImport, role: "own" | "dealer" = "own"): Promise<StoredSite> {
  let n = 0;
  void role;
  const [logo, coverCands, galleryCands, productPics] = await Promise.all([
    s.logos?.length || s.logo ? copyLogo(userId, s.logos?.length ? s.logos : [s.logo!], n++) : Promise.resolve(null),
    pool(s.covers.slice(0, 4), 3, (u) => copyImage(userId, u, "wide", n++, 700)),
    pool(s.gallery.slice(0, 8), 3, (u) => copyImage(userId, u, "wide", n++, 500)),
    pool(s.products, 3, async (p) => (await Promise.all(p.images.slice(0, 2).map((u) => copyImage(userId, u, "product", n++, 300)))).filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.url)),
  ]);
  // The cover must be a wide picture; a tall one joins the gallery instead.
  const wide = [...coverCands, ...galleryCands].filter((x): x is NonNullable<typeof x> => !!x);
  const cover = wide.find((x) => x.w / x.h >= 1.3) ?? null;
  const gallery = wide.filter((x) => x !== cover).map((x) => x.url).slice(0, 5);
  return {
    logo: logo?.url ?? null,
    cover: cover?.url ?? null,
    gallery,
    products: s.products.map((p, i) => ({ ...p, stored: productPics[i] ?? [] })),
  };
}

/** The website's facts and products as text for the AI writer (added to what readOwnSite already gives). A dealer's
 *  brand site gives the products and one line about the brand — never its phone, address or hours as the owner's. */
export function siteImportText(s: SiteImport, role: "own" | "dealer" = "own"): string {
  const lines = role === "own" ? [...s.facts] : [
    `The brand whose products we sell as a dealer / distributor: ${s.name || new URL(s.url).hostname}${(() => { const d = s.facts.find((f) => f.startsWith("Website description: ")); return d ? ` — ${d.slice(21)}` : ""; })()}`,
  ];
  for (const p of s.products.slice(0, MAX_PRODUCTS)) {
    lines.push(`Product on the website: ${[p.name, p.price && `₹${p.price}`, p.description && p.description.slice(0, 160), p.specs.length && `specs: ${p.specs.slice(0, 5).join("; ")}`].filter(Boolean).join(" — ")}`);
  }
  return lines.join("\n").slice(0, 4000);
}
