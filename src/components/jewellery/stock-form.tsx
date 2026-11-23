"use client";
// The piece's form (add and edit): item type, purity, weights, stone value, HUID, size, where it is kept, where it came from, and
// what it cost (owner only). Making / wastage come from the item type (Settings) unless "own making" is ticked for this piece.
import { useMemo, useState } from "react";
import { grams, mgOf, paiseOf, type JwSetup, type MakingKind } from "@/lib/jewellery";
import type { StockRow } from "@/lib/jewellery-stock";

export type StockDraft = {
  item_type: string; purity: string; descr: string; pieces: string; gross: string; stone: string; net: string; stoneRs: string;
  huid: string; size: string; counter: string; source: string; costRs: string; ownMaking: boolean; making: MakingKind; makingValue: string; wastage: string;
};
const r2 = (paise: number) => (paise ? String(paise / 100) : "");
const g3 = (mg: number) => (mg ? String(mg / 1000) : "");

export function draftOf(s: StockRow | null, setup: JwSetup, keep?: Partial<StockDraft>): StockDraft {
  const it = setup.items[0];
  const pur = setup.purities.find((p) => p.on && p.metal === "gold" && p.fine < 999) ?? setup.purities.find((p) => p.on);
  if (!s) return { item_type: it?.key ?? "", purity: pur?.key ?? "", descr: "", pieces: "1", gross: "", stone: "", net: "", stoneRs: "", huid: "", size: "", counter: "", source: "", costRs: "", ownMaking: false, making: "per_g", makingValue: "", wastage: "", ...keep };
  return {
    item_type: s.item_type, purity: s.purity, descr: s.descr, pieces: String(s.pieces || 1), gross: g3(s.gross_mg), stone: g3(s.stone_mg),
    net: s.net_mg !== s.gross_mg - s.stone_mg ? g3(s.net_mg) : "", stoneRs: r2(s.stone_paise), huid: s.huid, size: s.size, counter: s.counter, source: s.source,
    costRs: r2(s.cost_paise), ownMaking: !!s.making, making: s.making || "per_g",
    makingValue: s.making === "pct" ? String(s.making_value / 100) : r2(s.making_value), wastage: s.wastage_bp ? String(s.wastage_bp / 100) : "",
  };
}

/** The draft as the API takes it. */
export function bodyOf(d: StockDraft): Record<string, unknown> {
  const n = (v: string) => Number(String(v).replace(/,/g, "")) || 0;
  return {
    item_type: d.item_type, purity: d.purity, descr: d.descr, pieces: Math.max(1, Math.round(n(d.pieces)) || 1),
    gross_mg: mgOf(d.gross), stone_mg: mgOf(d.stone), net_mg: mgOf(d.net), stone_paise: paiseOf(d.stoneRs),
    huid: d.huid, size: d.size, counter: d.counter, source: d.source, cost_paise: paiseOf(d.costRs),
    making: d.ownMaking ? d.making : "", making_value: d.ownMaking ? (d.making === "pct" ? Math.round(n(d.makingValue) * 100) : paiseOf(d.makingValue)) : 0,
    wastage_bp: d.ownMaking ? Math.round(n(d.wastage) * 100) : 0,
  };
}

