// The card wearing a Premium design that is not saved yet — what the server will save on "Use this" — for the preview frames
// (/poster/site/advanced and /poster/site/choose). Isomorphic: no 'use client', no 'server-only'.
import type { Card, CardBlock } from "@/lib/types";

export type AdvPreview = {
  spec?: unknown; slides?: unknown;
  copy?: { hero?: { headline?: string; sub?: string }; about?: { id: string; title?: string; body?: string }; titles?: Record<string, string> };
};

/** The live card wearing the previewed design and words: what the server will save on "Use this" (the same words rules as the engine's
 *  applyCopy, which is server-only), so the frame shows exactly that. */
export function wearAdvanced(card: Card, res: AdvPreview): Card {
  // The design's sliding top banners (owner, 23 Oct 2026), unless the owner already made their own.
  const own = (card.site?.hero?.slides ?? []).length >= 2;
  const site0 = card.site ?? { enabled: true };
  const slides = !own && Array.isArray((res as { slides?: unknown }).slides) ? (res as { slides: NonNullable<NonNullable<NonNullable<Card["site"]>["hero"]>["slides"]> }).slides : null;
  const base = { ...site0, ...(slides ? { hero: { headline: card.company || card.name, sub: "", ...(site0.hero ?? {}), slides } } : {}), advanced: res.spec, advancedOn: true } as NonNullable<Card["site"]>;
  let next: Card = { ...card, site: base };
  const c = res.copy;
  if (c?.hero && (c.hero.headline !== undefined || c.hero.sub !== undefined)) {
    const cur = base.hero ?? { headline: card.company || card.name, sub: "" };
    next = { ...next, site: { ...base, hero: { ...cur, ...(c.hero.headline !== undefined ? { headline: c.hero.headline } : {}), ...(c.hero.sub !== undefined ? { sub: c.hero.sub } : {}) } } };
  }
  if (c?.about || c?.titles) {
    next = {
      ...next,
      pages: next.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => {
          if (c.about && b.id === c.about.id && b.kind === "about") return { ...b, ...(c.about.title !== undefined ? { title: c.about.title } : {}), ...(c.about.body !== undefined ? { body: c.about.body } : {}) };
          const t = c.titles?.[b.id];
          return t !== undefined ? ({ ...b, title: t } as CardBlock) : b;
        }),
      })),
    };
  }
  return next;
}
