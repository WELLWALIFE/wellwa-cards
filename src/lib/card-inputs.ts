import "server-only";
// Everything the owner already told us, in one place, for "Make your V-Card": the setup (auth metadata + poster
// profile), the saved card facts, their products (or their brand's, when they have none), and approved reviews.
// Used by GET/PATCH /api/card/facts and POST /api/card/build.
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";
import { categoryOf } from "@/lib/poster-categories";
import { noClaims } from "@/lib/product-lookup";
import { normalizeFacts, type CardFacts, type SavedProduct, type SetupInfo } from "@/lib/card-facts";

type Meta = {
  display_name?: string; full_name?: string; phone?: string; contact_email?: string;
  business?: { name?: string; role?: string; reach?: string; category?: string; city?: string; address?: string; about?: string; website?: string; gstin?: string; map?: string; nameFromSite?: boolean; categoryFromSite?: boolean; aboutFromSite?: boolean };
};
type ProfileRow = { id: string; name: string | null; phone: string | null; photo_url: string | null; logo_url: string | null; city: string | null; category: string | null; persona: string | null; card_facts?: unknown };
type Photo = { url?: unknown; view?: unknown; role?: unknown };
/** A poster_products row as read here. price, mrp and brand exist once migration 0050 has run. */
export type ProductRow = { id: string; name: string; photo_url: string | null; photos: Photo[] | null; benefits: unknown; offer: string | null; price?: string | null; mrp?: string | null; brand?: string | null; category?: string | null };
export type Review = { name: string; city: string; text: string; rating: number };

export type CardInputs = {
  setup: SetupInfo;
  profileId: string | null;
  facts: CardFacts;
  products: SavedProduct[];
  brandProducts: boolean;
  /** Approved reviews, newest first, at most 12. */
  reviews: Review[];
  /** Count and average rating of ALL approved reviews (reviews above is only the newest 12). */
  reviewStats: { count: number; avg: number };
  /** The owner's own product rows as stored (photos with their view tags) — [] for brand products. */
  ownRows: ProductRow[];
};

const PROFILE_COLS = "id,name,phone,photo_url,logo_url,city,category,persona";
const PRODUCT_COLS = "id,name,photo_url,photos,benefits,offer";
const NEW_PRODUCT_COLS = ",price,mrp,brand,category";
const S = (v: unknown, n: number) => (typeof v === "string" ? v : "").trim().slice(0, n);

/**
 * A select that also asks for columns added by migration 0050. Until the owner has run that migration PostgREST
 * refuses the whole select, so it is asked once more without them: the V-Card still works, it just cannot keep
 * prices, brands and facts yet.
 */
async function selectNew<T>(path: string, cols: string, extra: string): Promise<T[]> {
  const r = await restAsService<T[]>(`${path}&select=${cols}${extra}`);
  if (r.ok) return r.data ?? [];
  if (r.status >= 500 && r.status !== 503) return [];
  const old = await restAsService<T[]>(`${path}&select=${cols}`);
  return old.ok ? old.data ?? [] : [];
}

const MEDIA_PREFIX = SUPA_URL ? `${SUPA_URL}/storage/v1/object/public/media/` : "";

