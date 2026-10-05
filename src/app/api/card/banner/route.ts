// The Premium banner, made at Final (docs/website-looks-v2.md §7): the website goes live with its stock pictures,
// then this makes the AI banner (and two gallery pictures when the owner has fewer than two of their own) in the
// chosen look's colour and mood, puts it on the live card, finds its focus, and tells the owner. Never inside the
// build, so no picture is ever paid for on a look the owner did not keep.
//
// GET  (bearer) → the banner job: { job: null } or { job, state, elapsed, status?, result? }
// POST (bearer) { cardId?, again?: true, count?: 1-6, wish?: string } → starts it (202) or joins the running one.
//      The first banner of a card is part of Premium; `again` costs one credit a picture, taken before anything runs.
// POST (bearer) { revert: <job id> } → the stock pictures back (the AI ones stay in the owner's media).
import { NextResponse, after } from "next/server";
import { claim, currentJob, jobView, startJob, touch, type CardJob } from "@/lib/card-jobs";
import { notify } from "@/lib/notify";
import { restAsService, userFromRequest, posterQuota } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";
import { loadCardInputs, saveFacts } from "@/lib/card-inputs";
import { referenceImages, IMG_MODEL } from "@/lib/media/ai-image";
import { logImages } from "@/lib/ai-usage";
import { bannerFocus } from "@/lib/media/photo-focus";
import { SITE_PALETTES } from "@/lib/site-style";
import { categoryOf } from "@/lib/poster-categories";
import { MAX_GALLERY_PHOTOS, MAX_WRITE_AGAIN_PHOTOS } from "@/lib/card-facts";
import { SITE_URL } from "@/lib/site-url";
import type { Card } from "@/lib/types";

export const maxDuration = 200;

