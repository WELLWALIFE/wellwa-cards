"use client";
// Every photo on the public card and website goes through here. The browser is handed a srcset of resized
// WebP copies from Next's image optimiser (/_next/image, sharp on our own server, cached on disk) instead of
// the 1600px JPEG the owner uploaded: a product thumbnail on a phone comes down at ~30 KB instead of ~400 KB.
//
// Only pictures we can resize safely are optimised: our own files (/art, /wellwa, /api/stock) and the
// Supabase storage bucket. A data: URL (preview before publish), an SVG or a picture hot-linked from an
// outside site is shown as it is — the optimiser would refuse an unknown host and the photo would vanish.
import { getImageProps } from "next/image";
import { preload } from "react-dom";

export type PicProps = {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /** Above the fold: load at once (default: lazy). */
  eager?: boolean;
  /** The hero picture — fetched first, before scripts and fonts. Implies eager. */
  priority?: boolean;
  /** How wide the picture is laid out, in CSS units, so the browser picks the right copy. Default 100vw. */
  sizes?: string;
  /** A fixed-size picture (avatar, logo, thumbnail): its CSS width in px — gets 1x and 2x copies only. */
  w?: number;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  "aria-hidden"?: boolean | "true" | "false";
  draggable?: boolean;
};

const SUPABASE_HOST = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return ""; }
})();

/** True when the optimiser is allowed to fetch and resize this picture (mirrors images.remotePatterns). */
export function optimizable(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    return u.hostname.endsWith(".supabase.co") || (!!SUPABASE_HOST && u.hostname === SUPABASE_HOST);
  } catch { return false; }
}

/** One resized copy of a picture (for canvas work), or the original when it cannot be optimised. */
export function picUrl(src: string, width: number): string {
  if (!optimizable(src) || src.split("?", 1)[0].endsWith(".svg")) return src;
  const { props } = getImageProps({ src, alt: "", width, height: width, quality: 75 });
  // The srcset's first entry is the 1x copy at this width.
  return props.srcSet?.split(",")[0]?.trim().split(" ")[0] || props.src;
}

export function Pic({ src, alt, className, style, eager, priority, sizes, w, onClick, draggable, ...rest }: PicProps) {
  const hidden = rest["aria-hidden"];
  const loading = eager || priority ? "eager" : "lazy";
  if (!optimizable(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} style={style} loading={loading} decoding="async" onClick={onClick} draggable={draggable} aria-hidden={hidden} />;
  }
  const { props } = getImageProps(
    w
      ? { src, alt, width: w, height: w, loading, priority, quality: 75 }
      : { src, alt, fill: true, sizes: sizes ?? "100vw", loading, priority, quality: 75 },
  );
  // The hero is announced in <head> before the body is parsed, so the browser asks for it first.
  if (priority && props.srcSet) preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
  // Only the picture data is taken from Next: the layout stays ours (the component's style and width/height
  // attributes would pin the picture to a box, and every caller already sizes it with classes).
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      style={style}
      loading={props.loading}
      decoding={props.decoding}
      fetchPriority={props.fetchPriority}
      sizes={props.sizes}
      srcSet={props.srcSet}
      src={props.src}
      onClick={onClick}
      draggable={draggable}
      aria-hidden={hidden}
    />
  );
}
