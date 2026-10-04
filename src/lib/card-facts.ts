// The shared contract for "Make your V-Card": the facts the owner gives us (saved in
// poster_profiles.card_facts), the request/response shapes of /api/card/facts and /api/card/build,
// and the small pure helpers every side needs (cover art, readable theme colour, thin-card test,
// safe merge of a rebuilt card into a live one).
//
// Isomorphic on purpose: no 'use client', no 'server-only'. It runs in the API routes and in the
// browser, so it must stay free of fetch, env and Node/DOM APIs.
import type { Card, SpecRow } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import { luminance } from "@/lib/color";
import { isShubhoraHost } from "@/lib/site-role";
import { cleanStyle } from "@/lib/site-style";
import type { SiteStyle } from "@/lib/types";

/* ================= facts ================= */

export type Lang = "en" | "hi" | "hinglish";

/** Everything the owner told us while making the V-Card. Field names match the old
 *  /api/card/build body, so older clients still send a valid (flat) facts object. */
export type CardFacts = {
  v: 1;
  website: string;
  /** Whose website it is (owner's call, 27 Sep 2026): "own" — everything on it may be used (logo, pictures, details,
   *  products); "dealer" — the maker's / brand's site of products the owner sells: only the product names, photos and
   *  specifications are taken, never the brand's logo, shop pictures, phone or address; "reference" (30 Sep 2026) —
   *  a website the owner LIKES: only its look (colours, fonts, layout) and tone are followed, no fact, picture or
   *  product is taken from it and it is never shown as the owner's own website. */
  websiteRole: "own" | "dealer" | "reference";
  /** When the owner ticked "I am this brand's authorised dealer / distributor" for the dealer site above (ISO
   *  time), kept with the URL so the claim is on record. "" when never ticked (accounts from before the box). */
  dealerAssertedAt: string;
  work: string;
  customers: string[];
  special: string[];
  specialText: string;
  homeService: "" | "yes" | "no";
  hours: string;
  since: string;
  offer: string;
  areas: string;
  payments: string[];
  upi: string;
  qualification: string;
  /** The owner's designation on the card — Owner, Director, Dr., Advocate… (profile step 1, 2 Oct 2026). */
  designation: string;
  /** A WhatsApp number different from the mobile (10 digits); "" = the mobile is the WhatsApp number. */
  whatsapp: string;
  /** Team size, in the owner's words ("12 people", "family run"). */
  team: string;
  /** Years of experience (1–2 digits) — the trust pill when there is no "since" year. */
  experience: string;
  /** The trade's own questions (trade-questions.ts): question key → chosen options / typed line, e.g.
   *  { classes: ["Nursery–12th"], board: ["CBSE"], offerings: ["School transport", …] }. English option names. */
  tradeAnswers: Record<string, string[]>;
  /** google = the owner's Google Maps link. */
  social: { instagram: string; facebook: string; youtube: string; google: string };
  bannerUrl: string;
  photos: string[];
  /** Lowercase product names the owner left off the V-Card (they stay on the Products page). */
  hidden: string[];
  lang: Lang;
  primaryCardId: string;
  /** The website look the owner picked before the build (palette, font, hero, corners); unset = the trade's own. */
  style?: SiteStyle;
};

/** A UPI ID such as sharmasweets@okhdfc. */
/** name@bank. The handle may carry a dot (owner, 4 Oct 2026: "@hdfcbank.com" was refused). */
export const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.]{1,63}$/i;

const LANGS: readonly Lang[] = ["en", "hi", "hinglish"];
const CARD_ID_RE = /^[0-9a-f-]{36}$/i;

/** Freezes the whole object tree so a shared default can never be changed by mistake
 *  (on the server that would leak one owner's answers into the next request). */
function deepFreeze<T extends object>(o: T): T {
  for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v as object);
  return Object.freeze(o) as T;
}

