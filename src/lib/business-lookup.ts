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
import { tradeQuestionsFor } from "@/lib/trade-questions";
import { MAX_TRADE_ANSWERS } from "@/lib/card-facts";

export type LinkKind = "map" | "instagram" | "facebook" | "youtube" | "justdial" | "indiamart" | "marketplace" | "website";
export type Lookup = { ok: boolean; kind: LinkKind; source: string; name: string; category: string; city: string; address: string; phone: string; about: string; hours: string; website: string; instagram: string; map: string;
  /** The trade's own questions answered from what the listing says ("Pure veg", "Home delivery") — option names of lib/trade-questions; only what was stated. */
  answers: Record<string, string[]> };

// Exact hosts only — a Google Maps link is fetched (redirects followed) on the server, so a look-alike host ("maps.google.evil.com") must
// never pass, and every redirect hop is checked again (a review, 2 Nov 2026: SSRF).
const GOOGLE_HOST = /^(www\.|maps\.)?google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/i;
const SHORT_MAP = /^(maps\.app\.goo\.gl|goo\.gl|g\.page|share\.google)$/i;   // share.google: Google's "Share" link of a business listing
const GOOGLE_LISTING = /\/search\?(?:.*&)?q=[^&]/i;   // …/search?q=<the business> — where a share.google link lands
const mapHost = (u: URL) => u.protocol === "https:" && (SHORT_MAP.test(u.hostname) || GOOGLE_HOST.test(u.hostname));
const MARKET = /(^|\.)(amazon\.in|amazon\.com|flipkart\.com|meesho\.com|myntra\.com|ajio\.com|nykaa\.com|blinkit\.com|swiggy\.com|zomato\.com|etsy\.com|shopsy\.in|jiomart\.com)$/i;
export function linkKind(url: string): LinkKind {
  let h = ""; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return "website"; }
  if (SHORT_MAP.test(h) || (GOOGLE_HOST.test(h) && (/^maps\./i.test(h) || /\/maps/i.test(url) || GOOGLE_LISTING.test(url)))) return "map";
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
/** What was typed into Google before the Maps link was copied: a link opened from a Google search result carries the search words in
 *  its gs_lp value (a small packed message; the words are its field 4). "wellwa life" → the place's name when the link names none. */
function searchedWords(u: URL): string {
  try {
    const raw = u.searchParams.get("gs_lp") ?? "";
    if (!raw) return "";
    const b = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    let i = 0;
    while (i < b.length - 1) {
      const tag = b[i++], wire = tag & 7;
      if (wire === 2) {
        const len = b[i++];
        if (len > 127 || i + len > b.length) return "";
        if (tag >> 3 === 4) return b.subarray(i, i + len).toString("utf8").replace(/\s+/g, " ").trim().slice(0, 100);
        i += len;
      } else if (wire === 0) { while (i < b.length && b[i++] & 0x80) { /* skip the number */ } }
      else return "";
    }
  } catch { /* not that kind of link */ }
  return "";
}

async function expandMap(url: string): Promise<{ url: string; name: string; lat: string; lng: string; addr: string }> {
  let long = url;
  try {
    // Only a short Google link is followed, hop by hop, and only to Google's own hosts over https.
    for (let i = 0; i < 4; i++) {
      const u = new URL(long);
      if (!mapHost(u) || !SHORT_MAP.test(u.hostname)) break;
      const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "user-agent": "Mozilla/5.0" } });
      const loc = r.headers.get("location"); if (!loc) break;
      const next = new URL(loc, u);
      if (!mapHost(next)) break;
      long = next.toString();
    }
  } catch { /* keep what we have */ }
  const place = long.match(/\/maps\/place\/([^/@?]+)/);
  const at = long.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? long.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const parsed = (() => { try { return new URL(long); } catch { return null; } })();
  const q = parsed?.searchParams.get("q") ?? "";
  // A "Directions" link (copied from a Google search result) names no place: it carries the address it leads to, and often the words
  // that were searched (seen live, 11 Nov 2026: the owner's own link read as "could not read details").
  const addr = (parsed?.searchParams.get("daddr") ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const searched = parsed ? searchedWords(parsed) : "";
  // The place part of the path is still encoded; the ?q= value is decoded already (and may hold a "%", e.g. "100% Veg").
  const raw = place?.[1] ? (() => { try { return decodeURIComponent(place[1].replace(/\+/g, " ")); } catch { return place[1].replace(/\+/g, " "); } })() : (q && !/^-?\d/.test(q) ? q : searched);
  const name = raw.trim().slice(0, 100);
  return { url: long, name, lat: at?.[1] ?? "", lng: at?.[2] ?? "", addr };
}

const EMPTY = (kind: LinkKind, source: string): Lookup => ({ ok: false, kind, source, name: "", category: "", city: "", address: "", phone: "", about: "", hours: "", website: "", instagram: "", map: kind === "map" ? source : "", answers: {} });
const S = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const MODEL = "gemini-3.5-flash-lite";

