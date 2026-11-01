import type { Metadata } from "next";
import Link from "next/link";
import { BadgeIndianRupee, Building2, LayoutDashboard, MapPinned, MessageCircle, Package, Phone, Sparkles, Users } from "lucide-react";
import { BRAND, SUPPORT_PHONE, SUPPORT_WHATSAPP, pageMeta, waLink } from "@/lib/site-brand";
import { FRANCHISE_FAQ, FRANCHISE_OFFER, FRANCHISE_STEPS } from "@/lib/franchise-apply";
import { FranchiseApplyForm } from "@/components/franchise-apply-form";

export const metadata: Metadata = pageMeta("/franchise", {
  title: `Become a ${BRAND} franchise — your city, your customers, commission for life`,
  description: "Bring local businesses online with Shubhora: a free V-Card, a website in minutes, posters and WhatsApp AI. Earn commission on every payment your customers ever make. Apply in two minutes.",
});

const ICONS = [MapPinned, BadgeIndianRupee, LayoutDashboard, Sparkles, Package, Users];

export default function FranchisePage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-start">
          <div>
            <span className="text-xs mono uppercase tracking-wide text-faint">Franchise programme</span>
            <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-balance">Every shop in your city needs to be online. Be the one who takes them there.</h1>
            <p className="mt-5 text-lg text-muted leading-relaxed">
              A {BRAND} franchise brings local businesses a free digital card, a website in minutes, daily posters and a WhatsApp assistant —
              and earns a commission on every payment those customers make, for as long as they stay.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#apply" className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white hover:opacity-95">Apply now — 2 minutes</a>
              <a href={waLink("Hi Shubhora, I want to know about the franchise.")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold hover:bg-surface2"><MessageCircle className="h-4 w-4 text-[#25D366]" /> Ask on WhatsApp</a>
            </div>
            <p className="mt-4 text-sm text-muted">Already a franchise? <Link href="/admin/login" className="font-semibold text-brand-ink underline">Log in to your panel</Link> with your mobile number.</p>
            <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[["₹0", "stock or office"], ["1 city", "exclusive to you"], ["Life", "of every customer, commission"]].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-border bg-surface p-3"><dt className="text-xl font-semibold">{v}</dt><dd className="text-xs text-muted">{l}</dd></div>
              ))}
            </dl>
          </div>
          <FranchiseApplyForm />
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-border bg-surface/50">
        <div className="max-w-6xl mx-auto px-5 py-16">
          <span className="text-xs mono uppercase tracking-wide text-faint">What a franchise gets</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">A real business, not a referral scheme.</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FRANCHISE_OFFER.map((o, i) => { const I = ICONS[i % ICONS.length]; return (
              <div key={o.title} className="rounded-2xl border border-border bg-surface p-5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand-ink"><I className="h-4 w-4" /></span>
                <h3 className="mt-3 font-semibold">{o.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{o.text}</p>
              </div>
            ); })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <span className="text-xs mono uppercase tracking-wide text-faint">How it works</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">From application to first customer in a week.</h2>
        <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FRANCHISE_STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-surface p-5">
              <span className="text-xs mono text-faint">0{i + 1}</span>
              <h3 className="mt-1 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 md:p-6 grid md:grid-cols-[auto_1fr] gap-4 items-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand-ink"><Building2 className="h-5 w-5" /></span>
          <p className="text-sm text-muted leading-relaxed"><b className="text-ink">Who does well:</b> printing presses, digital-marketing agencies, CA and accounting offices, mobile shops, computer institutes, and anyone who already meets 20 shopkeepers a week. You bring the customer and show the demo on their phone; {BRAND} builds, hosts and supports.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface/50">
        <div className="max-w-3xl mx-auto px-5 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">Questions franchises ask</h2>
          <div className="mt-6 space-y-2">
            {FRANCHISE_FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-surface px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold flex items-center justify-between gap-3">{f.q}<span className="text-faint transition group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-sm text-muted leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4 text-sm text-muted">
            <a href="#apply" className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white">Apply now</a>
            <a href={`tel:+${SUPPORT_WHATSAPP}`} className="inline-flex items-center gap-2 hover:text-ink"><Phone className="h-4 w-4" /> {SUPPORT_PHONE}</a>
            <Link href="/pricing" className="hover:text-ink underline">See what customers pay</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
