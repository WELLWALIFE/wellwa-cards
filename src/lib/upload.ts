// Client-side image handling: downscale to keep data URLs small enough
// for localStorage. Real cloud uploads (Supabase storage) come in Phase 2.

export async function fileToDataUrl(
  file: File,
  maxDim = 1000,
  quality = 0.82,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // downscale via canvas
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(type, quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