export function StockForm({ d, set, setup, owner, hi }: { d: StockDraft; set: (p: Partial<StockDraft>) => void; setup: JwSetup; owner: boolean; hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [more, setMore] = useState(!!(d.counter || d.source || d.costRs || d.ownMaking));
  const purities = useMemo(() => setup.purities.filter((p) => p.on), [setup]);
  const net = Math.max(0, mgOf(d.gross) - mgOf(d.stone));
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-brand";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const huidBad = d.huid.length > 0 && d.huid.replace(/[^A-Za-z0-9]/g, "").length !== 6;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {setup.items.map((it) => (
          <button key={it.key} type="button" onClick={() => set({ item_type: it.key })} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${d.item_type === it.key ? "border-brand bg-brand/10 text-brand-ink" : "border-border"}`}>{hi ? it.hi : it.en}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label><span className={lab}>{T("Purity", "Purity")}</span><select className={inp} value={d.purity} onChange={(e) => set({ purity: e.target.value })}>{purities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
        <label><span className={lab}>{T("Gross wt (g)", "कुल वज़न (g)")}</span><input className={inp} inputMode="decimal" value={d.gross} onChange={(e) => set({ gross: e.target.value })} placeholder="0.000" /></label>
        <label><span className={lab}>{T("Stone wt (g)", "नग वज़न (g)")}</span><input className={inp} inputMode="decimal" value={d.stone} onChange={(e) => set({ stone: e.target.value })} placeholder="0.000" /></label>
        <label><span className={lab}>{T("Net wt (g)", "शुद्ध वज़न (g)")}</span><input className={inp} inputMode="decimal" value={d.net} onChange={(e) => set({ net: e.target.value })} placeholder={grams(net).replace(" g", "")} /></label>
        <label><span className={lab}>{T("Stone ₹", "नग ₹")}</span><input className={inp} inputMode="decimal" value={d.stoneRs} onChange={(e) => set({ stoneRs: e.target.value })} /></label>
        <label><span className={lab}>HUID</span><input className={`${inp} ${huidBad ? "!border-danger" : ""}`} value={d.huid} maxLength={8} onChange={(e) => set({ huid: e.target.value.toUpperCase() })} placeholder="AB12CD" /></label>
        <label><span className={lab}>{T("Size", "साइज़")}</span><input className={inp} value={d.size} onChange={(e) => set({ size: e.target.value })} placeholder="14, 2.6" /></label>
        <label><span className={lab}>{T("Pieces", "नग")}</span><input className={inp} inputMode="numeric" value={d.pieces} onChange={(e) => set({ pieces: e.target.value })} /></label>
      </div>
      {huidBad && <p className="text-xs font-semibold text-danger">{T("HUID is 6 letters / digits (on the hallmark).", "HUID 6 अक्षर / अंक का होता है (हॉलमार्क पर)।")}</p>}
      <label className="block"><span className={lab}>{T("Description (optional)", "विवरण (optional)")}</span><input className={inp} value={d.descr} onChange={(e) => set({ descr: e.target.value })} placeholder={T("e.g. Ladies ring, ruby", "जैसे लेडीज़ अंगूठी, रूबी")} /></label>
      <button type="button" onClick={() => setMore(!more)} className="text-xs font-semibold text-brand-ink">{more ? "−" : "+"} {T("Where kept, from where, cost, own making", "कहाँ रखा, कहाँ से आया, लागत, अलग मेकिंग")}</button>
      {more && (
        <div className="space-y-2 rounded-xl border border-border p-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label><span className={lab}>{T("Kept at", "कहाँ रखा")}</span><input className={inp} value={d.counter} onChange={(e) => set({ counter: e.target.value })} placeholder={T("Counter 1, Locker", "काउंटर 1, लॉकर")} /></label>
            <label><span className={lab}>{T("Came from", "कहाँ से आया")}</span><input className={inp} value={d.source} onChange={(e) => set({ source: e.target.value })} placeholder={T("Karigar / supplier", "कारीगर / सप्लायर")} /></label>
            {owner && <label><span className={lab}>{T("Cost ₹ (only you see it)", "लागत ₹ (सिर्फ़ आप देखेंगे)")}</span><input className={inp} inputMode="decimal" value={d.costRs} onChange={(e) => set({ costRs: e.target.value })} /></label>}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={d.ownMaking} onChange={(e) => set({ ownMaking: e.target.checked })} className="h-4 w-4" /> {T("This piece has its own making (not the item type's)", "इस पीस की मेकिंग अलग है")}</label>
          {d.ownMaking && (
            <div className="grid grid-cols-3 gap-2">
              <label><span className={lab}>{T("Making", "मेकिंग")}</span><select className={inp} value={d.making} onChange={(e) => set({ making: e.target.value as MakingKind })}><option value="per_g">₹/g</option><option value="pct">%</option><option value="piece">₹/{T("piece", "पीस")}</option></select></label>
              <label><span className={lab}>{d.making === "pct" ? "%" : "₹"}</span><input className={inp} inputMode="decimal" value={d.makingValue} onChange={(e) => set({ makingValue: e.target.value })} /></label>
              <label><span className={lab}>{T("Wastage %", "वेस्टेज %")}</span><input className={inp} inputMode="decimal" value={d.wastage} onChange={(e) => set({ wastage: e.target.value })} /></label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
