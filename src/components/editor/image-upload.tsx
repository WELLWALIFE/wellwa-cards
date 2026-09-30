"use client";

import { useRef, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { fileToDataUrl } from "@/lib/upload";
import { ImageCropper } from "./image-cropper";

type Shape = "avatar" | "cover" | "tile";

const cfg: Record<Shape, { aspect: number; round: boolean; out: number; box: string }> = {
  avatar: { aspect: 1, round: true, out: 512, box: "h-20 w-20 rounded-full" },
  // 3.0 ≈ the banner's real display ratio, so "Fill frame" doesn't re-crop.
  cover: { aspect: 3, round: false, out: 1200, box: "h-24 w-full rounded-xl" },
  tile: { aspect: 1, round: false, out: 640, box: "h-24 w-24 rounded-xl" },
};

export function ImageUpload({
  value, onChange, shape = "tile", round,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  shape?: Shape;
  /** Override the crop frame shape (e.g. a square avatar). */
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState<string | null>(null);
  const c = cfg[shape];

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      // light pre-cap for a snappy cropper; final compression happens on crop-apply
      const url = await fileToDataUrl(file, 1600, 0.92);
      setRaw(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`${c.box} max-w-full relative overflow-hidden border border-border bg-surface2 grid place-items-center text-faint hover:border-brand transition-colors shrink-0`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain bg-surface" />
        ) : (
          <ImagePlus className="h-6 w-6" />
        )}
        {busy && <span className="absolute inset-0 grid place-items-center bg-surface/70 text-xs">…</span>}
      </button>

      <div className="flex flex-wrap gap-1.5 sm:flex-col">
        <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface2">
          <Upload className="h-3.5 w-3.5" /> {value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-surface2">
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      <input ref={input} type="file" accept="image/*" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />

      {raw && (
        <ImageCropper
          src={raw} aspect={c.aspect} round={round ?? c.round} outWidth={c.out}
          onApply={(url) => { onChange(url); setRaw(null); }}
          onCancel={() => setRaw(null)}
        />
      )}
    </div>
  );
}
