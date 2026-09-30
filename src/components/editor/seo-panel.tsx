"use client";

// Google settings for the card and website. Everything is filled in automatically from the card; the owner only adds
// the city, the areas they serve and their business type so the card shows up for "<type> in <city>" and
// "<type> near me". A live preview shows how the result looks on Google.
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/poster-client";
import type { Card } from "@/lib/types";
import { SITE_HOST } from "@/lib/site-url";
import { seoDescription, seoFacts, seoKeywords, seoTitle } from "@/lib/seo";

const input = "ed-input";
const csv = (v?: string[]) => (v ?? []).join(", ");
const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function SeoPanel({ card, onChange, address }: { card: Card; onChange: (p: Partial<Card>) => void; address?: string }) {
  const seo = card.seo ?? {};
  const set = (p: Partial<NonNullable<Card["seo"]>>) => onChange({ seo: { ...seo, ...p } });
  // Keep what the owner is typing (with its commas) and store the cleaned list.
  const [areas, setAreas] = useState(csv(seo.areas));
  const [keys, setKeys] = useState(csv(seo.keywords));
  // City, business type and areas come from the setup (owner's call, 28 Sep 2026: "we asked this when the card was
  // made"). Only a card made before that, or without a setup, is empty here — then they are filled from the setup once.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (filled || (seo.city && seo.category)) return;
    setFilled(true);
    api<{ setup?: { city?: string; categoryLabel?: string; category?: string; reach?: string }; facts?: { areas?: string } }>("/api/card/facts").then((r) => {
      const st = r.ok ? r.data.setup : undefined;
      if (!st) return;
      const list = String(r.data.facts?.areas ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const auto = list.length ? list : st.reach === "india" ? ["All India"] : st.reach === "online" ? ["Online", "Worldwide"] : [];
      const patch: Partial<NonNullable<Card["seo"]>> = {};
      if (!seo.city && st.city) patch.city = st.city;
      if (!seo.category && (st.categoryLabel || st.category)) patch.category = st.categoryLabel || st.category || "";
      if (!(seo.areas ?? []).length && auto.length) { patch.areas = auto; setAreas(auto.join(", ")); }
      if (Object.keys(patch).length) set(patch);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);
  const f = seoFacts(card);
  const title = seoTitle(card);
  const desc = seoDescription(card);
  const url = card.customDomain || address || `${SITE_HOST}/c/${card.username}`;
  const tips = [
    !f.city && "Add your city — it goes into your Google title.",
    !f.category && "Add your business type (e.g. Sweet shop, Dentist).",
    !f.areas.length && "Add the areas you serve, for “near me” searches around you.",
    !f.phone && "Add a phone or WhatsApp number in Links.",
    !f.address && "Add a Location block with your full address.",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint"><Search className="h-3.5 w-3.5" /> Google preview</p>
        <p className="mt-2 truncate text-xs text-muted">{url}</p>
        <p className="mt-0.5 text-[17px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8] line-clamp-1">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted line-clamp-2">{desc}</p>
      </div>

      <p className="text-xs text-muted">Google shows your card for searches like <b>“{f.category || "your business type"} in {f.city || "your city"}”</b>. These three come from your setup — change them only if they are wrong:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-muted">City
          <input className={input} value={seo.city ?? ""} placeholder={f.city || "e.g. Delhi"} onChange={(e) => set({ city: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold text-muted">Business type
          <input className={input} value={seo.category ?? ""} placeholder={card.jobTitle || "e.g. Sweet shop"} onChange={(e) => set({ category: e.target.value })} />
        </label>
      </div>
      <label className="block text-xs font-semibold text-muted">Areas you serve <span className="font-normal">(comma separated)</span>
        <input className={input} value={areas} placeholder="e.g. Karol Bagh, Lajpat Nagar, Rohini" onChange={(e) => { setAreas(e.target.value); set({ areas: toList(e.target.value) }); }} />
      </label>

      {/* Everything Google gets, made by itself from the card — the owner sees it is done, nothing to type. */}
      <div className="rounded-lg border border-border bg-surface2/50 p-3">
        <p className="text-xs font-semibold">Search words — added automatically ({seoKeywords(card).length})</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {seoKeywords(card).slice(0, 18).map((k) => <span key={k} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted border border-border">{k}</span>)}
          {seoKeywords(card).length > 18 && <span className="px-1 text-[11px] text-faint">+{seoKeywords(card).length - 18} more</span>}
        </div>
        <p className="mt-2 text-[11px] text-faint">Also done for you: page titles and descriptions, business data for Google (address, hours, areas, products, FAQ), a separate address for every page, and the sitemap.</p>
      </div>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">More options <span className="font-normal text-muted">(extra words, own title, Search Console)</span></summary>
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-semibold text-muted">Extra search words <span className="font-normal">(comma separated)</span>
            <input className={input} value={keys} placeholder="e.g. kaju katli, wedding sweets, gift boxes" onChange={(e) => { setKeys(e.target.value); set({ keywords: toList(e.target.value) }); }} />
          </label>
          <label className="block text-xs font-semibold text-muted">Title <span className="font-normal">({(card.seoTitle ?? "").length}/60)</span>
            <input className={input} value={card.seoTitle ?? ""} placeholder={title} onChange={(e) => onChange({ seoTitle: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-muted">Description <span className="font-normal">({(card.seoDescription ?? "").length}/160)</span>
            <textarea className={`${input} min-h-16 resize-y`} value={card.seoDescription ?? ""} placeholder={desc} onChange={(e) => onChange({ seoDescription: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-muted">Google Search Console code <span className="font-normal">(optional)</span>
            <input className={input} value={seo.googleVerify ?? ""} placeholder='The content="…" value from the HTML tag method' onChange={(e) => set({ googleVerify: e.target.value })} />
          </label>
        </div>
      </details>

      {tips.length > 0 && (
        <ul className="space-y-1 text-xs text-amber">
          {tips.map((t) => <li key={t}>• {t}</li>)}
        </ul>
      )}
      <p className="text-[11px] leading-relaxed text-faint">
        For “near me” results on Google Maps, also create a free Google Business Profile with the same name, address and phone, and add this link as its website (Connections → Google).
      </p>
    </div>
  );
}
