// A template shown as the real WEBSITE (not the phone card): the same renderer a customer's site uses, with the
// template's sample content and its own design (blueprint, palette, fonts, hero). For reviewing templates.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findTemplate } from "@/lib/template-catalog";
import { BLUEPRINT_KEYS } from "@/lib/site-style";
import type { SiteStyle } from "@/lib/types";
import { SiteView } from "@/components/site-view";
import { PlanProvider } from "@/lib/plan";
import type { Card } from "@/lib/types";

export const metadata: Metadata = { title: "Template website preview", robots: { index: false, follow: false } };

export default async function TemplateSitePreview({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ lang?: string; bp?: string; page?: string }> }) {
  const { key } = await params;
  // ?bp=wordmark draws the template on another structure, for the review board; the stored template is untouched.
  // ?page=<slug> or ?page=<n> (1-based) opens that page of the template, for the review captures.
  const { lang, bp, page } = await searchParams;
  const forced = (BLUEPRINT_KEYS as readonly string[]).includes(bp ?? "") ? (bp as SiteStyle["blueprint"]) : undefined;
  const tpl = findTemplate(key);
  if (!tpl || tpl.brand) notFound();
  const card: Card = {
    ...tpl.data,
    id: `tpl-${tpl.key}`, username: `preview-${tpl.key}`, plan: "pro", active: true, views: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    site: {
      ...(tpl.data.site ?? {}),
      enabled: true,
      ...(forced ? { style: { ...(tpl.data.site?.style ?? {}), blueprint: forced, heroVariant: undefined } } : {}),
      hero: tpl.data.site?.hero ?? { headline: tpl.data.company || tpl.data.name, sub: tpl.data.tagline || "", imageUrl: tpl.data.coverUrl },
    },
  };
  const initialPage = page ? (card.pages.find((p) => p.slug === page) ?? card.pages[Number(page) - 1])?.slug : undefined;
  return <PlanProvider><SiteView card={card} qr="" initialPage={initialPage} initialLang={lang === "hi" || lang === "en" ? lang : undefined} /></PlanProvider>;
}
