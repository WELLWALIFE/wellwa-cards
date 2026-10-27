// The kinds of reel — chosen once on /poster/reel; the Advanced page (/poster/reel/pro) reads the same list,
// so the names never differ between the two pages (owner, 27 Oct 2026).
export const REEL_KINDS = [
  { k: "tip", e: "💡", hi: "काम की बात", en: "Useful tip", dhi: "लोग save करें", den: "People save it", music: "calm-ambient" },
  { k: "offer", e: "🎉", hi: "Offer", en: "Offer", dhi: "आज का offer", den: "Today's offer", music: "energetic-promo" },
  { k: "benefit", e: "⭐", hi: "हम क्यों", en: "Why us", dhi: "हमसे क्यों लें", den: "Why buy from you", music: "upbeat-corporate" },
  { k: "review", e: "😊", hi: "ग्राहक की बात", en: "Happy customer", dhi: "एक ग्राहक की कहानी", den: "A customer's story", music: "inspiring-motivational" },
  { k: "festival", e: "🪔", hi: "त्योहार", en: "Festival", dhi: "शुभकामनाएँ", den: "Festival wishes", music: "festive-diwali" },
  { k: "story", e: "🎬", hi: "छोटी कहानी", en: "Short story", dhi: "रोज़ की ज़िंदगी से", den: "From daily life", music: "indian-sitar" },
] as const;
export type ReelKind = (typeof REEL_KINDS)[number]["k"];
