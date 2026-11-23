// A Code 128 barcode as SVG (lib/jewellery-stock.ts code128): crisp at any size, prints on any printer, read by any scanner.
import { code128 } from "@/lib/jewellery-stock";

export function Barcode({ value, height = 28, className = "" }: { value: string; height?: number; className?: string }) {
  let widths: number[] = [];
  try { widths = code128(value); } catch { return null; }
  const quiet = 10;
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  let x = quiet;
  const bars: { x: number; w: number }[] = [];
  widths.forEach((w, i) => { if (i % 2 === 0) bars.push({ x, w }); x += w; });
  return (
    <svg viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={`Barcode ${value}`} shapeRendering="crispEdges">
      <rect width={total} height={height} fill="#fff" />
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />)}
    </svg>
  );
}
