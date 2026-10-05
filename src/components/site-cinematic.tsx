"use client";
// The Cinematic blueprint (docs/website-looks-v2.md §3.2): a full-screen photo or clip under a dark gradient with the
// headline rising from the bottom, a nav that only appears once the hero is scrolled, photo bands that move slower
// than the page between the sections (scenes), and one big review that fades to the next.
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, ChevronDown, Star } from "lucide-react";
import type { Card, TestimonialItem } from "@/lib/types";
import { OpenNowChip } from "@/components/site-smart";
import { Pic as Img, picUrl } from "@/components/pic";
import { trackClick } from "@/lib/track";
import { linkHref } from "@/components/link-icon";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

export function CinematicHero({ card, hi, t, photo, clip, focus, textSide, phone, wa, waHref, hours, eyebrow, pills }: {
  card: Card; hi: boolean; t: (s: string) => string; photo?: string; clip?: { url: string; poster?: string }; focus?: string; textSide?: "left" | "right" | "center";
  phone?: string; wa?: string; waHref: (text?: string) => string; hours?: { day: string; time: string }[]; eyebrow?: string; pills?: string[];
}) {
  const name = card.site?.hero?.headline || card.company || card.name;
  const sub = card.site?.hero?.sub || card.tagline || "";
  const right = textSide === "right", center = textSide === "center";
  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-[var(--p-deep)] text-white" aria-label={name}>
      {clip
        ? <video src={clip.url} poster={clip.poster ? picUrl(clip.poster, 1600) : undefined} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        : photo && <Img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover kb" style={focus ? { objectPosition: focus } : undefined} priority sizes="100vw" />}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,.25) 55%, color-mix(in srgb, var(--p-deep) 92%, transparent) 100%)" }} />
      <div className={`relative mx-auto w-full max-w-6xl px-6 pb-20 pt-32 md:pb-24 ${center ? "text-center" : ""}`}>
        <div className={`cin-rise ${center ? "mx-auto" : right ? "md:ml-auto" : ""} max-w-[720px]`}>
          {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.22em] opacity-85">{t(eyebrow)}</p>}
          <h1 className="mt-4 text-[48px] leading-[0.96] tracking-tight md:text-[88px]" style={{ textWrap: "balance" }}>{t(name)}</h1>
          {sub && <p className={`mt-6 max-w-[48ch] text-[17px] leading-relaxed opacity-90 md:text-[21px] ${center ? "mx-auto" : ""}`}>{t(sub)}</p>}
          <div className={`mt-9 flex flex-wrap items-center gap-3 ${center ? "justify-center" : ""}`}>
            {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-hero-whatsapp")} className={`inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-[var(--p-deep)] shadow-float transition hover:brightness-95 ${FOCUS}`}><MessageCircle className="h-4 w-4" /> {t(card.site?.hero?.ctaLabel || "WhatsApp")}</a>}
            {phone && <a href={linkHref("phone", phone)} onClick={() => trackClick(card.username, "site-hero-phone")} className={`inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-4 text-[15px] font-semibold backdrop-blur ${FOCUS}`}><Phone className="h-4 w-4" /> {hi ? "Call करें" : t("Call")}</a>}
            {hours && <OpenNowChip rows={hours} hi={hi} tone="glass" />}
          </div>
          {!!pills?.length && <ul className={`mt-7 flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>{pills.slice(0, 4).map((p, j) => <li key={j} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-medium backdrop-blur">{t(p)}</li>)}</ul>}
        </div>
      </div>
      <div aria-hidden="true" className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-70 cin-cue"><ChevronDown className="h-6 w-6" /></div>
    </section>
  );
}

/** A photo band between two scenes that moves at a third of the page's speed (transform only; still under reduced motion). */
export function ParallaxBand({ src, alt = "", caption }: { src: string; alt?: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const img = el.firstElementChild as HTMLElement | null; if (!img) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect(), vh = window.innerHeight || 800;
        if (r.bottom < 0 || r.top > vh) return;
        const d = (r.top + r.height / 2 - vh / 2) * -0.22;
        img.style.transform = `translate3d(0, ${d.toFixed(1)}px, 0) scale(1.25)`;
      });
    };
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} className="relative h-[46vh] min-h-[260px] overflow-hidden md:h-[58vh]" aria-hidden={!alt}>
      <Img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover will-change-transform" style={{ transform: "scale(1.25)" }} sizes="100vw" />
      {caption && <p className="absolute bottom-6 left-6 rounded-full bg-black/40 px-4 py-1.5 text-sm text-white backdrop-blur">{caption}</p>}
    </div>
  );
}

/** One big review at a time, fading to the next every few seconds; the dots pick one by hand. */
export function QuoteRotator({ items, t }: { items: TestimonialItem[]; t: (s: string) => string }) {
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    if (items.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { setFade(false); setTimeout(() => { setI((x) => (x + 1) % items.length); setFade(true); }, 350); }, 6000);
    return () => clearInterval(id);
  }, [items.length]);
  const r = items[i]; if (!r) return null;
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="flex justify-center gap-0.5">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`h-5 w-5 ${k < Math.round(Number(r.rating) || 5) ? "fill-current" : "opacity-30"}`} style={{ color: "#f5b301" }} />)}</div>
      <blockquote className="mt-6 text-[24px] leading-snug tracking-tight transition-opacity duration-300 md:text-[34px]" style={{ fontFamily: "var(--look-head)", opacity: fade ? 1 : 0 }}>“{t(r.text)}”</blockquote>
      <p className="mt-6 text-[15px] font-semibold opacity-80">— {r.name}</p>
      {items.length > 1 && <div className="mt-6 flex justify-center gap-2">{items.map((_, k) => <button key={k} type="button" aria-label={`Review ${k + 1}`} onClick={() => setI(k)} className="h-2 rounded-full transition-all" style={{ width: k === i ? 22 : 8, background: "currentColor", opacity: k === i ? 1 : .35 }} />)}</div>}
    </div>
  );
}

export const CINEMATIC_CSS = `
@keyframes cin-rise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes cin-cue{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}
.site[data-bp="cinematic"] .cin-rise{animation:cin-rise 1s cubic-bezier(.2,.7,.2,1) both}
.site[data-bp="cinematic"] .cin-cue{animation:cin-cue 1.8s ease-in-out infinite}
.site[data-bp="cinematic"] header.site-head{position:fixed;left:0;right:0;top:0;transform:translateY(-100%);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.site[data-bp="cinematic"] header.site-head.scrolled{transform:none}
.site[data-bp="cinematic"] main section h2{font-size:clamp(32px,4.2vw,52px);letter-spacing:-.02em}
.site[data-bp="cinematic"] .site-rail{display:flex;gap:1.25rem;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 1.5rem 1rem;margin:0 -1.5rem;scrollbar-width:none}
.site[data-bp="cinematic"] .site-rail::-webkit-scrollbar{display:none}
.site[data-bp="cinematic"] .site-rail>*{flex:0 0 78vw;max-width:360px;scroll-snap-align:start}
@media (min-width:768px){.site[data-bp="cinematic"] .site-rail>*{flex-basis:340px}}
@media (prefers-reduced-motion: reduce){.site[data-bp="cinematic"] .cin-rise,.site[data-bp="cinematic"] .cin-cue{animation:none}}
`;
