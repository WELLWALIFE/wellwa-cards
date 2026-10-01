// Lays out a professional V-Card from what the owner told us. The AI only supplies the wording (CardCopy);
// every fact on the card — prices, photos, timings, trust tiles, links, which blocks exist — is placed here by
// code, so nothing the owner did not give can appear.
//
// Pure on purpose: no fetch, no env, no 'server-only'. The type imports below are erased at build time.
import type { CardBlock, CardImage, CardLink, CardPage, ProductItem, TestimonialItem } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import { styleFromReference, styleFromLook, homeOrderFromLook, type ReferenceStyle, type MeasuredLook } from "@/lib/site-style";
import type { CardCopy } from "@/lib/card-ai";
import type { ProductInfo } from "@/lib/product-lookup";
import { categoryOf } from "@/lib/poster-categories";
import {
  BOOKING_CATEGORIES, coverArtFor, readableTheme,
  type CardFacts, type Lang, type Missing, type MissingKey, type SavedProduct, type SetupInfo, type WebCheck,
} from "@/lib/card-facts";

/* ================= section titles ================= */

/** Every section title, tab label and button the AI writes in the card's language. */
export const TITLE_KEYS = [
  "home", "highlights", "products", "productsPage", "services", "servicesPage", "about", "photos", "reviews",
  "offer", "booking", "contact", "contactPage", "faq", "hours", "location", "seeAll", "seeAllServices",
  "promise", "steps", "more",
] as const;
export type TitleKey = (typeof TITLE_KEYS)[number];
export type Titles = Record<TitleKey | "cta", string>;

type Tri = { en: string; hinglish: string; hi: string };
const tri = (en: string, hinglish: string, hi: string): Tri => ({ en, hinglish, hi });

const TABLE: Record<TitleKey | "cta", Tri> = {
  home: tri("Home", "Home", "होम"),
  highlights: tri("Why customers choose us", "Customers humein kyun chunte hain", "ग्राहक हमें क्यों चुनते हैं"),
  products: tri("Our products", "Hamare products", "हमारे प्रोडक्ट"),
  productsPage: tri("Products", "Products", "प्रोडक्ट"),
  services: tri("Our services", "Hamari services", "हमारी सेवाएँ"),
  servicesPage: tri("Services", "Services", "सेवाएँ"),
  about: tri("About us", "Hamare baare mein", "हमारे बारे में"),
  photos: tri("Photos", "Photos", "फ़ोटो"),
  reviews: tri("What customers say", "Customers kya kehte hain", "ग्राहक क्या कहते हैं"),
  offer: tri("Current offer", "Abhi ka offer", "अभी का ऑफ़र"),
  booking: tri("Book an appointment", "Appointment book karein", "अपॉइंटमेंट बुक करें"),
  contact: tri("Send us a message", "Humein message karein", "हमें संदेश भेजें"),
  contactPage: tri("Contact", "Contact", "संपर्क"),
  faq: tri("Common questions", "Aksar puchhe sawal", "अक्सर पूछे जाने वाले सवाल"),
  hours: tri("Timings", "Timings", "समय"),
  location: tri("Find us", "Hum yahan hain", "हमारा पता"),
  seeAll: tri("See all products & prices", "Saare products aur daam dekhein", "सभी प्रोडक्ट और दाम देखें"),
  seeAllServices: tri("See all services", "Saari services dekhein", "सभी सेवाएँ देखें"),
  cta: tri("Order on WhatsApp", "WhatsApp par order karein", "WhatsApp पर ऑर्डर करें"),
  promise: tri("Our promise", "Hamara vaada", "हमारा वादा"),
  steps: tri("How it works", "Kaise kaam hota hai", "कैसे काम होता है"),
  more: tri("What we do for you", "Hum aapke liye kya karte hain", "हम आपके लिए क्या करते हैं"),
};
const BOOK_CTA: Tri = tri("Book on WhatsApp", "WhatsApp par book karein", "WhatsApp पर बुक करें");

const pickLang = (lang: Lang): Lang => (lang === "hi" || lang === "hinglish" ? lang : "en");

/** The fixed titles for one language (the fallback when the AI leaves a title out). */
export function fallbackTitles(lang: Lang, booking = false): Titles {
  const l = pickLang(lang);
  const out = {} as Titles;
  for (const k of Object.keys(TABLE) as (TitleKey | "cta")[]) out[k] = TABLE[k][l];
  if (booking) out.cta = BOOK_CTA[l];
  return out;
}

/** The fallback titles with every non-empty AI title of at most 40 characters on top. */
export function titlesFor(lang: Lang, ai: Partial<Record<TitleKey, string>> | undefined, booking = false): Titles {
  const out = fallbackTitles(lang, booking);
  for (const k of TITLE_KEYS) {
    const v = typeof ai?.[k] === "string" ? ai[k]!.replace(/\s+/g, " ").trim() : "";
    if (v && v.length <= 40) out[k] = v;
  }
  return out;
}

