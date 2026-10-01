// What a website for a given trade is made of — which sections, in what order, what the catalogue is called,
// what the button says — and the trade's own seeds for services, why-us, steps and FAQ (trade-data/*). One
// pure module; the AI brief, the composer and the audit all read it (owner's call, 1 Oct 2026: every card must
// come out complete and professional in one build, for all 78 trades, with or without a website).
//
// Isomorphic: no 'use client', no 'server-only'.
import { categoryOf } from "@/lib/poster-categories";
import { TRADE_DATA, GROUP_DATA } from "@/lib/trade-data";
import type { TradeData } from "@/lib/trade-data/types";

/** What the business's things are called on the site. */
export type CatalogWord = "products" | "menu" | "services" | "treatments" | "courses" | "projects" | "plans" | "work";
/** The main button. */
export type Cta = "order" | "book" | "enquire" | "visit" | "join";
/** Home page sections, in the order a good page of this trade shows them. Each is shown only when it has
 *  enough in it (see card-compose.ts); the seeds fill the ones the AI left thin. */
export type HomeKind = "trust" | "catalog" | "services" | "whyUs" | "steps" | "about" | "offer" | "booking" | "photos" | "reviews";

export type Recipe = {
  catalog: CatalogWord;
  cta: Cta;
  home: HomeKind[];
  /** Minimum items for a section to appear (defaults: services 3, whyUs 3, steps 3, faq 3). */
  min?: Partial<Record<"services" | "whyUs" | "steps" | "faq", number>>;
};

/* ---- shapes a trade's home page takes ---- */
/** A shop: what it sells first, then why, then how to buy. */
const SHOP: Recipe = { catalog: "products", cta: "order", home: ["trust", "catalog", "offer", "about", "whyUs", "services", "steps", "reviews", "photos"] };
/** A place to eat: the menu leads. */
const EATERY: Recipe = { ...SHOP, catalog: "menu" };
/** A service done for the customer (electrician, cleaning, courier…): services first, then how it works. */
const SERVICE: Recipe = { catalog: "services", cta: "enquire", home: ["trust", "services", "whyUs", "steps", "about", "photos", "reviews", "offer"] };
/** A professional seen by appointment: who they are, what they treat / handle, how to book. */
const PROFESSIONAL: Recipe = { catalog: "services", cta: "book", home: ["trust", "about", "services", "whyUs", "steps", "booking", "reviews", "photos", "offer"] };
/** Treatment-based professional (doctor, dentist, ayurveda, salon, spa). */
const CLINIC: Recipe = { ...PROFESSIONAL, catalog: "treatments" };
/** Teaching: courses lead. */
const LEARNING: Recipe = { catalog: "courses", cta: "enquire", home: ["trust", "services", "whyUs", "about", "steps", "reviews", "photos", "offer"] };
/** Builders, interiors, photographers, events: the work lead. */
const PORTFOLIO: Recipe = { catalog: "projects", cta: "enquire", home: ["trust", "photos", "services", "whyUs", "steps", "about", "reviews", "offer"] };
/** An agent / network partner: the plans or products they represent, then them. */
const AGENT: Recipe = { catalog: "plans", cta: "enquire", home: ["trust", "about", "services", "whyUs", "steps", "reviews", "offer"] };
/** A person, an organisation or a leader: about, what they do, photos. */
const PERSON: Recipe = { catalog: "work", cta: "visit", home: ["about", "trust", "whyUs", "services", "photos", "reviews"] };

