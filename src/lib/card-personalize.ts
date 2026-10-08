"use client";

// A template is a design with sample content. When the owner picks one, their own details from the setup (name,
// photo, business, phone, city, address, "about") replace the sample ones, so the first thing they see is their card.
import { api, type Profile } from "@/lib/poster-client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { categoryOf } from "@/lib/poster-categories";
import type { Business } from "@/lib/journey";
import type { FactsResponse } from "@/lib/card-facts";
import type { Card, CardBlock, CardLink } from "@/lib/types";

export { isThinCard } from "@/lib/card-facts";

/** A card made on /poster/card/build, handed to the editor for "Edit first". */
export const SEED_KEY = "card-seed";

export type OwnDetails = { name: string; business: string; type: string; photo: string; logo: string; phone: string; email: string; city: string; address: string; about: string };

export async function loadOwnDetails(): Promise<OwnDetails | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const [{ data }, prof] = await Promise.all([
    sb.auth.getUser(),
    api<{ profiles?: Profile[] }>("/api/poster/profiles").catch(() => null),
  ]);
  const u = data.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { display_name?: string; full_name?: string; phone?: string; contact_email?: string; business?: Business };
  const p = prof?.data.profiles?.find((x) => x.is_default) ?? prof?.data.profiles?.[0];
  const b = meta.business ?? {};
  const phone = (p?.phone || meta.phone || "").replace(/\D/g, "").slice(-10);
  const email = u.email && !/@phone\./.test(u.email) ? u.email : meta.contact_email ?? "";
  return {
    name: meta.display_name || meta.full_name || p?.name || "", business: b.name || "", type: categoryOf(b.category ?? p?.category ?? "")?.en ?? "",
    photo: p?.photo_url ?? "", logo: p?.logo_url ?? "", phone, email,
    city: b.city || p?.city || "", address: b.address || "", about: b.about || "",
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Template content with the owner's own details in place of the samples. Empty details keep the sample text.
 * Unless `keepSamples` (a brand's own design, e.g. Wellwa, whose prices and FAQ are real), everything that would
 * be untrue on the owner's card is taken out: sample reviews, prices and offer badges, FAQ, offers, captions on
 * our stock art, and the sample "about" text.
 */
export function personalize<T extends Partial<Card>>(data: T, own: OwnDetails | null, opts?: { keepSamples?: boolean; identityOnly?: boolean }): T {
  if (!own) return opts?.keepSamples ? data : withoutSamples(structuredClone(data), null) as T;
  const d: Partial<Card> = structuredClone(data);
  if (own.name) d.name = own.name;
  if (opts?.identityOnly) {
    // A brand card (the Shubhora seller card): the owner's face, name and number go in; the company, title,
    // tagline, about, prices and pages are the brand's and stay exactly as written.
    if (own.photo) d.avatarUrl = own.photo;
    const links: CardLink[] = [...(d.links ?? [])];
    const set = (type: CardLink["type"], label: string, value: string) => {
      if (!value) return;
      const i = links.findIndex((l) => l.type === type);
      if (i >= 0) links[i] = { ...links[i], value }; else links.push({ id: uid(), type, label, value });
    };
    if (own.phone) { set("whatsapp", "WhatsApp", `+91${own.phone}`); set("phone", "Call", `+91${own.phone}`); }
    set("email", "Email", own.email);
    d.links = links;
    const where = [own.address, own.city].filter(Boolean).join(", ");
    if (where) d.pages = (d.pages ?? []).map((pg) => ({ ...pg, blocks: pg.blocks.map((b): CardBlock => (b.kind === "location" ? { ...b, address: where } : b)) }));
    d.seo = { ...(d.seo ?? {}), ...(own.city ? { city: own.city } : {}) };
    return d as T;
  }
  if (own.business) d.company = own.business;
  if (own.type) d.jobTitle = own.type;
  if (own.photo) d.avatarUrl = own.photo;
  else if (own.logo) { d.avatarUrl = own.logo; d.avatarShape = "square"; }
  if (own.logo) d.site = { enabled: d.site?.enabled ?? false, ...d.site, logoUrl: own.logo };
  if (own.city) d.tagline = d.tagline ? d.tagline : own.city;

  // Contact buttons: the owner's number and email instead of the sample ones.
  const links: CardLink[] = [...(d.links ?? [])];
  const set = (type: CardLink["type"], label: string, value: string) => {
    if (!value) return;
    const i = links.findIndex((l) => l.type === type);
    if (i >= 0) links[i] = { ...links[i], value }; else links.push({ id: uid(), type, label, value });
  };
  if (own.phone) { set("whatsapp", "WhatsApp", `+91${own.phone}`); set("phone", "Call", `+91${own.phone}`); }
  set("email", "Email", own.email);
  d.links = links;

  // Their "about", address and city go into the matching blocks.
  const where = [own.address, own.city].filter(Boolean).join(", ");
  d.pages = (d.pages ?? []).map((pg) => ({
    ...pg,
    blocks: pg.blocks.map((b): CardBlock => {
      if (b.kind === "about" && own.about) return { ...b, body: own.about };
      if (b.kind === "location" && where) return { ...b, address: where };
      return b;
    }),
  }));
  d.seo = { ...(d.seo ?? {}), ...(own.city ? { city: own.city } : {}), ...(own.type ? { category: own.type } : {}) };
  return (opts?.keepSamples ? d : withoutSamples(d, own)) as T;
}

const isOurArt = (url?: string) => !!url && url.startsWith("/art/");

/** Takes the template's sample content off (see personalize). Works on `d` in place and returns it. */
function withoutSamples(d: Partial<Card>, own: OwnDetails | null): Partial<Card> {
  const who = own ? own.business || own.name : "";
  const neutral = own && who ? `${who}${own.type ? ` — ${own.type}` : ""}${own.city ? `, ${own.city}` : ""}.` : "";
  const about = own?.about || neutral;
  d.about = about;
  d.pages = (d.pages ?? [])
    .map((pg) => ({
      ...pg,
      blocks: pg.blocks
        .filter((b) => b.kind !== "faq" && b.kind !== "offer")
        .map((b): CardBlock => {
          switch (b.kind) {
            case "testimonials": return { ...b, items: [] };
            case "product": return { ...b, items: b.items.map((it) => ({ ...it, price: undefined, mrp: undefined, badge: undefined })) };
            case "gallery": return { ...b, images: b.images.map((im) => (isOurArt(im.url) ? { ...im, label: "" } : im)) };
            case "image":
            case "carousel": return { ...b, images: b.images.map((im) => (isOurArt(im.url) ? { ...im, caption: "" } : im)) };
            case "about": return { ...b, body: about };
            default: return b;
          }
        }),
    }))
    .filter((pg, i) => i === 0 || pg.blocks.length > 0);
  return d;
}

/** The setup is the one place for "who you are": saving it also updates the published V-Card's name, business, photo,
 *  logo and number (never its other content). A changed photo/logo replaces the card photo; an untouched one only
 *  replaces a card photo that still shows the old setup photo.
 *  Only the owner's own card is touched: their primary card (the one made on "Make your V-Card"), or their only card.
 *  With several cards and no primary one, nothing is changed — a card made for someone else is never rewritten.
 *  When the cards cannot be loaded (no internet), nothing is changed either. */
/** The set-up's words and pictures that the live website shows: each one is written onto the card only when it
 *  CHANGED in this save (old → new), so a word the owner typed in the editor is never replaced by a stale set-up. */
export type SetupSync = { about?: string; oldAbout?: string; hours?: string; oldHours?: string; address?: string; oldAddress?: string; banner?: string; oldBanner?: string; photos?: string[]; oldPhotos?: string[] };

/** "Mon–Sat 10 AM – 8 PM" → { day: "Mon–Sat", time: "10 AM – 8 PM" }; a line with no time keeps the whole line as the day. */
function hoursRows(text: string): { day: string; time: string }[] {
  return text.split(/\n|·|;/).map((x) => x.trim()).filter(Boolean).slice(0, 7).map((line) => {
    // Only a line that starts with a day word is split ("Mon–Sat 10 AM – 8 PM"); "10 AM – 8 PM" alone stays whole, as the build keeps it.
    const m = /^([A-Za-z\u0900-\u097F][^\d]*?)\s+(\d.*|[Cc]losed.*|बंद.*)$/.exec(line);
    return m ? { day: m[1].trim(), time: m[2].trim() } : { day: line, time: "" };
  });
}

export async function syncCardFromSetup(s: { name: string; business: string; photo: string | null; logo: string | null; phone: string; oldPhoto?: string | null; oldLogo?: string | null; facts?: SetupSync }) {
  const { fetchMyCardsStrict, publishCard } = await import("@/lib/cloud");
  let cards: Card[];
  try { cards = await fetchMyCardsStrict(); } catch { return; }
  if (!cards.length) return;
  let c: Card | undefined;
  if (cards.length > 1) {
    const fr = await api<Partial<FactsResponse>>("/api/card/facts").catch(() => null);
    const primary = fr?.ok ? fr.data.facts?.primaryCardId : "";
    c = primary ? cards.find((x) => x.id === primary) : undefined;
  } else c = cards[0];
  if (!c || /\byour name\b/i.test(c.name ?? "")) return;
  const next = structuredClone(c);
  if (s.name) next.name = s.name;
  if (s.business) next.company = s.business;
  const photoChanged = !!s.photo && s.photo !== s.oldPhoto;
  const logoChanged = !!s.logo && s.logo !== s.oldLogo;
  const showsOld = !c.avatarUrl || c.avatarUrl === s.oldPhoto || c.avatarUrl === s.oldLogo;
  // A shop's card shows its logo, not the owner's face: re-saving the setup must never swap the logo
  // for the personal photo. Only a NEW logo changes such a card's picture.
  const preferLogo = c.lead === "business" && !!s.logo;
  if (!preferLogo && (photoChanged || (s.photo && showsOld))) { next.avatarUrl = s.photo!; next.avatarShape = "circle"; }
  else if ((preferLogo || !s.photo) && (logoChanged || (s.logo && showsOld))) { next.avatarUrl = s.logo!; next.avatarShape = "square"; }
  if (s.logo) next.site = { enabled: next.site?.enabled ?? false, ...next.site, logoUrl: s.logo };
  if (s.phone) next.links = next.links.map((l) => (l.type === "phone" || l.type === "whatsapp" ? { ...l, value: `+91${s.phone}` } : l));
  // The focused edits from Card & Website → Edit (owner's call, 7 Oct 2026): what was changed here lands on the live
  // website at once — before, a new timing or about waited for "Write again".
  const f = s.facts;
  if (f) {
    const changed = (a?: string, b?: string) => (a ?? "").trim() !== (b ?? "").trim() && !!(a ?? "").trim();
    const mapBlocks = (fn: (b: CardBlock) => CardBlock) => { next.pages = next.pages.map((p) => ({ ...p, blocks: p.blocks.map(fn) })); };
    if (changed(f.about, f.oldAbout)) {
      next.about = f.about!.trim();
      let first = true;
      mapBlocks((b) => (b.kind === "about" && first ? (first = false, { ...b, body: f.about!.trim() }) : b));
    }
    if (changed(f.hours, f.oldHours)) mapBlocks((b) => (b.kind === "hours" ? { ...b, rows: hoursRows(f.hours!) } : b.kind === "appointment" ? { ...b, note: f.hours!.trim() } : b));
    if (changed(f.address, f.oldAddress)) mapBlocks((b) => (b.kind === "location" ? { ...b, address: f.address!.trim() } : b));
    if (changed(f.banner, f.oldBanner)) {
      next.coverUrl = f.banner!.trim();
      if (next.site) next.site = { ...next.site, hero: { ...(next.site.hero ?? { headline: next.company || next.name, sub: "" }), imageUrl: f.banner!.trim() } };
    }
    const fresh = (f.photos ?? []).filter((u) => u && !(f.oldPhotos ?? []).includes(u));
    if (fresh.length) {
      let first = true;
      mapBlocks((b) => (b.kind === "gallery" && first ? (first = false, { ...b, images: [...b.images, ...fresh.filter((u) => !b.images.some((i) => i.url === u)).map((u) => ({ url: u, color: next.themeColor, label: "" }))].slice(0, 12) }) : b));
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(c)) await publishCard(next);
}

/** A product row as the Products page keeps it (the fields the live card shows). */
export type ProductSync = { name: string; price?: string | null; mrp?: string | null; photo_url?: string | null; photos?: { url: string }[] | null; benefits?: unknown; offer?: string | null; active?: boolean; category?: string | null };

/** The Products page's rows onto the live website (audit, 7 Oct 2026: a changed price or photo waited for "Write
 *  again"). Every product block on the card: an item whose product still exists takes its current price, MRP, photos
 *  and points; an item whose product was switched off or deleted goes; an active product on no block yet joins the
 *  first product block. Words the AI wrote (desc) stay. Nothing happens without a live card. */
export async function syncProductsToCard(rows: ProductSync[]) {
  const { fetchMyCardsStrict, publishCard } = await import("@/lib/cloud");
  let cards: Card[];
  try { cards = await fetchMyCardsStrict(); } catch { return; }
  if (!cards.length) return;
  let c: Card | undefined;
  if (cards.length > 1) {
    const fr = await api<Partial<FactsResponse>>("/api/card/facts").catch(() => null);
    const primary = fr?.ok ? fr.data.facts?.primaryCardId : "";
    c = primary ? cards.find((x) => x.id === primary) : undefined;
  } else c = cards[0];
  if (!c || /\byour name\b/i.test(c.name ?? "")) return;
  const own = rows.filter((r) => (r.name ?? "").trim() && !/shubhora/i.test(`${r.name} ${r.category ?? ""}`));
  if (!own.length) return;
  const key = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
  const byName = new Map(own.map((r) => [key(r.name), r]));
  const imagesOf = (r: ProductSync) => { const list = [...(r.photos ?? []).map((p) => p?.url).filter((u): u is string => !!u), ...(r.photo_url ? [r.photo_url] : [])]; return [...new Set(list)].slice(0, 3); };
  const price = (v?: string | null) => (v ?? "").trim() ? ((/^(₹|rs)/i.test(v!.trim()) ? v!.trim() : `₹${v!.trim()}`)) : "";
  const next = structuredClone(c);
  const seen = new Set<string>();
  let firstBlock: Extract<CardBlock, { kind: "product" }> | null = null;
  for (const pg of next.pages) {
    for (let i = 0; i < pg.blocks.length; i++) {
      const b = pg.blocks[i];
      if (b.kind !== "product") continue;
      if (!firstBlock || pg.slug === "products") firstBlock = firstBlock && pg.slug !== "products" ? firstBlock : b;
      b.items = b.items.flatMap((it) => {
        const r = byName.get(key(it.name));
        if (!r) return [it];                       // not from the Products page (the AI's own or a service) — untouched
        if (r.active === false) return [];          // switched off / deleted → off the website
        seen.add(key(it.name));
        const imgs = imagesOf(r);
        const benefits = Array.isArray(r.benefits) ? (r.benefits as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 6) : it.features;
        return [{ ...it, ...(price(r.price) ? { price: price(r.price) } : {}), ...(price(r.mrp) ? { mrp: price(r.mrp) } : {}), ...(imgs.length ? { images: imgs, imageUrl: imgs[0] } : {}), ...(r.offer?.trim() ? { badge: r.offer.trim().slice(0, 30) } : {}), features: benefits.length ? benefits : it.features }];
      });
    }
  }
  const fresh = own.filter((r) => r.active !== false && !seen.has(key(r.name)));
  if (fresh.length && firstBlock) {
    for (const r of fresh.slice(0, 12)) {
      const imgs = imagesOf(r);
      firstBlock.items.push({ name: r.name.trim().slice(0, 60), ...(price(r.price) ? { price: price(r.price) } : {}), ...(price(r.mrp) ? { mrp: price(r.mrp) } : {}), ...(imgs.length ? { images: imgs, imageUrl: imgs[0] } : {}), ...(r.offer?.trim() ? { badge: r.offer.trim().slice(0, 30) } : {}), features: Array.isArray(r.benefits) ? (r.benefits as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 6) : [], specs: [] });
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(c)) await publishCard(next);
}
