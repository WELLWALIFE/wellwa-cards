// Stock photos that must never show (owner, 17 Nov 2026: a cleaning-products website carried a foreign supermarket aisle, a tattoo
// shop with Chinese lettering, a Vietnamese book stall and two shelves of foreign brands — "sabhi cheez specific honi chahiye, mix na
// ho"). The pool lives on the server and is judged by an AI, so a wrong one can slip in; an id listed here is skipped by every new
// build and taken off the websites that already carry it (gallery and product pictures) as they are shown. Add an id to block it.
// Pure module.
import type { Card } from "@/lib/types";

/** Pexels ids, as they appear at the end of a stock file name: /api/stock/<trade>-v4-<n>-<id>.jpg */
const BLOCKED = new Set(["33690927", "35342373", "16771273", "35285849", "7451952"]);

export const stockBlocked = (url: string | undefined | null): boolean => {
  const m = /-(\d{5,})\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.exec(String(url ?? ""));
  return !!m && /\/stock\//.test(String(url)) && BLOCKED.has(m[1]);
};

/** The card without the blocked photos: gallery tiles dropped, product pictures removed (the product stays), a blocked cover cleared. */
export function withoutBlockedStock<T extends Card>(card: T): T {
  let changed = false;
  const pages = card.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => {
    if (b.kind === "gallery") {
      const images = b.images.filter((i) => !stockBlocked(i.url));
      if (images.length === b.images.length) return b;
      changed = true; return { ...b, images };
    }
    if (b.kind === "product") {
      let hit = false;
      const items = b.items.map((it) => {
        const imgs = (it.images ?? []).filter((u) => !stockBlocked(u));
        const main = stockBlocked(it.imageUrl) ? imgs[0] : it.imageUrl;
        if (imgs.length === (it.images ?? []).length && main === it.imageUrl) return it;
        hit = true; return { ...it, imageUrl: main, ...(it.images ? { images: imgs } : {}) };
      });
      if (!hit) return b;
      changed = true; return { ...b, items };
    }
    return b;
  }) }));
  const cover = stockBlocked(card.coverUrl);
  if (!changed && !cover) return card;
  return { ...card, pages, ...(cover ? { coverUrl: undefined } : {}) };
}

/** The word "Sample" never rides on a picture (owner, 18 Nov 2026: "ho sakta hai user isi ko hi rakhe, to sample word theek nahi"):
 *  the starter products keep their `sample` mark for the app's own logic, but the badge an older build wrote on them is not shown. */
const SAMPLE_BADGE = /^(sample|नमूना)$/i;
export function withoutSampleBadge<T extends Card>(card: T): T {
  let changed = false;
  const pages = card.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => {
    if (b.kind !== "product" || !b.items.some((it) => SAMPLE_BADGE.test((it.badge ?? "").trim()))) return b;
    changed = true;
    return { ...b, items: b.items.map((it) => (SAMPLE_BADGE.test((it.badge ?? "").trim()) ? { ...it, badge: undefined } : it)) };
  }) }));
  return changed ? { ...card, pages } : card;
}
