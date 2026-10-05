// GET (bearer) → website status for the user's card (`?full=1` adds the whole card, for the website editor's
// live preview). PATCH { enabled?, hidden?, hideProfile?, logoUrl?, hero?, style?, home?, reference? }.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { siteStatus, patchSite, cleanStyle, cleanHome, type SitePatch } from "@/lib/site-server";
import { cleanTiles } from "@/lib/site-blueprints";

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
  }
  const style = cleanStyle(b.style); if (style) patch.style = style;
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
