// POST (bearer) BuildRequest { facts, products: BuildRow[] } → BuildResponse { ok, card, checks, missing, siteRead? }.
// (Older clients send the facts flat in the body; that still works.)
//
// Builds the V-Card from everything the owner already told us (setup, saved facts, saved products, approved
// reviews) plus this form:
//   1. saves the typed product rows to poster_products (never deletes; never touches benefits or offers) and the
//      facts to poster_profiles.card_facts, so a rebuild, the website and the posters all start from them;
//   2. reads the owner's own website — its text, and (site-import.ts) its logo, cover and gallery pictures and its
//      products with price, photos and specifications, all copied into our bucket and added where the owner has
//      nothing yet (owner's call, 27 Sep 2026) — and, for branded products, the maker's public details;
//   3. ONE cheap text-AI call writes the wording only (card-ai.ts);
//   4. code lays the card out (card-compose.ts) — prices, photos, timings and trust tiles are the owner's, never AI's.
// The card is returned, not saved: the owner checks it and publishes. Free; rate-limited.
import { NextResponse } from "next/server";
import { bannerKeys } from "@/lib/banners-server";
import { rateLimited } from "@/lib/api-security";
import { restAsService, userFromRequest, stockEngineMod, posterQuota } from "@/lib/poster-server";
import { writeCard, type CardBrief, type CardCopy } from "@/lib/card-ai";
import { readOwnSite, readReference } from "@/lib/reference-site";
import { importSite, siteImportText, storeSiteMedia, type SiteImport, type StoredSite } from "@/lib/site-import";
import { referenceImages } from "@/lib/media/ai-image";
import { lookupProducts } from "@/lib/product-lookup";
import { isOwnMedia, loadCardInputs, loadProducts, ownMediaFacts, saveFacts } from "@/lib/card-inputs";
import { composeCard, factsText, productName, mergeRefresh, addStockMedia } from "@/lib/card-compose";
import { BOOKING_CATEGORIES, mergeFacts, type BuildResponse, type SavedProduct } from "@/lib/card-facts";

export const maxDuration = 150;

const S = (v: unknown, n: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim().slice(0, n);
type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});
/** p, or null after ms (the promise keeps running but is no longer waited for). */
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);

type Row = { id: string; name: string; brand: string; price: string; photo: string; studio: boolean };

/** A product write. Until migration 0050 has run, PostgREST refuses price/mrp/brand, so it is sent once more
 *  without them (the card still shows what was typed). Returns the row id, or null when it could not be saved. */
