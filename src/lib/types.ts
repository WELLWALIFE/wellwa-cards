// ===== Core domain types for the digital card platform =====
// These mirror the database schema in supabase/migrations/0001_init.sql

export type Plan = "free" | "pro" | "team";

// Visual template for the public card header/layout.
// Twelve looks — see src/lib/looks.ts for what each one changes (fonts, palette, header, corners).
export type CardTemplate = "classic" | "gradient" | "minimal" | "dark" | "photo" | "bold" | "royal" | "glass" | "corporate" | "earthy" | "neon" | "editorial";

export type LinkType =
  | "phone"
  | "email"
  | "whatsapp"
  | "website"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "location"
  | "upi";

export interface CardLink {
  id: string;
  type: LinkType;
  label: string;
  value: string; // phone number, url, upi id, etc.
}

// ===== Multi-page mini-website card model =====
// A card has several PAGES (Home, About, Products, Gallery, Contact),
// each page is a stack of BLOCKS rendered top to bottom.

export interface GalleryImage {
  url?: string; // uploaded image (data URL) — falls back to color tile
  color: string; // placeholder tint until an image is uploaded
  label: string;
}

export interface CardImage {
  url: string; // uploaded image (data URL)
  caption?: string;
}

export interface ServiceItem {
  name: string;
  desc: string;
}

