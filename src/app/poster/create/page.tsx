"use client";
// Create — four doors, not fourteen links. Each door opens its choices on the next step (only where a choice exists).
import { useState } from "react";
import Link from "next/link";
import { Sparkles, Clapperboard, Palette, CreditCard, ChevronRight, ChevronLeft, CalendarDays, MessageSquareQuote, Camera, Wand2, Film, Share2, Gift, Link2, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { Guide } from "@/components/poster/guide";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";

type Item = { href: string; I: typeof Sparkles; t: string; s: string; tag?: string; paid?: boolean };
type Door = { key: string; I: typeof Sparkles; t: string; s: string; items: Item[]; /** open this page instead of listing the items */ href?: string };

export default function CreateHub() {
  const { lang } = useT(); const hi = lang !== "en";
  const { plan } = usePlan();
  const router = useRouter();
  const free = plan === "free";
  const [open, setOpen] = useState<string | null>(null);

  const doors: Door[] = [
    { key: "poster", I: Sparkles, t: hi ? "Poster & Status" : "Poster & Status", s: hi ? "Roz ka poster aur 15-sec video status — free" : "Daily poster and 15-sec video status — free", items: [
      { href: "/poster", I: Sparkles, t: hi ? "Aaj ka poster" : "Today's poster", s: hi ? "Roz apne-aap banta hai — dekhein, WhatsApp/Status par bhejein" : "Made automatically every day — view, send to WhatsApp / Status", tag: "FREE" },
      { href: "/poster/calendar", I: CalendarDays, t: hi ? "Mahine ka plan" : "Monthly plan", s: hi ? "Poore mahine ke posts ek baar me tay karein" : "Decide the whole month's posts in one go" },
      { href: "/poster/testimonials", I: MessageSquareQuote, t: hi ? "Customer reviews" : "Customer reviews", s: hi ? "Reviews maangein, poster banayein" : "Ask for reviews, turn them into posters" },
      { href: "/poster/social", I: Share2, t: hi ? "Social par auto-post" : "Auto-post to social", s: hi ? "Facebook, Instagram, Status — subah 4 baje apne-aap" : "Facebook, Instagram, Status — automatically at 4 AM", paid: true },
    ] },
    // The Video door opens the hub (/poster/videos): every kind with its length, credits and time, then the same 4 steps.
    { key: "video", I: Clapperboard, t: "Video", s: hi ? "Reel free · Video ad 20–120 credits · apne shabdon se · 5–10 min ka video" : "Reel free · Video ad 20–120 credits · your own words · 5–10 min video", href: "/poster/videos", items: [
      { href: "/poster/reel", I: Camera, t: "Reel / Status", s: hi ? "Stock clips + aapki photos + AI voice — free" : "Stock clips + your photos + AI voice — free", tag: "FREE" },
      { href: "/poster/video", I: Clapperboard, t: hi ? "Video ad" : "Video ad", s: hi ? "AI script likhega · 20–120 credits" : "AI writes the script · 20–120 credits", tag: "AI" },
      { href: "/poster/text-video", I: Wand2, t: hi ? "Apne shabdon se" : "From your own words", s: hi ? "10 sec se 10 min · 20 credits se" : "10 seconds to 10 minutes · from 20 credits" },
      { href: "/poster/explainer", I: Film, t: hi ? "Lamba video (5–10 min)" : "Long video (5–10 min)", s: hi ? "10 credits/min (min 20)" : "10 credits a minute (at least 20)" },
    ] },
    { key: "ads", I: Megaphone, t: hi ? "Ads" : "Ads", s: hi ? "Facebook / Instagram par paid ad — 5 steps, aapke ad account se" : "Paid Facebook / Instagram ads — 5 steps, from your own ad account", href: "/poster/ads", items: [] },
    // The logo studio (/poster/brand) is parked — owner's call, 22 Sep 2026: the results were not good enough to show. The page still works by URL.
    { key: "brand", I: Palette, t: "Brand", s: hi ? "Product photos aur mere products" : "Product photos and my products", items: [
      { href: "/poster/photoshoot", I: Camera, t: "Product photoshoot", s: hi ? "1 photo se 4 professional shots" : "1 photo → 4 professional shots", tag: "AI" },
      { href: "/poster/products", I: Gift, t: hi ? "Mere products" : "My products", s: hi ? "Jo posters aur website par dikhenge" : "What your posters and website show" },
    ] },
    { key: "card", I: CreditCard, href: "/poster/site", t: hi ? "Card & Website" : "Card & Website", s: hi ? "Ek link — computer par website, phone par card · share, edit, Premium" : "One link — website on computers, card on phones · share, edit, Premium", items: [] },
  ];

  const door = doors.find((d) => d.key === open);

  if (door) return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1 text-sm text-muted"><ChevronLeft className="h-4 w-4" /> {hi ? "Create" : "Create"}</button>
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
      <Guide hi="पाँच दरवाज़े — poster, video, ads, brand, card। रोज़ का poster अपने-आप बनता है; बाकी जब चाहें।" en="Five doors — poster, video, ads, brand, card. The daily poster makes itself; the rest whenever you like." />
      <div className="grid grid-cols-2 gap-3">
        {doors.map((d) => (
          <button key={d.key} type="button" onClick={() => (d.href ? router.push(d.href) : setOpen(d.key))} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-4 text-left">
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
          <span className="block text-[11px] leading-snug text-muted">{hi ? "WhatsApp AI, Facebook, Instagram, Google, apna domain — sab yahan jodein" : "WhatsApp AI, Facebook, Instagram, Google, own domain — connect them all here"}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted" />
      </Link>
    </div>
  );
}
