"use client";
// Phones that land on a desktop page (/dashboard, /cards/…, /leads …) — from an old link, a template page or the
// "Advanced" button — used to have no menu at all: the desktop sidebar is hidden on small screens. This gives them the
// app's own five tabs plus a Back button, so nobody is stuck (owner's call, 24 Sep 2026).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, PlusCircle, Users, Handshake, UserCircle, ChevronLeft } from "lucide-react";

const TABS = [
  { href: "/poster", label: "Home", icon: Home },
  { href: "/poster/create", label: "Create", icon: PlusCircle },
  { href: "/poster/leads", label: "Leads", icon: Users },
  { href: "/poster/business", label: "Business", icon: Handshake },
  { href: "/poster/more", label: "Me", icon: UserCircle },
];

export function MobileBackButton() {
  const router = useRouter();
  function back() {
    let inApp = false;
    try { inApp = window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { /* none */ }
    if (inApp) router.back(); else router.push("/poster");
  }
  return (
    <button type="button" onClick={back} aria-label="Back"
      className="md:hidden inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold">
      <ChevronLeft className="h-4 w-4" /> Back
    </button>
  );
}

export function MobileAppNav() {
  const p = usePathname() || "";
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const on = t.href === "/poster/create" && p.startsWith("/cards");
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${on ? "text-brand-ink" : "text-muted"}`}>
              <t.icon className={`h-5 w-5 ${on ? "text-brand" : ""}`} /> {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
