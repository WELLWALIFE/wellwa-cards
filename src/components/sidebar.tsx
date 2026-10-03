"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  BarChart3,
  Bot,
  MessageCircle,
  Settings,
  ShieldCheck,
  Wrench,
  Wallet,
  Megaphone,
  Clapperboard,
  Globe,
} from "lucide-react";
import { Logo } from "./logo";
import { getSessionUser, isCloudConfigured } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useEffect } from "react";
import { usePlan, PLAN_FEATURES, type Feature } from "@/lib/plan";
import { Lock, Network } from "lucide-react";
import { PARTNER_PANEL, useAssociate } from "@/lib/associate";

const OWNER_EMAILS = ["wellwalife@gmail.com", "licuretech@gmail.com"];

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; badge?: string; feature?: Feature };

/**
 * Grouped so nothing important hides in a flat list.
 *
 * The split follows what the owner is trying to do: build the card, then get
 * business from it, then run the account. Ads sat three clicks deep inside the
 * card editor and went unnoticed — anything that earns money belongs here.
 */
const nav: { section: string; items: NavItem[] }[] = [
  {
    section: "Your cards",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/cards", label: "My V-Cards", icon: CreditCard },
      { href: "/poster/site", label: "Card & Website", icon: Globe },
    ],
  },
  {
    section: "Get business",
    items: [
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/ads", label: "Ads", icon: Megaphone, feature: "analytics" },
      // The video engines live in the phone app; without this row a desktop owner never finds them — including
      // the 10-minute one, which people go looking for by name.
      { href: "/poster/text-video", label: "Videos", icon: Clapperboard, badge: "New" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, badge: "New", feature: "whatsapp" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, feature: "analytics" },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/ai", label: "AI Studio", icon: Bot, badge: "AI", feature: "ai-studio" },
      { href: "/studio", label: "Studio", icon: Clapperboard, badge: "New" },
      { href: "/tools", label: "Tools", icon: Wrench },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { plan } = usePlan();
  const [isOwner, setIsOwner] = useState(false);
  // Partner administrators get an extra section; ordinary members never see it.
  const [isPartner, setIsPartner] = useState(false);
  useEffect(() => {
    getSessionUser().then((u) =>
      setIsOwner(OWNER_EMAILS.includes((u?.email ?? "").toLowerCase())));
    getBrowserSupabase()?.rpc("my_brand").then(({ data }) => setIsPartner(Boolean(data)));
  }, []);
  const associate = useAssociate();
  const unlocked = PLAN_FEATURES[plan];
  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <Logo href="/dashboard" />
      </div>
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {nav.map((group) => (
        <div key={group.section} className="space-y-1">
          <p className="px-3 pb-1 mono text-[10px] font-bold uppercase tracking-wider text-faint">
            {group.section}
          </p>
          {group.items.map(({ href, label, icon: Icon, badge, feature }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const locked = Boolean(feature && !unlocked.includes(feature));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-soft text-brand-ink font-medium"
                  : "text-muted hover:bg-surface2 hover:text-ink"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className={`flex-1 ${locked ? "opacity-70" : ""}`}>{label}</span>
              {locked ? (
                <Lock className="h-3.5 w-3.5 text-faint" />
              ) : badge ? (
                <span className="mono text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-ai-soft text-ai">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
          })}
        </div>
        ))}
      </nav>
      <div className="p-3 border-t border-border space-y-2">
        {associate && (
        <a href={PARTNER_PANEL}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink bg-brand-soft hover:opacity-90 transition-opacity">
          <Network className="h-[18px] w-[18px]" />
          <span className="flex-1">Partner panel</span>
          <span className="mono text-[10px]">{associate}</span>
        </a>
        )}
        {isPartner && (
        <Link href="/partner"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink transition-colors">
          <Wallet className="h-[18px] w-[18px] text-brand" />
          <span className="flex-1">Partner</span>
        </Link>
        )}
        {isOwner && (
        <Link href="/admin"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink transition-colors">
          <ShieldCheck className="h-[18px] w-[18px]" style={{ color: "var(--amber)" }} />
          <span className="flex-1">Super Admin</span>
          <span className="mono text-[10px] font-bold uppercase rounded px-1.5 py-0.5" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
            Owner
          </span>
        </Link>
        )}
        {!isCloudConfigured() && (
          <div className="rounded-lg bg-surface2 p-3 text-xs text-muted">
            <p className="font-medium text-ink">Demo mode</p>
            <p className="mt-1 leading-relaxed">Sample data — connect Supabase for real accounts.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
