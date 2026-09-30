// One SEO landing page per service, driven by src/lib/services.ts.
// Each page carries Service + FAQPage + BreadcrumbList structured data.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight, Bot, Check, LayoutDashboard, Megaphone, MessageCircle,
  Smartphone, Workflow, X,
} from "lucide-react";
import { SERVICES, getService } from "@/lib/services";
import { OG_IMAGE } from "@/lib/site-brand";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");

const ICONS = {
  "ai-software": Bot,
  "business-automation": Workflow,
  "crm-software": LayoutDashboard,
  "whatsapp-automation": MessageCircle,
  "web-mobile-apps": Smartphone,
  "social-media-management": Megaphone,
} as const;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return {
    title: s.metaTitle,
    description: s.metaDescription,
    alternates: { canonical: `${SITE}/solutions/${s.slug}` },
    openGraph: { title: s.metaTitle, description: s.metaDescription, type: "website", url: `/solutions/${s.slug}`, images: [OG_IMAGE] },
  };
}

export default async function ServicePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();
  const Icon = ICONS[s.slug as keyof typeof ICONS] ?? Bot;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.name,
      description: s.metaDescription,
      url: `${SITE}/solutions/${s.slug}`,
      provider: { "@type": "Organization", name: "Shubhora", url: SITE },
      areaServed: "IN",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: s.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Solutions", item: `${SITE}/solutions` },
        { "@type": "ListItem", position: 3, name: s.name, item: `${SITE}/solutions/${s.slug}` },
      ],
    },
  ];

  const others = SERVICES.filter((x) => x.slug !== s.slug);

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden hero-light border-y border-border">
        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-24">
          <nav className="text-xs text-faint mono" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/solutions" className="hover:text-ink">Solutions</Link>
            <span className="mx-2">/</span>
            <span className="text-muted">{s.tag}</span>
          </nav>
          <span className="mt-6 grid h-12 w-12 place-items-center rounded-xl grad-brand text-white shadow-card"><Icon className="h-6 w-6" /></span>
          <h1 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance max-w-4xl">{s.name}</h1>
          <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">{s.heroBody}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white shadow-glow">Discuss your requirement <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/solutions" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-surface">All solutions</Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-14 md:py-20">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{s.painTitle}</h2>
        <div className="mt-7 grid md:grid-cols-3 gap-4">
          {s.pains.map((p) => (
            <div key={p} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger/10"><X className="h-3.5 w-3.5 text-danger" /></span>
              <p className="text-sm text-muted leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-14 md:py-20">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{s.modulesTitle}</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {s.modules.map((m) => (
              <article key={m.title} className="rounded-2xl border border-border bg-bg p-6">
                <Check className="h-5 w-5 text-brand" />
                <h3 className="mt-4 font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{m.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {s.planTypes && (
        <section className="max-w-6xl mx-auto px-5 py-14 md:py-20">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Supported configurations</h2>
          <p className="mt-3 text-muted max-w-2xl">Configured to match the way your business already works.</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {s.planTypes.map((p) => (
              <article key={p.name} className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">{p.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {s.liveBuild && (
        <section className="relative overflow-hidden hero-light border-y border-border">
          <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#5b82ff]/40 bg-[#5b82ff]/10 px-3 py-1.5 text-xs mono text-[#8fa8ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3fd4f5] animate-pulse" /> {s.liveBuild.eyebrow}
            </span>
            <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight text-balance max-w-3xl">{s.liveBuild.title}</h2>
            <p className="mt-4 text-muted max-w-2xl leading-relaxed">{s.liveBuild.body}</p>
            <div className="mt-8 grid md:grid-cols-2 gap-3 max-w-4xl">
              {s.liveBuild.points.map((pt) => (
                <div key={pt} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-4 text-sm text-muted leading-relaxed">
                  <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />{pt}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {s.liveBuild.links.map((l, i) => (
                <Link key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined}
                  className={i === 0
                    ? "inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white shadow-glow"
                    : "inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-surface"}>
                  {l.label} <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-4xl mx-auto px-5 py-14 md:py-20">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Common questions</h2>
        <div className="mt-7 space-y-3">
          {s.faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-surface p-5">
              <summary className="cursor-pointer list-none font-medium flex items-center justify-between gap-4">
                {f.q}
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90 shrink-0" />
              </summary>
              <p className="mt-3 text-sm text-muted leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-14 md:py-16">
          <p className="text-xs mono uppercase tracking-wide text-faint">Related services</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {others.map((o) => (
              <Link key={o.slug} href={`/solutions/${o.slug}`} className="rounded-full border border-border bg-bg px-4 py-2 text-sm font-medium text-muted hover:text-ink hover:border-brand/40">
                {o.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-soft border-t border-border">
        <div className="max-w-4xl mx-auto px-5 py-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">Tell us what this looks like in your business.</h2>
          <p className="mt-3 text-muted">One honest conversation about the workflow — then a clear scope, phases and price.</p>
          <Link href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Start the conversation <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