/* ================= small text helpers ================= */

const uid = () => Math.random().toString(36).slice(2, 10);

/** The text of a chip without its emoji: "💵 Cash" → "Cash". */
export function plain(s: string): string {
  return (s ?? "").replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu, "").replace(/\s+/g, " ").trim();
}

/** "900/kg" → "₹900/kg"; "₹900" stays; "" → "". */
export function rupee(v: string): string {
  const s = (v ?? "").trim();
  return !s ? "" : s.startsWith("₹") ? s : `₹${s}`;
}

/** The first number in a price ("1,200/kg" → 1200), or NaN. */
function amount(v: string): number {
  const m = /\d[\d,]*(?:\.\d+)?/.exec(v ?? "");
  return m ? Number(m[0].replace(/,/g, "")) : NaN;
}

/** "Kent" + "Grand Plus" → "Kent Grand Plus"; the brand is not repeated when the name already has it. */
export function productName(p: Pick<SavedProduct, "name" | "brand">): string {
  const name = (p.name ?? "").trim(), brand = (p.brand ?? "").trim();
  return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
}

const infoKey = (p: Pick<SavedProduct, "name" | "brand">) => `${p.brand}|${p.name}`.toLowerCase();

/** An http(s) website address, or "sharmasweets.com" made into https://sharmasweets.com. */
export function webUrl(v: string): string {
  const s = (v ?? "").trim().slice(0, 300);
  if (!s || /\s/.test(s)) return "";
  return /^https?:\/\/\S+\.\S+/i.test(s) ? s : /^[\w.-]+\.\w{2,}/.test(s) ? `https://${s}` : "";
}

/** An Instagram / Facebook / YouTube link, or a bare handle ("@sharmasweets") made into one. */
function socialUrl(kind: "instagram" | "facebook" | "youtube", v: string): string {
  const s = (v ?? "").trim().slice(0, 300);
  if (!s || /\s/.test(s)) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(www\.|m\.)?(instagram\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be)\//i.test(s)) return `https://${s}`;
  const h = s.replace(/^@/, "");
  if (!/^[\w.-]{2,60}$/.test(h)) return "";
  return kind === "instagram" ? `https://instagram.com/${h}` : kind === "facebook" ? `https://facebook.com/${h}` : `https://youtube.com/@${h}`;
}

/** The owner's Google Maps link (an exact pin), http(s) only. */
export function mapLink(v: string): string {
  const s = (v ?? "").trim().slice(0, 300);
  if (!s || /\s/.test(s)) return "";
  if (/^https?:\/\/\S+$/i.test(s)) return s;
  return /^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|(www\.)?google\.[a-z.]+\/maps)/i.test(s) ? `https://${s}` : "";
}

/* ================= the facts text the AI (and the chat bot) reads ================= */

/** One line per thing the owner told us, for the AI brief and the card's chat bot. */
export function factsText(i: {
  setup: SetupInfo;
  facts: CardFacts;
  products: SavedProduct[];
  info: Map<string, ProductInfo>;
  site: { url: string; text: string; dealer?: boolean } | null;
}): string {
  const { setup, facts, products, info, site } = i;
  const special = [...facts.special.map(plain), facts.specialText].filter(Boolean);
  const pays = facts.payments.map(plain).filter(Boolean);
  if (facts.upi && !pays.some((p) => /upi/i.test(p))) pays.push("UPI");
  const productLine = products.map((p) => {
    const web = p.brand ? info.get(infoKey(p)) : undefined;
    const feats = p.benefits.length ? p.benefits : web?.features ?? [];
    return [productName(p), p.price && rupee(p.price), p.offer && `offer: ${p.offer}`, web?.summary, feats.length && `(${feats.slice(0, 3).join("; ")})`]
      .filter(Boolean).join(" — ");
  }).join(" | ");
  const lines = [
    setup.about && `About (owner's words): ${setup.about}`,
    facts.work && `What we do (owner's words): ${facts.work}`,
    facts.customers.length && `Our customers: ${facts.customers.map(plain).filter(Boolean).join(", ")}`,
    special.length && `What makes us special (owner's words): ${special.join(", ")}`,
    facts.homeService === "yes" && "We offer home delivery / home visits",
    pays.length && `Payment accepted: ${pays.join(", ")}${facts.upi ? ` (UPI ID: ${facts.upi})` : ""}`,
    facts.qualification && `Qualification (exactly as typed): ${facts.qualification}`,
    setup.gstin && "GST registered",
    productLine && `Products: ${productLine}`,
    facts.hours && `Timings: ${facts.hours}`,
    facts.since && `In business since ${facts.since}`,
    facts.offer && `Current offer: ${facts.offer}`,
    facts.areas && `Areas served: ${facts.areas}`,
    setup.reach === "india" ? `Service area: all over India${setup.city ? ` (based in ${setup.city}; customers anywhere in India — say so in the about, e.g. delivery / courier / consult on call)` : ""}`
      : setup.reach === "online" ? `Service area: online, worldwide${setup.city ? ` (based in ${setup.city}; customers can be anywhere — say so in the about: online / video call / remote)` : ""}`
      : setup.city ? `Service area: ${setup.city} and nearby (a local business — write for local customers)` : "",
    setup.address && `Address: ${[setup.address, setup.city].filter(Boolean).join(", ")}`,
    site?.text && (site.dealer
      ? `From the website of the BRAND we sell as a dealer / distributor (${site.url}) — product facts only; this is NOT our own business, so never present its history, factory, awards or contact details as ours:\n${site.text}`
      : `From the owner's own website (${site.url}):\n${site.text}`),
  ].filter(Boolean) as string[];
  if (lines.length) return lines.join("\n");
  const who = setup.business || setup.person;
  return `${who}, ${setup.categoryLabel || "Business"}${setup.city ? ` in ${setup.city}` : ""}.`;
}

