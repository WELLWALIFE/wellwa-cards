import type { Metadata, Viewport } from "next";
import { PosterNav } from "@/components/poster/nav";
import { NativeBridge } from "@/components/poster/native-bridge";
import { TopMenu } from "@/components/poster/top-menu";
import { BackBar } from "@/components/poster/back-bar";
import { SetupResume } from "@/components/setup-resume";
import { HelpDock } from "@/components/poster/help-dock";
import { UiLangProvider } from "@/lib/poster-i18n";
import { PlanProvider } from "@/lib/plan";
import { BrandProvider } from "@/components/brand-context";

export const metadata: Metadata = {
  title: "Shubhora",
  description: "Roz ka festival aur greeting poster, aapke naam, photo aur number ke saath — ek tap mein WhatsApp par.",
  // One app for the whole site (the same manifest as every other page) — new logo, opens on /poster.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Shubhora", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/app-192.png", apple: "/icons/app-192.png" },
};
export const viewport: Viewport = { themeColor: "#2f5bf5", width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

// A phone-shaped, standalone shell: no marketing nav, bottom tab bar, safe-area padding.
export default function PosterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center" style={{ background: "var(--bg)" }}>
      <BrandProvider brand={null}>
      <PlanProvider>
      <UiLangProvider>
        <div className="w-full max-w-md flex-1 flex flex-col min-h-screen bg-surface sm:border-x border-border relative">
          <TopMenu />
          <main className="flex-1 pb-24 px-4 pt-4" style={{ paddingTop: "calc(max(0.6rem, env(safe-area-inset-top)) + 2.9rem + var(--help-banner, 0px))" }}><BackBar />{children}<SetupResume variant="float" /></main>
          <PosterNav />
          {/* One Help button on every screen, and the live-help session behind it. */}
          <HelpDock />
          <NativeBridge />
        </div>
      </UiLangProvider>
      </PlanProvider>
      </BrandProvider>
    </div>
  );
}
