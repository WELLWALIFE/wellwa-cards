// Every photograph on the owner's website, one by one (owner, 14 Oct 2026: "Photos & more me wo sab photo dikhane chahiye
// jo web site per hai — remove, replace, make by AI, add more"). The banner on top, the picture beside the About text, and
// the gallery's pictures: each can be replaced with the owner's own, taken off, or made again by AI for exactly that place.
//
// GET  (bearer) { cardId? }                          → { cardId, username, slots, max }
// POST (bearer) { action: "replace", slot, url }     → the owner's own picture (already uploaded) put in that place
//      (bearer) { action: "remove",  slot }          → a gallery or About picture taken off (the banner is replaced, never removed)
//      (bearer) { action: "add", url }                → one more gallery picture
//      (bearer) { action: "ai", slot | kind:"gallery" } → one picture made for that place, one credit; `slot` omitted = a new gallery picture
// `slot` is the id GET gave: "banner", "about:<block>", "gallery:<block>:<index>".
// Every change lands on the live website at once and, for the banner and the gallery, in the card's facts, so a rebuild keeps it.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { SUPA_URL } from "@/lib/admin-guard";
import { rateLimited } from "@/lib/api-security";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";
import { loadCardInputs, saveFacts } from "@/lib/card-inputs";
import { slotImage, IMG_MODEL } from "@/lib/media/ai-image";
import { logImages } from "@/lib/ai-usage";
import { bannerFocus } from "@/lib/media/photo-focus";
import { MAX_GALLERY_PHOTOS } from "@/lib/card-facts";
import { SITE_PALETTES } from "@/lib/site-style";
import { categoryOf } from "@/lib/poster-categories";
import type { Card, CardBlock } from "@/lib/types";

export const maxDuration = 120;

type Kind = "banner" | "about" | "gallery";
type PhotoSlot = { id: string; kind: Kind; url: string; label: string; size: string; ours: boolean; stock: boolean };

// One change at a time per owner: two taps (or two tabs) would both read the same card and the second save would undo the first.
const inFlight = new Set<string>();
const madeByUs = (u: string) => /\/ref-\d+(-\d+)?\.(png|jpe?g|webp)(\?|$)/i.test(u);
const isStock = (u: string) => /^\/(api\/stock|art)\//.test(u) || /\/api\/stock\//.test(u);
const SIZE: Record<Kind, string> = { banner: "1600 × 900 px · wide", about: "1200 × 900 px", gallery: "1200 × 900 px" };
const visibleBlocks = (card: Card) => card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);

function slotsOf(card: Card): PhotoSlot[] {
  const out: PhotoSlot[] = [];
  const banner = card.site?.hero?.imageUrl || card.coverUrl || "";
  if (banner) out.push({ id: "banner", kind: "banner", url: banner, label: "Top banner", size: SIZE.banner, ours: madeByUs(banner), stock: isStock(banner) });
  for (const b of visibleBlocks(card)) {
    if (b.kind === "about" && b.imageUrl) out.push({ id: `about:${b.id}`, kind: "about", url: b.imageUrl, label: "About picture", size: SIZE.about, ours: madeByUs(b.imageUrl), stock: isStock(b.imageUrl) });
    if (b.kind === "gallery") b.images.forEach((g, i) => { if (g.url) out.push({ id: `gallery:${b.id}:${i}`, kind: "gallery", url: g.url, label: g.label || `Gallery photo ${out.filter((x) => x.kind === "gallery").length + 1}`, size: SIZE.gallery, ours: madeByUs(g.url), stock: isStock(g.url) }); });
  }
  return out;
}

const mapBlock = (card: Card, id: string, f: (b: CardBlock) => CardBlock): Card => ({ ...card, pages: card.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? f(b) : b)) })) });

