// Advanced features (owner, 30 Oct 2026): extra modules built for one kind of business — Orders · Silai for tailors,
// boutiques and saree shops first, more trades later. Each is CUSTOMISED for the business and paid separately, so:
//   • it is SHOWN to every account whose business is of a kind it suits (free, Standard, Premium — owner, 31 Oct 2026: "standard
//     aur premium dono ko customise wala option dikhe, use par upgrade maange"): on Premium the button asks the price; on the
//     others it asks to upgrade to Premium first;
//   • it works only once Shubhora has switched it on for that account (Super Admin → Users → "Advanced"), after payment.
// Anyone who wants to stay simple never sees more than one "Advanced features" box. Shared by the app and the server.

export type AddonKey = "orders" | "jewellery";
export type Addon = {
  key: AddonKey; emoji: string; en: string; hi: string; descEn: string; descHi: string; href: string;
  /** what it does, three or four short lines (the locked card shows them so the owner sees what they would get) */
  points: [string, string][];
  /** the public how-it-works page, sent to the owner before they buy */
  guide: string;
  /** poster profile categories (src/lib/poster-categories.ts) it suits */
  categories: string[];
  /** words in the business name / tagline / card that also say it suits */
  words: RegExp;
};

export const ADDONS: Addon[] = [
  {
    key: "orders", emoji: "🧵", en: "Orders & job cards", hi: "Orders · Silai (job card)",
    descEn: "Alteration and stitching orders, measurements, karigars and cloth given / taken back — the customer gets a WhatsApp when it is ready",
    descHi: "Alteration और सिलाई के order, नाप, कारीगर और कपड़े का लेन-देन — तैयार होते ही ग्राहक को WhatsApp",
    href: "/poster/orders",
    points: [
      ["Item first, then its measurements — saved for the next order", "पहले item, फिर उसका नाप — अगले order के लिए save"],
      ["Cutting → stitching → ready: each step goes to the right person", "Cutting → सिलाई → तैयार: हर step सही व्यक्ति के पास"],
      ["The customer gets a WhatsApp when it is ready", "तैयार होते ही ग्राहक को WhatsApp"],
      ["Logins for the master, cutting and stitching staff", "मास्टर, cutting और सिलाई staff के अपने login"],
    ],
    guide: "/help/orders",
    categories: ["tailor", "textile", "garments"],
    // Whole words only: "dress" must not match "address", "suit" not "suitable" (1 Nov 2026).
    words: /\b(tailors?|boutiques?|sarees?|sari|silai|stitch(ing|es)?|garments?|clothing|clothes|fashion|lehengas?|blouses?|textiles?|alterations?|kurtis?|suits?|dress(es)?|dress\s*designer)\b|साड़ी|सिलाई|टेलर|बुटीक|कपड़े/i,
  },
  {
    // Shubhora Jewellery (owner, 23 Nov 2026 — plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK): rate, bills, old gold,
    // orders, karigar, stock, schemes — every part with its own switch, for any jeweller.
    key: "jewellery", emoji: "💍", en: "Jewellery shop (billing, rate, old gold)", hi: "Jewellery shop (बिल, रेट, पुराना सोना)",
    descEn: "Today's rate, GST bills and estimates by weight, old-gold exchange, payments and udhaar — the bill goes to the customer on WhatsApp",
    descHi: "आज का रेट, वज़न से GST बिल और estimate, पुराने सोने का exchange, पेमेंट और उधार — बिल ग्राहक को WhatsApp पर",
    href: "/poster/jewellery",
    points: [
      ["Set today's rate once — every bill and estimate uses it", "आज का रेट एक बार डालें — हर बिल और estimate उसी से"],
      ["Bill by weight: net weight, making, wastage, stones, HUID, 3% GST", "वज़न से बिल: net weight, making, wastage, stone, HUID, 3% GST"],
      ["Old gold exchange by touch, on the same bill", "पुराना सोना touch के हिसाब से, उसी बिल में"],
      ["The bill on the customer's WhatsApp, udhaar with reminders", "बिल ग्राहक के WhatsApp पर, उधार की याद"],
    ],
    guide: "/help/jewellery",
    categories: ["jewellery"],
    words: /\b(jewell?ery|jewell?ers?|jewelry|jeweler|gold\s*smith|goldsmith|sunar|swarn|bullion|hallmark)\b|ज्वेलर्स|ज्वेलरी|सुनार|सर्राफ|स्वर्ण/i,
  },
];

export const addonOf = (key: string) => ADDONS.find((a) => a.key === key) ?? null;

export type AddonState = { key: AddonKey; on: boolean };

/** What the app's "Advanced features" box shows. */
export type AddonsAnswer = {
  premium: boolean;
  /** the advanced features this account may see: suited to its business and the account is Premium (or already switched on) */
  list: (AddonState & { fits: boolean })[];
  /** shops this person works in as a team member (tailor / manager) that have Orders switched on */
  teamOrders: boolean;
  /** shops this person works in as a team member that have Jewellery switched on */
  teamJewellery?: boolean;
};

export const addonWaText = (a: Addon, premium = true) => premium
  ? `Hi Shubhora, I want the advanced feature "${a.en}" customised for my business. Please tell me the price.`
  : `Hi Shubhora, I want the advanced feature "${a.en}" for my business. Please tell me the price with the Premium plan.`;
