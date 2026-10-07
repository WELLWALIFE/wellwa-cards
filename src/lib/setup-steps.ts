// The set-up, screen by screen — ONE list that the progress bar, the onboarding and the welcome page all read
// (owner's call, 5 Oct 2026: "konsa kaha hona chahiye, properly set; steps bada sakte ho par clear and easy").
// One question group per screen; every screen saves what it has before the next opens; nothing is typed twice.
//
// Isomorphic: no 'use client', no 'server-only'.
export type ScreenKey = "you" | "promote" | "site" | "trade" | "details" | "highlights" | "where" | "about" | "extras" | "products" | "make";
export type Screen = { key: ScreenKey; chapter: "you" | "business" | "products" | "make"; en: string; hi: string; blurb: string; blurbHi: string };

export const SETUP_SCREENS: Screen[] = [
  { key: "you", chapter: "you", en: "About you", hi: "आपके बारे में", blurb: "Name, mobile, photo", blurbHi: "नाम, mobile, photo" },
  { key: "promote", chapter: "you", en: "Card for", hi: "Card किसलिए", blurb: "Your business, Shubhora, or both", blurbHi: "आपका business, Shubhora, या दोनों" },
  { key: "site", chapter: "business", en: "Website", hi: "Website", blurb: "Yours, a brand's, or one like yours", blurbHi: "आपकी, brand की, या आपके जैसी" },
  { key: "trade", chapter: "business", en: "Your business", hi: "आपका business", blurb: "Name and what you do", blurbHi: "नाम और काम" },
  { key: "details", chapter: "business", en: "About your trade", hi: "आपके काम के बारे में", blurb: "A few taps", blurbHi: "कुछ tap" },
  // Highlights were on the Products page before (owner, 6 Oct 2026: "is page ko product page se alag karo") — the Products page is products only.
  { key: "highlights", chapter: "business", en: "Highlights", hi: "खासियत", blurb: "Why customers pick you", blurbHi: "Customers आपको क्यों चुनें" },
  { key: "where", chapter: "business", en: "Where & when", hi: "कहाँ और कब", blurb: "City, map, timings", blurbHi: "शहर, map, समय" },
  { key: "about", chapter: "business", en: "About & logo", hi: "परिचय और logo", blurb: "The AI writes it for you", blurbHi: "AI आपके लिए लिखेगा" },
  { key: "extras", chapter: "business", en: "Photos & more", hi: "Photos और बाकी", blurb: "All optional", blurbHi: "सब optional" },
  { key: "products", chapter: "products", en: "Products", hi: "Products", blurb: "What you sell or do", blurbHi: "आप क्या बेचते / करते हैं" },
  { key: "make", chapter: "make", en: "Make", hi: "बनाएँ", blurb: "Your website and card", blurbHi: "आपकी website और card" },
];
export const screenNo = (k: ScreenKey) => Math.max(1, SETUP_SCREENS.findIndex((s) => s.key === k) + 1);
/** The onboarding's own screens, in order (the products and make pages are their own routes). */
export const ONBOARD_SCREENS = SETUP_SCREENS.filter((s) => s.key !== "products" && s.key !== "make").map((s) => s.key) as Exclude<ScreenKey, "products" | "make">[];
