// The Shubhora partner assistant's numbered menu (owner, 28 Nov 2026): a hello gets the menu, a number gets that option's
// fixed answer, and the AI answers only what falls outside it.
//
// Three layers, the first one that has a value wins, per item and per link:
//   1. the partner's own change (card.botMenu — AI Training → "मेरा मेनू"),
//   2. Shubhora's text set in Super Admin → Shubhora AI → Menu (platform_settings.shubhora_menu),
//   3. the built-in text below.
// An empty value always falls through, so a deploy that improves the built-in text still reaches everyone who did not
// change that item. Nothing is copied into the card: a change in Super Admin reaches every partner within 5 minutes.
//
// Plain JS on purpose: the WhatsApp bridge is not compiled; the app imports the same file (card chat, admin, AI Training).

/** Placeholders a reply may use. A line whose placeholder has no value (e.g. no PDF on this number) is left out. */
export const MENU_PLACEHOLDERS = ["join", "tutorial", "productVideo", "planVideo", "pdf", "card", "seller"];

/** The Shubhora links every partner's assistant may send (built-in values; Super Admin and the partner may change each). */
export const MENU_LINKS = [
  { key: "pdf", hi: "Shubhora presentation PDF", en: "Shubhora presentation PDF", def: "/api/stock/demo/shubhora-presentation-2026-11.pdf" },
  { key: "productVideo", hi: "Shubhora वीडियो (3½ मिनट)", en: "Shubhora video (3½ min)", def: "https://youtu.be/kQuN3OVBNl0" },
  { key: "planVideo", hi: "Direct Selling Plan वीडियो", en: "Direct Selling Plan video", def: "https://drive.google.com/file/d/13Ab-g716FSCNmj4UkYk7jClcgM8eo07w/view" },
  { key: "tutorial", hi: "स्टेप-बाय-स्टेप वीडियो", en: "Step-by-step video", def: "https://www.facebook.com/reel/1078388548446035/" },
];

/** The options, in menu order. `partner: true` = left out when the seller switched the partner programme off.
 *  `call: true` = not a fixed text: the partner is told and the customer gets the call line. */
