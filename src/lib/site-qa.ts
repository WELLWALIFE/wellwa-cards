import "server-only";
// The website's quality check during its waiting time (owner, 28 Nov 2026: "aisi website ki dekhte hi kahe wah"). A new website is
// held 24 hours before visitors see it (src/lib/site-ready.ts); this looks at it once in that time and tells Super Admin what would
// embarrass it, so someone fixes it before it goes live. It never holds a website back — the owner was promised 24 hours.
//
// Checks only what the card itself shows a visitor (no screenshots): photos that no longer exist, the build's sample products or sample
// reviews still on show, the trade's stock headline instead of one written for this business, lists made of filler only.
// Stock photos are fine (owner's call, 28 Nov 2026: the user changes them later) and are not flagged.
import type { Card, CardBlock } from "@/lib/types";
import { heroModel } from "@/lib/site-hero";
import { tradeMood, nameSeed } from "@/lib/trade-moods";
import { cleanPoints, isFillerPoint } from "@/lib/site-points";

export type QaIssue = { code: "broken_photo" | "sample_products" | "sample_reviews" | "stock_headline" | "filler_points" | "thin_about"; text: string };

const blocksOf = (card: Card): CardBlock[] => (card.pages ?? []).filter((p) => !p.hidden).flatMap((p) => p.blocks ?? []);

/** Every photo a visitor of the website may see. */
export function sitePhotos(card: Card): string[] {
  const urls: string[] = [card.coverUrl ?? "", card.avatarUrl ?? "", ...((card.site?.hero?.slides ?? []) as { imageUrl?: string; url?: string }[]).map((s) => s.imageUrl ?? s.url ?? "")];
  for (const b of blocksOf(card)) {
    if (b.kind === "gallery") urls.push(...b.images.map((i) => i.url ?? ""));
    else if (b.kind === "carousel" || b.kind === "image") urls.push(...b.images.map((i) => i.url));
    else if (b.kind === "about") urls.push(b.imageUrl ?? "");
    else if (b.kind === "product") for (const p of b.items) urls.push(p.imageUrl ?? "", ...(p.images ?? []));
  }
  return [...new Set(urls.map((u) => (u ?? "").trim()).filter((u) => /^https:\/\//i.test(u)))];
}

/** The photos that answer "not there" (404 / 400 — deleted from storage). A photo that is slow or a host that does not answer is not
 *  counted: only a definite "gone". */
async function missing(urls: string[]): Promise<string[]> {
  const gone: string[] = [];
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(urls.slice(i, i + 6).map(async (u) => {
      try {
        const r = await fetch(u, { method: "HEAD", signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (r.status === 400 || r.status === 404 || r.status === 410) gone.push(u);
      } catch { /* slow or unreachable: not a verdict */ }
    }));
  }
  return gone;
}

export async function siteQa(card: Card): Promise<QaIssue[]> {
  const issues: QaIssue[] = [];
  const blocks = blocksOf(card);

  const gone = await missing(sitePhotos(card).slice(0, 40));
  if (gone.length) issues.push({ code: "broken_photo", text: `${gone.length} photo${gone.length > 1 ? "s" : ""} no longer exist (empty boxes on the site)` });

  const samples = blocks.flatMap((b) => (b.kind === "product" ? b.items : [])).filter((p) => p.sample && (p.name ?? "").trim());
  if (samples.length) issues.push({ code: "sample_products", text: `${samples.length} sample product${samples.length > 1 ? "s" : ""} still on the site (not the shop's own)` });
  const sampleRev = blocks.flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((r) => r.sample);
  if (sampleRev.length) issues.push({ code: "sample_reviews", text: "Placeholder reviews still in place — ask the owner for 2–3 real ones" });

  // The hero fell back to the trade's fixed line ("Everything you need, close by") instead of one written for this business.
  const hm = heroModel(card, "en");
  const mood = tradeMood(card.seo?.categoryKey ?? "", nameSeed(hm.name));
  if (hm.headline && (hm.headline === mood.headline.en || hm.headline === mood.headline.hi)) issues.push({ code: "stock_headline", text: `Headline is the trade's stock line ("${hm.headline}") — write one for this business` });

  for (const b of blocks) {
    if (b.kind !== "highlights") continue;
    const items = b.items.filter(Boolean);
    if (items.length >= 3 && cleanPoints(items).length < 2 && items.filter(isFillerPoint).length >= 2) {
      issues.push({ code: "filler_points", text: `"${(b.title ?? "Why choose us").trim()}" says only general things every shop says` });
      break;
    }
  }

  const about = blocks.find((b): b is Extract<CardBlock, { kind: "about" }> => b.kind === "about");
  const aboutWords = (about?.body ?? card.about ?? "").split(/\s+/).filter(Boolean).length;
  if (aboutWords < 40) issues.push({ code: "thin_about", text: "About is very short — the site has little to say about the business" });

  return issues;
}
