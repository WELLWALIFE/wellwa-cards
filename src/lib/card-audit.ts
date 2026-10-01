// The last look at a built card before it is shown (owner's call, 1 Oct 2026: "ek baar me perfect"). Code, not
// AI: it fixes what code can fix — the same stock photo in three places, a map of the whole city when only the
// city is known, our own address as the business's website, a section too thin to stand — and reports what it
// had to stand in for (stock photos, the trade's typical services or steps), so the builder can say so and the
// owner knows what to replace. Never adds words; never costs anything.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { CardBlock, CardPage } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import type { TradeData } from "@/lib/trade-data/types";
import { isShubhoraHost } from "@/lib/site-role";
import { isGeneric } from "@/lib/site-recipes";

export type StandIn = "stock-photos" | "typical-services" | "typical-steps" | "typical-faq" | "typical-why-us";
export type AuditResult = { card: TemplateCard; standIns: StandIn[]; fixed: string[] };

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const same = (a: string, b: string) => norm(a) === norm(b) || norm(a).split(" ").slice(0, 3).join(" ") === norm(b).split(" ").slice(0, 3).join(" ");

export function auditCard(input: TemplateCard, opts: { stockPhotos: string[]; city: string; trade: TradeData | null; lang?: "en" | "hi" | "hinglish" }): AuditResult {
  const fixed: string[] = [];
  const standIns = new Set<StandIn>();
  const card: TemplateCard = { ...input, pages: input.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b })) })), links: [...input.links] };
  const stock = new Set(opts.stockPhotos);
  const home = card.pages.find((p) => p.slug === "home") ?? card.pages[0];
  const all = () => card.pages.flatMap((p) => p.blocks);

  /* ---- 1. our own address is never the business's website ---- */
  const before = card.links.length;
  card.links = card.links.filter((l) => !(l.type === "website" && isShubhoraHost(l.value ?? "")));
  if (card.links.length !== before) fixed.push("dropped shubhora.com as the website link");

  /* ---- 2. one stock photo must not be the hero, the about picture AND the first gallery tile ---- */
  const hero = card.site?.hero;
  const heroImg = hero?.imageUrl ?? "";
  const about = home?.blocks.find((b): b is Extract<CardBlock, { kind: "about" }> => b.kind === "about");
  if (opts.stockPhotos.length >= 2) {
    if (about && about.imageUrl && about.imageUrl === heroImg && stock.has(about.imageUrl)) {
      const other = opts.stockPhotos.find((u) => u !== heroImg);
      if (other) { about.imageUrl = other; fixed.push("about picture: a different stock photo from the hero"); }
    }
    for (const b of all()) {
      if (b.kind !== "gallery") continue;
      const used = new Set([heroImg, about?.imageUrl ?? ""].filter(Boolean));
      const fresh = b.images.filter((i) => !used.has(i.url ?? "")), reused = b.images.filter((i) => used.has(i.url ?? ""));
      if (reused.length && fresh.length && b.images[0] && used.has(b.images[0].url ?? "")) { b.images = [...fresh, ...reused]; fixed.push("gallery: the hero and about photos moved to the end"); }
    }
  }
  if (heroImg && stock.has(heroImg)) standIns.add("stock-photos");
  if (about?.imageUrl && stock.has(about.imageUrl)) standIns.add("stock-photos");
  if (all().some((b) => b.kind === "gallery" && b.images.some((i) => stock.has(i.url ?? "")))) standIns.add("stock-photos");

  /* ---- 3. a "map" of the whole city is not a location ---- */
  const cityOnly = (addr: string) => !!opts.city && norm(addr) === norm(opts.city);
  for (const p of card.pages) {
    const n = p.blocks.length;
    p.blocks = p.blocks.filter((b) => !(b.kind === "location" && !b.mapUrl && cityOnly(b.address ?? "")));
    if (p.blocks.length !== n) fixed.push("dropped the city-only map block");
  }

  /* ---- 4. generic lines that slipped through, then sections too thin to stand ---- */
  for (const p of card.pages) {
    for (const b of p.blocks) {
      if (b.kind === "services") {
        const n = b.items.length;
        b.items = b.items.filter((it) => !isGeneric(it.name.replace(/^\d+\.\s*/, ""), opts.trade));
        if (b.items.length !== n) fixed.push(`${b.title}: dropped ${n - b.items.length} generic item(s)`);
      }
      if (b.kind === "highlights") {
        const n = b.items.length;
        b.items = b.items.filter((it) => !isGeneric(it, opts.trade));
        if (b.items.length !== n) fixed.push(`${b.title}: dropped ${n - b.items.length} generic point(s)`);
      }
    }
    const n = p.blocks.length;
    p.blocks = p.blocks.filter((b) => {
      if (b.kind === "highlights") return b.items.length >= 3;
      if (b.kind === "services") return b.items.length >= 3;
      if (b.kind === "faq") return b.items.length >= 3;
      if ((b.kind === "carousel" || b.kind === "gallery") && !b.images.length) return false;
      return true;
    });
    if (p.blocks.length !== n) fixed.push(`${p.label}: dropped ${n - p.blocks.length} thin section(s)`);
  }
  // A page with nothing left on it (other than home and contact) goes too.
  const pages: CardPage[] = card.pages.filter((p) => p.slug === "home" || p.slug === "contact" || p.blocks.length > 0);
  if (pages.length !== card.pages.length) fixed.push("dropped empty page(s)");
  card.pages = pages;

  /* ---- 5. what came from the trade's seeds rather than this business ---- */
  const trade = opts.trade;
  if (trade) {
    const seedNames = new Set([...trade.services.map((s) => s.en), ...trade.services.map((s) => s.hi)].map(norm));
    const seedSteps = new Set([...trade.steps.map((s) => s.en), ...trade.steps.map((s) => s.hi)].map(norm));
    const seedWhy = new Set([...trade.whyUs.map((s) => s.en), ...trade.whyUs.map((s) => s.hi)].map(norm));
    const seedFaq = new Set([...trade.faq.map((s) => s.q), ...trade.faq.map((s) => s.qHi)].map(norm));
    for (const b of all()) {
      if (b.kind === "services") {
        const names = b.items.map((it) => it.name.replace(/^\d+\.\s*/, ""));
        const isSteps = /^\d+\.\s/.test(b.items[0]?.name ?? "");
        const fromSeeds = names.filter((nm) => (isSteps ? seedSteps : seedNames).has(norm(nm))).length;
        if (fromSeeds && fromSeeds >= Math.ceil(names.length / 2)) standIns.add(isSteps ? "typical-steps" : "typical-services");
      }
      if (b.kind === "highlights" && b.items.filter((it) => seedWhy.has(norm(it.replace(/^[^\p{L}\p{N}]+/u, "")))).length >= Math.ceil(b.items.length / 2)) standIns.add("typical-why-us");
      if (b.kind === "faq" && b.items.filter((it) => seedFaq.has(norm(it.q)) || [...seedFaq].some((q) => same(q, it.q))).length >= Math.ceil(b.items.length / 2)) standIns.add("typical-faq");
    }
  }

  return { card, standIns: [...standIns], fixed };
}