export const MENU_ITEMS = [
  {
    id: "website",
    title: { hi: "वेबसाइट + डिजिटल V-Card", en: "Website + digital V-Card" },
    chip: { hi: "वेबसाइट + V-Card", en: "Website + V-Card" },
    reply: {
      hi: [
        "आपकी अपनी वेबसाइट और डिजिटल V-Card — दोनों एक लिंक पर, QR के साथ 🎉",
        "• 12 डिज़ाइन में से अपनी पसंद का — 24 से 48 घंटे में तैयार",
        "• फोटो, रेट, प्रोडक्ट खुद बदलिए · WhatsApp पर ऑर्डर",
        "• Website Standard ₹2,999 साल (GST सहित) — रोज़ ₹10 से भी कम",
        "• Website Premium ₹5,999 साल — पूरा SEO, वेबसाइट पर AI चैट, फोन में ऐप जैसी, और Growth Plan का पहला महीना फ्री",
        "",
        "यहाँ से शुरू कीजिए 👉 {join}",
        "स्टेप-बाय-स्टेप वीडियो: {tutorial}",
        "बन जाए तो लिंक यहाँ भेजिए — मैं चेक करके बताऊँगा कि और अच्छा कैसे बने।",
      ].join("\n"),
      en: [
        "Your own website and digital V-Card — both on one link, with a QR 🎉",
        "• Pick any of 12 designs — ready within 24 to 48 hours",
        "• Change photos, prices and products yourself · orders on WhatsApp",
        "• Website Standard ₹2,999 a year (GST included) — less than ₹10 a day",
        "• Website Premium ₹5,999 a year — complete SEO, AI chat on the website, installs like an app, and the Growth Plan's 1st month free",
        "",
        "Start here 👉 {join}",
        "Step-by-step video: {tutorial}",
        "Once it's ready, send me the link — I'll check it and tell you how to make it even better.",
      ].join("\n"),
    },
  },
  {
    id: "growth",
    title: { hi: "Growth Plan (सब कुछ एक साथ)", en: "Growth Plan (everything together)" },
    chip: { hi: "Growth Plan", en: "Growth Plan" },
    reply: {
      hi: [
        "Growth Plan — आपकी पूरी ऑनलाइन मार्केटिंग, ₹2,999 महीना (GST सहित) 🚀",
        "• रोज़ नया पोस्टर — Facebook / Instagram पर अपने-आप पोस्ट",
        "• WhatsApp पर 24×7 AI जवाब",
        "• CRM — हर लीड और फॉलो-अप एक जगह",
        "• Google रिव्यू के जवाब और पोस्ट",
        "• WhatsApp ब्रॉडकास्ट + महीने की रिपोर्ट",
        "अलग-अलग लें तो ₹4,696 महीना — Growth Plan में सब ₹2,999 में। Website Premium के साथ पहला महीना फ्री।",
        "",
        "3½ मिनट में पूरा देखिए: {productVideo}",
        "शुरू कीजिए 👉 {join}",
      ].join("\n"),
      en: [
        "Growth Plan — your whole online marketing for ₹2,999 a month (GST included) 🚀",
        "• A new poster every day — auto-posted to Facebook / Instagram",
        "• 24×7 AI replies on WhatsApp",
        "• CRM — every lead and follow-up in one place",
        "• Google review replies and posts",
        "• WhatsApp broadcasts + a monthly report",
        "Taken one by one it is ₹4,696 a month — the Growth Plan gives it all for ₹2,999. 1st month free with Website Premium.",
        "",
        "See it all in 3½ minutes: {productVideo}",
        "Start here 👉 {join}",
      ].join("\n"),
    },
  },
  {
    id: "software",
    title: { hi: "कस्टम सॉफ्टवेयर और ऑटोमेशन", en: "Custom software & automation" },
    chip: { hi: "कस्टम सॉफ्टवेयर", en: "Custom software" },
    reply: {
      hi: [
        "आपके काम के हिसाब से कोई भी सॉफ्टवेयर — Shubhora बनाकर देता है:",
        "• मोबाइल ऐप या वेबसाइट",
        "• CRM / ERP, बिलिंग, डैशबोर्ड",
        "• WhatsApp, लीड और फॉलो-अप का ऑटोमेशन",
        "• AI चैटबॉट, Tally / पेमेंट / Google Sheets इंटीग्रेशन",
        "साथ में एक डेडिकेटेड अकाउंट मैनेजर।",
        "",
        "आपको क्या बनवाना है — थोड़ा बताइए, तो आपके लिए सही सॉल्यूशन बताता हूँ।",
      ].join("\n"),
      en: [
        "Any software your work needs — Shubhora builds it for you:",
        "• A mobile app or website",
        "• CRM / ERP, billing, dashboards",
        "• Automation for WhatsApp, leads and follow-ups",
        "• AI chatbots, Tally / payment / Google Sheets integrations",
        "With a dedicated account manager.",
        "",
        "What would you like built? Tell me a little and I'll suggest the right solution.",
      ].join("\n"),
    },
  },
  {
    id: "whatsapp",
    title: { hi: "WhatsApp AI 24×7", en: "WhatsApp AI 24×7" },
    chip: { hi: "WhatsApp AI", en: "WhatsApp AI" },
    reply: {
      hi: [
        "WhatsApp AI असिस्टेंट — आपके अपने नंबर से 24×7 जवाब 🤖",
        "• रेट, टाइमिंग, लोकेशन, बुकिंग — सिर्फ आपकी दी हुई जानकारी से",
        "• हर चैट लीड बनती है; कोई कॉल माँगे तो आपको तुरंत अलर्ट",
        "• हिंदी, English और दूसरी भारतीय भाषाओं में",
        "• आप खुद भी उसी नंबर पर नॉर्मल चैट करते रहिए",
        "अकेला ₹1,499 महीना — या Growth Plan (₹2,999) में ये + रोज़ पोस्टर + CRM + Google + ब्रॉडकास्ट, सब साथ।",
        "",
        "शुरू कीजिए 👉 {join}",
      ].join("\n"),
      en: [
        "WhatsApp AI assistant — 24×7 replies from your own number 🤖",
        "• Prices, timings, location, bookings — only from what you have told it",
        "• Every chat becomes a lead; you get an alert the moment someone wants a call",
        "• In Hindi, English and other Indian languages",
        "• You keep chatting normally on the same number",
        "₹1,499 a month on its own — or the Growth Plan (₹2,999) gives this + daily posters + CRM + Google + broadcasts, all together.",
        "",
        "Start here 👉 {join}",
      ].join("\n"),
    },
  },
  {
    id: "crm",
    title: { hi: "CRM", en: "CRM" },
    chip: { hi: "CRM", en: "CRM" },
    reply: {
      hi: [
        "CRM — हर कस्टमर और लीड एक जगह 📋",
        "• कॉल, WhatsApp, कार्ड, फॉर्म — हर लीड अपने-आप सेव",
        "• फॉलो-अप रिमाइंडर, एक टैप में कॉल या WhatsApp",
        "• पाइपलाइन, टास्क और रिपोर्ट",
        "अकेला ₹999 महीना — या Growth Plan (₹2,999) में ये + WhatsApp AI + रोज़ पोस्टर + Google, सब साथ।",
        "टीम के लॉगिन या अपना अलग CRM चाहिए तो 3 भेजिए।",
        "",
        "शुरू कीजिए 👉 {join}",
      ].join("\n"),
      en: [
        "CRM — every customer and lead in one place 📋",
        "• Calls, WhatsApp, card, forms — every lead saved by itself",
        "• Follow-up reminders, call or WhatsApp in one tap",
        "• Pipeline, tasks and reports",
        "₹999 a month on its own — or the Growth Plan (₹2,999) gives this + WhatsApp AI + daily posters + Google, all together.",
        "Need logins for your team or a CRM of your own? Send 3.",
        "",
        "Start here 👉 {join}",
      ].join("\n"),
    },
  },
  {
    id: "direct",
    partner: true,
    title: { hi: "Direct Selling Plan", en: "Direct Selling Plan" },
    chip: { hi: "Direct Selling Plan", en: "Direct Selling Plan" },
    reply: {
      hi: [
        "Shubhora Direct Selling Plan — अपने फोन से, अपने शहर में, अपना बिज़नेस 💼",
        "आज हर दुकान, डॉक्टर और कोचिंग को ऑनलाइन दिखना है — आप उन्हें Shubhora दिलाते हैं। कोई स्टॉक नहीं, रजिस्ट्रेशन फ्री; अपना Website प्लान चालू करते ही ID ग्रीन।",
        "कमाई के 5 तरीके: Direct Bonus 10% · Matching Bonus 10% · Sponsor Bonus (5 लेवल) · Renewal Income · 17 Rank Rewards। रोज़ 2 क्लोज़िंग, पेमेंट हर बुधवार।",
        "",
        "प्लान का वीडियो (हिंदी): {planVideo}",
        "पूरी डिटेल नीचे PDF में है 👇",
        "",
        "फ्री रजिस्ट्रेशन यहाँ से 👉 {join}",
        "रजिस्ट्रेशन में कोई दिक्कत आए तो बताइए — मैं मदद करता हूँ।",
        "[MEDIA] {pdf}",
      ].join("\n"),
      en: [
        "Shubhora Direct Selling Plan — your own business, from your phone, in your own city 💼",
        "Every shop, clinic and coaching centre needs to be online today — you help them get Shubhora. No stock, free registration; turn your own Website plan on and your ID goes Green.",
        "5 ways to earn: Direct Bonus 10% · Matching Bonus 10% · Sponsor Bonus (5 levels) · Renewal Income · 17 Rank Rewards. Two closings a day, payout every Wednesday.",
        "",
        "Plan video (Hindi): {planVideo}",
        "Full details in the PDF below 👇",
        "",
        "Register free here 👉 {join}",
        "If anything gets stuck while registering, tell me — I'll help.",
        "[MEDIA] {pdf}",
      ].join("\n"),
    },
  },
  {
    id: "human",
    call: true,
    title: { hi: "इंसान से बात करें", en: "Talk to a person" },
    chip: { hi: "बात करें", en: "Talk to a person" },
    reply: { hi: "", en: "" },
  },
];

