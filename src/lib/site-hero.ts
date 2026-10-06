// The hero, as one model (docs/premium-look.md §3.1): kicker, headline, one line of benefit, a quiet trust row, one
// filled button and one plain one, the photo and how to crop it. `heroModel(card, lang)` is the ONLY source for all
// four heroes (board / cover / slide / classic), so every blueprint says the same true things about the business
// and the copy rules live in one place. Nothing here changes the stored card: the name sanitiser, the honorific
// and the trade copy are website-only; card-compose.ts (vCard, SEO, bot) is untouched.
//
// Isomorphic: no 'use client', no 'server-only', no DOM — the server HTML carries the open state and the final
// numbers, and the preview iframe builds the same model on the client.
import { HERO_VARIANTS, type Card, type CardBlock, type HeroVariant, type HoursRow } from "@/lib/types";
import { categoryOf } from "@/lib/poster-categories";
import { openNow } from "@/lib/open-now";
import { sinceYear } from "@/lib/site-home";
import { tradeMood } from "@/lib/trade-moods";
import type { BlueprintKey } from "@/lib/site-blueprints";

export type { HeroVariant };

/* ================= variants ================= */

/** The hero variants per blueprint (§3.7; the flat list is HERO_VARIANTS in types.ts). Ship-first: board /
 *  board-statement, cover / cover-ink, slide-photo / slide-ink; the rest are the "Then" column, each behind its gate
 *  (site-designer.ts heroAllowed). */
export const HERO_VARIANTS_BY_BP: Record<BlueprintKey, readonly HeroVariant[]> = {
  bento: ["board", "board-statement", "board-photo-first", "board-ink", "board-still"],
  cinematic: ["cover", "cover-ink", "cover-split", "cover-centre"],
  story: ["slide-photo", "slide-ink", "slide-duo", "slide-type"],
};
export const isHeroVariant = (v: unknown): v is HeroVariant => typeof v === "string" && (HERO_VARIANTS as readonly string[]).includes(v);

/** The variant a blueprint falls back to when the card has no photo and no clip. */
const NO_PHOTO: Record<HeroVariant, HeroVariant> = {
  board: "board-statement", "board-statement": "board-statement", "board-photo-first": "board-statement", "board-ink": "board-ink", "board-still": "board-still",
  cover: "cover-ink", "cover-ink": "cover-ink", "cover-split": "cover-ink", "cover-centre": "cover-ink",
  "slide-photo": "slide-ink", "slide-ink": "slide-ink", "slide-duo": "slide-ink", "slide-type": "slide-type",
};
/** Variants that draw the headline over the photo (scrim, grain, Ken Burns, a clip). */
export const OVER_PHOTO: ReadonlySet<HeroVariant> = new Set<HeroVariant>(["cover", "cover-centre", "slide-photo"]);

/* ================= the model ================= */

export type HeroModel = {
  /** "Jeweller · Rewari" | "Dermatologist · Jaipur" | "ज्वेलर · रेवाड़ी" — the CSS uppercases it (not in Hindi). */
  kicker: string;
  /** Website-only sanitised name; "Dr." per honorific(); never "/". */
  name: string;
  /** AI (≤ 6 words, ≠ name) else the trade group's headline. */
  headline: string;
  /** ≤ 90 chars; never "<Trade> in <City> since <Y>." */
  sub: string;
  trust: { rating?: { v: number; n: number }; since?: number; city?: string; open?: { state: "open" | "closed"; until: string } };
  primary: { label: string; href: string; kind: "whatsapp" | "call" | "book" };
  /** "Call +91 98765 43210" (fmtPhone), or the booking page when Call is the primary. */
  secondary?: { label: string; href: string; kind: "call" | "book" };
  /** `card.coverUrl` only — never hero.imageUrl, a product shot or the logo. `focus` is the card's one subject point;
   *  `bpFocus()` derives the crop per blueprint at render. `dark` = the bottom of the picture is dark (= !bright), so
   *  the standard scrim is enough and grain may sit on it. */
  photo?: { src: string; focus: string; lqip?: string; bright: boolean; dark: boolean };
  /** The Premium trade clip (card.site.hero.video !== false): `cover` and `slide-photo` only, desktop only on cover. */
  clip?: { url: string; poster: string };
  logo?: string;
  /** No owner logo (the monogram never reaches the website): the nav shows the name as a wordmark. */
  wordmark: boolean;
  variant: HeroVariant;
  /** The hours rows behind `trust.open`, so <TrustRow> can keep ticking after the server HTML (site-smart.tsx). */
  hours?: HoursRow[];
};

