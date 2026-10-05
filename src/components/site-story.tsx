"use client";
// The Story blueprint (docs/website-looks-v2.md §3.3): the website as full-screen slides, one thing per slide —
// cover, what we do, products, why us, photos, a review each, the offer, how to reach us — with progress dots
// on top, a tap on the right or a swipe to go on. On a computer the same slides run inside a phone frame beside
// the name, the key facts and the QR code. Slides the card lacks are never drawn.
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, MapPin, Star, Tag, Navigation, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Card, CardBlock, ProductItem, TestimonialItem } from "@/lib/types";
import { OpenNowChip } from "@/components/site-smart";
import { Pic as Img } from "@/components/pic";
import { trackClick } from "@/lib/track";
import { linkHref } from "@/components/link-icon";
import { safeMapUrl, splitGlyph } from "@/components/card-view";

type Slide =
  | { k: "cover"; photo?: string; clip?: { url: string; poster?: string } }
  | { k: "what"; title: string; lines: string[]; body?: string }
  | { k: "products"; title: string; items: ProductItem[]; more: number; page: string }
  | { k: "why"; title: string; items: string[] }
  | { k: "photos"; title: string; urls: string[]; page?: string }
  | { k: "review"; item: TestimonialItem; n: number; of: number }
  | { k: "offer"; block: Extract<CardBlock, { kind: "offer" }> }
  | { k: "contact" };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/** The slides this card can fill, in order. */
export function storySlides(card: Card, photo?: string, clip?: { url: string; poster?: string }): Slide[] {
  const pages = card.pages.filter((p) => !p.hidden);
  const blocks = pages.flatMap((p) => p.blocks);
  const pageOf = (kind: CardBlock["kind"]) => pages.find((p) => p.slug !== "home" && p.blocks.some((b) => b.kind === kind))?.slug ?? pages.find((p) => p.blocks.some((b) => b.kind === kind))?.slug ?? "home";
  const out: Slide[] = [{ k: "cover", photo, clip }];
  const about = blocks.find((b): b is Extract<CardBlock, { kind: "about" }> => b.kind === "about" && !!(b.body ?? "").trim());
  const services = blocks.find((b): b is Extract<CardBlock, { kind: "services" }> => b.kind === "services" && b.items.length > 0);
  const lines = (services?.items ?? []).map((x) => x.name).filter(Boolean).slice(0, 5);
  if (lines.length || about) out.push({ k: "what", title: services?.title || about?.title || "", lines, body: (about?.body ?? "").split(/\n+/)[0]?.slice(0, 220) });
  const products = blocks.flatMap((b) => (b.kind === "product" ? b.items : [])).filter((p) => (p.name ?? "").trim());
  if (products.length) out.push({ k: "products", title: blocks.find((b) => b.kind === "product")?.title ?? "", items: products.slice(0, 6), more: Math.max(0, products.length - 6), page: pageOf("product") });
  const why = blocks.find((b): b is Extract<CardBlock, { kind: "highlights" }> => b.kind === "highlights" && b.items.length >= 3);
  if (why) out.push({ k: "why", title: why.title, items: why.items.map((x) => splitGlyph(x ?? "").text || x).filter(Boolean).slice(0, 6) });
  const urls = [...new Set(blocks.flatMap((b) => (b.kind === "gallery" ? b.images.map((i) => i.url ?? "") : b.kind === "image" || b.kind === "carousel" ? b.images.map((i) => i.url) : [])).filter(Boolean))].filter((u) => u !== photo).slice(0, 4);
  if (urls.length >= 2) out.push({ k: "photos", title: blocks.find((b) => b.kind === "gallery")?.title ?? "", urls, page: pageOf("gallery") });
  const reviews = blocks.flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim()).slice(0, 3);
  reviews.forEach((item, i) => out.push({ k: "review", item, n: i + 1, of: reviews.length }));
  const offer = blocks.find((b): b is Extract<CardBlock, { kind: "offer" }> => b.kind === "offer" && !!(b.text ?? "").trim());
  if (offer) out.push({ k: "offer", block: offer });
  out.push({ k: "contact" });
  return out;
}

