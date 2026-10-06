"use client";
// The owner's add / remove controls on the website preview (docs/website-looks-v2.md §6): the Bento tiles on or
// off and in order, the home sections on or off and in order, dark or light, the clip or the photo on top. Every
// change is instant and local — only site.style / site.hero / site.home change, so no build runs and no credit
// is spent; Save / Make it live publishes what is on screen.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Moon, Sun } from "lucide-react";
import type { Card, SiteStyle } from "@/lib/types";
import { TILES, type TileKey } from "@/lib/site-blueprints";
import { bentoTiles } from "@/components/site-bento";
import { homeSections, sectionLabel } from "@/lib/site-home";
import { SITE_PALETTES } from "@/lib/site-style";

/** The palette's partner in the other tone (ivory ↔ cocoa, pearl ↔ midnight …); a brand colour gets ivory / pearl. */
export function otherTone(style: SiteStyle | undefined): SiteStyle {
  const s = style ?? {};
  const key = s.palette ?? "brand";
  const pal = SITE_PALETTES.find((p) => p.key === key);
  const warm = new Set(["saffron", "gold", "cocoa", "crimson", "rose", "ivory"]);
  const toLight = !pal || pal.tone === "dark";
  const next = toLight ? (warm.has(key) ? "ivory" : "pearl") : key === "ivory" ? "cocoa" : "midnight";
  const out: SiteStyle = { ...s, palette: next };
  delete out.color;
  return out;
}

/** What the `since` and `contact` tiles became on the premium board (docs/premium-look.md §3.3): the year folds into
 *  the trust row and the contact tile is the CTA row — the toggles still act, so their names say what they now do. */
const TILE_LABELS: Partial<Record<TileKey, { en: string; hi: string }>> = {
  since: { en: "Years in business (trust row)", hi: "कितने साल से (trust row में)" },
  contact: { en: "Call & WhatsApp buttons", hi: "Call और WhatsApp buttons" },
};
const tileLabel = (k: TileKey, hi: boolean) => { const o = TILE_LABELS[k]; const n = TILES.find((t) => t.key === k)!; return hi ? (o?.hi ?? n.hi) : (o?.en ?? n.name); };

