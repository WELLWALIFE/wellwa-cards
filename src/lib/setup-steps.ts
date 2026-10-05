// The set-up, screen by screen — ONE list that the progress bar, the onboarding and the welcome page all read
// (owner's call, 5 Oct 2026: "konsa kaha hona chahiye, properly set; steps bada sakte ho par clear and easy").
// One question group per screen; every screen saves what it has before the next opens; nothing is typed twice.
//
// Isomorphic: no 'use client', no 'server-only'.
export type ScreenKey = "you" | "promote" | "site" | "trade" | "details" | "where" | "about" | "extras" | "products" | "make";
export type Screen = { key: ScreenKey; chapter: "you" | "business" | "products" | "make"; en: string; hi: string; blurb: string; blurbHi: string };

export const SETUP_SCREENS: Screen[] = [
  { key: "you", chapter: "you", en: "About you", hi: "आपके बारे में", blurb: "Name, mobile, photo", blurbHi: "नाम, mobile, photo" },
  { key: "promote", chapter: "you", en: "Card for", hi: "Card किसलिए", blurb: "Your business, Shubhora, or both", blurbHi: "आपका business, Shubhora, या दोनों" },
  { key: "site", chapter: "business", en: "Website", hi: "Website", blurb: "Have one? It fills the rest", blurbHi: "है तो बाकी अपने आप भरेगा" },
  { key: "trade", chapter: "business", en: "Your business", hi: "आपका business", blurb: "Name and what you do", blurbHi: "नाम और काम" },
  { key: "details", chapter: "business", en: "About your trade", hi: "आपके काम के बारे में", blurb: "A few taps about your trade", blurbHi: "आपके काम के कुछ सवाल" },
  { key: "where", chapter: "business", en: "Where & when", hi: "कहाँ और कब", blurb: "City, map, timings", blurbHi: "शहर, map, समय" },
  { key: "about", chapter: "business", en: "About & logo", hi: "परिचय और logo", blurb: "A few lines, the AI helps", blurbHi: "कुछ लाइनें, AI मदद करेगा" },
  { key: "extras", chapter: "business", en: "Photos & more", hi: "Photos और बाकी", blurb: "Photos, payments, links — optional", blurbHi: "Photos, payment, links — optional" },
  { key: "products", chapter: "products", en: "Products", hi: "Products", blurb: "What you sell or do", blurbHi: "आप क्या बेचते / करते हैं" },
  { key: "make", chapter: "make", en: "Make", hi: "बनाएँ", blurb: "Your website and card", blurbHi: "आपकी website और card" },
];
export const screenNo = (k: ScreenKey) => Math.max(1, SETUP_SCREENS.findIndex((s) => s.key === k) + 1);
/** The onboarding's own screens, in order (the products and make pages are their own routes). */
export const ONBOARD_SCREENS = SETUP_SCREENS.filter((s) => s.key !== "products" && s.key !== "make").map((s) => s.key) as Exclude<ScreenKey, "products" | "make">[];
