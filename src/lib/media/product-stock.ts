// A stock photograph that matches a product's NAME, stored in the owner's own media folder (so every screen accepts it).
import { randomUUID } from "node:crypto";
import { stockEngineMod, restAsUser } from "@/lib/poster-server";
import { storeImage } from "@/lib/media/ai-image";

const TIMED_OUT = Symbol("timed out");
/** `p`, or TIMED_OUT when it takes longer than `ms` (the work itself is not stopped; the timer is always cleared). */
async function within<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<typeof TIMED_OUT>((res) => { timer = setTimeout(() => res(TIMED_OUT), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}

/** Stock pictures this owner's products have taken lately (Pexels ids), kept in memory only: a list added in one go, a second tap on
 *  "add pictures", or "Find a picture" tried again never hands out the same photo twice. Small on purpose — oldest ids drop first. */
const USED_OWNERS = 300, USED_IDS = 200;
const usedByOwner = new Map<string, Set<number>>();
export function usedPhotoIds(userId: string): Set<number> {
  let ids = usedByOwner.get(userId);
  if (!ids) {
    ids = new Set<number>();
    usedByOwner.set(userId, ids);
    if (usedByOwner.size > USED_OWNERS) { const oldest = usedByOwner.keys().next().value; if (oldest !== undefined) usedByOwner.delete(oldest); }
  }
  while (ids.size > USED_IDS) { const first = ids.values().next().value; if (first === undefined) break; ids.delete(first); }
  return ids;
}

/** Why a lookup gave no picture: "nomatch" (looked, and nothing fits this name — a fresh try will not change that), "timeout" (the time given ran out),
 *  "error" (a service or the storage failed). Only "nomatch" may be remembered as "nothing fits"; the other two are worth trying again. */
export type StockMiss = "nomatch" | "timeout" | "error";
export type StockTry = { url: string; reason?: undefined } | { url: null; reason: StockMiss };

/** A clean, recent photo of "<name>" stored for the owner (`url`), or the reason there is none (callers fall back to the trade's photos).
 *  `skip`: ids already taken by other products (see usedPhotoIds); `maxMs`: the most this whole lookup — the search AND the saving of the
 *  file — may take (never more than 45 s). */
export async function stockPhotoForProduct(userId: string, name: string, trade: string, opts: { skip?: Set<number>; maxMs?: number } = {}): Promise<StockTry> {
  const t0 = Date.now();
  const total = Math.max(1_000, Math.min(45_000, opts.maxMs ?? 45_000));
  const left = () => Math.max(1_000, total - (Date.now() - t0));
  try {
    const st = await stockEngineMod();
    // `until` lets the search stop its own paid calls once nobody waits for it any more (a property the engine's type does not list yet).
    const args: { name: string; trade: string; skip?: Set<number>; until: number } = { name, trade, skip: opts.skip, until: t0 + total };
    const r = await within(st.findProductPhoto(args), left());
    if (r === TIMED_OUT) return { url: null, reason: "timeout" };
    if (!r) return { url: null, reason: "nomatch" };
    // Own file name per picture: two lookups finishing in the same millisecond must not write over each other.
    const url = await within(storeImage(userId, `product-stock-${randomUUID().slice(0, 8)}`, r.jpeg), left());
    if (url === TIMED_OUT || !url) {
      opts.skip?.delete(r.id);   // the picture was not kept: its id is free for another product
      return { url: null, reason: url === TIMED_OUT ? "timeout" : "error" };
    }
    return { url };
  } catch { return { url: null, reason: "error" }; }   // the search threw: a service was down or ran out of time (a plain "nothing fits" is a null answer, not a throw)
}

/** The owner's trade, as the stock search should hear it ("Hardware / paint / sanitary"). */
export async function tradeOf(token: string, uid: string): Promise<{ key: string; label: string }> {
  const prof = (await restAsUser<{ category: string | null; tagline: string | null }[]>(token, `poster_profiles?user_id=eq.${uid}&select=category,tagline&order=is_default.desc&limit=1`).catch(() => ({ data: null }))).data?.[0];
  return { key: prof?.category ?? "", label: prof?.tagline ?? "" };
}

/** Runs `fn` over the items, `n` at a time. One item failing never stops the others. */
export async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; try { await fn(items[i], i); } catch { /* this one is skipped */ } } }));
}
