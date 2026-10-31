"use client";
// The app's navigation. On a phone: the bottom tab bar (unchanged). On a computer (lg, ≥1024px — owner, 31 Oct 2026: "desktop par
// website ki tarah khule, mobile par app ki tarah"): a fixed left sidebar with the logo, the same five sections and the screens people
// open most, and the page beside it at full width (the shell, app/poster/layout.tsx + globals.css `.app-shell`).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Users, Handshake, UserCircle, Globe, CreditCard, Settings, Package, CalendarDays } from "lucide-react";
import { useAccountKind, showsPartnerUi } from "@/lib/use-account-kind";
import { useT } from "@/lib/poster-i18n";
import { LogoMark } from "@/components/logo";

type Tab = { href: string; label: string; icon: typeof Home };

function isActive(href: string, p: string): boolean {
  if (href === "/poster") return p === "/poster" || p.startsWith("/poster/history");
  if (href === "/poster/more") return /^\/poster\/(more|setup|social|report|guide|connect|profiles)/.test(p);
  if (href === "/poster/create") return /^\/poster\/(create|video|calendar|brand|testimonials|card|text-video|explainer|reel|photoshoot|website)/.test(p);
  if (href === "/poster/crm") return /^\/poster\/(crm|leads|learn)/.test(p);
  return p.startsWith(href);
}

export function PosterNav() {
  const p = usePathname();
  const { t, lang } = useT();
  const kind = useAccountKind();
  const hi = lang !== "en";
  const tabs: Tab[] = [
    { href: "/poster", label: t.tabHome, icon: Home },
    { href: "/poster/create", label: t.tabCard, icon: PlusCircle },
    { href: "/poster/crm", label: t.tabLeads, icon: Users },
    { href: "/poster/business", label: t.tabBusiness, icon: Handshake },
    { href: "/poster/more", label: t.tabMore, icon: UserCircle },
  ].filter((x) => x.href !== "/poster/business" || showsPartnerUi(kind));   // a consumer has no Business tab
  // The screens opened most, one click away on a computer.
  const quick: Tab[] = [
    { href: "/poster/site", label: hi ? "Card & Website" : "Card & Website", icon: Globe },
    { href: "/poster/products", label: hi ? "Products" : "Products", icon: Package },
    { href: "/poster/calendar", label: hi ? "Posters" : "Posters", icon: CalendarDays },
    { href: "/poster/plan", label: hi ? "मेरा plan" : "My plan", icon: CreditCard },
    { href: "/poster/settings", label: hi ? "Settings" : "Settings", icon: Settings },
  ];
  // The profile steps (You, Company…) stay inside the app, tabs and all (owner's call, 2 Oct 2026); only the very
  // first "start" screen is full-screen.
  if (p.startsWith("/poster/start")) return null;
  return (
    <>
      {/* Phone: the bottom tab bar. z-40: stays above page content (cards, previews, sticky bars). */}
      <nav className="app-tabbar fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md border-t border-border bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((x) => {
            const active = isActive(x.href, p);
            return (
              <Link key={x.href} href={x.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-brand-ink" : "text-muted"}`}>
                <x.icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
                {x.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Computer: the sidebar. */}
      <aside className="app-side fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-border bg-surface lg:flex">
        <Link href="/poster" className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <LogoMark className="h-9 w-7" />
          <span className="text-[1.15rem] font-extrabold tracking-tight text-ink">Shubhora</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {tabs.map((x) => {
              const active = isActive(x.href, p);
              return (
                <li key={x.href}>
                  <Link href={x.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-soft text-brand-ink" : "text-ink hover:bg-surface2"}`}>
                    <x.icon className={`h-5 w-5 ${active ? "text-brand" : "text-muted"}`} /> {x.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wide text-faint">{hi ? "जल्दी खोलें" : "Quick open"}</p>
          <ul className="space-y-0.5">
            {quick.map((x) => {
              const active = p.startsWith(x.href);
              return (
                <li key={x.href}>
                  <Link href={x.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
                    <x.icon className={`h-4 w-4 ${active ? "text-brand" : ""}`} /> {x.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
