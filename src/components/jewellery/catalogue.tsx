// The shop's stock on its website and V-Card (card.jewelCatalog, put on the card for each request): a few pieces with photo,
// weight, purity, HUID and the "from ₹" price at today's rate, each with "Ask on WhatsApp", and the link to all pieces (/jc/<username>).
import type { Card } from "@/lib/types";

const g3 = (mg: number) => (mg / 1000).toFixed(3);
const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
const ICON: Record<string, string> = { ring: "💍", chain: "📿", bangle: "⭕", necklace: "📿", mangalsutra: "📿", earring: "✨", pendant: "🔶", nose: "✨", payal: "〰️", coin: "🪙", silver: "🥈" };

export type CataloguePiece = NonNullable<Card["jewelCatalog"]>["items"][number];

export function waNumber(card: Pick<Card, "links">): string {
  const l = (card.links ?? []).find((x) => x.type === "whatsapp") ?? (card.links ?? []).find((x) => x.type === "phone");
  const d = String(l?.value ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}
export function askLink(wa: string, p: CataloguePiece, hi: boolean): string {
  const text = hi
    ? `नमस्ते, मुझे ये पीस देखना है: ${p.name} ${p.purity}, ${g3(p.netMg)} g (टैग ${p.tag})`
    : `Hello, I'd like to see this piece: ${p.name} ${p.purity}, ${g3(p.netMg)} g (tag ${p.tag})`;
  return wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : "";
}

export function PieceCard({ p, wa, hi, accent }: { p: CataloguePiece; wa: string; hi: boolean; accent: string }) {
  const ask = askLink(wa, p, hi);
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-white text-black" style={{ borderColor: `${accent}33` }}>
      <div className="relative aspect-square w-full" style={{ background: `${accent}10` }}>
        {p.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={p.photo} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
          : <span className="absolute inset-0 grid place-items-center text-4xl">{ICON[p.type] ?? "💎"}</span>}
        {p.huid && <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold">HUID</span>}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <p className="truncate text-[13px] font-semibold">{p.name}</p>
        <p className="text-[11px] opacity-70">{p.purity} · {g3(p.netMg)} g{p.size ? ` · ${p.size}` : ""}</p>
        {p.fromPaise > 0 && <p className="text-[13px] font-bold" style={{ color: accent }}>{hi ? `${money(p.fromPaise)} से शुरू` : `From ${money(p.fromPaise)}`}</p>}
        {ask && <a href={ask} target="_blank" rel="noreferrer" className="mt-auto rounded-lg py-1.5 text-center text-[11px] font-bold text-white" style={{ background: "#128C7E" }}>{hi ? "WhatsApp पर पूछें" : "Ask on WhatsApp"}</a>}
      </div>
    </div>
  );
}

/** The home section: up to 8 pieces (4 on the V-Card) and "See all N". */
export function CatalogueStrip({ card, hi, compact = false }: { card: Card; hi: boolean; compact?: boolean }) {
  const c = card.jewelCatalog;
  if (!c?.items?.length) return null;
  const accent = card.themeColor || "#B8860B";
  const wa = waNumber(card);
  const shown = c.items.slice(0, compact ? 4 : 8);
  return (
    <section aria-label={hi ? "हमारा कलेक्शन" : "Our collection"} className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <p className="text-base font-bold">{hi ? "हमारा कलेक्शन" : "Our collection"} <span className="text-xs font-normal opacity-70">· {c.count} {hi ? "पीस" : "pieces"}</span></p>
        <a href={`/jc/${encodeURIComponent(card.username)}`} className="text-xs font-semibold underline" style={{ color: accent }}>{hi ? "सब देखें →" : "See all →"}</a>
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>{shown.map((p) => <PieceCard key={p.id} p={p} wa={wa} hi={hi} accent={accent} />)}</div>
      <p className="text-[10px] opacity-60">{c.priced ? (hi ? "“से शुरू” = आज के रेट से धातु का दाम; मेकिंग, नग और GST अलग।" : "“From” = the metal at today's rate; making, stones and GST extra.") : (hi ? "दाम के लिए WhatsApp पर पूछें।" : "Ask on WhatsApp for the price.")}</p>
    </section>
  );
}