function setSlot(card: Card, slot: string, url: string, focus: { focus?: string; textSide?: "left" | "right" | "center" } | null): Card | null {
  if (slot === "banner") {
    const site = card.site ? { ...card.site, hero: { ...(card.site.hero ?? { headline: card.company || card.name, sub: "" }), imageUrl: url, ...(focus?.focus ? { focus: focus.focus } : {}), ...(focus?.textSide ? { textSide: focus.textSide } : {}) } } : card.site;
    return { ...card, coverUrl: url, site };
  }
  const [kind, blockId, idx] = slot.split(":");
  if (kind === "about" && blockId) return mapBlock(card, blockId, (b) => (b.kind === "about" ? { ...b, imageUrl: url } : b));
  if (kind === "gallery" && blockId && idx !== undefined) {
    const i = Number(idx);
    return mapBlock(card, blockId, (b) => (b.kind === "gallery" ? { ...b, images: b.images.map((g, k) => (k === i ? { ...g, url } : g)) } : b));
  }
  return null;
}
function removeSlot(card: Card, slot: string): Card | null {
  const [kind, blockId, idx] = slot.split(":");
  if (kind === "about" && blockId) return mapBlock(card, blockId, (b) => (b.kind === "about" ? { ...b, imageUrl: undefined } : b));
  if (kind === "gallery" && blockId && idx !== undefined) {
    const i = Number(idx);
    return mapBlock(card, blockId, (b) => (b.kind === "gallery" ? { ...b, images: b.images.filter((_, k) => k !== i) } : b));
  }
  return null;   // the banner is never taken off
}
function addToGallery(card: Card, url: string): Card | null {
  const g = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).find((b) => b.kind === "gallery");
  if (!g || g.kind !== "gallery") return null;
  const colors = ["#e2e8f0", "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];
  return mapBlock(card, g.id, (b) => (b.kind === "gallery" ? { ...b, images: [...b.images, { url, color: colors[b.images.length % colors.length], label: "" }] } : b));
}
const urlOf = (card: Card, slot: string) => slotsOf(card).find((s) => s.id === slot)?.url ?? "";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const cardId = new URL(request.url).searchParams.get("cardId") ?? undefined;
  const row = await myCard(me.id, cardId);
  if (!row) return NextResponse.json({ error: "Create your website first." }, { status: 404 });
  const card = row.data as Card;
  return NextResponse.json({ cardId: row.id, username: card.username, slots: slotsOf(card), max: MAX_GALLERY_PHOTOS });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`card-photos:${me.id}`, 60, 60 * 60_000)) return NextResponse.json({ error: "Too many changes in an hour. Please wait a little." }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { action?: string; slot?: string; url?: string; cardId?: string; expect?: string };
  if (b.action === "ai" && rateLimited(`card-photos-ai:${me.id}`, 15, 60 * 60_000)) return NextResponse.json({ error: "That is enough pictures for this hour. Please try again a little later." }, { status: 429 });
  const row = await myCard(me.id, typeof b.cardId === "string" ? b.cardId : undefined);
  if (!row) return NextResponse.json({ error: "Create your website first." }, { status: 404 });
  const card = row.data as Card;
  const action = b.action;
  const slot = typeof b.slot === "string" ? b.slot : "";
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const galleryCount = slotsOf(card).filter((s) => s.kind === "gallery").length;
  // A picture the owner sends is one that THIS app stored for them (/api/poster/upload writes to exactly this folder): never an outside
  // address, a data: or javascript: URL — it goes into the live website and is fetched server-side for the banner's focus point.
  const OWN = `${SUPA_URL}/storage/v1/object/public/media/poster/${me.id}/`;
  if ((action === "replace" || action === "add") && (!url.startsWith(OWN) || url.includes("..") || url.includes("?") || url.length > 400)) return NextResponse.json({ error: "Upload the photo first." }, { status: 400 });
  // The place must still hold the picture the owner was looking at (the gallery's numbering shifts when a photo is removed elsewhere).
  if ((action === "replace" || action === "remove" || (action === "ai" && slot)) && slot !== "banner") {
    const now = urlOf(card, slot);
    if (!now) return NextResponse.json({ error: "That picture is no longer there. Reload the page.", stale: true }, { status: 409 });
    if (typeof b.expect === "string" && b.expect && b.expect !== now) return NextResponse.json({ error: "The photos changed meanwhile. Reload the page.", stale: true }, { status: 409 });
  }
  if (inFlight.has(me.id)) return NextResponse.json({ error: "One change is still being made. Please wait a moment." }, { status: 409 });
  inFlight.add(me.id);
  let refund: null | (() => Promise<unknown>) = null;   // set once the credit is taken; the catch below gives it back
  try {

  const inputs = await loadCardInputs(me);
  let next: Card | null = null;
  let newUrl = "";

  if (action === "replace") {
    if (!url || !slot) return NextResponse.json({ error: "Nothing to put there." }, { status: 400 });
    newUrl = url;
    next = setSlot(card, slot, url, slot === "banner" ? await bannerFocus(url).catch(() => null) : null);
  } else if (action === "remove") {
    next = removeSlot(card, slot);
    if (!next) return NextResponse.json({ error: "The banner stays — replace it instead." }, { status: 400 });
  } else if (action === "add") {
    if (!url) return NextResponse.json({ error: "Nothing to add." }, { status: 400 });
    if (galleryCount >= MAX_GALLERY_PHOTOS) return NextResponse.json({ error: `The gallery holds ${MAX_GALLERY_PHOTOS} photos.` }, { status: 400 });
    newUrl = url;
    next = addToGallery(card, url);
    if (!next) return NextResponse.json({ error: "This website has no gallery yet." }, { status: 400 });
  } else if (action === "ai") {
    const kind: Kind = slot === "banner" ? "banner" : slot.startsWith("about:") ? "about" : "gallery";
    if (!slot && galleryCount >= MAX_GALLERY_PHOTOS) return NextResponse.json({ error: `The gallery holds ${MAX_GALLERY_PHOTOS} photos.` }, { status: 400 });
    if (slot && !urlOf(card, slot)) return NextResponse.json({ error: "That picture is not on the website." }, { status: 400 });
    // One credit a picture (owner's call, 4 Oct 2026), taken before anything runs and given back when nothing comes out.
    const ref = `photo-${me.id.slice(0, 8)}-${randomUUID()}`;
    const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: 1, p_reason: "site-photo-ai", p_ref: ref }) });
    if (!spend.ok) return spend.status >= 500 ? NextResponse.json({ error: "Could not start just now. Nothing was charged. Please try again." }, { status: 503 }) : NextResponse.json({ error: "A picture made by AI uses 1 credit. Add credits and try again.", needCredits: 1 }, { status: 402 });
    refund = () => restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: 1, p_reason: "site-photo-ai-refund", p_ref: ref }) });
    const st = card.site?.style ?? {};
    const pal = SITE_PALETTES.find((p) => p.key === st.palette && p.key !== "brand");
    const color = st.palette === "brand" && st.color ? st.color : pal?.mid ?? categoryOf(inputs.setup.category)?.accent;
    const label = kind === "gallery" && slot ? slotsOf(card).find((s) => s.id === slot)?.label ?? "" : "";
    const made = await slotImage(me.id, { kind, trade: inputs.setup.categoryLabel || inputs.setup.category || "", tradeKey: inputs.setup.category || "", city: inputs.setup.city || "", label: /^Gallery photo \d+$/.test(label) ? "" : label, dark: pal ? pal.tone === "dark" : false, color }).catch(() => null);
    logImages("site-photo", IMG_MODEL, made ? 1 : 0);
    if (!made) { await refund().catch(() => undefined); return NextResponse.json({ error: "The picture could not be made. Nothing was charged." }, { status: 502 }); }
    newUrl = made;
    next = slot ? setSlot(card, slot, made, kind === "banner" ? await bannerFocus(made).catch(() => null) : null) : addToGallery(card, made);
    if (!next) { await refund().catch(() => undefined); return NextResponse.json({ error: "This website has no gallery yet. Nothing was charged." }, { status: 400 }); }
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (!next) return NextResponse.json({ error: "That picture is not on the website." }, { status: 400 });

  const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ data: next }) });
  if (!r.ok) { await refund?.().catch(() => undefined); return NextResponse.json({ error: "Could not save the change. Please try again." }, { status: 500 }); }

  // The facts keep what the website shows, so the next build starts from it.
  if (inputs.profileId) {
    const f = inputs.facts;
    const old = slot ? urlOf(card, slot) : "";
    const facts = slot === "banner"
      ? { ...f, bannerUrl: newUrl || f.bannerUrl }
      : action === "remove" ? { ...f, photos: f.photos.filter((u) => u !== old) }
      : action === "replace" || (action === "ai" && slot) ? { ...f, photos: f.photos.includes(old) ? f.photos.map((u) => (u === old ? newUrl : u)) : [...f.photos, newUrl].slice(0, MAX_GALLERY_PHOTOS) }
      : { ...f, photos: [...f.photos, newUrl].slice(0, MAX_GALLERY_PHOTOS) };
    if (slot.startsWith("about:")) { /* the About picture is not a fact */ } else await saveFacts(me.id, inputs.profileId, facts).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, url: newUrl, slots: slotsOf(next) });
  } catch {
    await refund?.().catch(() => undefined);
    return NextResponse.json({ error: "Something went wrong. If a credit was taken it has been given back. Please try again." }, { status: 500 });
  } finally {
    inFlight.delete(me.id);
  }
}
