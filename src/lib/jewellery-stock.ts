// Shubhora Jewellery, phase 3 — stock by the piece: tag numbers, barcode labels, HUID (plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK).
// Pure functions (the app and the server both use them; tested in jewellery-stock.test.mjs). Units as in lib/jewellery.ts.
//
// A TAG is the item's code (two letters from the item type: RI ring, CH chain…) and the shop's running number, five digits:
// "RI00017". It is printed as a Code 128 barcode (every scanner reads it; it is drawn here, no library) on the piece's label.
// Billing a tag fills the bill line from the piece; the sale marks it sold, a cancelled bill puts it back.
import type { BillLine, JwSetup, MakingKind } from "@/lib/jewellery";

export type StockStatus = "in_stock" | "approval" | "sold" | "melted" | "returned";
export const STOCK_STATUSES: { key: StockStatus; en: string; hi: string }[] = [
  { key: "in_stock", en: "In stock", hi: "स्टॉक में" },
  { key: "approval", en: "Out on approval", hi: "पसंद के लिए बाहर" },
  { key: "sold", en: "Sold", hi: "बिक गया" },
  { key: "melted", en: "Melted / broken", hi: "गलाया / तोड़ा" },
  { key: "returned", en: "Returned to supplier", hi: "सप्लायर को वापस" },
];
/** Pieces that can still be billed. */
export const SELLABLE: StockStatus[] = ["in_stock", "approval"];

export type StockRow = {
  id: string; owner_id: string; seq: number; tag: string; status: StockStatus;
  item_type: string; descr: string; purity: string; pieces: number;
  gross_mg: number; stone_mg: number; net_mg: number; stone_paise: number;
  making: "" | MakingKind; making_value: number; wastage_bp: number;
  huid: string; size: string; counter: string; source: string; cost_paise: number;
  bill_id: string | null; sold_at: string | null; status_note: string; photo: string;
  created_by_name: string; created_at: string; updated_at: string;
};
export const STOCK_COLS = "id,owner_id,seq,tag,status,item_type,descr,purity,pieces,gross_mg,stone_mg,net_mg,stone_paise,making,making_value,wastage_bp,huid,size,counter,source,cost_paise,bill_id,sold_at,status_note,photo,created_by_name,created_at,updated_at";

const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Two letters for an item type: from its key ("ring" → RI), "XX" when there is none. */
export function tagPrefix(itemKey: string): string {
  const p = itemKey.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  return p.length === 2 ? p : (p + "XX").slice(0, 2);
}
export const tagCode = (itemKey: string, seq: number) => `${tagPrefix(itemKey)}${String(Math.max(1, seq)).padStart(5, "0")}`;
/** What a person or a scanner typed, as a tag: capitals and digits only. */
export const cleanTag = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

/** BIS HUID: 6 letters / digits. "" is allowed (the piece is not hallmarked yet). */
export const cleanHuid = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const validHuid = (h: string) => /^[A-Z0-9]{6}$/.test(h);

