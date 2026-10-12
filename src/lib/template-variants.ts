// Five website templates per trade, each on a DIFFERENT page structure (docs/website-looks-v3.md), built from the
// trade's base template content (services, prices, FAQ, hours) and the trade's own stock photographs
// (public/art/tpl/<trade>/, Pexels free licence, credits.json beside them). Designs follow what the Oct 2026 market
// review found on the best sites of each trade — structure, mood, type and colour; no site's words, pictures or code.
// Pilot (owner, 12 Oct 2026): restaurant and salon first; the rest of the 79 trades follow the same table.
import type { CardTemplateDef } from "./templates";
import type { CardBlock, ProductItem, SiteStyle } from "./types";

type Variant = {
  trade: string;             // poster-categories key: the kicker word, the mood and the recipe come from it
  from: string;              // base template key
  key: string;
  name: string;
  description: string;
  emoji: string;
  /** The phone card's look (looks.ts) and colour; the website's design is `style`. */
  look: NonNullable<CardTemplateDef["data"]["template"]>;
  color: string;
  name_: string;             // the sample business name
  tagline: string;
  hero: { headline: string; sub: string };
  style: SiteStyle;
  /** Photos by slug under /art/tpl/<trade>/: the cover, one per product (in order), the gallery. */
  cover: string;
  products: string[];
  gallery: [string, string, string];
  /** More sample products, so a Shop's chip row has its four. */
  extraProducts?: { name: string; price: string; desc: string; photo: string; features: string[] }[];
};

