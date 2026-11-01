import "server-only";
// Month plan v2 — the AI plans a month of posts for ONE business, post by post (owner, 1 Nov 2026). Better than "a kind per day":
// every day gets its own heading and small line for the poster (overrides.title / sub — the engine draws exactly those words),
// a caption in the owner's language, hashtags and one line on why this post (brief). Festivals come from the poster
// engine's occasion list; products, offers and reviews are the owner's own; the brand (tone, audience, USPs) shapes the voice.
// One AI call per month (gemini flash); if it fails or returns rubbish, the old weekly mix still gives a complete plan.
import { restAsService, posterEngine } from "@/lib/poster-server";
import { geminiComplete } from "@/lib/gemini";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { categoryOf } from "@/lib/poster-categories";
import { logoColor } from "@/lib/media/logo-color";
import { loadSavedFacts } from "@/lib/card-inputs";
import { FOCUS, DEFAULT_FOCUS, TONES, HEX6, clampStr, cleanBrief, cleanTags, type BrandSnapshot, type DayBrief, type DayKind } from "@/lib/brand-plan";

const UUID = /^[0-9a-f-]{36}$/i;
type Prod = { id: string; name: string; offer: string | null; category: string | null; price: string | null; benefits: unknown };
type Offer = { text: string; starts: string; ends: string; scope: string; product_ids: string[]; categories: string[] };
type ProfileRow = { id: string; user_id: string; name: string; tagline: string | null; logo_url: string | null; lang: string; city: string | null; category: string | null; layout: Record<string, unknown> | null };

const LANG_NAME: Record<string, string> = { hi: "Hindi (Devanagari script)", en: "English", hinglish: "Hinglish (Hindi written in Roman letters, simple words)", mr: "Marathi", gu: "Gujarati", pa: "Punjabi (Gurmukhi)", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia" };
export const langName = (l: string) => LANG_NAME[l] ?? LANG_NAME.hi;

/** What the plan and the captions know about the business: the profile + the account's business + the card's photos. */
export async function brandSnapshot(userId: string, profileId: string): Promise<BrandSnapshot | null> {
  const p = (await restAsService<ProfileRow[]>(`poster_profiles?id=eq.${profileId}&user_id=eq.${userId}&select=id,user_id,name,tagline,logo_url,lang,city,category,layout`)).data?.[0];
  if (!p) return null;
  const L = (p.layout ?? {}) as Record<string, unknown>;
  let biz: { website?: string; about?: string; category?: string; city?: string } = {};
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
    if (r.ok) biz = ((await r.json())?.user_metadata?.business ?? {}) as typeof biz;
  } catch { /* the account's business is a nicety here */ }
  let photos: string[] = [];
  try { const f = await loadSavedFacts(userId); photos = [...(f.facts.bannerUrl ? [f.facts.bannerUrl] : []), ...(Array.isArray(f.facts.photos) ? f.facts.photos : [])].filter(Boolean).slice(0, 12); } catch { /* none */ }
  const usps = (Array.isArray(L.usps) ? L.usps : []).map((u) => (typeof u === "string" ? u : "")).filter(Boolean);
  return {
    profileId: p.id, name: p.name, tagline: p.tagline ?? "", logo_url: p.logo_url ?? "", lang: p.lang || "hi", category: p.category || biz.category || "", city: p.city || biz.city || "",
    accent: HEX6.test(String(L.accent ?? "")) ? String(L.accent) : "", palette: (Array.isArray(L.palette) ? L.palette : []).map(String).filter((h) => HEX6.test(h)).slice(0, 3),
    tone: (Array.isArray(L.tone) ? L.tone : []).map(String).filter((t) => TONES.some((x) => x.key === t)).slice(0, 3), audience: clampStr(L.audience, 120), usps,
    website: String(biz.website ?? ""), about: clampStr(biz.about, 400), photos,
  };
}

/** The colour the brand should start from: the logo's own ink, else the trade's colour. */
export async function suggestAccent(b: Pick<BrandSnapshot, "logo_url" | "category" | "accent">): Promise<string> {
  if (b.accent) return b.accent;
  const fromLogo = b.logo_url ? await logoColor(b.logo_url).catch(() => null) : null;
  return fromLogo || categoryOf(b.category)?.accent || "#1d4ed8";
}

