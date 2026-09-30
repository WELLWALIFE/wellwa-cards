import { Sidebar } from "@/components/sidebar";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { RequireAuth } from "@/components/require-auth";
import { WelcomeName } from "@/components/welcome-name";
import { PlanProvider } from "@/lib/plan";
import { TrialBanner } from "@/components/trial-banner";
import { SetupResume } from "@/components/setup-resume";
import { PushInvite } from "@/components/push-toggle";
import { headers } from "next/headers";
import { brandForHost } from "@/lib/brand";
import { BrandProvider } from "@/components/brand-context";
import { MobileAppNav, MobileBackButton } from "@/components/mobile-app-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A member working on their partner's host (join.wellwalife.com) must see
  // their branded card address everywhere in the editor, never the platform one.
  const b = await brandForHost((await headers()).get("host"));
  const brand = b ? { name: b.name, logoUrl: b.logoUrl ?? null, themeColor: b.themeColor, baseDomain: b.baseDomain } : null;
  return (
    <BrandProvider brand={brand}>
    <PlanProvider>
    <div className="flex min-h-screen">
      <RequireAuth />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-border bg-surface/80 backdrop-blur flex items-center justify-between px-5 sticky top-0 z-10">
          <div className="md:hidden flex items-center gap-2 min-w-0">
            <MobileBackButton />
            <span className="font-semibold tracking-tight truncate">{brand ? brand.name : "Shubhora"}</span>
          </div>
          <WelcomeName />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:inline-flex"><ThemeToggle /></span>
            {/* One account = one card: this opens it (or starts it when there is none yet) — never a second card. */}
            <Link
              href="/cards"
              className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-sm font-medium text-white shadow-card hover:-translate-y-0.5 transition-transform"
            >
              <CreditCard className="h-4 w-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">My card</span>
            </Link>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-5 pb-24 md:p-8 md:pb-8 max-w-6xl w-full">
          <TrialBanner />
          <SetupResume variant="banner" />
          <PushInvite />
          {children}
        </main>
      </div>
      {/* Brand hosts (white-label) keep their own look — the app tabs belong to Shubhora. */}
      {!brand && <MobileAppNav />}
    </div>
    </PlanProvider>
    </BrandProvider>
  );
}
