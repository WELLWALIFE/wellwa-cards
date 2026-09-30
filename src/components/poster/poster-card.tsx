"use client";
import { useEffect, useRef, useState } from "react";
import { Share2, Download, LoaderCircle, Check, Clapperboard, Pencil, Music2, Mic, RefreshCw } from "lucide-react";
import { api, sharePoster, downloadPoster, shareFile, type Poster, type Profile } from "@/lib/poster-client";
import { SocialPostButton } from "@/components/poster/social-post";
import { PosterEditor } from "@/components/poster/poster-editor";
import { STYLE_LIST } from "@/lib/poster-categories";
import { LANGS } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

/** The AI voice on the status video (owner's call, 29 Sep 2026: voice on, 10–15 s, length follows the line); mirrors bridge/poster-video.mjs VOICE_ENABLED. */
const VOICE = true;
const MUSIC = [{ key: "soft", hi: "सॉफ्ट", en: "Soft" }, { key: "festive", hi: "फ़ेस्टिव", en: "Festive" }, { key: "calm", hi: "शांत", en: "Calm" }, { key: "upbeat", hi: "अपबीट", en: "Upbeat" }, { key: "inspiring", hi: "प्रेरक", en: "Inspiring" }, { key: "none", hi: "बिना म्यूज़िक", en: "No music" }];