/* ================= the composer ================= */

export type ComposeReview = { name: string; city: string; text: string; rating: number };

export type ComposeInput = {
  setup: SetupInfo;
  facts: CardFacts;
  /** In card order (the rows the owner typed first), at most 12. */
  products: SavedProduct[];
  brandProducts: boolean;
  /** Approved reviews, newest first (at most 12 are used). */
  reviews: ComposeReview[];
  /** Count and average of ALL approved reviews; worked out from `reviews` when left out. */
  reviewStats?: { count: number; avg: number };
  copy: CardCopy;
  info: Map<string, ProductInfo>;
  /** The address of the owner's website when we could read it (after redirects). */
  siteUrl: string | null;
  /** Category keys that have a designed banner in public/art/banners (the route reads the folder). */
  bannerKeys?: Set<string>;
  /** The facts text (see factsText) kept as the chat bot's knowledge. Pass the variant built WITHOUT the
   *  maker's web text (factsText with an empty `info`), so the bot only ever answers in the owner's words. */
  details?: string;
  /** A website the owner likes: its look becomes the website's design (site.style); nothing else of it is used. */
  reference?: { url: string; style?: ReferenceStyle; look?: MeasuredLook } | null;
};

const MISSING_LABEL: Record<MissingKey, string> = {
  products: "🛍️ Add your products",
  prices: "₹ Add prices",
  productPhotos: "📷 Add product photos",
  banner: "🏪 Add a photo of your shop",
  hours: "🕘 Add your timings",
  upi: "💳 Add your UPI ID",
  map: "📍 Pin your shop on the map",
  reviews: "⭐ Ask 3 customers for a review",
  qualification: "🎓 Add your degree or registration",
};