/** The empty answer set. Frozen: copy it (or call normalizeFacts({})) before changing anything. */
export const EMPTY_FACTS: CardFacts = deepFreeze<CardFacts>({
  v: 1,
  website: "",
  websiteRole: "own",
  dealerAssertedAt: "",
  work: "",
  customers: [],
  special: [],
  specialText: "",
  tradeAnswers: {},
  homeService: "",
  hours: "",
  since: "",
  offer: "",
  areas: "",
  payments: [],
  upi: "",
  qualification: "",
  designation: "",
  whatsapp: "",
  team: "",
  experience: "",
  social: { instagram: "", facebook: "", youtube: "", google: "" },
  bannerUrl: "",
  photos: [],
  hidden: [],
  lang: "en",
  primaryCardId: "",
});

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});

/** Drops keys whose value is undefined, so a patch like { hours: undefined } changes nothing. */
function definedOnly<T extends object>(o: T | null | undefined): Partial<T> {
  const out: Obj = {};
  if (o) for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Cuts to `max` UTF-16 units without leaving half an emoji (a lone surrogate breaks Postgres jsonb). */
function cut(s: string, max: number): string {
  let out = s.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out;
}

/**
 * A clean, trimmed string of at most `max` characters; "" for anything that is not a string or a number.
 * Control characters and broken surrogates are removed. Single-line fields have all whitespace
 * collapsed to one space; multi-line fields keep their line breaks.
 */
function text(x: unknown, max: number, multiline = false): string {
  const raw = typeof x === "string" ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
  if (!raw) return "";
  let s = "";
  for (const ch of cut(raw, max * 4 + 64)) {
    const c = ch.charCodeAt(0);
    if (c === 10) s += multiline ? "\n" : " ";
    else if (c < 32 || c === 127) s += " ";
    else if (ch.length === 1 && c >= 0xd800 && c <= 0xdfff) continue; // lone surrogate
    else s += ch;
  }
  s = multiline ? s.replace(/[ \t\r\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return cut(s.trim(), max).trim();
}

/** Up to `n` unique (case-insensitive) non-empty strings of at most `max` characters each. */
function list(x: unknown, n: number, max: number, lower = false): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of Array.isArray(x) ? x.slice(0, n * 4 + 8) : []) {
    let s = text(v, max);
    if (lower) s = s.toLowerCase();
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= n) break;
  }
  return out;
}