const BY_GROUP: Record<string, Recipe> = {
  Retail: SHOP, Food: EATERY, Health: CLINIC, Services: SERVICE, Education: LEARNING,
  Sales: AGENT, Industry: SHOP, Community: PERSON, Personal: PERSON,
};
const BY_KEY: Record<string, Recipe> = {
  // food
  catering: { ...SERVICE, catalog: "menu", cta: "enquire" }, hotel: { ...PROFESSIONAL, catalog: "services", cta: "book" }, tiffin: { ...EATERY, cta: "order" },
  // health that is a shop / a gym
  medical: SHOP, water: SHOP, wellness: SHOP, pharma: AGENT,
  gym: { ...LEARNING, catalog: "plans", cta: "join", home: ["trust", "services", "whyUs", "photos", "steps", "about", "reviews", "offer"] },
  hospital: { ...CLINIC, cta: "book" },
  // services that are professionals or portfolios
  ca: PROFESSIONAL, lawyer: PROFESSIONAL, astro: PROFESSIONAL, insurance: AGENT, finance: AGENT,
  realestate: { ...PORTFOLIO, catalog: "projects", cta: "enquire" }, builder: PORTFOLIO, interior: PORTFOLIO, photography: PORTFOLIO, event: PORTFOLIO,
  travel: { ...SHOP, catalog: "plans", cta: "enquire" }, auto: SERVICE, printing: SHOP, it: { ...PORTFOLIO, catalog: "services" },
  tailor: { ...SERVICE, home: ["trust", "photos", "services", "whyUs", "steps", "about", "reviews", "offer"] }, mehndi: { ...PORTFOLIO, cta: "book" },
  // education
  school: { ...LEARNING, cta: "enquire" }, college: LEARNING, computer: LEARNING, coaching: LEARNING, teacher: { ...PROFESSIONAL, catalog: "courses" }, dance: LEARNING,
  student: PERSON,
  // sales
  mlm: AGENT, distributor: SHOP, sales: AGENT, agent: AGENT,
  // industry
  manufacturer: { ...SHOP, cta: "enquire" }, wholesale: { ...SHOP, cta: "enquire" }, agri: SHOP, dairy: SHOP, textile: SHOP,
  // personal
  influencer: { ...PERSON, catalog: "work", cta: "enquire" }, other: SERVICE,
};

/** The recipe for a trade: by key, else by its group, else a plain service business. */
export function recipeFor(categoryKey: string): Recipe {
  const c = categoryOf(categoryKey);
  return BY_KEY[categoryKey] ?? (c ? BY_GROUP[c.group] : undefined) ?? SERVICE;
}

/** The trade's own seeds (services, why-us, steps, FAQ, what to explain): by key, else the group's. */
export function tradeDataFor(categoryKey: string): TradeData | null {
  const c = categoryOf(categoryKey);
  return TRADE_DATA[categoryKey] ?? (c ? GROUP_DATA[c.group] : undefined) ?? null;
}

/** The catalogue word in the card's language, for section titles and the button. */
export function catalogLabel(word: CatalogWord, lang: "en" | "hi" | "hinglish"): string {
  const hi = lang === "hi";
  switch (word) {
    case "menu": return hi ? "मेन्यू" : "Menu";
    case "services": return hi ? "सेवाएँ" : "Services";
    case "treatments": return hi ? "उपचार" : "Treatments";
    case "courses": return hi ? "कोर्स" : "Courses";
    case "projects": return hi ? "हमारा काम" : "Our work";
    case "plans": return hi ? "प्लान" : "Plans";
    case "work": return hi ? "मेरा काम" : "What I do";
    default: return hi ? "प्रोडक्ट" : "Products";
  }
}

export function ctaLabel(cta: Cta, lang: "en" | "hi" | "hinglish"): string {
  const hi = lang === "hi";
  switch (cta) {
    case "order": return hi ? "WhatsApp पर ऑर्डर करें" : lang === "hinglish" ? "WhatsApp par order karein" : "Order on WhatsApp";
    case "book": return hi ? "अपॉइंटमेंट बुक करें" : lang === "hinglish" ? "Appointment book karein" : "Book an appointment";
    case "join": return hi ? "अभी जुड़ें" : lang === "hinglish" ? "Abhi join karein" : "Join now";
    case "visit": return hi ? "संपर्क करें" : lang === "hinglish" ? "Sampark karein" : "Get in touch";
    default: return hi ? "WhatsApp पर पूछें" : lang === "hinglish" ? "WhatsApp par poochhein" : "Enquire on WhatsApp";
  }
}

/** A phrase too generic to stand in a section (the trade's own list plus the ones every trade shares). */
const GENERIC_ALWAYS = ["connect with us", "explore options", "finalise your choice", "explore our options", "get in touch with us", "contact us today", "quality products", "best quality", "customer satisfaction", "we are committed", "one-stop", "wide range", "top-notch", "world-class", "state-of-the-art", "look no further"];
export function isGeneric(text: string, data: TradeData | null): boolean {
  const t = (text ?? "").toLowerCase().replace(/^\d+\.\s*/, "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  if (!t) return true;
  return [...GENERIC_ALWAYS, ...(data?.generic ?? [])].some((g) => t === g || t.startsWith(g));
}
