"use client";
// Proof on a repair job (owner, 26 Nov 2026 — what RepairDesk and the others give): photos of the phone as it came in, and the
// customer's signature on the screen. Both stop "it was not like this when I gave it" arguments. Photos go up one by one as they
// are taken; the signature goes up when the job is saved (signatureFile).
import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";
import { uploadImage } from "@/lib/poster-client";

export function PhotoPicker({ photos, setPhotos, max, hi }: { photos: string[]; setPhotos: (p: string[]) => void; max: number; hi: boolean }) {
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function pick(files: FileList | null) {
    setErr("");
    const list = [...(files ?? [])].slice(0, Math.max(0, max - photos.length));
    if (!list.length) return;
    setBusy(list.length);
    const got: string[] = [];
    for (const f of list) { const url = await uploadImage(f, "wide"); if (url) got.push(url); else setErr(hi ? "एक photo upload नहीं हुई — फिर से लें।" : "A photo did not upload — take it again."); setBusy((n) => n - 1); }
    setPhotos([...photos, ...got].slice(0, max));
    if (input.current) input.current.value = "";
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {photos.map((u) => (
          <span key={u} className="relative">
            <a href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-20 w-20 rounded-xl border border-border object-cover" />
            </a>
            <button type="button" aria-label="Remove" onClick={() => setPhotos(photos.filter((x) => x !== u))} className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy > 0} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-border text-muted">
            {busy > 0 ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center text-[11px]"><Camera className="h-5 w-5" />{hi ? "Photo लें" : "Add photo"}</span>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void pick(e.target.files)} />
      {err && <p className="text-[12px] font-semibold text-danger">{err}</p>}
    </div>
  );
}

/** A box the customer signs in with a finger. `onChange(true)` once something is drawn. */
export function SignPad({ padRef, onChange, hi }: { padRef: React.MutableRefObject<HTMLCanvasElement | null>; onChange: (signed: boolean) => void; hi: boolean }) {
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    const c = padRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2);
    const g = c.getContext("2d");
    if (g) { g.scale(2, 2); g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#111"; }
  }, [padRef]);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const clear = () => { const c = padRef.current; const g = c?.getContext("2d"); if (c && g) g.clearRect(0, 0, c.width, c.height); setSigned(false); onChange(false); };
  return (
    <div className="space-y-1">
      <canvas ref={padRef} className="h-32 w-full touch-none rounded-xl border-2 border-dashed border-border bg-white"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const g = e.currentTarget.getContext("2d"); const [x, y] = at(e); g?.beginPath(); g?.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const g = e.currentTarget.getContext("2d"); const [x, y] = at(e); g?.lineTo(x, y); g?.stroke(); if (!signed) { setSigned(true); onChange(true); } }}
        onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
      <p className="flex justify-between text-[11px] text-muted"><span>{hi ? "ग्राहक यहाँ उँगली से sign करें" : "The customer signs here with a finger"}</span>{signed && <button type="button" onClick={clear} className="font-semibold text-brand-ink">{hi ? "मिटाएँ" : "Clear"}</button>}</p>
    </div>
  );
}

/** The drawn signature as an uploaded image (null when nothing was drawn or the upload failed). */
export async function uploadSignature(c: HTMLCanvasElement | null): Promise<string | null> {
  if (!c) return null;
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!blob) return null;
  return uploadImage(new File([blob], "signature.png", { type: "image/png" }), "logo");
}
