// The text manager — the last reader of a built card before it is shown (owner's call, 2 Oct 2026: "text website ke
// hisaab se kam na ho, aur sab ek baar me perfect"). It holds every section to a standard a real website needs
// (an about of two or three paragraphs, a line under every service, five to seven questions with real answers,
// four to six reasons…), fills what the trade's own seeds can fill — in code, free, at once — and lists what
// only writing can fix, so the build makes ONE short AI ask for exactly those spots (card-ai.ts fillThinText)
// and comes back here to apply the answers. Nothing is ever left thin: a spot the AI did not fill gets a plain
// sentence from the facts rather than a hole.
//
// Isomorphic: no 'use client', no 'server-only'. Pure: the card in, a new card out.
import type { CardBlock, FaqItem, ProductItem, ServiceItem } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import type { TradeData } from "@/lib/trade-data/types";
import type { Lang } from "@/lib/card-facts";
import { isGeneric } from "@/lib/site-recipes";

/* ---- the standard: what each section needs before it reads as a finished website ---- */
export const TEXT_STANDARD = {
  heroSub: { min: 30, max: 160 },
  about: { minChars: 280, minParas: 2 },
  serviceDesc: { min: 25 },
  services: { min: 3 },
  whyUs: { min: 4, max: 6 },
  steps: { min: 3 },
  faq: { min: 5, answerMin: 50 },
  productDesc: { min: 30 },
} as const;

/** One place the card is thinner than the standard, in words the writer (AI) can act on. */
export type ThinSpot = {
  /** Stable address, e.g. "about", "hero.sub", "service:Root canal", "faq:2", "product:Kaju Katli". */
  id: string;
  /** Where on the site, for the owner's report. */
  where: string;
  /** What to write — length, shape, what it must say. */
  want: string;
  /** What is there now (may be empty). */
  have: string;
};

export type TextReport = { card: TemplateCard; filled: string[]; thin: ThinSpot[] };

export type TextContext = {
  trade: TradeData | null;
  lang: Lang;
  /** The business as it is named on the card, its trade in words, its city; "since" when known. */
  business: string;
  tradeLabel: string;
  city: string;
  since?: string;
};

type Services = Extract<CardBlock, { kind: "services" }>;
type Highlights = Extract<CardBlock, { kind: "highlights" }>;
type About = Extract<CardBlock, { kind: "about" }>;

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sameText = (a: string, b: string) => {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.split(" ").slice(0, 3).join(" ") === nb.split(" ").slice(0, 3).join(" ")) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length >= 4)), wb = new Set(nb.split(" ").filter((w) => w.length >= 4));
  if (!wa.size || !wb.size) return false;
  let shared = 0; for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.6;
};
const isSteps = (b: Services) => /^\d+[.)]\s/.test(b.items[0]?.name ?? "");
const isWhyUs = (b: Highlights) => b.items.length >= 3 && b.items.every((x) => (x ?? "").startsWith("✅"));
const paras = (s: string) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
/** An English-only line on a Hindi card (letters only, no Devanagari), long enough to be a sentence. */
const englishOnly = (s: string) => /^[A-Za-z][A-Za-z0-9 ,.'&()/-]{8,}$/.test((s ?? "").trim()) && !/[ऀ-ॿ]/.test(s);

/** A copy of the card with every page and block its own object, so nothing of the input is changed. */
const clone = (card: TemplateCard): TemplateCard => ({ ...card, pages: card.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b })) })), site: card.site ? { ...card.site, hero: card.site.hero ? { ...card.site.hero } : undefined } : card.site });