export function composeCard(input: ComposeInput): { card: TemplateCard; checks: WebCheck[]; missing: Missing[] } {
  const { setup, facts, copy, info } = input;
  const lang = pickLang(facts.lang);
  const cat = categoryOf(setup.category);
  const booking = BOOKING_CATEGORIES.has(setup.category);
  const t = titlesFor(lang, copy.titles, booking);
  const ctaLabel = copy.cta || t.cta;

  /* ---- header ---- */
  const accent = cat?.accent ?? "#0e9e90";
  const theme = readableTheme(accent);
  const role = setup.role ?? (setup.kind === "business" ? "business" : "professional");
  const professional = role === "professional" || (cat?.persona ?? setup.persona) === "professional";
  // The role decides who leads: a shop/company by its name; a professional, an agent or a personal card by the person.
  const lead: "business" | "person" = role === "business" && !!setup.business ? "business" : "person";
  const personal = role === "personal";
  const name = setup.person || setup.business;
  const company = setup.business && setup.business !== name ? setup.business : "";
  const jobTitle = professional ? (facts.qualification || cat?.en || copy.jobTitle || "Business") : (copy.jobTitle || cat?.en || "Business");
  let avatarUrl: string | undefined, avatarShape: "circle" | "square" | undefined;
  if (lead === "business") {
    if (setup.logo) { avatarUrl = setup.logo; avatarShape = "square"; } else if (setup.photo) { avatarUrl = setup.photo; avatarShape = "circle"; }
  } else if (setup.photo) { avatarUrl = setup.photo; avatarShape = "circle"; } else if (setup.logo) { avatarUrl = setup.logo; avatarShape = "square"; }

  /* ---- links ---- */
  const links: CardLink[] = [];
  const add = (type: CardLink["type"], label: string, value: string) => { if (value) links.push({ id: uid(), type, label, value }); };
  const digits = (setup.phone ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length === 10) { add("whatsapp", "WhatsApp", `+91${digits}`); add("phone", "Call", `+91${digits}`); }
  add("email", "Email", (setup.email ?? "").trim());
  // A reference website is somebody else's site, and a dealer's brand site is the brand's: neither is ever the
  // owner's "Website" link. Only a site the owner called their OWN (or the set-up's business.website) is.
  const ownSite = facts.websiteRole === "own" ? facts.website || setup.website : setup.website;
  add("website", "Website", webUrl(ownSite) || (facts.websiteRole === "own" ? input.siteUrl ?? "" : ""));
  const mapUrl = mapLink(facts.social.google) || mapLink(setup.map);
  add("location", "Google Maps", mapUrl);
  add("upi", "UPI", facts.upi);
  add("instagram", "Instagram", socialUrl("instagram", facts.social.instagram));
  add("facebook", "Facebook", socialUrl("facebook", facts.social.facebook));
  add("youtube", "YouTube", socialUrl("youtube", facts.social.youtube));

  /* ---- products ---- */
  const checks: WebCheck[] = [];
  const productLineFor = (display: string, raw: string): string => {
    const lines = copy.productLines ?? {};
    const want = [display, raw].map((x) => x.toLowerCase());
    for (const [k, v] of Object.entries(lines)) if (v && want.includes(k.trim().toLowerCase())) return v;
    return "";
  };
  const items: ProductItem[] = (personal ? [] : input.products.slice(0, 12)).map((p) => {
    const display = productName(p);
    const web = p.brand ? info.get(infoKey(p)) : undefined;
    const line = productLineFor(display, p.name);
    const images = p.images.filter(Boolean).slice(0, 3);
    const price = rupee(p.price);
    const mrp = p.mrp && p.price && amount(p.mrp) > amount(p.price) ? rupee(p.mrp) : "";
    const ownFeatures = p.benefits.filter(Boolean);
    const features = (ownFeatures.length ? ownFeatures : web?.features ?? []).slice(0, 5);
    const specs = (web?.specs ?? []).slice(0, 6);
    // The one-line description must not just repeat the price (the AI sometimes writes "₹900 per kg" as the line).
    const bare = (x: string) => x.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const isPrice = (x: string) => !!x && (bare(x) === bare(price) || bare(x) === bare(p.price) || (!!price && bare(price).includes(bare(x))));
    const desc = line && !isPrice(line) ? line : web?.summary && !isPrice(web.summary) ? web.summary : "";
    // Anything the lookup found about this product went into the brief the AI wrote from, so its line may
    // repeat a maker's claim even when nothing is printed word for word. The owner is therefore asked to check
    // EVERY product we looked up, and unticking one leaves only what they typed themselves.
    if (web && (web.summary || web.features.length || web.specs.length)) {
      checks.push({ name: display, web: { summary: web.summary, features: web.features.slice(0, 5), specs }, plain: { features: ownFeatures.slice(0, 5) } });
    }
    return {
      name: display,
      ...(images.length ? { imageUrl: images[0], images } : {}),
      ...(price ? { price } : {}),
      ...(mrp ? { mrp } : {}),
      ...(p.offer ? { badge: p.offer.slice(0, 20) } : {}),
      ...(desc ? { desc } : {}),
      features,
      specs,
      ctaLabel,
    };
  });

  // Services only when the owner described their work in words (never guessed from a category), and never a
  // repeat of a product name.
  const productNames = new Set(items.map((i) => i.name.toLowerCase()).concat(input.products.map((p) => p.name.toLowerCase())));
  // Services page when there are no products: the owner's own list, or the usual services of the trade (the AI
  // writes them in general words and the owner deletes any that do not apply). A card with nothing to browse
  // reads as unfinished, which is what owners complained about.
  const services = !items.length && !personal
    ? (copy.services ?? []).filter((s) => s.name && !productNames.has(s.name.toLowerCase())).slice(0, 6)
    : [];

  /* ---- trust strip (code only, never AI) ---- */
  const trust: string[] = [];
  if (facts.since) trust.push(lang === "hi" ? `📅 ${facts.since} से` : lang === "hinglish" ? `📅 ${facts.since} se` : `📅 Since ${facts.since}`);
  if (setup.gstin) trust.push(lang === "hi" ? "🧾 GST पंजीकृत" : "🧾 GST registered");
  if (facts.homeService === "yes") {
    const delivery = cat?.group === "Retail" || cat?.group === "Food";
    trust.push(delivery ? (lang === "hi" ? "🚚 होम डिलीवरी" : "🚚 Home delivery") : (lang === "hi" ? "🏠 घर पर सेवा" : "🏠 Home service"));
  }
  const areas = facts.areas.split(",").map((x) => x.trim()).filter(Boolean);
  if (setup.reach === "india") trust.push(lang === "hi" ? "🇮🇳 पूरे भारत में सेवा" : lang === "hinglish" ? "🇮🇳 Poore India mein seva" : "🇮🇳 Serving all India");
  else if (setup.reach === "online") trust.push(lang === "hi" ? "🌐 ऑनलाइन · कहीं से भी" : lang === "hinglish" ? "🌐 Online · kahin se bhi" : "🌐 Online · worldwide");
  else if (areas.length) {
    const more = areas.length > 1 ? ` +${areas.length - 1}` : "";
    trust.push(lang === "hi" ? `📍 ${areas[0]}${more} में सेवा` : lang === "hinglish" ? `📍 ${areas[0]}${more} mein seva` : `📍 Serving ${areas[0]}${more}`);
  } else if (setup.city) trust.push(lang === "hi" ? `📍 ${setup.city} और आस-पास` : lang === "hinglish" ? `📍 ${setup.city} aur aas-paas` : `📍 ${setup.city} & nearby`);
  const pays = facts.payments.map(plain).filter(Boolean);
  if (facts.upi && !pays.some((p) => /upi/i.test(p))) pays.push("UPI");
  if (pays.length) trust.push(`💳 ${pays.join(" · ")}`);
  const reviewList = input.reviews.filter((r) => r.text?.trim());
  const stats = input.reviewStats ?? {
    count: input.reviews.length,
    avg: input.reviews.length ? input.reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / input.reviews.length : 0,
  };
  if (stats.count >= 3 && stats.avg > 0) trust.push(`⭐ ${stats.avg.toFixed(1)} · ${stats.count} ${lang === "hi" ? "समीक्षाएँ" : "reviews"}`);
  for (const s of facts.special) if (s.trim()) trust.push(s.trim());
  if (facts.specialText && facts.specialText.length <= 40 && !facts.specialText.includes("\n")) trust.push(`✨ ${facts.specialText}`);
  const trustItems = [...new Set(trust)].slice(0, 6);

  /* ---- pages ---- */
  const workPhotos = facts.photos.filter(Boolean).slice(0, 5);
  const productPage: CardPage | null = items.length
    ? { id: uid(), slug: "products", label: t.productsPage, blocks: [{ id: uid(), kind: "product", title: t.products, items }] }
    : services.length
      ? { id: uid(), slug: "services", label: t.servicesPage, blocks: [{ id: uid(), kind: "services", title: t.services, items: services }] }
      : null;

  const home: CardBlock[] = [];
  if (trustItems.length >= 2) home.push({ id: uid(), kind: "highlights", title: t.highlights, items: trustItems });
  const shots: CardImage[] = items.filter((i) => i.imageUrl).slice(0, 6).map((i) => ({ url: i.imageUrl!, caption: i.name + (i.price ? ` — ${i.price}` : "") }));
  if (shots.length >= 2) home.push({ id: uid(), kind: "carousel", title: t.products, images: shots });
  else if (shots.length === 1) home.push({ id: uid(), kind: "image", title: t.products, images: shots });
  if (productPage) {
    const isProducts = productPage.slug === "products";
    home.push({ id: uid(), kind: "cta", title: "", body: "", joinUrl: isProducts ? "#products" : "#services", joinLabel: isProducts ? t.seeAll : t.seeAllServices, referralCode: "" });
  }
  const facePhoto = lead === "business" ? setup.photo || undefined : undefined;
  const aboutImage = workPhotos.length >= 3 ? facePhoto : workPhotos[0] ?? facePhoto;
  home.push({ id: uid(), kind: "about", title: t.about, body: copy.about, ...(aboutImage ? { imageUrl: aboutImage } : {}) });
  // "Our promise" (soft, no numbers) and "How it works": the parts that make a thin card feel finished. The trust
  // strip above stays the place for facts; these two never carry any.
  const promise = (copy.promise ?? []).filter((x) => x && !trustItems.includes(x)).slice(0, 6);
  if (promise.length >= 3 && !personal) home.push({ id: uid(), kind: "highlights", title: t.promise, items: promise.map((x) => (/^\p{Extended_Pictographic}/u.test(x) ? x : `✅ ${x}`)) });
  if ((copy.steps ?? []).length >= 3 && !personal) home.push({ id: uid(), kind: "services", title: t.steps, items: copy.steps.slice(0, 5).map((st, i) => ({ name: `${i + 1}. ${st.name}`, desc: st.desc })) });
  if (workPhotos.length === 2) home.push({ id: uid(), kind: "image", title: t.photos, images: [{ url: workPhotos[1] }] });
  if (reviewList.length) {
    const reviews: TestimonialItem[] = reviewList.slice(0, 6).map((r) => ({
      name: [r.name?.trim(), r.city?.trim()].filter(Boolean).join(", ") || (lang === "hi" ? "ग्राहक" : "Customer"),
      text: r.text.trim(),
      rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
    }));
    home.push({ id: uid(), kind: "testimonials", title: t.reviews, items: reviews });
  }
  const productOffer = input.products.find((p) => p.offer?.trim());
  const offerText = facts.offer || (productOffer ? `${productName(productOffer)}: ${productOffer.offer.trim()}` : "");
  if (offerText && !personal) home.push({ id: uid(), kind: "offer", title: t.offer, text: offerText, code: "", expires: "" });
  if (booking && !personal) home.push({ id: uid(), kind: "appointment", title: t.booking, url: "", note: facts.hours });

  const contact: CardBlock[] = [];
  if (facts.hours) {
    const rows = copy.hours.length ? copy.hours : facts.hours.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 7).map((day) => ({ day, time: "" }));
    contact.push({ id: uid(), kind: "hours", title: t.hours, rows });
  }
  const where = [setup.address, setup.city].filter(Boolean).join(", ");
  if (where || mapUrl) contact.push({ id: uid(), kind: "location", title: t.location, address: where, ...(mapUrl ? { mapUrl } : {}) });
  if (copy.more) contact.push({ id: uid(), kind: "about", title: t.more, body: copy.more });
  contact.push({ id: uid(), kind: "contact", title: t.contact, note: copy.contactNote });
  const faqPage: CardPage | null = copy.faq.length >= 3
    ? { id: uid(), slug: "faq", label: lang === "hi" ? "सवाल-जवाब" : "FAQ", blocks: [{ id: uid(), kind: "faq", title: t.faq, items: copy.faq.slice(0, 8) }] }
    : null;

  const pages: CardPage[] = [{ id: uid(), slug: "home", label: t.home, blocks: home }];
  if (productPage) pages.push(productPage);
  if (workPhotos.length >= 3) {
    pages.push({ id: uid(), slug: "gallery", label: t.photos, blocks: [{ id: uid(), kind: "gallery", title: t.photos, images: workPhotos.map((url) => ({ url, color: theme, label: "" })) }] });
  }
  if (faqPage) pages.push(faqPage);
  pages.push({ id: uid(), slug: "contact", label: t.contactPage, blocks: contact });

  /* ---- website, search, chat bot ---- */
  const firstImage = items.find((i) => i.imageUrl)?.imageUrl;
  const headline = lead === "business" ? setup.business : name;
  const seo: NonNullable<TemplateCard["seo"]> = {};
  if (cat?.en) seo.category = cat.en;
  if (setup.city) seo.city = setup.city;
  if (areas.length) seo.areas = areas.slice(0, 12);
  else if (setup.reach === "india") seo.areas = ["All India"];
  else if (setup.reach === "online") seo.areas = ["Online", "Worldwide"];
  const reachLine = setup.reach === "india" ? " Serves customers all over India." : setup.reach === "online" ? " Works online — customers anywhere in the world." : setup.city ? ` Serves ${setup.city} and nearby areas.` : "";
  const header = `${setup.business || name} — ${setup.categoryLabel || cat?.en || "Business"}${setup.city ? `, ${setup.city}` : ""}.${reachLine}`;

  const card: TemplateCard = {
    name,
    jobTitle,
    company,
    tagline: copy.tagline,
    about: copy.about,
    avatarColor: theme,
    themeColor: theme,
    ...(avatarUrl ? { avatarUrl, avatarShape } : {}),
    // The owner's own banner, else the designed banner of the trade (public/art/banners, see scripts/gen-banners.mjs),
    // else the tinted fallback art. `bannerKeys` is what exists on disk (the route reads the folder).
    coverUrl: facts.bannerUrl || (input.bannerKeys?.has(setup.category) ? `/api/stock/banners/${setup.category}.jpg` : coverArtFor(accent)),
    template: lead === "business" ? "bold" : "gradient",
    verified: false,
    lead,
    ...(setup.gstin ? { gstin: setup.gstin } : {}),
    links,
    pages,
    language: lang,
    seo,
    ...(copy.seoTitle ? { seoTitle: copy.seoTitle } : {}),
    ...(copy.seoDescription ? { seoDescription: copy.seoDescription } : {}),
    botKnowledge: `${header}\n${input.details ?? ""}`.trim().slice(0, 3000),
    site: {
      enabled: true,
      ...(setup.logo ? { logoUrl: setup.logo } : {}),
      hero: {
        headline,
        sub: copy.hero?.sub || copy.tagline,
        ...(firstImage || setup.logo ? { imageUrl: firstImage || setup.logo } : {}),
        ctaLabel,
      },
      // "Make it like this website": its colours, fonts, rounding, hero and the order it puts things in —
      // never its words, pictures or facts. What the browser measured wins over what the HTML hinted at;
      // the old guess is the fallback for a page no browser could open.
      ...(input.reference?.look || input.reference?.style
        ? {
            style: input.reference.look ? styleFromLook(input.reference.look) : styleFromReference(input.reference.style!),
            ...(input.reference.look && homeOrderFromLook(input.reference.look)
              ? { home: { order: homeOrderFromLook(input.reference.look)! } }
              : {}),
            reference: { url: input.reference.url, at: new Date().toISOString() },
          }
        : {}),
    },
  };

  /* ---- "Make it better" ---- */
  const want: MissingKey[] = [];
  if (!input.products.length) want.push("products");
  else if (!input.brandProducts) {
    // (A brand member's products, prices and photos come from the brand, so they are not asked for.)
    if (!input.products.some((p) => p.price.trim())) want.push("prices");
    if (!input.products.some((p) => p.images.length || p.photo)) want.push("productPhotos");
  }
  if (!facts.bannerUrl) want.push("banner");
  if (!facts.hours) want.push("hours");
  if (!facts.upi) want.push("upi");
  if (!mapUrl) want.push("map");
  if (stats.count < 3) want.push("reviews");
  if (setup.persona === "professional" && !facts.qualification) want.push("qualification");
  // At most 6, in this order — but a professional's degree chip is never the one cut off.
  const shown = want.length > 6 && want.includes("qualification") ? [...want.slice(0, 5), "qualification" as const] : want.slice(0, 6);
  const missing: Missing[] = shown.map((key) => ({ key, label: MISSING_LABEL[key] }));

  return { card, checks, missing };
}

