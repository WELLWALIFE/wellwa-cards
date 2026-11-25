"use client";
// Every page of the website draws ITS OWN sections, in the owner's order (owner, 19 Nov 2026 — "rasta 2": "koi bhi page kahin bhi
// lagaye, kuch bhi bana sake"). The design only dresses them: a section the design has a look for (about, services / products, photos,
// reviews, questions, steps, visit) is drawn in the design's own variant with ONLY that section's content; anything else (key points,
// video, offer, table, button, form, file…) in the design's plain block style. Nothing is pulled in from another page and nothing the
// owner put on the page is left out.
//
// Each part is wrapped in <div data-blk="…" style="display:contents">: the editor's window finds the owner's section by its id
// (preview focus), and the ✏️ on it opens exactly that section in the editor.
import { Fragment, type ReactNode } from "react";
import type { Card, CardBlock, CardPage } from "@/lib/types";
import { variantOf, type AdvItem, type AdvancedSpec, type SectionKey } from "@/lib/site-advanced";
import { isEmptyBlock } from "@/lib/site-home";
import { buildContent, sectionHasContent } from "@/components/site-adv/content";
import type { SiteContent } from "@/components/site-adv/shared";
import type { AdvCtxPlus, AdvPageEntry, Chrome } from "@/components/site-adv/nav";
import { Block } from "@/components/site-adv/page-more";
import { CataloguePage } from "@/components/site-adv/page-catalog";

export type SlotWith = (k: SectionKey, index: number, c: SiteContent) => ReactNode;

const isSteps = (b: CardBlock) => b.kind === "services" && /^\s*1[.)]\s/.test(b.items[0]?.name ?? "");
const isCatalogue = (b: CardBlock) => b.kind === "product" || (b.kind === "services" && !isSteps(b));
const count = (b: CardBlock): number =>
  b.kind === "testimonials" ? b.items.filter((q) => (q.text ?? "").trim()).length
  : b.kind === "faq" ? b.items.filter((q) => (q.q ?? "").trim() && (q.a ?? "").trim()).length
  : b.kind === "gallery" ? b.images.filter((q) => q.url).length
  : b.kind === "image" || b.kind === "carousel" ? b.images.filter((q) => q.url).length
  : 0;

/** The design's section for a part of the owner's, or null for the plain block style. */
export function sectionOf(b: CardBlock): SectionKey | null {
  if (isSteps(b)) return "process";
  switch (b.kind) {
    case "about": return "about";
    case "product": case "services": return "services";
    case "gallery": case "image": case "carousel": return "gallery";
    case "testimonials": return "proof";
    case "faq": return "faq";
    case "hours": case "location": return "visit";
    default: return null;
  }
}

/** The page's content with ONLY these parts in it (the rest of `c` — name, trade, hero, facts, photos — stays the card's). */
function sliceOf(card: Card, page: CardPage, blocks: CardBlock[], c: SiteContent, lang: string): SiteContent {
  const one = buildContent({ ...card, about: "", pages: [{ ...page, hidden: false, blocks }], site: { ...(card.site ?? { enabled: true }), hidden: [] } } as Card, lang);
  return { ...c, about: one.about, offerings: one.offerings, steps: one.steps, gallery: one.gallery, reviews: one.reviews, faq: one.faq, visit: one.visit };
}

export type FlowPart = { b: CardBlock; key: SectionKey | null; c: SiteContent };

/** The parts of a page, in its order: each with the design section that draws it (null = the plain block) and its own content. */
export function flowParts(card: Card, page: CardPage, c: SiteContent, lang: string, hasContact: boolean): FlowPart[] {
  const out: FlowPart[] = [];
  let visitDone = false;
  // A section the owner hid (site.home.hidden, by its id — on any page) is not drawn; it stays stored and can be shown again.
  const hid = new Set(card.site?.home?.hidden ?? []);
  for (const b of page.blocks) {
    if (isEmptyBlock(b) || hid?.has(b.id)) continue;
    let key = sectionOf(b);
    if (key === "visit") { if (visitDone) continue; visitDone = true; }
    let cx = c;
    if (key) {
      cx = sliceOf(card, page, key === "visit" ? page.blocks.filter((x) => x.kind === "hours" || x.kind === "location") : [b], c, lang);
      // A design section shows a few (9 photos, 3 reviews, 8 questions): more than that, or too little for the design's look (one
      // question, one step), is drawn in full as a plain block instead — what the owner put on the page is never cut.
      const fits = sectionHasContent(key, cx, hasContact)
        && !(key === "gallery" && count(b) > 9)
        && !(key === "proof" && count(b) > 3)
        && !(key === "faq" && count(b) > 8);
      if (!fits) { key = null; cx = c; }
    }
    out.push({ b, key, c: cx });
  }
  return out;
}

type FlowProps = {
  card: Card; page: CardPage; c: SiteContent; spec: AdvancedSpec; x: AdvCtxPlus; chrome: Chrome; lang: string; hasContact: boolean;
  slotWith: SlotWith; items: AdvItem[];
  /** On the home page products and services are the design's section (nine at most, the rest one tap away); on any other page they
   *  are the page's full list with search, as a catalogue. */
  home: boolean;
  /** The "see all" band after a home section (all the products on their page). */
  after?: (k: SectionKey, c: SiteContent) => ReactNode;
  start?: number;
};

/** The owner's sections of one page, top to bottom. */
export function FlowSections({ card, page, c, spec, x, chrome, lang, hasContact, slotWith, items, home, after, start = 0 }: FlowProps): ReactNode {
  const parts = flowParts(card, page, c, lang, hasContact);
  const entry: AdvPageEntry = x.pages.list.find((e) => e.slug === page.slug)
    ?? { slug: page.slug, role: "catalogue", label: page.label, owner: true, href: x.hrefFor(page.slug), primary: false };
  // Every product and service of a page is drawn once, where its first such part is (the catalogue holds them all, each with its own page).
  const firstCat = home ? -1 : parts.findIndex((p) => isCatalogue(p.b));
  const shown = parts.filter((p, n) => home || !isCatalogue(p.b) || n === firstCat);
  return (
    <>
      {shown.map(({ b, key, c: cx }, n) => {
        const i = start + n;
        let body: ReactNode = null;
        if (!home && isCatalogue(b)) {
          body = <CataloguePage c={c} spec={spec} x={x} chrome={chrome} entry={entry} items={items} bare />;
        } else if (key) {
          body = <>{slotWith(key, i, cx)}{after?.(key, cx)}</>;
        } else {
          body = <Block b={b} x={x} c={c} i={i} v={variantOf(spec, "trust")} />;
        }
        return <div key={b.id} data-blk={b.id} style={{ display: "contents" }}><Fragment>{body}</Fragment></div>;
      })}
    </>
  );
}