/** True for an image the owner uploaded to our own storage (never a picture hot-linked from another site). */
export function isOwnMedia(url: unknown, userId: string): url is string {
  return typeof url === "string" && !!MEDIA_PREFIX && url.startsWith(MEDIA_PREFIX) && url.includes(userId) && !/[\s"'<>\\]/.test(url);
}

/** True for an image in OUR media bucket, whoever uploaded it (a brand's product photo belongs to the brand
 *  admin, not to the member showing it). Used on the way OUT, so a row written before the check was added
 *  cannot put another website's picture — and every visitor's IP — on a card. */
export function isOurMedia(url: unknown): url is string {
  if (typeof url !== "string" || !url || /[\s"'<>\\]/.test(url)) return false;
  if (isCuratedStock(url)) return true;
  return MEDIA_PREFIX ? url.startsWith(MEDIA_PREFIX) : /^https:\/\/\S+$/.test(url);
}

/** Our own curated pictures served by /api/stock (the Shubhora plan images, trade banners, demo posters) — same-site,
 *  no third-party host. The "Promote Shubhora" products on /poster/products use these. */
export function isCuratedStock(url: unknown): boolean {
  return typeof url === "string" && /^\/api\/stock\/(vcard|banners|demo)\/[\w.-]+\.(jpe?g|png|webp)$/.test(url);
}

/** Facts with only the owner's own uploads kept as the shop banner and work photos. */
export function ownMediaFacts(f: CardFacts, userId: string): CardFacts {
  return { ...f, bannerUrl: isOwnMedia(f.bannerUrl, userId) ? f.bannerUrl : "", photos: f.photos.filter((u) => isOwnMedia(u, userId)) };
}

const VIEW_RANK: Record<string, number> = { generated: 0, front: 1, three_quarter: 2, in_use: 3, packaging: 4, other: 5, installed: 6, back: 7, output_closeup: 8 };
const rank = (v: unknown) => VIEW_RANK[String(v)] ?? 5;

/** Up to 3 https photos of a product: studio shot first, then front, three-quarter, in-use …; photo_url last. */
export function productImages(row: Pick<ProductRow, "photo_url" | "photos">): string[] {
  const list = (Array.isArray(row.photos) ? row.photos : [])
    .filter((p): p is Photo => !!p && typeof p === "object" && typeof p.url === "string")
    .map((p, i) => ({ url: String(p.url), r: rank(p.view), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((p) => p.url);
  if (row.photo_url) list.push(row.photo_url);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of list) {
    const key = u.split("?")[0];
    if (!isOurMedia(u) || seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= 3) break;
  }
  return out;
}

/** A poster_products row → the shape the V-Card form and composer use. */
export function toSavedProduct(row: ProductRow, brand = false): SavedProduct {
  const images = productImages(row);
  const benefits = (Array.isArray(row.benefits) ? row.benefits : [])
    .map((x) => (typeof x === "string" ? x.trim().slice(0, 90) : ""))
    .filter((x) => x && (!brand || noClaims(x)))
    .slice(0, 12);
  return {
    id: row.id,
    name: S(row.name, 60),
    brand: S(row.brand, 40),
    price: S(row.price, 30),
    mrp: S(row.mrp, 30),
    photo: images[0] ?? "",
    images,
    offer: S(row.offer, 60),
    benefits,
    category: S(row.category, 40),
  };
}

/** The owner's own active products, or — only when they have none — their brand's. */
export async function loadProducts(userId: string): Promise<{ products: SavedProduct[]; brandProducts: boolean; rows: ProductRow[] }> {
  const own = await selectNew<ProductRow>(`poster_products?user_id=eq.${userId}&brand_id=is.null&active=eq.true&order=sort,created_at&limit=24`, PRODUCT_COLS, NEW_PRODUCT_COLS);
  if (own.length) return { products: own.map((r) => toSavedProduct(r)), brandProducts: false, rows: own };
  const brandId = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${userId}&select=brand_id`)).data?.[0]?.brand_id;
  if (!brandId || !/^[0-9a-f-]{36}$/i.test(brandId)) return { products: [], brandProducts: false, rows: [] };
  const brand = await selectNew<ProductRow>(`poster_products?brand_id=eq.${brandId}&active=eq.true&order=sort,created_at&limit=12`, PRODUCT_COLS, NEW_PRODUCT_COLS);
  return brand.length ? { products: brand.map((r) => toSavedProduct(r, true)), brandProducts: true, rows: [] } : { products: [], brandProducts: false, rows: [] };
}

/** Writes a few business fields on the account (auth user_metadata.business) from the server — the build does
 *  this when the owner's own website settles the trade or the about text, so the posters, the footer line and
 *  the next set-up visit agree with the card. Merged key by key; best effort (false when it could not). */
export async function patchBusinessMeta(userId: string, patch: Record<string, unknown>): Promise<boolean> {
  try {
    const h = { ...serviceHeaders(), "Content-Type": "application/json" };
    const cur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)) as { user_metadata?: Meta } | null;
    if (!cur) return false;
    const md = cur.user_metadata ?? {};
    const business = { ...(md.business ?? {}), ...patch };
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: h, body: JSON.stringify({ user_metadata: { ...md, business } }) });
    return r.ok;
  } catch { return false; }
}

/** Just the saved facts and the profile they live on (the light read behind every autosave). */
export async function loadSavedFacts(userId: string): Promise<{ profileId: string | null; facts: CardFacts }> {
  const rows = await selectNew<{ id: string; card_facts?: unknown }>(`poster_profiles?user_id=eq.${userId}&order=is_default.desc,created_at&limit=1`, "id", ",card_facts");
  return { profileId: rows[0]?.id ?? null, facts: normalizeFacts(rows[0]?.card_facts ?? {}) };
}

/** Saves the facts on the owner's profile. False when it could not be saved (e.g. migration 0050 not run yet). */
export async function saveFacts(userId: string, profileId: string, facts: CardFacts): Promise<boolean> {
  const r = await restAsService(`poster_profiles?id=eq.${profileId}&user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ card_facts: facts }),
  });
  return r.ok;
}

export async function loadCardInputs(me: { id: string; token: string }): Promise<CardInputs> {
  const [who, profiles, prods, reviewRows, ratingRows] = await Promise.all([
    fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${me.token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ email?: string; user_metadata?: Meta } | null>,
    selectNew<ProfileRow>(`poster_profiles?user_id=eq.${me.id}&order=is_default.desc,created_at&limit=1`, PROFILE_COLS, ",card_facts"),
    loadProducts(me.id),
    restAsService<{ customer_name: string | null; text: string | null; rating: number | null; city: string | null }[]>(
      `poster_testimonials?user_id=eq.${me.id}&approved=eq.true&order=created_at.desc&limit=12&select=customer_name,text,rating,city`),
    restAsService<{ rating: number | null }[]>(`poster_testimonials?user_id=eq.${me.id}&approved=eq.true&select=rating&limit=1000`),
  ]);
  const meta = who?.user_metadata ?? {};
  const biz = meta.business ?? {};
  const profile = profiles[0] ?? null;
  const cat = categoryOf(biz.category || profile?.category || "");

  const email = who?.email && !/@phone\./.test(who.email) ? who.email : S(meta.contact_email, 120);
  const setup: SetupInfo = {
    // `role` (23 Sep 2026): business → the company leads; professional / agent / personal → the person leads.
    kind: biz.role ? (biz.role === "business" ? "business" : "person") : (S(biz.name, 80) ? "business" : "person"),
    role: (["business", "professional", "agent", "personal"] as const).find((r) => r === biz.role) ?? (S(biz.name, 80) ? "business" : "professional"),
    reach: (["local", "india", "online"] as const).find((r) => r === biz.reach) ?? "local",
    business: S(biz.name, 80) || (profile?.persona === "business" ? S(profile?.name, 80) : ""),
    person: S(meta.display_name, 60) || S(meta.full_name, 60),
    category: S(biz.category, 40) || S(profile?.category, 40),
    categoryLabel: cat?.en ?? "",
    persona: cat?.persona ?? profile?.persona ?? "business",
    city: S(biz.city, 60) || S(profile?.city, 60),
    address: S(biz.address, 200),
    website: S(biz.website, 300),
    gstin: S(biz.gstin, 15).toUpperCase().replace(/[^0-9A-Z]/g, ""),
    about: S(biz.about, 1200),
    map: S(biz.map, 300),
    logo: S(profile?.logo_url, 500),
    photo: S(profile?.photo_url, 500),
    phone: (S(profile?.phone, 20) || S(meta.phone, 20)).replace(/\D/g, "").slice(-10),
    email: S(email, 120),
    ...(typeof biz.nameFromSite === "boolean" ? { nameFromSite: biz.nameFromSite } : {}),
    ...(typeof biz.categoryFromSite === "boolean" ? { categoryFromSite: biz.categoryFromSite } : {}),
    ...(typeof biz.aboutFromSite === "boolean" ? { aboutFromSite: biz.aboutFromSite } : {}),
  };

  const reviews: Review[] = (reviewRows.data ?? [])
    .map((r) => ({ name: S(r.customer_name, 60), city: S(r.city, 40), text: S(r.text, 320), rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))) }))
    .filter((r) => r.text);
  const ratings = (ratingRows.data ?? []).map((r) => Math.min(5, Math.max(1, Number(r.rating) || 5)));
  const reviewStats = ratings.length
    ? { count: ratings.length, avg: ratings.reduce((a, b) => a + b, 0) / ratings.length }
    : { count: reviews.length, avg: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0 };

  // Shubhora's plans (saved as products by "Sell Shubhora", or reaching a brand-team member through the brand
  // fallback) are never a business's own products: a "Both" card is the owner's business with Shubhora on the
  // bottom strip only (owner's call, 2 Oct 2026). A partner whose business IS Shubhora keeps them.
  const shubhoraBiz = /shubhora/i.test(`${setup.business} ${setup.person}`);
  const ours = (p: { name?: string | null; brand?: string | null }) => /shubhora/i.test(`${p.name ?? ""} ${p.brand ?? ""}`);
  const products = shubhoraBiz ? prods.products : prods.products.filter((p) => !ours(p));
  return {
    setup,
    profileId: profile?.id ?? null,
    facts: normalizeFacts(profile?.card_facts ?? {}),
    products,
    brandProducts: prods.brandProducts && products.length > 0,
    reviews,
    reviewStats,
    ownRows: shubhoraBiz ? prods.rows : prods.rows.filter((r) => !ours(r)),
  };
}