/* ================= refresh: fill an existing card's empty parts ================= */

const wordCount = (s: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The owner's card with the fresh build's NEW parts added — never a word of theirs replaced.
 *  Adds: the longer about (only when theirs is under 60 words), the promise / how-it-works / "what we do" / FAQ
 *  sections, a services page when there is nothing to browse, the designed banner when theirs is stock art. */
export function mergeRefresh(current: TemplateCard & { id?: string; username?: string }, fresh: TemplateCard): TemplateCard & { id?: string; username?: string } {
  const out = { ...current, pages: current.pages.map((p) => ({ ...p, blocks: [...p.blocks] })) };
  const freshHome = fresh.pages.find((p) => p.slug === "home");
  const home = out.pages.find((p) => p.slug === "home") ?? out.pages[0];
  if (!home || !freshHome) return out;
  // A hidden page (the Shubhora page on a "both" card) belongs to a different audience, not to the owner's
  // own card. Its blocks must not make this think their business already has products or an FAQ — otherwise
  // their own products and FAQ pages would never be added.
  const allBlocks = () => out.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);
  const hasTitled = (kind: CardBlock["kind"], title: string) => allBlocks().some((b) => b.kind === kind && norm(b.title) === norm(title));
  const freshTitle = (kind: CardBlock["kind"], i: number) => freshHome.blocks.filter((b) => b.kind === kind)[i];

  // 1. about: a one-liner grows into the written version; a real paragraph of theirs stays.
  const aboutIdx = home.blocks.findIndex((b) => b.kind === "about");
  const freshAbout = freshHome.blocks.find((b) => b.kind === "about");
  if (freshAbout && freshAbout.kind === "about") {
    if (aboutIdx < 0) home.blocks.push({ ...freshAbout, id: uid() });
    else {
      const cur = home.blocks[aboutIdx];
      if (cur.kind === "about" && wordCount(cur.body) < 60 && wordCount(freshAbout.body) > wordCount(cur.body)) home.blocks[aboutIdx] = { ...cur, body: freshAbout.body };
    }
    if (wordCount(out.about ?? "") < 60 && wordCount(fresh.about ?? "") > wordCount(out.about ?? "")) out.about = fresh.about;
  }
  // 2. promise + how it works, right after the about block
  const insertAt = () => { const i = home.blocks.findIndex((b) => b.kind === "about"); return i < 0 ? home.blocks.length : i + 1; };
  const promise = freshTitle("highlights", freshHome.blocks.filter((b) => b.kind === "highlights").length - 1);
  const steps = freshHome.blocks.find((b) => b.kind === "services" && /^1\. /.test((b as { items: { name: string }[] }).items[0]?.name ?? ""));
  if (steps && !hasTitled("services", steps.title)) home.blocks.splice(insertAt(), 0, { ...steps, id: uid() });
  if (promise && promise.kind === "highlights" && promise.items.some((x) => x.startsWith("✅")) && !hasTitled("highlights", promise.title)) home.blocks.splice(insertAt(), 0, { ...promise, id: uid() });
  // 3. services page when there is nothing to browse
  if (!out.pages.some((p) => p.slug === "products" || p.slug === "services") && !allBlocks().some((b) => b.kind === "product" || (b.kind === "services" && !/^1\. /.test(b.items[0]?.name ?? "")))) {
    const sp = fresh.pages.find((p) => p.slug === "services");
    if (sp) out.pages.splice(1, 0, { ...sp, id: uid(), blocks: sp.blocks.map((b) => ({ ...b, id: uid() })) });
  }
  // 4. FAQ page, "what we do" paragraph on the contact page
  if (!allBlocks().some((b) => b.kind === "faq")) {
    const fp = fresh.pages.find((p) => p.slug === "faq");
    if (fp) { const ci = out.pages.findIndex((p) => p.slug === "contact"); out.pages.splice(ci < 0 ? out.pages.length : ci, 0, { ...fp, id: uid(), blocks: fp.blocks.map((b) => ({ ...b, id: uid() })) }); }
  }
  const freshContact = fresh.pages.find((p) => p.slug === "contact");
  const more = freshContact?.blocks.find((b) => b.kind === "about");
  const contact = out.pages.find((p) => p.slug === "contact");
  if (more && contact && !contact.blocks.some((b) => b.kind === "about")) contact.blocks.unshift({ ...more, id: uid() });
  // 5. the designed banner replaces stock art (never the owner's own photo)
  if (fresh.coverUrl && (!out.coverUrl || out.coverUrl.startsWith("/art/cover-")) && fresh.coverUrl !== out.coverUrl) out.coverUrl = fresh.coverUrl;
  // 6. website hero text when theirs is empty
  if (out.site && fresh.site?.hero && !out.site.hero?.sub) out.site = { ...out.site, hero: { ...(out.site.hero ?? fresh.site.hero), sub: fresh.site.hero.sub } };
  return out;
}


