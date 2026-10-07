// "Whose website is it?" — the one answer the set-up asks before anything else (owner's call, 1 Oct 2026),
// shared by the set-up's website step and the V-Card form so both say and store exactly the same thing.
//
// Isomorphic on purpose: no 'use client', no 'server-only' — the set-up screen, the build form and the build
// route all import it.

/** What the person tapped. "none" is a real answer (most people), not the absence of one. */
export type SiteKind = "own" | "dealer" | "reference" | "none";

/** The stored websiteRole for a tap. A competitor's site is a reference site — same rule: look only. */
export const toFactsRole = (k: SiteKind | ""): "own" | "dealer" | "reference" =>
  k === "dealer" ? "dealer" : k === "reference" ? "reference" : "own";

/** Instagram / Facebook / YouTube pages people paste as "my website". They are not a website we can read
 *  (every one of them is a login wall to a bot), so they are kept as the social links they are. */
const SOCIAL: { re: RegExp; key: "instagram" | "facebook" | "youtube"; label: string }[] = [
  { re: /(^|\.)instagram\.com$/i, key: "instagram", label: "Instagram" },
  { re: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, key: "facebook", label: "Facebook" },
  { re: /(^|\.)(youtube\.com|youtu\.be)$/i, key: "youtube", label: "YouTube" },
];
const MAPS = /(^|\.)(maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl)$/i;

/** "sharmasweets.com", "https://sharmasweets.com/", "Check my site: www.sharmasweets.com 🙏" → https://sharmasweets.com.
 *  "" when nothing in it looks like an address. */
export function cleanSiteUrl(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  // Text pasted from WhatsApp around the link: keep the one token that has a dot and no spaces.
  const token = s.split(/\s+/).find((t) => /^[a-z]+:\/\/\S+$/i.test(t) || (/\./.test(t) && !/^[\d.+-]+$/.test(t))) ?? s;
  const withScheme = /^[a-z]+:\/\//i.test(token) ? token : `https://${token}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return "";
    u.hash = "";
    let out = u.toString();
    if (u.pathname === "/" && !u.search) out = out.replace(/\/$/, "");
    return out.slice(0, 300);
  } catch {
    return "";
  }
}

/** Does this look like a website address at all? ("sharma sweets", "9876543210" and "abc" do not.) */
export function looksLikeSite(raw: string): boolean {
  const u = cleanSiteUrl(raw);
  if (!u) return false;
  try { const h = new URL(u).hostname; return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(h) && !/^\d+(\.\d+)*$/.test(h); } catch { return false; }
}

export function hostOf(url: string): string {
  try { return new URL(cleanSiteUrl(url) || "https://x.invalid").hostname.replace(/^www\./i, ""); } catch { return ""; }
}

/** A pasted link that is a social page or a Google Maps pin rather than a website — and where it belongs. */
export function socialDetour(url: string): { key: "instagram" | "facebook" | "youtube" | "map"; label: string } | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const s of SOCIAL) if (s.re.test(host)) return { key: s.key, label: s.label };
  if (MAPS.test(host) || (/(^|\.)google\.[a-z.]+$/i.test(host) && /\/maps/i.test(url))) return { key: "map", label: "Google Maps" };
  return null;
}

/** Our own address. The seller template writes https://shubhora.com into the account's business.website, and a
 *  business set up afterwards must never have it own-imported and be renamed "Shubhora". */
export function isShubhoraHost(url: string): boolean {
  const h = hostOf(url);
  return h === "shubhora.com" || h.endsWith(".shubhora.com");
}

/** The four cards of the website step, in the order shown. hi/en, so the set-up and the V-Card form read alike. */
export const SITE_CARDS: { k: SiteKind; e: string; t: string; th: string; s: string; sh: string; takes: string; takesHi: string }[] = [
  {
    k: "own", e: "🏪",
    t: "My own website", th: "मेरी अपनी website",
    s: "Name, logo, photos and products come from it", sh: "नाम, logo, photos और products इसी से आएँगे",
    takes: "Your logo, photos, details and products are read from it. Check them on the next screen.",
    takesHi: "आपका logo, photos, जानकारी और products इसी से पढ़े जाएँगे। अगली screen पर देख लें।",
  },
  {
    k: "dealer", e: "🤝",
    t: "A brand's website — I am its dealer", th: "Brand की website — मैं dealer हूँ",
    s: "Only their products come, with MRP. Your name and number stay yours", sh: "सिर्फ़ उनके products आएँगे, MRP के साथ। नाम और number आपका ही रहेगा",
    takes: "Only the products — names, photos, specifications, MRP. Never the brand's logo, shop pictures, phone or address.",
    takesHi: "सिर्फ़ products — नाम, photo, specification, MRP। Brand का logo, दुकान की photo, phone, पता कभी नहीं।",
  },
  {
    k: "reference", e: "🎨",
    // Owner's call, 7 Oct 2026: the third choice is a "reference website" — any website of a business like theirs,
    // so the AI knows what they sell or do (and takes its look as a hint). The "no website" choice is gone from
    // the set-up: everyone picks one of the three; a reference without a link simply means none.
    t: "Reference website", th: "Reference website",
    s: "Any website of a business like yours. The AI learns what you sell or do, and its look", sh: "आपके जैसे किसी business की website। AI समझेगा आप क्या बेचते / करते हैं, और look भी",
    takes: "Only as an idea: what a business like yours offers, and its colours and layout. Never its words, photos, products or name.",
    takesHi: "सिर्फ़ idea के लिए: आपके जैसा business क्या देता है, और उसके रंग / layout। उसके शब्द, photo, products, नाम कभी नहीं।",
  },
  {
    k: "none", e: "❌",
    t: "No website", th: "नहीं है",
    s: "No problem — three quick things on the next screen", sh: "कोई बात नहीं — अगली screen पर बस तीन बातें",
    takes: "", takesHi: "",
  },
];

export const siteCard = (k: SiteKind | "") => SITE_CARDS.find((c) => c.k === k) ?? null;
