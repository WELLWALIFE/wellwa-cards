// Plain names for every layout of every section of the Premium website (lib/site-advanced.ts *_IDS), for the "build your own
// design" picker in the website editor (owner, 24 Nov 2026: "iska ye achha laga, uska wo — ek final website ban jaye").
// [English, Hindi]. A new id without a name here still shows — as its id — and checkVariantNames() lists it for the tests.
import { VARIANT_IDS, type SectionKey } from "@/lib/site-advanced";

export const VARIANT_NAMES: Record<Exclude<SectionKey, "hero">, Record<string, [string, string]>> = {
  trust: {
    strip: ["One neat row", "एक सीधी पट्टी"], counters: ["Big counting numbers", "बड़े गिनते नंबर"], "icon-row": ["Icon with each point", "हर बात के साथ icon"],
    ticker: ["Moving strip", "चलती पट्टी"], "split-cards": ["Line on left, cards on right", "बाएँ line, दाएँ cards"], bento: ["One huge number + tiles", "एक बड़ा नंबर + tiles"],
    hairline: ["Ruled grid, numbered", "लकीरों वाला grid"], "usp-bar": ["Small capitals bar", "छोटे अक्षरों की पट्टी"],
  },
  about: {
    "story-columns": ["Big line + story in columns", "बड़ी line + कहानी columns में"], "overlap-card": ["Photo with a card over it", "फ़ोटो पर चढ़ा card"],
    "editorial-split": ["Magazine style, two sides", "Magazine जैसा, दो हिस्से"], "pull-quote": ["Big quote in the middle", "बीच में बड़ा quote"],
    "year-timeline": ["Years as a timeline", "सालों की timeline"], "owner-card": ["Meet the owner", "मालिक से मिलिए"], "numbers-led": ["Numbers first", "पहले नंबर"],
    "photo-collage": ["Photo collage + story", "फ़ोटो collage + कहानी"], manifesto: ["Poster-size opening line", "Poster जितनी बड़ी line"], chapters: ["Story in chapters", "कहानी chapters में"],
    "founder-letter": ["A signed letter", "दस्तख़त वाला पत्र"], "banner-columns": ["Wide photo + panel", "चौड़ी फ़ोटो + panel"],
  },
  services: {
    grid: ["Card grid", "Cards का grid"], "feature-cards": ["Large cards", "बड़े cards"], "price-list": ["Compact price list", "छोटी rate list"], magazine: ["Magazine grid", "Magazine grid"],
    scroller: ["Sideways shelf", "खिसकने वाली shelf"], "category-tabs": ["Tabs by category", "Category के tabs"], "menu-leaders": ["Printed menu (name …… price)", "छपा menu (नाम …… दाम)"],
    tiers: ["Plans side by side", "Plans साथ-साथ"], "index-rows": ["Numbered big rows", "नंबर वाली बड़ी rows"], "listing-rows": ["Photo rows, left-right", "फ़ोटो rows, बाएँ-दाएँ"],
    "shop-grid": ["Shop with search & filter", "खोज और filter वाली दुकान"], "rate-list": ["Trader's rate list", "व्यापारी की rate list"], lookbook: ["Tall photos in a row", "लंबी फ़ोटो एक कतार में"],
    "edit-tiles": ["Big photo tiles", "बड़ी फ़ोटो tiles"],
  },
  gallery: {
    mosaic: ["One big + small around", "एक बड़ी + आसपास छोटी"], masonry: ["Staggered columns", "ऊँची-नीची columns"], filmstrip: ["Dark strip to swipe", "खिसकाने वाली काली पट्टी"],
    bento: ["Big frame + ring", "बड़ा frame + घेरा"], "album-tabs": ["Albums as tabs", "Albums के tabs"], "lightbox-grid": ["Even grid, +more", "बराबर grid, +और"],
    scrapbook: ["Taped prints", "चिपकी हुई prints"], rooms: ["Numbered grid with captions", "नंबर और caption वाला grid"], "pinned-reel": ["Slides as you scroll", "scroll पर खिसकती फ़ोटो"],
    stage: ["One big photo + thumbnails", "एक बड़ी फ़ोटो + छोटी"], "portrait-row": ["Tall portraits, four across", "लंबी फ़ोटो, चार एक साथ"],
  },
  proof: {
    cards: ["Three review cards", "तीन review cards"], "review-wall": ["Wall of reviews", "Reviews की दीवार"], "testimonial-carousel": ["One big review at a time", "एक बार में एक बड़ा review"],
    "star-summary": ["Star rating + reviews", "Star rating + reviews"], "results-band": ["Numbers + short quotes", "नंबर + छोटे quotes"], "clients-strip": ["Customer names strip", "ग्राहकों के नाम की पट्टी"],
    receipt: ["Like a receipt", "रसीद जैसा"], "marquee-cards": ["Two moving rows", "दो चलती कतारें"], spotlight: ["One huge review + list", "एक बहुत बड़ा review + सूची"],
  },
  process: {
    steps: ["Steps in a row", "एक कतार में steps"], "numbered-list": ["Big numbers, list", "बड़े नंबर, सूची"], "timeline-h": ["Timeline", "Timeline"], "icon-cards": ["Card with icon per step", "हर step का icon card"],
    "step-accordion": ["Steps that open", "खुलने वाले steps"], "stack-cards": ["Stacking cards", "एक के ऊपर एक cards"], "atelier-band": ["Photo band + one button", "फ़ोटो पट्टी + एक बटन"],
  },
  faq: {
    accordion: ["Questions that open", "खुलने वाले सवाल"], "numbered-accordion": ["Numbered, open one by one", "नंबर वाले, एक-एक खुलें"], "two-column": ["All answers, two columns", "सारे जवाब, दो columns"],
    searchable: ["With a search box", "खोज के साथ"], "chat-bubble": ["Like a chat", "Chat जैसा"], spotlight: ["List + big answer card", "सूची + बड़ा जवाब card"], fold: ["Small 'good to know'", "छोटा 'जानने लायक'"],
  },
  visit: {
    split: ["Address + map link", "पता + map link"], "map-hours": ["Map card + timings table", "Map card + समय की table"], "hours-timeline": ["Timings first", "पहले समय"],
    "address-poster": ["Address as a poster", "पता poster जैसा"], "branch-list": ["List of branches", "शाखाओं की सूची"], "contact-desk": ["Big number + enquiry form", "बड़ा नंबर + enquiry form"],
  },
  cta: {
    band: ["Dark band, one button", "काली पट्टी, एक बटन"], "wide-band": ["Full colour band, big line", "पूरी रंगीन पट्टी, बड़ी line"], "floating-card": ["Floating card with photo", "तैरता card, फ़ोटो के साथ"],
    "split-qr": ["Buttons + QR code", "बटन + QR code"], "sticky-ribbon": ["Ribbon that follows", "साथ चलती पट्टी"], callback: ["'Call me back' form", "'मुझे call करें' form"],
  },
  footer: {
    columns: ["Columns + QR", "Columns + QR"], mega: ["Big footer with links", "Links वाला बड़ा footer"], minimal: ["One quiet row", "एक सादी कतार"], "big-wordmark": ["Very large name", "बहुत बड़ा नाम"],
    "link-grid": ["Grid of tiles", "Tiles का grid"], atelier: ["Ticker + outline name", "चलती पट्टी + outline नाम"], hotline: ["Phone number huge", "फ़ोन नंबर बहुत बड़ा"],
  },
};

export const variantName = (key: SectionKey, id: string, hi: boolean): string => (key === "hero" ? id : (VARIANT_NAMES[key][id] ?? [id, id])[hi ? 1 : 0]);

/** Ids that have no name yet (empty when all is well). */
export function checkVariantNames(): string[] {
  const out: string[] = [];
  for (const k of Object.keys(VARIANT_NAMES) as Exclude<SectionKey, "hero">[]) {
    for (const id of VARIANT_IDS[k]) if (!VARIANT_NAMES[k][id]) out.push(`${k}:${id}`);
    for (const id of Object.keys(VARIANT_NAMES[k])) if (!VARIANT_IDS[k].includes(id)) out.push(`${k}:${id} (no such layout)`);
  }
  return out;
}