/* ================= stock media: photos + clip where the owner has none ================= */

export type StockMedia = { photos: { url: string; credit: string }[]; clip: { url: string; poster?: string; credit: string } | null };

/** Real photos of the trade (judged stock) and a short clip, placed only where the card has nothing of its own:
 *  the about picture, a photo gallery page, and "A glimpse" video on Home. The owner's own photos always win;
 *  a card that already has a gallery or a video is left alone. Marked with `stock: true` captions so a later
 *  refresh can tell them from the owner's uploads. */
export function addStockMedia<T extends TemplateCard>(card: T, media: StockMedia, lang: Lang = "en"): T {
  if (!media || (!media.photos.length && !media.clip)) return card;
  const l = pickLang(lang);
  const out = { ...card, pages: card.pages.map((p) => ({ ...p, blocks: [...p.blocks] })) } as T;
  const all = () => out.pages.flatMap((p) => p.blocks);
  const home = out.pages.find((p) => p.slug === "home") ?? out.pages[0];
  if (!home) return card;
  const photos = media.photos.slice(0, 6);
  // 1. about picture
  const about = home.blocks.find((b) => b.kind === "about");
  if (about && about.kind === "about" && !about.imageUrl && photos[0]) about.imageUrl = photos[0].url;
  // 2. gallery page (when there is no gallery / image / carousel anywhere, apart from product shots)
  const hasGallery = all().some((b) => b.kind === "gallery" || (b.kind === "image" && !/product/i.test(b.title)) );
  if (!hasGallery && photos.length >= 3) {
    const title = l === "hi" ? "फ़ोटो" : "Photos";
    const page: CardPage = { id: uid(), slug: "gallery", label: title, blocks: [{ id: uid(), kind: "gallery", title, images: photos.slice(1).concat(photos.slice(0, 1)).map((p) => ({ url: p.url, color: card.themeColor, label: "" })) }] };
    const ci = out.pages.findIndex((p) => p.slug === "faq" || p.slug === "contact");
    out.pages.splice(ci < 0 ? out.pages.length : ci, 0, page);
  }
  // 3. a glimpse — one short clip on Home, after the about block
  if (media.clip && !all().some((b) => b.kind === "video")) {
    const i = home.blocks.findIndex((b) => b.kind === "about");
    const title = l === "hi" ? "एक झलक" : l === "hinglish" ? "Ek jhalak" : "A glimpse";
    home.blocks.splice(i < 0 ? home.blocks.length : i + 1, 0, { id: uid(), kind: "video", title, url: media.clip.url, caption: "", ...(media.clip.poster ? { posterUrl: media.clip.poster } : {}) });
  }
  return out;
}
