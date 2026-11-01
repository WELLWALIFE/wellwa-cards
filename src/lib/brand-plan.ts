// Brand + month plan — the words both the screens and the server share (owner, 1 Nov 2026, after a look at a content app:
// "copy nahi karna, us se best banana hai"). Isomorphic: no 'use client', no 'server-only'.
//
// The brand lives on the poster profile (poster_profiles.layout: accent, palette, tone, audience, usps; lang on the row).
// The month plan lives in poster_calendar: kind + product + overrides (the poster's own heading / line) + brief (the caption,
// hashtags, why this post), written by the AI once for the whole month and edited by the owner post by post.

/** How the brand should sound and look — up to three. The poster engine and the caption writer read them. */
export const TONES: { key: string; en: string; hi: string }[] = [
  { key: "modern", en: "Modern", hi: "Modern" },
  { key: "premium", en: "Premium", hi: "Premium" },
  { key: "desi", en: "Desi", hi: "देसी" },
  { key: "warm", en: "Warm & friendly", hi: "अपनापन" },
  { key: "bold", en: "Bold", hi: "Bold" },
  { key: "traditional", en: "Traditional", hi: "पारंपरिक" },
  { key: "festive", en: "Festive", hi: "त्योहारी" },
  { key: "minimal", en: "Minimal", hi: "सादा" },
  { key: "youthful", en: "Youthful", hi: "Young" },
  { key: "trust", en: "Trusted & expert", hi: "भरोसेमंद" },
  { key: "value", en: "Budget-friendly", hi: "किफ़ायती" },
  { key: "fun", en: "Fun", hi: "मज़ेदार" },
];
export const isTone = (k: unknown): k is string => typeof k === "string" && TONES.some((t) => t.key === k);

/** What the month's posts should talk about. Each key maps to the poster kinds the engine can draw. */
export const FOCUS: { key: string; en: string; hi: string; icon: string; kinds: string[] }[] = [
  { key: "products", en: "Products & services", hi: "Products / सेवाएँ", icon: "📦", kinds: ["product"] },
  { key: "offers", en: "Offers & prices", hi: "ऑफ़र और दाम", icon: "🏷️", kinds: ["offer"] },
  { key: "tips", en: "Tips & advice", hi: "काम की बातें", icon: "💡", kinds: ["tip"] },
  { key: "trust", en: "Customer trust", hi: "ग्राहकों का भरोसा", icon: "🤝", kinds: ["trust", "testimonial"] },
  { key: "festivals", en: "Festivals & days", hi: "त्योहार और दिन", icon: "🎉", kinds: ["festival", "greeting"] },
  { key: "about", en: "Behind the scenes", hi: "हमारे बारे में", icon: "🏪", kinds: ["about"] },
];
export const DEFAULT_FOCUS = ["products", "offers", "tips", "trust", "festivals"];

/** Every kind a calendar day can be (poster_calendar.kind; migration 0083 widened the check). */
export const DAY_KINDS = ["auto", "festival", "product", "offer", "greeting", "testimonial", "tip", "trust", "about", "skip"] as const;
export type DayKind = (typeof DAY_KINDS)[number];
export const KIND_TEXT: Record<DayKind, { icon: string; en: string; hi: string }> = {
  auto: { icon: "🤖", en: "Auto", hi: "अपने-आप" },
  festival: { icon: "🎉", en: "Festival", hi: "त्योहार" },
  product: { icon: "📦", en: "Product", hi: "प्रोडक्ट" },
  offer: { icon: "🏷️", en: "Offer", hi: "ऑफ़र" },
  greeting: { icon: "🙏", en: "Greeting", hi: "शुभकामना" },
  testimonial: { icon: "💬", en: "Customer review", hi: "ग्राहक की राय" },
  tip: { icon: "💡", en: "Tip", hi: "काम की बात" },
  trust: { icon: "🤝", en: "Why us", hi: "हम क्यों" },
  about: { icon: "🏪", en: "Our story", hi: "हमारी कहानी" },
  skip: { icon: "⏸", en: "No post", hi: "कोई post नहीं" },
};

/** The AI's brief for one day's post — poster_calendar.brief. The poster's own heading and small line are in overrides. */
export type DayBrief = {
  focus?: string;          // one of FOCUS keys
  hook?: string;           // the idea in one line (shown in the list)
  caption?: string;        // 2–3 lines, the owner's language, no phone / link (code adds those)
  hashtags?: string[];     // up to 6
  why?: string;            // "Why this post" — one sentence
  at?: string;             // when the brief was written (ISO)
};

export const clampStr = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
export const cleanTags = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : []).map((t) => `#${String(t).replace(/^#+/, "").replace(/[^\p{L}\p{M}\p{N}_]/gu, "")}`).filter((t) => t.length > 2 && t.length <= 32))].slice(0, 6);
export function cleanBrief(v: unknown): DayBrief {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: DayBrief = {};
  if (FOCUS.some((f) => f.key === o.focus)) out.focus = String(o.focus);
  if (clampStr(o.hook, 90)) out.hook = clampStr(o.hook, 90);
  if (typeof o.caption === "string" && o.caption.trim()) out.caption = o.caption.replace(/https?:\/\/\S+/gi, "").replace(/(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 600);
  const tags = cleanTags(o.hashtags); if (tags.length) out.hashtags = tags;
  if (clampStr(o.why, 160)) out.why = clampStr(o.why, 160);
  if (typeof o.at === "string") out.at = o.at;
  return out;
}

/** A palette the owner can pick from when the logo gives no colour. */
export const PALETTE_PRESETS: { hex: string; en: string; hi: string }[] = [
  { hex: "#c2410c", en: "Saffron", hi: "केसरिया" }, { hex: "#b91c1c", en: "Red", hi: "लाल" }, { hex: "#be185d", en: "Pink", hi: "गुलाबी" },
  { hex: "#6d28d9", en: "Purple", hi: "बैंगनी" }, { hex: "#1d4ed8", en: "Blue", hi: "नीला" }, { hex: "#0f766e", en: "Teal", hi: "हरा-नीला" },
  { hex: "#15803d", en: "Green", hi: "हरा" }, { hex: "#a16207", en: "Gold", hi: "सुनहरा" }, { hex: "#1f2937", en: "Charcoal", hi: "गहरा" },
];
export const HEX6 = /^#[0-9a-f]{6}$/i;

/** The brand as the screens read it (the parts of the profile that matter here). */
export type BrandSnapshot = {
  profileId: string; name: string; tagline: string; logo_url: string; lang: string; category: string; city: string;
  accent: string; palette: string[]; tone: string[]; audience: string; usps: string[];
  website: string; about: string; photos: string[];
};
/** Is the brand set up enough for the plan to sound like the owner? (tone or audience chosen, a colour on record) */
export const brandReady = (b: Pick<BrandSnapshot, "tone" | "audience" | "accent">) => !!(b.accent && (b.tone.length || b.audience));
