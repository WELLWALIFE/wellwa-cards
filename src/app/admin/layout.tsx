"use client";

// Super Admin shell (owner's call, 27 Sep 2026: "professional look"): the Shubhora mark, the menu grouped by what the
// owner is doing (people, money, content, AI, settings), the page's own name in the top bar, and on a phone a menu
// button that opens the same list as a drawer — before, a phone had no menu at all.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, IndianRupee, Globe, ArrowLeft, Bot, LayoutTemplate, Building2, Wallet,
  Image as ImageIcon, Bell, UserCog, Sparkles, Menu, X, Settings, Headset, type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminGate } from "@/components/admin-gate";
import { PartnerAdminButton } from "@/components/partner-admin-button";

type Item = { href: string; label: string; icon: LucideIcon };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "", items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  { title: "People", items: [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/staff", label: "Staff (sub admins)", icon: UserCog },
    { href: "/admin/cards", label: "Cards", icon: CreditCard },
    { href: "/admin/support", label: "Live help", icon: Headset },
  ] },
  { title: "Money", items: [
    { href: "/admin/wallets", label: "Funds", icon: Wallet },
    { href: "/admin/plans", label: "Plans & pricing", icon: IndianRupee },
  ] },
  { title: "Content", items: [
    { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/admin/banners", label: "Daily banners", icon: ImageIcon },
    { href: "/admin/brands", label: "White label", icon: Building2 },
  ] },
  { title: "AI", items: [
    { href: "/admin/shubhora-ai", label: "Shubhora AI", icon: Sparkles },
    { href: "/admin/ai", label: "AI bot training", icon: Bot },
  ] },
  { title: "Settings", items: [
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/google", label: "Google Business", icon: Globe },
    { href: "/admin/site", label: "Site settings", icon: Settings },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.items);
const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/app-192.png" alt="" className="h-9 w-9 rounded-xl shadow-sm" />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">Shubhora</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Super Admin</span>
      </span>
    </Link>
  );
}

function NavList({ path, onPick }: { path: string; onPick?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => (
        <div key={g.title || "top"} className={g.title ? "mt-5" : ""}>
          {g.title && <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const on = isActive(href, path);
              return (
                <Link key={href} href={href} onClick={onPick} aria-current={on ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    on ? "bg-brand-soft font-semibold text-brand-ink" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
                  {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand" />}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={on ? 2.2 : 1.9} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <div className="space-y-1 border-t border-border p-3">
      <PartnerAdminButton />
      <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to app
      </Link>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const here = ALL.find((i) => isActive(i.href, path)) ?? ALL[0];
  const group = GROUPS.find((g) => g.items.includes(here))?.title;
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <AdminGate>
      <div className="flex min-h-screen bg-bg">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <div className="flex h-16 items-center border-b border-border px-5"><Brand /></div>
          <NavList path={path} />
          <Footer />
        </aside>

        {/* Phone drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-float">
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <Brand />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
              </div>
              <NavList path={path} onPick={() => setOpen(false)} />
              <Footer />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur md:px-8">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-ink md:hidden"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1">
              {group && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{group}</p>}
              <p className="truncate text-[15px] font-semibold tracking-tight text-ink">{here.label}</p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-good" /> wellwalife@gmail.com
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-ink">Owner</span>
            </span>
            <ThemeToggle />
          </header>
          <main className="w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </AdminGate>
  );
}
