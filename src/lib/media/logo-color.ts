// The business's own colour, read from its logo (owner's call, 3 Oct 2026: "ek-se-ek alag, unique brand"): the
// strongest saturated colour in the picture, as #rrggbb. Null when the logo cannot be read or is grey / white.
// Server only (sharp).
import sharp from "sharp";

export async function logoColor(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    // A small copy, flattened on white (a transparent logo's colour is in its ink, not its gaps).
    const { data, info } = await sharp(buf, { failOn: "none" }).flatten({ background: "#ffffff" }).resize(48, 48, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i + 2 < data.length; i += info.channels) {
      const r0 = data[i], g0 = data[i + 1], b0 = data[i + 2];
      const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
      const sat = max === 0 ? 0 : (max - min) / max, lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
      if (sat < 0.3 || lum > 0.92 || lum < 0.06) continue;   // greys, white, near-black: not a brand colour
      const key = `${r0 >> 5}-${g0 >> 5}-${b0 >> 5}`;
      const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bin.n++; bin.r += r0; bin.g += g0; bin.b += b0;
      bins.set(key, bin);
    }
    let best: { n: number; r: number; g: number; b: number } | null = null;
    for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin;
    if (!best || best.n < 12) return null;
    const hex = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, "0");
    return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
  } catch { return null; }
}
