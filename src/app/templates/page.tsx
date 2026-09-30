import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import { ArrowRight, Eye } from "lucide-react";
import { BUILT_IN_TEMPLATES, NOT_PUBLIC_TEMPLATES, type CardTemplateDef } from "@/lib/templates";
import { getPublicSupabase } from "@/lib/supabase/public";

export const metadata: Metadata = pageMeta("/templates", {
  title: "Card templates | Shubhora",
  description: "Ready-made digital business card templates for doctors, salons, property, food, fitness and more.",
});

export const dynamic = "force-dynamic";

async function loadAll(): Promise<CardTemplateDef[]> {
  const built = BUILT_IN_TEMPLATES;
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

export default async function TemplateGallery() {
  const templates = (await loadAll()).filter((t) => !NOT_PUBLIC_TEMPLATES.has(t.key) && !/direct selling|distributor/i.test(`${t.category} ${t.name}`));

  return (
    <div className="flex-1 px-5 py-14" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Card templates</h1>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            Start from a template built for your line of work. Swap in your name, photos and
            numbers — your card is ready in minutes.
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((t) => {
            const accent = t.data?.themeColor ?? "#0e9e90";
            const pages = t.data?.pages?.length ?? 0;
            const blocks = (t.data?.pages ?? []).reduce((n, p) => n + p.blocks.length, 0);
            return (
              <Link key={t.key} href={`/templates/${t.key}`}
                className="group rounded-2xl border border-border bg-surface overflow-hidden shadow-card hover:shadow-float hover:-translate-y-0.5 transition-all">
                <div className="h-28 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
                  {t.data?.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.data.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <span className="absolute left-5 -bottom-5 grid h-12 w-12 place-items-center rounded-xl bg-surface ring-4 ring-surface text-2xl shadow-card">
                    {t.emoji}
                  </span>
                </div>
                <div className="p-5 pt-8">
                  <h2 className="font-semibold">{t.name}</h2>
                  <p className="text-[11px] mono text-muted">{t.category}</p>
                  <p className="text-sm text-muted mt-2">{t.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-faint mono">{pages} pages · {blocks} sections</span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: accent }}>
                      <Eye className="h-3.5 w-3.5" /> Preview
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