/** Tone, audience and USPs the AI would suggest for this trade (used by the Brand screen when the fields are empty). */
export async function suggestBrand(b: BrandSnapshot): Promise<{ tone: string[]; audience: string; usps: string[]; tagline: string }> {
  const key = process.env.GEMINI_API_KEY;
  const cat = categoryOf(b.category);
  const fallback = { tone: [cat?.style === "premium" ? "premium" : "warm", "trust"], audience: "", usps: [], tagline: b.tagline };
  if (!key) return fallback;
  try {
    const r = await geminiComplete({
      apiKey: key, json: true, temperature: 0.5, maxOutputTokens: 500, tag: "brand-suggest",
      system: `You help a small Indian business describe its brand in a few words. Answer JSON only: {"tone": ["key","key"], "audience": "...", "usps": ["label|sub", ...], "tagline": "..."}.
tone: 2 keys from ${TONES.map((t) => t.key).join(", ")} that fit the trade. audience: who buys, one line ≤ 90 characters, in ${langName(b.lang)}. usps: up to 4 "label|sub" pairs (label ≤ 20 chars, sub ≤ 20 chars) in ${langName(b.lang)}, true for most businesses of this trade (never invent awards or years). tagline: ≤ 40 chars in ${langName(b.lang)} (keep the given one if it is good).`,
      contents: [{ role: "user", parts: [{ text: `Business: ${b.name}\nTrade: ${cat ? `${cat.en} (${cat.hi})` : b.category || "unknown"}\nCity: ${b.city || "-"}\nTagline: ${b.tagline || "-"}\nAbout: ${b.about || "-"}\nExisting USPs: ${b.usps.join("; ") || "-"}` }] }],
    });
    const o = JSON.parse(r.text.replace(/^```(json)?|```$/g, "").trim()) as Record<string, unknown>;
    const tone = (Array.isArray(o.tone) ? o.tone : []).map(String).filter((t) => TONES.some((x) => x.key === t)).slice(0, 3);
    const usps = (Array.isArray(o.usps) ? o.usps : []).map((u) => String(u).split("|").map((x) => x.trim().slice(0, 22)).slice(0, 2).join("|").replace(/\|$/, "")).filter(Boolean).slice(0, 5);
    return { tone: tone.length ? tone : fallback.tone, audience: clampStr(o.audience, 120), usps, tagline: clampStr(o.tagline, 40) || b.tagline };
  } catch { return fallback; }
}

/* ---------------------------------------------- the month ---------------------------------------------- */

export type PlanDay = { for_date: string; kind: DayKind; product_id: string | null; overrides: { title?: string; sub?: string; custom?: string }; brief: DayBrief };
type Ctx = { b: BrandSnapshot; products: Prod[]; offers: Offer[]; reviews: number; festivals: Record<string, { hi: string; en: string }>; focus: string[]; perWeek: number };

/** A line for the poster: at most n characters, cut at a word, never in the middle of one. */
const shortLine = (v: unknown, n: number) => { const t = clampStr(v, 400); if (t.length <= n) return t; const cut = t.slice(0, n + 1); const sp = cut.lastIndexOf(" "); return (sp > n * 0.5 ? cut.slice(0, sp) : t.slice(0, n)).replace(/[\s,;:—–-]+$/, ""); };
const daysOf = (month: string) => { const [y, m] = month.split("-").map(Number); const out: string[] = []; for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`); return out; };
const dow = (d: string) => (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7; // Mon = 0
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function loadCtx(userId: string, b: BrandSnapshot, month: string, focus: string[], perWeek: number): Promise<Ctx> {
  let products = (await restAsService<Prod[]>(`poster_products?user_id=eq.${userId}&brand_id=is.null&active=eq.true&order=sort,created_at&select=id,name,offer,category,price,benefits&limit=40`)).data ?? [];
  if (!products.length) { const bid = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${userId}&select=brand_id`)).data?.[0]?.brand_id; if (bid) products = (await restAsService<Prod[]>(`poster_products?brand_id=eq.${bid}&active=eq.true&order=sort,created_at&select=id,name,offer,category,price,benefits&limit=40`)).data ?? []; }
  const days = daysOf(month);
  const offers = (await restAsService<Offer[]>(`poster_offers?user_id=eq.${userId}&active=is.true&starts=lte.${days[days.length - 1]}&ends=gte.${days[0]}&select=text,starts,ends,scope,product_ids,categories`)).data ?? [];
  const reviews = ((await restAsService<{ id: string }[]>(`poster_testimonials?user_id=eq.${userId}&approved=eq.true&select=id&limit=20`)).data ?? []).length;
  const eng = await posterEngine();
  const festivals: Ctx["festivals"] = {};
  for (const d of days) { const t = eng.themeFor(d); if (t.kind === "occasion") festivals[d] = { hi: t.hi, en: t.en }; }
  const f = focus.filter((k) => FOCUS.some((x) => x.key === k));
  return { b, products, offers, reviews, festivals, focus: f.length ? f : DEFAULT_FOCUS, perWeek: Math.min(7, Math.max(2, perWeek || 5)) };
}