type Lang = "en" | "hi" | string;

/** The hero fields the tokens step adds to `card.site.hero` (types.ts: lqip / bright / kicker) and to the style
 *  (heroVariant). Read through this widening so the model compiles before and after they land. */
type HeroExtra = { lqip?: string; bright?: boolean; kicker?: string };
type StyleExtra = { heroVariant?: string };

/** Everything the four heroes need, from the card alone. `lang` is the VISITOR's language (L.lang), not the build's. */
export function heroModel(card: Card, lang: Lang): HeroModel {
  const hi = lang === "hi";
  const site = card.site;
  const hero = site?.hero as (NonNullable<Card["site"]>["hero"] & HeroExtra) | undefined;
  const style = site?.style as (NonNullable<Card["site"]>["style"] & StyleExtra) | undefined;
  const catKey = card.seo?.categoryKey ?? "";
  const cat = categoryOf(catKey);
  const mood = tradeMood(catKey);
  const city = (card.seo?.city ?? "").trim();
  const blocks = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);

  /* ---- name, honorific, kicker ---- */
  const rawName = (card.lead === "business" ? card.company || card.name : card.name) || card.company || "";
  const base = sanitiseName(rawName);
  const hon = honorific(card, hi);
  const name = hon && !/^(dr\.?|doctor|डॉ\.?|डॉक्टर)\s/i.test(base) ? `${hon} ${base}` : base;
  const trade = tradeLabel(card, hi);
  // The composer writes the speciality (first trade answer: "Dermatologist", "CBSE") into hero.kicker; the trade's
  // own word stands in until it does. `card.jobTitle` is only the trade label, so it is not a speciality.
  const kickerTrade = (hero?.kicker ?? "").trim() || trade;
  const kicker = [kickerTrade, city].filter((x) => x && !(kickerTrade && city && norm(kickerTrade).includes(norm(city)))).join(" · ");

  /* ---- copy ---- */
  const labels = [cat?.en, cat?.hi, card.seo?.category, card.jobTitle].filter((x): x is string => !!x);
  const copy = hi ? "hi" : "en";
  const headline = aiHeadline(hero?.headline, [rawName, card.company, card.name], labels) ?? mood.headline[copy];
  const sub = aiSub(hero?.sub, labels) ?? benefitSub(mood.benefit[copy], city, hi);

  /* ---- trust ---- */
  const reviews = blocks.flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim());
  const rating = reviews.length >= 3 ? { v: Math.round((reviews.reduce((s, x) => s + (Number(x.rating) || 0), 0) / reviews.length) * 10) / 10, n: reviews.length } : undefined;
  const since = sinceYear([
    ...blocks.flatMap((b) => (b.kind === "highlights" ? b.items : [])),
    ...(site?.home?.stats ?? []).map((s) => `${s.value} ${s.label}`),
    card.about ?? "", card.tagline ?? "", card.botKnowledge ?? "",
  ]) ?? undefined;
  const hours = blocks.find((b): b is Extract<CardBlock, { kind: "hours" }> => b.kind === "hours" && b.rows.length > 0)?.rows;
  const now = hours ? openNow(hours) : null;
  const open = now ? { state: now.state, until: hi ? now.noteHi : now.note } : undefined;
  const trust: HeroModel["trust"] = { ...(rating ? { rating } : {}), ...(since ? { since } : {}), ...(city ? { city } : {}), ...(open ? { open } : {}) };

  /* ---- buttons ---- */
  const links = card.links.filter((l) => (l.value ?? "").trim());
  const wa = links.find((l) => l.type === "whatsapp");
  const phone = links.find((l) => l.type === "phone");
  const bookingSlug = card.pages.find((p) => !p.hidden && p.blocks.some((b) => b.kind === "appointment"))?.slug ?? (blocks.some((b) => b.kind === "contact") ? "contact" : "");
  const call = phone ? { label: `${hi ? "कॉल" : "Call"} ${fmtPhone(phone.value)}`, href: `tel:${phone.value.trim()}`, kind: "call" as const } : null;
  const book = bookingSlug ? { label: hi ? "बुक करें" : "Book a visit", href: `#${bookingSlug}`, kind: "book" as const } : null;
  const primary: HeroModel["primary"] = wa
    ? { label: (hero?.ctaLabel ?? "").trim() || (hi ? "WhatsApp करें" : "WhatsApp us"), href: waHref(card, wa.value), kind: "whatsapp" }
    : call ?? book ?? { label: hi ? "संपर्क करें" : "Contact us", href: "#contact", kind: "book" };
  const secondary = primary.kind !== "call" && call ? call : primary.kind !== "book" && book ? book : undefined;

  /* ---- picture, clip, logo ---- */
  const bp = style?.blueprint;
  const src = heroPhotoSrc(card.coverUrl);
  const photo: HeroModel["photo"] | undefined = src
    ? { src, focus: bpFocus(hero?.focus || defaultFocus(src), bp), ...(hero?.lqip ? { lqip: hero.lqip } : {}), bright: !!hero?.bright, dark: !hero?.bright }
    : undefined;
  const logo = (site?.logoUrl ?? "").trim();
  const ownLogo = logo && !logo.startsWith("/api/monogram/") ? logo : undefined;

  /* ---- variant ---- */
  const products = blocks.flatMap((b) => (b.kind === "product" ? b.items : []));
  const stills = products.filter((p) => ownUpload(p.images?.[0] ?? p.imageUrl)).length;
  const wanted = isHeroVariant(style?.heroVariant) && variantFits(style.heroVariant!, bp) ? style.heroVariant! : defaultVariant(bp, style?.hero, mood.heroVariant);
  let variant: HeroVariant = wanted;
  const video = site?.hero?.video !== false ? blocks.find((b): b is Extract<CardBlock, { kind: "video" }> => b.kind === "video" && /\.mp4(\?|$)/i.test(b.url)) : undefined;
  const clip = video && (variant === "cover" || variant === "slide-photo") ? { url: video.url, poster: video.posterUrl || photo?.src || "" } : undefined;
  if (!photo && !clip) variant = NO_PHOTO[variant];
  if (variant === "board-still" && stills < 4) variant = "board-statement";

  return {
    kicker, name, headline, sub, trust, primary, ...(secondary ? { secondary } : {}),
    ...(photo ? { photo } : {}), ...(clip ? { clip } : {}), ...(ownLogo ? { logo: ownLogo } : {}), wordmark: !ownLogo,
    variant, ...(hours ? { hours } : {}),
  };
}

