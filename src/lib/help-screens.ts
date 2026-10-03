// What to do on this screen — in the person's own words.
//
// Owner's call, 1 Oct 2026: however clever someone is, the first card and the first website are new to them,
// and the one-line Guide box at the top of a screen is not enough when they are actually stuck. Every screen
// now has a Help button that opens this: what this screen is for, the two or three steps on it, and the
// mistake people usually make here.
//
// The same entry names the screen for the staff console (/admin/support), so a staff member helping over the
// phone can see "they are on Products, step 2" instead of a bare path.

/** A phrase in both languages — the app shows one, the staff console always shows the English. */
export type Bi = { hi: string; en: string };

export type HelpScreen = {
  title: Bi;
  /** One sentence: why this screen exists. */
  what: Bi;
  /** The actual steps on this screen, in order. Two or three — not a manual. */
  steps: Bi[];
  /** The thing people get wrong here. Left out when there isn't one worth naming. */
  mistake?: Bi;
  /** A video that shows this part. */
  video?: string;
};

/** The Hindi card tutorial (5 minutes) — the one shared whenever someone asks how to make a card. */
const CARD_VIDEO = "https://www.facebook.com/reel/1078388548446035/";

/** Longest-prefix match, so /poster/card/build wins over /poster/card. */
const SCREENS: Record<string, HelpScreen> = {
  "/poster": {
    title: { hi: "आपका app", en: "Your app" },
    what: { hi: "यहाँ से सब कुछ खुलता है — आज का poster, आपका card, website, leads और plan।", en: "Everything opens from here — today's poster, your card, website, leads and plan." },
    steps: [
      { hi: "सबसे पहले अपनी website बनाएँ — उसी से आपका card भी बन जाता है।", en: "Build your website first — your card comes from it." },
      { hi: "फिर आज का poster बनाकर WhatsApp पर share करें।", en: "Then make today's poster and share it on WhatsApp." },
      { hi: "जो भी आपका link खोलेगा, उसकी lead “Leads” में आ जाएगी।", en: "Anyone who opens your link shows up under “Leads”." },
    ],
  },
  "/poster/onboard": {
    title: { hi: "शुरुआती जानकारी", en: "Set-up" },
    what: { hi: "ये जानकारी एक बार भरनी है — इसी से आपका card, website और रोज़ के poster बनते हैं।", en: "Filled in once — your card, website and daily posters are all made from it." },
    steps: [
      { hi: "नाम, mobile, photo — sign-up से आ जाता है; बस photo जोड़ लें।", en: "Name, mobile, photo — already there from sign-up; just add the photo." },
      { hi: "चुनें card किसलिए है — अपना business, Shubhora, या दोनों।", en: "Choose what the card is for — your business, Shubhora, or both." },
      { hi: "Website है? है तो link दें — dealer हैं तो company की, पसंद की हो तो “जैसी”; नहीं है तो ❌ दबाएँ।", en: "Have a website? Give the link — the brand's if you are its dealer, one you like for its look; tap ❌ if none." },
      { hi: "काम, नाम, शहर — बाकी website से भर जाता है। देखें, ठीक करें, Save।", en: "Trade, name, city — the rest fills from the website. Check, fix, Save." },
    ],
    mistake: { hi: "पसंद की या competitor की website को “मेरी अपनी” बता देना — उसका नाम, logo, products आपके card पर आ जाते हैं। पसंद की site = सिर्फ़ look। Instagram page website नहीं है।", en: "Calling a site you merely like (or a competitor's) “my own” — its name, logo and products land on your card. A liked site = look only. An Instagram page is not a website." },
    video: CARD_VIDEO,
  },
  "/poster/card/build": {
    title: { hi: "AI से website बनाना", en: "Building the website with AI" },
    what: { hi: "आपकी जानकारी से AI पूरी website लिख देता है — about, services, products, FAQ सब। उसी link से phone पर आपका card बन जाता है। आपको सिर्फ़ देखना और ठीक करना है।", en: "The AI writes your whole website from your details — about, services, products, FAQ. The same link is your card on a phone. You only look it over and fix what's off." },
    steps: [
      { hi: "सवालों के जवाब भरें — जितना सही भरेंगे, card उतना अच्छा बनेगा। Products website से आए हों तो यहाँ दोबारा नहीं भरने।", en: "Answer the questions — the better they are, the better the card. Products that came from your website need not be typed again." },
      { hi: "“बनाएँ” दबाकर रुकें — आम तौर पर 30 second, website दी हो तो 1-2 मिनट — फिर preview देखें।", en: "Tap build and wait — about 30 seconds, 1-2 minutes when a website is being read — then look at the preview." },
      { hi: "ठीक लगे तो Publish — website live, और card भी उसी के साथ।", en: "Happy with it? Publish — the website goes live, and the card with it." },
    ],
    mistake: { hi: "preview देखकर Publish दबाना भूल जाना — बिना Publish किए कुछ live नहीं होता।", en: "Looking at the preview and forgetting to Publish — nothing is live until you do." },
    video: CARD_VIDEO,
  },
  "/poster/card/looks": {
    title: { hi: "Card का look", en: "How the card looks" },
    what: { hi: "वही card, 12 अलग design में। content वही रहता है, सिर्फ़ रंग-रूप बदलता है।", en: "The same card in 12 designs. The content stays; only the look changes." },
    steps: [
      { hi: "कोई भी look दबाकर देखें — तुरंत preview बदल जाएगा।", en: "Tap any look — the preview changes at once." },
      { hi: "पसंद आए तो save करें।", en: "Save the one you like." },
    ],
  },
  "/poster/card": {
    title: { hi: "मेरा V-Card", en: "My V-Card" },
    what: { hi: "आपका live card — यहीं से link share करें, QR लें, और card बदलें।", en: "Your live card — share the link, get the QR, and change the card from here." },
    steps: [
      { hi: "हरा button दबाकर link WhatsApp पर share करें।", en: "Tap the green button to share the link on WhatsApp." },
      { hi: "“Card edit करें” से कुछ भी बदलें — नाम, photo, products, pages।", en: "“Edit card” changes anything — name, photo, products, pages." },
      { hi: "QR नीचे है — उसे print करके दुकान पर लगा सकते हैं।", en: "The QR is below — print it and put it up at your shop." },
    ],
    mistake: { hi: "link को सिर्फ़ एक बार share करना। इसे bio में, WhatsApp status पर और visiting card पर QR बनाकर रखें।", en: "Sharing the link only once. Put it in your bio, on your WhatsApp status, and as a QR on your visiting card." },
    video: CARD_VIDEO,
  },
  "/poster/products": {
    title: { hi: "आपके products", en: "Your products" },
    what: { hi: "जो आप बेचते हैं — photo, price और एक लाइन। यही card पर और poster में आते हैं।", en: "What you sell — photo, price and a line. These go on the card and into posters." },
    steps: [
      { hi: "“जोड़ें” दबाकर नाम, price और photo डालें।", en: "Tap add, then put in the name, price and photo." },
      { hi: "कम से कम 3 products डालें — card तभी भरा-भरा लगता है।", en: "Add at least 3 — the card looks empty with fewer." },
    ],
    mistake: { hi: "price खाली छोड़ना। Price देखकर ही customer WhatsApp करता है।", en: "Leaving the price empty. The price is what makes a customer message you." },
  },
  "/poster/site": {
    title: { hi: "आपकी website", en: "Your website" },
    what: { hi: "ये आपकी website है। computer पर यही link पूरी website खोलता है, phone पर यही आपका card बन जाता है।", en: "This is your website. On a computer this link opens the full site; on a phone the same link is your card." },
    steps: [
      { hi: "“Website देखें” से देखें कि computer पर कैसी दिखती है।", en: "“See the website” shows how it opens on a computer." },
      { hi: "“Website edit करें” — रंग, fonts, hero, sections का क्रम, pages।", en: "“Edit the website” — colours, fonts, hero, section order, pages." },
      { hi: "Text, products, photos बदलने हों तो “Card edit करें” — वो दोनों जगह बदलते हैं।", en: "To change text, products or photos use “Edit card” — they change in both." },
    ],
    mistake: { hi: "ये समझना कि card और website अलग-अलग हैं। एक ही link, एक ही data — बस phone पर card, computer पर website।", en: "Thinking the card and the website are two things. One link, one set of data — a card on a phone, a website on a computer." },
  },
  "/poster/leads": {
    title: { hi: "Leads", en: "Leads" },
    what: { hi: "जिसने भी आपका card खोला, call या WhatsApp दबाया — सब यहाँ नाम के साथ सुरक्षित है।", en: "Everyone who opened your card or tapped call or WhatsApp — saved here with their name." },
    steps: [
      { hi: "हर lead खोलकर देखें उसने क्या पूछा।", en: "Open a lead to see what they asked about." },
      { hi: "follow-up की तारीख़ लगाएँ — app याद दिला देगा।", en: "Set a follow-up date — the app will remind you." },
    ],
    mistake: { hi: "leads को देखकर छोड़ देना। जो 24 घंटे में जवाब देता है, उसी का सौदा होता है।", en: "Reading leads and leaving them. The one who replies within a day is the one who gets the business." },
  },
  "/poster/create": {
    title: { hi: "आज का poster", en: "Today's poster" },
    what: { hi: "रोज़ का त्यौहार या greeting poster — आपके नाम, photo और number के साथ।", en: "The day's festival or greeting poster — with your name, photo and number." },
    steps: [
      { hi: "कोई design चुनें।", en: "Pick a design." },
      { hi: "“WhatsApp पर share” दबाएँ — नाम और number अपने आप लगे होंगे।", en: "Tap share on WhatsApp — your name and number are already on it." },
    ],
  },
  "/poster/social": {
    title: { hi: "Social media", en: "Social media" },
    what: { hi: "Facebook और Instagram जोड़ दें तो poster अपने आप रोज़ post हो सकता है।", en: "Connect Facebook and Instagram and the poster can post itself every day." },
    steps: [
      { hi: "“Facebook Page जोड़ें” दबाकर login करें और अपना Page चुनें।", en: "Tap connect, log in, and pick your Page." },
      { hi: "रोज़ अपने आप post करना है या नहीं — वो switch यहीं है।", en: "The switch for posting automatically every day is here." },
    ],
    mistake: { hi: "अपनी personal profile जोड़ने की कोशिश करना। Facebook सिर्फ़ Page जोड़ने देता है — Page पहले बनाना होगा।", en: "Trying to connect a personal profile. Facebook only allows a Page — make the Page first." },
  },
  "/poster/connect": {
    title: { hi: "Connections", en: "Connections" },
    what: { hi: "WhatsApp, Facebook, Google और अपना domain — सब जोड़ने की जगह।", en: "WhatsApp, Facebook, Google and your own domain — all connected from here." },
    steps: [
      { hi: "WhatsApp जोड़ें ताकि AI आपके number पर जवाब दे सके।", en: "Connect WhatsApp so the AI can reply on your number." },
      { hi: "QR phone से scan करें — वैसे ही जैसे WhatsApp Web में।", en: "Scan the QR with your phone, exactly like WhatsApp Web." },
    ],
    mistake: { hi: "QR scan करके WhatsApp से logout कर देना — connection टूट जाता है।", en: "Logging out of WhatsApp after scanning — that breaks the connection." },
  },
  "/poster/plan": {
    title: { hi: "आपका plan", en: "Your plan" },
    what: { hi: "Card और leads पहले साल free हैं। Website, AI assistant और रोज़ के poster Growth में आते हैं।", en: "The card and leads are free for the first year. The website, AI assistant and daily posters come with Growth." },
    steps: [
      { hi: "देखें कौन सा plan चल रहा है और कब तक।", en: "See which plan is running and until when." },
      { hi: "Growth चालू करना हो तो यहीं से payment करें।", en: "Turn Growth on and pay from here." },
    ],
  },
  "/poster/testimonials": {
    title: { hi: "Customer reviews", en: "Customer reviews" },
    what: { hi: "आपके customers की बात — card पर सबसे ज़्यादा भरोसा यही बनाते हैं।", en: "What your customers say — nothing on the card builds more trust." },
    steps: [
      { hi: "अपने 3-4 पुराने customers से एक-एक लाइन माँगकर यहाँ डालें।", en: "Ask three or four past customers for a line each and add them." },
    ],
  },
  "/poster/share": {
    title: { hi: "Share", en: "Share" },
    what: { hi: "आपका card link, QR और जुड़ने वाले links — सब एक जगह।", en: "Your card link, QR and joining links — all in one place." },
    steps: [
      { hi: "Card link customers को भेजें।", en: "Send the card link to customers." },
      { hi: "जुड़ने वाले link सिर्फ़ उन्हें भेजें जिन्हें partner बनाना है।", en: "Send the joining links only to people you want as partners." },
    ],
    mistake: { hi: "दोनों link आपस में मिला देना — customer को जुड़ने वाला link नहीं जाना चाहिए।", en: "Mixing the two up — a customer should never get the joining link." },
  },
};