const chip = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`;

export function LookTweaks({ card, onChange, hi, premium }: { card: Card; onChange: (next: Card) => void; hi: boolean; premium: boolean }) {
  const [open, setOpen] = useState(false);
  const T = (en: string, h: string) => (hi ? h : en);
  const style = card.site?.style ?? {};
  const bp = style.blueprint;
  const pal = SITE_PALETTES.find((p) => p.key === style.palette);
  const dark = !pal || pal.tone === "dark";
  const hasClip = card.pages.some((p) => p.blocks.some((b) => b.kind === "video" && /\.mp4(\?|$)/i.test(b.url)));
  const video = card.site?.hero?.video !== false;

  // Tiles: the ones the card can fill (bentoTiles reads the hero's order), every known one offered on or off.
  const canTiles = useMemo(() => {
    const probe = { ...card, site: { ...(card.site ?? { enabled: true }), hero: { ...(card.site?.hero ?? { headline: "", sub: "" }), tiles: TILES.map((t) => t.key) } } } as Card;
    const links = probe.links.filter((l) => l.value.trim());
    const facts = { rating: undefined, map: undefined, offer: undefined, product: undefined, booking: null };
    void facts;
    return bentoTiles({ card: probe, hi, t: (x) => x, photo: probe.coverUrl, phone: links.find((l) => l.type === "phone")?.value, wa: links.find((l) => l.type === "whatsapp")?.value, waHref: () => "#", hours: probe.pages.flatMap((p) => p.blocks).find((b) => b.kind === "hours")?.kind === "hours" ? [{ day: "x", time: "x" }] : undefined, rating: { avg: 5, count: 1 }, map: { address: "x", url: "#" }, offer: probe.pages.flatMap((p) => p.blocks).find((b): b is Extract<Card["pages"][number]["blocks"][number], { kind: "offer" }> => b.kind === "offer"), product: probe.pages.flatMap((p) => p.blocks).flatMap((b) => (b.kind === "product" ? b.items : []))[0], since: 1, booking: probe.pages.some((p) => p.blocks.some((b) => b.kind === "appointment")) ? { slug: "x" } : null, go: () => undefined, darkPage: false });
  }, [card, hi]);
  const tilesOn: TileKey[] = (card.site?.hero?.tiles?.length ? card.site.hero.tiles : canTiles) as TileKey[];
  const setTiles = (next: TileKey[]) => onChange({ ...card, site: { ...card.site!, hero: { ...(card.site?.hero ?? { headline: "", sub: "" }), tiles: next } } });

  // Sections: the home page's, in the order shown (hidden ones too), toggled and moved by key.
  const sections = useMemo(() => homeSections(card, card.pages.filter((p) => !p.hidden), { all: true }), [card]);
  const hidden = new Set(card.site?.home?.hidden ?? []);
  const setHome = (patch: { order?: string[]; hidden?: string[] }) => onChange({ ...card, site: { ...card.site!, home: { ...(card.site?.home ?? {}), ...patch } } });
  const move = (i: number, d: -1 | 1) => { const keys = sections.map((s) => s.key); const j = i + d; if (j < 0 || j >= keys.length) return; [keys[i], keys[j]] = [keys[j], keys[i]]; setHome({ order: keys }); };

  if (!card.site) return null;
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-semibold">
        {T("Adjust this look", "इस look को adjust करें")} <span className="text-xs font-normal text-muted">{T("tiles · sections · dark / light", "tiles · sections · dark / light")}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-3.5 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onChange({ ...card, site: { ...card.site!, style: otherTone(style) } })} className={chip(true)}>{dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {dark ? T("Light page", "हल्का page") : T("Dark page", "गहरा page")}</button>
            {hasClip && premium && <button type="button" onClick={() => onChange({ ...card, site: { ...card.site!, hero: { ...(card.site?.hero ?? { headline: "", sub: "" }), video: !video } } })} className={chip(video)}>{video ? T("Clip on top ✓", "ऊपर clip ✓") : T("Photo on top", "ऊपर photo")}</button>}
          </div>
          {bp === "bento" && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">{T("Tiles on the board", "Board की tiles")} <span className="font-normal">— {T("tap to hide or show; arrows to move", "छुपाने / दिखाने के लिए tap; हिलाने के लिए arrow")}</span></p>
              <ul className="space-y-1">
                {[...tilesOn, ...canTiles.filter((k) => !tilesOn.includes(k))].map((k, i) => {
                  const on = tilesOn.includes(k);
                  return (
                    <li key={k} className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setTiles(on ? tilesOn.filter((x) => x !== k) : [...tilesOn, k])} className={`${chip(on)} flex-1 justify-start`}>{on ? "✓ " : ""}{tileLabel(k, hi)}</button>
                      {on && <button type="button" disabled={i === 0} onClick={() => { const a = [...tilesOn]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setTiles(a); }} className="grid h-8 w-8 place-items-center rounded-lg border border-border disabled:opacity-30" aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></button>}
                      {on && <button type="button" disabled={i >= tilesOn.length - 1} onClick={() => { const a = [...tilesOn]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setTiles(a); }} className="grid h-8 w-8 place-items-center rounded-lg border border-border disabled:opacity-30" aria-label="Down"><ArrowDown className="h-3.5 w-3.5" /></button>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {bp !== "story" && sections.length > 1 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">{T("Home page sections", "Home page के sections")}</p>
              <ul className="space-y-1">
                {sections.map((s, i) => {
                  const on = !hidden.has(s.key);
                  return (
                    <li key={s.key} className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setHome({ hidden: on ? [...hidden, s.key] : [...hidden].filter((k) => k !== s.key) })} className={`${chip(on)} flex-1 justify-start truncate`}>{on ? "✓ " : ""}{sectionLabel(s, hi ? "hi" : "en")}</button>
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border disabled:opacity-30" aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={i >= sections.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border disabled:opacity-30" aria-label="Down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted">{T("Nothing is rebuilt and no credit is used; Save puts it live.", "कुछ दोबारा नहीं बनता, कोई credit नहीं लगता; Save से live हो जाता है।")}</p>
        </div>
      )}
    </div>
  );
}
