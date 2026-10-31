// Advanced features (owner, 30 Oct 2026): extra modules built for one kind of business — Orders · Silai for tailors,
// boutiques and saree shops first, more trades later. Each is CUSTOMISED for the business and paid separately, so:
//   • it is SHOWN to every account whose business is of a kind it suits (free, Standard, Premium — owner, 31 Oct 2026: "standard
//     aur premium dono ko customise wala option dikhe, use par upgrade maange"): on Premium the button asks the price; on the
//     others it asks to upgrade to Premium first;
//   • it works only once Shubhora has switched it on for that account (Super Admin → Users → "Advanced"), after payment.
// Anyone who wants to stay simple never sees more than one "Advanced features" box. Shared by the app and the server.

export type AddonKey = "orders";
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
    words: /tailor|boutique|saree|sari\b|silai|stitch|garment|cloth|fashion|lehenga|blouse|textile|alteration|kurti|suit|dress|साड़ी|सिलाई|टेलर|बुटीक|कपड़े/i,
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
};

export const addonWaText = (a: Addon, premium = true) => premium
  ? `Hi Shubhora, I want the advanced feature "${a.en}" customised for my business. Please tell me the price.`
  : `Hi Shubhora, I want the advanced feature "${a.en}" for my business. Please tell me the price with the Premium plan.`;
