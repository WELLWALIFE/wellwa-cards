import "server-only";
// Business details from ANY link (owner, 2 Nov 2026: "Scalio koi bhi account — Maps, Myntra, Flipkart — se details le leta hai, hum sirf
// website se"). One box takes whatever the owner has: a Google Maps link, an Instagram / Facebook page, a JustDial / IndiaMART listing,
// an Amazon / Flipkart / Meesho / Myntra store, or a website that does not open for a bot. What comes back fills the set-up's
// "Your business" screen (name, trade, city, address, phone, about) — the owner checks it there. Nothing is invented: what the
// public web does not show stays empty.
//
// How: a Google Maps link is expanded (its address carries the place's name and position); every link is then given to Gemini with
// Google Search (and the page itself, when the model can open it), which answers in JSON. Bounded: one call, 25 s.
import { categoryOf, CATEGORIES } from "@/lib/poster-categories";
import { matchCategory } from "@/lib/category-match";
import { logUsage } from "@/lib/ai-usage";

export type LinkKind = "map" | "instagram" | "facebook" | "youtube" | "justdial" | "indiamart" | "marketplace" | "website";
export type Lookup = { ok: boolean; kind: LinkKind; source: string; name: string; category: string; city: string; address: string; phone: string; about: string; website: string; instagram: string; map: string };

const MARKET = /(^|\.)(amazon\.in|amazon\.com|flipkart\.com|meesho\.com|myntra\.com|ajio\.com|nykaa\.com|blinkit\.com|swiggy\.com|zomato\.com|etsy\.com|shopsy\.in|jiomart\.com)$/i;
export function linkKind(url: string): LinkKind {
  let h = ""; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return "website"; }
  if (/(^|\.)(maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|g\.page)$/i.test(h) || (/(^|\.)google\.[a-z.]+$/i.test(h) && /\/maps/i.test(url))) return "map";
  if (/(^|\.)instagram\.com$/i.test(h)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(h)) return "facebook";
  if (/(^|\.)(youtube\.com|youtu\.be)$/i.test(h)) return "youtube";
  if (/(^|\.)justdial\.com$/i.test(h)) return "justdial";
  if (/(^|\.)indiamart\.com$/i.test(h)) return "indiamart";
  if (MARKET.test(h)) return "marketplace";
  return "website";
}
const LABEL: Record<LinkKind, string> = { map: "Google Maps", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", justdial: "JustDial", indiamart: "IndiaMART", marketplace: "online store", website: "website" };
export const linkLabel = (k: LinkKind) => LABEL[k];

/** A Google Maps link → the long address (short links redirect) → the place's name and position, when the address carries them. */
async function expandMap(url: string): Promise<{ url: string; name: string; lat: string; lng: string }> {
  let long = url;
  try {
    for (let i = 0; i < 4 && /goo\.gl|g\.page/i.test(long); i++) {
      const r = await fetch(long, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "user-agent": "Mozilla/5.0" } });
      const loc = r.headers.get("location"); if (!loc) break; long = new URL(loc, long).toString();
    }
  } catch { /* keep what we have */ }
  const place = long.match(/\/maps\/place\/([^/@?]+)/);
  const at = long.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? long.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const q = (() => { try { return new URL(long).searchParams.get("q") ?? ""; } catch { return ""; } })();
  const name = decodeURIComponent((place?.[1] ?? (q && !/^-?\d/.test(q) ? q : "")).replace(/\+/g, " ")).trim().slice(0, 100);
  return { url: long, name, lat: at?.[1] ?? "", lng: at?.[2] ?? "" };
}

const EMPTY = (kind: LinkKind, source: string): Lookup => ({ ok: false, kind, source, name: "", category: "", city: "", address: "", phone: "", about: "", website: "", instagram: "", map: kind === "map" ? source : "" });
const S = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const MODEL = "gemini-3.5-flash-lite";

async function ask(prompt: string, tools: Record<string, unknown>[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY; if (!key) return "";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools, generationConfig: { temperature: 0, maxOutputTokens: 900 } }),
    signal: AbortSignal.timeout(25_000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `gemini ${r.status}`);
  logUsage("business-lookup", MODEL, d?.usageMetadata);
  return (d?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

/** The details of the business behind a link. `hint` = what the owner typed besides the link (a name, a town). */
export async function lookupBusiness(rawUrl: string, hint = ""): Promise<Lookup> {
  const kind = linkKind(rawUrl);
  let url = rawUrl; let mapName = "", lat = "", lng = "";
  if (kind === "map") { const m = await expandMap(rawUrl); url = m.url; mapName = m.name; lat = m.lat; lng = m.lng; }
  const out = EMPTY(kind, rawUrl);
  if (kind === "instagram") out.instagram = rawUrl;
  if (!process.env.GEMINI_API_KEY) { if (mapName) { out.name = mapName; out.ok = true; } return out; }
  const keys = CATEGORIES.filter((c) => c.key !== "other" && c.key !== "personal").map((c) => c.key).join(", ");
  const prompt = `Find the PUBLIC details of the Indian business behind this ${LABEL[kind]} link, using Google Search and the page itself:
${url}${mapName ? `\nGoogle Maps names the place: "${mapName}"${lat ? ` at ${lat},${lng}` : ""}.` : ""}${hint ? `\nThe owner also wrote: "${hint.slice(0, 120)}"` : ""}
Answer with ONE JSON object only, no other words:
{"found": true|false, "name": "the business name exactly as it is written", "category": "one key from: ${keys} — or \\"\\"", "city": "", "address": "street address as listed", "phone": "10-digit Indian number if public", "about": "2 plain sentences on what it does, in English", "website": "its own website if it has one", "instagram": "its instagram link if found"}
Rules: only facts you actually found for THIS business; a field you did not find is "". Never guess a phone number or an address. If the link shows a product rather than a seller, give the seller / store.`;
  let text = "";
  try { text = await ask(prompt, [{ url_context: {} }, { google_search: {} }]); }
  catch { try { text = await ask(prompt, [{ google_search: {} }]); } catch { text = ""; } }
  let o: Record<string, unknown> = {};
  try { const m = text.match(/\{[\s\S]*\}/); o = m ? JSON.parse(m[0]) : {}; } catch { o = {}; }
  out.name = S(o.name, 100) || mapName;
  const cat = S(o.category, 30).toLowerCase();
  out.category = categoryOf(cat) ? cat : matchCategory(`${out.name} ${S(o.about, 400)}`) ?? "";
  out.city = S(o.city, 60); out.address = S(o.address, 200);
  const ph = String(o.phone ?? "").replace(/\D/g, "").slice(-10); out.phone = /^[6-9]\d{9}$/.test(ph) ? ph : "";
  out.about = S(o.about, 400);
  const site = S(o.website, 200); out.website = /^https?:\/\//.test(site) && linkKind(site) === "website" ? site : "";
  const ig = S(o.instagram, 200); if (!out.instagram && /instagram\.com\//i.test(ig)) out.instagram = ig;
  if (kind === "map") out.map = url;
  out.ok = !!(out.name && (o.found !== false || mapName));
  return out;
}
