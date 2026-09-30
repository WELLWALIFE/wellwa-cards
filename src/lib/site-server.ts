// Website generator: the paid "Improve with AI" writes better words for the card the owner already has and
// MERGES them in — it never replaces pages. Prices, specs, photos, the gallery, hours, the offer and the full
// address stay exactly as the owner saved them; only empty text is filled, an About page is added and the hero
// wording is refreshed. One Gemini call for the copy; the page/block structure is the owner's.
import { aiImage, storeImage } from "@/lib/media/ai-image";
import { numberCheck } from "@/lib/card-ai";
import { getTemplate } from "@/lib/templates";
import { readReference, type Reference } from "@/lib/reference-site";
import { cleanStyle, styleFromReference } from "@/lib/site-style";
import { cleanHome } from "@/lib/site-home";
import type { SiteHome, SiteStyle } from "@/lib/types";
import { loadProducts } from "@/lib/card-inputs";
import { restAsService } from "@/lib/poster-server";
import { SITE_URL } from "@/lib/social-server";
import type { SavedProduct } from "@/lib/card-facts";
import type { Card, CardBlock, CardPage, ProductItem } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);
const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`);

export type CardRow = { id: string; username: string; owner_id: string; data: Card };
export async function myCards(userId: string): Promise<CardRow[]> {
  const d = (await restAsService<CardRow[]>(`cards?owner_id=eq.${userId}&order=created_at.desc&select=id,username,owner_id,data`)).data;
  return Array.isArray(d) ? d : [];
}
/** The chosen card (must be the caller's), else their newest one. */
export async function myCard(userId: string, cardId?: string): Promise<CardRow | null> {
  const all = await myCards(userId);
  return (cardId ? all.find((c) => c.id === cardId) : undefined) ?? all[0] ?? null;
}

type Profile = { id: string; name: string; tagline: string | null; phone: string | null; city: string | null; photo_url: string | null; logo_url: string | null; lang: string; persona: string };
type Review = { customer_name: string; text: string; rating: number; city: string };

async function gather(userId: string) {
  const list = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  const profiles = list<Profile>((await restAsService(`poster_profiles?user_id=eq.${userId}&order=is_default.desc,created_at&select=id,name,tagline,phone,city,photo_url,logo_url,lang,persona`)).data);
  const profile = profiles[0] ?? null;
  // The same product rows the V-Card uses: price, MRP, brand and the photos in studio-first order.
  const { products } = await loadProducts(userId);
  const reviews = list<Review>((await restAsService(`poster_testimonials?user_id=eq.${userId}&approved=eq.true&order=created_at.desc&limit=8&select=customer_name,text,rating,city`)).data);
  // Daily posters are dated and watermarked, so they are never put in the website gallery.
  return { profile, products, reviews };
}

type Copy = {
  hero: { headline: string; sub: string; cta: string };
  about: { title: string; body: string };
  products: { name: string; desc: string; features: string[]; badge?: string }[];
  services: { name: string; desc: string }[];
  faq: { q: string; a: string }[];
  seoTitle: string; seoDescription: string; contactNote: string;
};
const LANG: Record<string, string> = { en: "simple Indian English", hi: "Hindi (Devanagari)", hinglish: "Hinglish (Hindi in Roman letters)" };

async function writeCopy(card: Card, g: Awaited<ReturnType<typeof gather>>, lang: string, ref?: Reference | null): Promise<Copy> {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("AI not configured");
  const p = g.profile;
  const biz = card.company || p?.tagline || card.name || p?.name || "the business";
  const prompt = `You are a web copywriter for small Indian businesses. Write the website copy for "${biz}" in ${LANG[lang] ?? LANG.hinglish}. Return ONLY JSON.