const ITEM_IDS = new Set(MENU_ITEMS.map((i) => i.id));
const LINK_KEYS = new Set(MENU_LINKS.map((l) => l.key));
const MAX_TITLE = 60;
const MAX_REPLY = 1500;

const str = (v, max) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");
const okUrl = (u) => /^https?:\/\/\S+$/i.test(u) || /^\/[^\s]*$/.test(u);

/**
 * A stored menu (Super Admin's or a partner's) made safe: only known items, languages and links; text trimmed and capped;
 * links must be http(s) (or a path on our own site); empty values dropped. Returns {} for anything unusable.
 * @param {any} raw
 * @returns {{ items?: Record<string, { title?: Partial<Text2>, reply?: Partial<Text2> }>, links?: Record<string, string> }}
 */
export function cleanMenuConfig(raw) {
  /** @type {{ items?: Record<string, any>, links?: Record<string, string> }} */
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  const items = {};
  for (const [id, v] of Object.entries(raw.items && typeof raw.items === "object" ? raw.items : {})) {
    if (!ITEM_IDS.has(id) || !v || typeof v !== "object") continue;
    const it = {};
    for (const part of ["title", "reply"]) {
      const src = v[part];
      if (!src || typeof src !== "object") continue;
      const o = {};
      for (const lang of ["hi", "en"]) { const t = str(src[lang], part === "title" ? MAX_TITLE : MAX_REPLY); if (t) o[lang] = t; }
      if (Object.keys(o).length) it[part] = o;
    }
    if (Object.keys(it).length) items[id] = it;
  }
  if (Object.keys(items).length) out.items = items;
  const links = {};
  for (const [k, v] of Object.entries(raw.links && typeof raw.links === "object" ? raw.links : {})) {
    const u = str(v, 500);
    if (LINK_KEYS.has(k) && u && okUrl(u)) links[k] = u;
  }
  if (Object.keys(links).length) out.links = links;
  return out;
}

