// The set-up, screen by screen — ONE list that the progress bar, the onboarding and the welcome page all read
// (owner's call, 5 Oct 2026: "konsa kaha hona chahiye, properly set; steps bada sakte ho par clear and easy").
// One question group per screen; every screen saves what it has before the next opens; nothing is typed twice.
//
// Isomorphic: no 'use client', no 'server-only'.
export type ScreenKey = "you" | "promote" | "site" | "trade" | "details" | "highlights" | "where" | "about" | "extras" | "products" | "make";
export type Screen = { key: ScreenKey; chapter: "you" | "business" | "products" | "make"; en: string; hi: string; blurb: string; blurbHi: string; /** Not part of the set-up walk: reached later from Card & Website → Edit (owner, 14 Oct 2026: nobody has the photos and products ready while signing up). */ later?: true };

export const SETUP_SCREENS: Screen[] = [
  { key: "you", chapter: "you", en: "About you", hi: "आपके बारे में", blurb: "Name, mobile, photo", blurbHi: "नाम, mobile, photo" },
  { key: "promote", chapter: "you", en: "Card for", hi: "Card किसलिए", blurb: "Your business, Shubhora, or both", blurbHi: "आपका business, Shubhora, या दोनों" },
  { key: "site", chapter: "business", en: "Website", hi: "Website", blurb: "Yours, a brand's, or one like yours", blurbHi: "आपकी, brand की, या आपके जैसी" },
  { key: "trade", chapter: "business", en: "Your business", hi: "आपका business", blurb: "Name and what you do", blurbHi: "नाम और काम" },
  { key: "details", chapter: "business", en: "About your trade", hi: "आपके काम के बारे में", blurb: "A few taps", blurbHi: "कुछ tap" },
  // Highlights were on the Products page before (owner, 6 Oct 2026: "is page ko product page se alag karo") — the Products page is products only.
  { key: "highlights", chapter: "business", en: "Highlights", hi: "खासियत", blurb: "Why customers pick you", blurbHi: "Customers आपको क्यों चुनें", later: true },   // now on the same screen as "About your trade"
  { key: "where", chapter: "business", en: "Where & when", hi: "कहाँ और कब", blurb: "City, map, timings", blurbHi: "शहर, map, समय" },
  { key: "about", chapter: "business", en: "About & logo", hi: "परिचय और logo", blurb: "The AI writes it for you", blurbHi: "AI आपके लिए लिखेगा" },
  { key: "extras", chapter: "business", en: "Photos & more", hi: "Photos और बाकी", blurb: "All optional", blurbHi: "सब optional", later: true },
  { key: "products", chapter: "products", en: "Products", hi: "Products", blurb: "What you sell or do", blurbHi: "आप क्या बेचते / करते हैं", later: true },
  { key: "make", chapter: "make", en: "Make", hi: "बनाएँ", blurb: "Your website and card", blurbHi: "आपकी website और card" },
];
/** The page each screen is on — "Finish setup" returns to exactly the one the owner left (owner's call, 7 Oct 2026:
 *  "beech me kahin bhi drop kare to complete setup par wahi page khule"). The account remembers it as `setup_pos`. */
export const screenHref = (k: ScreenKey): string => k === "products" || k === "extras" || k === "make" ? "/poster/card/build?make=1" : `/poster/onboard?step=${k}`;
export const isScreenKey = (v: unknown): v is ScreenKey => typeof v === "string" && SETUP_SCREENS.some((s) => s.key === v);
/** The screens of the set-up walk itself. */
export const FLOW_SCREENS = SETUP_SCREENS.filter((s) => !s.later);
/** `skipped`: screens left out for this person (e.g. "Who is this for?" is only for partners). */
export const flowOf = (skipped: ScreenKey[] = []) => FLOW_SCREENS.filter((s) => !skipped.includes(s.key));
/** "Step N" of a screen. A screen that is not part of the walk (Highlights, Photos & more, Products: `later`) used to count as
 *  step 1 and the bar fell back to the start; it now sits at the last walk screen before it. */
export const screenNo = (k: ScreenKey, skipped: ScreenKey[] = []) => {
  const flow = flowOf(skipped);
  const own = flow.findIndex((s) => s.key === k);
  if (own >= 0) return own + 1;
  let n = 1;
  for (const s of SETUP_SCREENS) {
    if (s.key === k) break;
    const i = flow.findIndex((f) => f.key === s.key);
    if (i >= 0) n = i + 1;
  }
  return n;
};
/** The onboarding's own screens, in order (the products and make pages are their own routes). */
export const ONBOARD_SCREENS = FLOW_SCREENS.filter((s) => s.key !== "make").map((s) => s.key) as Exclude<ScreenKey, "products" | "make">[];
/** The last screen of the walk: "Back" from Make (and Products) returns here when the app has no earlier screen to go back to. */
export const LAST_ONBOARD_SCREEN = ONBOARD_SCREENS[ONBOARD_SCREENS.length - 1];
/** The page the set-up opens from: "Back" from its first screen goes here when the app has no earlier screen to go back to. */
export const SETUP_HOME = "/poster/welcome";
