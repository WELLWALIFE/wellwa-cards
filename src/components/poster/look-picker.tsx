"use client";
// "Website ki pasand" — the look chosen BEFORE the build (owner's call, 2 Oct 2026): colour palette, font pair,
// hero layout and corners, with a small live preview. "Auto" on each is the trade's own default (site-recipes
// tradeStyle), so a jeweller still opens gold-and-serif without touching anything. The picks are saved in the
// card facts (facts.style) and the build applies them over the trade default (card-compose.ts).
import { useMemo } from "react";
import { Check } from "lucide-react";
import { SITE_PALETTES, FONT_PAIRS, HERO_LAYOUTS, RADII, paletteFor, fontsFor, fontHref, type SitePalette } from "@/lib/site-style";
import { tradeStyle } from "@/lib/site-recipes";
import { categoryOf } from "@/lib/poster-categories";
import { lookOf } from "@/lib/looks";
import type { SiteStyle } from "@/lib/types";

const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:bg-surface2"}`;

function Swatch({ p, on, onClick, label }: { p: SitePalette; on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} className="flex shrink-0 flex-col items-center gap-1.5">
      <span className={`grid h-11 w-11 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)] ${on ? "ring-brand" : "ring-transparent"}`} style={{ background: `linear-gradient(135deg, ${p.deep} 0%, ${p.mid} 55%, ${p.glow} 100%)` }}>
        {on && <Check className="h-4 w-4" style={{ color: p.ink }} />}
      </span>
      <span className="max-w-[56px] truncate text-[11px] text-muted">{label}</span>
    </button>
  );
}

export function LookPicker({ value, onChange, categoryKey, hi, business }: { value: SiteStyle; onChange: (s: SiteStyle) => void; categoryKey: string; hi: boolean; business?: string }) {
  const auto = useMemo(() => tradeStyle(categoryKey, hi ? "hi" : "en"), [categoryKey, hi]);
  const accent = categoryOf(categoryKey)?.accent ?? "#0e9e90";
  // What the website will actually wear: the pick, else the trade's default
  const effective: SiteStyle = { ...auto, ...value };
  const palette = paletteFor({ themeColor: accent, site: { enabled: true, style: effective } });
  const fonts = fontsFor(effective, lookOf("classic"));
  const href = fontHref([fonts.head, fonts.body]);
  const set = (patch: Partial<Record<keyof SiteStyle, string | undefined>>) => {
    const next: SiteStyle = { ...value };
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete next[k as keyof SiteStyle]; else (next as Record<string, string>)[k] = v; }
    onChange(next);
  };
  const autoLabel = hi ? "Auto" : "Auto";
  const radius = RADII.find((r) => r.key === effective.radius)?.r ?? "1rem";
  return (
    <div className="space-y-4">
      {href && <link rel="stylesheet" href={href} />}
      {/* preview: the hero as it will open */}
      <div className="overflow-hidden border border-border" style={{ borderRadius: radius, background: `radial-gradient(60% 80% at 85% 15%, ${palette.glow}88, transparent 62%), linear-gradient(120deg, ${palette.deep}, ${palette.mid})`, color: palette.ink }}>
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-[11px]" style={{ background: "rgba(255,255,255,.92)", color: "#111" }}>
          <span className="font-semibold" style={{ fontFamily: `'${fonts.head}', Inter, sans-serif` }}>{business || (hi ? "आपका business" : "Your business")}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: palette.mid }}>WhatsApp</span>
        </div>
        <div className="px-4 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.accent }}>{categoryOf(categoryKey)?.en ?? "Business"}</p>
          <p className="mt-1 text-[22px] leading-tight" style={{ fontFamily: `'${fonts.head}', Inter, sans-serif`, fontWeight: fonts.headWeight }}>{business || (hi ? "आपका business" : "Your business")}</p>
          <p className="mt-1 text-[12px] opacity-90" style={{ fontFamily: `'${fonts.body}', Inter, sans-serif` }}>{hi ? "ऐसा दिखेगा आपकी website का ऊपर का हिस्सा" : "This is how the top of your website will look"}</p>
          <span className="mt-3 inline-block px-3 py-1.5 text-[12px] font-semibold" style={{ borderRadius: `calc(${radius} * .8)`, background: "#fff", color: palette.deep }}>{hi ? "WhatsApp पर पूछें" : "Enquire on WhatsApp"}</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">{hi ? "रंग" : "Colours"}</p>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
          <Swatch p={paletteFor({ themeColor: accent, site: { enabled: true, style: auto } })} on={!value.palette} onClick={() => set({ palette: undefined })} label={autoLabel} />
          {SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => <Swatch key={p.key} p={p} on={value.palette === p.key} onClick={() => set({ palette: p.key })} label={hi ? p.hi : p.name} />)}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">{hi ? "Font" : "Fonts"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => set({ font: undefined })} className={chip(!value.font)}>{autoLabel}</button>
          {FONT_PAIRS.filter((f) => f.key !== "look").map((f) => <button key={f.key} type="button" onClick={() => set({ font: f.key })} className={chip(value.font === f.key)} title={f.blurb} style={{ fontFamily: `'${f.head}', Inter, sans-serif` }}>{hi ? f.hi : f.name}</button>)}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">{hi ? "ऊपर का layout (hero)" : "Top layout (hero)"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => set({ hero: undefined })} className={chip(!value.hero)}>{autoLabel}</button>
          {HERO_LAYOUTS.map((h) => <button key={h.key} type="button" onClick={() => set({ hero: h.key })} className={chip(value.hero === h.key)} title={h.blurb}>{hi ? h.hi : h.name}</button>)}
        </div>
        <p className="mt-1 text-[11px] text-muted">{value.hero ? HERO_LAYOUTS.find((h) => h.key === value.hero)?.blurb : (hi ? "Auto: product photo हो तो mosaic, आपकी photo हो तो portrait, banner हो तो photo।" : "Auto: a mosaic of product photos, your portrait, or the banner — whichever you have.")}</p>
      </div>
      <div>
        <p className="text-sm font-semibold">{hi ? "कोने" : "Corners"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => set({ radius: undefined })} className={chip(!value.radius)}>{autoLabel}</button>
          {RADII.map((r) => <button key={r.key} type="button" onClick={() => set({ radius: r.key })} className={chip(value.radius === r.key)}>{hi ? r.hi : r.name}</button>)}
        </div>
      </div>
    </div>
  );
}