const madeByUs = (u: string) => /\/ref-\d+(-\d+)?\.(png|jpe?g|webp)(\?|$)/i.test(u);
const keyOf = (uid: string) => `${uid}-banner`;
type Obj = Record<string, unknown>;

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const job = await currentJob(keyOf(me.id));
  if (!job) return NextResponse.json({ job: null });
  touch(keyOf(me.id));
  return NextResponse.json(jobView(job));
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Obj;
  const key = keyOf(me.id);

  if (typeof b.revert === "string") {
    const job = await currentJob(key);
    const res = job?.result as { prev?: { coverUrl?: string; heroImageUrl?: string; cardId: string } } | undefined;
    if (!job || job.id !== b.revert || !res?.prev) return NextResponse.json({ error: "Nothing to put back." }, { status: 400 });
    const row = await myCard(me.id, res.prev.cardId);
    if (!row) return NextResponse.json({ error: "Card not found." }, { status: 404 });
    const data = row.data as Card;
    const next: Card = { ...data, coverUrl: res.prev.coverUrl, site: data.site ? { ...data.site, hero: data.site.hero ? { ...data.site.hero, imageUrl: res.prev.heroImageUrl } : data.site.hero } : data.site };
    const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ data: next }) });
    await claim(key, job.id);
    return NextResponse.json({ ok: r.ok });
  }
  if (typeof b.claim === "string") return NextResponse.json({ ok: await claim(key, b.claim) });

  const paid = (await posterQuota(me.token, me.id).catch(() => ({ plan: "free" as const }))).plan !== "free";
  if (!paid) return NextResponse.json({ error: "The AI banner comes with Premium.", plan: true }, { status: 402 });
  const row = await myCard(me.id, typeof b.cardId === "string" ? b.cardId : undefined);
  if (!row) return NextResponse.json({ error: "Create your website first." }, { status: 400 });
  const running = await currentJob(key);
  if (running?.state === "running") return NextResponse.json({ ...jobView(running), joined: true }, { status: 202 });

  const inputs = await loadCardInputs(me);
  const { setup, facts } = inputs;
  const data = row.data as Card;
  const again = b.again === true;
  // The owner's own banner is theirs: never painted over unless they ask again.
  if (!again && facts.bannerUrl && !madeByUs(facts.bannerUrl)) return NextResponse.json({ error: "You already have your own banner.", own: true }, { status: 409 });
  const hadAi = !!(data.coverUrl && madeByUs(data.coverUrl));
  const ownPhotos = facts.photos.filter((u) => !madeByUs(u)).length;
  const count = again ? Math.max(1, Math.min(MAX_WRITE_AGAIN_PHOTOS, Math.round(Number(b.count)) || 1)) : 1 + (ownPhotos < 2 ? 2 : 0);
  const wish = typeof b.wish === "string" ? b.wish.trim().slice(0, 600) : "";

  // Another banner costs a credit a picture (owner's call, 4 Oct 2026: "ek image = 1 credit"); the first is Premium's.
  let refund: null | (() => Promise<unknown>) = null;
  if (again || hadAi) {
    const ref = `banner-${me.id.slice(0, 8)}-${Date.now()}`;
    const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: count, p_reason: "banner-again", p_ref: ref }) });
    if (!spend.ok) return NextResponse.json({ error: `A new banner uses ${count} credit${count > 1 ? "s" : ""}. Add credits and try again.`, needCredits: count }, { status: 402 });
    refund = () => restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: count, p_reason: "banner-again-refund", p_ref: ref }) });
  }

  // The look's colour and mood, so the banner matches the website it lands on.
  const st = data.site?.style ?? {};
  const pal = SITE_PALETTES.find((p) => p.key === st.palette && p.key !== "brand");
  const color = st.palette === "brand" && st.color ? st.color : pal?.mid ?? categoryOf(setup.category)?.accent;
  const dark = pal ? pal.tone === "dark" : true;

  const { job, done, joined } = await startJob(key, { fresh: again }, async (step) => {
    step("pictures");
    const made = await referenceImages(me.id, { trade: setup.categoryLabel || setup.category || "", city: setup.city || "", dark, color, banner: true, count, ...(wish ? { wish } : {}) }).catch(() => [] as string[]);
    logImages("card-banner", IMG_MODEL, made.length);
    if (!made.length) { await refund?.().catch(() => undefined); return { status: 502, body: { error: "The picture could not be made. Your website stays as it is; nothing was charged." } }; }
    step("checking");
    const banner = made[0], gallery = made.slice(1);
    const fresh = await myCard(me.id, row.id);
    const cur = (fresh?.data ?? data) as Card;
    const prev = { cardId: row.id, coverUrl: cur.coverUrl, heroImageUrl: cur.site?.hero?.imageUrl };
    const focus = await bannerFocus(banner).catch(() => null);
    const site = cur.site ? {
      ...cur.site,
      // The banner goes on top (owner's call, 4 Oct 2026): a hero that would not show it becomes the photo hero.
      style: { ...(cur.site.style ?? {}), ...(["photo", "editorial"].includes(cur.site.style?.hero ?? "") ? {} : { hero: "photo" as const }) },
      hero: { ...(cur.site.hero ?? { headline: cur.company || cur.name, sub: "" }), imageUrl: banner, ...(focus ? { focus: focus.focus, textSide: focus.textSide } : {}) },
    } : cur.site;
    // Gallery pictures join the first gallery block (or the facts' photos, for the next build).
    const pages = gallery.length ? cur.pages.map((p) => ({ ...p, blocks: p.blocks.map((bl) => bl.kind === "gallery" && !p.hidden ? { ...bl, images: [...bl.images, ...gallery.filter((u) => !bl.images.some((i) => i.url === u)).map((u) => ({ url: u, color: cur.themeColor, label: "" }))].slice(0, MAX_GALLERY_PHOTOS) } : bl) })) : cur.pages;
    const next: Card = { ...cur, coverUrl: banner, site, pages };
    const r = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ data: next }) });
    if (!r.ok) { await refund?.().catch(() => undefined); return { status: 500, body: { error: "The banner was made but could not be put on your website. Please try again." } }; }
    if (inputs.profileId) await saveFacts(me.id, inputs.profileId, { ...facts, bannerUrl: banner, photos: [...facts.photos, ...gallery].slice(0, MAX_GALLERY_PHOTOS) }).catch(() => undefined);
    return { status: 200, body: { ok: true, banner, gallery, prev, cardId: row.id, username: cur.username } };
  }, async (j: CardJob) => {
    if (Date.now() - j.seenAt < 20_000) return;
    if (j.state === "done") await notify(me.id, "website_ready", { title: "Your Premium banner is on", body: "आपकी website पर Premium banner लग गया — खोलकर देखें।", path: "/poster/card/build?improve=1", ref: j.id, whatsappText: `*आपकी website पर Premium banner लग गया* ✨\n\n${SITE_URL}/c/${(j.result as { username?: string })?.username ?? ""}` });
  });
  if (!joined) after(() => done.then(() => undefined));
  return NextResponse.json({ ...jobView(job), joined, count, charged: again || hadAi ? count : 0 }, { status: 202 });
}
