"use client";
// THE SCENE EDITOR. A finished long video, scene by scene: change a picture (AI to your own words, your own photo,
// another picture from the film, or just the words), the heading, the camera move, the subtitles; rewrite a
// paragraph (the AI says it again, or only the subtitles change); replace a paragraph of your own recording.
// Apply, and only the scenes you touched are made again — the video keeps playing until the new cut is ready.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImagePlus, Images, LoaderCircle, Mic, Pencil, Sparkles, Type, X } from "lucide-react";
import { api, isLoggedIn, uploadAudio, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { AddCredits } from "@/components/poster/add-credits";

type Para = { p: number; text: string; start: number; end: number };
type Shot = { i: number; unit: number; para: number; start: number; sec: number; text: string; heading: string; kind: string; picture: string | null; frame: string; subject: string; moment: string; move: string | null; tight: boolean; captions: boolean };
type Manifest = { fmt: string; W: number; H: number; total: number; title: string; voice: "own" | "ai" | "none"; captions?: boolean; paragraphs: Para[]; shots: Shot[] };
type Data = {
  job: { id: string; status: string; output_url: string | null; error: string | null; progress: { text?: string } | null; title: string; fmt: string; voice: "own" | "ai" | "none"; seconds: number; edits: number; editing: boolean; lastEditError: string | null; busy: boolean };
  editable: boolean; manifest: Manifest | null; pictures: { file: string; url: string }[]; base: string; credits: number; prices: { picture: number; voice: number };
};
type PicEdit = { mode: "regen"; frame: string; subject: string; moment: string } | { mode: "own"; url: string; name?: string } | { mode: "pick"; from: string } | { mode: "card" };
type SceneEdit = { heading?: string; move?: string; captions?: boolean; picture?: PicEdit };
type ParaEdit = { text?: string; revoice?: boolean; voiceUrl?: string; voiceName?: string };

const MOVES: [string, string][] = [["", "Auto"], ["push", "Push in"], ["pull", "Pull out"], ["push-left", "Push in, left"], ["push-right", "Push in, right"], ["pan-right", "Pan right"], ["pan-left", "Pan left"], ["tilt-down", "Tilt down"]];
const FRAMES: [string, string][] = [["object", "A thing, close up"], ["hands", "Hands doing it"], ["screen", "A phone or laptop (screen unreadable)"], ["place", "The place itself"], ["pair", "Two things side by side"], ["person", "One person, at work"]];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const OFFLINE = "No internet — please try again.";

function EditorInner() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<Data | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [paras, setParas] = useState<Record<number, ParaEdit>>({});
  const [scenes, setScenes] = useState<Record<number, SceneEdit>>({});
  const [open, setOpen] = useState<Record<number, "pic" | null>>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);

  async function load() {
    const r = await api<Data & { error?: string }>(`/api/media/explainer/edit?id=${encodeURIComponent(id)}`);
    if (!r.ok) { setLoadErr(r.data.error || (r.status === 0 ? OFFLINE : "Could not open this video.")); return; }
    setData(r.data);
  }
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push(`/login?next=${encodeURIComponent(`/poster/explainer/edit?id=${id}`)}`); return; }
    if (!/^[0-9a-f-]{36}$/i.test(id)) { setLoadErr("Which video? Open the editor from Your videos."); return; }
    load();
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);
  // While the worker is applying an edit, the page follows along.
  useEffect(() => { if (!data?.job.busy) return; const t = setInterval(load, 6000); return () => clearInterval(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.job.busy]);

  const m = data?.manifest ?? null;
  const voice = data?.job.voice ?? "ai";
  const picUrl = (file: string | null) => (file && data ? `${data.base}/${file}` : "");

  // What the owner has changed so far, and what it will cost.
  const summary = useMemo(() => {
    if (!m) return { changes: 0, credits: 0, pictures: 0, voices: 0 };
    let changes = 0, pictures = 0, voices = 0;
    if (title !== null && title.trim() !== (m.title ?? "")) changes++;
    for (const [k, e] of Object.entries(paras)) {
      const p = m.paragraphs[Number(k)]; if (!p) continue;
      const textChanged = e.text !== undefined && e.text.trim() !== p.text.trim();
      const again = voice === "ai" && (e.revoice === true || (textChanged && e.revoice !== false));
      if (textChanged || again || e.voiceUrl) changes++;
      if (again) voices++;
    }
    for (const [k, e] of Object.entries(scenes)) {
      const s = m.shots[Number(k)]; if (!s) continue;
      const touched = (e.heading !== undefined && e.heading.trim() !== (s.heading ?? "")) || (e.move !== undefined && e.move !== (s.move ?? "") && e.move !== "") || e.captions === false || !!e.picture;
      if (touched) changes++;
      if (e.picture?.mode === "regen") pictures++;
    }
    return { changes, credits: pictures * (data?.prices.picture ?? 1) + voices * (data?.prices.voice ?? 1), pictures, voices };
  }, [m, title, paras, scenes, voice, data?.prices]);

  const setScene = (i: number, patch: Partial<SceneEdit>) => setScenes((all) => ({ ...all, [i]: { ...(all[i] ?? {}), ...patch } }));
  const setPara = (p: number, patch: Partial<ParaEdit>) => setParas((all) => ({ ...all, [p]: { ...(all[p] ?? {}), ...patch } }));
  const clearPicture = (i: number) => setScenes((all) => { const e = { ...(all[i] ?? {}) }; delete e.picture; return { ...all, [i]: e }; });

  async function sceneUpload(i: number, file: File | null) {
    if (!file) return;
    setBusy(`pic-${i}`); setErr("");
    const u = await uploadImage(await compressToFile(file, "scene.jpg", 1920, 0.88), "wide");
    setBusy("");
    if (!u) { setErr("Could not upload the photo. Please try again."); return; }
    setScene(i, { picture: { mode: "own", url: u, name: file.name } });
    setOpen((o) => ({ ...o, [i]: null }));
  }
  async function paraUpload(p: number, file: File | null) {
    if (!file) return;
    setBusy(`voice-${p}`); setErr("");
    const r = await uploadAudio(file);
    setBusy("");
    if (!r.url) { setErr(r.error || "Could not upload that recording."); return; }
    setPara(p, { voiceUrl: r.url, voiceName: file.name.replace(/\.[^.]+$/, "").slice(0, 40) });
  }

  async function apply() {
    if (!m || !summary.changes) return;
    setBusy("apply"); setErr(""); setNeedCredits(null);
    try {
      const body = {
        id,
        edits: {
          title: title ?? undefined,
          paragraphs: Object.fromEntries(Object.entries(paras).map(([k, e]) => [k, { text: e.text, revoice: e.revoice, voiceUrl: e.voiceUrl }])),
          scenes: Object.fromEntries(Object.entries(scenes).map(([k, e]) => [k, { heading: e.heading, move: e.move || undefined, captions: e.captions, picture: e.picture }])),
        },
      };
      const r = await fetch("/api/media/explainer/edit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(async (x) => ({ ok: x.ok, status: x.status, data: (await x.json().catch(() => ({}))) as { error?: string; cost?: number; credits?: number } }))
        .catch(() => ({ ok: false, status: 0, data: {} as { error?: string; cost?: number } }));
      if (!r.ok) {
        setErr(r.data.error || (r.status === 0 ? OFFLINE : "Could not apply the changes."));
        if (r.status === 402) setNeedCredits(Number(r.data.cost) || summary.credits);
        return;
      }
      setApplied(true);
      setTimeout(() => router.push("/poster/explainer"), 1800);
    } finally { setBusy(""); }
  }

  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const small = "rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold";

  if (loadErr) return (
    <div className="space-y-3">
      <Link href="/poster/explainer" className="inline-flex items-center gap-1 text-sm text-muted"><ChevronLeft className="h-4 w-4" /> Your videos</Link>
      <p className="text-sm text-danger">{loadErr}</p>
    </div>
  );
  if (!data) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4 pb-44">
      <div className="flex items-center gap-2">
        <Link href="/poster/explainer" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Pencil className="h-5 w-5 text-brand" /> Edit video</h1>
        <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{data.credits} credits</span>
      </div>

      {data.job.busy && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> {data.job.progress?.text || "Working on your video…"}</p>
          <p className="text-xs text-muted">{data.job.editing ? "Your changes are being applied. Only the scenes you touched are made again; the old video stays until the new one is ready." : "This video is still being made. Come back when it is done."}</p>
          <Link href="/poster/explainer" className="inline-block text-xs font-semibold text-brand-ink">Back to Your videos</Link>
        </div>
      )}

      {!data.job.busy && !data.editable && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm">This video was made before the editor existed, so its scenes are not on file.</p>
          <p className="text-xs text-muted">Videos made from now on can be edited scene by scene. To edit this one, make it again.</p>
        </div>
      )}

      {!data.job.busy && data.editable && m && (
        <>
          {data.job.lastEditError && <p className="rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-danger">Last edit could not be applied — {data.job.lastEditError} The video is as it was.</p>}
          {data.job.output_url && <video src={data.job.output_url} controls playsInline className="w-full rounded-lg bg-black" />}
          <p className="text-xs text-muted">{mmss(m.total)} · {m.paragraphs.length} paragraphs · {m.shots.length} scenes · {voice === "own" ? "your own recording" : voice === "ai" ? "AI voice" : "no voice"}{data.job.edits ? ` · edited ${data.job.edits}×` : ""}</p>

          <div className="space-y-1 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold text-muted">Title on the first card</p>
            <input className={inp} value={title ?? m.title ?? ""} onChange={(e) => setTitle(e.target.value.slice(0, 70))} placeholder="No title card" maxLength={70} />
          </div>

          {m.paragraphs.map((para) => {
            const pe = paras[para.p] ?? {};
            const text = pe.text ?? para.text;
            const textChanged = text.trim() !== para.text.trim();
            const shots = m.shots.filter((s) => s.para === para.p);
            return (
              <div key={para.p} className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">Paragraph {para.p + 1}</p>
                  <span className="text-xs text-muted">{mmss(para.start)} – {mmss(para.end)}</span>
                </div>
                <textarea className={`${inp} min-h-24 leading-relaxed`} value={text} onChange={(e) => setPara(para.p, { text: e.target.value.slice(0, 1500) })} />
                {voice === "ai" && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {textChanged ? (
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input type="checkbox" checked={pe.revoice !== false} onChange={(e) => setPara(para.p, { revoice: e.target.checked })} />
                        Say the new words with the AI voice ({data.prices.voice} credit) — unticked: subtitles only, the old voice stays
                      </label>
                    ) : (
                      <button type="button" onClick={() => setPara(para.p, { revoice: !pe.revoice })} className={chip(!!pe.revoice)}><Mic className="mr-1 inline h-3.5 w-3.5" />{pe.revoice ? `Will be spoken again (${data.prices.voice} credit)` : `Say it again (${data.prices.voice} credit)`}</button>
                    )}
                  </div>
                )}
                {voice === "own" && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {textChanged && <span className="text-muted">New words go into the subtitles; your recording stays.</span>}
                    {pe.voiceUrl ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand-soft px-2.5 py-1.5 font-semibold text-brand-ink"><Mic className="h-3.5 w-3.5" /> New recording: {pe.voiceName || "uploaded"} <button type="button" onClick={() => setPara(para.p, { voiceUrl: undefined, voiceName: undefined })} aria-label="Remove"><X className="h-3.5 w-3.5" /></button></span>
                    ) : (
                      <label className={`${small} inline-flex cursor-pointer items-center gap-1.5`}>
                        {busy === `voice-${para.p}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />} Replace this paragraph&apos;s recording
                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; paraUpload(para.p, f ?? null); }} />
                      </label>
                    )}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  {shots.map((s) => {
                    const e = scenes[s.i] ?? {};
                    const pic = e.picture;
                    const thumb = pic?.mode === "own" ? pic.url : pic?.mode === "pick" ? picUrl(pic.from) : pic?.mode === "card" || pic?.mode === "regen" ? "" : picUrl(s.picture);
                    const isOpen = open[s.i] === "pic";
                    return (
                      <div key={s.i} className="space-y-2 rounded-lg border border-border p-2">
                        <div className="flex gap-2">
                          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-[#141a22]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] text-white/70">{pic?.mode === "regen" ? "new AI picture" : "words card"}</div>}
                            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10px] text-white">{mmss(s.start)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">Scene {s.i + 1} <span className="font-normal text-muted">· {s.sec.toFixed(0)}s{s.kind === "reframe" ? " · same picture, closer" : s.kind === "stand-in" ? " · borrowed picture" : s.kind === "photo" ? " · your photo" : s.kind === "card" ? " · words" : ""}</span></p>
                            <p className="line-clamp-2 text-[11px] text-muted">{s.text}</p>
                          </div>
                        </div>
                        <input className={inp} value={e.heading ?? s.heading ?? ""} onChange={(ev) => setScene(s.i, { heading: ev.target.value.slice(0, 60) })} placeholder="Heading on this scene (empty = none)" maxLength={60} />
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setOpen((o) => ({ ...o, [s.i]: isOpen ? null : "pic" }))} className={`${small} inline-flex items-center gap-1`}><Images className="h-3.5 w-3.5" /> {pic ? "Picture changed" : "Change picture"}</button>
                          <select className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs" value={e.move ?? s.move ?? ""} onChange={(ev) => setScene(s.i, { move: ev.target.value })} aria-label="Camera move">
                            {MOVES.map(([k, l]) => <option key={k} value={k}>{k ? `Camera: ${l}` : "Camera: auto"}</option>)}
                          </select>
                          {s.captions && (
                            <button type="button" onClick={() => setScene(s.i, { captions: e.captions === false ? undefined : false })} className={chip(e.captions !== false)}>{e.captions === false ? "Subtitles off here" : "Subtitles on"}</button>
                          )}
                          {pic && <button type="button" onClick={() => clearPicture(s.i)} className={`${small} text-muted`}>Keep old picture</button>}
                        </div>
                        {isOpen && (
                          <div className="space-y-2 rounded-lg bg-surface2 p-2">
                            <p className="text-[11px] font-semibold text-muted">New picture for this scene</p>
                            <div className="space-y-1.5 rounded-md border border-border bg-surface p-2">
                              <p className="text-xs font-semibold"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand" />Made by AI to your words · {data.prices.picture} credit</p>
                              <select className={inp} value={pic?.mode === "regen" ? pic.frame : s.frame || "object"} onChange={(ev) => setScene(s.i, { picture: { mode: "regen", frame: ev.target.value, subject: pic?.mode === "regen" ? pic.subject : s.subject || "", moment: pic?.mode === "regen" ? pic.moment : s.moment || "" } })}>
                                {FRAMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                              </select>
                              <input className={inp} placeholder="What is in the picture (e.g. a shopkeeper's counter with a card machine)" value={pic?.mode === "regen" ? pic.subject : ""} onFocus={() => { if (pic?.mode !== "regen") setScene(s.i, { picture: { mode: "regen", frame: s.frame || "object", subject: s.subject || "", moment: s.moment || "" } }); }} onChange={(ev) => setScene(s.i, { picture: { mode: "regen", frame: pic?.mode === "regen" ? pic.frame : s.frame || "object", subject: ev.target.value.slice(0, 240), moment: pic?.mode === "regen" ? pic.moment : s.moment || "" } })} maxLength={240} />
                              <input className={inp} placeholder="What is happening (optional)" value={pic?.mode === "regen" ? pic.moment : ""} onFocus={() => { if (pic?.mode !== "regen") setScene(s.i, { picture: { mode: "regen", frame: s.frame || "object", subject: s.subject || "", moment: s.moment || "" } }); }} onChange={(ev) => setScene(s.i, { picture: { mode: "regen", frame: pic?.mode === "regen" ? pic.frame : s.frame || "object", subject: pic?.mode === "regen" ? pic.subject : s.subject || "", moment: ev.target.value.slice(0, 240) } })} maxLength={240} />
                              {s.subject && pic?.mode !== "regen" && <p className="text-[11px] text-muted">Current order: {s.subject}{s.moment ? ` — ${s.moment}` : ""}</p>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <label className={`${small} inline-flex cursor-pointer items-center gap-1`}>
                                {busy === `pic-${s.i}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Upload my photo
                                <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; sceneUpload(s.i, f ?? null); }} />
                              </label>
                              <button type="button" onClick={() => { setScene(s.i, { picture: { mode: "card" } }); setOpen((o) => ({ ...o, [s.i]: null })); }} className={`${small} inline-flex items-center gap-1`}><Type className="h-3.5 w-3.5" /> Just the words</button>
                            </div>
                            {data.pictures.length > 0 && (
                              <div>
                                <p className="mb-1 text-[11px] font-semibold text-muted">Or another picture from this video</p>
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                  {data.pictures.map((p) => (
                                    <button key={p.file} type="button" onClick={() => { setScene(s.i, { picture: { mode: "pick", from: p.file } }); setOpen((o) => ({ ...o, [s.i]: null })); }} className={`h-14 w-24 shrink-0 overflow-hidden rounded-md border-2 ${pic?.mode === "pick" && pic.from === p.file ? "border-brand" : p.file === s.picture ? "border-border opacity-60" : "border-transparent"}`}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {err && <p className="text-sm text-danger">{err}</p>}
          {needCredits !== null && <AddCredits onDone={() => { setNeedCredits(null); load(); }} />}

          {/* Above the app's bottom navigation, not over it. */}
          <div className="fixed bottom-[64px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 p-3 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-semibold">{summary.changes ? `${summary.changes} change${summary.changes === 1 ? "" : "s"}` : "No changes yet"}</p>
                <p className="text-muted">{summary.credits ? `${summary.credits} credit${summary.credits === 1 ? "" : "s"} — ${summary.pictures ? `${summary.pictures} new AI picture${summary.pictures === 1 ? "" : "s"}` : ""}${summary.pictures && summary.voices ? ", " : ""}${summary.voices ? `${summary.voices} paragraph${summary.voices === 1 ? "" : "s"} spoken again` : ""}` : "Free — remaking the scenes costs nothing"}</p>
              </div>
              <button type="button" onClick={apply} disabled={!summary.changes || !!busy || applied}
                className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy === "apply" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Starting…</> : applied ? "Applying — see Your videos" : <><Sparkles className="h-4 w-4" /> Apply &amp; remake</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function EditLongVideo() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><EditorInner /></Suspense>;
}
