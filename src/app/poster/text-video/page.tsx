"use client";
// Text to video — the one screen for "I know what I want to say, make the video".
// Pick the kind of video, write (or paste) the words, tap Make. Nothing else is asked for, because everything else
// — the brand name, the phone number, the logo, the product photos — is already in Shubhora.
// The four kinds are the four engines we actually run, and each one says its own length limit and price up front,
// so the 10-minute one is visible from the very first screen instead of hiding on another page.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clapperboard, Download, Film, ImagePlus, LoaderCircle, Mic, Pencil, Share2, Sparkles, UserRound, Wand2, X, Trash2 } from "lucide-react";
import { api, isLoggedIn, uploadImage, shareFile, downloadPoster, LANGS, uploadAudio, type Profile } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { AddCredits } from "@/components/poster/add-credits";
import { goBack } from "@/lib/nav-back";
import { VideoSteps, CostLine } from "@/components/poster/video-steps";
import { AD_LENGTHS, REALISTIC_MAX_LENGTH, adCredits, EXPLAINER_MAX_MIN, explainerCredits, explainerMinutes } from "@/lib/media/ad-pricing";

type Kind = "long" | "template" | "realistic" | "presenter";
type Job = { id: string; kind?: string; status: string; output_url: string | null; error: string | null; created_at: string; progress?: { text?: string } | null; input?: { title?: string; product?: string; tier?: string } };
type MyProduct = { id: string; name: string; photo_url: string | null; photos?: { url: string; role?: string }[] };

const KINDS: { k: Kind; I: typeof Film; t: string; s: string; len: string }[] = [
  { k: "long", I: Clapperboard, t: "Long video", s: "A long video made from your words. It gets matching AI pictures, your photos, a voice, words on screen and music.", len: `Up to ${EXPLAINER_MAX_MIN} minutes · 10 credits a minute (at least 20)` },
  { k: "template", I: Film, t: "Short ad", s: "Your photos with words on screen and a voice. The fastest and cheapest.", len: "10 to 60 seconds · 20 to 120 credits" },
  { k: "realistic", I: Sparkles, t: "Realistic AI video", s: "Scenes like a film, made by AI around your product.", len: `10 to ${REALISTIC_MAX_LENGTH} seconds · 20 to ${adCredits(REALISTIC_MAX_LENGTH)} credits` },
  { k: "presenter", I: UserRound, t: "Presenter", s: "A photo of a person who speaks your words, looking at the camera.", len: "10 to 60 seconds · 20 to 120 credits" },
];
const MUSIC = [["", "No music"], ["calm-ambient", "Calm"], ["inspiring-motivational", "Inspiring"], ["upbeat-corporate", "Upbeat"], ["indian-sitar", "Indian"], ["festive-diwali", "Festive"]] as const;
const VOICES = [["warm", "Warm (man)"], ["warmf", "Warm (woman)"], ["bright", "Bright"], ["calm", "Calm"]] as const;
const WPM = 150; // Indian speech in these videos, same figure the long-video pricing uses.
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

/** How many scenes a fixed-length ad is cut into — the same steps the AI planner uses, so the engines get what they expect. */
const sceneCount = (kind: Kind, sec: number) =>
  kind === "realistic" ? (sec <= 10 ? 2 : sec <= 20 ? 4 : 6) : sec <= 10 ? 2 : sec <= 20 ? 3 : sec <= 30 ? 4 : sec <= 45 ? 5 : 6;

/** The owner's text → one line per scene: whole sentences, spread as evenly as they divide. */
function toScenes(text: string, n: number): string[] {
  const sentences = String(text).replace(/\s+/g, " ").trim().match(/[^.!?।]+[.!?।]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (!sentences.length) return [];
  const out: string[] = [];
  const per = Math.ceil(sentences.length / n);
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per).join(" ").slice(0, 200));
  return out.slice(0, n);
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

