"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, ZoomIn, Maximize2, Crop } from "lucide-react";

/**
 * Crop + zoom modal (no external library).
 *
 * Zoom starts at FIT — the whole picture is visible and nothing is cropped
 * unless the user chooses to zoom in. (An earlier version clamped the minimum
 * to "fill the frame", so tall product shots were always cut off with no way
 * to zoom out.) Drag to reposition, then the visible frame is rendered to a
 * canvas and returned as a compressed data URL.
 */
export function ImageCropper({
  src, aspect = 1, outWidth = 800, round = false, format = "jpeg", onApply, onCancel,
}: {
  /** "png" keeps transparency (logos); "jpeg" puts white behind (photos). */
  format?: "jpeg" | "png";
  src: string;
  aspect?: number;
  outWidth?: number;
  round?: boolean;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const VW = 280;
  const VH = Math.round(VW / aspect);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);          // 1 = whole image fits
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // fit = entire image visible · fill = covers the frame (crops the overflow)
  const fitScale = nat.w ? Math.min(VW / nat.w, VH / nat.h) : 1;
  const fillZoom = nat.w ? Math.max(VW / nat.w, VH / nat.h) / fitScale : 1;
  const scale = fitScale * zoom;
  const dw = nat.w * scale;
  const dh = nat.h * scale;

  // Keep the image sensible: centred when smaller than the frame, inside the
  // edges when larger (so you can't drag it out of view).
  const clamp = (x: number, y: number) => ({
    x: dw <= VW ? (VW - dw) / 2 : Math.min(0, Math.max(VW - dw, x)),
    y: dh <= VH ? (VH - dh) / 2 : Math.min(0, Math.max(VH - dh, y)),
  });

  useEffect(() => { setOff((o) => clamp(o.x, o.y)); /* eslint-disable-next-line */ }, [zoom, nat]);

  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOff(clamp(
      drag.current.ox + (e.clientX - drag.current.x),
      drag.current.oy + (e.clientY - drag.current.y),
    ));
  }
  function onUp() { drag.current = null; }

  function setPreset(mode: "fit" | "fill") {
    const z = mode === "fit" ? 1 : fillZoom;
    setZoom(z);
    const s = fitScale * z;
    setOff({ x: (VW - nat.w * s) / 2, y: (VH - nat.h * s) / 2 });
  }

  function apply() {
    const img = imgRef.current;
    if (!img) return;
    const outH = Math.round(outWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outWidth; canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // White behind, so a "fit" crop has clean edges instead of transparency
    // turning black in JPEG.
    if (format === "jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, outWidth, outH); }
    // Draw in destination space — works whether the image is smaller or
    // larger than the frame.
    const k = outWidth / VW;
    ctx.drawImage(img, off.x * k, off.y * k, dw * k, dh * k);
    onApply(format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85));
  }

  const maxZoom = Math.max(3, fillZoom * 2);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onPointerUp={onUp}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-float">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Adjust photo</h3>
          <button onClick={onCancel} className="ed-icon"><X className="h-4 w-4" /></button>
        </div>

        <div
          className="relative mx-auto overflow-hidden bg-surface2 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ width: VW, height: VH, borderRadius: round ? "9999px" : "0.75rem" }}
          onPointerDown={onDown} onPointerMove={onMove}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef} src={src} alt="" draggable={false}
            onLoad={(e) => {
              const t = e.currentTarget;
              const w = t.naturalWidth, h = t.naturalHeight;
              setNat({ w, h });
              // open showing the WHOLE picture — no surprise cropping
              const s = Math.min(VW / w, VH / h);
              setZoom(1);
              setOff({ x: (VW - w * s) / 2, y: (VH - h * s) / 2 });
            }}
            style={{ position: "absolute", left: off.x, top: off.y, width: dw, height: dh, maxWidth: "none" }}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/30" style={{ borderRadius: round ? "9999px" : "0.75rem" }} />
        </div>

        {/* quick presets */}
        <div className="mt-3 flex justify-center gap-1 p-1 rounded-lg border border-border bg-surface2/50 w-fit mx-auto">
          <button onClick={() => setPreset("fit")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${zoom <= 1.001 ? "bg-surface shadow-card" : "text-muted hover:text-ink"}`}>
            <Maximize2 className="h-3.5 w-3.5" /> Whole image
          </button>
          <button onClick={() => setPreset("fill")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${Math.abs(zoom - fillZoom) < 0.01 ? "bg-surface shadow-card" : "text-muted hover:text-ink"}`}>
            <Crop className="h-3.5 w-3.5" /> Fill frame
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ZoomIn className="h-4 w-4 text-muted" />
          <input type="range" min={1} max={maxZoom} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--brand)]" />
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">Cancel</button>
          <button onClick={apply} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white">
            <Check className="h-4 w-4" /> Apply
          </button>
        </div>
        <p className="mt-2 text-[11px] text-faint text-center">
          Opens with the whole image · drag to reposition · zoom in only if you want to crop
        </p>
      </div>
    </div>
  );
}
