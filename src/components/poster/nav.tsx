"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Users, Handshake, UserCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

export function PosterNav() {
  const p = usePathname();
  const { t } = useT();
  const tabs = [
    { href: "/poster", label: t.tabHome, icon: Home },
    { href: "/poster/create", label: t.tabCard, icon: PlusCircle },
    { href: "/poster/leads", label: t.tabLeads, icon: Users },
    { href: "/poster/business", label: t.tabBusiness, icon: Handshake },
    { href: "/poster/more", label: t.tabMore, icon: UserCircle },
  ];
  // The profile steps (You, Company…) stay inside the app, tabs and all (owner's call, 2 Oct 2026); only the very
  // first "start" screen is full-screen.
  if (p.startsWith("/poster/start")) return null;
  return (
    // z-40: stays above page content (cards, previews, sticky bars) so the menu never disappears under a page.
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/poster" ? (p === "/poster" || p.startsWith("/poster/history")) : t.href === "/poster/more" ? /^\/poster\/(more|settings|profiles|products|setup|social|report|guide|connect)/.test(p) : t.href === "/poster/create" ? /^\/poster\/(create|video|calendar|brand|testimonials|card|text-video|explainer|reel|photoshoot|website)/.test(p) : t.href === "/poster/leads" ? /^\/poster\/(leads|learn)/.test(p) : p.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-brand-ink" : "text-muted"}`}>
              <t.icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