export default function TextToVideo() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("hinglish");
  const [voiceStyle, setVoiceStyle] = useState("warm");
  const [music, setMusic] = useState("calm-ambient");
  const [captions, setCaptions] = useState(true);
  const [seconds, setSeconds] = useState(20);
  const [wide, setWide] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [presenterPhoto, setPresenterPhoto] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [brandId, setBrandId] = useState("");
  const [busy, setBusy] = useState("");
  // Every message sits next to the control that caused it: makeErr right above "Make my video", improveErr under the Improve button,
  // voiceErr under the recording link, photoErr under the photo strip, presenterErr under the presenter photo. Job rows keep their own line.
  const [makeErr, setMakeErr] = useState(""); const [improveErr, setImproveErr] = useState(""); const [voiceErr, setVoiceErr] = useState("");
  const [photoErr, setPhotoErr] = useState(""); const [presenterErr, setPresenterErr] = useState("");
  // textErr: why "Make my video" did nothing for want of (or too many) words — shown right under the words box, not down at the button.
  const [textErr, setTextErr] = useState("");
  const textErrRef = useRef<HTMLParagraphElement | null>(null);
  const presenterBoxRef = useRef<HTMLDivElement | null>(null);
  const [undoText, setUndoText] = useState("");
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ownVoice, setOwnVoice] = useState("");
  const [ownVoiceName, setOwnVoiceName] = useState("");
  const [ownSeconds, setOwnSeconds] = useState(0);        // the recording's length, measured in the browser
  const [stopping, setStopping] = useState("");
  const [deleting, setDeleting] = useState("");
  const [retrying, setRetrying] = useState("");
  const [rowMsg, setRowMsg] = useState<Record<string, { t: string; ok: boolean }>>({});
  const [rowNeed, setRowNeed] = useState<{ id: string; cost: number | null } | null>(null);   // credit packs under the job row whose "Try again" was refused
  const setRow = (id: string, t: string, ok = false) => setRowMsg((m) => ({ ...m, [id]: { t, ok } }));
  const clearRow = (id: string) => { setRowMsg((m) => { const n = { ...m }; delete n[id]; return n; }); setRowNeed((x) => (x?.id === id ? null : x)); };
  const idem = useRef("");

  const brand = useMemo(() => profiles.find((p) => p.id === brandId) ?? null, [profiles, brandId]);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const long = kind === "long";
  // A long video with a recording: the recording sets the length and the price; the text only helps the spelling.
  const withRecording = long && !!ownVoice && ownSeconds > 0;
  const audioMinutes = withRecording ? Math.min(EXPLAINER_MAX_MIN, Math.max(0.5, ownSeconds / 60)) : 0;
  const minutes = useMemo(() => (audioMinutes ? audioMinutes : explainerMinutes(text)), [text, audioMinutes]);
  const cost = long ? (audioMinutes ? Math.max(20, Math.ceil(audioMinutes) * 10) : explainerCredits(text)) : adCredits(seconds);
  const fits = Math.round((seconds / 60) * WPM);
  const tooLong = long ? (withRecording ? ownSeconds > EXPLAINER_MAX_MIN * 60 + 30 : minutes >= EXPLAINER_MAX_MIN && words > EXPLAINER_MAX_MIN * 170) : words > fits * 1.35;
  const tooShort = long ? (withRecording ? false : words < 25) : words < 8;

  async function refresh() {
    const r = await fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
    setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.kind === "explainer" || (j.kind === "ad" && j.input?.tier !== "stock")).slice(0, 6));
    if (typeof r.credits === "number") setCredits(r.credits);
  }

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/text-video"); return; }
    setReady(true); refresh();
    api<{ profiles?: Profile[] }>("/api/poster/profiles").then((r) => {
      const list = r.data.profiles ?? [];
      setProfiles(list);
      setBrandId((list.find((p) => p.is_default) ?? list[0])?.id ?? "");
    }).catch(() => {});
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => {
      const urls = (r.data.products ?? []).flatMap((p) => [...(p.photos ?? []).map((x) => x.url), ...(p.photo_url ? [p.photo_url] : [])]).filter(Boolean);
      setPhotos((g) => (g.length ? g : [...new Set(urls)].slice(0, 6)));
    }).catch(() => {});
  })(); }, [router]);

  // The brand decides the name, number and logo on the video — and the language it is spoken in, the first time.
  useEffect(() => { if (brand?.lang) setLang((l) => (l === "hinglish" ? brand.lang : l)); }, [brand]);
  useEffect(() => { if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return; const t = setInterval(refresh, 6000); return () => clearInterval(t); }, [jobs]);
  useEffect(() => { if (kind === "realistic" && seconds > REALISTIC_MAX_LENGTH) setSeconds(REALISTIC_MAX_LENGTH); }, [kind, seconds]);

  async function addPhoto(file: File | null, as: "slide" | "presenter") {
    if (!file) return;
    const setE = as === "presenter" ? setPresenterErr : setPhotoErr;
    setBusy("img"); setE("");
    let u: string | null = null;
    try { u = await uploadImage(await compressToFile(file, "slide.jpg", 1600, 0.86), "product"); } catch { u = null; }
    setBusy("");
    if (!u) { setE("Could not upload the photo. Please try again."); return; }
    if (as === "presenter") setPresenterPhoto(u); else setPhotos((g) => [...g, u!].slice(0, 12));
  }

  async function improve() {
    setBusy("ai"); setImproveErr("");
    try {
      const r = await fetch("/api/media/refine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang, business: brand?.name ?? "", seconds: long ? 0 : seconds }),
      }).then(async (x) => ({ ok: x.ok, data: (await x.json().catch(() => ({}))) as { text?: string; error?: string } }))
        .catch(() => ({ ok: false, data: { error: OFFLINE } as { text?: string; error?: string } }));
      if (!r.ok || !r.data.text) { setImproveErr(r.data.error || "The AI could not improve this."); return; }
      setUndoText(text);
      setText(r.data.text);
    } finally { setBusy(""); }
  }

  async function addVoice(file: File | null) {
    if (!file) return;
    setBusy("voice"); setVoiceErr("");
    let r: { url?: string | null; error?: string } = {};
    try { r = await uploadAudio(file); } catch { r = { error: OFFLINE }; }
    setBusy("");
    if (!r.url) { setVoiceErr(r.error || "Could not upload that recording."); return; }
    setTextErr(""); setMakeErr("");
    setOwnVoice(r.url); setOwnVoiceName(file.name.replace(/\.[^.]+$/, "").slice(0, 48));
    setOwnSeconds(await audioSeconds(file));
  }

  async function make() {
    if (!kind) return;
    // The button is never silently dead: say what is missing right next to the field to fix (words box / presenter photo) and bring it on screen.
    const missing = tooShort ? (long ? "Write at least 25 words first, or add your own recording." : "Write at least 8 words first.")
      : tooLong ? (long ? `The words are longer than ${EXPLAINER_MAX_MIN} minutes. Please shorten them.` : "The words are too long for this length. Make them shorter, or pick a longer video.")
      : kind === "presenter" && !presenterPhoto ? "Add the photo of the person who will speak first." : "";
    if (missing) {
      setMakeErr("");
      if (tooShort || tooLong) {
        setTextErr(missing); setPresenterErr("");
        setTimeout(() => textErrRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
      } else {
        setTextErr(""); setPresenterErr(missing);
        setTimeout(() => presenterBoxRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
      }
      return;
    }
    setBusy("make"); setMakeErr(""); setTextErr(""); setPresenterErr(""); setNeedCredits(null);
    try {
      const common = { lang, voiceStyle, music, brandName: brand?.name ?? "", phone: brand?.phone ?? "", logoUrl: brand?.logo_url ?? "", accent: brand?.layout?.accent ?? "" };
      const [url, body] = long
        ? ["/api/media/explainer", { ...common, script: text, title: title || topic, photos, voiceUrl: ownVoice || undefined, audioSeconds: ownVoice ? ownSeconds : undefined, style: "images", captions, formats: [wide ? "wide" : "reel"] }]
        : ["/api/media/ad", (() => {
            const lines = toScenes(text, sceneCount(kind, seconds));
            if (!idem.current) idem.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            return {
              ...common, idem: idem.current, tier: kind, length: seconds,
              product: topic || brand?.name || "Our business",
              headline: title || topic || brand?.name || "",
              script: lines, scenes: lines.map((t) => ({ text: t, caption_text: t.slice(0, 80), visual: "", motion: "" })),
              photos: photos.slice(0, 5), formats: [wide ? "wide" : "reel"],
              presenterPhoto: kind === "presenter" ? presenterPhoto : undefined,
            };
          })()];
      const r = await fetch(url as string, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(async (x) => ({ ok: x.ok, status: x.status, data: (await x.json().catch(() => ({}))) as Record<string, unknown> }))
        .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));
      if (!r.ok) {
        setMakeErr(String(r.data.error ?? "") || (r.status === 0 ? OFFLINE : "Could not start the video."));
        if (r.status === 402) setNeedCredits(Math.max(20, Number(r.data.cost) || cost));
        return;
      }
      idem.current = "";
      refresh();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } finally { setBusy(""); }
  }

  // Same video, same job, no second charge: the worker still has the recordings and slides it finished last time,
  // so this carries on rather than starting the script over.
  async function retryJob(j: Job) {
    setRetrying(j.id); clearRow(j.id);
    try {
      const r = await fetch("/api/media/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: j.id }) });
      const d = await r.json().catch(() => ({}));
      // A refused retry (402) shows its credit packs right under THIS video, not in the Make form far above.
      if (!r.ok) { setRow(j.id, d.error || "Could not start it again."); if (r.status === 402) setRowNeed({ id: j.id, cost: Number(d.cost) || null }); return; }
      refresh();
    } catch { setRow(j.id, OFFLINE); }
    finally { setRetrying(""); }
  }

  async function stopJob(j: Job) {
    if (!window.confirm("Stop this video? The credits we have not used yet come back to you.")) return;
    setStopping(j.id); clearRow(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRow(j.id, d.error || "Could not stop it. Please try again."); return; }
      const refunded = typeof d.refunded === "number" ? d.refunded : null;
      setRow(j.id, refunded && refunded > 0 ? `Stopped — ${refunded} credits returned.` : "Stopped. Any credits we did not use have been returned.", true);
      refresh();
    } catch { setRow(j.id, "Could not stop it. Please try again."); }
    finally { setStopping(""); }
  }
  // Gone for good: the video file and the row. Asked for, and confirmed, because there is no undo.
  async function deleteJob(j: Job) {
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    setDeleting(j.id); clearRow(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRow(j.id, d.error || "Could not delete it. Please try again."); return; }
      setJobs((list) => list.filter((x) => x.id !== j.id));
    } catch { setRow(j.id, "Could not delete it. Please try again."); }
    finally { setDeleting(""); }
  }


  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const picked = KINDS.find((x) => x.k === kind);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (kind ? setKind(null) : goBack(router, "/poster/videos"))} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Wand2 className="h-5 w-5 text-brand" /> Video from your words</h1>
        {credits !== null && <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{credits} credits</span>}
      </div>
      <VideoSteps step={!kind ? 1 : !tooShort && !tooLong ? 3 : 2} hi={false} note={!kind ? "short ad, realistic, presenter or long" : !tooShort && !tooLong ? "pictures, voice & music — then Make" : "write what the video should say"} />

      {!kind && (<>
        <p className="text-xs text-muted">You write the words, we make the video. Pick what kind of video you want.</p>
        {KINDS.map((x) => (
          <button key={x.k} type="button" onClick={() => { setKind(x.k); setMakeErr(""); setTextErr(""); setImproveErr(""); setVoiceErr(""); setPhotoErr(""); setPresenterErr(""); }} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><x.I className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{x.t}</span>
              <span className="block text-xs text-muted">{x.s}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-brand-ink">{x.len}</span>
            </span>
          </button>
        ))}
      </>)}

      {kind && picked && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><picked.I className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{picked.t}</span><span className="block text-[11px] text-muted">{picked.len}</span></span>
            <button type="button" onClick={() => setKind(null)} className="text-xs font-semibold text-brand-ink">Change</button>
          </div>

          {profiles.length > 1 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Which business is this video for?</p>
              <div className="flex flex-wrap gap-1.5">
                {profiles.map((p) => <button key={p.id} type="button" onClick={() => setBrandId(p.id)} className={chip(p.id === brandId)}>{p.name}</button>)}
              </div>
              <p className="mt-1 text-[11px] text-muted">Its name, phone number and logo go on the video. Add another under Profiles.</p>
            </div>
          )}

          <input className={inp} placeholder={long ? "Title on the first slide (optional)" : "What is this video about? e.g. Kangen water ionizer"} value={long ? title : topic} onChange={(e) => (long ? setTitle(e.target.value) : setTopic(e.target.value))} maxLength={70} />

          <div>
            <textarea className={`${inp} min-h-48 leading-relaxed`} value={text} onChange={(e) => { setText(e.target.value.slice(0, 9000)); setTextErr(""); }}
              placeholder={long
                ? (ownVoice
                  ? "Optional — we listen to your recording and write the words down ourselves.\n\nPaste the text here only if you want the exact spellings of names and brands in the subtitles."
                  : "What do you want to say?\n\nLeave a blank line between topics — each one becomes a slide.\n\nExample:\nNamaste, I am Rajesh from Sharma Sweets.\n\nWe have been making fresh sweets since 2012…")
                : "What should the video say?\n\nExample:\nGhar ka paani sach mein saaf hai? Humara ionizer aapke paani ko mineral-rich banata hai. Aaj hi free demo book karein."} />
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
              <span className="text-muted">
                {withRecording && <>Recording: {ownSeconds < 60 ? `${Math.round(ownSeconds)} sec` : `${Math.floor(ownSeconds / 60)} min ${Math.round(ownSeconds % 60)} sec`} · </>}
                {words} words
                {words > 0 && !withRecording && (long
                  ? <> · {minutes < 1 ? "under a minute" : `about ${Math.round(minutes * 10) / 10} minutes`}</>
                  : <> · fits about {fits} words in {seconds}s</>)}
              </span>
              <span className={tooLong ? "font-semibold text-danger" : "text-muted"}>
                {tooLong ? (long ? `Longer than ${EXPLAINER_MAX_MIN} minutes — please shorten it` : "Too long for this length. Make it shorter, or tap 'Improve my words'.") : `${cost} credits`}
              </span>
            </div>
            {textErr && (tooShort || tooLong) && <p ref={textErrRef} className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{textErr}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={improve} disabled={!!busy || text.trim().length < 40}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">
                {busy === "ai" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Improve my words · free
              </button>
              {undoText && <button type="button" onClick={() => { setText(undoText); setUndoText(""); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Undo</button>}
            </div>
            {improveErr && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{improveErr}</p>}
            <p className="mt-1 text-[11px] text-muted">The AI only cleans up what you wrote — your facts, your price, your language stay yours.</p>
          </div>

          {!long && (
            <div><p className="mb-1 text-xs font-semibold text-muted">How long</p><div className="flex flex-wrap gap-1.5">
              {AD_LENGTHS.filter((s) => kind !== "realistic" || s <= REALISTIC_MAX_LENGTH).map((s) => (
                <button key={s} type="button" onClick={() => { setSeconds(s); setTextErr(""); }} className={chip(seconds === s)}>{s}s · {adCredits(s)}</button>
              ))}
            </div></div>
          )}

          {long && (<div>
            <p className="mb-1 text-xs font-semibold text-muted">Subtitles</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCaptions(true)} className={chip(captions)}>On — words appear as they are spoken</button>
              <button type="button" onClick={() => setCaptions(false)} className={chip(!captions)}>Off</button>
            </div>
            <p className="mt-1 text-[11px] text-muted">Every video is made the same careful way: an AI picture that matches each point, your own photos where they fit, a slow camera move on each picture, and smooth changes that follow the voice.</p>
          </div>)}

        <div><p className="mb-1 text-xs font-semibold text-muted">Language of the voice</p><div className="flex flex-wrap gap-1.5">{LANGS.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={chip(lang === l.key)}>{l.label}</button>)}</div></div>
          <div>
          <p className="mb-1 text-xs font-semibold text-muted">Voice</p>
          {ownVoice && long ? (
            <div className="flex items-center gap-2 rounded-lg border border-brand bg-brand-soft px-3 py-2 text-xs">
              <Mic className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate font-semibold text-brand-ink">{ownVoiceName || "Your own recording"}</span>
              <button type="button" onClick={() => { setOwnVoice(""); setOwnVoiceName(""); setOwnSeconds(0); setTextErr(""); }} className="shrink-0 text-muted" aria-label="Remove"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">{VOICES.map(([k, l]) => <button key={k} type="button" onClick={() => setVoiceStyle(k)} className={chip(voiceStyle === k)}>{l}</button>)}</div>
          )}
          {long && <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-ink">
            {busy === "voice" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {ownVoice ? "Use a different recording" : "Or use my own recording (mp3)"}
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addVoice(f ?? null); }} />
          </label>}
          {voiceErr && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{voiceErr}</p>}
          {long && <p className="mt-1 text-[11px] text-muted">{ownVoice
            ? "Your recording is the voice of the video, so the video is as long as your recording. You do not need to type anything. We write down what you said and match the pictures to it."
            : "Did you record it yourself, or make it somewhere else? Add it here. We put pictures, photos and music with it."}</p>}
        </div>
          <div><p className="mb-1 text-xs font-semibold text-muted">Music</p><div className="flex flex-wrap gap-1.5">{MUSIC.map(([k, l]) => <button key={k || "none"} type="button" onClick={() => setMusic(k)} className={chip(music === k)}>{l}</button>)}</div></div>
          <div><p className="mb-1 text-xs font-semibold text-muted">Shape</p><div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setWide(true)} className={chip(wide)}>Wide — YouTube, laptop</button>
            <button type="button" onClick={() => setWide(false)} className={chip(!wide)}>Tall — WhatsApp, Reels</button>
          </div>
          {long && <p className="mt-1 text-[11px] text-muted">The pictures are made in this shape, so pick it before you start.</p>}</div>

          {kind === "presenter" && (
            <div ref={presenterBoxRef}>
              <p className="mb-1 text-xs font-semibold text-muted">Photo of the person who will speak</p>
              <div className="flex items-center gap-2">
                {presenterPhoto && (
                  <span className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={presenterPhoto} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => { setPresenterPhoto(""); setPresenterErr(""); }} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove"><X className="h-3 w-3" /></button>
                  </span>
                )}
                <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-border text-muted">
                  {busy === "img" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addPhoto(f ?? null, "presenter"); }} />
                </label>
              </div>
              {presenterErr && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{presenterErr}</p>}
              <p className="mt-1 text-[11px] text-muted">A clear photo looking straight at the camera works best, with the face big in the photo.</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-muted">Your photos <span className="font-normal">— {long ? "shown one after another while the voice speaks" : "used in the scenes"}</span></p>
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
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addPhoto(f ?? null, "slide"); }} />
                </label>
              )}
            </div>
            {photoErr && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{photoErr}</p>}
            <p className="mt-1 text-[11px] text-muted">{long ? "No photos? That is fine. Each slide shows your words on a clean background with your name." : "Your product photos from Products are already here. Remove any you do not want."}</p>
          </div>

          {makeErr && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{makeErr}</p>}
          {needCredits !== null && <AddCredits onDone={() => { setNeedCredits(null); setMakeErr(""); refresh(); }} />}
          <CostLine hi={false} cost={cost} balance={credits} range={`${cost} credits${long ? " (10 a minute, at least 20)" : ` (${seconds} sec · 2 credits a second, at least 20)`}`} />
          <button type="button" onClick={make} disabled={!!busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy === "make" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Starting…</> : <><Sparkles className="h-5 w-5" /> Make my video · {cost} credits</>}
          </button>
          <p className="text-center text-[11px] text-muted">
            {long ? `A ${EXPLAINER_MAX_MIN}-minute video takes about 10–15 minutes to make.` : "Ready in about 2 minutes."} You can close this screen — it will be here in Your videos.
          </p>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Your videos</p>
          {jobs.map((j, jobIdx) => (
            <div key={j.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{j.input?.title || j.input?.product || (j.kind === "explainer" ? "Long video" : "Video")}</span>
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
                    <button type="button" onClick={async () => { clearRow(j.id); setRow(j.id, "Opening share…", true); const r = await shareFile(j.output_url!, j.input?.title || j.input?.product || "My video", "video.mp4", "video/mp4"); if (r === "shared") setRow(j.id, "Shared — pick WhatsApp in the sheet that opened.", true); else if (r === "downloaded") setRow(j.id, "Saved to your Downloads folder.", true); else setRow(j.id, "Not shared. Tap Share to try again, or tap Save.", true); }} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> Share</button>
                    <button type="button" onClick={async () => { clearRow(j.id); setRow(j.id, "Downloading — check your Downloads folder…", true); const ok = await downloadPoster(j.output_url!, "video.mp4"); if (ok) setRow(j.id, "Saved — check your Downloads folder.", true); else setRow(j.id, "Could not save — try again."); }} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm font-semibold"><Download className="h-4 w-4" /> Save</button>
                    <button type="button" onClick={() => deleteJob(j)} disabled={deleting === j.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm font-semibold text-danger disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deleting === j.id ? "…" : "Delete"}</button>
                  </div>
                  {rowMsg[j.id] && <p className={`text-xs ${rowMsg[j.id].ok ? "text-muted" : "font-semibold text-danger"}`}>{rowMsg[j.id].t}</p>}
                  {j.kind === "explainer" && <Link href={`/poster/explainer/edit?id=${j.id}`} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand bg-brand-soft py-2.5 text-sm font-semibold text-brand-ink"><Pencil className="h-4 w-4" /> Edit — change a picture, heading or words</Link>}
                </div>
              )}
              {j.status !== "done" && rowMsg[j.id] && <p className={`text-xs ${rowMsg[j.id].ok ? "text-muted" : "font-semibold text-danger"}`}>{rowMsg[j.id].t}</p>}
              {rowNeed?.id === j.id && <AddCredits need={rowNeed.cost ?? undefined} have={credits ?? 0} onDone={() => { clearRow(j.id); refresh(); }} />}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Want the AI to write the words for you? Try <Link href="/poster/video" className="font-semibold text-brand-ink">Video ad →</Link>
      </p>
    </div>
  );
}
