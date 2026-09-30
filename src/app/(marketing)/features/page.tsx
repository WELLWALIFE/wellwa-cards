import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import Link from "next/link";
import {
  ArrowRight, BarChart3, Bot, CalendarDays, Clapperboard, Image as ImageIcon, Camera, CalendarClock, FileText, Globe, Languages,
  LayoutTemplate, MessageCircle, Monitor, Palette, QrCode, Search, ShieldCheck,
  Sparkles, Upload, UserRoundPlus, Users,
} from "lucide-react";

export const metadata: Metadata = pageMeta("/features", {
  title: "Features — Shubhora Business Suite",
  description: "Website and digital card, daily posters, social media auto-posting, WhatsApp AI assistant, lead CRM and AI ad and reel studio in one subscription.",
});

const groups = [
  { title: "Marketing on autopilot", accent: "var(--amber)", items: [
    { icon: ImageIcon, title: "A poster every morning", body: "Festivals, offers and good-morning wishes, designed with your logo, photo and number, in your language." },
    { icon: CalendarDays, title: "Social media plan", body: "A daily Story, 4 posts and 3 reels a week published to Facebook and Instagram for you." },
    { icon: Clapperboard, title: "Reel Maker and AI ads", body: "Turn a product into a voiced reel or a 15-second ad video, with scenes chosen to match your product." },
    { icon: Camera, title: "AI product photoshoot", body: "Studio-quality product photos from a few phone pictures, ready for posts, ads and your website." },
  ]},
  { title: "Create your mini website", items: [
    { icon: LayoutTemplate, title: "Multi-page cards", body: "Build Home, About, Products, Technology, Gallery, Testimonials, FAQ and Contact pages." },
    { icon: Upload, title: "Rich content blocks", body: "Show products, specifications, images, demonstration video, PDFs, offers, services and locations." },
    { icon: Palette, title: "Brand controls", body: "Choose templates, colors, fonts, cover images, profile styles and dark or light presentation." },
    { icon: Search, title: "SEO and sharing preview", body: "Set card title and description, with a unique public link for every profile." },
  ]},
  { title: "AI and conversations", accent: "var(--ai)", items: [
    { icon: Sparkles, title: "AI writing studio", body: "Draft card content, ad ideas, campaign material and a practical manual-posting calendar." },
    { icon: Bot, title: "On-card AI assistant", body: "Train the assistant on approved business facts so visitors can ask questions at any time." },
    { icon: MessageCircle, title: "Per-user WhatsApp", body: "Each signed-in user connects their own number and receives an isolated auto-reply session." },
    { icon: ShieldCheck, title: "Plan-aware access", body: "The digital V-Card is free for the first year; the website, daily posters, WhatsApp AI and auto-posting come with Growth." },
  ]},
  { title: "Capture and follow up", accent: "var(--good)", items: [
    { icon: UserRoundPlus, title: "Contact exchange", body: "Visitors can save your VCF details or submit their own details as a lead." },
    { icon: Users, title: "Lead CRM", body: "Keep enquiries, source, status and AI score together for practical follow-up." },
    { icon: CalendarClock, title: "Booking and enquiry", body: "Add consultation, demo, calendar or WhatsApp booking actions to any page." },
    { icon: BarChart3, title: "Analytics and pixels", body: "Track views, taps and sources; connect supported Meta, Google Ads and GA4 IDs." },
  ]},
  { title: "Share and scale", items: [
    { icon: QrCode, title: "QR and NFC-compatible link", body: "Generate a QR instantly or write the same public URL to a compatible NFC accessory." },
    { icon: Globe, title: "Custom domain", body: "Publish on your own approved domain with secure tenant-aware routing." },
    { icon: Languages, title: "Visitor translation", body: "Let visitors request the public card in a supported language." },
    { icon: Monitor, title: "Signature and meeting tools", body: "Generate an email signature and a branded video-meeting background with your QR." },
    { icon: FileText, title: "Agency and reseller mode", body: "Run Shubhora under your own brand for your clients, with activation and billing controls." },
  ]},
];

export default function FeaturesPage() {
  return <div>
    <section className="relative overflow-hidden hero-light border-y border-border"><div className="relative max-w-6xl mx-auto px-5 py-20 md:py-24"><span className="text-xs mono uppercase tracking-wide text-brand-ink">Shubhora Business Suite · features</span><h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance max-w-4xl">Everything your business needs online, in one login.</h1><p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">Your website and digital card, daily posters, social media, a WhatsApp AI assistant and a lead CRM, working together every day.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white">Start free <ArrowRight className="h-4 w-4" /></Link><Link href="/templates" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold">See sample cards</Link></div></div></section>
    <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 space-y-14">{groups.map((g) => <section key={g.title}><div className="flex items-center gap-3 mb-5"><span className="h-2 w-2 rounded-full" style={{ background: g.accent ?? "var(--brand)" }} /><h2 className="text-xl font-semibold">{g.title}</h2></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{g.items.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-border bg-surface p-5"><span className="grid h-10 w-10 place-items-center rounded-lg text-white" style={{ background: g.accent ?? "var(--brand)" }}><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-semibold text-sm">{title}</h3><p className="mt-2 text-sm text-muted leading-relaxed">{body}</p></article>)}</div></section>)}</div>
    <section className="border-t border-border bg-surface"><div className="max-w-4xl mx-auto px-5 py-16 text-center"><h2 className="text-3xl font-semibold tracking-tight">Pick a design. Make it yours.</h2><p className="mt-3 text-muted">Choose a ready structure, replace its content and publish a complete business mini-site.</p><Link href="/templates" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Explore templates <ArrowRight className="h-4 w-4" /></Link></div></section>
  </div>;
}
