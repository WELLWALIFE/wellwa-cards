// Five looks for one website (owner's call, 4 Oct 2026: "5 looks bana do, default pehla; doosre par click kare to
// doosra; 5 dekh kar pehla achha lage to pehle par aa sake"). The first is the designer's own plan for this
// business; the other four are second, third, fourth and fifth opinions on the same content — a calm classic, a
// bold one, an elegant one, a fresh one — each built from the trade's own palette family so a sweet shop's "bold"
// is not a bank's. Applied on the spot: only site.style changes, the words, pictures and sections stay, so no
// build is run and nothing is paid for a look.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { Card, SiteStyle } from "@/lib/types";

export type LookKey = "designer" | "classic" | "bold" | "elegant" | "fresh";
export type Look = { key: LookKey; name: string; hi: string; blurb: string; blurbHi: string; style: SiteStyle };

const WARM = new Set(["saffron", "gold", "cocoa", "crimson", "rose", "ivory"]);
const COOL = new Set(["ocean", "teal", "emerald", "pearl", "midnight", "steel"]);
const pal = (s: SiteStyle | undefined) => s?.palette ?? "";

/** The five, for this card. `designer` is the look the build gave it (the designer's plan, after the review). */
export function fiveLooks(card: Pick<Card, "site">, designer: SiteStyle | undefined): Look[] {
  const d = designer ?? card.site?.style ?? {};
  const base = pal(d);
  const warm = WARM.has(base) || (base === "brand" && !!d.color && isWarm(d.color));
  const hi = d.font === "hindi";
  const font = (k: string) => (hi ? "hindi" : k);
  const classic: SiteStyle = { palette: warm ? "ivory" : "pearl", font: font("elegant"), hero: "split", radius: "soft", pattern: "none", motion: "calm" };
  const bold: SiteStyle = { palette: ["gold", "cocoa", "noir", "ivory"].includes(base) ? "noir" : COOL.has(base) ? "midnight" : ["rose", "crimson", "saffron"].includes(base) ? "crimson" : "steel", font: font("bold"), hero: "photo", radius: "sharp", pattern: "diagonal", motion: "lively" };
  const elegant: SiteStyle = { palette: warm ? "gold" : ["royal"].includes(base) ? "royal" : COOL.has(base) ? "ocean" : "cocoa", font: font("luxury"), hero: "editorial", radius: "round", pattern: "rings", motion: "calm" };
  const fresh: SiteStyle = { palette: ["teal", "emerald"].includes(base) ? "saffron" : ["saffron", "gold", "crimson"].includes(base) ? "teal" : ["royal", "rose"].includes(base) ? "emerald" : "royal", font: font("friendly"), hero: "stage", radius: "round", pattern: "blobs", motion: "lively" };
  // Four opinions that are really four: none repeats the designer's palette, and none repeats another's.
  const taken = new Set<string>([base]);
  const alt = ["pearl", "ivory", "midnight", "steel", "gold", "ocean", "teal", "royal", "emerald", "cocoa", "noir", "crimson"];
  for (const s of [classic, bold, elegant, fresh]) {
    if (taken.has(s.palette ?? "")) s.palette = alt.find((k) => !taken.has(k)) ?? s.palette;
    taken.add(s.palette ?? "");
  }
  return [
    { key: "designer", name: "Designer", hi: "Designer", blurb: "Made for your business", blurbHi: "आपके business के लिए बना", style: { ...d } },
    { key: "classic", name: "Classic", hi: "क्लासिक", blurb: "Calm, light, trusted", blurbHi: "शांत, हल्का, भरोसेमंद", style: classic },
    { key: "bold", name: "Bold", hi: "बोल्ड", blurb: "Dark, strong, confident", blurbHi: "गहरा, दमदार", style: bold },
    { key: "elegant", name: "Elegant", hi: "एलिगेंट", blurb: "Fine serif, premium", blurbHi: "नफ़ीस, premium", style: elegant },
    { key: "fresh", name: "Fresh", hi: "फ्रेश", blurb: "Bright, round, lively", blurbHi: "चमकीला, गोल, जीवंत", style: fresh },
  ];
}

/** The card wearing this look: only the website's style changes; words, pictures and pages stay. */
export function applyLook<T extends Pick<Card, "site">>(card: T, look: Look): T {
  if (!card.site) return card;
  return { ...card, site: { ...card.site, style: { ...look.style } } };
}

function isWarm(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(n)) return false;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r >= b && r + g > 2 * b;
}
