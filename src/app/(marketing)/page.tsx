import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/", {
  title: "Shubhora — Software that runs your business online",
  description: "AI software, business automation, CRM, WhatsApp automation and the Shubhora Business Suite: website, digital card, daily posters, social posting and lead CRM in one login.",
});
import {
  ArrowRight, BadgeCheck, Bot, CalendarDays, Check, CheckCheck, Clapperboard, Globe,
  Image as ImageIcon, LayoutDashboard, Megaphone, MessageCircle, Mic, Play, Send, ShieldCheck,
  Smartphone, Sparkles, Star, UserRoundPlus, Workflow,
} from "lucide-react";
import { SERVICES } from "@/lib/services";
import { SAAS_PLANS, GST_PCT, rupees, FREE_PLAN_WORTH, FREE_PLAN_TRUST, FREE_PLAN_TERM, PRO_CUSTOM } from "@/lib/billing";

const SOLUTION_ICONS: Record<string, typeof Bot> = {
  "ai-software": Bot,
  "business-automation": Workflow,
  "crm-software": LayoutDashboard,
  "whatsapp-automation": MessageCircle,
  "web-mobile-apps": Smartphone,
  "social-media-management": Megaphone,
};

const day = [
  { time: "6:00 AM", icon: ImageIcon, title: "Today's poster is ready", body: "Designed with your logo, photo, phone number and the day's occasion." },
  { time: "7:00 AM", icon: Send, title: "Posted everywhere", body: "WhatsApp Status, Facebook, Instagram and a daily Story go out without you opening an app." },
  { time: "All day", icon: MessageCircle, title: "Every message answered", body: "The WhatsApp AI replies in your customer's language, sends photos and books the visit." },
  { time: "Evening", icon: UserRoundPlus, title: "Leads waiting in your CRM", body: "Every enquiry is saved with name, need and next follow-up, so nothing is forgotten." },
];

const modules = [
  { icon: Globe, title: "Website & digital card", body: "A multi-page business website and a shareable digital card on your own domain, with products, gallery, reviews and booking.", tint: "brand" },
  { icon: ImageIcon, title: "Daily posters", body: "A fresh, on-brand poster every morning for festivals, offers and good-morning wishes, in your language.", tint: "amber" },
  { icon: CalendarDays, title: "Social media on autopilot", body: "Daily Story, 4 posts and 3 reels a week on Facebook and Instagram, planned and published for you.", tint: "ai" },
  { icon: Bot, title: "WhatsApp AI assistant", body: "Answers customers 24/7 on your own number, understands voice notes and hands you the hot leads.", tint: "good" },
  { icon: LayoutDashboard, title: "Lead CRM", body: "Pipeline, reminders, follow-ups and broadcasts for every enquiry from your card, website, ads and WhatsApp.", tint: "brand" },
  { icon: Clapperboard, title: "AI Ad & Reel Studio", body: "Turn one product photo into studio photos, reels and a 15-second ad video with a natural voice-over.", tint: "ai" },
] as const;

const TINT: Record<string, string> = {
  brand: "bg-brand-soft text-brand-ink",
  amber: "bg-amber-soft text-amber",
  ai: "bg-ai-soft text-ai",
  good: "bg-[color-mix(in_srgb,var(--good)_14%,transparent)] text-good",
};

const languages = ["English", "हिन्दी", "मराठी", "ગુજરાતી", "ਪੰਜਾਬੀ", "বাংলা", "ଓଡ଼ିଆ", "తెలుగు", "ಕನ್ನಡ", "தமிழ்", "മലയാളം", "اردو"];

const industries = ["Retail shops", "Clinics & doctors", "Salons & spas", "Gyms & fitness", "Restaurants & cafés", "Real estate", "Coaching & education", "Consultants & agents"];

const faqs = [
  { q: "Do I need to know design or social media?", a: "No. Add your logo, photos and products once. Posters, posts and replies are prepared and published for you every day; you can review or edit anything." },
  { q: "Will the WhatsApp assistant work on my existing number?", a: "Yes. It connects to the number your customers already message, replies in their language and script, and hands you the conversations that need a person." },
  { q: "Which languages are supported?", a: "English, Hindi and ten more Indian languages, in their own scripts: posters, captions, AI replies and voice-overs." },
  { q: "Is the free plan really free?", a: "Yes. Your digital V-Card — all its pages, products and gallery, even on your own domain — and the leads it brings are free for the first year, with no card details and no hidden charge. After that the V-Card is ₹1,499 a year, and it is included in Growth. Take Growth whenever you want the website, daily posters, auto-posting and the WhatsApp AI." },
  { q: "Can you build custom software for my company?", a: "Yes. Beyond the Business Suite we build AI assistants, CRMs, automation and web or mobile apps around your workflow, scoped and priced before we start." },
];

