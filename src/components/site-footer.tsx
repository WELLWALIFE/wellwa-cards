import Link from "next/link";
import { Lock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Logo } from "./logo";
import { BRAND, LEGAL_NAME, REGISTERED_OFFICE, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP } from "@/lib/site-brand";

const cols = [
  {
    title: "Business Suite",
    links: [["What you get", "/features"], ["Pricing", "/pricing"], ["Website templates", "/templates"], ["Start free", "/signup"], ["Log in", "/login"]],
  },
  {
    title: "Solutions",
    links: [
      ["AI software & agents", "/solutions/ai-software"],
      ["Business automation", "/solutions/business-automation"],
      ["CRM & dashboards", "/solutions/crm-software"],
      ["WhatsApp automation", "/solutions/whatsapp-automation"],
      ["Web & app development", "/solutions/web-mobile-apps"],
      ["Social media management", "/solutions/social-media-management"],
    ],
  },
  {
    title: "Company",
    links: [["About us", "/about"], ["Our work", "/work"], ["Contact", "/contact"], ["Company information", "/company"], ["Partner programme", "/partners/legal/disclosures"], ["Staff Admin login", "/partners/admin/login"], ["Super Admin login", "/admin"]],
  },
  {
    title: "Policies",
    links: [["Terms of service", "/terms"], ["Privacy policy", "/privacy"], ["Refund & cancellation", "/refund"], ["Shipping & delivery", "/shipping"], ["Grievance redressal", "/grievance"], ["Delete your data", "/data-deletion"], ["Disclaimer", "/disclaimer"]],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm text-muted max-w-xs">
            An AI software company. We build the {BRAND} Business Suite and custom software for Indian businesses.
          </p>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-faint" /><span>{REGISTERED_OFFICE}</span></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`} className="flex gap-2 hover:text-ink"><Mail className="h-4 w-4 mt-0.5 shrink-0 text-faint" />{SUPPORT_EMAIL}</a></li>
            <li><a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="flex gap-2 hover:text-ink"><Phone className="h-4 w-4 mt-0.5 shrink-0 text-faint" />{SUPPORT_PHONE}</a></li>
          </ul>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-xs mono uppercase tracking-wide text-faint">{c.title}</h3>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  {href.startsWith("/partners") ? <a href={href} className="text-sm text-muted hover:text-ink">{label}</a> : <Link href={href} className="text-sm text-muted hover:text-ink">{label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="mono text-xs text-faint">© 2026 {BRAND} · a brand of {LEGAL_NAME}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <p className="mono text-xs text-faint">You think it. We build it.</p>
            {/* Two staff doors: Staff Admin (the partner / MLM panel) and Super Admin (the company's /admin — its own
                gate asks for the Super Admin password unless the owner's account is already logged in). */}
            <a href="/partners/admin/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-brand hover:text-brand-ink">
              <ShieldCheck className="h-3.5 w-3.5" /> Staff Admin login
            </a>
            <a href="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-brand hover:text-brand-ink">
              <Lock className="h-3.5 w-3.5" /> Super Admin login
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
