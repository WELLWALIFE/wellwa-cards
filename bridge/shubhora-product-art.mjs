// Product pictures for Shubhora's own products (30 Sep 2026). They are software, so a photo does not exist and the
// flat plan icons read as clip-art on a poster. These are drawn: the product as the partner's customers would see it —
// the Digital Card on a phone with the PARTNER's own name and logo, the AI assistant as a WhatsApp chat answering for
// the partner's business, Custom Solutions as a dashboard on a laptop. PNG with a transparent background, cached per
// partner + kind + language in BASE_DIR/cache. No AI, no cost.
import "./fonts-setup.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(APP, "public", "poster", "base", "cache");
const BRAND_LOGO = path.join(APP, "public", "brand", "shubhora-logo.png"), BRAND_MARK = path.join(APP, "public", "brand", "shubhora-mark.png");
async function brandPng(file, h) { try { return await sharp(file).resize({ height: h }).png().toBuffer(); } catch { return null; } }
const LAT = "'Poppins'", DEV = "'Mukta'", BAL = "'Baloo 2'";
const esc = (s) => String(s ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
const cut = (s, n) => { const t = String(s || "").trim(); return t.length > n ? t.slice(0, n - 1).trim() + "…" : t; };
const initial = (s) => [...String(s || "S").trim()][0]?.toUpperCase() || "S";

/** Which picture a Shubhora product gets, from its name. */
export function shubhoraKind(prod) {
  const n = `${prod?.name || ""} ${prod?.category || ""}`.toLowerCase();
  if (/custom|software|automation|solution|crm|erp/.test(n)) return "software";
  if (/card|कार्ड|v-?card|visiting/.test(n)) return "card";
  return "assistant";
}
/** Is this one of Shubhora's own products (the plan icons, or a Shubhora brand)? */
export const isShubhoraProduct = (prod) => /^\/api\/stock\/vcard\//.test(String(prod?.photo_url ?? "")) || /shubhora/i.test(String(prod?.brand ?? "")) || /shubhora/i.test(String(prod?.name ?? ""));

async function logoTile(profile, size) {
  const url = profile?.logo_url || profile?.photo_url || "";
  try {
    let buf = null;
    if (/^https?:/i.test(url)) { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); }
    else if (url.startsWith("data:")) buf = Buffer.from(url.split(",")[1], "base64");
    else if (url) { const f = path.join(APP, "public", url.replace(/^\/api\/stock\/(vcard|banners|demo)\//, (m, k) => (k === "demo" ? "demo/" : `art/${k}/`)).replace(/^\//, "")); if (fs.existsSync(f)) buf = fs.readFileSync(f); }
    if (buf) {
      const inner = await sharp(buf).resize(size, size, { fit: "cover" }).png().toBuffer();
      const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
      return sharp(inner).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    }
  } catch { /* initial below */ }
  return null;
}

/* ---------------- the phone ---------------- */
const PHONE_W = 420, PHONE_H = 860, R = 56, BEZEL = 12, SW = PHONE_W - BEZEL * 2, SH = PHONE_H - BEZEL * 2;
function phoneFrame(screenSvg, accent = "#0e9e90") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_W + 80}" height="${PHONE_H + 90}">
  <defs>
    <filter id="ph" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#0b1220" flood-opacity="0.35"/></filter>
    <linearGradient id="bez" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2f3a"/><stop offset="1" stop-color="#0d1117"/></linearGradient>
    <clipPath id="scr"><rect x="${40 + BEZEL}" y="${30 + BEZEL}" width="${SW}" height="${SH}" rx="${R - BEZEL}"/></clipPath>
  </defs>
  <rect x="40" y="30" width="${PHONE_W}" height="${PHONE_H}" rx="${R}" fill="url(#bez)" filter="url(#ph)"/>
  <rect x="42" y="32" width="${PHONE_W - 4}" height="${PHONE_H - 4}" rx="${R - 2}" fill="none" stroke="#5b6472" stroke-opacity="0.6" stroke-width="2"/>
  <g clip-path="url(#scr)"><g transform="translate(${40 + BEZEL},${30 + BEZEL})">${screenSvg}</g></g>
  <rect x="${40 + PHONE_W / 2 - 60}" y="${30 + BEZEL + 10}" width="120" height="30" rx="15" fill="#0d1117"/>
  <rect x="${40 + PHONE_W / 2 - 60}" y="${30 + PHONE_H - 22}" width="120" height="5" rx="2.5" fill="#fff" fill-opacity="0.85"/>
  </svg>`;
}
const statusBar = (dark = false) => `<text x="26" y="34" font-family="${LAT}" font-weight="700" font-size="15" fill="${dark ? "#fff" : "#111"}">9:41</text>
  <g transform="translate(${SW - 78},22)" fill="${dark ? "#fff" : "#111"}"><rect x="0" y="6" width="4" height="8" rx="1"/><rect x="6" y="4" width="4" height="10" rx="1"/><rect x="12" y="2" width="4" height="12" rx="1"/><rect x="18" y="0" width="4" height="14" rx="1"/><rect x="30" y="1" width="30" height="13" rx="4" fill="none" stroke="${dark ? "#fff" : "#111"}" stroke-width="2"/><rect x="33" y="4" width="20" height="7" rx="2"/><rect x="61" y="5" width="3" height="5" rx="1"/></g>`;
const icon = {
  call: `<path d="M8 4 l5 -1 3 6 -3 3 c2 4 5 7 9 9 l3 -3 6 3 -1 5 c-12 2 -24 -10 -22 -22 Z" fill="#fff"/>`,
  wa: `<circle cx="16" cy="15" r="10" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M10 23 L7 29 L14 26 Z" fill="#fff"/><path d="M12 11 c0 5 4 9 9 9 l1.5 -2.2 -3 -1.5 -1.2 1.5 c-2 -0.8 -3.4 -2.2 -4.2 -4.2 l1.5 -1.2 -1.5 -3 Z" fill="#fff"/>`,
  save: `<rect x="8" y="6" width="16" height="20" rx="3" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 12 h8 M12 17 h8 M12 22 h5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  share: `<circle cx="22" cy="8" r="3.4" fill="#fff"/><circle cx="10" cy="16" r="3.4" fill="#fff"/><circle cx="22" cy="24" r="3.4" fill="#fff"/><path d="M13 14.5 L19 10 M13 17.5 L19 22" stroke="#fff" stroke-width="2.4"/>`,
  pin: `<path d="M16 4 C10 4 6 8.5 6 14 c0 8 10 16 10 16 s10 -8 10 -16 c0 -5.5 -4 -10 -10 -10 Z" fill="#fff"/><circle cx="16" cy="14" r="3.6" fill="#0009"/>`,
};

/** Screen 1 — the partner's Digital Card, as a customer opens it. */
function cardScreen(p, en) {
  const acc = p.accent, name = cut(p.name, 22), tag = cut(p.tagline, 30), city = cut(p.city, 20);
  const btns = en ? ["Call", "WhatsApp", "Save", "Share"] : ["कॉल", "WhatsApp", "सेव", "शेयर"];
  const keys = ["call", "wa", "save", "share"];
  const items = en ? ["Products & services", "Offers this week", "Reviews", "Location"] : ["प्रोडक्ट और सेवाएँ", "इस हफ़्ते के ऑफ़र", "ग्राहकों की राय", "लोकेशन"];
  return `<rect width="${SW}" height="${SH}" fill="#f4f6fb"/>
  <defs><linearGradient id="hd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${acc}"/><stop offset="1" stop-color="${p.accent2}"/></linearGradient></defs>
  <path d="M0 0 H${SW} V210 Q${SW / 2} 270 0 210 Z" fill="url(#hd)"/>
  ${statusBar(true)}
  <circle cx="${SW / 2}" cy="205" r="66" fill="#fff"/>
  ${p.logoTile ? "" : `<circle cx="${SW / 2}" cy="205" r="58" fill="url(#hd)"/><text x="${SW / 2}" y="226" text-anchor="middle" font-family="${LAT}" font-weight="800" font-size="56" fill="#fff">${esc(initial(p.name))}</text>`}
  <text x="${SW / 2}" y="310" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="800" font-size="27" fill="#111827">${esc(name)}</text>
  ${tag ? `<text x="${SW / 2}" y="340" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="500" font-size="16" fill="#4b5563">${esc(tag)}</text>` : ""}
  ${city ? `<g transform="translate(${SW / 2 - 40},352)"><g transform="scale(0.5)" fill="#6b7280">${icon.pin.replace(/#fff/g, "#6b7280")}</g><text x="20" y="13" font-family="${DEV}, ${LAT}" font-size="14" fill="#6b7280">${esc(city)}</text></g>` : ""}
  ${keys.map((k, i) => `<g transform="translate(${34 + i * 88},390)"><circle cx="32" cy="32" r="30" fill="${i === 1 ? "#25D366" : acc}"/><g transform="translate(16,16)">${icon[k]}</g><text x="32" y="86" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="600" font-size="13" fill="#374151">${esc(btns[i])}</text></g>`).join("")}
  ${items.map((t, i) => `<g transform="translate(22,${500 + i * 66})"><rect width="${SW - 44}" height="54" rx="14" fill="#fff" stroke="#e5e7eb"/><rect x="14" y="13" width="28" height="28" rx="8" fill="${acc}" fill-opacity="${0.9 - i * 0.15}"/><text x="56" y="34" font-family="${DEV}, ${LAT}" font-weight="600" font-size="16" fill="#111827">${esc(t)}</text><path d="M${SW - 78} 21 l8 6 -8 6" fill="none" stroke="#9ca3af" stroke-width="2"/></g>`).join("")}
  <text x="${SW / 2 - 66}" y="${SH - 24}" text-anchor="end" font-family="${LAT}" font-weight="500" font-size="11" fill="#9ca3af">${esc(en ? "Powered by" : "Powered by")}</text>`;
}

/** Screen 2 — WhatsApp: Shubhora AI answering a customer for the partner's business. */
function assistantScreen(p, en) {
  const acc = p.accent, name = cut(p.name, 20);
  const q = en ? "Hi, are you open today? Price?" : "नमस्ते, आज खुला है? रेट क्या है?";
  const a1 = en ? `Namaste! Yes, ${cut(p.short, 18)} is open 10 AM – 8 PM today.` : `नमस्ते! जी हाँ, ${cut(p.short, 18)} आज सुबह 10 – रात 8 खुला है।`;
  const a2 = en ? "Here is our price list and today's offer 👇" : "ये रही हमारी रेट लिस्ट और आज का ऑफ़र 👇";
  const q2 = en ? "Great, book me for 5 PM" : "बढ़िया, शाम 5 बजे का बुक कर दो";
  const a3 = en ? "Done ✅ 5:00 PM booked. Address & map sent. See you!" : "हो गया ✅ 5:00 बजे बुक। पता और मैप भेज दिया। मिलते हैं!";
  const bubble = (text, y, mine, w = 250) => {
    const lines = wrapWords(text, 14, w - 28);
    const h = lines.length * 20 + 30;
    return { h, svg: `<g transform="translate(${mine ? SW - w - 14 : 14},${y})"><rect width="${w}" height="${h}" rx="14" fill="${mine ? "#dcf8c6" : "#ffffff"}" filter="url(#bsh)"/>${lines.map((l, i) => `<text x="14" y="${22 + i * 20}" font-family="${DEV}, ${LAT}" font-size="14" fill="#111">${esc(l)}</text>`).join("")}<text x="${w - 14}" y="${h - 9}" text-anchor="end" font-family="${LAT}" font-size="10" fill="#8a9aa3">${mine ? "10:0" + (1 + Math.round(y / 200)) + " ✓✓" : "10:0" + (1 + Math.round(y / 200))}</text></g>` };
  };
  let y = 122, out = "";
  for (const [t, mine] of [[q, true], [a1, false], [a2, false]]) { const b = bubble(t, y, mine); out += b.svg; y += b.h + 10; }
  // the offer card the AI sends
  out += `<g transform="translate(14,${y})"><rect width="250" height="150" rx="14" fill="#fff" filter="url(#bsh)"/><rect x="8" y="8" width="234" height="92" rx="10" fill="url(#pg)"/><text x="20" y="42" font-family="${BAL}, ${LAT}" font-weight="800" font-size="20" fill="#fff">${esc(en ? "Today's offer" : "आज का ऑफ़र")}</text><text x="20" y="72" font-family="${BAL}, ${LAT}" font-weight="800" font-size="28" fill="#fff35c">20% OFF</text><text x="20" y="128" font-family="${DEV}, ${LAT}" font-size="13" fill="#111">${esc(en ? "Price list · " + cut(p.short, 16) : "रेट लिस्ट · " + cut(p.short, 16))}</text></g>`;
  y += 160;
  for (const [t, mine] of [[q2, true], [a3, false]]) { const b = bubble(t, y, mine); out += b.svg; y += b.h + 10; }
  return `<defs><filter id="bsh" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.12"/></filter>
  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${acc}"/><stop offset="1" stop-color="${p.accent2}"/></linearGradient>
  <pattern id="wp" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="1.5" fill="#c9d6c0" fill-opacity="0.5"/><circle cx="28" cy="26" r="1.5" fill="#c9d6c0" fill-opacity="0.5"/></pattern></defs>
  <rect width="${SW}" height="${SH}" fill="#e5ddd5"/><rect width="${SW}" height="${SH}" fill="url(#wp)"/>
  <rect width="${SW}" height="104" fill="#075e54"/>${statusBar(true)}
  <path d="M18 74 l-8 -8 8 -8" fill="none" stroke="#fff" stroke-width="2.4"/>
  <circle cx="52" cy="66" r="22" fill="#fff"/>${p.logoTile ? "" : `<text x="52" y="74" text-anchor="middle" font-family="${LAT}" font-weight="800" font-size="22" fill="${acc}">${esc(initial(p.name))}</text>`}
  <text x="86" y="62" font-family="${DEV}, ${LAT}" font-weight="700" font-size="17" fill="#fff">${esc(name)}</text>
  <text x="86" y="82" font-family="${LAT}" font-size="12" fill="#c8f0e0">Shubhora AI · ${en ? "replies in seconds, 24×7" : "24×7, सेकंडों में जवाब"}</text>
  <rect x="${SW / 2 - 70}" y="110" width="140" height="0" fill="none"/>
  ${out}
  <rect x="0" y="${SH - 64}" width="${SW}" height="64" fill="#f0f0f0"/><rect x="14" y="${SH - 52}" width="${SW - 80}" height="40" rx="20" fill="#fff"/><text x="34" y="${SH - 26}" font-family="${DEV}, ${LAT}" font-size="14" fill="#9ca3af">${esc(en ? "Message" : "मैसेज")}</text><circle cx="${SW - 34}" cy="${SH - 32}" r="20" fill="#25D366"/><path d="M${SW - 42} ${SH - 36} l10 4 -10 4 2 -4 Z" fill="#fff"/>`;
}
function wrapWords(text, size, width) {
  const measure = (s) => [...s].reduce((a, ch) => a + (/[ऀ-ॿ]/.test(ch) ? (/[ा-्]/.test(ch) ? 0.2 : 0.7) : /[A-Z]/.test(ch) ? 0.66 : /[ilj.,:;' ]/.test(ch) ? 0.3 : 0.56), 0);
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const n = (cur + " " + w).trim(); if (measure(n) * size > width && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); return lines;
}

/** Screen 3 — a CRM / dashboard on a tablet (upright, so it stands beside the chips like the phone does). */
function tabletSvg(p, en) {
  const TW = 640, TH = 880, B = 22, W = TW - B * 2, H = TH - B * 2, acc = p.accent;
  const bars = [42, 58, 50, 72, 66, 88, 80], days = en ? ["M", "T", "W", "T", "F", "S", "S"] : ["सो", "मं", "बु", "गु", "शु", "श", "र"];
  const kpis = en ? [["Leads today", "128", "+18%"], ["Orders", "42", "+9%"], ["Revenue", "₹1.24L", "+22%"], ["Follow-ups", "17", "due"]] : [["आज की लीड", "128", "+18%"], ["ऑर्डर", "42", "+9%"], ["बिक्री", "₹1.24L", "+22%"], ["फ़ॉलो-अप", "17", "बाकी"]];
  const rows = en ? [["Rahul Verma", "Enquiry · WhatsApp", "New"], ["Priya Sharma", "Order #1042", "Paid"], ["Amit Traders", "Quote sent", "Follow-up"]] : [["राहुल वर्मा", "पूछताछ · WhatsApp", "नई"], ["प्रिया शर्मा", "ऑर्डर #1042", "भुगतान"], ["अमित ट्रेडर्स", "कोटेशन भेजा", "फ़ॉलो-अप"]];
  const kw = (W - 48 - 16) / 2;
  const screen = `<rect width="${W}" height="${H}" fill="#f6f7fb"/>
    <rect width="${W}" height="96" fill="#111827"/>
    <circle cx="44" cy="52" r="20" fill="${acc}"/><text x="44" y="59" text-anchor="middle" font-family="${LAT}" font-weight="800" font-size="20" fill="#fff">${esc(initial(p.name))}</text>
    <text x="78" y="46" font-family="${DEV}, ${LAT}" font-weight="800" font-size="21" fill="#fff">${esc(cut(p.name, 24))}</text><text x="78" y="70" font-family="${DEV}, ${LAT}" font-size="14" fill="#9ca3af">${esc(en ? "CRM · Dashboard" : "CRM · डैशबोर्ड")}</text>
    <rect x="${W - 150}" y="34" width="126" height="30" rx="15" fill="#1f2937"/><text x="${W - 87}" y="54" text-anchor="middle" font-family="${DEV}, ${LAT}" font-size="12" fill="#d1d5db">${esc(en ? "This week ▾" : "इस हफ़्ते ▾")}</text>
    ${kpis.map(([l, v, d], i) => `<g transform="translate(${24 + (i % 2) * (kw + 16)},${120 + Math.floor(i / 2) * 100})"><rect width="${kw}" height="84" rx="14" fill="#fff" stroke="#e5e7eb"/><text x="16" y="28" font-family="${DEV}, ${LAT}" font-size="14" fill="#6b7280">${esc(l)}</text><text x="16" y="64" font-family="${LAT}" font-weight="800" font-size="30" fill="#111827">${esc(v)}</text><text x="${kw - 16}" y="64" text-anchor="end" font-family="${LAT}" font-weight="700" font-size="14" fill="#16a34a">${esc(d)}</text></g>`).join("")}
    <g transform="translate(24,330)"><rect width="${W - 48}" height="250" rx="14" fill="#fff" stroke="#e5e7eb"/><text x="18" y="32" font-family="${DEV}, ${LAT}" font-weight="700" font-size="16" fill="#111827">${esc(en ? "Leads & orders" : "लीड और ऑर्डर")}</text>
      ${bars.map((b, i) => `<rect x="${34 + i * 78}" y="${218 - b * 1.8}" width="42" height="${b * 1.8}" rx="7" fill="${i === 5 ? acc : "#c7d2fe"}"/><text x="${55 + i * 78}" y="236" text-anchor="middle" font-family="${DEV}, ${LAT}" font-size="12" fill="#9ca3af">${esc(days[i])}</text>`).join("")}
      <path d="M40 ${190} ${bars.map((b, i) => `L${55 + i * 78} ${212 - b * 1.7}`).join(" ")}" fill="none" stroke="${acc}" stroke-width="3.5" stroke-linejoin="round"/></g>
    <g transform="translate(24,600)"><rect width="${W - 48}" height="${H - 620}" rx="14" fill="#fff" stroke="#e5e7eb"/><text x="18" y="32" font-family="${DEV}, ${LAT}" font-weight="700" font-size="16" fill="#111827">${esc(en ? "Recent activity" : "हाल की गतिविधि")}</text>
      ${rows.map(([n, s2, st], i) => `<g transform="translate(18,${52 + i * 64})"><circle cx="18" cy="20" r="18" fill="${["#fde68a", "#bfdbfe", "#fecaca"][i]}"/><text x="18" y="26" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="700" font-size="14" fill="#374151">${esc(initial(n))}</text><text x="50" y="16" font-family="${DEV}, ${LAT}" font-weight="700" font-size="15" fill="#111827">${esc(n)}</text><text x="50" y="36" font-family="${DEV}, ${LAT}" font-size="13" fill="#6b7280">${esc(s2)}</text><rect x="${W - 48 - 36 - 104}" y="8" width="96" height="24" rx="12" fill="${["#dbeafe", "#dcfce7", "#fef3c7"][i]}"/><text x="${W - 48 - 36 - 56}" y="25" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="600" font-size="12" fill="#374151">${esc(st)}</text></g>`).join("")}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TW + 80}" height="${TH + 90}"><defs><filter id="tsh" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#0b1220" flood-opacity="0.35"/></filter><linearGradient id="tb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2f3a"/><stop offset="1" stop-color="#0d1117"/></linearGradient><clipPath id="tc"><rect x="${40 + B}" y="${30 + B}" width="${W}" height="${H}" rx="18"/></clipPath></defs>
  <rect x="40" y="30" width="${TW}" height="${TH}" rx="44" fill="url(#tb)" filter="url(#tsh)"/><rect x="42" y="32" width="${TW - 4}" height="${TH - 4}" rx="42" fill="none" stroke="#5b6472" stroke-opacity="0.6" stroke-width="2"/>
  <g clip-path="url(#tc)"><g transform="translate(${40 + B},${30 + B})">${screen}</g></g><circle cx="${40 + TW / 2}" cy="${30 + 11}" r="4" fill="#0d1117"/></svg>`;
}

/** The product picture for one of Shubhora's products, drawn for this partner. Returns a PNG path (transparent). */
export async function shubhoraProductArt(prod, profile, { accent = "#0e9e90", accent2 = "#2563eb", lang = "hi" } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const kind = shubhoraKind(prod), en = lang === "en" || lang === "hinglish";
  const p = { name: profile?.tagline?.trim() || profile?.name || "My Business", short: (profile?.tagline?.trim() || profile?.name || "").split(/\s+/).slice(0, 2).join(" "), tagline: profile?.name && profile?.tagline ? profile.name : "", city: profile?.city || "", accent, accent2, logoTile: null };
  const key = crypto.createHash("md5").update(JSON.stringify([kind, en, p.name, p.tagline, p.city, accent, profile?.logo_url || profile?.photo_url || ""])).digest("hex").slice(0, 12);
  const file = path.join(CACHE, `shubhora-${kind}-${key}.png`);
  if (fs.existsSync(file)) return { file, kind };
  const tile = await logoTile(profile, kind === "card" ? 116 : 44);
  p.logoTile = !!tile || (kind === "assistant" && fs.existsSync(BRAND_MARK));
  if (kind === "software") {
    const mk = await brandPng(BRAND_MARK, 40), TW = 640, layersT = [];   // the flame mark reads on the dark header bar
    if (mk) { const m = await sharp(mk).metadata(); layersT.push({ input: mk, left: 40 + 22 + (TW - 44) - 150 - m.width - 18, top: 30 + 22 + 49 - Math.round(m.height / 2) }); }
    await sharp(Buffer.from(tabletSvg(p, en))).composite(layersT).png().toFile(file); return { file, kind };
  }
  const svg = phoneFrame(kind === "card" ? cardScreen(p, en) : assistantScreen(p, en), accent);
  const layers = [];
  // Shubhora's own logo on the screen: the wordmark in the card's footer, the mark in the WhatsApp header
  if (kind === "card") { const wm = await brandPng(BRAND_LOGO, 30); if (wm) { const m = await sharp(wm).metadata(); layers.push({ input: wm, left: 40 + BEZEL + Math.round(SW / 2 - 60), top: 30 + BEZEL + SH - 24 - Math.round(m.height * 0.8) }); } }
  if (kind === "assistant" && !tile) { const mk = await brandPng(BRAND_MARK, 30); if (mk) layers.push({ input: mk, left: 40 + BEZEL + 52 - 12, top: 30 + BEZEL + 66 - 15 }); }
  if (tile) layers.push(kind === "card" ? { input: tile, left: 40 + BEZEL + Math.round(SW / 2 - 58), top: 30 + BEZEL + 205 - 58 } : { input: tile, left: 40 + BEZEL + 52 - 22, top: 30 + BEZEL + 66 - 22 });
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(file);
  return { file, kind };
}