/** Hold the card to the standard: fill from the seeds what can be filled, list what only writing can fix. */
export function textAudit(input: TemplateCard, ctx: TextContext): TextReport {
  const card = clone(input);
  const filled: string[] = [];
  const thin: ThinSpot[] = [];
  const hi = ctx.lang === "hi";
  const trade = ctx.trade;
  const seedLine = (x: { en: string; hi: string; desc: string; descHi: string }) => (hi ? { name: x.hi, desc: x.descHi } : { name: x.en, desc: x.desc });
  const all = card.pages.flatMap((p) => p.blocks);

  /* ---- hero line ---- */
  const about = all.find((b): b is About => b.kind === "about" && (b.body ?? "").trim().length > 0);
  if (card.site) {
    const sub = (card.site.hero?.sub ?? "").trim();
    // An EMPTY sub is left alone: the website then prints the trade group's benefit line (site-hero.ts heroModel).
    // A short one is lengthened only from the owner's own about text — never "<Trade> in <City>, since <Y>", which
    // read as data, not a reason to stay (docs/premium-look.md §3.1, §5).
    if (sub && sub.length < TEXT_STANDARD.heroSub.min) {
      const first = paras(about?.body ?? "")[0]?.split(/(?<=[.!?।])\s/)[0] ?? "";
      if (first.length >= TEXT_STANDARD.heroSub.min && first.length <= TEXT_STANDARD.heroSub.max) {
        card.site = { ...card.site, hero: { ...card.site.hero, headline: card.site.hero?.headline ?? "", sub: first } };
        filled.push("hero line");
      }
    }
  }

  /* ---- about: two or three paragraphs, or it goes to the writer ---- */
  const aboutText = (about?.body ?? "").trim();
  if (!about || aboutText.length < TEXT_STANDARD.about.minChars || paras(aboutText).length < TEXT_STANDARD.about.minParas) {
    thin.push({ id: "about", where: hi ? "परिचय" : "About", want: `110-170 words in 2-3 short paragraphs, first person plural: who they are, since when, what exactly they do and for whom, how they work. ${explainHint(trade)}`, have: aboutText });
  } else if (hi && paras(aboutText).some(englishOnly)) {
    thin.push({ id: "about", where: "परिचय", want: "The same about text, written in Hindi (Devanagari), 110-170 words in 2-3 paragraphs.", have: aboutText });
  }

  /* ---- services: a line under every service; at least three ---- */
  for (const b of all) {
    if (b.kind !== "services" || isSteps(b)) continue;
    const items = b.items.filter((s) => (s.name ?? "").trim());
    // a generic service ("Connect with us") is dropped; the seeds refill below
    const kept = items.filter((s) => !isGeneric(s.name, trade));
    if (kept.length !== items.length) filled.push("dropped a generic service");
    const out: ServiceItem[] = kept.map((s) => ({ ...s }));
    for (const s of out) {
      if ((s.desc ?? "").trim().length >= TEXT_STANDARD.serviceDesc.min) continue;
      const seed = (trade?.services ?? []).map(seedLine).find((x) => sameText(x.name, s.name));
      if (seed) { s.desc = seed.desc; filled.push(`line under "${s.name}"`); }
      else thin.push({ id: `service:${s.name}`, where: `${b.title || (hi ? "सेवाएँ" : "Services")} › ${s.name}`, want: "One line, 8-18 words: what the customer gets from this service and how.", have: s.desc ?? "" });
    }
    for (const seed of (trade?.services ?? []).map(seedLine)) {
      if (out.length >= TEXT_STANDARD.services.min) break;
      if (!out.some((o) => sameText(o.name, seed.name))) { out.push({ name: seed.name, desc: seed.desc }); filled.push(`service "${seed.name}" from the trade`); }
    }
    if (hi) for (const s of out) if (englishOnly(s.name) || englishOnly(s.desc ?? "")) thin.push({ id: `service:${s.name}`, where: `${b.title} › ${s.name}`, want: "This service's name and its one line, in Hindi (Devanagari).", have: `${s.name} — ${s.desc}` });
    b.items = out;
  }

  /* ---- steps: at least three, in order ---- */
  for (const b of all) {
    if (b.kind !== "services" || !isSteps(b)) continue;
    if (b.items.length >= TEXT_STANDARD.steps.min) continue;
    const seeds = (trade?.steps ?? []).map(seedLine);
    if (seeds.length >= TEXT_STANDARD.steps.min) { b.items = seeds.slice(0, 5).map((s, i) => ({ name: `${i + 1}. ${s.name}`, desc: s.desc })); filled.push("steps from the trade"); }
  }

  /* ---- why us: four to six concrete reasons, none generic, none already in the trust strip ---- */
  const trust = all.find((b): b is Highlights => b.kind === "highlights" && !isWhyUs(b));
  for (const b of all) {
    if (b.kind !== "highlights" || !isWhyUs(b)) continue;
    let items = b.items.map((x) => x.trim()).filter(Boolean);
    const before = items.length;
    items = items.filter((x) => !isGeneric(x.replace(/^✅\s*/, ""), trade));
    if (trust) items = items.filter((x) => !trust.items.some((t) => sameText(t, x.replace(/^✅\s*/, ""))));
    if (items.length !== before) filled.push("dropped a generic or repeated why-us point");
    for (const p of trade?.whyUs ?? []) {
      if (items.length >= TEXT_STANDARD.whyUs.min) break;
      const line = hi ? p.hi : p.en;
      if (!items.some((x) => sameText(x, line))) { items.push(`✅ ${line}`); filled.push(`why-us "${line}" from the trade`); }
    }
    b.items = items.slice(0, TEXT_STANDARD.whyUs.max);
  }

  /* ---- FAQ: five to seven questions, each with a real answer ---- */
  for (const b of all) {
    if (b.kind !== "faq") continue;
    const seeds = (trade?.faq ?? []).map((f) => (hi ? { q: f.qHi, a: f.aHi } : { q: f.q, a: f.a }));
    const out: FaqItem[] = b.items.filter((f) => (f.q ?? "").trim()).map((f) => ({ ...f }));
    out.forEach((f, i) => {
      if ((f.a ?? "").trim().length >= TEXT_STANDARD.faq.answerMin) return;
      const seed = seeds.find((s) => sameText(s.q, f.q));
      if (seed) { f.a = seed.a; filled.push(`answer to "${f.q}"`); }
      else thin.push({ id: `faq:${i}`, where: `FAQ › ${f.q}`, want: "A plain, useful answer in 2-3 sentences (40-70 words) — what to do, what to expect; no invented numbers.", have: f.a ?? "" });
    });
    for (const s of seeds) {
      if (out.length >= TEXT_STANDARD.faq.min) break;
      if (!out.some((o) => sameText(o.q, s.q))) { out.push({ q: s.q, a: s.a }); filled.push(`question "${s.q}" from the trade`); }
    }
    b.items = out;
  }

  /* ---- products: a line under each ---- */
  for (const b of all) {
    if (b.kind !== "product") continue;
    for (const p of b.items) {
      if (!(p.name ?? "").trim() || (p.desc ?? "").trim().length >= TEXT_STANDARD.productDesc.min) continue;
      thin.push({ id: `product:${p.name}`, where: `${b.title || "Products"} › ${p.name}`, want: `One or two lines (12-30 words) that sell "${p.name}": what it is, what it is good for, what makes it worth the price. No price, no invented numbers.`, have: p.desc ?? "" });
    }
  }

  /* ---- the same line must not appear twice on the home page ---- */
  const home = card.pages[0];
  if (home) {
    const seen = new Set<string>();
    for (const b of home.blocks) {
      if (b.kind !== "highlights") continue;
      const keep = b.items.filter((x) => { const k = norm(x.replace(/^✅\s*/, "")); if (!k || seen.has(k)) return false; seen.add(k); return true; });
      if (keep.length !== b.items.length) { b.items = keep; filled.push("removed a repeated highlight"); }
    }
  }

  // one spot per address
  const uniq = new Map<string, ThinSpot>();
  for (const t of thin) if (!uniq.has(t.id)) uniq.set(t.id, t);
  return { card, filled: [...new Set(filled)], thin: [...uniq.values()] };
}

