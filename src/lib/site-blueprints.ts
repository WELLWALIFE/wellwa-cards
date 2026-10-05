// The three website blueprints (docs/website-looks-v2.md §3): what a page is BUILT like, as opposed to what it is
// painted with. A blueprint fixes the hero's structure, the nav, how products / reviews / photos are shown and the
// background; the designer still chooses palette, font, corners and the order of sections on top of it.
//
// Isomorphic: no 'use client', no 'server-only' — the renderer, the build screen and the designer all read it.
import type { SiteStyle } from "@/lib/types";
import { BLUEPRINT_KEYS, type BlueprintKey } from "@/lib/site-style";

export type { BlueprintKey };
export { BLUEPRINT_KEYS };

export type Blueprint = {
  key: BlueprintKey;
  name: string; hi: string;
  blurb: string; blurbHi: string;
  /** Style the blueprint wants unless the designer says otherwise. */
  defaults: Partial<SiteStyle>;
  /** Trades it suits best (poster-categories keys); the mood briefs decide per trade, this is the fallback. */
  fits: string[];
};

export const BLUEPRINTS: Blueprint[] = [
  {
    key: "bento", name: "Bento", hi: "बेंटो", blurb: "Everything at a glance: a board of tiles", blurbHi: "एक नज़र में सब: tiles का board",
    defaults: { radius: "round", motion: "calm", pattern: "none" },
    fits: ["kirana", "mobile", "hardware", "medical", "clinic", "electrician", "plumber", "ca", "tuition", "coaching", "it", "real-estate", "travel", "insurance"],
  },
  {
    key: "cinematic", name: "Cinematic", hi: "सिनेमैटिक", blurb: "Full-screen photo, scene by scene", blurbHi: "पूरी screen की photo, scene दर scene",
    defaults: { hero: "photo", radius: "soft", motion: "calm", pattern: "none" },
    fits: ["hotel", "restaurant", "gym", "jewellery", "car", "events", "wedding", "salon", "interior", "furniture", "architect", "photography"],
  },
  {
    key: "story", name: "Story", hi: "स्टोरी", blurb: "Swipe slides, like Instagram stories", blurbHi: "Instagram stories जैसी swipe slides",
    defaults: { radius: "round", motion: "lively", pattern: "none" },
    fits: ["cafe", "bakery", "sweets", "garments", "boutique", "beauty", "fitness", "tiffin", "home-food", "handicraft", "gifts", "florist"],
  },
];
export const blueprintOf = (key: string | undefined) => BLUEPRINTS.find((b) => b.key === key) ?? null;

/** The tiles a Bento board can show, in the default order. A tile is drawn only when the card has its content. */
export const TILE_KEYS = ["photo", "name", "contact", "open", "rating", "map", "offer", "product", "since", "booking"] as const;
export type TileKey = (typeof TILE_KEYS)[number];
export const TILES: { key: TileKey; name: string; hi: string }[] = [
  { key: "photo", name: "Photo / clip", hi: "Photo / clip" },
  { key: "name", name: "Name & line", hi: "नाम और line" },
  { key: "contact", name: "Call & WhatsApp", hi: "Call और WhatsApp" },
  { key: "open", name: "Open now", hi: "अभी खुला है" },
  { key: "rating", name: "Rating", hi: "Rating" },
  { key: "map", name: "Map", hi: "Map" },
  { key: "offer", name: "Offer", hi: "Offer" },
  { key: "product", name: "First product", hi: "पहला product" },
  { key: "since", name: "Years in business", hi: "कितने साल से" },
  { key: "booking", name: "Book / enquire", hi: "Book करें" },
];
/** Tile keys from stored or sent data: known ones only, no repeats, in the given order. */
export function cleanTiles(x: unknown): TileKey[] | null {
  if (!Array.isArray(x)) return null;
  const out: TileKey[] = [];
  for (const k of x) if (typeof k === "string" && (TILE_KEYS as readonly string[]).includes(k) && !out.includes(k as TileKey)) out.push(k as TileKey);
  return out.length ? out : null;
}
