"use client";
// Every dashboard feature inside the Shubhora phone shell. The dashboard pages
// are plain client components, so they render here unchanged; links inside
// them that point at desktop routes are re-pointed to /poster/d/… on click.
import { Suspense, useEffect, useState, type MouseEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, ChevronLeft } from "lucide-react";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import CardsPage from "@/app/(dashboard)/cards/page";
import LeadsPage from "@/app/(dashboard)/leads/page";
import AdsPage from "@/app/(dashboard)/ads/page";
import WhatsappPage from "@/app/(dashboard)/whatsapp/page";
import AnalyticsPage from "@/app/(dashboard)/analytics/page";
import AiStudioPage from "@/app/(dashboard)/ai/page";
import StudioPage from "@/app/(dashboard)/studio/page";
import ToolsPage from "@/app/(dashboard)/tools/page";
import SettingsPage from "@/app/(dashboard)/settings/page";
import PartnerPage from "@/app/(dashboard)/partner/page";
import { CardEditor } from "@/components/editor/card-editor";
import { isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { appPath } from "@/lib/poster-sections";
import { goBack } from "@/lib/nav-back";

const SECTIONS = {
  overview: { C: DashboardPage, hi: "एक नज़र में", en: "Summary" },
  cards: { C: CardsPage, hi: "मेरे V-Card", en: "My V-Cards" },
  leads: { C: LeadsPage, hi: "ग्राहक", en: "Customers" },
  ads: { C: AdsPage, hi: "Ads", en: "Ads" },
  whatsapp: { C: WhatsappPage, hi: "WhatsApp AI", en: "WhatsApp AI" },
  analytics: { C: AnalyticsPage, hi: "कितने लोग आए", en: "Visits & numbers" },
  ai: { C: AiStudioPage, hi: "AI से लिखें", en: "Write with AI" },
  studio: { C: StudioPage, hi: "Video बनाएँ", en: "Make videos" },
  tools: { C: ToolsPage, hi: "Tools", en: "Tools" },
  settings: { C: SettingsPage, hi: "Account settings", en: "Account settings" },
  partner: { C: PartnerPage, hi: "Partner", en: "Partner" },
} as const;
type Section = keyof typeof SECTIONS;

function Inner() {
  const { section } = useParams<{ section: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { lang } = useT();
  const [ready, setReady] = useState(false);
  // Replace, not push: Back from the login page must not land here again and bounce straight back to it. The address keeps its ?id= (a card's editor).
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/d/${section}${window.location.search}`)}`); return; } setReady(true); })(); }, [router, section]);

  function intercept(e: MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || a.target === "_blank") return;
    const href = a.getAttribute("href") ?? "";
    const to = appPath(href);
    if (to) { e.preventDefault(); router.push(to); }
  }

  if (!ready) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const def = section === "editor" ? null : SECTIONS[section as Section];
  const fallback = /^\/(?![/\\])[^\s]*$/.test(sp.get("back") ?? "") ? (sp.get("back") as string) : section === "editor" ? "/poster/card" : "/poster/more";
  const title = section === "editor" ? (lang === "en" ? "Edit my card" : "Card बदलें") : def ? def[lang] : section;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Back = the screen the owner was just on (the card page, Card & Website, a dashboard section). Only with no earlier screen (a link
            opened fresh): the ?back= it was opened with (Card & Website → Edit → Full editor), else the card / More. */}
        <button type="button" onClick={() => goBack(router, fallback)} className="text-muted" aria-label={lang === "en" ? "Back" : "पीछे"}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-base font-bold">{title}</h1>
      </div>
      <div className="poster-embed" onClickCapture={intercept}>
        {section === "editor" ? <CardEditor id={sp.get("id") ?? "new"} /> : def ? <def.C /> : <p className="text-sm text-muted">Not found</p>}
      </div>
    </div>
  );
}
export default function SectionPage() {
  return <Suspense fallback={<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Inner /></Suspense>;
}
