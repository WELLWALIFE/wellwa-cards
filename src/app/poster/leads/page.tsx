"use client";
// Leads + WhatsApp AI inside the phone shell — the dashboard components run
// as-is (cookie session, PlanProvider from the app layout).
import { ConnectConsent } from "@/components/poster/connect-consent";
import { Suspense, useEffect, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { CrmInbox } from "@/components/crm/crm";
import WhatsappPage from "@/app/(dashboard)/whatsapp/page";
import { isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { canGoBackInApp } from "@/lib/nav-back";
import { BackPill } from "@/components/poster/back-bar";
import LearnPage from "@/app/poster/learn/page";
import { Guide } from "@/components/poster/guide";
import { Bookings } from "@/components/poster/bookings";
import { CustomerTools } from "@/components/poster/customer-tools";
import { PhoneCalls } from "@/components/poster/phone-calls";

import { appPath } from "@/lib/poster-sections";

function LeadsTab() {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<"leads" | "wa" | "learn" | "bookings" | "phone">(() => {
    try { const q = new URLSearchParams(window.location.search).get("tab"); return q === "wa" || q === "learn" || q === "bookings" || q === "phone" ? q : "leads"; } catch { return "leads"; }
  });
  const [ready, setReady] = useState(false);
  // The tab in the address (Connections → WhatsApp opens ?tab=wa) must win, also after hydration and when only the
  // query changes on an already open page (seen live, 2 Oct 2026: ?tab=wa showed the CRM).
  const wantedTab = useSearchParams().get("tab");
  useEffect(() => { if (wantedTab === "wa" || wantedTab === "learn" || wantedTab === "leads" || wantedTab === "bookings" || wantedTab === "phone") setTab(wantedTab); }, [wantedTab]);
  // Leads is a bottom tab, so it has no Back row. But Connections → WhatsApp opens it at ?tab=wa from another screen: then Back must be there
  // (the phone app has no browser Back). The bottom Leads tab opens it with no ?tab=, and a push-notification link opens it fresh (no earlier screen): no Back row.
  const [cameFrom, setCameFrom] = useState(false);
  useEffect(() => { setCameFrom(!!wantedTab && canGoBackInApp()); }, [wantedTab]);
  // replace, not push: Back from the login screen must not land here and bounce straight back to it.
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/leads${window.location.search}`)}`); return; } setReady(true); })(); }, [router]);
  if (!ready) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="space-y-3">
      {cameFrom && <BackPill fallback="/poster/connect" className="-ml-1" />}
      <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-sm font-semibold">
        {(["leads", "bookings", "phone", "wa", "learn"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3 py-1.5 ${tab === k ? "grad-brand text-white" : "text-muted"}`}>{k === "leads" ? (t.tabMore === "मेरा" ? "ग्राहक" : "Customers") : k === "bookings" ? (t.tabMore === "मेरा" ? "बुकिंग" : "Bookings") : k === "phone" ? (t.tabMore === "मेरा" ? "फ़ोन" : "Phone") : k === "wa" ? t.waTab : (t.tabMore === "मेरा" ? "Bot सिखाएँ" : "Teach bot")}</button>
        ))}
      </div>
      {tab === "leads" && <Guide hi="हर customer की WhatsApp chat और follow-up यहाँ हैं। जो जल्दी खरीदना चाहते हैं, उन्हें पहले call करें। Reply AI लिख देता है।" en="Every customer's WhatsApp chat and follow-ups are here. Call the ones who are ready to buy first. The AI writes the replies for you." />}
      {tab === "wa" && <Link href="/poster/connect" className="block text-xs font-semibold text-brand-ink">🔗 {t.tabMore === "मेरा" ? "सारे connections (Facebook, Instagram, Google) →" : "All connections (Facebook, Instagram, Google) →"}</Link>}
      {tab === "wa" && <ConnectConsent kind="whatsapp" />}
      {tab === "wa" && <Guide hi="इसी phone पर code से WhatsApp link करें। दूसरे phone की ज़रूरत नहीं। फिर bot दिन-रात जवाब देगा। आप खुद जवाब दें तो bot 15 मिनट चुप रहता है।" en="Link your WhatsApp with a code on this same phone. No second phone is needed. Then the bot answers any time, day or night. If you reply yourself, the bot stays quiet for 15 minutes." />}
      {tab === "learn" && <LearnPage />}
      <div className="poster-embed" onClickCapture={(e: MouseEvent<HTMLDivElement>) => { const a = (e.target as HTMLElement).closest("a"); const to = a && a.target !== "_blank" ? appPath(a.getAttribute("href") ?? "") : null; if (to) { e.preventDefault(); router.push(to); } }}>{tab === "wa" ? <WhatsappPage /> : null}</div>
      {tab === "leads" && <CustomerTools />}
      {tab === "leads" && <CrmInbox />}
      {tab === "bookings" && <Bookings />}
      {tab === "phone" && <PhoneCalls />}
    </div>
  );
}

export default function LeadsPage() {
  return <Suspense fallback={<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><LeadsTab /></Suspense>;
}