/** An https:// address of at most 500 characters with nothing that could break out of src="" or url(). */
function httpsUrl(x: unknown): string {
  const s = typeof x === "string" ? x.trim() : "";
  return s.length <= 500 && s.startsWith("https://") && s.length > 8 && !/[\s"'<>\\]/.test(s) ? s : "";
}

function normalizeObj(r: Obj): CardFacts {
  const social = obj(r.social);
  let website = text(r.website, 300);
  if (!website && typeof social.website === "string") website = text(social.website, 300); // legacy: website sent inside social

  const since = text(r.since, 10);
  const sinceYear = Number(since);
  const upi = text(r.upi, 330).toLowerCase();
  const bannerUrl = httpsUrl(r.bannerUrl);
  const photos: string[] = [];
  for (const p of Array.isArray(r.photos) ? r.photos.slice(0, 40) : []) {
    const u = httpsUrl(p);
    if (u && u !== bannerUrl && !photos.includes(u)) photos.push(u);
    if (photos.length >= 6) break;
  }
  const primaryCardId = text(r.primaryCardId, 36);
  const assertedAt = text(r.dealerAssertedAt, 30);
  const style = cleanStyle(r.style);
  const whatsapp = text(r.whatsapp, 20).replace(/\D/g, "").slice(-10);
  const experience = text(r.experience, 4).replace(/\D/g, "");
  const tradeAnswers: Record<string, string[]> = {};
  const ta = obj(r.tradeAnswers);
  for (const k of Object.keys(ta).slice(0, 24)) {
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(k)) continue;
    const v = list(ta[k], 16, 80);
    if (v.length) tradeAnswers[k] = v;
  }

  return {
    v: 1,
    ...(style && Object.keys(style).length ? { style } : {}),
    website,
    // A competitor's site is a reference site (look only) — the word reaches here from older clients and must
    // never fall through to "own", which would import the competitor's name and products.
    websiteRole: r.websiteRole === "dealer" ? "dealer" : r.websiteRole === "reference" || r.websiteRole === "competitor" ? "reference" : "own",
    dealerAssertedAt: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(assertedAt) ? assertedAt : "",
    work: text(r.work, 800, true),
    customers: list(r.customers, 8, 60),
    special: list(r.special, 8, 60),
    specialText: text(r.specialText, 300, true),
    homeService: r.homeService === "yes" || r.homeService === "no" ? r.homeService : "",
    hours: text(r.hours, 120, true),
    since: /^\d{4}$/.test(since) && sinceYear >= 1900 && sinceYear <= new Date().getFullYear() ? since : "",
    offer: text(r.offer, 160, true),
    areas: text(r.areas, 200),
    payments: list(r.payments, 6, 30),
    upi: UPI_RE.test(upi) ? upi : "",
    qualification: text(r.qualification, 120),
    designation: text(r.designation, 60),
    whatsapp: whatsapp.length === 10 ? whatsapp : "",
    team: text(r.team, 40),
    tradeAnswers,
    experience: experience && Number(experience) >= 1 && Number(experience) <= 80 ? String(Number(experience)) : "",
    social: {
      instagram: text(social.instagram, 300),
      facebook: text(social.facebook, 300),
      youtube: text(social.youtube, 300),
      google: text(social.google, 300),
    },
    bannerUrl,
    photos,
    hidden: list(r.hidden, 30, 60, true),
    lang: LANGS.includes(r.lang as Lang) ? (r.lang as Lang) : "en",
    primaryCardId: CARD_ID_RE.test(primaryCardId) ? primaryCardId : "",
  };
}

/** Any stored or posted value → a complete, capped CardFacts. Never throws. */
export function normalizeFacts(raw: unknown): CardFacts {
  try {
    return normalizeObj(obj(raw));
  } catch {
    return normalizeObj({});
  }
}

/** `base` with the keys present in `patch` replaced (social is merged key by key). Keys set to
 *  undefined are ignored; send "" or [] to clear a field. Never throws. */
export function mergeFacts(base: CardFacts, patch: unknown): CardFacts {
  try {
    const b = obj(base);
    const p = definedOnly(obj(patch));
    return normalizeFacts({ ...b, ...p, social: { ...obj(b.social), ...definedOnly(obj(p.social)) } });
  } catch {
    return normalizeFacts(base);
  }
}

/* ================= categories, colour and cover art ================= */

/** Trades whose card gets the "Book an appointment" block. */
export const BOOKING_CATEGORIES: ReadonlySet<string> = new Set([
  "doctor", "dentist", "ayurveda", "hospital", "salon", "spa", "gym", "mehndi",
  "ca", "lawyer", "astro", "photography", "interior", "coaching", "dance", "teacher",
]);

/** Every distinct category accent in poster-categories.ts. Each one has a generated cover at
 *  public/art/cover-<hex>.svg (scripts/gen-art.mjs keeps an identical list). */
export const COVER_ACCENTS: readonly string[] = [
  "#f59e0b", "#db2777", "#d4af37", "#2563eb", "#92400e", "#dc2626", "#0e9e90", "#ea580c", "#7c3aed",
  "#0369a1", "#1f2937", "#b91c1c", "#78350f", "#c2410c", "#0f766e", "#0891b2", "#166534", "#16a34a",
  "#1e3a8a", "#111827", "#1d4ed8", "#b45309", "#374151", "#0f172a", "#0284c7", "#4f46e5", "#ff9933",
];

const DEFAULT_ACCENT = "#0e9e90";

