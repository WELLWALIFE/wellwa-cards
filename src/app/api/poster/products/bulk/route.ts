// Saves the items the owner kept from "Add many at once" as products, in one go. Items already on the list (same name) are skipped.
// Errors carry a `code` (busy · limit · big · read · full · save) so the page can say them in the owner's language.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { stockPhotoForProduct, usedPhotoIds, tradeOf, pool } from "@/lib/media/product-stock";

export const maxDuration = 120;

const HOUR = 60 * 60_000;
const MAX_ITEMS = 40;                // products added in one go
const MAX_PRODUCTS = 500;            // products one owner can keep in all
const MAX_BODY = 100_000;            // bytes: 40 items are a few KB, so this is only a guard against junk
const START_BY = 60_000;             // no new picture lookup starts after this many ms (it would have under 30 s left)
const END_BY = 90_000;               // every lookup — the search AND saving its file — is over by then, so the save below always has time
const SAVE_MS = 20_000;              // the save itself may take this long
const S = (v: unknown, n: number) => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, n);
const money = (v: unknown) => S(v, 30).replace(/^(?:₹|rs\.?|inr)\s*/i, "").trim();
/** Owners whose list is being saved right now: a second tap (or a retry) meanwhile would add every product twice. */
const inFlight = new Set<string>();
const fail = (error: string, status: number, code: string) => NextResponse.json({ error, code }, { status });

export async function POST(request: Request) {
  const t0 = Date.now();
  const me = await userFromRequest(request);
  if (!me) return fail("Please log in.", 401, "login");
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return fail("That list is too big. Please add fewer products at a time.", 413, "big");
  if (inFlight.has(me.id)) return fail("Your last list is still being added. Please wait a minute, then look at your products.", 409, "busy");
  if (rateLimited(`product-bulk:${me.id}`, 20, HOUR)) return fail("Too many tries in an hour. Please wait a little.", 429, "limit");
  inFlight.add(me.id);
  try {
    const b = (await request.json().catch(() => ({}))) as { items?: unknown; pictures?: unknown };
    const have = await restAsUser<{ name: string }[]>(me.token, `poster_products?user_id=eq.${me.id}&select=name`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    // A list that could not be read is NOT an empty list: carrying on would add every product that is already there a second time.
    if (!have?.ok) return fail("Could not read your products. Please try again.", 502, "read");
    const names = new Set((have.data ?? []).map((p) => (p.name ?? "").trim().toLowerCase()));
    const room = MAX_PRODUCTS - names.size;
    const rows: Record<string, unknown>[] = [];
    for (const x of (Array.isArray(b.items) ? b.items : []).slice(0, MAX_ITEMS)) {
      const o = (x ?? {}) as Record<string, unknown>;
      const name = S(o.name, 60);
      if (!name || names.has(name.toLowerCase())) continue;
      if (rows.length >= room) break;
      names.add(name.toLowerCase());
      rows.push({ user_id: me.id, name, photo_url: null, photos: [], benefits: [], offer: "", category: S(o.category, 30), active: true, brand_id: null, price: money(o.price) });   // every row carries the same keys (a batch insert needs that)
    }
    if (!rows.length) {
      if (room <= 0) return fail(`You already have ${MAX_PRODUCTS} products, the most that can be kept. Please remove some first.`, 400, "full");
      return NextResponse.json({ added: 0, withPicture: 0, skipped: true });
    }
    // Each product gets a clean, recent photo that matches its NAME (owner, 14 Oct 2026); the ones nothing fits for stay without one.
    // Bounded: no lookup starts after START_BY and every lookup is over by END_BY, so whatever is not found within the time stays
    // without a picture and the list is never held up for long — and a lookup that fails or runs out of time never stops the products
    // from being added. "pictures: false" (the owner's "add them without pictures" button after a failed try) skips the lookups altogether.
    if (b.pictures !== false) {
      const trade = await tradeOf(me.token, me.id);
      const taken = usedPhotoIds(me.id);   // no two products on one stock picture, in this list or in the last ones
      await pool(rows, 5, async (r) => {
        if (Date.now() - t0 >= START_BY) return;
        const tried = await stockPhotoForProduct(me.id, String(r.name), trade.label || trade.key, { skip: taken, maxMs: END_BY - (Date.now() - t0) });
        if (tried.url) { r.photo_url = tried.url; r.photos = [{ url: tried.url, view: "front", role: "identity" }]; }
      });
    }
    // A product with no clearly matching picture stays without one (a wrong picture is worse); "Find a picture" or the
    // "add pictures to products without one" button on the Products page tries again.
    const save = (body: unknown) => restAsUser<unknown[]>(me.token, "poster_products", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body), signal: AbortSignal.timeout(SAVE_MS) });
    let r = await save(rows).catch(() => null);
    // Before migration 0050 the price column does not exist: save the names rather than nothing.
    if (r && !r.ok && r.status === 400 && /\bprice\b/i.test(r.text)) r = await save(rows.map(({ price: _p, ...rest }) => (void _p, rest))).catch(() => null);
    if (!r?.ok) { console.log("[bulk] failed", r?.status, r?.text.slice(0, 300)); return fail("Could not save. Please try again.", 400, "save"); }
    return NextResponse.json({ added: rows.length, withPicture: rows.filter((x) => x.photo_url).length });
  } finally { inFlight.delete(me.id); }
}
