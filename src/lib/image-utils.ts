"use client";
// Client-side image compression — every photo picker in the app runs the
// file through this before it ever touches React state or the network.
// A modern phone photo is routinely 3–8 MB at 4000×3000px; holding several
// of those as base64 data URLs in memory (Ad Builder allows 5) makes the
// WebView itself sluggish long before any upload happens, and slows the
// upload/page-load too. Downscaling to a sane max dimension first keeps
// the UI snappy and the network payload small — the server still does its
// own final resize on save, this is purely a client-side pre-shrink.
export async function compressImageFile(file: File, maxDim = 1600, quality = 0.85, format: "jpeg" | "png" = "jpeg"): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      // Safari/older WebView fallback: decode via an <img> element instead.
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
        return img;
      } finally { URL.revokeObjectURL(url); }
    });
    const w = "width" in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    const h = "height" in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, cw, ch);
    if ("close" in bitmap) (bitmap as ImageBitmap).close();
    return format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
  } catch {
    // Compression failed for some reason (huge file, odd format) — fall back
    // to the original rather than losing the picture entirely.
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  }
}

/** A compressed data URL back into a File, for callers that upload via FormData. */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:(.*);base64/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** Compress a picked File and hand back a smaller File ready for upload. */
export async function compressToFile(file: File, filename: string, maxDim = 1600, quality = 0.85, format: "jpeg" | "png" = "jpeg"): Promise<File> {
  const url = await compressImageFile(file, maxDim, quality, format);
  return dataUrlToFile(url, filename);
}