/* ================= pieces (exported for the blueprints and the trade check) ================= */

/** Every emoji and pictograph out of a line: "📍 Main market" → "Main market". */
export function stripEmoji(s: string): string {
  return (s ?? "").replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu, "").replace(/\s+/g, " ").trim();
}

/** The website's name for a business: "Test Gym / fitness / yoga" → "Test Gym"; emoji and doubled spaces gone. The
 *  stored card keeps the owner's spelling — this runs only here. */
export function sanitiseName(raw: string): string {
  return nameParts(raw).name;
}
/** The name and the trade words after its slashes ("Test Gym / fitness / yoga" → ["fitness", "yoga"]). */
export function nameParts(raw: string): { name: string; alts: string[] } {
  const parts = stripEmoji(raw).split(/\s*\/\s*|\s+\|\s+/).map((x) => x.trim()).filter(Boolean);
  return { name: parts[0] ?? "", alts: parts.slice(1) };
}

/** "Dr." (or "डॉ.") only for a PERSON-led doctor / dentist / ayurveda card — never "Dr. City Hospital". */
export function honorific(card: Pick<Card, "lead" | "seo">, hi = false): string {
  if (card.lead === "business" || !/^(doctor|dentist|ayurveda)$/.test(card.seo?.categoryKey ?? "")) return "";
  return hi ? "डॉ." : "Dr.";
}

/** "9876543210" / "+91 98765-43210" / "09876543210" → "+91 98765 43210"; a landline or a foreign number as typed. */
export function fmtPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const n = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (/^[6-9]\d{9}$/.test(n)) return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  return (raw ?? "").trim();
}