export function PosterCard({ poster, date, caption, profile, style, onStyle, restyling, onEdited, plan, dayOverrides }: {
  poster: Poster; date: string; caption: string; profile?: Profile | null; style?: string; onStyle?: (s: string) => void; restyling?: boolean; onEdited?: () => void | Promise<void>; plan?: string; dayOverrides?: { title?: string; custom?: string; accent?: string } | null;
}) {
  const [state, setState] = useState<"" | "sharing" | "shared" | "downloaded" | "saving" | "saved" | "failed">("");
  const [editing, setEditing] = useState(false);
  const [video, setVideo] = useState<{ open: boolean; url: string; music: string; busy: boolean; err: string; sharing: boolean; voiceOn: boolean; gender: string; script: string; scriptBusy: boolean; withName: boolean; withPhone: boolean; loaded: boolean; lang: string }>({ open: false, url: poster.video_url ?? "", music: poster.music || "soft", busy: false, err: "", sharing: false, voiceOn: false, gender: "female", script: "", scriptBusy: false, withName: false, withPhone: false, loaded: false, lang: profile?.lang ?? "hi" });
  const { t, lang } = useT(); const en = lang === "en";
  const [bump, setBump] = useState(0);
  // The file's own timestamp keys the picture, so a poster made again under the same name is never the cached old one.
  const src = `${poster.url}?v=${poster.v || `${encodeURIComponent(date)}-${style ?? ""}`}${bump ? `-${bump}` : ""}`;

  async function share() {
    setState("sharing");
    const r = await sharePoster(src, caption);
    if (r !== "failed") api("/api/poster/share", { method: "POST", json: { id: poster.id } }).catch(() => {});
    setState(r === "shared" ? "shared" : r === "downloaded" ? "downloaded" : "failed");
    setTimeout(() => setState(""), 2500);
  }
  async function save() {
    setState("saving");
    const ok = await downloadPoster(src, `shubhora-${date}.jpg`);
    setState(ok ? "saved" : "failed"); setTimeout(() => setState(""), 2500);
  }
  async function openVideo() {
    setVideo((v) => ({ ...v, open: true }));
    if (video.loaded) return;
    setVideo((v) => ({ ...v, scriptBusy: true }));
    const r = await api<{ script: string; gender: string; voice_on: boolean; video_url: string; current_music: string; lang: string }>(`/api/poster/video?poster=${poster.id}`);
    setVideo((v) => ({ ...v, scriptBusy: false, loaded: true, script: r.ok ? r.data.script : "", lang: r.ok && r.data.lang ? r.data.lang : v.lang, gender: r.ok ? r.data.gender : "female", voiceOn: VOICE && r.ok ? r.data.voice_on : false, url: r.ok && r.data.video_url ? r.data.video_url : v.url, music: r.ok ? r.data.current_music : v.music }));
  }
  async function freshScript(withName = video.withName, withPhone = video.withPhone, lang = video.lang) {
    setVideo((v) => ({ ...v, scriptBusy: true, withName, withPhone, lang }));
    const r = await api<{ script: string }>(`/api/poster/video?poster=${poster.id}&fresh=1&lang=${lang}${withName ? "&name=1" : ""}${withPhone ? "&phone=1" : ""}`);
    setVideo((v) => ({ ...v, scriptBusy: false, script: r.ok && r.data.script ? r.data.script : v.script }));
  }
  async function makeVideo(music = video.music) {
    setVideo((v) => ({ ...v, open: true, busy: true, err: "", music }));
    const r = await api<{ video_url?: string; error?: string; message?: string }>("/api/poster/video", { method: "POST", json: { poster_id: poster.id, music, voice: { on: video.voiceOn, gender: video.gender, text: video.script } } });
    setVideo((v) => ({ ...v, busy: false, url: r.ok ? r.data.video_url ?? "" : v.url, err: r.ok ? "" : (r.data.message || r.data.error || "Failed") }));
  }
  // The finished video is fetched in the background the moment it exists, so a tap on Share hands the FILE to
  // WhatsApp (voice + music included) instead of a link — see shareFile.
  const videoBlob = useRef<{ url: string; blob: Blob } | null>(null);
  useEffect(() => {
    const u = video.url;
    if (!u || videoBlob.current?.url === u) return;
    let gone = false;
    fetch(`${u}?v=${date}`, { cache: "no-store" }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (!gone && b) videoBlob.current = { url: u, blob: b }; }).catch(() => {});
    return () => { gone = true; };
  }, [video.url, date]);
  async function shareVideo() {
    setVideo((v) => ({ ...v, sharing: true }));
    const ready = videoBlob.current?.url === video.url ? videoBlob.current.blob : null;
    const r = await shareFile(`${video.url}?v=${date}`, caption, `shubhora-${date}.mp4`, "video/mp4", ready);
    setVideo((v) => ({ ...v, sharing: false, err: r === "downloaded" ? (en ? "Video saved — post it to Status from your gallery." : "वीडियो सेव हो गया — गैलरी से Status पर लगाएँ।") : v.err }));
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface2 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={poster.title} className={`w-full aspect-[4/5] object-cover transition-opacity ${restyling ? "opacity-50" : ""}`} />
        {restyling && <div className="absolute inset-0 grid place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-white drop-shadow" /></div>}
        {profile && onEdited && <button type="button" onClick={() => setEditing(true)} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur"><Pencil className="h-3.5 w-3.5" /> {en ? "Edit" : "बदलें"}</button>}
      </div>

      {onStyle && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {STYLE_LIST.map((s) => (
            <button key={s.key} type="button" disabled={restyling} onClick={() => onStyle(s.key)} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${(style ?? "classic") === s.key ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{s.emoji} {en ? s.en : s.hi}</button>
          ))}
        </div>
      )}

      <button type="button" onClick={share} disabled={state === "sharing"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-semibold text-white disabled:opacity-70">
        {state === "sharing" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : state === "shared" ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
        {state === "shared" ? t.sent : state === "downloaded" ? t.downloaded : state === "failed" ? "❌" : t.shareWa}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={openVideo} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-ink">
          <Clapperboard className="h-4 w-4 text-brand" /> {en ? "Status video" : "स्टेटस वीडियो"}{plan === "free" && <span className="rounded-full bg-good/15 px-1.5 text-[10px] text-good">FREE</span>}
        </button>
        <SocialPostButton posterId={poster.id} />
      </div>
      <button type="button" onClick={save} disabled={state === "saving"} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium disabled:opacity-60">
        {state === "saving" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : state === "saved" ? <Check className="h-4 w-4 text-good" /> : <Download className="h-4 w-4" />} {state === "saved" ? t.downloaded : t.download}
      </button>

      {video.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={() => setVideo((v) => ({ ...v, open: false }))}>
          <div className="w-full max-w-md rounded-t-3xl bg-surface p-4 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base font-bold">🎬 {en ? "Status video (10 s)" : "स्टेटस वीडियो (10 सेकंड)"}</h3>
            <div className="mx-auto aspect-[9/16] max-h-[52dvh] overflow-hidden rounded-2xl bg-black">
              {video.busy ? <div className="grid h-full place-items-center text-white/80"><div className="text-center text-sm"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />{en ? "Making your video…" : "आपका वीडियो बन रहा है…"}</div></div>
                : video.url ? <video src={`${video.url}?v=${date}-${video.music}-${video.voiceOn ? 1 : 0}`} className="h-full w-full" controls autoPlay playsInline loop /> : <div className="grid h-full place-items-center px-6 text-center text-sm text-white/70">{video.err || (en ? "Choose music & voice, then tap Make video" : "म्यूज़िक और आवाज़ चुनें, फिर 'वीडियो बनाएँ' दबाएँ")}</div>}
            </div>
            {VOICE && <div className="mt-3 rounded-xl border border-border p-2.5 text-xs">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={video.voiceOn} disabled={plan === "free"} onChange={(e) => setVideo((v) => ({ ...v, voiceOn: e.target.checked }))} /><Mic className="h-3.5 w-3.5 text-brand" /> {en ? "Voice greeting (AI, premium voice)" : "आवाज़ में शुभकामना (AI, premium voice)"}{plan === "free" && <span className="rounded-full bg-[#12144a] px-1.5 text-[10px] text-white">Growth</span>}</label>
              {video.voiceOn && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1">{LANGS.map((l) => <button key={l.key} type="button" disabled={video.scriptBusy} onClick={() => freshScript(video.withName, video.withPhone, l.key)} className={`rounded-full border px-2 py-0.5 ${video.lang === l.key ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border text-muted"}`}>{l.label}</button>)}</div>
                  <div className="flex flex-wrap gap-1.5">{([["female", en ? "Female · Aoede" : "महिला · Aoede"], ["female2", en ? "Female · Kore" : "महिला · Kore"], ["male", en ? "Male · Charon" : "पुरुष · Charon"], ["male2", en ? "Male · Algieba" : "पुरुष · Algieba"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setVideo((v) => ({ ...v, gender: k }))} className={`rounded-full border px-2 py-0.5 ${video.gender === k ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border text-muted"}`}>{l}</button>)}</div>
                  <textarea value={video.script} onChange={(e) => setVideo((v) => ({ ...v, script: e.target.value }))} rows={3} placeholder={video.scriptBusy ? (en ? "Writing…" : "लिख रहे हैं…") : (en ? "What the voice says" : "आवाज़ क्या बोलेगी")} className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm" />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={video.withName} onChange={(e) => freshScript(e.target.checked, video.withPhone)} /> {en ? "say my name" : "मेरा नाम बोले"}</label>
                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={video.withPhone} onChange={(e) => freshScript(video.withName, e.target.checked)} /> {en ? "say phone" : "फ़ोन बोले"}</label>
                    <button type="button" disabled={video.scriptBusy} onClick={() => freshScript()} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-muted"><RefreshCw className={`h-3 w-3 ${video.scriptBusy ? "animate-spin" : ""}`} /> {en ? "New script" : "नया script"}</button>
                  </div>
                  <p className="text-[11px] text-faint">{en ? "Default: wish + your brand name only (viewers already know you). Music ducks under the voice." : "डिफ़ॉल्ट: शुभकामना + सिर्फ़ ब्रांड का नाम (देखने वाले आपको जानते हैं)। आवाज़ के नीचे म्यूज़िक अपने-आप धीमा।"}</p>
                </div>
              )}
            </div>}
            {video.err && !video.busy && <p className="mt-2 text-xs text-danger">{video.err}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs"><Music2 className="h-3.5 w-3.5 text-muted" />
              {MUSIC.map((m) => <button key={m.key} type="button" disabled={video.busy} onClick={() => setVideo((v) => ({ ...v, music: m.key }))} className={`rounded-full border px-2.5 py-1 ${video.music === m.key ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border text-muted"}`}>{en ? m.en : m.hi}</button>)}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setVideo((v) => ({ ...v, open: false }))} className="rounded-xl border border-border px-3 py-2.5 text-sm text-muted">{en ? "Close" : "बंद"}</button>
              <button type="button" disabled={video.busy || (video.voiceOn && video.script.trim().length < 3)} onClick={() => makeVideo()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Clapperboard className="h-4 w-4" /> {en ? "Make video" : "वीडियो बनाएँ"}</button>
              <button type="button" disabled={!video.url || video.busy || video.sharing} onClick={shareVideo} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{video.sharing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} {en ? "Share" : "Share"}</button>
            </div>
          </div>
        </div>
      )}
      {editing && profile && onEdited && <PosterEditor profile={profile} date={date} dayOverrides={dayOverrides} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await onEdited(); setBump(Date.now()); }} />}
    </div>
  );
}
