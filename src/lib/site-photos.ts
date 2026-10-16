// Every photograph a card carries, in the order a hero wants them: the cover first, then the gallery, then one per
// product, then the about picture — no repeats, no SVG art, no monogram. The Wordmark strip and the Collage draw
// from this list (docs/website-looks-v3.md); the classic hero's own `strip` in site-view.tsx stays as it was.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { Card } from "./types";
import { recipeFor } from "./site-recipes";

const art = (u: string) => !u || u.startsWith("/api/monogram/") || /\.svg(?:\?|$)/i.test(u.split("#")[0]) || u.startsWith("data:image/svg");

export function sitePhotos(card: Card, max = 8): string[] {
  const out: string[] = [];
  const add = (u?: string | null) => { const v = (u ?? "").trim(); if (v && !art(v) && !out.includes(v)) out.push(v); };
  add(card.coverUrl);
  const blocks = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);
  for (const b of blocks) if (b.kind === "gallery" || b.kind === "image" || b.kind === "carousel") for (const i of b.images) add(i.url);
  for (const b of blocks) if (b.kind === "product") for (const p of b.items) add(p.images?.[0] ?? p.imageUrl);
  for (const b of blocks) if (b.kind === "about") add(b.imageUrl);
  return out.slice(0, max);
}

/** The address line of the first location block, for the strip's colour tile. */
export function siteAddress(card: Card): string {
  for (const p of card.pages) { if (p.hidden) continue; for (const b of p.blocks) if (b.kind === "location" && (b.address ?? "").trim()) return b.address!.trim(); }
  return "";
}

/** Short service names (≤ 22 chars), for the Collage's quick tiles. */
export function siteServiceNames(card: Card, max = 4): string[] {
  const out: string[] = [];
  for (const p of card.pages) { if (p.hidden) continue; for (const b of p.blocks) if (b.kind === "services") for (const s of b.items) { const n = (s.name ?? "").trim(); if (n && n.length <= 22 && !out.includes(n)) out.push(n); if (out.length >= max) return out; } }
  return out;
}

/** A portfolio-led business (its recipe puts the photos right after the trust facts: photographer, event planner, interior, builder, mehndi,
 *  tailor…) with no photograph at all: what its page shows in the gallery's place is a typographic reel of its own services
 *  (site-nophoto.tsx) — three to five short names with their first line, never an empty frame. (The renderer drops an empty gallery
 *  block before this runs, so the trade, not the block, says that photos are expected.)
 *  A trade's process steps ("1. Message your need") are steps, not offers. Empty when the card has any photo or fewer than three names. */
export function noPhotoReel(card: Card): { name: string; desc: string }[] {
  if (sitePhotos(card, 1).length > 0) return [];
  if (recipeFor(card.seo?.categoryKey ?? "").home[1] !== "photos") return [];
  const blocks = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);
  const out: { name: string; desc: string }[] = [];
  for (const b of blocks) if (b.kind === "services") for (const s of b.items) {
    const name = (s.name ?? "").trim();
    if (!name || name.length > 44 || /^\d+\s*[.)]/.test(name) || out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, desc: (s.desc ?? "").trim() });
    if (out.length === 5) return out;
  }
  return out.length >= 3 ? out : [];
}
