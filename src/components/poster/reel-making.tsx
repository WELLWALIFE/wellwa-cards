"use client";
// The screen while a reel is made (owner, 27 Oct 2026: "screen per kuch hota rahana chieye … something moving").
// A phone that plays the reel's own words one by one over a moving background, a voice wave or a film strip for the
// stage the worker is at, a smooth bar with time left, and a new tip every few seconds — never a still screen.
import { useEffect, useState } from "react";
import { Mic, Film, Sparkles, Hourglass } from "lucide-react";

type Scene = { text: string; caption_text?: string };
const EST = 120; // seconds a 15-second reel usually takes
const STAGE = { queued: 0, voice: 1, clips: 2, assemble: 3, done: 4 } as const;
const TIPS_HI = [
  "तैयार होते ही WhatsApp Status पर लगाइए — सबसे पहले आपके ग्राहक देखेंगे।",
  "Caption copy करके Instagram पर reel के साथ डालिए।",
  "🚀 Boost से reel आपके शहर के नए लोगों तक पहुँचती है।",
  "हफ़्ते में 3-4 reels — लोग आपको याद रखते हैं।",
  "आप यह screen बंद कर सकते हैं — reel “मेरी reels” में मिल जाएगी।",
];
const TIPS_EN = [
  "Put it on your WhatsApp Status as soon as it is ready — your customers see it first.",
  "Copy the caption and post it with the reel on Instagram.",
  "🚀 Boost takes the reel to new people in your town.",
  "3-4 reels a week — people remember you.",
  "You can close this screen — the reel will be in “My reels”.",
];

export function ReelMaking({ stage, startedAt, scenes, title, hi }: { stage?: string | null; startedAt: string; scenes: Scene[]; title: string; hi: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  const at = STAGE[(stage ?? "queued") as keyof typeof STAGE] ?? 0;
  // Time moves the bar smoothly; the worker's stage never lets it fall behind. Never 100 until it is done.
  const pct = Math.min(96, Math.max(at * 22 + 4, Math.round((secs / EST) * 92)));
  const leftS = Math.max(10, EST - secs);
  const lines = scenes.length ? scenes : [{ text: title, caption_text: title }];
  const line = lines[Math.floor(secs / 3) % lines.length];
  const tips = hi ? TIPS_HI : TIPS_EN;
  const tip = tips[Math.floor(secs / 6) % tips.length];
  const say = at <= 0 ? (hi ? "शुरू हो रही है…" : "Starting…") : at === 1 ? (hi ? "आवाज़ record हो रही है…" : "Recording the voice…") : at === 2 ? (hi ? "हर line के लिए video ढूँढ रहे हैं…" : "Finding a clip for every line…") : (hi ? "Music और शब्द जोड़ रहे हैं…" : "Adding music and words…");
  const Icon = at <= 0 ? Hourglass : at === 1 ? Mic : at === 2 ? Film : Sparkles;

  return (
    <div className="space-y-4">
      {/* The phone */}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[28px] border-4 border-ink/80 shadow-xl">
        <div className="reel-pan absolute inset-0 bg-[linear-gradient(135deg,#1e1b4b,#7c3aed,#0e9e90,#f59e0b,#1e1b4b)]" />
        {[12, 38, 64, 84].map((x, i) => <span key={x} className="reel-spark absolute bottom-16 text-sm text-white/80" style={{ left: `${x}%`, animationDelay: `${i * 0.6}s` }}>✦</span>)}
        <div className="absolute inset-x-3 top-3 flex items-center gap-1.5 text-[10px] font-semibold text-white/90"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> {hi ? "बन रही है" : "Making"} · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</div>
        {/* the reel's own words, one after another */}
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center">
          <p key={`${line.text}-${Math.floor(secs / 3)}`} className="reel-line text-[15px] font-bold leading-snug text-white drop-shadow">{line.text}</p>
          {line.caption_text && <span key={`c-${Math.floor(secs / 3)}`} className="reel-line mt-2 inline-block rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-ink" style={{ animationDelay: "0.15s" }}>{line.caption_text}</span>}
        </div>
        {/* what the worker is doing, drawn */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
        {at === 2 ? (
          <div className="absolute inset-x-0 bottom-3 overflow-hidden"><div className="reel-film flex w-[200%] gap-1.5">{Array.from({ length: 16 }).map((_, i) => <span key={i} className="h-7 w-10 shrink-0 rounded-sm border border-white/40" style={{ background: ["#f59e0b55", "#0e9e9055", "#7c3aed55", "#ffffff33"][i % 4] }} />)}</div></div>
        ) : (
          <div className="absolute inset-x-0 bottom-3 flex h-8 items-end justify-center gap-1">{Array.from({ length: 13 }).map((_, i) => <span key={i} className="reel-eq w-1 rounded-full bg-white/85" style={{ height: "100%", animationDelay: `${(i % 5) * 0.12}s`, animationDuration: `${0.7 + (i % 3) * 0.2}s` }} />)}</div>
        )}
      </div>

      {/* Where it is */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand"><Icon className="h-4 w-4 animate-pulse" /></span><span className="flex-1">{say}</span><span className="tabular-nums text-brand-ink">{pct}%</span></div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-surface2">
          <div className="grad-brand h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          <div className="reel-sheen absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>
        <p className="text-xs text-muted">{secs > 480 ? (hi ? "यह reel अटक गई लगती है। नीचे “रोक दें” दबाकर फिर बनाइए — credits वापस आ जाएँगे।" : "This reel seems stuck. Tap “Stop” below and make it again — credits come back.") : secs > EST + 60 ? (hi ? "आज थोड़ा ज़्यादा समय लग रहा है — बस आने वाली है।" : "Taking a little longer today — almost there.") : hi ? `लगभग ${leftS > 60 ? `${Math.ceil(leftS / 60)} मिनट` : `${leftS} सेकंड`} बाकी` : `About ${leftS > 60 ? `${Math.ceil(leftS / 60)} min` : `${leftS} s`} left`}</p>
      </div>

      {/* A tip that changes */}
      <p key={tip} className="reel-line rounded-xl border border-brand/20 bg-brand-soft/40 p-3 text-xs text-ink">💡 {tip}</p>
    </div>
  );
}
