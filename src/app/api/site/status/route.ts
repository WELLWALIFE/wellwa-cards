// GET (bearer) → website status for the user's card (`?full=1` adds the whole card, for the website editor's
// live preview). PATCH { enabled?, hidden?, hideProfile?, logoUrl?, hero?, style?, home?, reference? }.
import { packageRunning } from "@/lib/site-tier";
import { HEADING_FONTS, HERO_IDS, SECTION_KEYS, SHAPES, VARIANT_IDS, repairOrder } from "@/lib/site-advanced";
import { PALETTE_KEYS } from "@/lib/site-style";
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { siteStatus, patchSite, cleanStyle, cleanHome, type SitePatch } from "@/lib/site-server";
import { cleanTiles } from "@/lib/site-blueprints";
import { newWebsiteBlocked, WEBSITE_PLAN_MESSAGE } from "@/lib/site-access";

export const maxDuration = 60;

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const st = await siteStatus(me.id, q.get("card") ?? undefined, { full: q.get("full") === "1" });
  // `pkg`: a website package is running (Website Standard / Premium / Custom, bought or given by the Super Admin). Card & Website reads
  // it: a Website Standard has no Growth Plan with it, so the account's plan is still "free" — and the hub showed such an owner the
  // card alone, with no way to the website the admin had made for them (owner, 25 Nov 2026: "maine admin se website banai hai").
  return NextResponse.json(st.hasCard ? { ...st, pkg: await packageRunning(me.id).catch(() => false) } : st);
}
export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  // The free plan is the digital card only (owner, 16 Oct 2026): switching a website ON needs a paid plan. A free account whose
  // website is already on keeps it, and may still switch it off.
  if (b.enabled === true && await newWebsiteBlocked(me, typeof b.card_id === "string" ? b.card_id : undefined)) return NextResponse.json({ error: WEBSITE_PLAN_MESSAGE, plan: true }, { status: 402 });
  const patch: SitePatch = {};
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (typeof b.hideProfile === "boolean") patch.hideProfile = b.hideProfile;
  if (typeof b.showcase === "boolean") patch.showcase = b.showcase;
  if (typeof b.logoUrl === "string") patch.logoUrl = /^https:\/\/.{0,400}$/.test(b.logoUrl) ? b.logoUrl : "";
  if (Array.isArray(b.hidden)) patch.hidden = b.hidden.filter((x: unknown): x is string => typeof x === "string").slice(0, 20);
  if (b.hero && typeof b.hero === "object") {
    const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
    const h = b.hero as Record<string, unknown>;
    patch.hero = {};
    if (S(h.headline, 90) !== undefined) patch.hero.headline = S(h.headline, 90);
    if (S(h.sub, 240) !== undefined) patch.hero.sub = S(h.sub, 240);
    if (S(h.ctaLabel, 30) !== undefined) patch.hero.ctaLabel = S(h.ctaLabel, 30);
    if (typeof h.imageUrl === "string") patch.hero.imageUrl = /^https:\/\/.{0,400}$/.test(h.imageUrl) ? h.imageUrl : "";
    const tiles = cleanTiles(h.tiles); if (tiles) patch.hero.tiles = tiles;
    if (typeof h.video === "boolean") patch.hero.video = h.video;
    // The Premium website's sliding banners: up to 3, each a big line (required), a small line and an https picture.
    if (Array.isArray(h.slides)) patch.hero.slides = h.slides.slice(0, 3).map((x: unknown) => {
      const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
      const img = typeof o.imageUrl === "string" && /^https:\/\/.{0,400}$/.test(o.imageUrl) ? o.imageUrl : undefined;
      return { headline: S(o.headline, 90) ?? "", ...(S(o.sub, 240) ? { sub: S(o.sub, 240) } : {}), ...(img ? { imageUrl: img } : {}) };
    }).filter((x: { headline: string }) => x.headline);
  }
  const style = cleanStyle(b.style); if (style) patch.style = style;
  if (b.advancedLook && typeof b.advancedLook === "object") {
    const L = b.advancedLook as { heading?: unknown; hero?: unknown; shape?: unknown; tone?: unknown; corners?: unknown; order?: unknown; sections?: unknown };
    // "Build your own design": a layout per part of the home page — only ids that exist (lib/site-advanced.ts VARIANT_IDS).
    const secs: Record<string, string> = {};
    if (L.sections && typeof L.sections === "object") for (const k of SECTION_KEYS) { const v = (L.sections as Record<string, unknown>)[k]; if (k !== "hero" && typeof v === "string" && VARIANT_IDS[k].includes(v)) secs[k] = v; }
    const look = {
      ...(typeof L.heading === "string" && (HEADING_FONTS as string[]).includes(L.heading) ? { heading: L.heading } : {}),
      ...(typeof L.hero === "string" && (HERO_IDS as readonly string[]).includes(L.hero) ? { hero: L.hero } : {}),
      ...(typeof L.shape === "string" && (SHAPES as readonly string[]).includes(L.shape) ? { shape: L.shape } : {}),
      ...(L.tone === "light" || L.tone === "dark" ? { tone: L.tone as "light" | "dark" } : {}),
      ...(L.corners === true ? { corners: true } : {}),
      // The order of the Premium home page, as the owner dragged it: repaired (top first, footer last, every section once).
      ...(Array.isArray(L.order) && L.order.length ? { order: repairOrder(L.order) as string[] } : {}),
      ...(Object.keys(secs).length ? { sections: secs } : {}),
    };
    if (Object.keys(look).length) patch.advancedLook = look;
  }
  if (b.advancedPalette && typeof b.advancedPalette === "object") {
    const k = String((b.advancedPalette as { key?: unknown }).key ?? "");
    const col = String((b.advancedPalette as { color?: unknown }).color ?? "");
    if (k === "brand" || PALETTE_KEYS.includes(k)) patch.advancedPalette = { key: k, ...(/^#[0-9a-f]{6}$/i.test(col) ? { color: col.toLowerCase() } : {}), ...((b.advancedPalette as { own?: unknown }).own === true ? { own: true } : {}) };
  }
  if (b.bar === null) patch.bar = null;
  else if (b.bar && typeof b.bar === "object") {
    const t = String((b.bar as { text?: unknown }).text ?? "").trim().slice(0, 120);
    const link = String((b.bar as { link?: unknown }).link ?? "").trim();
    const until = String((b.bar as { until?: unknown }).until ?? "").trim();
    patch.bar = t ? { text: t, ...(/^https?:\/\/.{3,300}$/.test(link) || /^#[\w-]{1,30}$/.test(link) ? { link } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(until) ? { until } : {}) } : null;
  }
  if (b.float === "whatsapp" || b.float === "call" || b.float === "none") patch.float = b.float;
  const home = cleanHome(b.home); if (home) patch.home = home;
  // The Home page's own sections in a new order (website editor → a part's sheet → Move up / down): ids only, the server re-orders
  // the sections it already has — nothing is added, removed or rewritten.
  // The sections of the other pages in a new order (the same, page by page): ids only, re-ordering what each page already has.
  if (b.pageOrders && typeof b.pageOrders === "object") {
    const po: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(b.pageOrders as Record<string, unknown>).slice(0, 30)) {
      if (!/^[\w-]{1,60}$/.test(k) || !Array.isArray(v)) continue;
      const ids = v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 80).slice(0, 200);
      if (ids.length > 1) po[k] = ids;
    }
    if (Object.keys(po).length) patch.pageOrders = po;
  }
  // The top of a page (website editor → Page heading): its name, its own photo or none, a short line, the shape. Text only, checked here.
  if (b.pageHeads && typeof b.pageHeads === "object") {
    const ph: NonNullable<SitePatch["pageHeads"]> = {};
    for (const [k, v] of Object.entries(b.pageHeads as Record<string, unknown>).slice(0, 30)) {
      if (!/^[\w-]{1,60}$/.test(k) || !v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
      const photo = typeof o.photo === "string" && o.photo.length <= 600 && /^(https:\/\/|\/)[^\s"'<>]+$/.test(o.photo) ? o.photo : "";
      const line = typeof o.line === "string" ? o.line.trim().slice(0, 160) : "";
      const kind = o.kind === "ink" || o.kind === "split" || o.kind === "type" || o.kind === "poster" ? o.kind : undefined;
      ph[k] = { ...(label ? { label } : {}), ...(photo ? { photo } : {}), ...(o.noPhoto === true ? { noPhoto: true } : {}), ...(line ? { line } : {}), ...(kind ? { kind } : {}) };
    }
    if (Object.keys(ph).length) patch.pageHeads = ph;
  }
  if (Array.isArray(b.homeBlocks)) { const ids = (b.homeBlocks as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 80).slice(0, 200); if (ids.length > 1) patch.homeBlocks = ids; }
  // "Make it look like this website": one public URL, read on the server (same safety rules as the AI builder).
  if (typeof b.reference === "string" && b.reference.trim()) patch.referenceUrl = b.reference.trim().slice(0, 300);
  try { return NextResponse.json({ ok: true, site: await patchSite(me.id, patch, typeof b.card_id === "string" ? b.card_id : undefined) }); }
  catch (e) {
    const msg = (e as Error).message;
    if (msg === "NO_CARD") return NextResponse.json({ error: "Create your digital card first." }, { status: 400 });
    if (msg === "REFERENCE_UNREADABLE") return NextResponse.json({ error: "We could not open that website. Check the link and try again." }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
