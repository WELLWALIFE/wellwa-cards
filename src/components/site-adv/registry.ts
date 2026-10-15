// The advanced site's variant registry: one map per section, id -> component. TypeScript holds it to the id lists in
// src/lib/site-advanced.ts (a missing or an extra id is a compile error), so the spec's ids and the components cannot drift.
//
// To add a variant: write the component in its own file in this folder, import it below, append it to its section's map at
// the SLOT line, append its id to the same section's list in site-advanced.ts, and append its CSS string to VARIANT_CSS.
// Never reorder or rename an existing id: stored specs name them.
import type { Variant } from "@/components/site-adv/shared";
import type {
  AboutVariantId, CtaVariantId, FaqVariantId, FooterVariantId, GalleryVariantId, HeroVariantId, ProcessVariantId, ProofVariantId,
  SectionKey, ServicesVariantId, TrustVariantId, VisitVariantId,
} from "@/lib/site-advanced";
import { VARIANT_IDS } from "@/lib/site-advanced";
import {
  HeroCenteredMinimal, HeroDiagonal, HeroEditorialMarquee, HeroFullBleed, HeroGlassCard, HeroMasthead, HeroMosaic, HeroSplitFrame,
  HeroStackedPoster, HeroVideoFirst, HEROES_CSS,
} from "@/components/site-adv/heroes";
import { AboutOverlapCard, AboutStoryColumns, ABOUTS_CSS } from "@/components/site-adv/abouts";
import { CtaBand, FaqAccordion, FooterColumns, GalleryMosaic, ProcessSteps, ProofCards, ServicesGrid, TrustStrip, VisitSplit, BASICS_CSS } from "@/components/site-adv/basics";
import {
  AboutEditorialSplit, AboutNumbersLed, AboutOwnerCard, AboutPhotoCollage, AboutPullQuote, AboutYearTimeline,
  ProcessIconCards, ProcessNumberedList, ProcessStepAccordion, ProcessTimelineH, ABOUT_CSS,
} from "@/components/site-adv/about";
import {
  ServicesCategoryTabs, ServicesFeatureCards, ServicesMagazine, ServicesMenuLeaders, ServicesPriceList, ServicesScroller, ServicesTiers, CATALOG_CSS,
} from "@/components/site-adv/catalog";
import {
  GalleryAlbumTabs, GalleryBento, GalleryFilmstrip, GalleryLightboxGrid, GalleryMasonry,
  ProofCarousel, ProofClients, ProofResults, ProofSummary, ProofWall,
  TrustCounters, TrustIconRow, TrustSplitCards, TrustTicker, PROOF_CSS,
} from "@/components/site-adv/proof";
import {
  CtaFloatingCard, CtaRibbon, CtaSplitQr, CtaWideBand, FaqChat, FaqNumbered, FaqSearch, FaqTwoColumn,
  FooterBigWordmark, FooterLinkGrid, FooterMega, FooterMinimal, VisitBranches, VisitMapHours, VisitPoster, VisitTimeline, CLOSE_CSS,
} from "@/components/site-adv/close";
// SLOT imports (append new variant files here)