/** The writer's answers (id → text) put back into the card; a spot it left out gets a plain line from the facts,
 *  so the card never goes out with a hole. Numbers the facts do not back are the caller's business (card-ai keeps
 *  them out before this is called). */
export function applyThinText(input: TemplateCard, answers: Record<string, string>, thin: ThinSpot[], ctx: TextContext): TemplateCard {
  const card = clone(input);
  const all = card.pages.flatMap((p) => p.blocks);
  const text = (id: string) => (answers[id] ?? "").replace(/\s+/g, " ").trim();
  for (const t of thin) {
    const v = text(t.id);
    if (t.id === "about") {
      const body = v.length >= 120 ? (answers[t.id] ?? "").trim() : plainAbout(card, ctx);
      const about = all.find((b): b is About => b.kind === "about");
      if (about) about.body = body;
      else card.pages[0]?.blocks.splice(Math.min(1, card.pages[0].blocks.length), 0, { id: `about-${Date.now().toString(36)}`, kind: "about", title: ctx.lang === "hi" ? "हमारे बारे में" : "About us", body });
      continue;
    }
    const [kind, key] = [t.id.slice(0, t.id.indexOf(":")), t.id.slice(t.id.indexOf(":") + 1)];
    if (kind === "service") {
      for (const b of all) if (b.kind === "services") for (const s of b.items) if (s.name === key) {
        if (/—/.test(v) && ctx.lang === "hi") { const [n, d] = v.split("—").map((x) => x.trim()); if (n && d) { s.name = n; s.desc = d; continue; } }
        if (v.length >= 15) s.desc = v; else if (!(s.desc ?? "").trim()) s.desc = plainServiceLine(s, ctx);
      }
    } else if (kind === "faq") {
      for (const b of all) if (b.kind === "faq") { const f = b.items[Number(key)]; if (f) f.a = v.length >= 30 ? v : (f.a?.trim() || plainFaqAnswer(ctx)); }
    } else if (kind === "product") {
      for (const b of all) if (b.kind === "product") for (const p of b.items) if (p.name === key) p.desc = v.length >= 15 ? v : (p.desc?.trim() || plainProductLine(p, ctx));
    }
  }
  return card;
}

