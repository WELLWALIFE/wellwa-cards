"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { loadSettings, saveSettings, type SiteSettings } from "@/lib/site-settings";
import { AiTextarea } from "@/components/editor/ai-fields";

export default function AdminSite() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setS(loadSettings()); }, []);
  if (!s) return null;

  const patch = (p: Partial<SiteSettings>) => { setS({ ...s, ...p }); setSaved(false); };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
          <p className="text-muted mt-1">Edit the public website without touching code.</p>
        </div>
        <button
          onClick={() => { saveSettings(s); setSaved(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white shadow-card">
          {saved ? <Check className="h-4 w-4" /> : null} {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
        <h2 className="font-semibold text-sm">Homepage hero</h2>
        <label className="block">
          <span className="text-[13px] font-medium mb-1 block text-muted">Headline (first part)</span>
          <input className="ed-input" value={s.heroTitle} onChange={(e) => patch({ heroTitle: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium mb-1 block text-muted">Headline highlight (gradient part)</span>
          <input className="ed-input" value={s.heroHighlight} onChange={(e) => patch({ heroHighlight: e.target.value })} />
        </label>
        <div>
          <span className="text-[13px] font-medium mb-1 block text-muted">Sub-headline</span>
          <AiTextarea value={s.heroSub} onChange={(v) => patch({ heroSub: v })} task="rewrite" minH="min-h-20" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
        <h2 className="font-semibold text-sm">Intro video</h2>
        <label className="block">
          <span className="text-[13px] font-medium mb-1 block text-muted">Video URL (YouTube / Vimeo / .mp4)</span>
          <input className="ed-input" value={s.introVideoUrl} placeholder="https://youtube.com/watch?v=…"
            onChange={(e) => patch({ introVideoUrl: e.target.value })} />
        </label>
        <p className="text-xs text-faint">Shows in the &ldquo;See it in action&rdquo; section on the homepage. Empty = placeholder.</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
        <h2 className="font-semibold text-sm">Announcement bar</h2>
        <label className="block">
          <span className="text-[13px] font-medium mb-1 block text-muted">Message (empty = hidden)</span>
          <input className="ed-input" value={s.announcement} placeholder="🎉 Launch offer: 20% off Pro this month"
            onChange={(e) => patch({ announcement: e.target.value })} />
        </label>
      </section>
    </div>
  );
}
