// "Add pictures to products without one" (owner, 14 Oct 2026): the owner's active products that have no photo at all get a clean stock
// photo that matches their NAME — free, the same lookup "Add many at once" uses. Up to 15 products per tap; a product that already has
// a photo is never touched, and no two products get the same stock picture. Answers { filled, skipped, left, failed, skippedIds }:
// pictures added now / products nothing fitted for (they stay as they are; tried again after an hour; skippedIds names them so the page
// can stop offering the button for them) / products still waiting, to be done by tapping again (left; of these, failed ran out of time
// or hit a service trouble — those are NOT written off as "nothing fits", the next tap tries them again).
// Errors carry a `code` (busy · crowded · limit · read) so the page can say them in the owner's language.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { stockPhotoForProduct, usedPhotoIds, tradeOf, pool } from "@/lib/media/product-stock";

export const maxDuration = 120;

const HOUR = 60 * 60_000;
const PER_TAP = 15;                  // products looked at in one tap
const MAX_ROWS = 500;                // products read at all (a bigger shop is served over several taps as the first 500 fill up)
const START_BY = 60_000;             // no new lookup starts after this many ms (it would have under 30 s left)
const END_BY = 90_000;               // every lookup — the search AND saving its file — is over by then
const SAVE_MS = 10_000;              // one write to the product may take this long: 90 + 10 s still leaves room inside maxDuration
const RETRY_AFTER = HOUR;            // a product nothing fitted for is not searched again for an hour (its lookups cost us money)
const MAX_AT_ONCE = 4;               // owners served at the same moment: each lookup calls two paid services
const inFlight = new Set<string>();
const missed = new Map<string, number>();   // product id → when no good picture was found for it ("nomatch" only)
let running = 0;

type Row = { id: string; name: string; photo_url: string | null; photos: unknown[] | null };

const fail = (error: string, status: number, code: string) => NextResponse.json({ error, code }, { status });

export async function POST(request: Request) {
  const t0 = Date.now();
  const me = await userFromRequest(request);
  if (!me) return fail("Please log in.", 401, "login");
  // One batch at a time per owner — claimed BEFORE anything is read, so two taps at once cannot both start.
  if (inFlight.has(me.id)) return fail("Pictures are already being added. Please wait a moment.", 409, "busy");
  inFlight.add(me.id);
  let counted = false;
  try {
    // The read itself is cheap but not free: a runaway page asking again and again is stopped here.
    if (rateLimited(`product-fill-look:${me.id}`, 60, HOUR)) return fail("Too many tries in an hour. Please wait a little.", 429, "limit");

    const got = await restAsUser<Row[]>(me.token, `poster_products?user_id=eq.${me.id}&active=eq.true&order=sort,created_at&select=id,name,photo_url,photos&limit=${MAX_ROWS}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!got?.ok) return fail("Could not read your products. Please try again.", 502, "read");
    // No photo at all: no main photo and no photo in the list. Anything with a photo is left exactly as it is.
    const without = (got.data ?? []).filter((p) => p.name?.trim() && !p.photo_url && !(Array.isArray(p.photos) && p.photos.length));

    const now = Date.now();
    for (const [id, at] of missed) if (now - at >= RETRY_AFTER) missed.delete(id);
    const cooling = without.filter((p) => missed.has(p.id));
    const fresh = without.filter((p) => !missed.has(p.id));
    const batch = fresh.slice(0, PER_TAP);
    // Nothing new to try (all done, or only the ones nothing fitted for a short while ago): answer without calling anything.
    if (!batch.length) return NextResponse.json({ filled: 0, skipped: cooling.length, left: 0, failed: 0, skippedIds: cooling.map((p) => p.id) });

    if (running >= MAX_AT_ONCE) return fail("Many people are adding pictures right now. Please try again in a minute.", 429, "crowded");
    if (rateLimited(`product-fill:${me.id}`, 10, HOUR)) return fail("Too many tries in an hour. Please wait a little.", 429, "limit");
    running++; counted = true;

    const trade = await tradeOf(me.token, me.id);
    const taken = usedPhotoIds(me.id);   // no two products on one stock picture, in this batch or in the last ones
    let filled = 0, failed = 0, notStarted = 0;
    const noMatch: string[] = [];   // ids tried this time that really have no fitting picture
    await pool(batch, 5, async (p) => {
      if (Date.now() - t0 >= START_BY) { notStarted++; return; }
      const tried = await stockPhotoForProduct(me.id, p.name, trade.label || trade.key, { skip: taken, maxMs: END_BY - (Date.now() - t0) });
      if (tried.url === null) {
        // Only "nothing fits" is remembered. Running out of time, or a service having a bad moment, is not the product's fault: it stays
        // on the list for the next tap (counted in `left`).
        if (tried.reason === "nomatch") { noMatch.push(p.id); missed.set(p.id, Date.now()); } else failed++;
        return;
      }
      try {
        // Written only while the product still has no photo (a photo the owner added meanwhile stays), as the main photo AND the first of its photos.
        const was = p.photo_url == null ? "photo_url=is.null" : `photo_url=eq.${encodeURIComponent(p.photo_url)}`;
        const w = await restAsUser<{ id: string }[]>(me.token, `poster_products?id=eq.${p.id}&user_id=eq.${me.id}&${was}&select=id`, {
          method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ photo_url: tried.url, photos: [{ url: tried.url, view: "front", role: "identity" }] }),
          signal: AbortSignal.timeout(SAVE_MS),
        });
        if (!w.ok) failed++;
        else if (w.data?.length) filled++;
        // else: it got a photo of its own while we looked — nothing to count, nothing written
      } catch { failed++; }   // one product failing never stops the rest
    });
    while (missed.size > 3000) { const oldest = missed.keys().next().value; if (oldest === undefined) break; missed.delete(oldest); }
    const skippedIds = [...noMatch, ...cooling.map((p) => p.id)];
    return NextResponse.json({ filled, skipped: skippedIds.length, left: fresh.length - batch.length + notStarted + failed, failed, skippedIds });
  } finally { inFlight.delete(me.id); if (counted) running--; }
}