/* ---------- product visuals (pure markup, crisp at any size) ---------- */

function PosterPhone() {
  return (
    <div className="relative w-[290px] rounded-[2.4rem] border border-white/15 bg-[#05061a] p-2.5 shadow-2xl">
      <div className="rounded-[2rem] overflow-hidden bg-[#0b0e2e]">
        <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[10px] text-white/60"><span>6:00</span><span className="h-4 w-16 rounded-full bg-black" /><span>5G</span></div>
        <div className="relative aspect-[4/5] mx-2 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg,#ffb35c 0%,#ff6a3d 42%,#c42d8f 100%)" }}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(60% 45% at 50% 38%, rgba(255,240,200,.75), transparent 70%)" }} />
          <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full" style={{ background: "radial-gradient(circle,#fff6d8 0%,#ffd27a 55%,transparent 72%)" }} />
          <div className="absolute inset-x-0 top-[48%] text-center px-4">
            <p className="text-[9px] tracking-[.25em] uppercase text-white/85">Good morning</p>
            <p className="mt-1 text-[22px] leading-tight font-bold text-white drop-shadow">शुभ प्रभात</p>
            <p className="mt-1 text-[10px] text-white/90">Fresh sweets, made every morning</p>
          </div>
          <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/95 px-3 py-2 flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-[#c42d8f] grid place-items-center text-[10px] font-bold text-white">SS</span>
            <div className="min-w-0"><p className="text-[10px] font-bold text-[#10124f] leading-tight">Sharma Sweets</p><p className="text-[8.5px] text-[#555a80] leading-tight">+91 98XXX XXX10 · Delhi</p></div>
          </div>
        </div>
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="flex-1 rounded-full bg-[#25D366] py-2 text-center text-[11px] font-semibold text-white">Share to Status</span>
          <span className="rounded-full bg-white/10 px-3 py-2 text-[11px] text-white/80">Edit</span>
        </div>
      </div>
    </div>
  );
}

function Toast({ icon: Icon, color, title, sub, className }: { icon: typeof Bot; color: string; title: string; sub: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-3 rounded-2xl border border-border bg-surface/95 backdrop-blur px-3.5 py-2.5 shadow-float ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: color }}><Icon className="h-4 w-4 text-white" /></span>
      <div><p className="text-[12px] font-semibold text-ink leading-tight">{title}</p><p className="text-[10.5px] text-muted leading-tight mt-0.5">{sub}</p></div>
    </div>
  );
}

