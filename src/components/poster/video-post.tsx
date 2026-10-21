"use client";
// "Apni video post karein" (owner, 21 Oct 2026): a video from the phone — made outside Shubhora — goes to the connected
// Facebook Page and/or Instagram (as a Reel) with a caption. Upload once (progress shown), then post to the ticked accounts.
import { useEffect, useRef, useState } from "react";
import { Check, Film, LoaderCircle, Send, Upload, X } from "lucide-react";
import { api, uploadImage } from "@/lib/poster-client";
import { captureVideoThumb, uploadVideo, videoFileProblem } from "@/lib/video-upload";

export type VideoAccount = { id: string; provider: "facebook" | "instagram"; name: string; status: "ok" | "reconnect" };

export function VideoPost({ accounts, current, en, onPosted }: { accounts: VideoAccount[]; current: string; en: boolean; onPosted?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbPreview, setThumbPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "up" | "post">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hi = !en;

  // The account of the open tab is ticked by default; the other connected one can be added with a tap.
  useEffect(() => { setPicked((p) => (p.length ? p.filter((id) => accounts.some((a) => a.id === id)) : accounts.filter((a) => a.id === current && a.status === "ok").map((a) => a.id))); }, [accounts, current]);

  async function choose(f: File | null) {
    setMsg(null); setVideoUrl(""); setThumbUrl(""); setThumbPreview(""); setPct(0);
    if (!f) { setFile(null); return; }
    const problem = videoFileProblem(f, hi);
    if (problem) { setFile(null); setMsg({ ok: false, text: problem }); return; }
    setFile(f); setBusy("up");
    try {
      const thumb = await captureVideoThumb(f);
      if (thumb) { setThumbPreview(URL.createObjectURL(thumb)); const u = await uploadImage(thumb, "wide"); if (u) setThumbUrl(u); }
      const r = await uploadVideo(f, setPct);
      if ("url" in r) { setVideoUrl(r.url); setPct(100); }
      else setMsg({ ok: false, text: hi ? `Video नहीं चढ़ पाई — ${r.error}` : `Could not upload the video — ${r.error}` });
    } catch { setMsg({ ok: false, text: hi ? "Video नहीं चढ़ पाई। फिर से कोशिश करें।" : "Could not upload the video. Please try again." }); }
    finally { setBusy(""); }
  }

  async function post() {
    if (!videoUrl || !picked.length) return;
    setBusy("post"); setMsg(null);
    try {
      const r = await api<{ ok?: boolean; error?: string; results?: { provider: string; ok: boolean; error?: string }[] }>("/api/social/post-video", { method: "POST", json: { video_url: videoUrl, thumb_url: thumbUrl, caption, account_ids: picked } });
      if (!r.ok) { setMsg({ ok: false, text: r.data.error || (hi ? "Post नहीं हो पाई।" : "Could not post.") }); return; }
      const bad = (r.data.results ?? []).filter((x) => !x.ok);
      if (!bad.length) { setMsg({ ok: true, text: hi ? "✅ Video post हो गई। Facebook / Instagram पर कुछ मिनट में दिखेगी।" : "✅ Video posted. It shows on Facebook / Instagram in a few minutes." }); setFile(null); setVideoUrl(""); setThumbUrl(""); setThumbPreview(""); setCaption(""); onPosted?.(); }
      else setMsg({ ok: false, text: bad.map((x) => `${x.provider === "facebook" ? "Facebook" : "Instagram"}: ${x.error ?? (hi ? "नहीं हो पाई" : "failed")}`).join(" · ") });
    } catch { setMsg({ ok: false, text: hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again." }); }
    finally { setBusy(""); }
  }

  const ready = accounts.filter((a) => a.status === "ok");
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold flex items-center gap-1.5"><Film className="h-4 w-4 text-brand" /> {hi ? "अपनी video post करें" : "Post your own video"}</p>
      <p className="text-[11px] text-muted">{hi ? "Phone की कोई भी video (MP4/MOV, 60 MB तक, 90 सेकंड से कम सबसे अच्छी)। Instagram पर Reel बनकर जाती है।" : "Any video from your phone (MP4/MOV, up to 60 MB, under 90 seconds is best). On Instagram it goes as a Reel."}</p>

      {!file ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm">
          <Upload className="h-5 w-5 text-brand" /> {hi ? "Video चुनें" : "Choose a video"}
          <input ref={input} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void choose(f); }} />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumbPreview ? <img src={thumbPreview} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-surface2"><Film className="h-5 w-5 text-muted" /></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-[11px] text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB · {videoUrl ? (hi ? "चढ़ गई" : "uploaded") : busy === "up" ? `${hi ? "चढ़ रही है" : "uploading"} ${pct}%` : (hi ? "नहीं चढ़ी" : "not uploaded")}</p>
            {busy === "up" && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>}
          </div>
          <button type="button" onClick={() => choose(null)} className="p-1 text-muted" aria-label={hi ? "हटाएँ" : "Remove"}><X className="h-4 w-4" /></button>
        </div>
      )}

      <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 2000))} rows={3} placeholder={hi ? "Caption — क्या है इस video में, offer, आपका नंबर…" : "Caption — what the video shows, your offer, your number…"} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />

      {ready.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {ready.map((a) => (
            <label key={a.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${picked.includes(a.id) ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}>
              <input type="checkbox" className="hidden" checked={picked.includes(a.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id)))} />
              {picked.includes(a.id) && <Check className="h-3.5 w-3.5" />} {a.provider === "facebook" ? "Facebook" : "Instagram"} · {a.name}
            </label>
          ))}
        </div>
      )}

      <button type="button" onClick={post} disabled={!videoUrl || !picked.length || busy !== ""} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy === "post" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy === "post" ? (hi ? "Post हो रही है… (Instagram पर 1–2 मिनट)" : "Posting… (Instagram takes 1–2 minutes)") : (hi ? "Video post करें" : "Post the video")}
      </button>
      {msg && <p className={`text-xs font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
