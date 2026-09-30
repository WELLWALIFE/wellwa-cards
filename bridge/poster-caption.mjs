// One caption writer for every poster post: the 4 AM auto-post, the noon preview and the app's own posts.
// Owner's call (25 Sep 2026): the caption talks about the day's plan / product, and carries the owner's V-Card link —
// on WhatsApp Status and Facebook a link in the caption opens with one tap (nobody scans a QR on Status).
// The AI writes only the selling lines and the hashtags. The phone number and the link are added by code, so a number
// or a link can never come out wrong.

const MODEL = "gemini-3.5-flash-lite";
const LANG = (lang) => (lang === "en" ? "English" : lang === "hinglish" ? "Hinglish (Hindi in Roman letters)" : "Hindi (Devanagari)");
const cleanLine = (s) => String(s ?? "")
  .replace(/https?:\/\/\S+/gi, "").replace(/\b[\w.-]+\.(com|in|me)\/\S*/gi, "") // no links — code adds the right one
  .replace(/(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, "") // no phone numbers — code adds the right one
  .replace(/#\S+/g, "").replace(/\s{2,}/g, " ").trim();

/** "2,999 / month" → "₹2,999 / month"; words stay as written ("On request — contact us"). */
export const priceText = (p) => { const s = String(p ?? "").trim(); return /^\d/.test(s) ? `₹${s}` : s; };

const cardLine = (link, lang) => `👉 ${lang === "en" ? "My digital card" : lang === "hinglish" ? "Mera digital card" : "मेरा digital card"}: ${link}`;
/** The owner's joining link — whoever taps it gets their own free card, joined under this owner (owner's call,
 *  29 Sep 2026: every status carries "my card" and "make your free card"). */
const joinLine = (join, lang) => `✨ ${lang === "en" ? "Make your free digital card" : lang === "hinglish" ? "Apna free digital card banayein" : "अपना free digital card बनाएँ"}: ${join}`;

/** The fixed part under the words: number, card link and the joining link, in the caption's language. */
export function captionFooter({ phone = "", link = "", join = "", lang = "hi" } = {}) {
  const lines = [];
  if (phone) lines.push(`📞 Call/WhatsApp: ${phone}`);
  if (link) lines.push(cardLine(link, lang));
  if (join) lines.push(joinLine(join, lang));
  return lines.join("\n");
}

/** The caption as it goes to WhatsApp (Status or a chat): no hashtags — they do nothing on WhatsApp and only make the
 *  text long — and always the two links, even on a caption written earlier or typed by hand. */
export function statusCaption(caption, { phone = "", link = "", join = "", lang = "hi" } = {}) {
  let out = String(caption ?? "").replace(/(^|\s)#[\p{L}\p{M}\p{N}_]+/gu, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const add = [];
  if (phone && !out.includes(phone)) add.push(`📞 Call/WhatsApp: ${phone}`);
  if (link && !out.includes(link.split("?")[0])) add.push(cardLine(link, lang));
  if (join && !out.includes("/signup?by=")) add.push(joinLine(join, lang));
  if (add.length) out = `${out}${/(^|\n)(📞|👉)[^\n]*$/.test(out) ? "\n" : "\n\n"}${add.join("\n")}`.trim();
  return out;
}

/**
 * kind: "product" (product / plan poster), "card" (the weekly visiting-card poster) or "" (greeting / festival).
 * product: { name, price, benefits[], offer } — the product that is ON the poster.
 */
export async function writeCaption({ key = "", name = "", tagline = "", phone = "", lang = "hi", theme = "", offer = "", product = null, link = "", join = "", kind = "" } = {}) {
  const who = `${name || ""}${tagline && tagline !== name ? ` — ${tagline}` : ""}`.trim();
  const isProduct = kind === "product" || (!kind && !!product?.name);
  // only a real amount goes in as a price — "On request — contact us" read as "… — Price: On request — contact us"
  const price = isProduct && /\d/.test(String(product?.price ?? "")) ? priceText(product?.price) : "";
  const benefits = isProduct ? (Array.isArray(product?.benefits) ? product.benefits : []).map((b) => String(b).trim()).filter(Boolean).slice(0, 4) : [];
  const dayOffer = String(offer || "").trim();
  const en = lang === "en";
  const fallback = isProduct
    ? [product.name, price ? `${en ? "Price" : lang === "hinglish" ? "Price" : "कीमत"}: ${price}` : "", dayOffer || String(product.offer || "").trim() || benefits[0] || ""].filter(Boolean)
    : kind === "card"
      ? [en ? `My digital visiting card — call, WhatsApp, location and photos, all on one link.` : `मेरा digital visiting card — call, WhatsApp, location और photos, सब एक link पर।`, who]
      : [`${theme ? `${theme} — ` : ""}${who}`];
  const compose = (lines, tags) => [lines.join("\n"), captionFooter({ phone, link, join, lang }), tags.join(" ")].filter((x) => x && x.trim()).join("\n\n");
  if (!key) return compose(fallback, []);
  const brief = isProduct
    ? `The poster advertises this product / plan, sold by the seller below:
Name: ${product.name}
${price ? `Price: ${price}\n` : ""}${benefits.length ? `Benefits: ${benefits.join("; ")}\n` : ""}${product.offer ? `Its offer: ${product.offer}\n` : ""}Write 2 short, attractive lines that make a customer want it: name it, give one or two of the real benefits above, and the price or offer if one is given (quote numbers exactly as written).`
    : kind === "card"
      ? "The poster shows the seller's digital visiting card: one link with call, WhatsApp, location, photos and products. Write 2 short lines inviting people to open the card and save the number."
      : `The poster is a greeting. Theme: ${theme}. Write 2 short, warm lines for the day that also remind people of the seller.`;
  const prompt = `Write a social-media caption in ${LANG(lang)} for a poster.
${brief}
Seller: ${who}
${dayOffer ? `Today's offer (quote it exactly as written): "${dayOffer}"` : "There is no other offer or discount — do not invent one."}
Rules: professional and warm; at most 2 emoji; no medical or income claims; no invented prices or numbers. Write every brand, business and product name exactly as it is written above — same letters, same spelling (never transliterate it). No phone number, no link and no hashtags inside "lines".
Return JSON only: {"lines": ["first line", "second line"], "hashtags": ["#one", "#two", "#three", "#four", "#five"]}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 400, responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json();
    const out = JSON.parse(String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").replace(/^```(json)?|```$/g, "").trim());
    const lines = (Array.isArray(out.lines) ? out.lines : []).map(cleanLine).filter((l) => l.length > 3).slice(0, 3);
    const tags = [...new Set((Array.isArray(out.hashtags) ? out.hashtags : [])
      .map((t) => `#${String(t).replace(/^#+/, "").replace(/[^\p{L}\p{M}\p{N}_]/gu, "")}`).filter((t) => t.length > 2 && t.length <= 32))].slice(0, 6);
    return compose(lines.length ? lines : fallback, tags);
  } catch { return compose(fallback, []); }
}