export default function Home() {
  const growth = SAAS_PLANS.growth;
  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden hero-light border-b border-border">
        <div className="absolute inset-0 opacity-[.35]" style={{ backgroundImage: "linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(70% 60% at 50% 30%, #000 20%, transparent 75%)" }} />
        <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-16 md:pt-20 md:pb-24 grid lg:grid-cols-[1.1fr_.9fr] gap-12 items-center">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-card">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> AI software company · Made in India
            </span>
            <h1 className="mt-6 text-[2.5rem] md:text-[3.9rem] font-semibold tracking-tight leading-[1.04] text-balance text-ink">
              You think it. <span className="grad-text">We build it.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl leading-relaxed text-muted max-w-xl">
              Shubhora is an AI software company. Tell us what your business needs and we turn it into working software,
              or start today with the Shubhora Business Suite: website, posters, social media, WhatsApp AI and CRM in one login.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 transition-transform">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 py-3.5 text-sm font-semibold text-ink hover:bg-surface2 transition-colors">
                Discuss custom software
              </Link>
            </div>
            <div className="mt-10 grid sm:grid-cols-2 gap-3 max-w-xl">
              <Link href="/features" className="group rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-brand transition-colors">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><LayoutDashboard className="h-4 w-4 text-brand" /> Shubhora Business Suite</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">Website, daily posters, social posting, WhatsApp AI and CRM in one login.</p>
              </Link>
              <Link href="/solutions" className="group rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-brand transition-colors">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Workflow className="h-4 w-4 text-brand" /> Custom software</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">AI agents, automation, CRM, portals and mobile apps, built for your process.</p>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-brand" /> 1 year free, no card details needed</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" /> Your data stays yours</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="h-4 w-4 text-brand" /> 12 Indian languages</span>
            </div>
            <div className="lg:hidden mt-12 flex justify-center"><PosterPhone /></div>
          </div>

          <div className="relative hidden lg:flex justify-center h-[560px] animate-rise">
            <div className="absolute top-10 h-[420px] w-[420px] rounded-full blur-3xl opacity-25 grad-logo" />
            <div className="relative mt-6 animate-floaty"><PosterPhone /></div>
            <Toast icon={Send} color="#25D366" title="Posted to WhatsApp Status" sub="and Facebook, Instagram · 7:00 AM" className="left-0 top-16" />
            <Toast icon={UserRoundPlus} color="#2f5bf5" title="New lead: Priya M." sub="Wants 2 kg kaju katli · follow up 5 PM" className="-right-4 top-[46%]" />
            <Toast icon={Clapperboard} color="#d52fd6" title="Reel published" sub="Instagram · festive offer reel" className="left-4 bottom-10" />
          </div>
        </div>
      </section>

      {/* ---------------- Industries strip ---------------- */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-10">
          <p className="text-xs mono uppercase tracking-wider text-faint shrink-0">Made for</p>
          <div className="flex flex-wrap gap-x-7 gap-y-2 text-sm font-medium text-muted">
            {industries.map((i) => <span key={i}>{i}</span>)}
          </div>
        </div>
      </section>

      {/* ---------------- A day with Shubhora ---------------- */}
      <section className="bg-bg">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-ink">A normal day with Shubhora</p>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-balance">You run the business. Shubhora runs the online part.</h2>
          </div>
          <ol className="mt-12 grid md:grid-cols-4 gap-5 relative">
            <div aria-hidden className="hidden md:block absolute left-0 right-0 top-[22px] h-px bg-gradient-to-r from-brand-2 via-brand to-ai opacity-40" />
            {day.map(({ time, icon: Icon, title, body }) => (
              <li key={title} className="relative">
                <span className="relative z-10 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-brand-ink shadow-card">
                  <Icon className="h-3.5 w-3.5" /> {time}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Modules ---------------- */}
      <section className="border-y border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-brand-ink">Everything in one login</p>
              <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-balance">Six tools you would otherwise hire for.</h2>
            </div>
            <Link href="/features" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">See every feature <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map(({ icon: Icon, title, body, tint }) => (
              <article key={title} className="rounded-2xl border border-border bg-bg p-6 transition-all hover:-translate-y-1 hover:shadow-float">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${TINT[tint]}`}><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- WhatsApp AI ---------------- */}
      <section className="bg-bg">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/30 px-3 py-1.5 text-xs font-semibold text-[#128C7E]">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp AI assistant
            </span>
            <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-balance">Answers like your best salesperson. Day and night.</h2>
            <p className="mt-4 text-lg text-muted leading-relaxed">Not a menu bot. A trained assistant on your own number that knows your products and prices, and follows your way of selling.</p>
            <div className="mt-7 grid sm:grid-cols-2 gap-3">
              {[
                "Replies in the customer's language and script",
                "Sends product photos, videos and brochures",
                "Understands voice notes",
                "Types at human speed, with the typing indicator",
                "Books visits and demos step by step",
                "Polite follow-ups that stop when they reply",
              ].map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-muted leading-relaxed">
                  <Check className="h-4 w-4 text-[#25D366] shrink-0 mt-0.5" />{f}
                </div>
              ))}
            </div>
            <Link href="/solutions/whatsapp-automation" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:opacity-90">How it works <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-full blur-3xl opacity-20 bg-[#25D366]" />
            <div className="relative rounded-[2rem] border border-border bg-[#0b141a] p-3 shadow-float">
              <div className="rounded-[1.6rem] overflow-hidden">
                <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full bg-[#c42d8f] grid place-items-center text-white text-xs font-bold">SS</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white leading-tight">Sharma Sweets</p>
                    <p className="text-[11px] text-[#25D366] leading-tight">typing…</p>
                  </div>
                </div>
                <div className="bg-[#0b141a] p-3.5 space-y-2.5 text-[13px] leading-snug" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
                  <div className="flex justify-end"><div className="max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] text-white px-3 py-2">Kaju katli ka rate kya hai?</div></div>
                  <div className="flex justify-start"><div className="max-w-[85%] rounded-lg rounded-tl-sm bg-[#1f2c34] text-white/90 px-3 py-2">Kaju katli ₹1,100 per kg hai, aaj subah ki fresh 🙂 Kitna chahiye aapko?</div></div>
                  <div className="flex justify-end"><div className="max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] text-white px-3 py-2 flex items-center gap-2"><Mic className="h-4 w-4 text-white/80" /><span className="flex items-end gap-[2px]">{[6, 10, 14, 9, 12, 7, 11, 5, 9, 13, 8, 6].map((h, i) => <span key={i} className="w-[3px] rounded-full bg-white/70" style={{ height: h }} />)}</span><span className="text-[10px] text-white/60">0:05</span></div></div>
                  <div className="flex justify-start"><div className="max-w-[85%] rounded-lg rounded-tl-sm bg-[#1f2c34] text-white/90 px-3 py-2">Ji, 2 kg shaam 5 baje tak pack kar denge. Pickup karenge ya home delivery?</div></div>
                  <div className="flex justify-start"><div className="max-w-[85%] rounded-lg rounded-tl-sm bg-[#1f2c34] px-2 py-2"><div className="rounded-md h-24 w-52 grid place-items-center" style={{ background: "linear-gradient(135deg,#ffb35c,#c42d8f)" }}><span className="h-10 w-10 rounded-full bg-white/90 grid place-items-center"><Play className="h-5 w-5 text-[#0b141a] ml-0.5" /></span></div><p className="mt-1.5 px-1 text-[11px] text-white/60 flex items-center justify-between">Festive gift boxes · 0:32 <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" /></p></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Languages ---------------- */}
      <section className="relative overflow-hidden hero-light border-y border-border">
        <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-20 grid lg:grid-cols-[.8fr_1.2fr] gap-10 items-center">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Speaks your customer&apos;s language</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-balance">12 Indian languages, in their own script.</h2>
            <p className="mt-4 text-muted leading-relaxed">Posters, captions, WhatsApp replies and voice-overs, written the way your customers read.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {languages.map((l) => (
              <span key={l} className="rounded-xl border border-border bg-surface px-4 py-2.5 text-lg md:text-xl font-medium text-muted">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Pricing teaser ---------------- */}
      <section className="bg-bg">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid lg:grid-cols-[.8fr_1.2fr] gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Simple pricing</p>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-balance">Costs less than one part&#8209;time hire.</h2>
            <p className="mt-4 text-lg text-muted leading-relaxed">One monthly subscription replaces a designer, a social media manager and someone to answer WhatsApp. Start free and upgrade whenever you are ready.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white shadow-glow">Start free <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold hover:bg-surface2">Compare plans</Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-semibold text-lg">Free</h3>
              <p className="mt-1 text-sm text-muted">Your digital V-Card, free for 1 year</p>
              <p className="mt-4"><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700">Worth {rupees(FREE_PLAN_WORTH)}</span></p>
              <p className="mt-2"><span className="text-4xl font-semibold tracking-tight text-good">FREE</span></p>
              <p className="mt-1 text-xs text-faint">{FREE_PLAN_TRUST}</p>
              <p className="mt-0.5 text-[11px] text-faint">{FREE_PLAN_TERM}</p>
            </div>
            <div className="rounded-2xl border border-brand ring-1 ring-brand shadow-float bg-surface p-6">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-lg">{growth.label}</h3><span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">Most popular</span></div>
              <p className="mt-1 text-sm text-muted">{growth.tagline}</p>
              <p className="mt-5"><span className="text-4xl font-semibold tracking-tight tabular-nums">{rupees(growth.amount)}</span><span className="text-sm text-muted"> / month</span></p>
              <p className="mt-1 text-xs text-faint">Incl. {GST_PCT}% GST</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-semibold text-lg">{PRO_CUSTOM.label}</h3>
              <p className="mt-1 text-sm text-muted">{PRO_CUSTOM.tagline}</p>
              <p className="mt-5"><span className="text-4xl font-semibold tracking-tight">{PRO_CUSTOM.price}</span></p>
              <p className="mt-1 text-xs text-faint">Any software, customization or automation · <Link href="/pricing" className="underline">contact us</Link></p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Custom software ---------------- */}
      <section className="border-y border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-brand-ink">Shubhora for companies</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-balance">Need software built around your own workflow?</h2>
              <p className="mt-4 text-muted leading-relaxed">The same team builds custom AI assistants, CRMs, automation and apps, scoped and priced before we start.</p>
            </div>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-surface2">Discuss a project <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s) => {
              const Icon = SOLUTION_ICONS[s.slug] ?? Bot;
              return (
                <Link key={s.slug} href={`/solutions/${s.slug}`} className="group flex gap-4 rounded-2xl border border-border bg-bg p-5 hover:border-brand/40 transition-colors">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold flex items-center gap-1.5">{s.name}<ArrowRight className="h-3.5 w-3.5 text-faint transition-transform group-hover:translate-x-0.5" /></h3>
                    <p className="mt-1 text-sm text-muted leading-relaxed">{s.short}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="bg-bg">
        <div className="max-w-3xl mx-auto px-5 py-16 md:py-20">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) }} />
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Questions, answered</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-surface p-5">
                <summary className="cursor-pointer list-none font-medium flex items-center justify-between gap-4">{f.q}<ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90 shrink-0" /></summary>
                <p className="mt-3 text-sm text-muted leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="relative overflow-hidden hero-light border-y border-border">
        <div className="relative max-w-4xl mx-auto px-5 py-20 md:py-24 text-center">
          <div className="flex justify-center gap-1 text-[#ffb35c]">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-5 w-5" fill="currentColor" />)}</div>
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-balance">Tomorrow morning, your first poster could already be out.</h2>
          <p className="mt-4 text-muted text-lg">Set up your business in minutes. 1 year free, no card details needed.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-glow">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-ink hover:bg-surface">Talk to us</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