BUSINESS
Name: ${card.name || p?.name || ""} | Business/brand: ${biz} | Role/tagline: ${card.jobTitle || p?.tagline || ""} | City: ${p?.city || ""}
Existing about text: ${card.about || "(none)"}
Facts / FAQ / prices the owner wrote (use ONLY these facts, never invent prices, claims or numbers): ${card.botKnowledge?.slice(0, 2500) || "(none)"}
Products: ${g.products.length ? g.products.map((x) => `${x.name}${x.price ? ` (₹${x.price})` : ""}${x.offer ? ` (offer: ${x.offer})` : ""} — ${x.benefits.slice(0, 5).join("; ")}`).join("\n") : "(none)"}
Customer reviews: ${g.reviews.length ? g.reviews.map((r) => `${r.customer_name} (${r.rating}★): ${r.text}`).join("\n") : "(none)"}
${ref ? `
REFERENCE WEBSITE the owner likes (${ref.url}) — use it ONLY as inspiration for tone, the kind of sections and how headings are phrased.
Never copy its sentences, brand names, prices, numbers or claims; every fact must come from BUSINESS above.
${ref.summary}
` : ""}
JSON shape:
{"hero":{"headline":"<max 8 words, benefit-led>","sub":"<1-2 sentences, max 30 words>","cta":"<button text, max 4 words, e.g. WhatsApp par baat karein>"},
 "about":{"title":"<max 5 words>","body":"<2 short paragraphs, 60-110 words total, first person plural>"},
 "products":[{"name":"<EXACT product name from the list>","desc":"<max 25 words>","features":["<2-4 words>","...","..."],"badge":"<optional, e.g. Bestseller, or empty>"}],
 "services":[{"name":"","desc":"<max 20 words>"}],
 "faq":[{"q":"","a":"<max 35 words>"}],
 "seoTitle":"<max 60 chars>","seoDescription":"<max 155 chars>","contactNote":"<1 sentence inviting WhatsApp/call>"}