async function ask(prompt: string, tools: Record<string, unknown>[], timeout = 25_000): Promise<string> {
  const key = process.env.GEMINI_API_KEY; if (!key) return "";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], ...(tools.length ? { tools } : {}), generationConfig: { temperature: 0, maxOutputTokens: 900 } }),
    signal: AbortSignal.timeout(timeout),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `gemini ${r.status}`);
  logUsage("business-lookup", MODEL, d?.usageMetadata);
  return (d?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

/** The details of the business behind a link. `hint` = what the owner typed besides the link (a name, a town). */
export async function lookupBusiness(rawUrl: string, hint = ""): Promise<Lookup> {
  const kind = linkKind(rawUrl);
  let url = rawUrl; let mapName = "", lat = "", lng = "", mapAddr = "";
  if (kind === "map") { const m = await expandMap(rawUrl); url = m.url; mapName = m.name; lat = m.lat; lng = m.lng; mapAddr = m.addr; }
  const out = EMPTY(kind, rawUrl);
  if (kind === "instagram") out.instagram = rawUrl;
  if (!process.env.GEMINI_API_KEY) { if (mapName) { out.name = mapName; out.ok = true; } return out; }
  const keys = CATEGORIES.filter((c) => c.key !== "other" && c.key !== "personal").map((c) => c.key).join(", ");
  const prompt = `Find the PUBLIC details of the Indian business behind this ${LABEL[kind]} link, using Google Search and the page itself:
${url}${mapName ? `\nGoogle Maps names the place: "${mapName}"${lat ? ` at ${lat},${lng}` : ""}.` : ""}${mapAddr ? `\nThe link leads to this address: "${mapAddr}".` : ""}${hint ? `\nThe owner also wrote: "${hint.slice(0, 120)}"` : ""}
Answer with ONE JSON object only, no other words:
{"found": true|false, "name": "the business name exactly as it is written", "category": "one key from: ${keys} — or \\"\\"", "city": "", "address": "street address as listed", "phone": "10-digit Indian number if public", "about": "2 plain sentences on what it does, in English", "hours": "opening hours as listed, short, e.g. Mon–Sun 9 am – 10 pm", "website": "its own website if it has one", "instagram": "its instagram link if found", "facts": ["up to 10 short facts the listing states: veg / non-veg, cuisines, delivery, dine-in, services, brands, since year, AC, parking…"]}
Rules: only facts you actually found for THIS business; a field you did not find is "". Never guess a phone number or an address. If the link shows a product rather than a seller, give the seller / store.`;
  let text = "";
  try { text = await ask(prompt, [{ url_context: {} }, { google_search: {} }]); }
  catch { try { text = await ask(prompt, [{ google_search: {} }]); } catch { text = ""; } }
  let o: Record<string, unknown> = {};
  try { const m = text.match(/\{[\s\S]*\}/); o = m ? JSON.parse(m[0]) : {}; } catch { o = {}; }
  out.name = S(o.name, 100) || mapName;
  const cat = S(o.category, 30).toLowerCase();
  out.category = categoryOf(cat) ? cat : matchCategory(`${out.name} ${S(o.about, 400)}`) ?? "";
  out.city = S(o.city, 60); out.address = S(o.address, 200) || mapAddr;
  const ph = String(o.phone ?? "").replace(/\D/g, "").slice(-10); out.phone = /^[6-9]\d{9}$/.test(ph) ? ph : "";
  out.about = S(o.about, 400); out.hours = S(o.hours, 120);
  const site = S(o.website, 200); out.website = /^https?:\/\//.test(site) && linkKind(site) === "website" ? site : "";
  const ig = S(o.instagram, 200); if (!out.instagram && /instagram\.com\//i.test(ig)) out.instagram = ig;
  if (kind === "map") out.map = url;
  out.ok = !!(out.name && (o.found !== false || mapName));
  const facts = Array.isArray(o.facts) ? o.facts.map((x) => S(x, 120)).filter(Boolean).slice(0, 12) : [];
  if (out.ok && out.category && (facts.length || out.about)) out.answers = await tradeAnswersFrom(out.category, out.name, out.about, facts).catch(() => ({}));
  return out;
}

/** The trade's tick questions (set-up "About your trade") answered from the listing's facts — pre-ticked, the owner checks them
 *  (owner, 2 Nov 2026: Maps says "Pure veg" — why tick it again?). One short text call, no search; only options that the facts STATE;
 *  a parts question (all ticked by default) and the free-text questions are left alone. */
async function tradeAnswersFrom(category: string, name: string, about: string, facts: string[]): Promise<Record<string, string[]>> {
  const qs = tradeQuestionsFor(category).filter((q) => (q.type === "one" || q.type === "many") && !q.closed && q.options?.length);
  if (!qs.length) return {};
  const list = qs.map((q) => `- ${q.key} (${q.type === "one" ? "pick at most one" : "pick any"}): ${q.en} Options: ${q.options!.map((o) => o.en).join(" | ")}`).join("\n");
  const prompt = `A business: "${name}". About: ${about || "-"}
Facts from its public listing:
${facts.map((f) => `- ${f}`).join("\n") || "-"}

Questions with fixed options:
${list}

Answer with ONE JSON object only: {"<key>": ["exact option text", …]}. Pick an option ONLY when the facts or the about clearly say it; leave a question out otherwise. Never guess.`;
  const text = await ask(prompt, [], 12_000);
  let o: Record<string, unknown> = {};
  try { const m = text.match(/\{[\s\S]*\}/); o = m ? JSON.parse(m[0]) : {}; } catch { return {}; }
  const out: Record<string, string[]> = {};
  let n = 0;
  for (const q of qs) {
    const v = o[q.key]; if (!Array.isArray(v)) continue;
    const ok = q.options!.map((x) => x.en);
    const picked = [...new Set(v.map((x) => String(x).trim()).map((x) => ok.find((e) => e.toLowerCase() === x.toLowerCase())).filter((x): x is string => !!x && !/^(other|others)$/i.test(x)))];
    const keep = (q.type === "one" ? picked.slice(0, 1) : picked).slice(0, MAX_TRADE_ANSWERS - n);
    if (keep.length) { out[q.key] = keep; n += keep.length; }
    if (n >= MAX_TRADE_ANSWERS) break;
  }
  return out;
}
