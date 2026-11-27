// The card, as plain text the assistants can read (owner's call, 2 Oct 2026: "AI ko card padh kar auto-train karo").
// Before this the WhatsApp bot and the website chat were handed the pages as raw JSON cut at 3,000 characters —
// ids, block kinds and picture URLs first, so the products with their prices, the FAQ, the timings and the address
// on later pages never reached the AI, and the owner was expected to type it all again under "Teach the bot".
// Now every block is written out as a clean line: nothing to train by hand, and a republished card is read again
// (the bot re-reads it every 5 minutes; the website chat reads it on every visit).
//   cardDigest(card, { maxChars = 9000, pages = card.pages }) → string

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const price = (p) => (p ? (/^\s*[\d,.]/.test(p) ? `₹${clean(p)}` : clean(p)) : "");

function blockLines(b) {
  const title = clean(b.title);
  const items = Array.isArray(b.items) ? b.items : [];
  switch (b.kind) {
    case "about": return [`${title || "About"}: ${clean(b.body)}`];
    case "highlights": return items.length ? [`${title || "Highlights"}: ${items.map(clean).filter(Boolean).join(" · ")}`] : [];
    case "services": return items.length ? [`${title || "Services"}:`, ...items.map((s) => `  - ${clean(s.name)}${s.desc ? ` — ${clean(s.desc)}` : ""}`)] : [];
    case "product": return items.length ? [`${title || "Products"}:`, ...items.map((p) => {
      const bits = [clean(p.name)];
      if (p.price) bits.push(`price ${price(p.price)}${p.mrp && p.mrp !== p.price ? ` (MRP ${price(p.mrp)})` : ""}`);
      else if (p.mrp) bits.push(`MRP ${price(p.mrp)}`);
      if (p.badge) bits.push(clean(p.badge));
      if (p.desc) bits.push(clean(p.desc));
      const feats = (p.features ?? []).map(clean).filter(Boolean);
      if (feats.length) bits.push(`features: ${feats.join("; ")}`);
      const specs = (p.specs ?? []).map((r) => `${clean(r.label)} ${clean(r.value)}`).filter((x) => x.trim());
      if (specs.length) bits.push(`specs: ${specs.join(", ")}`);
      return `  - ${bits.join(" — ")}`;
    })] : [];
    case "faq": return items.length ? [`${title || "FAQ"}:`, ...items.map((f) => `  Q: ${clean(f.q)}\n  A: ${clean(f.a)}`)] : [];
    case "table": { const cols = (b.columns ?? []).map(clean); const rows = (b.rows ?? []).filter((r) => r.some(Boolean)).map((r) => r.map((c, i) => `${cols[i] ? `${cols[i]}: ` : ""}${clean(c)}`).join(", ")); return rows.length ? [`${title || "Price list"}:`, ...rows.map((r) => `  - ${r}`), ...(b.note ? [`  (${clean(b.note)})`] : [])] : []; }
    case "form": return [`${title || "Form"}: visitors can fill it on the website (${(b.fields ?? []).map((f) => clean(f.label)).filter(Boolean).join(", ")}); a submission reaches the owner as a lead.`];
    case "hours": { const rows = (b.rows ?? []).map((r) => `${clean(r.day)} ${clean(r.time)}`.trim()).filter(Boolean); return rows.length ? [`${title || "Timings"}: ${rows.join("; ")}`] : []; }
    case "location": return b.address || b.mapUrl ? [`${title || "Address"}: ${clean(b.address)}${b.mapUrl ? ` (map: ${clean(b.mapUrl)})` : ""}`] : [];
    case "offer": return b.text || b.code ? [`${title || "Offer"}: ${clean(b.text)}${b.code ? ` — code ${clean(b.code)}` : ""}${b.expires ? ` — till ${clean(b.expires)}` : ""}`] : [];
    case "testimonials": return items.length ? [`${title || "Customer reviews"}:`, ...items.slice(0, 6).map((t) => `  - "${clean(t.text)}" — ${clean(t.name)}${t.rating ? ` (${t.rating}/5)` : ""}`)] : [];
    case "appointment": return [`${title || "Appointment"}: ${clean(b.note)}${b.url ? ` — book: ${clean(b.url)}` : ""}`];
    case "contact": return b.note ? [`${title || "Contact"}: ${clean(b.note)}`] : [];
    case "cta": return b.body ? [`${title}: ${clean(b.body)}`] : [];
    case "compare": { const rows = (b.rows ?? []).map((r) => `${clean(r.feature)}: ${clean(b.leftLabel)} ${clean(r.left)} / ${clean(b.rightLabel)} ${clean(r.right)}`); return rows.length ? [`${title || "Comparison"}:`, ...rows.map((r) => `  - ${r}`)] : []; }
    case "showcase": return items.length ? [`${title || "Showcase"}: ${items.map((s) => `${clean(s.label)}${s.sub ? ` (${clean(s.sub)})` : ""}`).join(" · ")}`] : [];
    case "video": return b.caption ? [`${title || "Video"}: ${clean(b.caption)}`] : [];
    case "pdf": return [`${title || "Document"}: ${clean(b.fileLabel)}${b.hint ? ` — ${clean(b.hint)}` : ""}`];
    case "gallery": case "image": case "carousel": { const caps = (b.images ?? []).map((i) => clean(i.caption || i.label)).filter(Boolean); return caps.length ? [`${title || "Photos"}: ${caps.join(" · ")}`] : []; }
    default: return [];
  }
}

