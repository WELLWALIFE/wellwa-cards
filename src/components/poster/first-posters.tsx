"use client";
// "Your first 3 posters" on the set-up's finished screen (owner, 2 Nov 2026 — Scalio makes 3 posts at the end of its set-up and blurs
// them behind a payment; here they are SHOWN, made for this business with its name, number and colours). A free account sees them with
// the Shubhora mark (never saved or posted — /api/poster/today?preview=1&sample=1); a paid one sees the real ones. One tap opens the
// month plan, where every day's post is written and can be changed.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, CalendarDays, Sparkles } from "lucide-react";
import { api, currentProfileId, type Profile } from "@/lib/poster-client";
import { usePlan } from "@/lib/plan";

type Shot = { date: string; url?: string; err?: string };
const ist = (n: number) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

export function FirstPosters({ hi }: { hi: boolean }) {
  const { plan, loading } = usePlan();
  const free = !loading && plan === "free";
  const [shots, setShots] = useState<Shot[]>([{ date: ist(0) }, { date: ist(1) }, { date: ist(2) }]);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    (async () => {
      const r = await api<{ profiles?: Profile[] }>("/api/poster/profiles").catch(() => null);
      const list = r?.data.profiles ?? [];
      const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
      if (!p) { setShots((s) => s.map((x) => ({ ...x, err: "—" }))); return; }
      // one after another: the first appears fast, and the server is never asked for three renders at once
      for (let i = 0; i < 3; i++) {
        const date = ist(i);
        try {
          const q = await api<{ poster?: { url: string }; message?: string; error?: string }>(`/api/poster/today?profile=${p.id}&date=${date}&preview=1&sample=1`, { fresh: true });
          setShots((s) => s.map((x) => x.date === date ? (q.ok && q.data.poster ? { date, url: q.data.poster.url } : { date, err: q.data.message || q.data.error || "—" }) : x));
        } catch { setShots((s) => s.map((x) => x.date === date ? { date, err: "—" } : x)); }
      }
    })();
  }, []);
  if (shots.every((s) => s.err)) return null;   // nothing could be shown: the box stays away rather than showing three errors
  const day = (d: string, i: number) => i === 0 ? (hi ? "आज" : "Today") : i === 1 ? (hi ? "कल" : "Tomorrow") : new Date(d + "T00:00:00").toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "long" });
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
      <div className="flex items-center gap-3 bg-[#12144a] px-4 py-3 text-white">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0"><p className="text-base font-bold leading-tight">{hi ? "आपके पहले 3 posters तैयार हैं" : "Your first 3 posters are ready"}</p><p className="text-[11px] text-white/80">{hi ? "आपके नाम, नंबर और रंग के साथ — हर दिन ऐसा एक नया" : "With your name, number and colours — a new one every day"}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {shots.map((s, i) => (
          <div key={s.date}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-surface2">
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{/* eslint-disable-line @next/next/no-img-element */}<img src={s.url} alt="" className="h-full w-full object-cover" /></a>
                : s.err ? <span className="absolute inset-0 grid place-items-center p-2 text-center text-[10px] text-faint">{hi ? "अभी नहीं बन पाया" : "Not made just now"}</span>
                : <LoaderCircle className="absolute inset-0 m-auto h-5 w-5 animate-spin text-muted" />}
            </div>
            <p className="mt-1 text-center text-[11px] font-semibold text-muted">{day(s.date, i)}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 px-3 pb-3">
        {free && <Link href="/poster/plan" className="flex items-center justify-center gap-2 rounded-2xl grad-brand py-3 text-sm font-semibold text-white">{hi ? "रोज़ ऐसे poster, बिना निशान — Standard लें" : "A poster like this every day, without the mark — take Standard"}</Link>}
        <Link href="/poster/calendar?plan=1" className="flex items-center justify-center gap-2 rounded-2xl border border-border py-2.5 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-brand" /> {hi ? "पूरे महीने के posts देखें और बदलें" : "See and change the whole month's posts"}</Link>
      </div>
    </section>
  );
}