/** A photo link only from the app's own storage (uploaded in the app); "" otherwise. */
export function cleanPhotoUrl(v: unknown, storageBase: string): string {
  const u = typeof v === "string" ? v.trim() : "";
  const base = `${storageBase.replace(/\/$/, "")}/storage/v1/object/public/`;
  return u.startsWith(base) && u.length < 600 && !/[\s"'<>]/.test(u) ? u : "";
}

/** The app's fields for a piece, made safe (the server sets owner, tag, status). */
export function cleanStockFields(b: Record<string, unknown>, storageBase = "") {
  const making = b.making === "per_g" || b.making === "pct" || b.making === "piece" ? b.making : "";
  const grossMg = int(b.gross_mg, 0, 1e9, 0), stoneMg = int(b.stone_mg, 0, 1e9, 0);
  const netTyped = int(b.net_mg, 0, 1e9, 0);
  return {
    item_type: txt(b.item_type, 20), descr: txt(b.descr, 80), purity: txt(b.purity, 20), pieces: int(b.pieces, 1, 999, 1),
    gross_mg: grossMg, stone_mg: Math.min(stoneMg, grossMg), net_mg: netTyped > 0 ? Math.min(netTyped, grossMg) : Math.max(0, grossMg - stoneMg),
    stone_paise: int(b.stone_paise, 0, 1e11, 0), making: making as StockRow["making"], making_value: int(b.making_value, 0, 1e10, 0),
    wastage_bp: int(b.wastage_bp, 0, 5000, 0), huid: cleanHuid(b.huid), size: txt(b.size, 20), counter: txt(b.counter, 30),
    source: txt(b.source, 80), cost_paise: int(b.cost_paise, 0, 1e12, 0),
    photo: storageBase ? cleanPhotoUrl(b.photo, storageBase) : "",
  };
}

/** A bill line from a piece, at a rate (paise per gram). Making / wastage from the piece, else its item type. */
export function lineFromStock(s: StockRow, setup: Pick<JwSetup, "items">, rate: number): BillLine {
  const it = setup.items.find((i) => i.key === s.item_type);
  return {
    desc: s.descr || it?.en || "Item", itemType: s.item_type, purity: s.purity, pieces: s.pieces || 1,
    grossMg: s.gross_mg, stoneMg: s.stone_mg, netMg: s.net_mg, rate,
    wastageBp: s.making ? s.wastage_bp : (it?.wastageBp ?? s.wastage_bp), making: s.making || it?.making || "per_g",
    makingValue: s.making ? s.making_value : (it?.makingValue ?? 0), stonePaise: s.stone_paise, otherPaise: 0,
    huid: s.huid, hsn: it?.hsn ?? "7113", tag: s.tag,
  };
}

/** Stock in hand by purity: pieces, gross, net and fine weight. */
export function stockSummary(rows: Pick<StockRow, "status" | "purity" | "pieces" | "gross_mg" | "net_mg">[], setup: Pick<JwSetup, "purities">) {
  const by = new Map<string, { purity: string; label: string; pieces: number; gross: number; net: number; fine: number }>();
  for (const r of rows) {
    if (!SELLABLE.includes(r.status)) continue;
    const p = setup.purities.find((x) => x.key === r.purity);
    const row = by.get(r.purity) ?? { purity: r.purity, label: p?.label ?? (r.purity || "—"), pieces: 0, gross: 0, net: 0, fine: 0 };
    row.pieces += r.pieces || 1; row.gross += r.gross_mg; row.net += r.net_mg; row.fine += Math.round((r.net_mg * (p?.fine ?? 0)) / 1000);
    by.set(r.purity, row);
  }
  return [...by.values()].sort((a, b) => b.net - a.net);
}

/* ---------------- Code 128 (set B) ---------------- */

// Bar / space widths of every symbol (0–105) and the stop; each symbol is 11 modules wide, the stop 13.
const C128 = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");
export const C128_PATTERNS = C128;

/** The bar / space widths (in modules, bar first) of a Code 128-B barcode for printable ASCII text, start, check and stop included. */
export function code128(text: string): number[] {
  const vals = [...text].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error("code128: printable ASCII only");
    return c - 32;
  });
  const check = (104 + vals.reduce((a, v, i) => a + v * (i + 1), 0)) % 103;
  return [104, ...vals, check, 106].flatMap((v) => [...C128[v]].map(Number));
}

/* ---------------- the website catalogue (phase 6) ---------------- */

/** One piece as the public sees it: no cost, no counter, no who-added. fromPaise: the metal at today's rate (net × the purity's
 *  rate), rounded down to ₹10 — shown as "from ₹X" (making, stones and GST are added at the shop); 0 when there is no fresh rate. */
export type PublicPiece = { id: string; tag: string; type: string; name: string; purity: string; netMg: number; grossMg: number; huid: string; size: string; photo: string; fromPaise: number };
export function publicPieces(
  rows: Pick<StockRow, "id" | "tag" | "status" | "item_type" | "descr" | "purity" | "net_mg" | "gross_mg" | "huid" | "size" | "photo">[],
  setup: Pick<JwSetup, "items" | "purities">, rateOf: (purityKey: string) => number,
): PublicPiece[] {
  return rows.filter((r) => r.status === "in_stock").map((r) => {
    const it = setup.items.find((i) => i.key === r.item_type);
    const p = setup.purities.find((x) => x.key === r.purity);
    const rate = rateOf(r.purity);
    return {
      id: r.id, tag: r.tag, type: r.item_type, name: r.descr || it?.en || "Jewellery", purity: p?.label ?? r.purity,
      netMg: r.net_mg, grossMg: r.gross_mg, huid: r.huid, size: r.size, photo: r.photo ?? "",
      fromPaise: rate > 0 ? Math.floor((rate * r.net_mg) / 1000 / 1000) * 1000 : 0,
    };
  });
}
