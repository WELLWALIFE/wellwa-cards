"use client";

// Marketing-site pieces whose content the owner edits from /admin/site & /admin/plans.
// SSR renders defaults; after mount, localStorage overrides apply.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Play, Megaphone } from "lucide-react";
import { loadSettings, defaultSettings, type SiteSettings } from "@/lib/site-settings";

function useSiteSettings(): SiteSettings {
  const [s, setS] = useState<SiteSettings>(defaultSettings);
  useEffect(() => { setS(loadSettings()); }, []);
  return s;
}

export function AnnouncementBar() {
  const s = useSiteSettings();
  if (!s.announcement) return null;
  return (
    <div className="grad-brand text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
      <Megaphone className="h-4 w-4 shrink-0" />
      <span className="font-medium">{s.announcement}</span>
    </div>
  );
}

export function HeroCopy() {
  const s = useSiteSettings();
  return (
    <>
      <h1 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.03]">
        {s.heroTitle} <span className="grad-text">{s.heroHighlight}</span>.
      </h1>
      <p className="mt-5 text-lg text-white/70 max-w-xl">{s.heroSub}</p>
    </>
  );
}

function videoEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: "iframe" as const, src: `https://www.youtube.com/embed/${yt[1]}` };
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { type: "iframe" as const, src: `https://player.vimeo.com/video/${vim[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { type: "video" as const, src: url };
  return null;
}

export function IntroVideo() {
  const s = useSiteSettings();
  const e = s.introVideoUrl ? videoEmbed(s.introVideoUrl) : null;

  if (e?.type === "iframe") {
    return (
      <div className="mt-8 rounded-2xl overflow-hidden border border-border shadow-float aspect-video">
        <iframe src={e.src} title="Intro video" className="w-full h-full" allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
      </div>
    );
  }
  if (e?.type === "video") {
    return (
      <div className="mt-8 rounded-2xl overflow-hidden border border-border shadow-float aspect-video">
        <video src={e.src} controls className="w-full h-full bg-black" />
      </div>
    );
  }
  return (
    <div className="mt-8 group relative rounded-2xl overflow-hidden border border-border shadow-float aspect-video grid place-items-center"
      style={{ background: "linear-gradient(135deg, #080a2c, #2f5bf5 130%)" }}>
      <span className="h-16 w-16 rounded-full bg-white/95 grid place-items-center shadow-float group-hover:scale-105 transition-transform">
        <Play className="h-7 w-7 translate-x-0.5 text-ink" fill="currentColor" />
      </span>
      <span className="absolute bottom-3 right-3 text-[11px] mono text-white/70">Set your intro video in Admin → Site settings</span>
    </div>
  );
}

export function PlansGrid() {
  const s = useSiteSettings();
  return (
    <div className={`grid gap-5 mx-auto ${s.plans.length >= 3 ? "md:grid-cols-3 max-w-5xl" : "md:grid-cols-2 max-w-3xl"}`}>
      {s.plans.map((p) => (
        <div key={p.name}
          className={`rounded-2xl border bg-surface p-6 flex flex-col ${p.hot ? "border-brand ring-1 ring-brand" : "border-border"}`}>
          {p.hot && (
            <span className="self-start mono text-[10px] font-bold uppercase text-white bg-brand rounded px-2 py-0.5 mb-3">
              Most popular
            </span>
          )}
          <h2 className="font-semibold text-lg">{p.name}</h2>
          <p className="text-sm text-muted">{p.tagline}</p>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{p.price}</span>
            <span className="text-sm text-muted">{p.period}</span>
          </div>
          <ul className="mt-5 space-y-2.5 flex-1">
            {p.features.filter(Boolean).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" /> {f}
              </li>
            ))}
          </ul>
          <Link
            href={p.price.startsWith("₹") ? "/signup" : "/contact"}
            className={`mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${
              p.hot ? "bg-brand text-white hover:opacity-90" : "border border-border hover:bg-surface2"
            }`}>
            {p.price.startsWith("₹") ? "Start free" : "Contact for pricing"}
          </Link>
        </div>
      ))}
    </div>
  );
}