/** The days that get a post this month: festivals always; the rest spread over the week's strong days. */
function postingDays(days: string[], festivals: Ctx["festivals"], perWeek: number): Set<string> {
  const order = [0, 3, 5, 1, 4, 6, 2]; // Mon, Thu, Sat, Tue, Fri, Sun, Wed
  const on = new Set(order.slice(0, perWeek));
  return new Set(days.filter((d) => festivals[d] || on.has(dow(d))));
}

/** No AI, or the AI failed: a complete plan from the mix — kinds rotate through the chosen focus, products rotate. */
function mixPlan(month: string, c: Ctx): PlanDay[] {
  const days = daysOf(month); const post = postingDays(days, c.festivals, c.perWeek);
  const kinds: DayKind[] = [];
  for (const f of c.focus) {
    if (f === "products" && c.products.length) kinds.push("product", "product");
    else if (f === "offers" && (c.offers.length || c.products.some((p) => p.offer))) kinds.push("offer");
    else if (f === "tips") kinds.push("tip");
    else if (f === "trust") kinds.push(c.reviews ? "testimonial" : "trust");
    else if (f === "about") kinds.push("about");
    else if (f === "festivals") kinds.push("greeting");
  }
  if (!kinds.length) kinds.push("greeting");
  let i = 0, pi = 0;
  return days.map((d) => {
    if (!post.has(d)) return { for_date: d, kind: "skip" as DayKind, product_id: null, overrides: {}, brief: {} };
    if (c.festivals[d]) return { for_date: d, kind: "festival" as DayKind, product_id: null, overrides: {}, brief: { focus: "festivals", hook: c.festivals[d].hi } };
    const kind = kinds[i++ % kinds.length];
    const withOffer = c.products.filter((p) => p.offer);
    const prod = kind === "product" ? c.products[pi++ % Math.max(1, c.products.length)] : kind === "offer" ? (withOffer[pi++ % Math.max(1, withOffer.length)] ?? c.products[pi % Math.max(1, c.products.length)]) : null;
    return { for_date: d, kind, product_id: prod?.id ?? null, overrides: {}, brief: { focus: FOCUS.find((f) => f.kinds.includes(kind))?.key } };
  });
}

