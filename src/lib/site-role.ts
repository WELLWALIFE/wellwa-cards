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
    t: "Yes — my own website", th: "हाँ, मेरी अपनी website है",
    s: "Name, logo, photos, products — all filled from it", sh: "नाम, logo, photos, products सब इसी से आ जाएँगे",
    takes: "We take everything useful — your logo, photos, details and products. Check them on the next screen.",
    takesHi: "हम सब कुछ लेंगे — logo, photos, जानकारी और products। अगली screen पर देख लेना।",
  },
  {
    k: "dealer", e: "🤝",
    t: "A brand's website — I am its dealer / distributor", th: "मैं किसी company का dealer / distributor हूँ — उनकी website",
    s: "Only their products come across, as MRP — your own name and number stay", sh: "सिर्फ़ उनके products आएँगे (MRP के साथ) — नाम, number आपका ही रहेगा",
    takes: "Only the products — names, photos, specifications, MRP. Never the brand's logo, shop pictures, phone or address.",
    takesHi: "सिर्फ़ products — नाम, photo, specification, MRP। Brand का logo, दुकान की photo, phone, पता कभी नहीं।",
  },
  {
    k: "reference", e: "🎨",
    t: "A website I like — or a competitor's", th: "कोई website पसंद है — या किसी competitor की",
    s: "Only its look: colours, fonts, layout. Never its words, photos, products or name", sh: "सिर्फ़ उसका look — रंग, font, layout। उसके शब्द, फोटो, products, नाम कभी नहीं",
    takes: "Only the look is copied. Free plan: stock photos of YOUR trade; paid plan: AI pictures in that site's mood. It is never shown as your website.",
    takesHi: "सिर्फ़ look copy होगा। Free plan: आपके काम की stock photos; paid: उस site के mood में AI pictures। वो आपकी website के रूप में कभी नहीं दिखेगी।",
  },
  {
    k: "none", e: "❌",
    t: "No website", th: "नहीं है",
    s: "No problem — three quick things on the next screen", sh: "कोई बात नहीं — अगली screen पर बस तीन बातें",
    takes: "", takesHi: "",
  },
];

export const siteCard = (k: SiteKind | "") => SITE_CARDS.find((c) => c.k === k) ?? null;