/* ---------------- the offer, already worked out (owner, 27 Nov 2026) ----------------
 * Told "10% off on silk sarees" and a ₹2,499 silk saree, the assistant kept saying "10% off chal raha hai" without the
 * amount, or took ₹2,499 as the price after the offer. The app does the sum once here and hands the AI the figures.
 * Only a "N% off on <words>" offer whose words are all in the product's name (or an offer "on everything") counts;
 * anything vaguer is left alone and the AI says the owner will confirm it. */
const STOP = new Set(["off", "on", "the", "and", "all", "our", "for", "par", "per", "with", "every", "any", "now", "only", "today", "flat", "upto", "up", "to", "sale", "offer", "festive", "special", "discount"]);
const stem = (w) => w.replace(/(?<=[sxz]|ch|sh)es$/, "").replace(/s$/, "");   // sarees → saree, dresses → dres (both sides alike)
const words = (t) => String(t ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem);
const rupees = (v) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 && n < 1e7 ? n : 0; };
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** The current "N% off" offers: { pct, on: words[] | "all", text }. */
export function currentOffers(card, today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)) {
  const texts = [];
  const n = card?.notice;
  if (n?.text && (!n.until || n.until >= today)) texts.push(`${n.text} ${n.sub ?? ""}`);
  for (const pg of card?.pages ?? []) for (const b of pg?.blocks ?? []) if (b?.kind === "offer" && b.text) texts.push(String(b.text));
  const out = [];
  for (const t of texts) {
    const m = String(t).match(/(\d{1,2})\s*%\s*(?:off|discount|छूट)(?:\s+(?:on|पर)\s+([^.,;!|\n]+))?/i);
    if (!m) continue;
    const pct = Number(m[1]);
    if (!(pct > 0 && pct < 90)) continue;
    const obj = clean(m[2] ?? "");
    if (!obj) continue;                                   // "10% off" on what? left to the owner
    const on = /\b(all|everything|every item|sab|sabhi)\b|सभी|सब पर|हर /i.test(obj) ? "all" : words(obj);
    if (on !== "all" && !on.length) continue;
    out.push({ pct, on, text: clean(t) });
  }
  return out;
}
/** Lines for the AI: each priced product an offer covers, with the price after it and the totals for 1–5 pieces. */
export function offerPriceLines(card, today) {
  const offers = currentOffers(card, today);
  if (!offers.length) return [];
  const lines = [];
  for (const pg of card?.pages ?? []) {
    if (pg?.hidden) continue;
    for (const b of pg?.blocks ?? []) {
      if (b?.kind !== "product") continue;
      for (const p of b.items ?? []) {
        const base = rupees(p?.price || p?.mrp);
        if (!base || !clean(p?.name)) continue;
        const have = new Set(words(p.name));
        const o = offers.find((x) => x.on === "all" || x.on.every((w) => have.has(w)));
        if (!o) continue;
        const each = base * (100 - o.pct) / 100;
        const totals = [1, 2, 3, 4, 5].map((q) => `${q} = ${inr(base * q * (100 - o.pct) / 100)}`).join(" · ");
        lines.push(`- ${clean(p.name)}: listed ${inr(base)}; with the current ${o.pct}% offer ${inr(each)} each. To pay: ${totals}. (Before the offer: ${q2(base)}.)`);
      }
    }
  }
  return lines.slice(0, 20);
}
const q2 = (base) => [1, 2, 3].map((q) => `${q} = ${inr(base * q)}`).join(" · ");

export function cardDigest(card, { maxChars = 9000, pages } = {}) {
  if (!card) return "";
  const out = [];
  const who = [clean(card.name), clean(card.jobTitle), clean(card.company)].filter(Boolean).join(" · ");
  if (who) out.push(`Business: ${who}`);
  if (card.tagline) out.push(`Tagline: ${clean(card.tagline)}`);
  if (card.about) out.push(`About: ${clean(card.about)}`);
  // The owner's notice (news, an offer, a closure) — only while its date has not passed.
  if (card.notice?.text) {
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    if (!card.notice.until || card.notice.until >= today) out.push(`NOTICE (current): ${clean(card.notice.text)}${card.notice.sub ? ` — ${clean(card.notice.sub)}` : ""}${card.notice.until ? ` (till ${card.notice.until})` : ""}`);
  }
  const offerLines = offerPriceLines(card);
  if (offerLines.length) out.push(`OFFER PRICES (worked out by the app — quote these exact figures; the listed price is BEFORE the offer):`, ...offerLines);
  const links = (card.links ?? []).map((l) => `${clean(l.label || l.type)}: ${clean(l.value)}`).filter((x) => !x.endsWith(": "));
  if (links.length) out.push(`Contact: ${links.join(" | ")}`);
  if (card.gstin) out.push(`GSTIN: ${clean(card.gstin)}`);
  const seo = card.seo || {};
  if (seo.city || (seo.areas ?? []).length) out.push(`Serves: ${[seo.city, ...(seo.areas ?? [])].filter(Boolean).map(clean).join(", ")}`);
  // A hidden page (the owner's Shubhora page) stays out of the owner's own digest — unless the caller asked for
  // exactly that page (the Shubhora page's own assistant).
  for (const p of pages ?? card.pages ?? []) {
    if (p?.hidden && !pages) continue;
    const lines = (p.blocks ?? []).flatMap(blockLines);
    if (!lines.length) continue;
    out.push(`\n[${clean(p.label) || clean(p.slug) || "Page"}]`);
    out.push(...lines);
  }
  let text = out.join("\n");
  if (text.length > maxChars) text = text.slice(0, maxChars - 1).replace(/\n[^\n]*$/, "") + "\n…";
  return text;
}