Rules: exactly one products entry per listed product (same name). services ONLY when there are no products AND the facts above name the services — otherwise []. faq: up to 5 questions that the facts above actually answer; if the facts answer none, return []. Never invent a question or an answer. Truthful — no medical/cure claims, no guaranteed income, no invented prices or discounts. Write any price the owner gave with the ₹ sign.`;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: 2500 } }) });
  const j = await r.json().catch(() => ({}));
  const raw = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const strs = (a: unknown, n: number, len: number) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, len)).slice(0, n) : []);
  // The same number check the free V-Card uses: a year, a count, a price or a "since" the owner never gave is
  // an invented fact, and this is a real business's public website. Sentences carrying one are dropped.
  const { backed, keep } = numberCheck([
    card.name, p?.name, biz, card.jobTitle, p?.tagline, p?.city, card.about, card.botKnowledge,
    ...g.products.map((x) => [x.name, x.price, x.mrp, x.offer, x.benefits.join(" ")].filter(Boolean).join(" ")),
    ...g.reviews.map((r) => `${r.customer_name} ${r.rating} ${r.text}`),
  ].filter(Boolean).join(" "));
  const headline = S(raw.hero?.headline, 80);
  const cta = S(raw.hero?.cta, 30);
  const aboutBody = S(raw.about?.body, 900);
  // An empty reply is still a failed call (the owner paid for this one). A reply whose headline or about text
  // was emptied by the number check is NOT: those two fall back to the owner's own words below.
  if (!headline || !aboutBody) throw new Error("AI copy incomplete");
  const copy: Copy = {
    hero: {
      headline: backed(headline) ? headline : S(card.tagline || card.company || card.name || biz, 80),
      sub: keep(S(raw.hero?.sub, 220)),
      cta: backed(cta) ? cta : "",
    },
    about: { title: S(raw.about?.title, 40) || "About", body: keep(aboutBody) || S(card.about, 900) },
    products: (Array.isArray(raw.products) ? raw.products : []).map((x: Record<string, unknown>) => {
      const badge = S(x.badge, 20);
      return { name: S(x.name, 60), desc: keep(S(x.desc, 200)), features: strs(x.features, 4, 40).filter(backed), badge: backed(badge) ? badge : "" };
    }).filter((x: { name: string }) => x.name),
    services: (Array.isArray(raw.services) ? raw.services : []).map((x: Record<string, unknown>) => ({ name: S(x.name, 60), desc: keep(S(x.desc, 160)) })).filter((x: { name: string }) => x.name && backed(x.name)).slice(0, 6),
    faq: (Array.isArray(raw.faq) ? raw.faq : []).map((x: Record<string, unknown>) => ({ q: S(x.q, 120), a: S(x.a, 300) })).filter((x: { q: string; a: string }) => x.q && x.a && backed(`${x.q} ${x.a}`)).slice(0, 5),
    seoTitle: backed(S(raw.seoTitle, 70)) ? S(raw.seoTitle, 70) : "", seoDescription: keep(S(raw.seoDescription, 160)), contactNote: keep(S(raw.contactNote, 160)),
  };
  // Last resort, so a number check never costs the owner a paid job: words built by code from the facts.
  if (!copy.hero.headline) copy.hero.headline = S(biz, 80);
  if (!copy.about.body) copy.about.body = `${[biz, card.jobTitle || p?.tagline, p?.city].filter(Boolean).join(" — ")}.`;
  return copy;
}

export type GenerateOptions = { photos?: number; reference?: Reference | null; details?: string };

/**
 * The only two AI photos the website uses. Both are deliberately impersonal: an invented "owner", "team" or
 * "the shop of <business>" would be a fake person and a fake place on a real business's website.
 */
const PHOTO_PROMPT = {
  hero: (job: string) => `Wide, softly blurred ambience photograph suggesting a ${job} in India — surfaces, light and colour only. No people, faces or hands, no text, no logos, no brand names, not a specific shop.`,
  about: (job: string) => `Close-up still-life photograph of everyday tools or materials of a ${job}, soft light. No people, no text, no logos, no brand names.`,
};
const jobOf = (card: Card, tagline?: string | null) => card.jobTitle || card.company || tagline || card.name || "small business";

/** AI photos for the website: the top banner and the About section. Nothing else. */
async function makePhotos(userId: string, count: number, card: Card, g: Awaited<ReturnType<typeof gather>>) {
  const job = jobOf(card, g.profile?.tagline);
  const slots = ([
    { key: "hero", ratio: "16:9", prompt: PHOTO_PROMPT.hero(job) },
    { key: "about", ratio: "4:3", prompt: PHOTO_PROMPT.about(job) },
  ] as const).slice(0, Math.max(0, count));
  const made = await Promise.all(slots.map(async (sl) => {
    const png = await aiImage(sl.prompt, sl.ratio);
    const url = png ? await storeImage(userId, `site-${sl.key}`, png) : null;
    return url ? { key: sl.key as string, url } : null;
  }));
  return { wanted: slots.length, photos: made.filter((x): x is { key: string; url: string } => !!x) };
}

type AboutBlock = Extract<CardBlock, { kind: "about" }>;
const isAbout = (b: CardBlock): b is AboutBlock => b.kind === "about";

/** A saved product → a website product card, with the owner's own price, MRP and photos. */
function toItem(pr: SavedProduct, c: Copy["products"][number] | undefined, lang: string): ProductItem {
  const images = pr.images.map(abs);
  return {
    name: pr.name,
    imageUrl: images[0],
    images,
    price: pr.price || undefined,
    mrp: pr.mrp || undefined,
    desc: c?.desc || pr.benefits[0] || "",
    // The owner's own benefit lines always win; the AI's are only for a product they wrote nothing about.
    features: pr.benefits.length ? pr.benefits.slice(0, 4) : c?.features ?? [],
    specs: pr.brand ? [{ label: "Brand", value: pr.brand }] : [],
    badge: pr.offer ? pr.offer.slice(0, 20) : undefined,
    ctaLabel: lang === "en" ? "Order on WhatsApp" : lang === "hi" ? "WhatsApp पर ऑर्डर करें" : "WhatsApp par order karein",
  };
}

/**
 * Paid "Improve with AI": better words merged into the card the owner already has.
 * What is NEVER touched: product prices, MRP, specs, images and badges; gallery, hours, location, offer, image,
 * carousel, video, pdf and cta blocks; site.logoUrl, hidden and templateKey.
 */
export async function generateSite(userId: string, langOverride?: string, cardId?: string, opts: GenerateOptions = {}): Promise<{ card: Card; photosWanted: number; photosMade: number }> {
  const row = await myCard(userId, cardId);
  if (!row) throw new Error("NO_CARD");
  // The owner's own description (from the form) becomes the card's business knowledge: the AI writes from it now,
  // and the card chat / WhatsApp assistant answer from it later.
  const card = opts.details && opts.details.trim() ? { ...row.data, botKnowledge: opts.details.trim().slice(0, 4000) } : row.data;
  const g = await gather(userId);
  const lang = langOverride && LANG[langOverride] ? langOverride : (card.language && LANG[card.language] ? card.language : g.profile?.lang === "en" ? "en" : g.profile?.lang === "hi" ? "hi" : "hinglish");
  const copy = await writeCopy(card, g, lang, opts.reference);
  const shots = opts.photos ? await makePhotos(userId, opts.photos, card, g) : { wanted: 0, photos: [] };
  const shot = (k: string) => shots.photos.find((x) => x.key === k)?.url;
  const p = g.profile;
  const copyFor = (name: string) => copy.products.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());

  // The owner's pages are the starting point — this is a merge, not a rebuild.
  const pages: CardPage[] = structuredClone(card.pages ?? []);

  // 1. Products already on the card: fill an empty description or feature list, nothing else.
  let hasProductBlock = false;
  for (const pg of pages) {
    for (const b of pg.blocks) {
      if (b.kind !== "product") continue;
      hasProductBlock = true;
      for (const it of b.items) {
        const c = copyFor(it.name);
        if (!c) continue;
        if (!(it.desc ?? "").trim() && c.desc) it.desc = c.desc;
        if (!(it.features ?? []).length && c.features.length) it.features = c.features;
      }
    }
  }

  // 2. No product block at all, but the owner has products: give the website a products page.
  if (!hasProductBlock && g.products.length) {
    const items = g.products.map((pr) => toItem(pr, copyFor(pr.name), lang));
    const homeAt = pages.findIndex((pg) => pg.slug === "home");
    pages.splice(homeAt < 0 ? pages.length : homeAt + 1, 0, {
      id: uid(), slug: "products", label: "Products",
      blocks: [{ id: uid(), kind: "product", title: lang === "en" ? "Our products" : "Hamare products", items }],
    });
  }

  // 3. Real customer reviews, only when the card does not show any yet.
  const home = pages.find((pg) => pg.slug === "home") ?? pages[0];
  const hasReviews = pages.some((pg) => pg.blocks.some((b) => b.kind === "testimonials" && b.items.length > 0));
  if (home && !hasReviews && g.reviews.length) {
    const block: CardBlock = {
      id: uid(), kind: "testimonials", title: lang === "en" ? "What customers say" : "Customers kya kehte hain",
      items: g.reviews.slice(0, 5).map((r) => ({ name: r.city ? `${r.customer_name}, ${r.city}` : r.customer_name, text: r.text, rating: r.rating })),
    };
    const at = home.blocks.findIndex((b) => b.kind === "contact" || b.kind === "appointment");
    home.blocks.splice(at < 0 ? home.blocks.length : at, 0, block);
  }

  // 4. The About story: update the About page if there is one, else add one.
  const aboutShot = shot("about");
  const aboutPage = pages.find((pg) => pg.slug === "about");
  if (aboutPage) {
    const b = aboutPage.blocks.find(isAbout);
    if (b) {
      b.title = copy.about.title || b.title;
      b.body = copy.about.body || b.body;
      if (aboutShot) b.imageUrl = aboutShot;
    } else {
      aboutPage.blocks.unshift({ id: uid(), kind: "about", title: copy.about.title, body: copy.about.body, ...(aboutShot ? { imageUrl: aboutShot } : {}) });
    }
  } else {
    const oldImage = pages.flatMap((pg) => pg.blocks).find(isAbout)?.imageUrl;
    const hasFaq = pages.some((pg) => pg.blocks.some((b) => b.kind === "faq"));
    const image = aboutShot ?? oldImage;
    const blocks: CardBlock[] = [
      { id: uid(), kind: "about", title: copy.about.title, body: copy.about.body, ...(image ? { imageUrl: image } : {}) },
      ...(copy.faq.length >= 2 && !hasFaq ? [{ id: uid(), kind: "faq" as const, title: "FAQ", items: copy.faq }] : []),
    ];
    let at = pages.findIndex((pg) => pg.slug === "home");
    at = at < 0 ? 0 : at + 1;
    const cat = pages.findIndex((pg) => pg.slug === "products" || pg.slug === "services");
    if (cat >= 0) at = Math.max(at, cat + 1);
    pages.splice(at, 0, { id: uid(), slug: "about", label: "About", blocks });
  }

  const heroImage = shot("hero") ?? card.site?.hero?.imageUrl ?? (g.products[0]?.images[0] ? abs(g.products[0].images[0]) : p?.logo_url ? abs(p.logo_url) : undefined);
  const next: Card = {
    ...card,
    id: row.id, username: row.username,
    about: card.about || copy.about.body,
    tagline: card.tagline || copy.hero.headline,
    seoTitle: copy.seoTitle || card.seoTitle, seoDescription: copy.seoDescription || card.seoDescription,
    language: lang,
    pages,
    site: {
      ...(card.site ?? {}),
      enabled: true,
      hero: {
        headline: card.site?.hero?.headline || card.company || card.name,
        sub: copy.hero.sub || card.site?.hero?.sub || "",
        ...(heroImage ? { imageUrl: heroImage } : {}),
        ...(copy.hero.cta || card.site?.hero?.ctaLabel ? { ctaLabel: copy.hero.cta || card.site?.hero?.ctaLabel } : {}),
      },
      generatedAt: new Date().toISOString(),
      // "Make it like this website": its colours, fonts and hero layout come along (never its words or facts).
      ...(opts.reference?.style ? { style: { ...(card.site?.style ?? {}), ...styleFromReference(opts.reference.style) }, reference: { url: opts.reference.url, at: new Date().toISOString() } } : {}),
    },
  };
  const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ data: next, about: next.about, company: next.company, tagline: next.tagline }) });
  if (!r.ok) throw new Error(r.text.slice(0, 200) || "save failed");
  return { card: next, photosWanted: shots.wanted, photosMade: shots.photos.length };
}

/** Art we generated for a template — not a photo the owner uploaded. */
const isOurArt = (url: string) => /^(?:https?:\/\/[^/]+)?\/(?:art|wellwa)\//i.test(url);

/**
 * Free "Change the look": colours and layout only. The owner's pages, products, prices, photos and text stay.
 * A company's own design (e.g. Wellwa) is different: it ships that company's real pages, so it still replaces them.
 */
export async function applySiteTemplate(userId: string, key: string, cardId?: string): Promise<Card> {
  const row = await myCard(userId, cardId);
  if (!row) throw new Error("NO_CARD");
  const t = getTemplate(key);
  if (!t || key === "blank") throw new Error("Template not found");
  const cur = row.data; const tpl = t.data;
  // The owner's own cover photo always wins; a generated art cover may be swapped for the new look's cover.
  const ownCover = cur.coverUrl && !isOurArt(cur.coverUrl) ? cur.coverUrl : "";
  const next: Card = t.brand
    ? {
      ...cur,
      id: row.id, username: row.username,
      pages: tpl.pages.map((pg) => ({ ...pg, id: uid(), blocks: pg.blocks.map((b) => ({ ...b, id: uid() })) })),
      themeColor: tpl.themeColor || cur.themeColor,
      template: tpl.template ?? cur.template,
      coverUrl: cur.coverUrl || tpl.coverUrl,
      tagline: cur.tagline || tpl.tagline,
      about: cur.about || tpl.about,
      botPersona: cur.botPersona || tpl.botPersona,
      site: { ...(cur.site ?? {}), enabled: true, hero: { headline: cur.company || cur.name || tpl.company, sub: cur.tagline || tpl.tagline || "", imageUrl: cur.site?.hero?.imageUrl || tpl.coverUrl }, generatedAt: cur.site?.generatedAt, templateKey: key },
    }
    : {
      ...cur,
      id: row.id, username: row.username,
      themeColor: tpl.themeColor || cur.themeColor,
      avatarColor: tpl.avatarColor || cur.avatarColor,
      template: tpl.template ?? cur.template,
      coverUrl: ownCover || tpl.coverUrl || cur.coverUrl,
      site: {
        ...(cur.site ?? {}),
        enabled: true,
        hero: cur.site?.hero ?? { headline: cur.company || cur.name, sub: cur.tagline || "" },
        templateKey: key,
      },
    };
  const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ data: next, about: next.about, tagline: next.tagline }) });
  if (!r.ok) throw new Error(r.text.slice(0, 200) || "save failed");
  return next;
}

/** One new AI photo for the website hero or about section (charged by the caller). */
export async function newSitePhoto(userId: string, slot: "hero" | "about", cardId?: string): Promise<string | null> {
  const row = await myCard(userId, cardId);
  if (!row) throw new Error("NO_CARD");
  const c = row.data;
  const png = await aiImage(PHOTO_PROMPT[slot](jobOf(c)), slot === "hero" ? "16:9" : "4:3");
  const url = png ? await storeImage(userId, `site-${slot}`, png) : null;
  if (!url) return null;
  const data: Card = slot === "hero"
    ? { ...c, site: { ...(c.site ?? { enabled: true }), hero: { headline: c.site?.hero?.headline ?? (c.company || c.name), sub: c.site?.hero?.sub ?? "", ...(c.site?.hero ?? {}), imageUrl: url } } }
    : { ...c, pages: c.pages.map((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (b.kind === "about" ? { ...b, imageUrl: url } : b)) })) };
  const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ data }) });
  return r.ok ? url : null;
}

export async function siteStatus(userId: string, cardId?: string, opts: { full?: boolean } = {}) {
  const all = await myCards(userId);
  const row = (cardId ? all.find((c) => c.id === cardId) : undefined) ?? all[0];
  if (!row) return { hasCard: false as const };
  const c = row.data;
  // Image choices for the desktop hero: brand logo, the card's own images, product photos.
  const prof = (await restAsService<{ logo_url: string | null }[]>(`poster_profiles?user_id=eq.${userId}&order=is_default.desc,created_at&limit=1&select=logo_url`)).data;
  const prods = (await restAsService<{ name: string; photo_url: string | null }[]>(`poster_products?user_id=eq.${userId}&active=eq.true&order=sort,created_at&limit=8&select=name,photo_url`)).data;
  const images: { label: string; url: string }[] = [];
  const logo = Array.isArray(prof) ? prof[0]?.logo_url : null; if (logo) images.push({ label: "Logo", url: abs(logo) });
  if (c.coverUrl?.startsWith("http")) images.push({ label: "Cover", url: c.coverUrl });
  for (const p of Array.isArray(prods) ? prods : []) if (p.photo_url) images.push({ label: p.name, url: abs(p.photo_url) });
  for (const pg of c.pages) for (const b of pg.blocks) if (b.kind === "product") for (const it of b.items) { const u = it.images?.[0] ?? it.imageUrl; if (u?.startsWith("http") && !images.some((x) => x.url === u)) images.push({ label: it.name, url: u }); }
  return {
    hasCard: true as const, cards: all.map((x) => ({ id: x.id, username: x.username, name: x.data.company || x.data.name || x.username })), cardId: row.id, username: row.username, url: `${SITE_URL}/c/${row.username}`, customDomain: c.customDomain ?? "", knowledge: c.botKnowledge ?? "", site: c.site ?? null, pages: c.pages.map((p) => ({ slug: p.slug, label: p.label, blocks: p.blocks.length })), images: images.slice(0, 12), defaults: { headline: c.company || c.name, sub: (c.about || "").split(/\n+/)[0]?.slice(0, 220) || c.tagline || "", jobTitle: c.jobTitle },
    // The website editor renders a live preview from the whole card.
    ...(opts.full ? { card: { ...c, id: row.id, username: row.username } } : {}),
  };
}

export type SitePatch = {
  enabled?: boolean; hidden?: string[]; hideProfile?: boolean; logoUrl?: string;
  hero?: { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
  /** Design choices from the website editor (already cleaned, see cleanStyle). Replaces the stored style. */
  style?: SiteStyle;
  /** Home-page section order / hidden sections / trust facts (already cleaned, see cleanHome). */
  home?: SiteHome;
  /** "Make it look like this website": read once, its style copied onto the card (no AI, no credits). */
  referenceUrl?: string;
  /** Announcement bar; `null` removes it. */
  bar?: { text: string; link?: string; until?: string } | null;
  float?: "whatsapp" | "call" | "none";
};
export async function patchSite(userId: string, patch: SitePatch, cardId?: string) {
  const row = await myCard(userId, cardId);
  if (!row) throw new Error("NO_CARD");
  const prev = row.data.site ?? { enabled: false };
  const hero = patch.hero ? { headline: "", sub: "", ...(prev.hero ?? {}), ...patch.hero } : prev.hero;
  let style = patch.style ?? prev.style;
  let reference = prev.reference;
  if (patch.referenceUrl) {
    const ref = await readReference(patch.referenceUrl);
    if (!ref) throw new Error("REFERENCE_UNREADABLE");
    if (ref.style) style = { ...(style ?? {}), ...styleFromReference(ref.style) };
    reference = { url: ref.url, at: new Date().toISOString() };
  }
  const site = {
    ...prev,
    enabled: patch.enabled ?? prev.enabled ?? false,
    ...(patch.hidden ? { hidden: patch.hidden } : {}),
    ...(patch.hideProfile !== undefined ? { hideProfile: patch.hideProfile } : {}),
    ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl } : {}),
    ...(hero ? { hero } : {}),
    ...(style ? { style } : {}),
    ...(patch.home ? { home: patch.home } : {}),
    ...(reference ? { reference } : {}),
    ...(patch.bar === null ? { bar: undefined } : patch.bar ? { bar: patch.bar } : {}),
    ...(patch.float ? { float: patch.float } : {}),
  };
  const data = { ...row.data, site };
  const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ data }) });
  if (!r.ok) throw new Error(r.text.slice(0, 200) || "save failed");
  return site;
}
export { cleanStyle, cleanHome };

/** The owner's recent daily posters for the website's Updates page (today and earlier — never tomorrow's preview).
 *  Public pictures the owner already posts on WhatsApp / Facebook; nothing private. */
export async function recentUpdates(username: string, limit = 12): Promise<{ date: string; url: string; title: string; caption?: string | null }[]> {
  try {
    const owner = (await restAsService<{ owner_id: string }[]>(`cards?username=eq.${encodeURIComponent(username)}&select=owner_id&limit=1`)).data?.[0]?.owner_id;
    if (!owner) return [];
    const profs = (await restAsService<{ id: string }[]>(`poster_profiles?user_id=eq.${owner}&select=id`)).data ?? [];
    if (!profs.length) return [];
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const rows = (await restAsService<{ for_date: string; title: string; url: string; caption: string | null }[]>(`posters?profile_id=in.(${profs.map((p) => p.id).join(",")})&for_date=lte.${today}&url=neq.&order=for_date.desc&limit=${limit}&select=for_date,title,url,caption`)).data ?? [];
    const seen = new Set<string>();
    return rows.filter((r) => r.url && !seen.has(r.for_date) && seen.add(r.for_date)).map((r) => ({ date: r.for_date, url: abs(String(r.url).split("?")[0]), title: r.title || "", caption: r.caption }));
  } catch { return []; }
}
