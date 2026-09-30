import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import Link from "next/link";
import {
  ArrowRight, BarChart3, Bot, Boxes, Check, CircleDollarSign, CloudCog,
  ContactRound, Database, GitBranch, Layers3, MessageCircle,
  ShieldCheck, ShoppingCart, Smartphone, Users, Workflow,
} from "lucide-react";
import { SERVICES } from "@/lib/services";

export const metadata: Metadata = pageMeta("/solutions", {
  title: "Business Software Solutions — Shubhora",
  description: "AI applications, workflow automation, CRM, portals and custom software designed around your operations.",
});

const solutionGroups = [
  {
    id: "ai", eyebrow: "Artificial intelligence", icon: Bot,
    title: "AI that works inside your business—not beside it.",
    body: "We connect approved company knowledge, workflows and customer channels to practical AI interfaces with human review where it matters.",
    capabilities: ["Knowledge-base assistants", "Customer-support agents", "Document extraction and summaries", "Lead qualification", "Internal copilots", "AI-assisted content workflows"],
  },
  {
    id: "automation", eyebrow: "Workflow automation", icon: Workflow,
    title: "Move routine work automatically. Keep decisions visible.",
    body: "We connect forms, teams, databases, messaging, payments and reporting so work moves forward without manual copying or missed follow-ups.",
    capabilities: ["Lead routing and follow-up", "Approval workflows", "WhatsApp and email flows", "Payment and renewal reminders", "Service-ticket automation", "Scheduled reports and alerts"],
  },
];

const builds = [
  { icon: ContactRound, title: "CRM & lead systems", body: "Pipelines, tasks, scoring, conversations and sales reporting." },
  { icon: Layers3, title: "ERP & operations portals", body: "Orders, inventory, service, finance and team workflows in one place." },
  { icon: Smartphone, title: "Customer & team apps", body: "Responsive web apps and PWAs for customers, staff and field teams." },
  { icon: ShoppingCart, title: "Commerce & subscriptions", body: "Catalogues, checkout, recurring plans, wallets and partner pricing." },
  { icon: BarChart3, title: "Dashboards & analytics", body: "Decision-ready reports across business systems and roles." },
  { icon: CloudCog, title: "APIs & integrations", body: "Connect existing software, data, messages and payments securely." },
];

const foundations = [
  { icon: ShieldCheck, title: "Access and audit", body: "Roles, permissions, tenant separation and traceable actions." },
  { icon: Database, title: "Reliable data model", body: "Clear ownership, validation, backups and reporting-ready records." },
  { icon: Boxes, title: "Modular architecture", body: "Add teams, regions, products and modules without rebuilding everything." },
  { icon: Users, title: "Human control", body: "Approvals and escalation paths around sensitive AI or money movement." },
];

export default function SolutionsPage() {
  return (
    <div>
      <section className="relative overflow-hidden hero-light border-y border-border">
        <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-24">
          <span className="text-xs mono uppercase tracking-wide text-brand-ink">Solutions</span>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance max-w-4xl">A software system should fit your business model.</h1>
          <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">From a focused automation to a complete CRM or customer platform, we scope and build around your roles, rules and growth plan.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white">Discuss your requirement <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-12 md:py-16">
          <p className="text-xs mono uppercase tracking-wide text-faint">Every service, in detail</p>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SERVICES.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group rounded-xl border border-border bg-bg p-4 hover:border-brand/40 hover:shadow-card transition-all">
                <p className="mono text-[10px] uppercase tracking-wide text-faint">{s.tag}</p>
                <p className="mt-2 text-sm font-semibold leading-snug">{s.name}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 space-y-20">
        {solutionGroups.map((s, i) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={s.id} className="scroll-mt-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <span className="grid h-12 w-12 place-items-center rounded-xl grad-brand text-white shadow-card"><Icon className="h-6 w-6" /></span>
                <p className="mt-5 text-xs mono uppercase tracking-wide text-brand-ink">{s.eyebrow}</p>
                <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-balance">{s.title}</h2>
                <p className="mt-4 text-muted leading-relaxed">{s.body}</p>
              </div>
              <div className={`rounded-2xl border border-border bg-surface p-6 md:p-8 ${i % 2 ? "lg:order-1" : ""}`}>
                <p className="text-sm font-semibold">Typical modules</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  {s.capabilities.map((c) => <div key={c} className="flex items-start gap-2 rounded-xl bg-bg p-3 text-sm"><Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />{c}</div>)}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="border-y border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <span className="text-xs mono uppercase tracking-wide text-faint">More we build</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">Connected software for the rest of your operation.</h2>
          <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {builds.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-border bg-bg p-6"><Icon className="h-6 w-6 text-brand" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm text-muted leading-relaxed">{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-10 items-start">
          <div><GitBranch className="h-7 w-7 text-brand" /><h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">Built for real operations.</h2><p className="mt-4 text-muted leading-relaxed">Good software is more than screens. We plan the controls that protect your data, money and customer experience.</p></div>
          <div className="grid sm:grid-cols-2 gap-4">
            {foundations.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-border bg-surface p-5"><Icon className="h-5 w-5 text-brand" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm text-muted leading-relaxed">{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-brand-soft border-t border-border">
        <div className="max-w-4xl mx-auto px-5 py-16 text-center"><CircleDollarSign className="h-7 w-7 text-brand mx-auto" /><h2 className="mt-4 text-3xl font-semibold tracking-tight">A custom build starts with scope, not a fixed package.</h2><p className="mt-3 text-muted">Share the users, workflow and desired result. We will suggest phases, timeline and commercial scope.</p><Link href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Start a project discussion <ArrowRight className="h-4 w-4" /></Link></div>
      </section>
    </div>
  );
}