/* ---- plain lines from the facts: the floor, never the aim ---- */
export function plainAbout(card: TemplateCard, ctx: TextContext): string {
  const hi = ctx.lang === "hi";
  const all = card.pages.flatMap((p) => p.blocks);
  const services = all.filter((b): b is Services => b.kind === "services" && !isSteps(b)).flatMap((b) => b.items.map((s) => s.name.trim())).filter(Boolean).slice(0, 4);
  const why = all.filter((b): b is Highlights => b.kind === "highlights" && isWhyUs(b)).flatMap((b) => b.items.map((x) => x.replace(/^✅\s*/, "").trim())).filter(Boolean).slice(0, 3);
  const steps = all.filter((b): b is Services => b.kind === "services" && isSteps(b)).flatMap((b) => b.items.map((s) => s.name.replace(/^\d+[.)]\s*/, "").trim())).filter(Boolean).slice(0, 4);
  const where = ctx.city ? (hi ? `${ctx.city} में` : `in ${ctx.city}`) : "";
  const since = ctx.since ? (hi ? `${ctx.since} से` : `since ${ctx.since}`) : "";
  const tidy = (x: string) => x.replace(/\s+/g, " ").replace(/\s+([.,।])/g, "$1").trim();
  if (hi) {
    const p1 = tidy(`${ctx.business} ${where} ${since} ${ctx.tradeLabel} का काम कर रहा है।${services.length ? ` हम ${services.join(", ")} जैसी सेवाएँ देते हैं।` : ""} हर ग्राहक को पूरा समय देते हैं और दाम पहले बताते हैं।`);
    const p2 = tidy(`${why.length ? `${why.join(", ")} — यही हमारी पहचान है। ` : ""}${steps.length ? `काम ऐसे होता है: ${steps.join(" → ")}। ` : ""}WhatsApp पर संदेश भेजें, हम जल्दी जवाब देते हैं${ctx.city ? ` — ${ctx.city} और आसपास के लिए` : ""}।`);
    return `${p1}\n\n${p2}`;
  }
  const p1 = tidy(`${ctx.business} is a ${ctx.tradeLabel.toLowerCase()} ${where} ${since}.${services.length ? ` We offer ${services.join(", ").toLowerCase()}.` : ""} We give every customer our full time and tell the price before we start.`);
  const p2 = tidy(`${why.length ? `${why.join(", ")} — that is how we work. ` : ""}${steps.length ? `How it goes: ${steps.join(" → ")}. ` : ""}Message us on WhatsApp and we reply quickly${ctx.city ? ` — for ${ctx.city} and nearby` : ""}.`);
  return `${p1}\n\n${p2}`;
}
const plainServiceLine = (s: ServiceItem, ctx: TextContext) => (ctx.lang === "hi" ? `${s.name} — ${ctx.business} पर, साफ़ बात और तय दाम के साथ।` : `${s.name} at ${ctx.business} — explained clearly, price told first.`);
const plainFaqAnswer = (ctx: TextContext) => (ctx.lang === "hi" ? "WhatsApp पर संदेश भेजें — हम आपकी ज़रूरत समझकर पूरा जवाब देते हैं।" : "Message us on WhatsApp — we understand what you need and reply with the full answer.");
const plainProductLine = (p: ProductItem, ctx: TextContext) => (ctx.lang === "hi" ? `${p.name} — ${ctx.business} से, अच्छी क्वालिटी और सही दाम।` : `${p.name} from ${ctx.business} — good quality at a fair price.`);
const explainHint = (trade: TradeData | null) => (trade?.explain?.length ? `Cover: ${trade.explain.slice(0, 3).join("; ")}.` : "");
