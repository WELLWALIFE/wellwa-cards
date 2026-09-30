import "server-only";
// The designed profession banners on disk (public/art/banners/<category>.jpg, made by scripts/gen-banners.mjs).
import fs from "node:fs";
import path from "node:path";

let cache: { at: number; keys: Set<string> } | null = null;

/** Category keys that have a banner file. Re-read every minute so a fresh batch shows up without a restart. */
export function bannerKeys(): Set<string> {
  if (cache && Date.now() - cache.at < 60_000) return cache.keys;
  const keys = new Set<string>();
  try {
    for (const f of fs.readdirSync(path.join(process.cwd(), "public", "art", "banners"))) {
      const m = f.match(/^([a-z0-9-]+)\.(jpg|jpeg|png|webp)$/i);
      if (m) keys.add(m[1]);
    }
  } catch { /* no banners yet */ }
  cache = { at: Date.now(), keys };
  return keys;
}

export const bannerUrl = (category: string): string | null => (bannerKeys().has(category) ? `/api/stock/banners/${category}.jpg` : null);