async function writeProduct(path: string, method: "POST" | "PATCH", body: Obj): Promise<string | null> {
  const send = (b: Obj) => restAsService<{ id: string }[]>(path, { method, headers: { Prefer: "return=representation" }, body: JSON.stringify(b) });
  let r = await send(body);
  if (!r.ok && r.status === 400 && /\b(price|mrp|brand)\b/i.test(r.text)) {
    const rest = { ...body };
    delete rest.price; delete rest.mrp; delete rest.brand;
    r = await send(rest);
  }
  return r.ok ? r.data?.[0]?.id ?? null : null;
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  // Keyed on the logged-in owner alone: an IP from X-Forwarded-For is whatever the caller sent, so mixing it
  // in would hand anybody a fresh bucket (and a new one every time a phone changes mobile tower).
  if (rateLimited(`card-build:${me.id}`, 6, 60 * 60_000)) {
    return NextResponse.json({ error: "You have made your V-Card 6 times in the last hour. Please try again in an hour." }, { status: 429 });
  }
  const b = obj(await request.json().catch(() => null));

  /* ---- inputs ---- */
  const inputs = await loadCardInputs(me);
  let setup = inputs.setup;
  const sent = b.facts && typeof b.facts === "object" && !Array.isArray(b.facts) ? b.facts : b;
  // Only the owner's own uploads may be the shop banner or work photos (never a picture hot-linked from another site).
  let facts = ownMediaFacts(mergeFacts(inputs.facts, sent), me.id);

  const ownIds = new Set(inputs.ownRows.map((r) => r.id));
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const x of (Array.isArray(b.products) ? b.products : []).slice(0, 6)) {
    const o = obj(x);
    const name = S(o.name, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const photo = S(o.photo, 500);
    const own = isOwnMedia(photo, me.id);
    rows.push({
      id: typeof o.id === "string" && ownIds.has(o.id) ? o.id : "",
      name,
      brand: S(o.brand, 40),
      price: S(o.price, 60).replace(/^(?:₹|rs\.?|inr)\s*/i, "").slice(0, 30).trim(),
      photo: own ? photo : "",
      studio: own && o.studio === true,
    });
  }

  if (!setup.business && !setup.person) return NextResponse.json({ error: "Add your name and business in the setup first." }, { status: 400 });

  /* ---- the owner's website: its text and everything else on it, started now (it takes the longest) ---- */
  // Their own site, or the brand's site of the products they sell as a dealer / distributor (then: products only),
  // or a REFERENCE site they like (owner's call, 30 Sep 2026): read for its look and tone only — its facts, pictures
  // and products are somebody else's, so nothing is imported from it and it is never the owner's "Website" link.
  const role = facts.website ? facts.websiteRole : "own";
  const website = role === "reference" ? setup.website : facts.website || setup.website;
  const referenceP = role === "reference" && facts.website ? within(readReference(facts.website, { look: true }).catch(() => null), 45_000) : Promise.resolve(null);
  const siteP = website ? within(readOwnSite(website).catch(() => null), 30_000) : Promise.resolve(null);
  const importRole = role === "reference" ? "own" : role;
  const importP: Promise<{ imp: SiteImport; stored: StoredSite } | null> = website
    ? within(importSite(website).then(async (imp) => (imp ? { imp, stored: await storeSiteMedia(me.id, imp, importRole) } : null)).catch(() => null), 55_000)
    : Promise.resolve(null);

  /* ---- save the typed products (service role; NEVER delete) ---- */
  const used = new Set<string>();
  const plans = rows.map((row) => {
    const target = inputs.ownRows.find((p) => row.id && p.id === row.id && !used.has(p.id))
      ?? inputs.ownRows.find((p) => !used.has(p.id) && (p.name ?? "").trim().toLowerCase() === row.name.toLowerCase());
    if (target) used.add(target.id);
    return { row, target };
  });
  const savedIds = await Promise.all(plans.map(async ({ row, target }, i): Promise<string | null> => {
    const photoObj = row.photo ? { url: row.photo, view: row.studio ? "generated" : "front", role: row.studio ? "context" : "identity" } : null;
    if (target) {
      const patch: Obj = { name: row.name, brand: row.brand, price: row.price };
      if (photoObj && row.photo !== target.photo_url) {
        // The new photo goes first; the old ones stay. When the owner went back from a studio shot to their
        // original ("Use original"), that studio shot is dropped so it does not keep ranking first.
        const old = (Array.isArray(target.photos) ? target.photos : [])
          .filter((p) => !!p && typeof p.url === "string" && p.url !== row.photo && !(!row.studio && p.view === "generated" && p.url === target.photo_url));
        patch.photo_url = row.photo;
        patch.photos = [photoObj, ...old].slice(0, 6);
      }
      return writeProduct(`poster_products?id=eq.${target.id}&user_id=eq.${me.id}`, "PATCH", patch).then((id) => id ?? target.id);
    }
    return writeProduct("poster_products", "POST", {
      user_id: me.id, name: row.name, brand: row.brand, price: row.price,
      photo_url: row.photo || null, photos: photoObj ? [photoObj] : [],
      benefits: [], offer: "", category: "", active: true, sort: 100 + i,
    });
  }));

  /* ---- what the website gave: its products (new ones only), cover, gallery and logo where the owner has none ---- */
  const typedNames = new Set(rows.map((r) => r.name.toLowerCase()));
  const got = await importP;
  if (got) {
    const { stored } = got;
    const have = new Set([...inputs.ownRows.map((r) => (r.name ?? "").trim().toLowerCase()), ...typedNames, ...facts.hidden]);
    const room = Math.max(0, 12 - Math.max(inputs.ownRows.length, rows.length));
    const fresh = stored.products.filter((p) => !have.has(p.name.toLowerCase())).slice(0, room);
    // A dealer sets their own selling price: the brand's price goes in as the MRP, the price stays for them to fill.
    const brandName = importRole === "dealer" ? (got.imp.name || "").slice(0, 40) : "";
    await Promise.all(fresh.map((p, i) => writeProduct("poster_products", "POST", {
      user_id: me.id, name: p.name.slice(0, 60), brand: brandName,
      price: importRole === "dealer" ? "" : p.price.slice(0, 30), mrp: (importRole === "dealer" ? p.mrp || p.price : p.mrp).slice(0, 30),
      photo_url: p.stored[0] ?? null, photos: p.stored.map((url) => ({ url, view: "front", role: "identity" })),
      benefits: p.specs.slice(0, 6), offer: "", category: "", active: true, sort: 200 + i,
    })));
    if (!facts.bannerUrl && stored.cover) facts = { ...facts, bannerUrl: stored.cover };
    if (facts.photos.length < 5 && stored.gallery.length) facts = { ...facts, photos: [...facts.photos, ...stored.gallery.filter((u) => !facts.photos.includes(u))].slice(0, 5) };
    if (!setup.logo && stored.logo) setup = { ...setup, logo: stored.logo };
  }

  // Free or paid, read once: it decides where the card's pictures come from, and nothing that costs money
  // may run before this is known.
  const paidPlan = (await posterQuota(me.token, me.id).catch(() => ({ plan: "free" as const }))).plan !== "free";

  /* ---- a reference website: pictures made in its look, of the owner's OWN trade ---- */
  // Never the reference site's own photographs — those are its owner's. Only used where the owner has
  // nothing of their own, so their photos always win and we never spend on someone who is already covered.
  let aiPhotos = 0;
  // Paid only (owner's call, 1 Oct 2026). Making a picture costs real money every time, so a free card
  // never triggers it: it gets the trade's stock photos instead — Pexels, free for commercial use, and
  // cached per trade, so one search serves everyone in that line of work and the card costs us nothing.
  if (paidPlan && role === "reference" && facts.website && !facts.bannerUrl && facts.photos.length < 2) {
    const ref = await referenceP;
    if (ref?.style) {
      const made = await within(
        referenceImages(me.id, {
          trade: setup.categoryLabel || setup.category || "",
          city: setup.city || "",
          dark: ref.style.dark,
          color: ref.style.colors[0],
          count: 2,
        }).catch(() => [] as string[]),
        60_000,
      ) ?? [];
      if (made.length) {
        aiPhotos = made.length;
        facts = {
          ...facts,
          bannerUrl: facts.bannerUrl || made[0],
          photos: [...facts.photos, ...made.slice(facts.bannerUrl ? 0 : 1)].slice(0, 5),
        };
      }
    }
  }

  /* ---- save the facts ---- */
  if (facts.hidden.some((h) => typedNames.has(h))) facts = { ...facts, hidden: facts.hidden.filter((h) => !typedNames.has(h)) };
  if (inputs.profileId) await saveFacts(me.id, inputs.profileId, facts); // best effort: the card is built either way

  /* ---- the products on the card: the typed rows first, then the rest (minus the ones the owner took off) ---- */
  const after = await loadProducts(me.id);
  const taken = new Set<string>();
  const list: SavedProduct[] = rows.map((row, i) => {
    const id = savedIds[i];
    const found = (id ? after.products.find((p) => p.id === id && !taken.has(p.id)) : undefined)
      ?? after.products.find((p) => !taken.has(p.id) && p.name.toLowerCase() === row.name.toLowerCase());
    if (found) taken.add(found.id);
    const base: SavedProduct = found ?? { id: id ?? "", name: row.name, brand: "", price: "", mrp: "", photo: "", images: [], offer: "", benefits: [] };
    // What the owner typed now wins (also when the new columns could not be saved yet); their chosen photo leads.
    const images = row.photo ? [row.photo, ...base.images.filter((u) => u.split("?")[0] !== row.photo.split("?")[0])].slice(0, 3) : base.images;
    return { ...base, name: row.name, brand: row.brand, price: row.price, images, photo: images[0] ?? "" };
  });
  const hidden = new Set(facts.hidden);
  for (const p of after.products) {
    if (list.length >= 12) break;
    if (taken.has(p.id) || typedNames.has(p.name.toLowerCase()) || hidden.has(p.name.toLowerCase()) || hidden.has(productName(p).toLowerCase())) continue;
    taken.add(p.id);
    list.push(p);
  }
  const brandProducts = after.brandProducts && !rows.length;

  /* ---- the owner's website text (+ what the import found) and the makers' public details ---- */
  const [siteText, info, reference] = await Promise.all([
    siteP,
    lookupProducts(list.filter((p) => p.brand).slice(0, 6).map((p) => ({ name: p.name, brand: p.brand }))),
    referenceP,
  ]);
  const extra = got ? siteImportText(got.imp, importRole) : "";
  const joined = siteText ? (extra ? { ...siteText, text: `${siteText.text}\n${extra}`.slice(0, 11000) } : siteText) : got ? { url: got.imp.url, text: extra } : null;
  const site = joined ? { ...joined, dealer: importRole === "dealer" } : null;

  /* ---- the words (one AI call) ---- */
  const details = factsText({ setup, facts, products: list, info, site });
  // The card's chat bot answers only in the owner's own words: the maker's web text may steer the wording
  // (the owner ticks it off under "Please check"), but it is never stored as something they said.
  const knowledge = factsText({ setup, facts, products: list, info: new Map(), site });
  const business = setup.business || setup.person;
  const brief: CardBrief = {
    business,
    person: setup.person && setup.person !== business ? setup.person : undefined,
    category: setup.categoryLabel || "Business",
    city: setup.city || undefined,
    phone: setup.phone || undefined,
    email: setup.email || undefined,
    details,
    lang: facts.lang,
    persona: setup.persona,
    booking: BOOKING_CATEGORIES.has(setup.category),
    products: list.map(productName),
  };
  // The trade's stock photos are fetched while the AI writes (both take a while; neither needs the other).
  const mediaP = (async () => {
    try {
      const st = await stockEngineMod();
      return await within(st.ensureCardMedia({ category: setup.category || "other", label: setup.categoryLabel || "" }), 45_000);
    } catch (e) { console.log("[card] stock media skipped:", e instanceof Error ? e.message : e); return null; }
  })();
  let copy: CardCopy;
  try { copy = await writeCard(brief, reference); } catch { return NextResponse.json({ error: "The AI did not respond. Please try again." }, { status: 502 }); }

  /* ---- the layout (code) ---- */
  const { card, checks, missing } = composeCard({
    setup, facts, products: list, brandProducts, reviews: inputs.reviews, reviewStats: inputs.reviewStats,
    copy, info, siteUrl: site?.url ?? null, details: knowledge, bannerKeys: bannerKeys(),
    reference: reference ? { url: reference.url, style: reference.style, look: reference.look } : null,
  });
  // refresh: the owner's existing card comes along and only its empty parts are filled (see mergeRefresh).
  const current = b.refresh === true && b.current && typeof b.current === "object" && Array.isArray((b.current as { pages?: unknown }).pages) ? (b.current as Parameters<typeof mergeRefresh>[0]) : null;
  let built = current ? mergeRefresh(current, card) : card;
  // Real photos + a short clip of the trade where the owner has none (cached per trade; ~20 s the first time).
  try {
    const media = await mediaP;
    // Free plan (owner's call, 23 Sep 2026): no made-for-you video on the card — only the photos; the clip comes with the plan.
    // Videos that a template carries (the Shubhora seller card's demos) are part of the template and stay.
    if (media) built = addStockMedia(built, paidPlan ? media : { ...media, clip: null }, facts.lang);
    // A free card with no banner of its own gets one from those same stock photos, so it never opens bare.
    if (media?.photos.length && !built.coverUrl) built = { ...built, coverUrl: media.photos[0].url };
  } catch (e) { console.log("[card] stock media skipped:", e instanceof Error ? e.message : e); }
  const out: BuildResponse = {
    ok: true, card: built, checks, missing,
    ...(website ? { siteRead: !!site } : role === "reference" && facts.website ? { siteRead: !!reference } : {}),
    // What the site actually yielded, so the builder can say so instead of leaving the owner wondering why
    // their products did not come across.
    ...(website && importRole !== "dealer"
      ? { siteFound: { products: got?.stored.products.length ?? 0, photos: (got?.stored.gallery.length ?? 0) + (got?.stored.cover ? 1 : 0) } }
      : {}),
    ...(aiPhotos ? { aiPhotos } : {}),
  };
  return NextResponse.json(out);
}
