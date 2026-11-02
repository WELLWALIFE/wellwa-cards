"use client";
// Home: "Your next posts" (owner, 2 Nov 2026 — better than Scalio's "Ideas for you", where every idea past the first few costs a credit
// to unlock): the month plan's next posts, written for THIS business, free to see and change. No plan yet → one card that makes it.
// And FreePosterPreview: a free account sees today's real poster with the Shubhora mark (/api/poster/today?preview=1&sample=1), not a
// "posters are part of Standard" note.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, LoaderCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/poster-client";
import { KIND_TEXT, type DayKind } from "@/lib/brand-plan";

type Entry = { for_date: string; kind: string; overrides?: { title?: string } | null; brief?: { hook?: string } | null };
const istDay = (n = 0) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const monthOf = (d: string) => d.slice(0, 7);
const nextMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };

function dayLabel(d: string, hi: boolean) {
  if (d === istDay(0)) return hi ? "आज" : "Today";
  if (d === istDay(1)) return hi ? "कल" : "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function NextPosts({ profileId, name, hi }: { profileId?: string; name?: string; hi: boolean }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  useEffect(() => {
    if (!profileId) return;
    let live = true;
    (async () => {
      const today = istDay(0), m = monthOf(today);
      const get = async (month: string) => {
        const r = await api<{ entries?: Entry[] }>(`/api/poster/calendar?profile=${profileId}&month=${month}`).catch(() => null);
        return r?.ok ? r.data.entries ?? [] : [];
      };
      let list = (await get(m)).filter((e) => e.for_date >= today && e.kind !== "skip");
      if (list.length < 4 && monthOf(istDay(10)) !== m) list = list.concat((await get(nextMonth(m))).filter((e) => e.kind !== "skip"));
      if (live) setRows(list.slice(0, 4));
    })();
    return () => { live = false; };
  }, [profileId]);

  if (!profileId) return null;
  if (rows === null) return <section className="grid h-28 place-items-center rounded-3xl border border-border bg-surface shadow-card"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></section>;
  if (!rows.length) return (
    <Link href="/poster/calendar?plan=1" id="home-plan" className="flex items-center gap-3 rounded-3xl border border-brand/30 bg-gradient-to-r from-brand-soft to-surface p-4 shadow-card">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl grad-brand text-white"><CalendarDays className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{hi ? "पूरे महीने के posts प्लान करें" : "Plan your month's posts"}</span>
        <span className="block text-xs text-muted">{name ? (hi ? `${name} के लिए 30 दिन के ideas — free` : `30 days of ideas made for ${name} — free`) : (hi ? "आपके business के लिए 30 दिन के ideas — free" : "30 days of ideas for your business — free")}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card" id="home-next-posts">
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <p className="flex items-center gap-1.5 text-base font-bold"><Sparkles className="h-4 w-4 text-brand" /> {hi ? "आपके अगले posts" : "Your next posts"}</p>
        <Link href="/poster/calendar" className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-ink">{hi ? "पूरा महीना" : "Whole month"} <ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <p className="px-4 text-[11px] text-muted">{hi ? "आपके business के लिए लिखे — कोई भी बदलें" : "Written for your business — change any of them"}</p>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((e) => {
          const k = KIND_TEXT[(e.kind in KIND_TEXT ? e.kind : "auto") as DayKind];
          const line = e.brief?.hook || e.overrides?.title || (hi ? k.hi : k.en);
          return (
            <li key={e.for_date}>
              <Link href="/poster/calendar" className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0 text-xs font-semibold text-muted">{dayLabel(e.for_date, hi)}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface2 text-base" aria-hidden="true">{k.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{line}</span><span className="block text-[11px] text-muted">{hi ? k.hi : k.en}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Today's (or tomorrow's) poster for a free account: the real one, with the Shubhora mark, and one line to take Standard. */
export function FreePosterPreview({ profileId, date, hi }: { profileId: string; date: string; hi: boolean }) {
  const [shot, setShot] = useState<{ url?: string; failed?: boolean; for?: string }>({});
  useEffect(() => {
    let live = true;
    const key = `${profileId}|${date}`;
    void api<{ poster?: { url: string } }>(`/api/poster/today?profile=${profileId}&date=${date}&preview=1&sample=1`, { fresh: true })
      .then((r) => { if (live) setShot(r.ok && r.data.poster ? { url: r.data.poster.url, for: key } : { failed: true, for: key }); })
      .catch(() => { if (live) setShot({ failed: true, for: key }); });
    return () => { live = false; };
  }, [profileId, date]);
  const ready = shot.for === `${profileId}|${date}`;
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card" id="free-poster">
      {ready && shot.url ? (
        <a href={shot.url} target="_blank" rel="noreferrer" className="block">{/* eslint-disable-line @next/next/no-img-element */}<img src={shot.url} alt="" className="aspect-[4/5] w-full object-cover" /></a>
      ) : ready && shot.failed ? null : (
        <div className="grid aspect-[4/5] place-items-center bg-surface2"><LoaderCircle className="h-6 w-6 animate-spin text-brand" /></div>
      )}
      <div className="space-y-2 p-4">
        <p className="text-sm font-semibold">{hi ? "ये poster आपके नाम और नंबर के साथ बना है" : "Made for you — with your name and number"}</p>
        <p className="text-xs text-muted">{hi ? "Standard में बिना निशान, हर सुबह Facebook, Instagram और WhatsApp Status पर अपने-आप।" : "With Standard: no mark, posted every morning to Facebook, Instagram and WhatsApp Status by itself."}</p>
        <Link href="/poster/plan" className="flex items-center justify-center gap-2 rounded-2xl grad-brand py-3 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> {hi ? "रोज़ का poster पाएँ — Standard" : "Get a poster every day — Standard"}</Link>
      </div>
    </div>
  );
}
