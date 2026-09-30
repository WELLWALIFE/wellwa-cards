import type { Metadata } from "next";
import { Mail, MessageCircle, Route, ShieldCheck, Phone } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP, waLink, pageMeta } from "@/lib/site-brand";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = pageMeta("/contact", {
  title: "Discuss a Software Project — Shubhora",
  description: "Share your AI, automation, CRM, WhatsApp or custom software requirement with Shubhora.",
});

export default function ContactPage() {
  return <div>
    <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
      <div className="grid lg:grid-cols-[.85fr_1.15fr] gap-12 items-start">
        <div className="lg:sticky lg:top-28">
          <span className="text-xs mono uppercase tracking-wide text-faint">Start a project</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-balance">Tell us the business problem first.</h1>
          <p className="mt-5 text-lg text-muted leading-relaxed">You do not need a technical specification. Explain who uses the process, what happens today and what result you want.</p>
          <div className="mt-8 space-y-3">
            <div className="flex gap-3 rounded-xl border border-border bg-surface p-4"><Route className="h-5 w-5 text-brand shrink-0 mt-0.5" /><div><p className="text-sm font-semibold">Practical first scope</p><p className="mt-1 text-sm text-muted">We identify a useful first release and the integrations it genuinely needs.</p></div></div>
            <div className="flex gap-3 rounded-xl border border-border bg-surface p-4"><ShieldCheck className="h-5 w-5 text-brand shrink-0 mt-0.5" /><div><p className="text-sm font-semibold">No false “ready-made” claim</p><p className="mt-1 text-sm text-muted">Custom solutions are scoped for your rules; the Shubhora Business Suite is our live SaaS product.</p></div></div>
          </div>
          <div className="mt-8 flex flex-col gap-3 text-sm text-muted">
            <a
              href={waLink("Hi Shubhora, I want to discuss a software project.")}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 font-semibold text-white w-fit hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 hover:text-ink"><Mail className="h-4 w-4" /> {SUPPORT_EMAIL}</a>
            <a href={`tel:+${SUPPORT_WHATSAPP}`} className="inline-flex items-center gap-2 hover:text-ink"><Phone className="h-4 w-4" /> {SUPPORT_PHONE}</a>
          </div>
        </div>
        <ContactForm />
      </div>
    </section>
  </div>;
}
