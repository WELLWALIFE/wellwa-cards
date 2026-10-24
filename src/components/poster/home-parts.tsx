"use client";
// The Home screen's parts (owner, 24 Oct 2026: "home page ko redesign karo — jo zaroori cheez honi chahiye wo add karo, professional
// interface"): the greeting with today's date and the card link, today's work in four numbers (from the CRM's Today), and the
// shortcuts as one tidy grid. Short words, big tap targets, one look with the rest of the app (rounded cards, soft shadow, gradient head).
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clapperboard, Copy, CreditCard, Flame, ImagePlus, Link2, MessageCircle, PhoneCall, Share2, Sparkles, UserPlus, Users, Check, ChevronRight, BellRing } from "lucide-react";
import { api } from "@/lib/poster-client";
import { fetchMyCards } from "@/lib/cloud";
import { SITE_HOST } from "@/lib/site-url";

type Counts = { due: number; unread: number; fresh: number; hot: number; calledToday: number; target: number };

function greeting(hi: boolean): string {
  const h = new Date(Date.now() + 5.5 * 3600e3).getUTCHours();
  if (h < 12) return hi ? "सुप्रभात" : "Good morning";
  if (h < 17) return hi ? "नमस्ते" : "Good afternoon";
  return hi ? "शुभ संध्या" : "Good evening";
}

/** Greeting, date and the card link with WhatsApp / Copy — the first thing on Home. */
export function HomeHeader({ name, hi }: { name: string; hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [link, setLink] = useState("");
  const [views, setViews] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetchMyCards().then((cards) => { const c = cards[0]; if (c) { setLink(`${SITE_HOST}/c/${c.username}`); setViews(typeof c.views === "number" ? c.views : null); } }).catch(() => undefined);
  }, []);
  const first = (name || "").trim().split(/\s+/)[0] || "";
  const date = new Date().toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const share = `https://wa.me/?text=${encodeURIComponent(`${T("Have a look at us:", "हमें यहाँ देखें:")} https://${link}`)}`;
  return (
    <section className="relative overflow-hidden rounded-3xl grad-brand p-5 text-white shadow-float">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative">
        <p className="text-xs font-semibold text-white/80">{date}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">{greeting(hi)}{first ? `, ${first}` : ""} 👋</h1>
        {link && (
          <div className="mt-3 rounded-2xl bg-white/15 p-2.5 ring-1 ring-white/25">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold">{link}</p>
              {views !== null && <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">👁 {views}</span>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href={share} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-sm font-bold text-[#128c4a]"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`https://${link}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is above to copy by hand */ } }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2 text-sm font-bold ring-1 ring-white/40">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? T("Copied", "Copy हो गया") : T("Copy link", "Link copy")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Today's work from the CRM: follow-ups, new chats, new leads, hot customers — and one button to start calling. */
export function TodayWork({ hi }: { hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [c, setC] = useState<Counts | null>(null);
  useEffect(() => { api<{ counts?: Counts }>("/api/crm/today").then((r) => { if (r.ok && r.data.counts) setC(r.data.counts); }).catch(() => undefined); }, []);
  const tiles = [
    { k: "due", n: c?.due, t: T("Follow-ups", "Follow-ups"), I: BellRing, cls: "bg-[#f59e0b]/12 text-[#d97706]" },
    { k: "unread", n: c?.unread, t: T("New messages", "नए messages"), I: MessageCircle, cls: "bg-[#22c55e]/12 text-[#16a34a]" },
    { k: "fresh", n: c?.fresh, t: T("New leads", "नए leads"), I: UserPlus, cls: "bg-[#2f5bf5]/12 text-[#2f5bf5]" },
    { k: "hot", n: c?.hot, t: T("Hot customers", "Hot ग्राहक"), I: Flame, cls: "bg-[#ef4444]/12 text-[#dc2626]" },
  ];
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <h2 className="text-base font-bold">{T("Today's work", "आज का काम")}</h2>
        <Link href="/poster/crm?s=today" className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-ink">{T("Open CRM", "CRM खोलें")} <ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="grid grid-cols-4 gap-1.5 px-3 pb-3 pt-2">
        {tiles.map((x) => (
          <Link key={x.k} href="/poster/crm?s=today" className="flex flex-col items-center gap-1 rounded-2xl bg-surface2/60 px-1 py-2.5 text-center transition active:scale-[.97]">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${x.cls}`}><x.I className="h-4.5 w-4.5" /></span>
            <span className="text-lg font-extrabold leading-none">{x.n ?? "–"}</span>
            <span className="text-[10px] font-semibold leading-tight text-muted">{x.t}</span>
          </Link>
        ))}
      </div>
      {!!c?.due && (
        <Link href="/poster/crm?s=today" className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-2xl grad-brand py-3 text-sm font-bold text-white">
          <PhoneCall className="h-4 w-4" /> {T(`Start the call list · ${c.due}`, `Call list शुरू करें · ${c.due}`)}
        </Link>
      )}
    </section>
  );
}

/** Every everyday door in one grid of eight. */
export function QuickGrid({ hi }: { hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const items = [
    { href: "/poster/site", t: T("Card & Website", "Card & Website"), I: CreditCard, cls: "from-[#2f5bf5] to-[#5b7cff]" },
    { href: "/poster/crm", t: T("Customers", "ग्राहक"), I: Users, cls: "from-[#16a34a] to-[#22c55e]" },
    { href: "/poster/calendar", t: T("Calendar", "Calendar"), I: CalendarDays, cls: "from-[#f59e0b] to-[#fbbf24]" },
    { href: "/poster/create", t: T("Create post", "Post बनाएँ"), I: ImagePlus, cls: "from-[#ec4899] to-[#f472b6]" },
    { href: "/poster/video", t: T("AI video", "AI video"), I: Clapperboard, cls: "from-[#8b3dff] to-[#c04ee8]" },
    { href: "/poster/share", t: T("Share links", "Share links"), I: Share2, cls: "from-[#0ea5e9] to-[#38bdf8]" },
    { href: "/poster/connect", t: T("Connect apps", "Apps जोड़ें"), I: Link2, cls: "from-[#64748b] to-[#94a3b8]" },
    { href: "/poster/plan", t: T("My plan", "मेरा plan"), I: Sparkles, cls: "from-[#12144a] to-[#3b3f8f]" },
  ];
  return (
    <section className="rounded-3xl border border-border bg-surface p-3 shadow-card">
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-3">
        {items.map((x) => (
          <Link key={x.href} href={x.href} className="flex flex-col items-center gap-1.5 text-center transition active:scale-[.96]">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm ${x.cls}`}><x.I className="h-5 w-5" /></span>
            <span className="text-[11px] font-semibold leading-tight">{x.t}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