export const HERO_REGISTRY: Record<HeroVariantId, Variant> = {
  "split-frame": HeroSplitFrame,
  "full-bleed": HeroFullBleed,
  "editorial-marquee": HeroEditorialMarquee,
  "glass-card": HeroGlassCard,
  "stacked-poster": HeroStackedPoster,
  "mosaic": HeroMosaic,
  "video-first": HeroVideoFirst,
  "centered-minimal": HeroCenteredMinimal,
  "diagonal": HeroDiagonal,
  "masthead": HeroMasthead,
  // SLOT hero (append here)
};
export const TRUST_REGISTRY: Record<TrustVariantId, Variant> = {
  "strip": TrustStrip,
  "counters": TrustCounters,
  "icon-row": TrustIconRow,
  "ticker": TrustTicker,
  "split-cards": TrustSplitCards,
  // SLOT trust (append here)
};
export const ABOUT_REGISTRY: Record<AboutVariantId, Variant> = {
  "story-columns": AboutStoryColumns,
  "overlap-card": AboutOverlapCard,
  "editorial-split": AboutEditorialSplit,
  "pull-quote": AboutPullQuote,
  "year-timeline": AboutYearTimeline,
  "owner-card": AboutOwnerCard,
  "numbers-led": AboutNumbersLed,
  "photo-collage": AboutPhotoCollage,
  // SLOT about (append here)
};
export const SERVICES_REGISTRY: Record<ServicesVariantId, Variant> = {
  "grid": ServicesGrid,
  "feature-cards": ServicesFeatureCards,
  "price-list": ServicesPriceList,
  "magazine": ServicesMagazine,
  "scroller": ServicesScroller,
  "category-tabs": ServicesCategoryTabs,
  "menu-leaders": ServicesMenuLeaders,
  "tiers": ServicesTiers,
  // SLOT services (append here)
};
export const GALLERY_REGISTRY: Record<GalleryVariantId, Variant> = {
  "mosaic": GalleryMosaic,
  "masonry": GalleryMasonry,
  "filmstrip": GalleryFilmstrip,
  "bento": GalleryBento,
  "album-tabs": GalleryAlbumTabs,
  "lightbox-grid": GalleryLightboxGrid,
  // SLOT gallery (append here)
};
export const PROOF_REGISTRY: Record<ProofVariantId, Variant> = {
  "cards": ProofCards,
  "review-wall": ProofWall,
  "testimonial-carousel": ProofCarousel,
  "star-summary": ProofSummary,
  "results-band": ProofResults,
  "clients-strip": ProofClients,
  // SLOT proof (append here)
};
export const PROCESS_REGISTRY: Record<ProcessVariantId, Variant> = {
  "steps": ProcessSteps,
  "numbered-list": ProcessNumberedList,
  "timeline-h": ProcessTimelineH,
  "icon-cards": ProcessIconCards,
  "step-accordion": ProcessStepAccordion,
  // SLOT process (append here)
};
export const FAQ_REGISTRY: Record<FaqVariantId, Variant> = {
  "accordion": FaqAccordion,
  "numbered-accordion": FaqNumbered,
  "two-column": FaqTwoColumn,
  "searchable": FaqSearch,
  "chat-bubble": FaqChat,
  // SLOT faq (append here)
};
export const VISIT_REGISTRY: Record<VisitVariantId, Variant> = {
  "split": VisitSplit,
  "map-hours": VisitMapHours,
  "hours-timeline": VisitTimeline,
  "address-poster": VisitPoster,
  "branch-list": VisitBranches,
  // SLOT visit (append here)
};
export const CTA_REGISTRY: Record<CtaVariantId, Variant> = {
  "band": CtaBand,
  "wide-band": CtaWideBand,
  "floating-card": CtaFloatingCard,
  "split-qr": CtaSplitQr,
  "sticky-ribbon": CtaRibbon,
  // SLOT cta (append here)
};
export const FOOTER_REGISTRY: Record<FooterVariantId, Variant> = {
  "columns": FooterColumns,
  "mega": FooterMega,
  "minimal": FooterMinimal,
  "big-wordmark": FooterBigWordmark,
  "link-grid": FooterLinkGrid,
  // SLOT footer (append here)
};

/** Every section's registry by key. */
export const REGISTRY: { [K in SectionKey]: Record<string, Variant> } = {
  hero: HERO_REGISTRY, trust: TRUST_REGISTRY, about: ABOUT_REGISTRY, services: SERVICES_REGISTRY, gallery: GALLERY_REGISTRY,
  proof: PROOF_REGISTRY, process: PROCESS_REGISTRY, faq: FAQ_REGISTRY, visit: VISIT_REGISTRY, cta: CTA_REGISTRY, footer: FOOTER_REGISTRY,
};

/** The component for a section's variant id; an id this build does not know falls to the section's first (default) one. */
export function variantComponent(key: SectionKey, id: string): Variant {
  return REGISTRY[key][id] ?? REGISTRY[key][VARIANT_IDS[key][0]];
}

/** The CSS of every variant, concatenated into the page's one inline <style>. */
export const VARIANT_CSS = [
  HEROES_CSS, ABOUTS_CSS, BASICS_CSS,
  ABOUT_CSS,
  CATALOG_CSS,
  PROOF_CSS,
  CLOSE_CSS,
  // SLOT css (append new variant CSS strings here)
].join("\n");