export interface TestimonialItem {
  name: string;
  text: string;
  rating: number; // 1..5
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface HoursRow {
  day: string;
  time: string; // e.g. "10:00 – 19:00" or "Closed"
}

export interface SpecRow {
  label: string; // e.g. "Plates", "pH range", "Warranty"
  value: string; // e.g. "7", "8.5–10.5", "5 years"
}

// A full product entry for a professional product page.
export interface ProductItem {
  name: string;
  imageUrl?: string;   // legacy single image — still honoured as the first image
  images?: string[];   // up to 3 product photos (gallery + tap to zoom)
  mrp?: string;        // original price (struck through)
  price?: string;      // offer / selling price
  badge?: string;      // e.g. "Bestseller", "20% OFF"
  desc?: string;       // short description
  features: string[];  // key selling points
  specs: SpecRow[];    // technical specification rows
  ctaLabel?: string;   // button text, e.g. "Book demo", "Order on WhatsApp"
}

export type CardBlock =
  | { id: string; kind: "about"; title: string; body: string; imageUrl?: string }
  | { id: string; kind: "highlights"; title: string; items: string[] }
  | { id: string; kind: "services"; title: string; items: ServiceItem[] }
  | { id: string; kind: "product"; title: string; items: ProductItem[] }
  | { id: string; kind: "gallery"; title: string; images: GalleryImage[] }
  | { id: string; kind: "image"; title: string; images: CardImage[] }
  | { id: string; kind: "carousel"; title: string; images: CardImage[] }
  | { id: string; kind: "video"; title: string; url: string; caption: string; posterUrl?: string }
  | { id: string; kind: "pdf"; title: string; fileLabel: string; fileUrl?: string; posterUrl?: string; hint?: string }
  | { id: string; kind: "testimonials"; title: string; items: TestimonialItem[] }
  | { id: string; kind: "faq"; title: string; items: FaqItem[] }
  | { id: string; kind: "hours"; title: string; rows: HoursRow[] }
  | { id: string; kind: "appointment"; title: string; url: string; note: string }
  | { id: string; kind: "location"; title: string; address: string; /** Exact Google Maps link, e.g. https://maps.google.com/?q=26.912434,75.787271 or a maps.app.goo.gl link. */ mapUrl?: string }
  | { id: string; kind: "offer"; title: string; text: string; code: string; expires: string }
  | { id: string; kind: "contact"; title: string; note?: string }
  | { id: string; kind: "cta"; title: string; body?: string; joinUrl: string; joinLabel: string; referralCode: string }
  | { id: string; kind: "compare"; title: string; leftLabel: string; rightLabel: string; rows: CompareRow[] }
  /** Wide picture tiles with a name and a line under each — templates, branches, brands, projects. A tile with a url opens it. */
  | { id: string; kind: "showcase"; title: string; items: ShowcaseItem[] };

export interface ShowcaseItem {
  imageUrl: string;
  label: string;
  sub?: string;
  url?: string;
}

/** One row of a left-vs-right comparison. Marks default to "us ✓ / them ✗";
 *  set leftOk:false or rightOk:true to override for a neutral row. */
export interface CompareRow {
  feature: string;
  left: string;
  right: string;
  leftOk?: boolean;
  rightOk?: boolean;
}

export interface CardPage {
  id: string;
  slug: string; // home | about | products | gallery | contact
  label: string; // nav label
  blocks: CardBlock[];
  /** Kept off the card's tab row — the page is reachable only by its own address
   *  (/c/<user>/<slug>). The Shubhora page on a "both" card uses this, so a customer
   *  of the owner's own business never lands on it; the owner shares that one link
   *  only where it belongs. */
  hidden?: boolean;
}

/** Website design choices (see src/lib/site-style.ts for the palettes, font pairs and hero layouts). */
export interface SiteStyle {
  /** Palette key ("midnight", "ocean", …) or "brand" — colours built from `color` / the card's theme colour. */
  palette?: string;
  /** A website-only brand colour (#rrggbb), e.g. read from the reference website; the card keeps its own. */
  color?: string;
  /** Font pair key ("modern", "elegant", …); unset = the card look's fonts. */
  font?: string;
  /** grid = a mosaic of product photos beside the words (shops); person = the owner's portrait (professionals). */
  hero?: "split" | "photo" | "stage" | "minimal" | "grid" | "person";
  radius?: "sharp" | "soft" | "round";
  /** How sections are laid out when the designer (site-designer.ts) or the owner chose; unset = decided from the
   *  content (site-layout.ts). A choice the content cannot carry is ignored by the renderer. */
  layouts?: SiteLayouts;
}

export interface SiteLayouts {
  about?: "photo-left" | "photo-right" | "statement" | "columns";
  services?: "rows" | "cards" | "list";
  products?: "showcase" | "grid" | "dense";
  faq?: "open" | "accordion";
  reviews?: "quote" | "pair" | "cards";
  gallery?: "mosaic" | "masonry";
}

/** The composed website home page: which sections, in what order, and the trust facts under the hero. */
export interface SiteHome {
  order?: string[];
  hidden?: string[];
  /** The trust strip ("Since 2015", "4.8★ · 32 reviews"); unset = worked out from the card's own facts. */
  stats?: { value: string; label: string }[];
}

export interface Card {
  id: string;
  username: string; // public slug -> /c/<username>
  name: string;
  jobTitle: string;
  company: string;
  tagline: string;
  about: string;
  avatarColor: string; // placeholder tint if no avatar image
  avatarUrl?: string;  // uploaded profile photo (data URL)
  avatarShape?: "circle" | "square"; // square suits logos/product shots (circle clips them)
  coverUrl?: string;   // uploaded banner/cover photo (data URL)
  themeColor: string;
  template: CardTemplate;
  verified: boolean;
  links: CardLink[];
  pages: CardPage[];
  plan: Plan;
  active: boolean;
  views: number;
  createdAt: string;
  // ---- settings (optional; editable in the editor) ----
  customDomain?: string;
  seoTitle?: string;
  seoDescription?: string;
  /** Local search: where and what, so the card shows up for "<type> in <city>" and "<type> near me". */
  seo?: { city?: string; areas?: string[]; category?: string; /** The trade's key (poster-categories.ts), so search data can name the right schema.org type. */ categoryKey?: string; keywords?: string[]; googleVerify?: string };
  language?: string;
  locked?: boolean;
  /** Header order: 'business' puts the business name first (shops); absent or
   *  'person' keeps the person-first layout, so older cards render unchanged. */
  lead?: "business" | "person";
  /** GST number as the owner typed it; shown in the footer and JSON-LD taxID. */
  gstin?: string;
  // ---- ads & measurement (Pro; read by card_tracking on the public page) ----
  fbPixelId?: string;      // 1234567890123456
  ga4Id?: string;          // G-XXXXXXX
  googleAdsId?: string;    // AW-123456789
  googleAdsLabel?: string; // conversion label from Google Ads
  // ---- AI bot training (used by on-card chat + WhatsApp auto-reply) ----
  botPersona?: string;   // tone/role, e.g. "Friendly water-ionizer expert"
  botKnowledge?: string; // product/business facts, FAQs, prices (manual + PDF-extracted)
  /** What this card sells beyond its own content.
   *  "shubhora": the whole card is a Shubhora partner's — its assistant also gets Shubhora's own,
   *  always-current facts (bridge/shubhora-kb.mjs, or the Super Admin override). Set by the
   *  "Promote Shubhora" template.
   *  "both": the owner runs their own business AND promotes Shubhora. The card itself stays their
   *  business; Shubhora sits on its own hidden page (SHUBHORA_PAGE_SLUG in src/lib/shubhora-page.ts)
   *  with its own link, and only that page's chat answers as a Shubhora seller — the two are never
   *  mixed into one answer, and the daily posters stay the owner's own. */
  kb?: "shubhora" | "both";
  /** Set by the builder when the card was written from the owner's OWN website: the site is the truth, so a
   *  merge into an older card must not keep that card's search title, website / email links or brand art. */
  builtFrom?: "own-site";
  /** Website mode: the same card served as a full website on desktop
   *  (/c/<user> picks by device; ?view=site|card forces). Generated by
   *  /api/site/generate from the Shubhora profile/products/reviews. */
  site?: {
    enabled: boolean;
    hero?: { headline: string; sub: string; imageUrl?: string; ctaLabel?: string };
    hidden?: string[];      // page slugs left out of the website nav
    hideProfile?: boolean;  // no photo+name chip under the hero headline
    logoUrl?: string;       // website header/footer logo (the card avatar is usually a portrait)
    generatedAt?: string;
    templateKey?: string;   // website template chosen (free)
    /** The website's own design (src/lib/site-style.ts): palette, fonts, hero layout, corners. Unset = derived from
     *  the card's colour and look, so older websites render as before. The phone card is never changed by it. */
    style?: SiteStyle;
    /** The composed home page (src/lib/site-home.ts): section order, hidden sections, the trust-strip facts. */
    home?: SiteHome;
    /** The website the owner gave as a reference ("make mine look like this") — its style was copied, never its facts. */
    reference?: { url: string; at: string };
    /** Announcement bar over the header ("Diwali offer — 20% off till 5 Nov"); `until` (YYYY-MM-DD) hides it after that day. */
    bar?: { text: string; link?: string; until?: string };
    /** The floating button on the website (bottom-left on desktop, the sticky bar on phones); default WhatsApp. */
    float?: "whatsapp" | "call" | "none";
  };
  // ---- welcome popup (lead-capture modal, shown once per visit) ----
  popup?: {
    enabled: boolean;
    title: string;      // e.g. "Get 10% off your first purchase"
    subtitle?: string;  // e.g. "Sign up below!"
    ctaLabel: string;   // e.g. "Claim my discount"
    terms?: string;     // fine print under the button
  };
}

export type LeadStatus = "new" | "hot" | "warm" | "cold" | "won";
export type LeadSource = "form" | "whatsapp" | "vcard" | "qr" | "popup";

export interface Lead {
  id: string;
  cardId: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  source: LeadSource;
  status: LeadStatus;
  score: number; // 0-100, AI lead score
  createdAt: string;
}
