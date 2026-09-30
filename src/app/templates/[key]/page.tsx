import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BUILT_IN_TEMPLATES, NOT_PUBLIC_TEMPLATES, type CardTemplateDef } from "@/lib/templates";
import { getPublicSupabase } from "@/lib/supabase/public";
import { qrDataUrl } from "@/lib/qr";
import { CardView } from "@/components/card-view";
import type { Card } from "@/lib/types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Built-in templates, with any owner-saved row of the same key winning. */
async function loadTemplate(key: string): Promise<CardTemplateDef | null> {
  // A company's own design (e.g. Wellwa's), and anything carrying the partner plan, is never a public page.
  if (NOT_PUBLIC_TEMPLATES.has(key) || BUILT_IN_TEMPLATES.find((t) => t.key === key)?.brand) return null;
  const sb = getPublicSupabase();
  if (sb) {
    try {
      const { data } = await sb
        .from("card_templates")
        .select("key,name,category,description,emoji,data")
        .eq("key", key)
        .eq("active", true)
        .maybeSingle();
      if (data) return data as CardTemplateDef;
    } catch { /* fall through to built-ins */ }
  }
  return BUILT_IN_TEMPLATES.find((t) => t.key === key) ?? null;
}

export async function generateMetadata({
  params,
}: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const t = await loadTemplate(key);
  if (!t) return { title: "Template not found" };
  return {
    title: `${t.name} — card template | Shubhora`,
    description: t.description,
    robots: { index: false, follow: true }, // previews shouldn't compete with real cards
  };
}

export default async function TemplatePreview({
  params,
}: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const tpl = await loadTemplate(key);
  if (!tpl) notFound();

  // A template isn't a card — fill in the identity fields so it can render.
  const card: Card = {
    ...tpl.data,
    id: `tpl-${tpl.key}`,
    username: `preview-${tpl.key}`,
    plan: "pro",
    active: true,
    views: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  const qr = await qrDataUrl(`${SITE}/templates/${tpl.key}`, card.themeColor);

  return (
    <div className="flex-1 py-6 px-4" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-md mb-5">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none">{tpl.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="mono text-[10px] uppercase tracking-wide text-faint">Template preview</p>
              <h1 className="font-semibold tracking-tight">{tpl.name}</h1>
              <p className="text-xs text-muted mono">{tpl.category}</p>
              <p className="text-sm text-muted mt-1.5">{tpl.description}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href={`/cards/new?template=${tpl.key}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white shadow-card">
              <Sparkles className="h-4 w-4" /> Use this template
            </Link>
            <Link href="/templates"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-surface2">
              <ArrowLeft className="h-4 w-4" /> All
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-faint text-center">
            Sample content — you replace the name, photos and numbers with your own.
          </p>
        </div>
      </div>

      <CardView card={card} qr={qr} />
    </div>
  );
}
