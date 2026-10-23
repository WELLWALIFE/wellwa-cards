// GET (bearer) → website status for the user's card (`?full=1` adds the whole card, for the website editor's
// live preview). PATCH { enabled?, hidden?, hideProfile?, logoUrl?, hero?, style?, home?, reference? }.
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
  return NextResponse.json(await siteStatus(me.id, q.get("card") ?? undefined, { full: q.get("full") === "1" }));
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
  if (b.advancedPalette && typeof b.advancedPalette === "object") {
    const k = String((b.advancedPalette as { key?: unknown }).key ?? "");
    const col = String((b.advancedPalette as { color?: unknown }).color ?? "");
    if (k === "brand" || PALETTE_KEYS.includes(k)) patch.advancedPalette = { key: k, ...(/^#[0-9a-f]{6}$/i.test(col) ? { color: col.toLowerCase() } : {}) };
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
