// One piece's label: the barcode with its tag, and the weights, purity and HUID — the two sizes jewellers print on.
//   • "tag": the barbell / dumbbell tag (about 95 × 12 mm) — the printed half carries the barcode, the other half the weights.
//   • "sticker": a 50 × 25 mm sticker (label printers and A4 sticker sheets).
import { Barcode } from "@/components/jewellery/barcode";
import type { StockRow } from "@/lib/jewellery-stock";

const g = (mg: number) => (mg / 1000).toFixed(3);

export type LabelSize = "tag" | "sticker";

export function StockLabel({ s, purity, shop, size }: { s: Pick<StockRow, "tag" | "gross_mg" | "net_mg" | "stone_mg" | "huid" | "size">; purity: string; shop: string; size: LabelSize }) {
  if (size === "tag") {
    return (
      <div className="jw-label jw-label-tag" style={{ width: "95mm", height: "12mm", display: "flex", fontFamily: "Arial, sans-serif", color: "#000", background: "#fff", overflow: "hidden", breakInside: "avoid" }}>
        <div style={{ width: "30mm", padding: "0.6mm 1mm", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Barcode value={s.tag} height={22} className="block h-[7mm] w-full" />
          <div style={{ fontSize: "6.5pt", fontWeight: 700, textAlign: "center", lineHeight: 1 }}>{s.tag}</div>
        </div>
        <div style={{ width: "30mm", padding: "0.6mm 1mm", fontSize: "6pt", lineHeight: 1.15, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div><b>{purity}</b>{s.size ? ` · ${s.size}` : ""}</div>
          <div>G {g(s.gross_mg)}{s.stone_mg ? ` · S ${g(s.stone_mg)}` : ""}</div>
          <div>N <b>{g(s.net_mg)}</b>{s.huid ? ` · ${s.huid}` : ""}</div>
        </div>
        {/* the tail of the barbell, threaded through the piece: left blank */}
        <div style={{ flex: 1 }} />
      </div>
    );
  }
  return (
    <div className="jw-label jw-label-sticker" style={{ width: "50mm", height: "25mm", padding: "1.2mm 1.6mm", fontFamily: "Arial, sans-serif", color: "#000", background: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", breakInside: "avoid" }}>
      <div style={{ fontSize: "6.5pt", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shop}</div>
      <Barcode value={s.tag} height={30} className="block h-[8mm] w-full" />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7pt", lineHeight: 1.15 }}>
        <span><b>{s.tag}</b><br />{purity}{s.size ? ` · ${s.size}` : ""}</span>
        <span style={{ textAlign: "right" }}>G {g(s.gross_mg)}{s.stone_mg ? ` S ${g(s.stone_mg)}` : ""}<br />N <b>{g(s.net_mg)}</b>{s.huid ? ` ${s.huid}` : ""}</span>
      </div>
    </div>
  );
}