const R = "restaurant", S = "salon";
const VARIANTS: Variant[] = [
  /* ---------------- Restaurant / café: Gigue-type wordmark, Behrouz/Dishoom dark, Haldiram's/Chaayos shop, Nham poster, Sweetgreen board ---------------- */
  {
    trade: R, from: "restaurant-cafe", key: "restaurant-wordmark", name: "Café — Wordmark", emoji: "🥐",
    description: "The name set huge, a strip of photos under it: the newest café and bakery look. Warm paper, soft serif.",
    look: "earthy", color: "#7c4a1e", name_: "Your Café", tagline: "Baked fresh, poured slow",
    hero: { headline: "Baked fresh, poured slow", sub: "Breakfast to late evening, a few steps from the main market." },
    style: { blueprint: "wordmark", palette: "ivory", font: "warm", radius: "soft", motion: "calm", pattern: "none", layouts: { products: "showcase", gallery: "mosaic", reviews: "quote", faq: "accordion" } },
    cover: "cafe", products: ["thali", "tandoor"], gallery: ["interior", "latte", "mocktail"],
  },
  {
    trade: R, from: "restaurant-cafe", key: "restaurant-royal-dark", name: "Restaurant — Royal Dark", emoji: "🍛",
    description: "Full-screen dish photo, gold on black, fine serif: the biryani-house and fine-dining look.",
    look: "royal", color: "#c9a24b", name_: "Your Restaurant", tagline: "An evening worth remembering",
    hero: { headline: "Slow-cooked, served royal", sub: "Dum biryani, kebabs and curries from a family kitchen." },
    style: { blueprint: "cinematic", palette: "noir", font: "luxury", radius: "sharp", motion: "calm", pattern: "none", layouts: { about: "statement", products: "showcase", gallery: "masonry", reviews: "quote", faq: "accordion" } },
    cover: "biryani", products: ["curry", "tandoor"], gallery: ["dark", "interior", "mocktail"],
  },
  {
    trade: R, from: "restaurant-cafe", key: "restaurant-order-shop", name: "Restaurant — Order Shop", emoji: "🛵",
    description: "Dish chips to scroll, a promo banner with Order on WhatsApp, open-now and rating: the pattern customers know from food apps.",
    look: "bold", color: "#e8571d", name_: "Your Kitchen", tagline: "Fresh, fast, made for you",
    hero: { headline: "Order in a tap, hot in 30 minutes", sub: "Home delivery across town, pure veg and non-veg kitchens." },
    style: { blueprint: "shop", palette: "saffron", font: "bold", radius: "round", motion: "calm", pattern: "none", layouts: { products: "grid", gallery: "mosaic", reviews: "cards", faq: "accordion" } },
    cover: "thali", products: ["biryani", "tandoor"], gallery: ["interior", "dessert", "mocktail"],
    extraProducts: [
      { name: "Hyderabadi Biryani", price: "₹249", desc: "Long-grain basmati, slow-cooked on dum with saffron and mint.", photo: "curry", features: ["Serves 1", "Raita & salan included"] },
      { name: "Smash Burger & Fries", price: "₹199", desc: "Double patty, melted cheese, house sauce, crisp fries.", photo: "burger", features: ["Veg & chicken", "Extra cheese on request"] },
    ],
  },
  {
    trade: R, from: "restaurant-cafe", key: "restaurant-bold-poster", name: "Café — Bold Poster", emoji: "🍔",
    description: "A green colour block, heavy uppercase type, the photo as a card: the burger-bar and street-food look.",
    look: "bold", color: "#1f7a4d", name_: "Your Burger Bar", tagline: "Big flavours. No fuss.",
    hero: { headline: "Big flavours. No fuss.", sub: "Smash burgers, loaded fries and cold shakes till midnight." },
    style: { blueprint: "story", palette: "emerald", font: "bold", radius: "sharp", motion: "lively", pattern: "none", layouts: { products: "grid", gallery: "mosaic", reviews: "pair", faq: "open" } },
    cover: "burger", products: ["burger", "tandoor"], gallery: ["mocktail", "chef", "interior"],
  },
  {
    trade: R, from: "restaurant-cafe", key: "restaurant-fresh-board", name: "Restaurant — Fresh Board", emoji: "🥗",
    description: "A calm paper board: photo tile, open now, booking and the first dishes at a glance. Light, green, modern.",
    look: "minimal", color: "#2e7d5b", name_: "Your Restaurant", tagline: "Honest food, every day",
    hero: { headline: "Honest food, every day", sub: "Seasonal thalis and chef's specials, cooked fresh for lunch and dinner." },
    style: { blueprint: "bento", palette: "brand", color: "#2e7d5b", font: "editorial", radius: "round", motion: "calm", pattern: "none", layouts: { products: "grid", gallery: "mosaic", reviews: "cards", faq: "accordion" } },
    cover: "chef", products: ["thali", "curry"], gallery: ["latte", "interior", "mocktail"],
  },

  /* ---------------- Salon / parlour: luxe cover (Velora-type), UC-type collage, Axiom-type barber poster, boutique wordmark, Lakmé-type services shop ---------------- */
  {
    trade: S, from: "salon-spa", key: "salon-luxe-cover", name: "Salon — Luxe Cover", emoji: "✨",
    description: "A full-screen portrait, espresso and gold, fine serif: the luxury hair and bridal studio look.",
    look: "royal", color: "#b08b57", name_: "Your Salon", tagline: "Hair that turns heads",
    hero: { headline: "Hair that turns heads", sub: "Cuts, colour and bridal looks by trained stylists, premium products only." },
    style: { blueprint: "cinematic", palette: "cocoa", font: "luxury", radius: "sharp", motion: "calm", pattern: "none", layouts: { about: "statement", products: "showcase", gallery: "masonry", reviews: "quote", faq: "accordion" } },
    cover: "cut", products: ["bridal", "colour"], gallery: ["glow", "blowdry", "bridal"],
  },
  {
    trade: S, from: "salon-spa", key: "salon-studio-collage", name: "Salon — Studio Collage", emoji: "💇",
    description: "Words and quick actions beside a photo collage, services as tiles: the home-services app look, light and friendly.",
    look: "glass", color: "#b5485d", name_: "Your Studio", tagline: "Look good. Feel better.",
    hero: { headline: "Look good. Feel better.", sub: "Hair, skin and nails under one roof — book a slot on WhatsApp." },
    style: { blueprint: "collage", palette: "brand", color: "#b5485d", font: "elegant", radius: "round", motion: "calm", pattern: "none", layouts: { services: "cards", products: "grid", gallery: "mosaic", reviews: "cards", faq: "accordion" } },
    cover: "reception", products: ["bridal", "spa"], gallery: ["cut", "nails", "colour"],
  },
  {
    trade: S, from: "salon-spa", key: "salon-barber-poster", name: "Salon — Barber Poster", emoji: "💈",
    description: "Black block, heavy type, sharp corners, the photo as a card: the barbershop and unisex studio look.",
    look: "neon", color: "#141414", name_: "Your Barbershop", tagline: "Cut. Colour. Confidence.",
    hero: { headline: "Cut. Colour. Confidence.", sub: "Fades, beard sculpting and colour — walk in or book a slot." },
    // The colour block is near-black (the barber sites of the review: black, white type, one photo), not the noir palette's grey.
    style: { blueprint: "story", palette: "brand", color: "#141414", font: "bold", radius: "sharp", motion: "lively", pattern: "none", layouts: { services: "cards", products: "grid", gallery: "mosaic", reviews: "pair", faq: "open" } },
    cover: "barber", products: ["fade", "barber"], gallery: ["fade", "cut", "barber"],
  },
  {
    trade: S, from: "salon-spa", key: "salon-boutique-wordmark", name: "Salon — Boutique Wordmark", emoji: "🌸",
    description: "The studio's name set huge on ivory, a strip of photos under it, classic serif: the boutique parlour look.",
    look: "earthy", color: "#9a5b4f", name_: "Your Parlour", tagline: "Where every look feels like you",
    hero: { headline: "Where every look feels like you", sub: "Bridal, party and everyday looks, with a trial before the big day." },
    style: { blueprint: "wordmark", palette: "ivory", font: "elegant", radius: "soft", motion: "calm", pattern: "none", layouts: { products: "showcase", gallery: "masonry", reviews: "quote", faq: "accordion" } },
    cover: "blowdry", products: ["bridal", "colour"], gallery: ["glow", "mehndi", "nails"],
  },
  {
    trade: S, from: "salon-spa", key: "salon-services-shop", name: "Salon — Services Shop", emoji: "💅",
    description: "Service chips to scroll, a promo banner with Book on WhatsApp, prices open: the salon-chain and booking-app pattern.",
    look: "minimal", color: "#7c3aed", name_: "Your Salon", tagline: "Book your slot in a tap",
    hero: { headline: "Book your slot in a tap", sub: "Open prices, trained staff, sterilised tools — ladies and gents." },
    style: { blueprint: "shop", palette: "royal", font: "clinic", radius: "soft", motion: "calm", pattern: "none", layouts: { products: "grid", gallery: "mosaic", reviews: "cards", faq: "accordion" } },
    cover: "wash", products: ["bridal", "colour"], gallery: ["reception", "cut", "mehndi"],
    extraProducts: [
      { name: "Hair Spa & Blow-dry", price: "₹899", desc: "Deep-conditioning spa with a salon blow-dry finish.", photo: "blowdry", features: ["60 minutes", "All hair types"] },
      { name: "Gel Nails", price: "₹1,199", desc: "Shaping, cuticle care and long-wear gel colour.", photo: "nails", features: ["Lasts 3 weeks", "Nail art on request"] },
    ],
  },
];

