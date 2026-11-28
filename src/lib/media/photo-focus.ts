// Where the subject of a banner photo is, so the headline can sit on the empty side and the crop can keep the
// subject in view (owner's call, 3 Oct 2026: "face/subject detect karke headline ko us taraf rakho jahan photo
// khaali hai"). No AI call: sharp's attention crop finds the region of the picture with the most detail, skin
// tones and saturated colour — a face, a product, a shopfront — and reports its focal point.
// Server only (sharp).
import sharp from "sharp";
import { SITE_URL } from "@/lib/site-url";

export type PhotoFocus = {
  /** Focal point as CSS object-position: "62% 38%". */
  focus: string;
  /** Where the words should go: the side the subject leaves empty. "center" when the subject fills the middle. */
  textSide: "left" | "right" | "center";
};

/** The picture's focal point, or null when it cannot be read (not a URL, too slow, not an image). */
export async function bannerFocus(url: string | null | undefined): Promise<PhotoFocus | null> {
  if (!url) return null;
  const abs = url.startsWith("/") && !url.startsWith("//") ? `${SITE_URL}${url}` : url;
  if (!/^https?:\/\//i.test(abs)) return null;
  try {
    const r = await fetch(abs, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return focusOf(buf);
  } catch { return null; }
}

/** Same, from the bytes. Exported so it can be tested without a network. */
export async function focusOf(buf: Buffer): Promise<PhotoFocus | null> {
  try {
    const img = sharp(buf, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;
    if (w < 80 || h < 80) return null;
    // Crop a square of a bit over half the shorter side with the attention strategy: the crop lands on the
    // subject, and its focal point comes back in the picture's own pixels.
    const side = Math.max(32, Math.round(Math.min(w, h) * 0.55));
    const { info } = await img.resize(side, side, { fit: "cover", position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
    // sharp reports the point in the SCALED picture (the one it covered the square with), so undo the scale.
    const scale = side / Math.min(w, h);
    let fx: number, fy: number;
    if (typeof info.attentionX === "number" && typeof info.attentionY === "number") { fx = info.attentionX / scale; fy = info.attentionY / scale; }
    else if (typeof info.cropOffsetLeft === "number" && typeof info.cropOffsetTop === "number") { fx = (info.cropOffsetLeft + side / 2) / scale; fy = (info.cropOffsetTop + side / 2) / scale; }
    else return null;
    // A line-up on a plain background (a brand's five scooters on black, Vipin Thakkar 28 Nov 2026): attention picks the brightest
    // one at the edge and a narrow frame shows only that. When the plain ground trims off and what is left spans most of the
    // width, the middle of the line-up is the focus.
    const lineup = await sharp(buf, { failOn: "none" }).rotate().trim({ threshold: 30 }).toBuffer({ resolveWithObject: true }).then(({ info: t }) => {
      const left = -(t.trimOffsetLeft ?? 0), top = -(t.trimOffsetTop ?? 0);
      // A band across the picture: most of the width, at most three quarters of the height, at least twice as wide as tall.
      return t.width >= w * 0.7 && t.height <= h * 0.75 && t.width >= t.height * 2 ? { x: left + t.width / 2, y: top + t.height / 2 } : null;
    }).catch(() => null);
    if (lineup) { fx = lineup.x; fy = lineup.y; }
    const px = Math.max(0, Math.min(100, Math.round((fx / w) * 100)));
    const py = Math.max(0, Math.min(100, Math.round((fy / h) * 100)));
    // Subject on the left third → words go right; on the right third → words go left; in the middle → centre.
    const textSide: PhotoFocus["textSide"] = px < 42 ? "right" : px > 58 ? "left" : "center";
    return { focus: `${px}% ${py}%`, textSide };
  } catch { return null; }
}
