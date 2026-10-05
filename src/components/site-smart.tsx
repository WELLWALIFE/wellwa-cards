"use client";
// The website's shared "smart" pieces (docs/website-looks-v2.md §4): small, content-driven, on every blueprint and
// on older sites too. Each one shows nothing when the card lacks what it needs, and every animation is CSS on
// transform / opacity only and stops under prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { openNow, type HoursRow, type OpenState } from "@/lib/open-now";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- open now ---------- */

/** The shop's state right now, recomputed every minute; null while unknown or when the hours cannot be read. */
export function useOpenNow(rows: HoursRow[] | undefined): OpenState | null {
  const [state, setState] = useState<OpenState | null>(null);
  useEffect(() => {
    if (!rows?.length) { setState(null); return; }
    const tick = () => setState(openNow(rows));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [rows]);
  return state;
}

/** "● Open now · till 8 pm" / "● Closed · opens 10 am" as a chip; `tone` matches the surface it sits on. */
export function OpenNowChip({ rows, hi, tone = "light", className = "" }: { rows: HoursRow[] | undefined; hi: boolean; tone?: "light" | "dark" | "glass"; className?: string }) {
  const s = useOpenNow(rows);
  if (!s) return null;
  const open = s.state === "open";
  const dot = open ? "#22c55e" : "#f59e0b";
  const base = tone === "glass" ? "border-white/25 bg-white/10 backdrop-blur" : tone === "dark" ? "border-white/20 bg-white/10" : "border-border bg-surface";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${base} ${className}`} aria-live="polite">
      <span className="relative inline-flex h-2.5 w-2.5">
        {open && <span className="absolute inset-0 animate-ping rounded-full motion-reduce:hidden" style={{ background: dot, opacity: 0.6 }} />}
        <span className="relative inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
      </span>
      <span>{open ? (hi ? "अभी खुला है" : "Open now") : (hi ? "अभी बंद" : "Closed")}</span>
      <span className="opacity-70">· {hi ? s.noteHi : s.note}</span>
    </span>
  );
}

/* ---------- count-up ---------- */

/** "5000+" / "4.8★" / "Since 2015" counting up from zero the first time it scrolls into view; the text as is when
 *  it has no number, and at once under reduced motion. Never changes what the text says. */
export function CountUp({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = /^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/.exec(value);
  const target = m ? Number(m[2].replace(/,/g, "")) + Number(m[3] ?? 0) : null;
  const [shown, setShown] = useState<string>(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || target === null || !m || reduced() || !("IntersectionObserver" in window)) { setShown(value); return; }
    // A year ("Since 2015") is a label, not a quantity: counting from 0 to 2015 would look like a clock going wrong.
    if (target >= 1900 && target <= 2100 && !m[3] && !/[+★%]/.test(m[4])) { setShown(value); return; }
    const decimals = m[3] ? m[3].length - 1 : 0;
    const grouped = m[2].includes(",");
    setShown(`${m[1]}0${m[4]}`);
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1100;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        const n = target * e;
        const num = decimals ? n.toFixed(decimals) : (grouped ? Math.round(n).toLocaleString("en-IN") : String(Math.round(n)));
        setShown(`${m[1]}${num}${m[4]}`);
        if (p < 1) raf = requestAnimationFrame(step); else setShown(value);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={ref} className={className} style={style}>{shown}</span>;
}

/* ---------- marquee ---------- */

/** A slow, seamless strip of children (photos, reviews); pauses under a finger or the pointer; still under reduced
 *  motion. `speed` is seconds per loop. The track is doubled so the loop never shows a gap. */
export function Marquee({ children, speed = 40, className = "", gap = "gap-4" }: { children: React.ReactNode[]; speed?: number; className?: string; gap?: string }) {
  if (!children.length) return null;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)" }}>
      <div className={`site-marquee flex w-max ${gap} px-2`} style={{ animationDuration: `${speed}s` }}>
        {children}
        {children.map((c, i) => <span key={`dup-${i}`} aria-hidden="true" className="contents">{c}</span>)}
      </div>
    </div>
  );
}

/* ---------- bottom sheet ---------- */

/** A sheet rising from the bottom (phones) / a centred panel (desktop) over the page; Escape, the backdrop, the X
 *  and the browser's Back all close it (it pushes a history entry so Back does not leave the site). Page scroll
 *  is held while it is open. */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    document.body.setAttribute("data-sheet", "1");
    history.pushState({ sheet: 1 }, "");
    const onPop = () => closeRef.current();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { history.back(); } };
    window.addEventListener("popstate", onPop); window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev; document.body.removeAttribute("data-sheet");
      window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey);
      if (history.state?.sheet) history.back();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={() => history.back()} className="absolute inset-0 bg-black/55 backdrop-blur-[2px] site-fade" />
      <div className="site-sheet relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-float md:max-h-[88vh] md:w-[min(960px,92vw)] md:rounded-3xl">
        <div className="flex items-center justify-between gap-4 px-5 pt-3 pb-2 md:px-7 md:pt-5">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-border md:hidden" />
          {title ? <p className="mt-2 truncate text-[15px] font-semibold md:mt-0">{title}</p> : <span />}
          <button type="button" onClick={() => history.back()} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface hover:bg-surface2"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 md:px-7 md:pb-10" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>
  );
}

/** CSS for the pieces above (one string, put in the site's inline <style>). */
export const SMART_CSS = `
@keyframes site-sheet-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
@keyframes site-fade{from{opacity:0}to{opacity:1}}
@keyframes site-kb{from{transform:scale(1) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-1%)}}
.site-sheet{animation:site-sheet-up .32s cubic-bezier(.2,.8,.2,1)}
.site-fade{animation:site-fade .25s ease-out}
.site .kb{animation:site-kb 22s ease-in-out infinite alternate;will-change:transform}
.site.js [data-reveal]{opacity:0;transform:translateY(22px);filter:blur(6px);transition:opacity .75s cubic-bezier(.2,.7,.2,1),transform .75s cubic-bezier(.2,.7,.2,1),filter .6s ease-out;transition-delay:calc(var(--i,0)*70ms)}
.site.js [data-reveal].in{opacity:1;transform:none;filter:none}
body[data-sheet] .site-bar{transform:translateY(110%)}
.site-bar{transition:transform .25s ease}
@media (prefers-reduced-motion: reduce){.site-sheet,.site-fade,.site .kb{animation:none}.site.js [data-reveal]{opacity:1;transform:none;filter:none;transition:none}}
`;