const url = (trade: string, slug: string) => `/art/tpl/${trade}/${slug}.jpg`;

/** The base template's pages with the variant's photos in place of the sample art: the cover, one per product, the
 *  gallery, the single picture block; the (empty) video block dropped. */
function rePhoto(pages: CardTemplateDef["data"]["pages"], v: Variant): CardTemplateDef["data"]["pages"] {
  let pi = 0;
  const extra: ProductItem[] = [];
  return pages.map((pg) => ({
    ...pg,
    blocks: pg.blocks.flatMap((b): CardBlock[] => {
      if (b.kind === "video") return [];
      if (b.kind === "gallery") return [{ ...b, images: v.gallery.map((s, i) => ({ ...(b.images[i] ?? {}), url: url(v.trade, s) })) }];
      if (b.kind === "image") return [{ ...b, images: b.images.map((im, i) => ({ ...im, url: url(v.trade, i === 0 ? v.cover : v.gallery[i % 3]) })) }];
      if (b.kind === "product") {
        const items = b.items.map((p) => ({ ...p, images: [url(v.trade, v.products[pi++ % v.products.length])], imageUrl: undefined }));
        if (v.extraProducts && !extra.length && items[0]) {
          for (const e of v.extraProducts) extra.push({ ...items[0], name: e.name, price: e.price, mrp: "", badge: "", desc: e.desc, images: [url(v.trade, e.photo)], features: e.features, specs: [] });
          return [{ ...b, items: [...items, ...extra] }];
        }
        return [{ ...b, items }];
      }
      return [b];
    }),
  }));
}

export function makeVariants(base: CardTemplateDef[]): CardTemplateDef[] {
  const out: CardTemplateDef[] = [];
  for (const v of VARIANTS) {
    const b = base.find((t) => t.key === v.from);
    if (!b) continue;
    out.push({
      key: v.key, name: v.name, category: b.category, description: v.description, emoji: v.emoji,
      data: {
        ...b.data,
        name: v.name_, company: v.name_, lead: "business",
        template: v.look, themeColor: v.color, avatarColor: v.color,
        tagline: v.tagline,
        coverUrl: url(v.trade, v.cover),
        pages: rePhoto(b.data.pages, v),
        seo: { ...(b.data.seo ?? {}), categoryKey: v.trade },
        site: {
          enabled: true, ...(b.data.site ?? {}),
          style: v.style, templateKey: v.key,
          hero: { headline: v.hero.headline, sub: v.hero.sub, imageUrl: url(v.trade, v.cover) },
        },
      },
    });
  }
  return out;
}
