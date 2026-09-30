// Case studies. Only real, running systems — every claim here has a live link
// or a shipping feature behind it. No invented client counts or metrics.

import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import Link from "next/link";
import { ArrowRight, Bot, Check, ContactRound, ExternalLink } from "lucide-react";

export const metadata: Metadata = pageMeta("/work", {
  title: "Our Work — Live Systems Built by Shubhora",
  description: "Real, running software: the Shubhora Business Suite and a WhatsApp AI sales assistant for a wellness brand."
});

const cases = [
  {
    icon: ContactRound,
    tag: "Own product · SaaS",
    title: "Shubhora Business Suite: a business that markets itself every day",
    problem:
      "Paper visiting cards die in drawers, and basic digital cards are just contact pages. Small businesses needed the card itself to answer customers, capture leads and follow up — without hiring anyone.",
    built: [
      "Multi-page digital cards with products, video, gallery, booking and payments",
      "An AI assistant on every card, trained in 3 layers (platform → brand → seller), replying in the customer's own language",
      "Personal WhatsApp automation per user — isolated sessions, AI replies with real product videos, PDFs and photos, voice-note understanding",
      "Lead CRM with AI scoring, pipeline, follow-up sequences and campaign attribution",
      "White-label mode: partners resell under their own domain with a prepaid activation wallet",
      "Self-serve ads toolkit: ready-made ad copy, creatives and conversion tracking to WhatsApp",
    ],
    links: [
      { label: "Explore the product", href: "/features" },
      { label: "See live templates", href: "/templates" },
    ],
  },
  {
    icon: Bot,
    tag: "Client deployment · Wellness",
    title: "Wellwa Life: an AI sales assistant for a wellness brand",
    problem:
      "A wellness brand selling premium water ionizers across India. Enquiries arrived on WhatsApp at all hours, the sales team had no branded online presence, and every first reply was typed by hand.",
    built: [
      "Branded digital cards for every salesperson on the company's own domain",
      "An AI sales assistant on WhatsApp that answers in Hindi, Hinglish or English and understands voice notes",
      "A guided demo-booking flow that sends product videos, photos and the brochure in the chat",
      "Lead capture into a shared CRM with follow-up reminders",
    ],
    links: [
      { label: "See how the WhatsApp AI works", href: "/solutions/whatsapp-automation" },
    ],
  },
];

export default function WorkPage() {
  return (
    <div>
      <section className="relative overflow-hidden hero-light border-y border-border">
        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-24">
          <span className="text-xs mono uppercase tracking-wide text-brand-ink">Our work</span>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance max-w-4xl">Live systems, not portfolio mock-ups.</h1>
          <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
            Everything below is running in production today. Click through — the proof is public.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 py-14 md:py-20 space-y-14">
        {cases.map(({ icon: Icon, tag, title, problem, built, links }) => (
          <article key={title} className="rounded-2xl border border-border bg-surface p-6 md:p-10 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl grad-brand text-white"><Icon className="h-5 w-5" /></span>
              <span className="mono text-[11px] uppercase tracking-wide text-faint">{tag}</span>
            </div>
            <h2 className="mt-5 text-2xl md:text-3xl font-semibold tracking-tight text-balance">{title}</h2>
            <p className="mt-4 text-muted leading-relaxed max-w-3xl"><span className="font-semibold text-ink">The problem: </span>{problem}</p>
            <p className="mt-6 text-sm font-semibold mono uppercase tracking-wide text-faint">What we built</p>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              {built.map((b) => (
                <div key={b} className="flex items-start gap-2.5 rounded-xl bg-bg border border-border p-4 text-sm text-muted leading-relaxed">
                  <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />{b}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {links.map((l, i) => (
                <Link key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined}
                  className={i === 0
                    ? "inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white"
                    : "inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-surface2"}>
                  {l.label} {l.href.startsWith("http") ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className="bg-brand-soft border-t border-border">
        <div className="max-w-4xl mx-auto px-5 py-14 text-center">
          <Bot className="h-7 w-7 text-brand mx-auto" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">Your system could be the next one here.</h2>
          <p className="mt-3 text-muted">Tell us the workflow — we&apos;ll show you what live looks like.</p>
          <Link href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Start a project <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
