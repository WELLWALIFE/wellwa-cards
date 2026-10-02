"use client";
// The partner panel (Team, Income, Wallet, KYC… — /partners on this site) INSIDE the app (owner's call, 2 Oct 2026:
// "MLM wala part bhi sab kuch app me open hona chahiye"). The panel keeps its own pages; this screen frames them
// under the app's tabs, with Back, so the person never leaves the app. The hand-off (/api/partner-panel) signs them
// into the panel with the same login.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ExternalLink, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

const TITLES: Record<string, [string, string]> = {
  "/dashboard": ["User Panel", "User Panel"], "/team": ["Team", "Team"], "/income": ["Income", "कमाई"], "/wallet": ["Wallet", "Wallet"],
  "/rank": ["Rank", "Rank"], "/subscription": ["Subscription", "Subscription"], "/kyc": ["KYC", "KYC"], "/downloads": ["Downloads", "Downloads"], "/support": ["Support", "Support"],
};

function PanelInner() {
  const params = useSearchParams();
  const { lang } = useT(); const en = lang === "en";
  const raw = params.get("next") || "/dashboard";
  const next = /^\/[a-z0-9][a-z0-9/_-]{0,80}$/i.test(raw) ? raw : "/dashboard";
  const src = `/api/partner-panel?next=${encodeURIComponent(next)}`;
  const title = TITLES[next]?.[en ? 0 : 1] ?? "Business";
  const [loading, setLoading] = useState(true);
  // Frames from the panel are not reachable from here: a page that stays blank for a while gets the way out below.
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return (
    <div className="-mx-4 -mt-2 flex flex-col" style={{ height: "calc(100dvh - 64px - env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Link href="/poster/business" className="inline-flex items-center gap-0.5 text-sm font-semibold text-muted"><ChevronLeft className="h-5 w-5" /> {en ? "Business" : "Business"}</Link>
        <p className="flex-1 truncate text-center text-sm font-bold">{title}</p>
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-muted" title={en ? "Open full screen" : "पूरी screen पर खोलें"}><ExternalLink className="h-4 w-4" /></a>
      </div>
      <div className="relative flex-1 bg-white">
        {loading && <div className="absolute inset-0 grid place-items-center bg-surface"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
        <iframe src={src} title={title} className="h-full w-full" onLoad={() => setLoading(false)} />
        {loading && slow && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-border bg-surface p-3 text-center text-xs text-muted shadow-float">
            {en ? "Taking long? " : "देर हो रही है? "}<a href={src} className="font-semibold text-brand-ink underline">{en ? "Open the panel full screen" : "Panel पूरी screen पर खोलें"}</a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PanelPage() {
  return <Suspense fallback={<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><PanelInner /></Suspense>;
}
