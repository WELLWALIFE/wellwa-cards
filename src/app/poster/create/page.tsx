"use client";
// Create — four doors, not fourteen links. Each door opens its choices on the next step (only where a choice exists).
import { Suspense } from "react";
import Link from "next/link";
import { LoaderCircle, Bot, Sparkles, Clapperboard, Palette, CreditCard, ChevronRight, ChevronLeft, CalendarDays, MessageSquareQuote, Camera, Wand2, Film, Share2, Gift, Link2, Megaphone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { goBack } from "@/lib/nav-back";
import { Guide } from "@/components/poster/guide";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";

type Item = { href: string; I: typeof Sparkles; t: string; s: string; tag?: string; paid?: boolean };
type Door = { key: string; I: typeof Sparkles; t: string; s: string; items: Item[]; /** open this page instead of listing the items */ href?: string };

// The open door lives in the address (/poster/create?door=brand), not in state: Back from a page opened inside a door
// (Product photoshoot, My products, Customer reviews...) must land on THAT door, not on the six-door list.
// The list opens a door with &from=hub. Photoshoot / Brand / Plan also push the bare door as their Back fallback (a link, a reload):
// there the previous screen is the very page that sent the owner here, so the door's own Back must not return to it.
function CreateHubInner() {
  const { lang } = useT(); const hi = lang !== "en";
  const { plan } = usePlan();
  const router = useRouter();
  const free = plan === "free";
  const params = useSearchParams();
  const open = params.get("door");
  const fromList = params.get("from") === "hub";

  const doors: Door[] = [
    { key: "poster", I: Sparkles, t: hi ? "Poster & Status" : "Poster & Status", s: hi ? "रोज़ का poster और 15 सेकंड का video status — free" : "A new poster every day and a 15-second video for Status — free", items: [
      { href: "/poster", I: Sparkles, t: hi ? "आज का poster" : "Today's poster", s: hi ? "रोज़ अपने-आप बनता है — देखें, WhatsApp या Status पर भेजें" : "Made for you every day. Look at it and send it on WhatsApp or Status", tag: "FREE" },
      { href: "/poster/calendar", I: CalendarDays, t: hi ? "महीने का plan" : "Plan for the month", s: hi ? "पूरे महीने के posts एक साथ तय करें" : "Choose the posts for the whole month at once" },
      { href: "/poster/testimonials", I: MessageSquareQuote, t: hi ? "ग्राहकों के reviews" : "Customer reviews", s: hi ? "Reviews माँगें और उनसे poster बनाएँ" : "Ask customers for reviews and make posters from them" },
      { href: "/poster/social", I: Share2, t: hi ? "अपने-आप post" : "Post by itself", s: hi ? "Facebook, Instagram, Status — रोज़ सुबह 4 बजे अपने-आप" : "Facebook, Instagram, Status — every morning at 4 AM, by itself", paid: true },
    ] },
    // The Video door opens the hub (/poster/videos): every kind with its length, credits and time, then the same 4 steps.
    { key: "video", I: Clapperboard, t: "Video", s: hi ? "Reel free · Video ad 20–120 credits · अपने शब्दों से · 5–10 मिनट का video" : "Reel free · Video ad 20–120 credits · from your own words · long video 5–10 minutes", href: "/poster/videos", items: [
      { href: "/poster/reel", I: Camera, t: "Reel / Status", s: hi ? "तैयार clips + आपकी photos + AI आवाज़ — free" : "Ready-made clips, your photos and an AI voice — free", tag: "FREE" },
      { href: "/poster/video", I: Clapperboard, t: hi ? "Video ad" : "Video ad", s: hi ? "AI शब्द लिखेगा, आप बदल सकते हैं · 20–120 credits" : "AI writes the words, you can change them · 20–120 credits", tag: "AI" },
      { href: "/poster/text-video", I: Wand2, t: hi ? "अपने शब्दों से" : "From your own words", s: hi ? "10 सेकंड से 10 मिनट तक · 20 credits से" : "10 seconds to 10 minutes · from 20 credits" },
      { href: "/poster/explainer", I: Film, t: hi ? "लंबा video (5–10 मिनट)" : "Long video (5–10 minutes)", s: hi ? "1 मिनट के 10 credits (कम से कम 20)" : "10 credits a minute (at least 20)" },
    ] },
    { key: "ads", I: Megaphone, t: hi ? "Ads" : "Ads", s: hi ? "Facebook / Instagram पर ad — 5 आसान कदम, आपके अपने ad account से" : "Ads on Facebook and Instagram — 5 easy steps, paid from your own ad account", href: "/poster/ads", items: [] },
    // The logo studio (/poster/brand) is parked — owner's call, 22 Sep 2026: the results were not good enough to show. The page still works by URL.
    { key: "brand", I: Palette, t: "Brand", s: hi ? "Product की photos और मेरे products" : "Product photos and my products", items: [
      { href: "/poster/photoshoot", I: Camera, t: "Product photoshoot", s: hi ? "1 photo से 4 अच्छी photos" : "1 photo becomes 4 good photos", tag: "AI" },
      { href: "/poster/products", I: Gift, t: hi ? "मेरे products" : "My products", s: hi ? "जो posters और website पर दिखेंगे" : "What shows on your posters and website" },
    ] },
    // AI Training: everything that teaches or drives the AI, in one place (owner, 14 Oct 2026).
    { key: "ai", I: Bot, t: "AI Training", s: hi ? "AI को सिखाएँ: अपनी website, files, WhatsApp के जवाब, और बोलकर website बदलें" : "Teach your AI about your business: website, files, WhatsApp replies. Change your website by speaking", href: "/poster/ai", items: [] },
    { key: "card", I: CreditCard, href: "/poster/site", t: hi ? "Card & Website" : "Card & Website", s: hi ? "एक link — computer पर website, phone पर card · share करें, बदलें, Premium" : "One link: a website on computers, a card on phones. Share it, change it, go Premium", items: [] },
  ];

  // Only a door that lists its own choices can be open; one that opens a page (Video, Ads, AI Training, Card) never is.
  const door = doors.find((d) => d.key === open && !d.href);

  if (door) return (
    <div className="space-y-3">
      <button type="button" onClick={() => (fromList ? goBack(router, "/poster/create") : router.replace("/poster/create"))} className="inline-flex items-center gap-1 text-sm text-muted"><ChevronLeft className="h-4 w-4" /> {hi ? "बनाएँ" : "Create"}</button>
      <h1 className="text-lg font-bold">{door.t}</h1>
      {door.items.map((x) => (
        <Link key={x.href} href={x.href} className="flex items-center gap-3 rounded-xl border border-border p-3">
          <span className="h-10 w-10 rounded-full bg-brand-soft text-brand grid place-items-center shrink-0"><x.I className="h-5 w-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold">{x.t}{x.tag ? <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${x.tag === "FREE" ? "bg-good/15 text-good" : "bg-surface2 text-muted"}`}>{x.tag}</span> : null}{x.paid && free ? <span className="ml-1.5 rounded-full bg-[#12144a] px-1.5 py-0.5 text-[10px] text-white">Growth</span> : null}</span>
            <span className="block text-xs text-muted">{x.s}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">{hi ? "बनाएँ" : "Create"}</h1>
      <Guide hi="छह चीज़ें बना सकते हैं — poster, video, ads, brand, AI training, card। रोज़ का poster अपने-आप बन जाता है। बाकी जब चाहें बनाएँ।" en="You can make six things: poster, video, ads, brand, AI training and card. Your daily poster makes itself. Make the rest whenever you like." />
      <div className="grid grid-cols-2 gap-3">
        {doors.map((d) => (
          <button key={d.key} type="button" onClick={() => router.push(d.href ?? `/poster/create?door=${d.key}&from=hub`)} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-4 text-left">
            <span className="h-11 w-11 rounded-full bg-brand-soft text-brand grid place-items-center"><d.I className="h-6 w-6" /></span>
            <span className="text-base font-bold leading-tight">{d.t}</span>
            <span className="text-[11px] leading-snug text-muted">{d.s}</span>
          </button>
        ))}
      </div>
      {/* Where things get posted: one place for every connection. */}
      <Link href="/poster/connect" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <span className="h-11 w-11 shrink-0 rounded-full bg-brand-soft text-brand grid place-items-center"><Link2 className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold leading-tight">{hi ? "Connections" : "Connections"}</span>
          <span className="block text-[11px] leading-snug text-muted">{hi ? "WhatsApp AI, Facebook, Instagram, Google, अपना web address — सब यहाँ जोड़ें" : "WhatsApp AI, Facebook, Instagram, Google and your own web address — connect them all here"}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted" />
      </Link>
    </div>
  );
}

export default function CreateHub() {
  return <Suspense fallback={<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><CreateHubInner /></Suspense>;
}
