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
    what: { hi: "यहाँ से सब खुलता है — website, card, poster और customers।", en: "Everything opens from here — website, card, poster and customers." },
    steps: [
      { hi: "पहले अपना digital card बनाएँ।", en: "Make your digital card first." },
      { hi: "फिर आज का poster बनाकर WhatsApp पर भेजें।", en: "Then make today's poster and send it on WhatsApp." },
      { hi: "जो आपका link खोलेगा, वह “Customers” में दिखेगा।", en: "Anyone who opens your link shows up in “Customers”." },
    ],
  },
  "/poster/welcome": {
    title: { hi: "शुरू करें", en: "Get started" },
    what: { hi: "आपका account तैयार है। अब अपना digital card बनाइए।", en: "Your account is ready. Now make your digital card." },
    steps: [
      { hi: "“Card अभी बनाएँ” दबाएँ।", en: "Tap “Make my card now”." },
      { hi: "अभी नहीं? “Later” दबाएँ — बाद में Home से शुरू कर सकते हैं।", en: "Not now? Tap “Later” — you can start from Home any time." },
    ],
  },
  "/poster/onboard": {
    title: { hi: "आपकी जानकारी", en: "Your details" },
    what: { hi: "एक बार भरें। इसी से आपकी website, card और poster बनते हैं।", en: "Fill it once. Your website, card and posters are made from it." },
    steps: [
      { hi: "हर screen पर थोड़ा भरें और “Next” दबाएँ।", en: "Fill a little on each screen and tap “Next”." },
      { hi: "आपका काम, नाम और शहर ज़रूर लिखें।", en: "Your trade, name and city are a must." },
      { hi: "जवाब अपने-आप save होते हैं। कभी भी वापस आ सकते हैं।", en: "Answers save by themselves. You can come back any time." },
    ],
    mistake: { hi: "किसी और की website को “मेरी अपनी” बताना। उसका नाम और सामान आपके card पर आ जाएगा।", en: "Calling someone else's website “my own”. Their name and products will land on your card." },
    video: CARD_VIDEO,
  },
  "/poster/card/build": {
    title: { hi: "Website बनाना", en: "Making your website" },
    what: { hi: "आपकी जानकारी से AI आपकी website और card बना देता है।", en: "The AI makes your website and card from your details." },
    steps: [
      { hi: "“बनाएँ” दबाएँ और करीब 1 मिनट रुकें।", en: "Tap make and wait about a minute." },
      { hi: "छह design में से एक चुनें और देख लें।", en: "Pick one of the six designs and look it over." },
      { hi: "“Save and next” दबाएँ — तब website live होती है।", en: "Tap “Save and next” — that is when the website goes live." },
    ],
    mistake: { hi: "देखकर रुक जाना। “Save and next” दबाए बिना कुछ live नहीं होता।", en: "Stopping after the preview. Nothing is live until you tap “Save and next”." },
    video: CARD_VIDEO,
  },
  "/poster/card/looks": {
    title: { hi: "Card का design", en: "Card design" },
    what: { hi: "वही card, अलग-अलग रंग-रूप में।", en: "The same card in different looks." },
    steps: [
      { hi: "कोई भी design दबाकर देखें।", en: "Tap any design to see it." },
      { hi: "पसंद आए तो save करें।", en: "Save the one you like." },
    ],
  },
  "/poster/card": {
    title: { hi: "मेरा card", en: "My card" },
    what: { hi: "आपका live card। यहाँ से link भेजें और QR लें।", en: "Your live card. Send the link and get the QR from here." },
    steps: [
      { hi: "हरे बटन से link WhatsApp पर भेजें।", en: "Use the green button to send the link on WhatsApp." },
      { hi: "कुछ बदलना हो तो “Card & Website” में जाएँ।", en: "To change something, go to “Card & Website”." },
      { hi: "QR print करके दुकान पर लगाएँ।", en: "Print the QR and put it up at your shop." },
    ],
    mistake: { hi: "link सिर्फ़ एक बार भेजना। उसे WhatsApp status और visiting card पर भी रखें।", en: "Sending the link only once. Keep it on your WhatsApp status and visiting card too." },
    video: CARD_VIDEO,
  },
  "/poster/products": {
    title: { hi: "आपके products", en: "Your products" },
    what: { hi: "जो आप बेचते हैं — नाम, दाम और photo। ये website, card और poster पर दिखते हैं।", en: "What you sell — name, price and photo. They show on your website, card and posters." },
    steps: [
      { hi: "बहुत हों तो “एक साथ जोड़ें” दबाएँ। लिस्ट लिखें या रेट-लिस्ट की photo दें।", en: "Many items? Tap “Add many at once”. Type a list or give a price-list photo." },
      { hi: "Photo नहीं है? “Picture खोजें” या “AI से बनाएँ” दबाएँ (1 credit)।", en: "No photo? Tap “Find a picture” or “Make by AI” (1 credit)." },
      { hi: "दाम ज़रूर लिखें।", en: "Always write the price." },
    ],
    mistake: { hi: "दाम खाली छोड़ना। दाम देखकर ही ग्राहक WhatsApp करता है।", en: "Leaving the price empty. Customers message you after seeing the price." },
  },
  "/poster/site/seo": {
    title: { hi: "Google पर दिखें", en: "Show on Google" },
    what: { hi: "लोग आपका काम और शहर खोजें तो आप मिलें।", en: "So people who search your trade and city find you." },
    steps: [
      { hi: "अपना शहर और जिन इलाक़ों में सेवा देते हैं, वे लिखें।", en: "Write your city and the areas you serve." },
      { hi: "बाक़ी सब अपने-आप होता है। “Save” दबाएँ।", en: "The rest is done for you. Tap “Save”." },
    ],
    mistake: { hi: "Google पर दिखना सिर्फ़ subscription वाली website का है।", en: "Showing on Google is only for a website with a subscription." },
  },
  "/poster/site": {
    title: { hi: "Card और website", en: "Card & website" },
    what: { hi: "आपकी एक website और एक card — एक ही link। computer पर website खुलती है, phone पर card।", en: "One website and one card — one link. A computer opens the website, a phone opens the card." },
    steps: [
      { hi: "“Edit” में जो बदलना है उस पर दबाएँ।", en: "In “Edit”, tap what you want to change." },
      { hi: "Save करते ही बदलाव आपकी website पर आ जाता है।", en: "A change appears on your website as soon as you save." },
      { hi: "अपना link दोस्तों और ग्राहकों को भेजें।", en: "Send your link to friends and customers." },
    ],
    mistake: { hi: "card और website को दो अलग चीज़ें समझना। दोनों एक ही हैं — बदलाव दोनों में आता है।", en: "Thinking the card and website are two things. They are one — a change shows on both." },
  },
  "/poster/website/edit": {
    title: { hi: "Website बदलें", en: "Edit the website" },
    what: { hi: "रंग, अक्षर, ऊपर का हिस्सा, sections और pages यहाँ बदलें।", en: "Change colours, letters, the top of the page, sections and pages here." },
    steps: [
      { hi: "ऊपर के चार tab में से चुनें और बदलें।", en: "Pick one of the four tabs at the top and change it." },
      { hi: "नीचे “Save” दबाएँ।", en: "Tap “Save” at the bottom." },
    ],
    mistake: { hi: "Save भूल जाना। Save के बाद ही बदलाव live होता है।", en: "Forgetting to save. A change goes live only after Save." },
  },
  "/poster/ai": {
    title: { hi: "AI Training", en: "AI Training" },
    what: { hi: "AI को सिखाएँ कि वह क्या जाने और आपके लिए क्या करे।", en: "Teach the AI what to know and what to do for you." },
    steps: [
      { hi: "अपनी website, brochure या video का link दें।", en: "Give your website, brochure or video link." },
      { hi: "बोलकर या लिखकर website में बदलाव करवाएँ।", en: "Ask for website changes by speaking or typing." },
      { hi: "WhatsApp जोड़ें ताकि AI ग्राहकों को जवाब दे।", en: "Connect WhatsApp so the AI can reply to customers." },
    ],
  },
  "/poster/leads": {
    title: { hi: "Customers", en: "Customers" },
    what: { hi: "जिसने भी आपका card खोला या call और WhatsApp दबाया — सब यहाँ है।", en: "Everyone who opened your card or tapped call or WhatsApp is here." },
    steps: [
      { hi: "हर नाम खोलकर देखें उसने क्या पूछा।", en: "Open each name to see what they asked." },
      { hi: "फिर बात करने की तारीख़ लगाएँ। app याद दिलाएगा।", en: "Set a date to follow up. The app will remind you." },
    ],
    mistake: { hi: "देखकर छोड़ देना। जो एक दिन में जवाब देता है, उसी को काम मिलता है।", en: "Reading and leaving it. The one who replies within a day gets the order." },
  },
  "/poster/create": {
    title: { hi: "आज का poster", en: "Today's poster" },
    what: { hi: "रोज़ का त्यौहार या शुभकामना poster — आपके नाम, photo और number के साथ।", en: "The day's festival or greeting poster — with your name, photo and number." },
    steps: [
      { hi: "एक design चुनें।", en: "Pick a design." },
      { hi: "“WhatsApp पर भेजें” दबाएँ। नाम और number पहले से लगे हैं।", en: "Tap send on WhatsApp. Your name and number are already on it." },
    ],
  },
  "/poster/social": {
    title: { hi: "Social media", en: "Social media" },
    what: { hi: "Facebook और Instagram जोड़ें तो poster रोज़ अपने-आप post हो सकता है।", en: "Connect Facebook and Instagram and the poster can post itself every day." },
    steps: [
      { hi: "“जोड़ें” दबाएँ, login करें और अपना Page चुनें।", en: "Tap connect, log in and pick your Page." },
      { hi: "रोज़ अपने-आप post करना है या नहीं, वह switch यहीं है।", en: "The switch for daily auto-posting is here." },
    ],
    mistake: { hi: "अपनी personal profile जोड़ना। Facebook सिर्फ़ Page जोड़ने देता है। पहले Page बनाएँ।", en: "Trying to add a personal profile. Facebook allows only a Page. Make a Page first." },
  },
  "/poster/connect": {
    title: { hi: "जोड़ने की जगह", en: "Connections" },
    what: { hi: "WhatsApp, Facebook, Google और अपना web address यहाँ जोड़ें।", en: "Connect WhatsApp, Facebook, Google and your own web address here." },
    steps: [
      { hi: "WhatsApp जोड़ें ताकि AI आपके number पर जवाब दे।", en: "Connect WhatsApp so the AI can reply on your number." },
      { hi: "QR को phone से scan करें, जैसे WhatsApp Web में करते हैं।", en: "Scan the QR with your phone, like WhatsApp Web." },
    ],
    mistake: { hi: "scan करके WhatsApp से logout कर देना। जुड़ाव टूट जाता है।", en: "Logging out of WhatsApp after scanning. The connection breaks." },
  },
  "/poster/more": {
    title: { hi: "मेरा खाता", en: "My account" },
    what: { hi: "आपका नाम, plan और credits यहाँ हैं।", en: "Your name, plan and credits are here." },
    steps: [
      { hi: "ऊपर “Edit name / mobile” से नाम या number बदलें।", en: "Change your name or number with “Edit name / mobile”." },
      { hi: "“Plan” दबाकर subscription देखें या लें।", en: "Tap the plan to see or take a subscription." },
      { hi: "“Add credits” से AI के लिए credits लें।", en: "Use “Add credits” for AI work." },
    ],
  },
  "/poster/plan": {
    title: { hi: "आपका plan", en: "Your plan" },
    what: { hi: "Free में website और card हैं। Subscription में Google पर दिखना, AI और WhatsApp AI भी मिलते हैं।", en: "Free gives a website and card. A subscription adds showing on Google, AI and WhatsApp AI." },
    steps: [
      { hi: "देखें कौन-सा plan चल रहा है और कब तक।", en: "See which plan is running and until when." },
      { hi: "Subscription लेनी हो तो यहीं से Razorpay से भरें।", en: "To subscribe, pay here with Razorpay." },
    ],
  },
  "/poster/testimonials": {
    title: { hi: "ग्राहकों की राय", en: "Customer reviews" },
    what: { hi: "ग्राहक क्या कहते हैं — इससे सबसे ज़्यादा भरोसा बनता है।", en: "What customers say. Nothing builds more trust." },
    steps: [
      { hi: "अपने 3–4 पुराने ग्राहकों से एक-एक लाइन माँगें और यहाँ जोड़ें।", en: "Ask 3–4 past customers for a line each and add them here." },
    ],
  },
  "/poster/share": {
    title: { hi: "Share करें", en: "Share" },
    what: { hi: "आपका link, QR और जुड़ने के links एक जगह।", en: "Your link, QR and joining links in one place." },
    steps: [
      { hi: "अपना card link ग्राहकों को भेजें।", en: "Send your card link to customers." },
      { hi: "जुड़ने वाला link सिर्फ़ उन्हें भेजें जिन्हें partner बनाना है।", en: "Send the joining link only to people you want as partners." },
    ],
    mistake: { hi: "दोनों link मिला देना। ग्राहक को जुड़ने वाला link न जाए।", en: "Mixing the two links. A customer must not get the joining link." },
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
  { path: "/poster/site/seo", label: "Show on Google" },
  { path: "/poster/ai", label: "AI Training" },
  { path: "/poster/create", label: "Today's poster" },
  { path: "/poster/social", label: "Social media" },
  { path: "/poster/connect", label: "Connections (WhatsApp…)" },
  { path: "/poster/leads", label: "Leads" },
  { path: "/poster/share", label: "Share my links" },
  { path: "/poster/plan", label: "Plan and payment" },
];