/**
 * @typedef {{ hi: string, en: string }} Text2
 * @typedef {{ id: string, partner: boolean, call: boolean, chip: Text2, title: Text2, reply: Text2,
 *   src: { title: Record<string, string>, reply: Record<string, string> } }} MenuItem
 * @typedef {{ items: MenuItem[], links: Record<string, string>, linkSrc: Record<string, string> }} Menu
 */

/**
 * The menu in force for one card: every item with its title and reply in both languages and where each came from
 * ("own" = the partner's change, "shubhora" = Super Admin, "built-in"), and the four links (full URLs; `site` turns a
 * path into one). `platform` = Super Admin's config, `own` = the card's botMenu.
 * @param {any} [platform] @param {any} [own] @param {string} [site]
 * @returns {Menu}
 */
export function resolveMenu(platform = {}, own = {}, site = "https://shubhora.com") {
  const P = cleanMenuConfig(platform), O = cleanMenuConfig(own);
  const base = String(site || "https://shubhora.com").replace(/\/$/, "");
  const abs = (u) => (u.startsWith("/") ? base + u : u);
  const pick = (id, part, lang) => {
    const o = O.items?.[id]?.[part]?.[lang], p = P.items?.[id]?.[part]?.[lang];
    const b = MENU_ITEMS.find((i) => i.id === id)?.[part]?.[lang] ?? "";
    return o ? { v: o, src: "own" } : p ? { v: p, src: "shubhora" } : { v: b, src: "built-in" };
  };
  const items = MENU_ITEMS.map((i) => {
    const t = { hi: pick(i.id, "title", "hi"), en: pick(i.id, "title", "en") };
    const r = { hi: pick(i.id, "reply", "hi"), en: pick(i.id, "reply", "en") };
    return {
      id: i.id, partner: !!i.partner, call: !!i.call, chip: i.chip,
      title: { hi: t.hi.v, en: t.en.v }, reply: { hi: r.hi.v, en: r.en.v },
      src: { title: { hi: t.hi.src, en: t.en.src }, reply: { hi: r.hi.src, en: r.en.src } },
    };
  });
  /** @type {Record<string, string>} */ const links = {};
  /** @type {Record<string, string>} */ const linkSrc = {};
  for (const l of MENU_LINKS) {
    const o = O.links?.[l.key], p = P.links?.[l.key];
    links[l.key] = abs(o || p || l.def);
    linkSrc[l.key] = o ? "own" : p ? "shubhora" : "built-in";
  }
  return { items, links, linkSrc };
}

/** The options shown to this card's customers, in order (the Direct Selling Plan left out when the programme is off).
 *  @param {Menu | undefined | null} menu @param {boolean} [partner] @returns {MenuItem[]} */
export function visibleItems(menu, partner = true) {
  return (menu?.items || resolveMenu().items).filter((i) => partner || !i.partner);
}

/** A reply template with its placeholders filled; a line whose placeholder has no value is dropped. */
export function fillTemplate(text, values = {}) {
  return String(text || "").split("\n").filter((line) => {
    const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => MENU_PLACEHOLDERS.includes(k));
    return keys.every((k) => String(values[k] ?? "").trim());
  }).map((line) => line.replace(/\{(\w+)\}/g, (m, k) => (MENU_PLACEHOLDERS.includes(k) ? String(values[k]).trim() : m)))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