function planPrompt(month: string, c: Ctx, only?: { dates: string[]; hint?: string; avoid?: string[] }): { system: string; user: string } {
  const b = c.b; const cat = categoryOf(b.category);
  const lang = langName(b.lang);
  const days = only?.dates.length ? only.dates : daysOf(month).filter((d) => postingDays(daysOf(month), c.festivals, c.perWeek).has(d));
  const dayLines = days.map((d) => `${d} ${WEEKDAY[dow(d)]}${c.festivals[d] ? ` — FESTIVAL: ${c.festivals[d].en} (${c.festivals[d].hi})` : ""}`).join("\n");
  const prods = c.products.slice(0, 25).map((p) => `- id ${p.id}: ${p.name}${p.price ? ` · price ${p.price}` : ""}${p.offer ? ` · offer: ${p.offer}` : ""}${Array.isArray(p.benefits) && p.benefits.length ? ` · benefits: ${(p.benefits as string[]).slice(0, 3).join("; ")}` : ""}`).join("\n");
  const offers = c.offers.map((o) => `- "${o.text}" (${o.starts} → ${o.ends})`).join("\n");
  const focusText = c.focus.map((k) => FOCUS.find((f) => f.key === k)).filter(Boolean).map((f) => `${f!.key} (${f!.en})`).join(", ");
  const allowedKinds = ["product", "offer", "tip", c.reviews ? "testimonial" : "trust", "about", "greeting"].filter((k) => (k === "product" ? c.products.length : k === "offer" ? c.offers.length || c.products.some((p) => p.offer) : true));
  const system = `You are the social-media planner of ONE small Indian business. You write what goes ON each day's poster and the caption under it.
Return JSON only: {"days": [{"date": "YYYY-MM-DD", "kind": "...", "product_id": "uuid or null", "focus": "...", "title": "...", "sub": "...", "custom": "...", "hook": "...", "caption": "...", "hashtags": ["#a", "#b", "#c", "#d", "#e"], "why": "..."}]}
Rules:
- One entry per date given, in order. A FESTIVAL date: kind "festival", title = a warm wish for that festival, no selling.
- Other dates: kind from [${allowedKinds.join(", ")}]; focus from [${focusText}]. Vary the kinds across the week; never two identical ideas in a row; each product at most once a week.
- kind "product" / "offer" MUST carry a product_id from the list; kind "offer" only with a real offer written above (quote it exactly). Never invent prices, discounts, awards, years or numbers.
- "tip": one useful thing a customer of this trade should know. "trust"/"testimonial": why people rely on this business (use the USPs). "about": the people, the craft, the shop, the day's work. "greeting": a thought for the day that touches the trade lightly.
- title: the poster's heading, ≤ 34 characters, ${lang}, no emoji, no business name (the name is printed by the design). sub: ≤ 40 characters, one line under the heading. custom: a third short line ≤ 50 characters ONLY for an offer or a price (else "").
- hook: the idea in one short line (${lang}). caption: 2–3 short lines in ${lang}, warm and professional, at most 2 emoji, no phone number, no link, no hashtags (code adds those). hashtags: 5, mixing the trade, the city and the topic. why: one sentence on why this post helps, in ${lang}.
- Tone: ${b.tone.length ? b.tone.map((t) => TONES.find((x) => x.key === t)?.en ?? t).join(", ") : "warm, trusted"}. Write every business and product name exactly as given (never transliterate).`;
  const user = `Business: ${b.name}${b.tagline ? ` — ${b.tagline}` : ""}
Trade: ${cat ? `${cat.en} (${cat.hi})` : b.category || "small business"}${b.city ? ` · City: ${b.city}` : ""}
Who buys: ${b.audience || "local customers"}
Why us (USPs): ${b.usps.map((u) => u.replace("|", " — ")).join("; ") || "-"}
About: ${b.about || "-"}
Products / services:
${prods || "- (none listed — do not use kind product/offer)"}
Offers running this month:
${offers || "- none"}
${only?.hint ? `Note: ${only.hint}\n` : ""}${only?.avoid?.length ? `Do NOT repeat these ideas already used this month: ${only.avoid.join(" | ")}\n` : ""}Dates to plan:
${dayLines}`;
  return { system, user };
}