/** The screen the person is on. Falls back to the closest parent, then to nothing. */
export function helpFor(path: string): HelpScreen | null {
  const clean = (path || "").split("?")[0].replace(/\/+$/, "") || "/poster";
  let best: HelpScreen | null = null;
  let bestLen = -1;
  for (const [prefix, screen] of Object.entries(SCREENS)) {
    if ((clean === prefix || clean.startsWith(`${prefix}/`)) && prefix.length > bestLen) { best = screen; bestLen = prefix.length; }
  }
  return best;
}

/** A short name for the screen, for the staff console and the session list. */
export function screenName(path: string): string {
  if (/^\/poster\/d\//.test(path || "")) return "Card editor";
  return helpFor(path)?.title.en ?? (path || "—");
}

/** The screens a staff member can send someone to, in the order people normally go through them.
 *  Only screens that exist here, so "send them to…" can never point at nothing. */
export const GUIDE_TARGETS: { path: string; label: string }[] = [
  { path: "/poster", label: "App home" },
  { path: "/poster/onboard", label: "Set-up (name, business)" },
  { path: "/poster/card/build", label: "Build the card with AI" },
  { path: "/poster/card", label: "My V-Card (share, QR)" },
  { path: "/poster/card/looks", label: "Card looks" },
  { path: "/poster/products", label: "Products" },
  { path: "/poster/testimonials", label: "Customer reviews" },
  { path: "/poster/site", label: "Card & Website" },
  { path: "/poster/create", label: "Today's poster" },
  { path: "/poster/social", label: "Social media" },
  { path: "/poster/connect", label: "Connections (WhatsApp…)" },
  { path: "/poster/leads", label: "Leads" },
  { path: "/poster/share", label: "Share my links" },
  { path: "/poster/plan", label: "Plan and payment" },
];
