"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { InstallAppButton } from "./install-app";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

// `from`: xl = in the header from 1280px; menu = never in the header (the 1152px row has no room), only in the phone menu and the footer.
const links: { href: string; label: string; from?: "xl" | "menu" }[] = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Business Suite" },
  { href: "/pricing", label: "Pricing" },
  { href: "/templates", label: "Templates", from: "menu" },
  { href: "/solutions", label: "Solutions", from: "xl" },
  { href: "/work", label: "Work", from: "menu" },
  { href: "/about", label: "About", from: "xl" },
  { href: "/franchise", label: "Franchise" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
      <div className="max-w-6xl mx-auto h-16 px-5 flex items-center justify-between">
        {/* The wordmark never shrinks (1 Nov 2026: at 1440px it was cut to "Shubh" behind Home); the menu grows with the screen instead:
            lg = the five that matter, xl + Solutions/About; Templates/Work stay in the footer and the phone menu. */}
        <div className="shrink-0"><Logo /></div>

        <nav className="hidden lg:flex items-center gap-0.5">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${l.from === "menu" ? "hidden" : l.from === "xl" ? "hidden xl:inline-flex" : "inline-flex"} whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  active ? "text-brand-ink bg-brand-soft" : "text-muted hover:text-ink hover:bg-surface2"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {/* The app (owner's call, 24 Sep 2026): one-tap "Install app" (PWA) at the very top of every public page (from xl; on a laptop it is in the menu row below). */}
          <span className="hidden xl:inline-flex"><InstallAppButton variant="nav" /></span>
          <Link href="/login" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className="whitespace-nowrap rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
            Start free
          </Link>
        </div>

        <div className="lg:hidden flex items-center gap-2">
          <InstallAppButton variant="navMobile" />
          <button className="text-ink" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-surface px-5 py-3 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface2"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/app" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink bg-brand-soft">📲 Install the app — how it works</Link>
          <div className="flex gap-2 pt-2">
            <Link href="/login" onClick={() => setOpen(false)} className="flex-1 text-center rounded-lg border border-border px-3.5 py-2 text-sm font-medium">
              Log in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="flex-1 text-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white">
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
