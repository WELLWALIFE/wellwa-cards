// Search-engine setup for every card and website, built from what the owner already filled in — no extra work and
// no AI cost. Local search ("sweet shop near me", "dentist in Jaipur") is won by: a clear business + city in the title,
// the same name/address/phone everywhere, LocalBusiness structured data (address, hours, areas served, catalogue),
// crawlable page URLs, and a Google Business Profile. This file does the first four; the owner links the fifth.
import type { Card, CardBlock, CardPage } from "@/lib/types";
import { schemaTypeFor } from "@/lib/site-recipes";
import type { ProductItem } from "@/lib/types";

export type SeoFacts = {
  business: string; person: string; category: string; city: string; areas: string[];
  phone: string; email: string; address: string; keywords: string[];
};

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const list = (v: unknown): string[] => (Array.isArray(v) ? v : String(v ?? "").split(","))
  .map(clean).filter(Boolean).filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
export const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,.;:–—-]+\S*$/, "")}…`);

/** "Shop 4, MI Road, Jaipur, Rajasthan 302001" → "Jaipur" (the part before the state / PIN). */
export function cityFromAddress(address: string): string {
  const parts = address.split(",").map(clean).filter(Boolean).map((p) => p.replace(/\b\d{6}\b/g, "").trim()).filter(Boolean);
  const STATES = /^(andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|new delhi|jammu and kashmir|ladakh|chandigarh|puducherry|india)$/i;
  const rest = parts.filter((p) => !STATES.test(p) && !/^\d+$/.test(p));
  const last = rest.at(-1) ?? "";
  return /\d/.test(last) || last.length > 30 ? "" : last;
}

const blocks = (card: Card) => card.pages.flatMap((p) => p.blocks);
const find = <K extends CardBlock["kind"]>(card: Card, kind: K) => blocks(card).filter((b): b is Extract<CardBlock, { kind: K }> => b.kind === kind);

export function seoFacts(card: Card): SeoFacts {
  const address = clean(find(card, "location")[0]?.address);
  const link = (t: string) => clean(card.links.find((l) => l.type === t)?.value);
  return {
    business: clean(card.company) || clean(card.name),
    person: clean(card.name),
    category: clean(card.seo?.category) || clean(card.jobTitle),
    city: clean(card.seo?.city) || cityFromAddress(address),
    areas: list(card.seo?.areas).slice(0, 12),
    phone: link("phone") || link("whatsapp"),
    email: link("email"),
    address,
    keywords: list(card.seo?.keywords).slice(0, 20),
  };
}

/** The words people type: "<type> in <city>", "<type> near me", "best <type> in <city>", each area, each service. */
export function seoKeywords(card: Card): string[] {
  const f = seoFacts(card);
  const type = f.category.toLowerCase();
  const out: string[] = [f.business];
  // People also search the owner by name ("Rajesh Sharma", "Rajesh Sharma Jaipur", "Rajesh Sharma Sharma Sweets").
  const person = f.person && f.person.toLowerCase() !== f.business.toLowerCase() ? f.person : "";
  if (person) out.push(person, `${person} ${f.business}`, ...(f.city ? [`${person} ${f.city}`] : []), ...(type ? [`${person} ${type}`] : []));
  if (type) {
    out.push(`${type} near me`);
    if (f.city) out.push(`${type} in ${f.city}`, `best ${type} in ${f.city}`, `${f.business} ${f.city}`);
    for (const a of f.areas) out.push(`${type} in ${a}`);
  }
  for (const s of offerings(card).slice(0, 8)) {
    out.push(`${s.toLowerCase()} near me`);
    if (f.city) out.push(`${s.toLowerCase()} in ${f.city}`);
  }
  out.push(...f.keywords);
  return list(out).slice(0, 40);
}

/** Service and product names, for keywords and the catalogue. */
export function offerings(card: Card): string[] {
  return list([
    ...find(card, "services").flatMap((b) => b.items.map((i) => i.name)),
    ...find(card, "product").flatMap((b) => b.items.map((i) => i.name)),
  ]);
}

/** Title for a page: home "Sharma Sweets – Sweet Shop in Jaipur", inner "Products – Sharma Sweets, Jaipur". */
export function seoTitle(card: Card, page?: CardPage | null): string {
  const f = seoFacts(card);
  const own = clean(card.seoTitle);
  const home = !page || page.slug === "home" || page === card.pages[0];
  if (home) {
    if (own) return cut(own, 70);
    const where = f.city ? ` in ${f.city}` : "";
    const type = f.category && f.category.toLowerCase() !== f.business.toLowerCase() ? f.category : "";
    const base = type ? `${f.business} – ${type}${where}` : `${f.business}${where}`;
    // The owner's name too, when it fits: a search for the name then finds the card.
    const person = f.person && !base.toLowerCase().includes(f.person.toLowerCase()) ? ` | ${f.person}` : "";
    return cut(base.length + person.length <= 70 ? base + person : base, 70);
  }
  return cut(`${clean(page.label)} – ${own || f.business}${f.city ? `, ${f.city}` : ""}`, 70);
}

function pageText(page: CardPage): string {
  const parts: string[] = [];
  for (const b of page.blocks) {
    if (b.kind === "about") parts.push(b.body);
    else if (b.kind === "services") parts.push(b.items.map((i) => i.name).join(", "));
    else if (b.kind === "product") parts.push(b.items.map((i) => i.name).join(", "));
    else if (b.kind === "highlights") parts.push(b.items.join(". "));
    else if (b.kind === "faq") parts.push(b.items.map((i) => i.q).join(" "));
    else if (b.kind === "offer") parts.push(b.text);
    if (parts.join(" ").length > 200) break;
  }
  return clean(parts.join(". "));
}

/** 150–160 characters: who, what, where, the areas, and how to reach them. */
export function seoDescription(card: Card, page?: CardPage | null): string {
  const f = seoFacts(card);
  const home = !page || page.slug === "home" || page === card.pages[0];
  const own = clean(card.seoDescription);
  if (home && own) return cut(own, 160);
  const where = f.city ? ` in ${f.city}` : "";
  const areas = f.areas.length ? ` Serving ${f.areas.slice(0, 4).join(", ")}.` : "";
  const reach = f.phone ? ` Call or WhatsApp ${f.phone}.` : "";
  const body = page && !home ? pageText(page) : clean(card.tagline) || pageText(card.pages[0] ?? { blocks: [] } as unknown as CardPage);
  const by = f.person && f.person.toLowerCase() !== f.business.toLowerCase() ? ` by ${f.person}` : "";
  const lead = `${f.business}${f.category && f.category.toLowerCase() !== f.business.toLowerCase() ? `, ${f.category.toLowerCase()}` : ""}${where}${home ? by : ""}.`;
  return cut(`${lead} ${body ? `${cut(body, 90)}` : ""}${areas}${reach}`.replace(/\.\./g, ".").replace(/\s+/g, " ").trim(), 160);
}

/* ---- opening hours → schema.org ---- */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function dayIndex(s: string): number {
  const k = s.trim().toLowerCase().slice(0, 3);
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(k);
}
function to24(t: string): string | null {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = m[2] ?? "00";
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return h > 24 ? null : `${String(h).padStart(2, "0")}:${min}`;
}
export function openingHours(card: Card) {
  const out: { "@type": "OpeningHoursSpecification"; dayOfWeek: string[]; opens: string; closes: string }[] = [];
  for (const r of find(card, "hours").flatMap((b) => b.rows)) {
    const [a, b] = r.day.split(/\s*(?:–|-|to)\s*/i);
    const i = dayIndex(a ?? ""); const j = b ? dayIndex(b) : i;
    if (i < 0 || j < 0) continue;
    const days = i <= j ? DAYS.slice(i, j + 1) : [...DAYS.slice(i), ...DAYS.slice(0, j + 1)];
    for (const span of r.time.split(",")) {
      const [o, c] = span.split(/\s*(?:–|-|to)\s*/i);
      const opens = o ? to24(o) : null; const closes = c ? to24(c) : null;
      if (opens && closes) out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes });
    }
  }
  return out;
}

const price = (s?: string) => { const n = Number(String(s ?? "").replace(/[^\d.]/g, "")); return n > 0 ? n : null; };

/** The exact pin in a Google Maps link ("https://maps.google.com/?q=26.912434,75.787271"), or null.
 *  Short links (maps.app.goo.gl/…) carry no coordinates, so they give null. */
export function mapPin(url?: string | null): { lat: number; lng: number } | null {
  const m = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url ?? "");
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** The first exact pin on the card: a location block's map link, else a location link. */
export function cardPin(card: Card): { lat: number; lng: number } | null {
  for (const b of find(card, "location")) { const p = mapPin(b.mapUrl); if (p) return p; }
  for (const l of card.links) if (l.type === "location") { const p = mapPin(l.value); if (p) return p; }
  return null;
}

/** Structured data Google reads for local results: the business, its catalogue, FAQ and the page path. */
export function seoJsonLd(card: Card, opts: { url: string; homeUrl: string; page?: CardPage | null; product?: ProductItem | null }) {
  const f = seoFacts(card);
  const sameAs = card.links.filter((l) => ["instagram", "facebook", "linkedin", "youtube", "website"].includes(l.type)).map((l) => l.value).filter((v) => /^https?:\/\//.test(v));
  // A shop or firm (has a company name or a business type) is a LocalBusiness; a lone professional is a Person.
  const isBusiness = !!clean(card.company) || !!clean(card.seo?.category) || find(card, "location").length > 0 || find(card, "hours").length > 0;
  const web = (u?: string) => (u && /^https?:\/\//.test(u) ? u : undefined);   // never inline data: images
  const image = web(card.coverUrl) || web(card.site?.hero?.imageUrl) || web(card.avatarUrl);
  const logo = web(card.site?.logoUrl) || web(card.avatarUrl);
  const map = card.links.find((l) => l.type === "location" && /^https?:\/\//.test(l.value))?.value;
  const catalogue = [
    ...find(card, "product").flatMap((b) => b.items).slice(0, 30).map((p) => ({
      "@type": "Offer", itemOffered: { "@type": "Product", name: p.name, ...(p.desc ? { description: cut(clean(p.desc), 200) } : {}), ...(web(p.images?.[0] || p.imageUrl) ? { image: web(p.images?.[0] || p.imageUrl) } : {}) },
      ...(price(p.price) ? { price: price(p.price), priceCurrency: "INR" } : {}),
    })),
    ...find(card, "services").flatMap((b) => b.items).slice(0, 30).map((s) => ({
      "@type": "Offer", itemOffered: { "@type": "Service", name: s.name, ...(s.desc ? { description: cut(clean(s.desc), 200) } : {}) },
    })),
  ];
  const hours = openingHours(card);
  const areas = [f.city, ...f.areas].filter(Boolean);
  const gstin = clean(card.gstin);
  const pin = cardPin(card);
  // What the business accepts and roughly what it costs: two fields Google shows in a local result.
  const chips = card.pages.flatMap((p) => p.blocks).flatMap((b) => (b.kind === "highlights" ? b.items : [])).join(" ");
  const pays = [...new Set((chips.match(/\b(UPI|cash|cards?|GPay|PhonePe|Paytm|cheque|EMI|NEFT)\b/gi) ?? []).map((x) => (/^(gpay|phonepe|paytm)$/i.test(x) ? "UPI" : /^cards?$/i.test(x) ? "Card" : x[0].toUpperCase() + x.slice(1).toLowerCase())))];
  const paymentAccepted = [...new Set([...pays, ...(card.links.some((l) => l.type === "upi") ? ["UPI"] : [])])];
  const amounts = find(card, "product").flatMap((b) => b.items).map((p) => Number(price(p.price))).filter((n) => Number.isFinite(n) && n > 0);
  const priceRange = amounts.length ? (Math.min(...amounts) === Math.max(...amounts) ? `₹${Math.min(...amounts)}` : `₹${Math.min(...amounts)}–₹${Math.max(...amounts)}`) : "";
  const business: Record<string, unknown> = {
    // The trade's own schema.org type (Bakery, Dentist, FurnitureStore…): a bare LocalBusiness wins no rich result.
    "@type": isBusiness ? schemaTypeFor(card.seo?.categoryKey ?? "") : "Person",
    "@id": `${opts.homeUrl}#business`,
    name: f.business,
    url: opts.homeUrl,
    description: cut(clean(card.about) || clean(card.tagline) || seoDescription(card), 300),
    ...(image ? { image } : {}),
    ...(isBusiness && logo ? { logo } : {}),
    ...(map ? { hasMap: map } : {}),
    ...(f.phone ? { telephone: f.phone } : {}),
    ...(f.email ? { email: f.email } : {}),
    ...(f.address || f.city ? { address: { "@type": "PostalAddress", ...(f.address ? { streetAddress: f.address } : {}), ...(f.city ? { addressLocality: f.city } : {}), ...(f.address.match(/\b\d{6}\b/) ? { postalCode: f.address.match(/\b\d{6}\b/)![0] } : {}), addressCountry: "IN" } } : {}),
    ...(isBusiness && areas.length ? { areaServed: areas.map((name) => ({ "@type": "Place", name })) } : {}),
    ...(isBusiness && hours.length ? { openingHoursSpecification: hours } : {}),
    ...(isBusiness && gstin ? { taxID: gstin } : {}),
    ...(isBusiness && paymentAccepted.length ? { paymentAccepted: paymentAccepted.join(", ") } : {}),
    ...(isBusiness && priceRange ? { priceRange } : {}),
    ...(isBusiness && pin ? { geo: { "@type": "GeoCoordinates", latitude: pin.lat, longitude: pin.lng } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(isBusiness && catalogue.length ? { hasOfferCatalog: { "@type": "OfferCatalog", name: `${f.business} — products and services`, itemListElement: catalogue } } : {}),
    ...(isBusiness && f.person && f.person.toLowerCase() !== f.business.toLowerCase() ? { founder: { "@type": "Person", name: f.person, ...(card.jobTitle ? { jobTitle: card.jobTitle } : {}), ...(web(card.avatarUrl) ? { image: web(card.avatarUrl) } : {}) } } : {}),
    ...(!isBusiness && card.jobTitle ? { jobTitle: card.jobTitle } : {}),
  };
  const graph: Record<string, unknown>[] = [business, { "@type": "WebSite", "@id": `${opts.homeUrl}#website`, url: opts.homeUrl, name: f.business, inLanguage: card.language || "en-IN" }];
  const faqPage = opts.page ?? card.pages[0];
  const faqs = (faqPage?.blocks ?? []).filter((b): b is Extract<CardBlock, { kind: "faq" }> => b.kind === "faq").flatMap((b) => b.items).filter((i) => i.q && i.a);
  if (faqs.length) graph.push({ "@type": "FAQPage", mainEntity: faqs.slice(0, 20).map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) });
  // One product at its own address is a Product, not just a page of the business: name, picture, price and
  // who sells it, so it can win a result of its own.
  const prod = opts.product;
  if (prod) {
    const pic = [prod.imageUrl, ...(prod.images ?? [])].filter((u): u is string => !!u && /^https?:\/\//.test(u)).slice(0, 4);
    const amount = price(prod.price);
    graph.push({
      "@type": "Product",
      "@id": `${opts.url}#product`,
      name: cut(clean(prod.name), 120),
      ...(prod.desc ? { description: cut(clean(prod.desc), 300) } : {}),
      ...(pic.length ? { image: pic } : {}),
      ...(prod.features?.length ? { additionalProperty: prod.features.slice(0, 8).map((v) => ({ "@type": "PropertyValue", name: "Feature", value: cut(clean(v), 120) })) } : {}),
      brand: { "@type": "Brand", name: f.business },
      ...(amount ? { offers: { "@type": "Offer", price: amount, priceCurrency: "INR", availability: "https://schema.org/InStock", url: opts.url, seller: { "@id": `${opts.homeUrl}#business` } } } : {}),
    });
  }
  if (opts.page && opts.page !== card.pages[0] && opts.page.slug !== "home") {
    graph.push({ "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: f.business, item: opts.homeUrl },
      { "@type": "ListItem", position: 2, name: opts.page.label, item: opts.url },
    ] });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** One line of real, visible local text for the footer: "Sweet shop in Jaipur · Serving C-Scheme, Vaishali Nagar". */
export function localLine(card: Card): string {
  const f = seoFacts(card);
  if (!f.city && !f.areas.length) return "";
  const head = f.category ? `${f.category}${f.city ? ` in ${f.city}` : ""}` : f.city;
  // The city is already in `head`; an area that repeats it is not a second place. (The builder drops these
  // now — this is for the cards built before it did.)
  const areas = f.areas.filter((a) => a.trim().toLowerCase() !== f.city.trim().toLowerCase());
  return areas.length ? `${head} · Serving ${areas.join(", ")}` : head;
}

/** Link to a page of the card: /c/<user>/<slug> on Shubhora, /<slug> on the owner's own domain. */
export const pageHref = (base: string, slug: string, first: boolean) => (first ? base || "/" : `${base}/${slug}`);
