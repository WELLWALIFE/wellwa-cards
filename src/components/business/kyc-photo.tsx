"use client";
// A photo / document picker for the Business forms: shrinks the picture in the browser, sends it (bizUpload) and hands back the file id.
// `current` is a link to a file already saved (signed, from the partner service) so the small preview shows before anything is picked.
import { useRef, useState } from "react";
import { Camera, FileText, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { compressToFile } from "@/lib/image-utils";
import { bizUpload } from "./kit";

export function KycPhoto({ kind, label, id, currentUrl, onChange, pdf = false, maxDim = 1600 }: {
  kind: string; label: string; id: string; currentUrl?: string | null; onChange: (id: string) => void; pdf?: boolean; maxDim?: number;
}) {
  const { lang } = useT(); const en = lang === "en";
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [local, setLocal] = useState<{ url: string; isPdf: boolean } | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    try {
      const isPdf = f.type === "application/pdf";
      const send = isPdf ? f : await compressToFile(f, f.name.replace(/\.\w+$/, "") + ".jpg", maxDim, 0.8);
      const r = await bizUpload(send, kind);
      if (!r.id) { setErr(r.error ?? (en ? "The file could not be sent." : "फ़ाइल नहीं जा पाई।")); return; }
      setLocal({ url: URL.createObjectURL(send), isPdf });
      onChange(r.id);
    } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }

  const shown = local?.url ?? (id ? currentUrl : null) ?? null;
  const showPdf = local ? local.isPdf : false;
  return (
    <div>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface p-2.5">
        {shown && !showPdf
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={shown} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover bg-surface2" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface2 text-muted"><FileText className="h-5 w-5" /></span>}
        <div className="min-w-0 flex-1 text-xs">
          <p className={id ? "font-semibold text-good" : "text-muted"}>{id ? (en ? "Photo added" : "फ़ोटो जुड़ गई") : (en ? "No photo yet" : "अभी फ़ोटो नहीं")}</p>
          {err && <p className="text-danger">{err}</p>}
        </div>
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{id ? (en ? "Change" : "बदलें") : (en ? "Add" : "जोड़ें")}
        </button>
        <input ref={ref} type="file" accept={pdf ? "image/*,application/pdf" : "image/*"} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