/** "#EA580C", "ea580c" or "#abc" → "#ea580c" / "#aabbcc"; null when not a hex colour. */
function hex6(x: unknown): string | null {
  const s = typeof x === "string" ? x.trim().toLowerCase() : "";
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/.exec(s);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h}`;
}

/** The free abstract cover in the category colour; the teal cover for any other colour. */
export function coverArtFor(accent?: string | null): string {
  const h = hex6(accent);
  return `/art/cover-${(h && COVER_ACCENTS.includes(h) ? h : DEFAULT_ACCENT).slice(1)}.svg`;
}

/** `a` moved `t` (0..1) of the way to `b`, both #rrggbb. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255, y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** A theme colour dark enough for white button text: light accents (yellow, gold, saffron) are
 *  darkened in 10% steps until their luminance is at most 0.3. Invalid input → brand teal. */
export function readableTheme(hex: string): string {
  let h = hex6(hex);
  if (!h) return DEFAULT_ACCENT;
  for (let i = 0; i < 8 && luminance(h) > 0.3; i++) h = mixHex(h, "#000000", 0.1);
  return h;
}

/* ================= cards ================= */

/**
 * A card that is not really made yet: no own name, a "Your Name" template, or nothing on it but
 * (at most) one empty About block. Only such a card is rebuilt without asking.
 * A short card the owner made on purpose is NOT thin.
 */
export function isThinCard(c: Pick<Card, "name" | "pages"> & { about?: string }): boolean {
  const name = (c.name ?? "").trim();
  if (!name || /\byour name\b/i.test(name)) return true;
  const blocks = (c.pages ?? []).flatMap((p) => p?.blocks ?? []);
  if (blocks.length > 1 || (c.about ?? "").trim()) return false;
  const only = blocks[0];
  return !only || (only.kind === "about" && !(only.body ?? "").trim());
}

const isOurArt = (url: string) => /^(?:https?:\/\/[^/]+)?\/(?:art|wellwa)\//i.test(url);
/** Shubhora's OWN logo and banner — put on a card by the seller template. A customer's business must never
 *  carry them as its identity: seen live on a mobile shop whose website hero was the Shubhora logo over the
 *  Shubhora banner. On a rebuild they count as "no picture", so the built or stock one takes over. */
const isShubhoraBrandArt = (url: string | undefined) => /\/art\/brand\/shubhora-/i.test(url ?? "");

/** Owner-approved chat answers ("Q: …\nA: …", appended by /api/poster/learn) found in `old`
 *  but not in `next`, so a rebuild never throws away what the owner taught the bot. */
function taughtAnswers(old: string | undefined, next: string | undefined): string[] {
  if (!old) return [];
  return old
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => /^Q: [^\n]+\nA: /.test(p) && !(next ?? "").includes(p));
}

/** The website's home settings after a rebuild: the new build's section order (else the owner's, unless it came
 *  from a reference look that is gone), always the sections the owner hid and the trust facts they typed. */
type HomeSettings = NonNullable<NonNullable<Card["site"]>["home"]>;
function mergeHome(cur: HomeSettings | undefined, built: HomeSettings | undefined, dropOrder: boolean): HomeSettings | undefined {
  const order = built?.order ?? (dropOrder ? undefined : cur?.order);
  const out = { ...(cur ?? {}), ...(built ?? {}), ...(order ? { order } : {}), ...(cur?.hidden ? { hidden: cur.hidden } : {}), ...(cur?.stats ? { stats: cur.stats } : {}) };
  if (!order) delete (out as { order?: unknown }).order;
  return Object.keys(out).length ? out : undefined;
}

/**
 * The card to publish after a rebuild. With no live card it is the built card as a new free card
 * with website mode on. Otherwise the new words, pages and photos go INTO the live card, and
 * everything the owner set up keeps its value: link, plan, views, verified badge, domain, lock,
 * popup, pixels/analytics IDs, bot persona, chosen look, own cover, extra links, custom SEO
 * text and website settings.
 */
export function mergeBuiltCard(existing: Card | null, built: TemplateCard, opts: { id: string; username: string; today?: string }): Card {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (!existing) {
    return {
      ...built,
      id: opts.id,
      username: opts.username,
      plan: "free",
      active: true,
      views: 0,
      createdAt: today,
      site: { ...(built.site ?? {}), enabled: true },
    };
  }

  const ownLook = !!existing.site?.templateKey;
  const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
  const sameBusiness = !norm(built.company) || !norm(existing.company) || norm(built.company) === norm(existing.company);
  // Does an existing search title even mention this business? Its first real word is enough ("Wellwa" in
  // "Wellwa Life India Private Limited"). A title that names some other business is stale however it got there.
  const firstWord = norm(built.company).split(/\s+/).find((w) => w.length >= 3) ?? "";
  const titleFits = (t: string | undefined) => !t || !firstWord || norm(t).includes(firstWord);
  // Written from the business's own website: that site is the truth, so nothing stale of the old card's title,
  // website / email links or brand art may ride along (seen live: a seller card rebuilt from haldirams.com kept
  // the Shubhora feather in the footer, abc@gmail.com and https://shubhora.com as the business's own links).
  const fromSite = built.builtFrom === "own-site";
  const keepSeo = sameBusiness && titleFits(existing.seoTitle) && !fromSite;
  // A card that is Shubhora's own seller card keeps its brand art; any other business sheds it here.
  const sheds = existing.kb !== "shubhora" || fromSite;
  const keptAvatar = sheds && isShubhoraBrandArt(existing.avatarUrl) ? undefined : existing.avatarUrl;
  const keptCover = sheds && isShubhoraBrandArt(existing.coverUrl) ? undefined : existing.coverUrl;
  const ownCover = !!keptCover && !isOurArt(keptCover) && !(built.coverUrl ?? "").startsWith("http");
  const builtTypes = new Set(built.links.map((l) => l.type));
  // Link types the build owns outright when the site is the truth; and our own address is never anyone's website.
  const keepLink = (l: Card["links"][number]) =>
    !!(l.value ?? "").trim() && !builtTypes.has(l.type)
    && !(fromSite && (l.type === "website" || l.type === "email"))
    && !(l.type === "website" && isShubhoraHost(l.value));
  const taught = taughtAnswers(existing.botKnowledge, built.botKnowledge);
  const knowledge = built.botKnowledge ?? existing.botKnowledge;

  return {
    ...existing,
    name: built.name,
    jobTitle: built.jobTitle,
    company: built.company,
    tagline: built.tagline,
    about: built.about,
    pages: built.pages,
    lead: built.lead,
    gstin: built.gstin,
    language: built.language,
    botKnowledge: taught.length ? [knowledge, ...taught].filter(Boolean).join("\n\n") : knowledge,
    avatarUrl: built.avatarUrl ?? keptAvatar,
    avatarShape: built.avatarUrl ? built.avatarShape : keptAvatar ? existing.avatarShape : undefined,
    coverUrl: ownCover ? keptCover : (built.coverUrl ?? keptCover),
    themeColor: ownLook ? existing.themeColor : built.themeColor,
    avatarColor: ownLook ? existing.avatarColor : built.avatarColor,
    template: ownLook ? existing.template : built.template,
    links: [...built.links, ...(existing.links ?? []).filter(keepLink)],
    seo: { ...existing.seo, ...definedOnly(built.seo) },
    // The owner's own search title and description survive a rebuild — unless the business itself changed
    // (a different company name), when the old ones describe something that is no longer on the card.
    // Seen live: a card rebuilt from wellwalife.com still titled "Shubh Mobile Point | Mobile Shop" in
    // the browser tab and in Google.
    seoTitle: (keepSeo ? existing.seoTitle : "") || built.seoTitle,
    seoDescription: (keepSeo ? existing.seoDescription : "") || built.seoDescription,
    site: {
      ...existing.site,
      ...definedOnly(built.site),
      enabled: true,
      hidden: existing.site?.hidden ?? [],
      templateKey: existing.site?.templateKey,
      hideProfile: existing.site?.hideProfile,
      // Same rule as the avatar: Shubhora's own brand art never stands in for a customer's logo. The site
      // header reads this slot first, which is how a card rebuilt from wellwalife.com still wore the feather.
      logoUrl: built.site?.logoUrl ?? (sheds && isShubhoraBrandArt(existing.site?.logoUrl) ? undefined : existing.site?.logoUrl),
      hero: built.site?.hero ?? existing.site?.hero,
      generatedAt: existing.site?.generatedAt,
      // A look measured from a reference site in an earlier build (and the section order that came with it)
      // belongs to that build: a rebuild without a reference starts clean. A style the owner picked by hand
      // (no `reference` on record) stays, and so do the sections they hid and the trust facts they typed.
      ...(existing.site?.reference && !built.site?.reference ? { style: built.site?.style, reference: undefined } : {}),
      // The trade's default look (no reference) never overrides a look the owner picked by hand.
      ...(!built.site?.reference && existing.site?.style && !existing.site?.reference ? { style: existing.site.style } : {}),
      home: mergeHome(existing.site?.home, built.site?.home, !!existing.site?.reference && !built.site?.reference),
    },
    id: opts.id,
    username: opts.username,
    plan: existing.plan,
    active: true,
    views: existing.views,
    createdAt: existing.createdAt,
  };
}

/* ================= this phone's copies of the V-Card form ================= */

/** localStorage keys of the "Make your V-Card" screen: a finished preview, and the form's unsaved answers.
 *  Shared so the set-up can drop them when it changes the website or its role — otherwise the build screen
 *  would show the OLD preview again, or let a stale backup overwrite the new website. */
export const vcardDraftKey = (uid: string) => `vcard-draft:${uid}`;
export const vcardFormKey = (uid: string) => `vcard-form:${uid}`;

/* ================= API contract (/api/card/facts, /api/card/build) ================= */

/** What the owner filled in during setup (auth metadata + poster profile). */
export type SetupInfo = {
  kind: "business" | "person";
  /** business = shop/company by its name; professional / agent = the person, with a firm or brand; personal = no products. */
  role: "business" | "professional" | "agent" | "personal";
  /** local = own city & nearby; india = serves all of India from the city; online = anywhere, online / worldwide. */
  reach: "local" | "india" | "online";
  business: string;
  person: string;
  category: string;
  categoryLabel: string;
  persona: string;
  city: string;
  address: string;
  website: string;
  gstin: string;
  about: string;
  map: string;
  logo: string;
  photo: string;
  phone: string;
  email: string;
  /** Set-up with an OWN website (1 Oct 2026): true when the business name on the form is the one the website
   *  gave, false when the owner corrected it after seeing the site's name — then the build keeps the owner's
   *  name instead of the site's. Undefined when the website was never peeked at. */
  nameFromSite?: boolean;
  /** Same idea for the trade and the about text: true = the website gave it (so a rebuild may follow the site
   *  again), false = the owner set it by hand after seeing the site's (never overridden). */
  categoryFromSite?: boolean;
  aboutFromSite?: boolean;
};

/** A product row saved on the Products page (poster_products). */
export type SavedProduct = {
  id: string;
  name: string;
  brand: string;
  price: string;
  mrp: string;
  photo: string;
  images: string[];
  offer: string;
  benefits: string[];
  /** The owner's own grouping ("Starters", "Sarees", "Class 6–8") — the catalogue page is split by it. */
  category?: string;
};

/** GET /api/card/facts */
export type FactsResponse = {
  facts: CardFacts;
  setup: SetupInfo;
  products: SavedProduct[];
  brandProducts: boolean;
  reviews: number;
};

/** One product row on the "Make your V-Card" form. */
export type BuildRow = { id?: string; name: string; brand: string; price: string; photo: string; studio?: boolean };

/** POST /api/card/build */
/** What "Write again" may change, each one credit (owner's call, 4 Oct 2026: "jitna kaam utne credit"): the look
 *  (colours, type), the layout (hero, order), the banner (hero image), the photos (gallery set), the words. "pictures"
 *  is the older name for banner + photos. */
export type WriteAgainWant = "look" | "layout" | "banner" | "photos" | "words" | "pictures";
export const WRITE_AGAIN_PRICE: Record<Exclude<WriteAgainWant, "pictures">, number> = { look: 1, layout: 1, banner: 1, photos: 1, words: 1 };
/** Credits for a Write again: one per thing asked, at least one (a note alone is a request too). */
export function writeAgainCredits(wants: WriteAgainWant[], note?: string): number {
  const set = new Set<Exclude<WriteAgainWant, "pictures">>();
  for (const w of wants) { if (w === "pictures") { set.add("banner"); set.add("photos"); } else set.add(w); }
  let n = 0; for (const w of set) n += WRITE_AGAIN_PRICE[w];
  return Math.max(1, n || (note?.trim() ? 1 : 0));
}

export type BuildRequest = {
  facts: Partial<CardFacts>; products: BuildRow[];
  /** The website (or whose it is) is new to this account since the last build — the build then lets the site's
   *  own words replace the form's older notes rather than blend the two. */
  siteChanged?: boolean;
  /** "Write again" (owner's call, 4 Oct 2026): the owner saw this look and wants a DIFFERENT one. The previous
   *  look comes along so the designer avoids it; `round` counts the tries, so each one differs from the last. */
  fresh?: {
    style?: SiteStyle; round?: number;
    /** What the owner asked to change (owner's call, 4 Oct 2026: "poochhe kya change karna hai"): the look (colours,
     *  type), the layout (hero, order), the pictures, the words. Unset = look and layout, as before. */
    wants?: WriteAgainWant[];
    /** Their own words about it — "bigger photo", "shorter headline". */
    note?: string;
  };
  /** The card as it is now: with `refresh`, its words and pages are kept and only the rest changes. */
  refresh?: boolean;
  current?: Record<string, unknown>;
};

/** Maker details found on the web for one product, shown under "Please check" before publishing. */
export type WebCheck = {
  name: string;
  web: { summary: string; features: string[]; specs: SpecRow[] };
  plain: { desc?: string; features: string[] };
};

export type MissingKey = "products" | "prices" | "productPhotos" | "banner" | "hours" | "upi" | "map" | "reviews" | "qualification" | "ownPhotos";

/** A "Make it better" chip: something that would improve the card. */
export type Missing = { key: MissingKey; label: string };

export type BuildResponse = {
  ok: true; card: TemplateCard; checks: WebCheck[]; missing: Missing[];
  /** The website was opened and had something to read. */
  siteRead?: boolean;
  /** What the website actually gave us. A site built in JavaScript opens fine and yields nothing — the page
   *  is empty until a browser runs its scripts — and saying "we could not open it" would be wrong. This
   *  lets the builder tell the owner what really happened. */
  siteFound?: { products: number; photos: number };
  /** Pictures made by AI for a card built from a reference website, so the owner can be told they are
   *  stand-ins and replace them with their own. */
  aiPhotos?: number;
  /** The designer's look at the drawn page (design-review.ts): its mark out of 10, what it saw, and how many fixes
   *  it applied. Absent when the review did not run (no browser on the box, or the model was slow). */
  designReview?: { score: number; notes: string[]; fixed: string[] };
  /** The designer AI's plan for this build (site-designer.ts): the look it chose and its one-line reason, so the
   *  owner can see the site was designed for them, and so a build with no plan (AI off or slow) is visible. */
  design?: { style: SiteStyle; order?: string[]; why: string };
  /** The text manager's report (card-text.ts): what it filled from the trade or had written, and what is still
   *  thinner than a finished website wants — so the owner can be told where their own words would help most. */
  text?: { filled: string[]; thin: string[] };
  /** What the build had to stand in for (card-audit.ts): stock photos of the trade, the trade's typical services /
   *  steps / questions instead of this business's own — so the owner is told what to replace. */
  standIns?: ("stock-photos" | "typical-services" | "typical-steps" | "typical-faq" | "typical-why-us")[];
};
