import "server-only";
// The ad picture in the shape the placement wants (owner, 1 Nov 2026: a poster must not go out cropped or letter-boxed in black).
// Feed and "automatic" get 1:1 (1080 × 1080), Stories / Reels get 9:16 (1080 × 1920). The picture is CONTAINED — nothing is cut —
// over a soft blurred copy of itself, so a tall poster in a square frame still looks finished. Returns JPEG bytes.
import sharp from "sharp";

export type AdRatio = "1:1" | "9:16";
const SIZE: Record<AdRatio, [number, number]> = { "1:1": [1080, 1080], "9:16": [1080, 1920] };
export const ratioFor = (placements: "auto" | "feeds" | "stories"): AdRatio => (placements === "stories" ? "9:16" : "1:1");

export async function fitAdImage(url: string, ratio: AdRatio): Promise<Buffer> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`image: could not read the picture (${r.status})`);
  const src = Buffer.from(await r.arrayBuffer());
  const [W, H] = SIZE[ratio];
  const meta = await sharp(src).metadata();
  const w = meta.width ?? 0, h = meta.height ?? 0;
  // Already the right shape (within 2%): only resize.
  if (w && h && Math.abs(w / h - W / H) < 0.02) return sharp(src).rotate().resize(W, H, { fit: "cover" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const back = await sharp(src).rotate().resize(W, H, { fit: "cover" }).blur(28).modulate({ brightness: 0.82, saturation: 1.1 }).toBuffer();
  const front = await sharp(src).rotate().resize(W, H, { fit: "inside", withoutEnlargement: false }).toBuffer();
  const fm = await sharp(front).metadata();
  return sharp(back)
    .composite([{ input: front, left: Math.round((W - (fm.width ?? W)) / 2), top: Math.round((H - (fm.height ?? H)) / 2) }])
    .jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
