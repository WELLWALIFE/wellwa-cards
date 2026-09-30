"use client";
// Long video from your own words: paste or type the text, the AI reads it out over your photos, and the video is
// exactly as long as the text (about 150 words a minute, up to 10 minutes). No AI writing — every word is yours.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clapperboard, Download, ImagePlus, LoaderCircle, Mic, Pencil, Share2, Sparkles, X, Trash2 } from "lucide-react";
import { api, isLoggedIn, uploadImage, shareFile, downloadPoster, LANGS, uploadAudio } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { AddCredits } from "@/components/poster/add-credits";
import { VideoSteps, CostLine } from "@/components/poster/video-steps";
import { EXPLAINER_MAX_MIN, explainerCredits, explainerMinutes } from "@/lib/media/ad-pricing";
import { EXPLAINER_CREDITS_PER_MIN } from "@/lib/media/ad-pricing";

type Job = { id: string; kind?: string; status: string; output_url: string | null; error: string | null; created_at: string; cost?: number; progress?: { text?: string } | null; input?: { title?: string } };
type MyProduct = { id: string; name: string; photo_url: string | null; photos?: { url: string; role?: string }[] };
type BrandProfile = { id: string; name: string; phone?: string | null; logo_url?: string | null; is_default?: boolean; layout?: { accent?: string } };
const MUSIC = [["", "No music"], ["calm-ambient", "Calm"], ["inspiring-motivational", "Inspiring"], ["upbeat-corporate", "Upbeat"], ["indian-sitar", "Indian"], ["festive-diwali", "Festive"]] as const;
const VOICES = [["warm", "Warm (man)"], ["warmf", "Warm (woman)"], ["bright", "Bright"], ["calm", "Calm"]] as const;
const OFFLINE = "No internet — please try again.";
const MONEY_BACK = "Your credits have been returned.";
function failLine(raw: string | null | undefined): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.startsWith("paused")) return "Paused — the AI picture service is busy right now. Your video will continue by itself from where it stopped; your credits are safe.";
  if (e.includes("cancel")) return "You stopped this video. Any credits we did not use have been returned.";
  if (e.includes("try again in a few minutes")) return String(raw);   // the engine said exactly what happened
  if (/tts|voice|speech|audio/.test(e)) return `The voice could not be recorded. ${MONEY_BACK}`;
  if (/upload|ffmpeg|timeout|timed out|render|encode|finish/.test(e)) return `The video could not be finished. ${MONEY_BACK}`;
  return `Something went wrong. ${MONEY_BACK}`;
}

/** How long a recording is, read in the browser before it is sent — it sets the video's length and its price. */
function audioSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (n: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(n) && n > 0 ? n : 0); };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    setTimeout(() => done(a.duration), 8000);
    a.src = url;
  });
}

