"use client";
// Screen C — "Your storyboard": QC-checked stills the owner approves BEFORE any credits are spent.
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, X, RefreshCw, Play, Square, Pencil, ImagePlus } from "lucide-react";
import { uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";

type SceneRow = { i: number; status: string; preview_url: string | null; owner_summary: string | null; notes: string[]; redraws: number; line: { text_final?: string; shortened_from?: string | null; sec?: number; tempo?: number; too_long?: boolean } | null };
type JobV2 = { id: string; status: string; phase: string; stage: string; progress: { text?: string; n?: number } | null; output_url: string | null; cost: number; spent_credits?: number | null; error: string | null; input: { script?: { scenes?: { text: string; caption: string; role?: string }[]; cta?: { text: string } }; brief?: { length?: number }; outputs?: Record<string, string>; duration_sec?: number; product?: string } };
/**
 * What actually happened to the money on a failed job — never a promise we cannot keep.
 * An ENGINE failure is refunded in full by the worker (bridge/media-worker.mjs refund()).
 * A job the OWNER stopped is refunded cost - spent_credits by /api/media/jobs DELETE, and
 * spent_credits is set the moment we pay fal/Kling — so "your credits have been returned"
 * is simply untrue for a stop that landed after the clips were bought.
 */
function moneyLine(job: JobV2): string {
  const cost = Number(job.cost) || 0;
  if (cost <= 0) return "Nothing was charged.";
  // Already delivered once (a free rebuild failed, or they discarded afterwards): the video
  // is theirs and the price stays paid — /api/media/ad/[id]/discard refunds nothing here.
  if (job.output_url || job.input?.outputs) return "No credits came back — this video was already made, and it is still yours.";
  if (!/cancel/i.test(String(job.error ?? ""))) return "Your credits have been returned.";
  if (typeof job.spent_credits !== "number") return "Any credits we did not use have been returned.";
  const back = Math.max(0, cost - job.spent_credits);
  if (back >= cost) return "Your credits have been returned.";
  if (back > 0) return `${back} credits have been returned — ${job.spent_credits} were already used making the video.`;
  return "No credits came back — they were already used making the video.";
}
const OK = ["pass", "pass_with_notes", "safe_shot"];
// One plain sentence per engine failure — the owner of a shop must never read "fal avatar: 422".
// The raw text stays, but under "Details". Same map as the phone screens (src/app/poster/video/page.tsx).
function failLine(raw: string | null | undefined): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return "You stopped this video.";
  if (e.includes("no storyboard")) return "We could not plan the scenes for this video.";
  if (/tts|voice|speech|audio/.test(e)) return "The voice could not be recorded.";
  if (/clip|stock|image|photo|still|veo|kling|fal|pexels/.test(e)) return "We could not get a picture for one scene.";
  if (/upload|ffmpeg|timeout|timed out|render|encode|finished/.test(e)) return "The video could not be finished.";
  return "This video could not be made.";
}
const post = (id: string, action: string, body: unknown = {}) => fetch(`/api/media/ad/${id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

export function Storyboard({ jobId, animateCost, onClose, onNeedCredits }: { jobId: string; animateCost: number; onClose: () => void; onNeedCredits?: (need: number) => void }) {
  const [job, setJob] = useState<JobV2 | null>(null);
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [ack, setAck] = useState(false);
  const [sheet, setSheet] = useState<SceneRow | null>(null); const [note, setNote] = useState("");
  const [lineEdit, setLineEdit] = useState<{ i: number; text: string } | null>(null);
  const [after, setAfter] = useState<{ music: string; redo: number; note: string } | null>(null);
  const [playing, setPlaying] = useState(-1); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => { const r = await fetch(`/api/media/jobs?id=${jobId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null); if (r?.job) { setJob(r.job); setScenes(r.scenes ?? []); if (typeof r.credits === "number") setCredits(r.credits); } }, [jobId]);
  useEffect(() => { const t0 = setTimeout(() => void load(), 0); const t = setInterval(() => void load(), 4000); return () => { clearTimeout(t0); clearInterval(t); if (timer.current) clearTimeout(timer.current); }; }, [load]);

  async function act(action: string, body: unknown = {}) {
    setBusy(action); setErr(""); const r = await post(jobId, action, body); setBusy("");
    if (!r.ok) { setErr(r.data.error || "Something went wrong."); if (r.data.cost && onNeedCredits) onNeedCredits(r.data.cost); return false; }
    await load(); return true;
  }
  // silent animatic: the stills in order, each held for the length of its spoken line
  function playAnimatic() { if (playing >= 0) { setPlaying(-1); if (timer.current) clearTimeout(timer.current); return; } const step = (k: number) => { if (k >= scenes.length) { setPlaying(-1); return; } setPlaying(k); timer.current = setTimeout(() => step(k + 1), Math.max(2400, ((scenes[k].line?.sec ?? 3) + 0.3) * 1000)); }; step(0); }

  if (!job) return <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const sc = job.input.script?.scenes ?? [];
  const working = job.status === "queued" || job.status === "running";
  const review = job.status === "review" && job.stage !== "render_failed";
  const renderFailed = job.status === "review" && job.stage === "render_failed";
  const allOk = scenes.length > 0 && scenes.every((s) => OK.includes(s.status));
  const hasSafe = scenes.some((s) => s.status === "safe_shot");
  const total = scenes.reduce((a, s) => a + Math.min(4.1, Math.max(2.4, (s.line?.sec ?? 3) / (s.line?.tempo || 1) + 0.3)), 0) + 3.5;
  const pill = (s: SceneRow) => s.status === "pass" ? ["Checked ✓", "bg-good/10 text-good"] : s.status === "pass_with_notes" ? ["Checked · see note", "bg-lead/10 text-lead"] : s.status === "safe_shot" ? ["Safe product shot", "bg-lead/10 text-lead"] : s.status === "needs_owner" ? ["Needs your choice", "bg-danger/10 text-danger"] : ["Drawing…", "bg-surface2 text-muted"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-base font-bold">{job.status === "done" ? "Your video" : job.phase === "animate" && working ? "Animating your video" : "Your storyboard"}</h2><button type="button" onClick={onClose} className="rounded-lg p-1 text-muted" aria-label="Close"><X className="h-5 w-5" /></button></div>

      {job.status === "done" && job.output_url && (
        <div className="space-y-2"><video src={job.output_url} controls playsInline className="mx-auto max-h-[70dvh] rounded-xl bg-black" /><p className="text-center text-xs text-muted">{job.input.duration_sec ? `${job.input.duration_sec} s · ` : ""}All formats are in “Your videos”.</p>{err && <p className="text-xs text-danger">{err}</p>}
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAfter({ music: "", redo: -1, note: "" })} className="rounded-xl border border-border py-2 text-sm font-semibold">Change music / captions · free</button><button type="button" onClick={() => setAfter({ music: "", redo: 0, note: "" })} className="rounded-xl border border-border py-2 text-sm font-semibold">Redo one scene</button></div>
          <button type="button" onClick={onClose} className="grad-brand w-full rounded-xl py-2.5 text-sm font-semibold text-white">Done</button></div>
      )}
      {job.status === "failed" && (
        <div className="rounded-xl border border-border p-3 text-sm text-muted">
          <p>{`${job.error === "Discarded" ? "Storyboard discarded." : failLine(job.error)} ${moneyLine(job)}`}</p>
          {job.error && job.error !== "Discarded" && <details className="mt-1"><summary className="cursor-pointer text-xs">Details</summary><p className="mt-1 break-words text-xs">{job.error}</p></details>}
        </div>
      )}

      {working && (
        <div className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin text-brand-ink" />{job.progress?.text || (job.phase === "animate" ? "Starting…" : "Preparing your storyboard…")}</div>
          <p className="mt-1 text-xs text-muted">{job.phase === "animate" ? "You can close this screen — the video will appear in “Your videos”." : "Free — nothing is charged until you tap Animate. Every picture is checked against your Product check."}</p></div>
      )}

      {(review || (working && job.phase === "storyboard") || renderFailed) && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {scenes.map((s) => { const [label, cls] = pill(s); return (
              <div key={s.i} className={`overflow-hidden rounded-xl border ${playing === s.i ? "border-brand ring-2 ring-brand/40" : "border-border"}`}>
                <div className="relative aspect-[9/16] bg-surface2">{s.preview_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.preview_url} alt={`Scene ${s.i + 1}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>}
                  <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${cls}`}>{label}</span></div>
                <div className="space-y-1 p-2 text-xs">
                  <p className="font-semibold">{s.i + 1}. “{s.line?.text_final ?? sc[s.i]?.text}”</p>
                  <p className="text-muted">{s.line?.sec ? `${s.line.sec.toFixed(1)} s spoken` : ""}{s.line?.too_long ? " · line is long for one scene — shorten it for a calmer pace" : ""}</p>
                  {s.line?.shortened_from && <p className="text-lead">Shortened to fit. You wrote: “{s.line.shortened_from}”</p>}
                  {s.owner_summary && <p className="text-good">{s.owner_summary}</p>}
                  {s.status === "safe_shot" && <p className="text-lead">We could not draw this scene correctly, so it shows your product standing on its own.</p>}
                  {s.status === "needs_owner" && <p className="text-danger">We could not get this picture right. Try “Change picture” with a short note, or use the safe product shot.</p>}
                  {(s.notes ?? []).slice(0, 2).map((n, k) => <p key={k} className="text-lead">Note: {n}</p>)}
                  {review && <button type="button" onClick={() => setLineEdit({ i: s.i, text: s.line?.text_final ?? sc[s.i]?.text ?? "" })} className="mr-1 mt-1 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold"><Pencil className="h-3 w-3" /> Edit line</button>}
                  {review && s.preview_url && <button type="button" onClick={() => { setSheet(s); setNote(""); }} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold"><RefreshCw className="h-3 w-3" /> Change picture{s.redraws >= 1 ? " · 1 credit" : " · free"}</button>}
                </div>
              </div>); })}
          </div>
          {review && scenes.length > 1 && <button type="button" onClick={playAnimatic} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-sm font-semibold">{playing >= 0 ? <><Square className="h-4 w-4" /> Stop preview</> : <><Play className="h-4 w-4" /> Preview the scene order</>}</button>}
        </>
      )}

      {review && (
        <div className="space-y-2 rounded-xl border border-brand/40 bg-brand-soft/30 p-3">
          <p className="text-sm">Video length about <b>{total.toFixed(0)} s</b> · Animate: <b>{animateCost} credits</b>{credits !== null ? ` (you have ${credits})` : ""}</p>
          <p className="text-xs text-muted">Each picture becomes a 5-second moving clip with your voice-over, captions, music and a closing card. Credits are charged only now.</p>
          {hasSafe && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" /> I understand one scene will show the product standing, not working.</label>}
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => confirm("Discard this storyboard? Nothing is charged.") && act("discard")} disabled={!!busy} className="rounded-xl border border-border px-3 py-2.5 text-sm">Discard</button>
            <button type="button" onClick={() => act("approve", { ack_no_in_use: ack })} disabled={!!busy || !allOk || (hasSafe && !ack)} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "approve" ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : job.cost > 0 ? "Animate the new scene (already paid)" : `Animate · ${animateCost} credits`}</button>
          </div>
        </div>
      )}
      {renderFailed && (
        <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">
          <p><b>The video could not be finished.</b> Your credits are safe. Retry is free and reuses the clips already made.</p>
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="flex gap-2"><button type="button" onClick={() => confirm("Discard and get a full refund?") && act("discard")} disabled={!!busy} className="rounded-xl border border-border px-3 py-2.5 text-sm">Discard · full refund</button><button type="button" onClick={() => act("retry-render")} disabled={!!busy} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white">Retry render (free)</button></div>
        </div>
      )}

      {lineEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setLineEdit(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">Edit line — scene {lineEdit.i + 1}</h3>
            <p className="text-xs text-muted">Keep it short: one scene holds about 3.8 seconds of speech. Only the voice is recorded again; the picture stays. Free.</p>
            <textarea className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" rows={2} value={lineEdit.text} onChange={(e) => setLineEdit({ ...lineEdit, text: e.target.value })} />
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex gap-2"><button type="button" onClick={() => setLineEdit(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={!!busy} onClick={async () => { if (await act("line", { scene: lineEdit.i, text: lineEdit.text })) setLineEdit(null); }} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white">Save line</button></div>
          </div>
        </div>
      )}
      {after && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setAfter(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            {after.redo < 0 ? (<>
              <h3 className="text-sm font-bold">Change music or captions — free</h3>
              <p className="text-xs text-muted">The same clips are reused, so no credits are charged. Takes about a minute.</p>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={after.music} onChange={(e) => setAfter({ ...after, music: e.target.value })}><option value="">Keep the current music</option>{["upbeat-corporate", "festive-diwali", "calm-ambient", "energetic-promo", "inspiring-motivational", "indian-sitar"].map((m) => <option key={m} value={m}>{m.replace(/-/g, " ")}</option>)}</select>
              <div className="flex gap-2"><button type="button" disabled={!!busy} onClick={async () => { if (await act("reassemble", { music: after.music || undefined, captions: "words" })) setAfter(null); }} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white">Rebuild with captions</button><button type="button" disabled={!!busy} onClick={async () => { if (await act("reassemble", { music: after.music || undefined, captions: "off" })) setAfter(null); }} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold">Rebuild without captions</button></div>
            </>) : (<>
              <h3 className="text-sm font-bold">Redo one scene</h3>
              <p className="text-xs text-muted">That scene is drawn, checked and animated again; the rest is reused. Cost: that scene&apos;s share ({Math.max(1, Math.ceil((job.cost || animateCost) / Math.max(1, sc.length)))} credits). You approve the new picture before it is animated.</p>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={after.redo} onChange={(e) => setAfter({ ...after, redo: Number(e.target.value) })}>{sc.map((x, i) => <option key={i} value={i}>Scene {i + 1}: {x.text.slice(0, 40)}</option>)}</select>
              <textarea className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" rows={2} placeholder="What should be different? (optional)" value={after.note} onChange={(e) => setAfter({ ...after, note: e.target.value })} />
              <button type="button" disabled={!!busy} onClick={async () => { if (await act("redo-scene", { scene: after.redo, note: after.note })) setAfter(null); }} className="grad-brand w-full rounded-xl py-2.5 text-sm font-semibold text-white">Redo this scene</button>
            </>)}
            {err && <p className="text-xs text-danger">{err}</p>}
            <button type="button" onClick={() => setAfter(null)} className="w-full py-1 text-xs text-muted">Cancel</button>
          </div>
        </div>
      )}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">Change picture — scene {sheet.i + 1}</h3>
            <p className="text-xs text-muted">{sheet.redraws >= 1 ? "This scene has already had its free change. The next one costs 1 credit (refunded if we fail)." : "The first change for each scene is free."}</p>
            <textarea className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" rows={2} placeholder="What should be different? e.g. show the glass fuller, move the product to the left" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid gap-2">
              <button type="button" disabled={!!busy} onClick={async () => { if (await act("redraw", { scene: sheet.i, mode: note.trim() ? "change" : "redraw", note })) setSheet(null); }} className="grad-brand rounded-xl py-2.5 text-sm font-semibold text-white">{note.trim() ? "Redraw with this note" : "Draw it again"}</button>
              <button type="button" disabled={!!busy} onClick={async () => { if (await act("redraw", { scene: sheet.i, mode: "safe" })) setSheet(null); }} className="rounded-xl border border-border py-2.5 text-sm">Use a safe product shot instead</button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm"><ImagePlus className="h-4 w-4" /> Use my own photo (free)
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setBusy("upload"); const u = await uploadImage(await compressToFile(file, "scene.jpg"), "product"); setBusy(""); if (!u) { setErr("Upload failed."); return; } if (await act("redraw", { scene: sheet.i, mode: "own_photo", photo_url: u })) setSheet(null); }} /></label>
              <button type="button" onClick={() => setSheet(null)} className="py-1 text-xs text-muted">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
