import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import { TemplateBrowser } from "@/components/template-browser";
import { toLite } from "@/lib/template-lite";
import { NOT_PUBLIC_TEMPLATES, type CardTemplateDef } from "@/lib/templates";
import { ALL_TEMPLATES } from "@/lib/template-catalog";
import { getPublicSupabase } from "@/lib/supabase/public";

export const metadata: Metadata = pageMeta("/templates", {
  title: "Card templates | Shubhora",
  description: "Ready-made digital business card templates for doctors, salons, property, food, fitness and more.",
});

export const dynamic = "force-dynamic";

async function loadAll(): Promise<CardTemplateDef[]> {
  const built = ALL_TEMPLATES;
  const sb = getPublicSupabase();
  if (!sb) return built;
  try {
    const { data } = await sb
      .from("card_templates")
      .select("key,name,category,description,emoji,data,sort")
      .eq("active", true)
      .order("sort");
    const custom = (data ?? []) as (CardTemplateDef & { sort?: number })[];
    return [
      ...built.filter((b) => !custom.some((c) => c.key === b.key)),
      ...custom,
    ];
  } catch {
    return built;
  }
}

export default async function TemplateGallery({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const templates = (await loadAll()).filter((t) => !t.draft && !NOT_PUBLIC_TEMPLATES.has(t.key) && !/direct selling|distributor/i.test(`${t.category} ${t.name}`));

  const items = templates.map(toLite);
  return (
    <div className="flex-1 px-5 py-14" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Website &amp; card templates</h1>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            Start from a template built for your line of work. Swap in your name, photos and
            numbers — your card is ready in minutes.
          </p>
        </div>

        <TemplateBrowser items={items} initial={(await searchParams).c ?? ""} />
      </div>
    </div>
  );
}