export function StoryView({ card, hi, t, qr, photo, clip, focus, phone, wa, waHref, hours, map, onProduct, go, eyebrow, logo }: {
  card: Card; hi: boolean; t: (s: string) => string; qr: string; photo?: string; clip?: { url: string; poster?: string }; focus?: string;
  phone?: string; wa?: string; waHref: (text?: string) => string; hours?: { day: string; time: string }[]; map?: { address: string; url: string };
  onProduct: (p: ProductItem) => void; go: (slug: string) => void; eyebrow?: string; logo?: string;
}) {
  const slides = storySlides(card, photo, clip);
  const name = card.site?.hero?.headline || card.company || card.name;
  const sub = card.site?.hero?.sub || card.tagline || "";
  const L = (en: string, h: string) => (hi ? h : t(en));

  const dark = "bg-[var(--p-deep)] text-[var(--p-ink)]";
  const Head = ({ eyebrow: e, title }: { eyebrow: string; title: string }) => (
    <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">{e}</p>{title && <h2 className="mt-2 text-[30px] leading-[1.05] tracking-tight" style={{ textWrap: "balance" }}>{t(title)}</h2>}</div>
  );

  const slide = (s: Slide, i: number) => {
    const base = "story-slide relative flex h-full w-full shrink-0 snap-start flex-col overflow-hidden";
    switch (s.k) {
      case "cover": return (
        <section key={i} className={`${base} ${dark} justify-end`}>
          {s.clip ? <video src={s.clip.url} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" /> : s.photo && <Img src={s.photo} alt="" className="absolute inset-0 h-full w-full object-cover kb" style={focus ? { objectPosition: focus } : undefined} priority sizes="100vw" />}
          <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,0) 35%, rgba(0,0,0,.2) 60%, color-mix(in srgb, var(--p-deep) 94%, transparent) 100%)" }} />
          <div className="relative p-6 pb-14">
            {logo && <Img src={logo} alt="" className="mb-4 h-14 w-14 rounded-2xl bg-white object-contain p-1" eager w={56} />}
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-85">{t(eyebrow)}</p>}
            <h1 className="mt-2 text-[40px] leading-[0.98] tracking-tight" style={{ textWrap: "balance" }}>{t(name)}</h1>
            {sub && <p className="mt-3 text-[16px] leading-relaxed opacity-90">{t(sub)}</p>}
            <div className="mt-5 flex flex-wrap gap-2">{hours && <OpenNowChip rows={hours} hi={hi} tone="glass" />}{card.seo?.city && <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm backdrop-blur"><MapPin className="h-3.5 w-3.5" /> {card.seo.city}</span>}</div>
            <p className="mt-8 text-[12px] opacity-60">{L("Swipe up ↑", "ऊपर swipe करें ↑")}</p>
          </div>
        </section>
      );
      case "what": return (
        <section key={i} className={`${base} justify-center p-7`} style={{ background: "var(--p-soft)" }}>
          <Head eyebrow={L("What we do", "हम क्या करते हैं")} title={s.title} />
          {s.lines.length > 0 && <ol className="mt-6 space-y-3">{s.lines.map((l, j) => <li key={j} className="flex items-baseline gap-3 text-[22px] leading-tight tracking-tight" style={{ fontFamily: "var(--look-head)" }}><span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--tc)" }}>0{j + 1}</span>{t(l)}</li>)}</ol>}
          {s.body && <p className="mt-6 text-[15px] leading-relaxed text-muted">{t(s.body)}</p>}
        </section>
      );
      case "products": return (
        <section key={i} className={`${base} justify-center py-7`}>
          <div className="px-7"><Head eyebrow={L("Products", "प्रोडक्ट")} title={s.title} /></div>
          <div className="story-rail mt-5 flex gap-3 overflow-x-auto px-7 pb-2" style={{ scrollSnapType: "x mandatory" }}>
            {s.items.map((p, j) => { const img = p.images?.[0] ?? p.imageUrl; return (
              <button key={j} type="button" onClick={() => onProduct(p)} className={`w-[66%] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-surface text-left ${FOCUS}`}>
                <div className="relative aspect-square" style={{ background: "var(--p-soft)" }}>{img ? <Img src={img} alt={p.name} className="absolute inset-0 h-full w-full object-contain p-5" sizes="70vw" /> : <span className="absolute inset-0 grid place-items-center text-5xl font-semibold" style={{ color: "var(--tc)" }}>{Array.from(p.name.trim())[0]?.toUpperCase()}</span>}</div>
                <div className="p-4"><p className="line-clamp-1 text-[15px] font-semibold">{t(p.name)}</p>{(p.price || p.mrp) && <p className="mt-0.5 font-semibold" style={{ color: "var(--tc)" }}>{p.price || p.mrp}</p>}</div>
              </button>
            ); })}
          </div>
          {s.more > 0 && <button type="button" onClick={() => go(s.page)} className="mx-7 mt-3 inline-flex items-center gap-1.5 self-start text-sm font-semibold" style={{ color: "var(--tc)" }}>{hi ? `सभी ${s.items.length + s.more} देखें` : `See all ${s.items.length + s.more}`} <ArrowRight className="h-4 w-4" /></button>}
        </section>
      );
      case "why": return (
        <section key={i} className={`${base} ${dark} justify-center p-7`}>
          <Head eyebrow={L("Why us", "हमें क्यों चुनें")} title={s.title} />
          <ul className="mt-6 space-y-3">{s.items.map((x, j) => <li key={j} className="flex items-start gap-3 text-[18px] leading-snug"><span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: "var(--p-accent)", color: "var(--p-deep)" }}>✓</span>{t(x)}</li>)}</ul>
        </section>
      );
      case "photos": return (
        <section key={i} className={`${base} justify-center p-5`}>
          <div className="px-2"><Head eyebrow={L("Photos", "फ़ोटो")} title={s.title} /></div>
          <div className="mt-4 grid grid-cols-2 gap-2">{s.urls.map((u, j) => <div key={j} className={`relative overflow-hidden rounded-2xl ${j === 0 && s.urls.length === 3 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}><Img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" sizes="50vw" /></div>)}</div>
          {s.page && <button type="button" onClick={() => go(s.page!)} className="mt-4 inline-flex items-center gap-1.5 self-start px-2 text-sm font-semibold" style={{ color: "var(--tc)" }}>{L("All photos", "सभी फ़ोटो")} <ArrowRight className="h-4 w-4" /></button>}
        </section>
      );
      case "review": return (
        <section key={i} className={`${base} justify-center p-7`} style={{ background: "var(--p-soft)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">{L("Reviews", "रिव्यू")} · {s.n}/{s.of}</p>
          <div className="mt-5 flex gap-0.5">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`h-5 w-5 ${k < Math.round(Number(s.item.rating) || 5) ? "fill-current" : "opacity-30"}`} style={{ color: "#f5b301" }} />)}</div>
          <blockquote className="mt-5 text-[24px] leading-snug tracking-tight" style={{ fontFamily: "var(--look-head)" }}>“{t(s.item.text)}”</blockquote>
          <p className="mt-5 text-[15px] font-semibold">— {s.item.name}</p>
        </section>
      );
      case "offer": return (
        <section key={i} className={`${base} justify-center p-7`} style={{ background: "var(--grad)", color: "var(--p-on)" }}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20"><Tag className="h-7 w-7" /></span>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-85">{t(s.block.title || "Offer")}</p>
          <p className="mt-2 text-[30px] leading-[1.05] tracking-tight" style={{ textWrap: "balance" }}>{t(s.block.text)}</p>
          {s.block.code && <p className="mt-4 text-[15px]">{L("Code", "Code")}: <b className="mono rounded-lg bg-white/20 px-2 py-0.5">{s.block.code}</b></p>}
          {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-offer-whatsapp")} className={`mt-8 inline-flex items-center gap-2 self-start rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-[var(--p-deep)] ${FOCUS}`}><MessageCircle className="h-4 w-4" /> {L("Claim on WhatsApp", "WhatsApp पर लें")}</a>}
        </section>
      );
      case "contact": return (
        <section key={i} className={`${base} ${dark} justify-center p-7`}>
          <Head eyebrow={L("Reach us", "संपर्क")} title={t(name)} />
          {map?.address && <p className="mt-4 flex items-start gap-2 text-[15px] opacity-90"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {t(map.address)}</p>}
          {hours && <div className="mt-4"><OpenNowChip rows={hours} hi={hi} tone="dark" /></div>}
          <div className="mt-7 grid gap-3">
            {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-story-whatsapp")} className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-semibold text-white ${FOCUS}`} style={{ background: "#25D366" }}><MessageCircle className="h-5 w-5" /> WhatsApp</a>}
            {phone && <a href={linkHref("phone", phone)} onClick={() => trackClick(card.username, "site-story-phone")} className={`flex items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[16px] font-semibold text-[var(--p-deep)] ${FOCUS}`}><Phone className="h-5 w-5" /> {L("Call now", "Call करें")}</a>}
            {map && <a href={map.url} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-story-map")} className={`flex items-center justify-center gap-2 rounded-2xl border border-white/30 py-4 text-[16px] font-semibold ${FOCUS}`}><Navigation className="h-5 w-5" /> {L("Directions", "रास्ता देखें")}</a>}
          </div>
          <p className="mt-6 text-[12px] opacity-60">Powered by Shubhora</p>
        </section>
      );
    }
  };

  const story = <StoryTrack count={slides.length} prev={L("Previous", "पिछला")} next={L("Next", "अगला")}>{slides.map(slide)}</StoryTrack>;

  return (
    <>
      {/* phone: the story is the page */}
      <div className="h-[100svh] md:hidden" style={{ height: "calc(100svh - var(--site-top, 0px))" }}>{story}</div>
      {/* computer: the story in a phone, beside the business */}
      <div className="hidden min-h-[100svh] items-center justify-center gap-14 px-8 py-12 md:flex" style={{ background: `radial-gradient(60% 80% at 70% 20%, color-mix(in srgb, var(--p-glow) 40%, transparent), transparent 60%), radial-gradient(50% 70% at 10% 90%, color-mix(in srgb, var(--p-mid) 45%, transparent), transparent 60%), var(--p-deep)`, color: "var(--p-ink)" }}>
        <div className="max-w-md">
          {logo && <Img src={logo} alt="" className="mb-6 h-16 w-16 rounded-2xl bg-white object-contain p-1" eager w={64} />}
          {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.2em] opacity-80">{t(eyebrow)}</p>}
          <h1 className="mt-3 text-[52px] leading-[0.98] tracking-tight" style={{ textWrap: "balance" }}>{t(name)}</h1>
          {sub && <p className="mt-5 text-[18px] leading-relaxed opacity-90">{t(sub)}</p>}
          <div className="mt-6 flex flex-wrap gap-2">{hours && <OpenNowChip rows={hours} hi={hi} tone="glass" />}{map?.address && <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm"><MapPin className="h-3.5 w-3.5" /> {t(map.address)}</span>}</div>
          <div className="mt-8 flex flex-wrap gap-3">
            {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-hero-whatsapp")} className={`inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-[var(--p-deep)] ${FOCUS}`}><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            {phone && <a href={linkHref("phone", phone)} onClick={() => trackClick(card.username, "site-hero-phone")} className={`inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3.5 text-[15px] font-semibold ${FOCUS}`}><Phone className="h-4 w-4" /> {L("Call", "Call करें")}</a>}
          </div>
          <div className="mt-10 flex items-center gap-4">
            {qr && <Img src={qr} alt="QR code" className="h-24 w-24 rounded-xl bg-white p-1.5" />}
            <div className="text-sm opacity-80"><p>{L("Scan to open on your phone", "Phone पर खोलने के लिए scan करें")}</p><p className="mt-2 flex items-center gap-2 text-xs opacity-70"><ChevronLeft className="h-3.5 w-3.5" /> <ChevronRight className="h-3.5 w-3.5" /> {L("arrow keys move the slides", "arrow keys से slides बदलें")}</p></div>
          </div>
        </div>
        <div className="relative h-[780px] w-[390px] shrink-0 overflow-hidden rounded-[44px] border-[10px] border-black bg-black shadow-[0_40px_90px_-30px_rgba(0,0,0,.7)]">
          <div aria-hidden="true" className="absolute left-1/2 top-2 z-40 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
          {story}
        </div>
      </div>
    </>
  );
}

/** The slides, their progress dots and the tap zones; each copy (phone / the frame on a computer) keeps its own place. */
function StoryTrack({ count, prev, next, children }: { count: number; prev: string; next: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const on = () => setAt(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  const jump = (i: number) => { const el = ref.current; if (!el) return; const n = Math.max(0, Math.min(count - 1, i)); el.scrollTo({ top: n * el.clientHeight, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  useEffect(() => {
    // Only the copy that is on screen answers the keys (the other is display:none).
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current || ref.current.offsetParent === null) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); jump(at + 1); } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); jump(at - 1); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, count]);
  return (
    <div className="story relative h-full w-full overflow-hidden bg-surface text-ink">
      {/* progress dots — white in "difference" blend, so they read on a light slide and a dark one alike */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-3" aria-hidden="true" style={{ mixBlendMode: "difference" }}>
        {Array.from({ length: count }).map((_, i) => <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"><span className="block h-full rounded-full bg-white transition-[width] duration-300" style={{ width: i <= at ? "100%" : "0%", opacity: i === at ? 1 : .85 }} /></span>)}
      </div>
      <p className="pointer-events-none absolute right-3 top-6 z-30 rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-white backdrop-blur">{at + 1}/{count}</p>
      {/* tap zones: the top half of a slide, left back / right on — the buttons and links live in the lower half */}
      <button type="button" aria-label={prev} onClick={() => jump(at - 1)} className="absolute left-0 top-0 z-20 h-[55%] w-[30%] cursor-w-resize opacity-0" />
      <button type="button" aria-label={next} onClick={() => jump(at + 1)} className="absolute right-0 top-0 z-20 h-[55%] w-[70%] cursor-e-resize opacity-0" />
      <div ref={ref} className="story-track h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "none" }}>
        {children}
      </div>
    </div>
  );
}

export const STORY_CSS = `
.site[data-story] header.site-head,.site[data-story] .site-bar{display:none}
.site[data-story] main{padding-bottom:0}
.story-track::-webkit-scrollbar,.story-rail::-webkit-scrollbar{display:none}
.story-slide{height:100%}
.story .kb{animation-duration:16s}
`;