/** The crop per blueprint from the card's ONE subject point ("62% 38%", hero.focus): the bento tile pulls the
 *  subject toward the middle, cinematic keeps it, story lifts it (the headline sits low on a slide). Pure, so
 *  `applyLook` in the preview iframe gets the same crop as the server. */
export function bpFocus(focus: string | undefined, bp: BlueprintKey | string | undefined): string {
  const m = /^\s*(\d{1,3})%\s+(\d{1,3})%\s*$/.exec(focus ?? "");
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const x = m ? clamp(Number(m[1])) : 50, y = m ? clamp(Number(m[2])) : 35;
  const pull = bp === "bento" ? 50 : bp === "story" ? 30 : null;
  return `${x}% ${pull === null ? y : Math.round(y + (pull - y) * 0.5)}%`;
}

/** True for a picture the OWNER put in our storage (or a preview data: URL before publishing) — never a stock or
 *  trade picture (/api/stock, /art, /wellwa), a `ref-N` picture the AI drew from a reference site, a sample, or a
 *  photo hot-linked from another website. Only such a picture may stand as a still-life on a no-photo hero. */
export function ownUpload(url: string | undefined | null): boolean {
  const u = (url ?? "").trim();
  if (!u) return false;
  if (u.startsWith("data:image/") || u.startsWith("blob:")) return true;
  if (u.startsWith("/")) return false;
  if (!/^https:\/\/[^/]+\/storage\/v1\/object\/public\/media\//.test(u)) return false;
  if (/\/ref-\d+-\d+\.\w+(?:\?|$)/.test(u)) return false;
  if (/\/(?:samples?|stock|demo)\//i.test(u)) return false;
  return true;
}

/** The trade's one word for the kicker, in the visitor's language: "Jeweller", "Gym", "डॉक्टर". */
export function tradeLabel(card: Pick<Card, "seo" | "jobTitle" | "lead" | "company" | "name">, hi = false): string {
  const cat = categoryOf(card.seo?.categoryKey ?? "");
  if (cat && cat.key !== "other") {
    const word = KICKER_WORD[cat.key]?.[hi ? "hi" : "en"];
    if (word) return word;
    return nameParts(hi ? cat.hi : cat.en).name;
  }
  const seo = (card.seo?.category ?? "").trim();
  if (seo && !/^(other|अन्य)$/i.test(seo)) return nameParts(seo).name;
  const job = (card.jobTitle ?? "").trim();
  if (job && job.length <= 28 && !/^(dr\.?|owner|founder|director|proprietor)$/i.test(job)) return nameParts(job).name;
  // "Test Gym / fitness / yoga": the first alt after the slash is the trade.
  return nameParts(card.lead === "business" ? card.company || card.name : card.name).alts[0] ?? "";
}
/** Where the category's label is a shop, not a trade ("Jewellery" → "Jeweller"). */
const KICKER_WORD: Record<string, { en: string; hi: string }> = {
  jewellery: { en: "Jeweller", hi: "ज्वेलर" },
  sweets: { en: "Sweets & bakery", hi: "मिठाई व बेकरी" },
  garments: { en: "Clothing", hi: "कपड़े" },
  doctor: { en: "Clinic", hi: "क्लिनिक" },
  catering: { en: "Caterer", hi: "कैटरर" },
  photography: { en: "Photographer", hi: "फ़ोटोग्राफ़र" },
};

/** The composer's / textAudit's fallback line — "Sweets / bakery in Dharuhera, since 2015" or "मिठाई — धारूहेड़ा में,
 *  2015 से" — is data, not a benefit; the hero never prints it. `labels` are the trade's labels on this card. */
export function isAutoSub(sub: string, labels: string[] = []): boolean {
  const t = (sub ?? "").trim().replace(/[.।]\s*$/, "");
  if (!t) return false;
  // (No \b after Devanagari: it is ASCII-only without the u flag, and with it a matra is not a word character.)
  if (/(?:,\s*|\s)(?:since\s+(?:19|20)\d\d|(?:19|20)\d\d\s+से)$/i.test(t) && /\s(?:in|—)\s|\sमें(?:\s|,|$)/.test(t)) return true;
  const m = /^(.+?)\s(?:in|—)\s(.+?)(?:\sमें)?$/.exec(t);
  if (!m) return false;
  const head = norm(m[1]);
  return labels.some((l) => l && (norm(l) === head || norm(nameParts(l).name) === head));
}

/** The opening line every WhatsApp button sends (the owner sees the lead came from the website). Same words as
 *  site-view.tsx's `waOpen`, with the website's sanitised name ("Hi Test Cafe", not "Hi Test Cafe / tea stall"). */
export function waOpening(card: Pick<Card, "language" | "company" | "name">): string {
  const who = sanitiseName(card.company || card.name);
  return card.language === "hi" ? `नमस्ते ${who}, मैंने आपकी website देखी — ` : `Hi ${who}, I saw your website — `;
}
const waHref = (card: Card, value: string) => `https://wa.me/${value.replace(/\D/g, "")}?text=${encodeURIComponent(waOpening(card))}`;

/* ================= internals ================= */

const norm = (s: string) => stripEmoji(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The AI's headline when it is a claim: ≤ 6 words, no slash, not the name again (the composer writes the name into
 *  hero.headline, which is what the old heroes printed) and not name-SHAPED — "Sharma Jewellers", "Test Clinic":
 *  take the trade's own words out and at most one word is left. */
function aiHeadline(raw: string | undefined, names: (string | undefined)[], labels: string[]): string | null {
  const h = stripEmoji(raw ?? "");
  if (!h || h.includes("/") || words(h) > 6) return null;
  const key = norm(h);
  if (names.some((n) => n && (norm(n) === key || norm(nameParts(n).name) === key))) return null;
  const tradeWords = new Set(labels.flatMap((l) => norm(l).split(" ")).filter((w) => w.length > 2));
  if (tradeWords.size && key.split(" ").filter((w) => !tradeWords.has(w) && !tradeWords.has(w.replace(/s$/, ""))).length <= 1) return null;
  return h;
}

function aiSub(raw: string | undefined, labels: string[]): string | null {
  const s = stripEmoji(raw ?? "");
  if (!s || Array.from(s).length > 90 || isAutoSub(s, labels)) return null;
  return s;
}

/** "Bridal sets, 22K BIS. Rewari." / "ब्राइडल सेट, 22K BIS। रेवाड़ी।" — ≤ 90 chars, the city dropped before the benefit. */
function benefitSub(benefit: string, city: string, hi: boolean): string {
  const stop = hi ? "।" : ".";
  const line = `${benefit.replace(/[.।]\s*$/, "")}${stop}`;
  const withCity = city ? `${line} ${city}${stop}` : line;
  return Array.from(withCity).length <= 90 ? withCity : line;
}

/** `card.coverUrl` is the only hero picture, and only when it is a photograph: the tinted fallback art
 *  (/art/cover-*.svg), any SVG and the monogram are not. */
function heroPhotoSrc(cover: string | undefined): string | undefined {
  const u = (cover ?? "").trim();
  if (!u || u.startsWith("/api/monogram/") || /\.svg(?:\?|$)/i.test(u.split("#")[0]) || u.startsWith("data:image/svg")) return undefined;
  return u;
}
/** The trade banners (/api/stock/banners, 1600×600) fade to white on the left third for poster text: the scene is on
 *  the right, so their subject point defaults to the right half. Other photos: the usual 50% 35%. */
function defaultFocus(src: string): string {
  return src.startsWith("/api/stock/banners/") ? "70% 50%" : "50% 35%";
}

const variantFits = (v: HeroVariant, bp: BlueprintKey | undefined): boolean => HERO_VARIANTS_BY_BP[bp ?? "cinematic"].includes(v);

/** The blueprint's default variant from the trade's brief; a classic page (no blueprint) maps its hero layout onto
 *  the cover family (§3.6: photo = cover, split = cover-split). */
function defaultVariant(bp: BlueprintKey | undefined, layout: string | undefined, byBp: Record<BlueprintKey, HeroVariant>): HeroVariant {
  if (bp) return byBp[bp];
  return layout === "photo" || layout === "editorial" ? "cover" : "cover-split";
}