function readDays(text: string, c: Ctx, dates: string[]): Map<string, PlanDay> {
  const out = new Map<string, PlanDay>();
  let o: { days?: unknown[] } = {};
  try { o = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()); } catch { return out; }
  const allowed = new Set<string>(["festival", "product", "offer", "tip", "trust", "testimonial", "about", "greeting"]);
  for (const raw of Array.isArray(o.days) ? o.days : []) {
    const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const date = String(d.date ?? ""); if (!dates.includes(date)) continue;
    let kind = String(d.kind ?? "") as DayKind;
    if (c.festivals[date]) kind = "festival";
    if (!allowed.has(kind)) kind = "greeting";
    if (kind === "festival" && !c.festivals[date]) kind = "greeting";
    if (kind === "testimonial" && !c.reviews) kind = "trust";
    let product_id = UUID.test(String(d.product_id ?? "")) && c.products.some((p) => p.id === d.product_id) ? String(d.product_id) : null;
    if ((kind === "product" || kind === "offer") && !product_id) { if (!c.products.length) kind = "tip"; else product_id = c.products[out.size % c.products.length].id; }
    if (kind !== "product" && kind !== "offer") product_id = null;
    const overrides: PlanDay["overrides"] = {};
    if (shortLine(d.title, 34)) overrides.title = shortLine(d.title, 34);
    if (shortLine(d.sub, 40)) overrides.sub = shortLine(d.sub, 40);
    if ((kind === "offer" || kind === "product") && shortLine(d.custom, 50)) overrides.custom = shortLine(d.custom, 50);
    const brief = cleanBrief({ focus: d.focus, hook: d.hook, caption: d.caption, hashtags: cleanTags(d.hashtags), why: d.why, at: new Date().toISOString() });
    if (!brief.focus) brief.focus = FOCUS.find((f) => f.kinds.includes(kind))?.key;
    out.set(date, { for_date: date, kind, product_id, overrides, brief });
  }
  return out;
}

/** The whole month: AI first, mix for whatever the AI left out. */
export async function draftMonth(userId: string, b: BrandSnapshot, month: string, focus: string[], perWeek: number): Promise<{ days: PlanDay[]; ai: boolean }> {
  const c = await loadCtx(userId, b, month, focus, perWeek);
  const base = mixPlan(month, c);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { days: base, ai: false };
  const dates = base.filter((d) => d.kind !== "skip").map((d) => d.for_date);
  // Two halves of the month at once: half the wait, and no long answer cut off in the middle. The second half is told the
  // first half's dates so the two do not repeat the same idea on the same weekday pattern (they also differ in products).
  const half = Math.ceil(dates.length / 2);
  const parts = [dates.slice(0, half), dates.slice(half)].filter((x) => x.length);
  const ai = new Map<string, PlanDay>();
  await Promise.all(parts.map(async (part, i) => {
    const { system, user } = planPrompt(month, c, { dates: part, hint: i ? "This is the second half of the month: use different ideas and other products than a first half would (rotate)." : "" });
    try {
      const r = await geminiComplete({ apiKey: key, json: true, temperature: 0.75, maxOutputTokens: 12000, tag: "month-plan", system, contents: [{ role: "user", parts: [{ text: user }] }] });
      for (const [d, v] of readDays(r.text, c, part)) ai.set(d, v);
    } catch { /* that half keeps the mix */ }
  }));
  // festival days and anything the AI skipped keep the mix's day (so the month is always complete)
  const days = base.map((d) => ai.get(d.for_date) ?? d);
  return { days, ai: ai.size >= Math.ceil(dates.length / 2) };
}

/** One day again (the owner's "new idea", optionally with a hint in their words). */
export async function redraftDay(userId: string, b: BrandSnapshot, date: string, hint: string, avoid: string[]): Promise<PlanDay | null> {
  const month = date.slice(0, 7);
  const c = await loadCtx(userId, b, month, DEFAULT_FOCUS, 7);
  const key = process.env.GEMINI_API_KEY; if (!key) return null;
  const { system, user } = planPrompt(month, c, { dates: [date], hint: hint ? `The owner asks for this day: "${hint}" — follow it.` : "Give a fresh idea, different from the ones listed.", avoid: avoid.slice(0, 20) });
  try {
    const r = await geminiComplete({ apiKey: key, json: true, temperature: 0.9, maxOutputTokens: 800, tag: "day-plan", system, contents: [{ role: "user", parts: [{ text: user }] }] });
    return readDays(r.text, c, [date]).get(date) ?? null;
  } catch { return null; }
}

/** The caption as it should go out when the day has a brief: the brief's lines + hashtags (the footer is added by the writer). */
export function briefCaption(brief: DayBrief | null | undefined): { lines: string[]; hashtags: string[] } | null {
  if (!brief?.caption) return null;
  const lines = brief.caption.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4);
  return lines.length ? { lines, hashtags: brief.hashtags ?? [] } : null;
}