export default function LongVideo() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("hinglish");
  const [voiceStyle, setVoiceStyle] = useState("warm");
  const [music, setMusic] = useState("calm-ambient");
  const [captions, setCaptions] = useState(true);
  const [wide, setWide] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  // Whose video this is. Somebody with two businesses should not have to switch their default profile to make a
  // video for the second one — the name, number and logo on the video follow whichever brand is picked here.
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [brandId, setBrandId] = useState("");
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ownVoice, setOwnVoice] = useState("");
  const [ownVoiceName, setOwnVoiceName] = useState("");
  const [ownSeconds, setOwnSeconds] = useState(0);        // the recording's length, measured in the browser
  const [stopping, setStopping] = useState("");
  const [deleting, setDeleting] = useState("");
  const [retrying, setRetrying] = useState("");
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const brand = useMemo(() => profiles.find((p) => p.id === brandId) ?? null, [profiles, brandId]);
  // With a recording, the recording sets the length and the price; the text (if any) only helps the spelling.
  const audioMinutes = ownVoice && ownSeconds > 0 ? Math.min(EXPLAINER_MAX_MIN, Math.max(0.5, ownSeconds / 60)) : 0;
  const minutes = useMemo(() => (audioMinutes ? audioMinutes : explainerMinutes(script)), [script, audioMinutes]);
  const cost = useMemo(() => (audioMinutes ? Math.max(20, Math.ceil(audioMinutes) * 10) : explainerCredits(script)), [script, audioMinutes]);
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const tooLong = ownVoice ? ownSeconds > EXPLAINER_MAX_MIN * 60 + 30 : minutes >= EXPLAINER_MAX_MIN && words > EXPLAINER_MAX_MIN * 170;
  const canMake = ownVoice ? ownSeconds >= 5 : words >= 25;

  async function refresh() {
    const r = await fetch("/api/media/jobs?kind=explainer", { cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
    setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.kind === "explainer"));
    if (typeof r.credits === "number") setCredits(r.credits);
  }
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/explainer"); return; }
    setReady(true); refresh();
    api<{ profiles?: BrandProfile[] }>("/api/poster/profiles")
      .then((r) => { const list = r.data.profiles ?? []; setProfiles(list); setBrandId((list.find((p) => p.is_default) ?? list[0])?.id ?? ""); })
      .catch(() => {});
    api<{ products?: MyProduct[] }>("/api/poster/products")
      .then((r) => { const urls = (r.data.products ?? []).flatMap((p) => [...(p.photos ?? []).map((x) => x.url), ...(p.photo_url ? [p.photo_url] : [])]).filter(Boolean);
        setPhotos((g) => (g.length ? g : [...new Set(urls)].slice(0, 8))); })
      .catch(() => {});
  })(); }, [router]);
  useEffect(() => { if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return; const t = setInterval(refresh, 6000); return () => clearInterval(t); }, [jobs]);

  async function addPhoto(file: File | null) {
    if (!file || photos.length >= 12) return;
    setBusy("img"); setErr("");
    const u = await uploadImage(await compressToFile(file, "slide.jpg", 1600, 0.86), "product");
    setBusy("");
    if (u) setPhotos((g) => [...g, u].slice(0, 12)); else setErr("Could not upload the photo. Please try again.");
  }

  async function addVoice(file: File | null) {
    if (!file) return;
    setBusy("voice"); setErr("");
    const r = await uploadAudio(file);
    setBusy("");
    if (!r.url) { setErr(r.error || "Could not upload that recording."); return; }
    setOwnVoice(r.url); setOwnVoiceName(file.name.replace(/\.[^.]+$/, "").slice(0, 48));
    setOwnSeconds(await audioSeconds(file));
  }

  async function make() {
    setBusy("make"); setErr(""); setNeedCredits(null);
    try {
      const r = await fetch("/api/media/explainer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ script, title, lang, voiceStyle, music, photos, voiceUrl: ownVoice || undefined, audioSeconds: ownVoice ? ownSeconds : undefined, style: "images", captions, formats: [wide ? "wide" : "reel"],
          brandName: brand?.name ?? "", phone: brand?.phone ?? "", logoUrl: brand?.logo_url ?? "", accent: brand?.layout?.accent ?? "" }),
      }).then(async (x) => ({ ok: x.ok, status: x.status, data: (await x.json().catch(() => ({}))) as Record<string, unknown> }))
        .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));
      if (!r.ok) {
        setErr(String(r.data.error ?? "") || (r.status === 0 ? OFFLINE : "Could not start the video."));
        if (r.status === 402) setNeedCredits(Math.max(20, Number(r.data.cost) || cost));
        return;
      }
      refresh();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } finally { setBusy(""); }
  }

  // Same video, same job, no second charge: the worker still has the recordings and slides it finished last time,
  // so this carries on rather than starting the script over.
  async function retryJob(j: Job) {
    setRetrying(j.id); setErr("");
    try {
      const r = await fetch("/api/media/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: j.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: d.error || "Could not start it again." })); if (r.status === 402) setNeedCredits(Number(d.cost) || null); return; }
      setRowMsg((m) => ({ ...m, [j.id]: "" }));
      refresh();
    } catch { setRowMsg((m) => ({ ...m, [j.id]: OFFLINE })); }
    finally { setRetrying(""); }
  }

  async function stopJob(j: Job) {
    if (!window.confirm("Stop this video? The credits we have not used yet come back to you.")) return;
    setStopping(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: d.error || "Could not stop it. Please try again." })); return; }
      const refunded = typeof d.refunded === "number" ? d.refunded : null;
      setRowMsg((m) => ({ ...m, [j.id]: refunded === null ? "Stopped. Any credits we did not use have been returned." : refunded > 0 ? `Stopped — ${refunded} credits returned.` : "Stopped." }));
      refresh();
    } catch { setRowMsg((m) => ({ ...m, [j.id]: "Could not stop it. Please try again." })); }
    finally { setStopping(""); }
  }
  // Gone for good: the video file and the row. Asked for, and confirmed, because there is no undo.
  async function deleteJob(j: Job) {
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    setDeleting(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: d.error || "Could not delete it. Please try again." })); return; }
      setJobs((list) => list.filter((x) => x.id !== j.id));
    } catch { setRowMsg((m) => ({ ...m, [j.id]: "Could not delete it. Please try again." })); }
    finally { setDeleting(""); }
  }


  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/videos" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> Long video</h1>
        {credits !== null && <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{credits} credits</span>}
      </div>
      <VideoSteps step={canMake ? 3 : 2} hi={false} note={canMake ? "subtitles, pictures, voice — then Make" : "your words (or a recording)"} />
      <p className="text-xs text-muted">Write or paste what you want to say. The AI reads it in your language over your photos. The video is as long as your text — up to {EXPLAINER_MAX_MIN} minutes.</p>

      <div className="space-y-3 rounded-xl border border-border p-3">
        {profiles.length > 1 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">Which business is this video for?</p>
            <div className="flex flex-wrap gap-1.5">
              {profiles.map((p) => <button key={p.id} type="button" onClick={() => setBrandId(p.id)} className={chip(p.id === brandId)}>{p.name}</button>)}
            </div>
            <p className="mt-1 text-[11px] text-muted">Its name, phone number and logo go on the video.</p>
          </div>
        )}
        <input className={inp} placeholder="Title on the first slide (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} />
        <div>
          <textarea className={`${inp} min-h-56 leading-relaxed`} placeholder={ownVoice
              ? "Optional — we listen to your recording and write the words down ourselves.\n\nPaste the text here only if you want the exact spellings of names and brands in the subtitles."
              : "What do you want to say?\n\nLeave a blank line between topics — each one becomes a slide.\n\nExample:\nNamaste, I am Rajesh from Sharma Sweets.\n\nWe have been making fresh sweets since 2012…"}
            value={script} onChange={(e) => setScript(e.target.value.slice(0, 9000))} />
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-muted">{ownVoice && ownSeconds > 0
              ? <>Recording: {ownSeconds < 60 ? `${Math.round(ownSeconds)} sec` : `${Math.floor(ownSeconds / 60)} min ${Math.round(ownSeconds % 60)} sec`}{words > 0 && <> · {words} words of text</>}</>
              : <>{words} words {words > 0 && <>· {minutes < 1 ? "under a minute" : `about ${Math.round(minutes * 10) / 10} minutes`}</>}</>}</span>
            <span className={tooLong ? "font-semibold text-danger" : "text-muted"}>{tooLong ? `Longer than ${EXPLAINER_MAX_MIN} minutes — please shorten it` : cost > 0 ? `${cost} credits` : ""}</span>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Subtitles</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCaptions(true)} className={chip(captions)}>On — words appear as they are spoken</button>
            <button type="button" onClick={() => setCaptions(false)} className={chip(!captions)}>Off</button>
          </div>
          <p className="mt-1 text-[11px] text-muted">Every video is made the same professional way: a matching AI picture for each point, your own photos where they fit, a slow camera move on every shot and soft cuts timed to the voice.</p>
        </div>

        <div><p className="mb-1 text-xs font-semibold text-muted">Language of the voice</p><div className="flex flex-wrap gap-1.5">{LANGS.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={chip(lang === l.key)}>{l.label}</button>)}</div></div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Voice</p>
          {ownVoice ? (
            <div className="flex items-center gap-2 rounded-lg border border-brand bg-brand-soft px-3 py-2 text-xs">
              <Mic className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate font-semibold text-brand-ink">{ownVoiceName || "Your own recording"}</span>
              <button type="button" onClick={() => { setOwnVoice(""); setOwnVoiceName(""); setOwnSeconds(0); }} className="shrink-0 text-muted" aria-label="Remove"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">{VOICES.map(([k, l]) => <button key={k} type="button" onClick={() => setVoiceStyle(k)} className={chip(voiceStyle === k)}>{l}</button>)}</div>
          )}
          <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-ink">
            {busy === "voice" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {ownVoice ? "Use a different recording" : "Or use my own recording (mp3)"}
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addVoice(f ?? null); }} />
          </label>
          <p className="mt-1 text-[11px] text-muted">{ownVoice
            ? "Your recording is the narration — its length is the length of the video. No text needed: we write down what you said and cut the pictures to it."
            : "Recorded it yourself, or made it somewhere else? Upload it and we put the slides, photos and music around it."}</p>
        </div>
        <div><p className="mb-1 text-xs font-semibold text-muted">Music</p><div className="flex flex-wrap gap-1.5">{MUSIC.map(([k, l]) => <button key={k || "none"} type="button" onClick={() => setMusic(k)} className={chip(music === k)}>{l}</button>)}</div></div>
        <div><p className="mb-1 text-xs font-semibold text-muted">Shape</p><div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setWide(true)} className={chip(wide)}>Wide — YouTube, laptop</button>
          <button type="button" onClick={() => setWide(false)} className={chip(!wide)}>Tall — WhatsApp, Reels</button>
        </div>
        <p className="mt-1 text-[11px] text-muted">The pictures are made in this shape, so pick it before you start.</p></div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Your photos <span className="font-normal">— shown one after another while the voice speaks</span></p>
          <div className="flex flex-wrap gap-2">
            {photos.map((u, i) => (
              <span key={u} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos(photos.filter((_, k) => k !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {photos.length < 12 && (
              <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-border text-muted">
                {busy === "img" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addPhoto(f ?? null); }} />
              </label>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted">No photos? The video still works — every slide shows your words on a clean branded background.</p>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}
        {needCredits !== null && <AddCredits onDone={() => { setNeedCredits(null); refresh(); }} />}
        <CostLine hi={false} cost={cost} balance={credits} range={cost > 0 ? `${cost} credits (${EXPLAINER_CREDITS_PER_MIN} a minute, at least 20)` : "20 credits at least — 10 a minute"} />
        <button type="button" onClick={make} disabled={!!busy || tooLong || !canMake}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
          {busy === "make" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Starting…</> : <><Sparkles className="h-5 w-5" /> Make my video{cost > 0 ? ` · ${cost} credits` : ""}</>}
        </button>
        <p className="text-center text-[11px] text-muted">A 10-minute video takes about 10–15 minutes to make. You can close this screen — it will be here in Your videos.</p>
      </div>

      {jobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Your videos</p>
          {jobs.map((j, jobIdx) => (
            <div key={j.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{j.input?.title || "Long video"}</span>
                <span className="text-xs text-muted">{new Date(j.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              {(j.status === "queued" || j.status === "running") && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> {j.progress?.text || (j.status === "queued" ? "Waiting to start…" : "Making your video…")}</p>
                  <button type="button" onClick={() => stopJob(j)} disabled={stopping === j.id} className="w-full rounded-lg border border-border py-2 text-sm font-semibold disabled:opacity-60">{stopping === j.id ? "Stopping…" : "Stop this video"}</button>
                </div>
              )}
              {j.status === "failed" && (
                <div className="space-y-2">
                  <p className={`text-sm ${/^PAUSED/.test(String(j.error ?? "")) ? "text-muted" : "text-danger"}`}>{failLine(j.error)}</p>
                  {!/cancel/i.test(String(j.error ?? "")) && (
                    <button type="button" onClick={() => retryJob(j)} disabled={retrying === j.id}
                      className="w-full rounded-lg border border-border py-2 text-sm font-semibold disabled:opacity-60">
                      {retrying === j.id ? "Starting again…" : /^PAUSED/.test(String(j.error ?? "")) ? "Continue now (free)" : "Try again — carries on from where it stopped"}
                    </button>
                  )}
                  <button type="button" onClick={() => deleteJob(j)} disabled={deleting === j.id} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold text-danger disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deleting === j.id ? "Deleting…" : "Delete"}</button>
                </div>
              )}
              {j.status === "done" && j.output_url && (
                <div className="space-y-2">
                  <video src={j.output_url} controls playsInline preload={jobIdx === 0 ? "auto" : "metadata"} className="w-full rounded-lg bg-black" />
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={async () => { setRowMsg((m) => ({ ...m, [j.id]: "Opening share…" })); const r = await shareFile(j.output_url!, j.input?.title || "My video", "long-video.mp4", "video/mp4"); setRowMsg((m) => ({ ...m, [j.id]: r === "shared" ? "Shared — pick WhatsApp in the sheet that opened." : r === "downloaded" ? "Saved to your Downloads folder." : "" })); }} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> Share</button>
                    <button type="button" onClick={async () => { setRowMsg((m) => ({ ...m, [j.id]: "Downloading — check your Downloads folder…" })); await downloadPoster(j.output_url!, "long-video.mp4"); }} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm font-semibold"><Download className="h-4 w-4" /> Save</button>
                    <button type="button" onClick={() => deleteJob(j)} disabled={deleting === j.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm font-semibold text-danger disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deleting === j.id ? "…" : "Delete"}</button>
                  </div>
                  {/* Scene by scene: pictures, headings, words, voice. Only the scenes touched are made again. */}
                  <Link href={`/poster/explainer/edit?id=${j.id}`} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand bg-brand-soft py-2.5 text-sm font-semibold text-brand-ink"><Pencil className="h-4 w-4" /> Edit — change a picture, heading or words</Link>
                  {j.progress?.text && /edit/i.test(j.progress.text) && <p className="text-xs text-muted">{j.progress.text}</p>}
                </div>
              )}
              {rowMsg[j.id] && <p className="text-xs text-muted">{rowMsg[j.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
