"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { api, isLoggedIn, currentProfileId, type Profile, type Poster } from "@/lib/poster-client";
import { PosterCard } from "@/components/poster/poster-card";
import { useT } from "@/lib/poster-i18n";

export default function HistoryPage() {
  const [items, setItems] = useState<Poster[] | null>(null);
  const [open, setOpen] = useState<Poster | null>(null);
  const [name, setName] = useState("");
  const { t } = useT();

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { setItems([]); return; }
      const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      const list = pr.data.profiles ?? [];
      const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
      if (!p) { setItems([]); return; }
      setName(p.name);
      const r = await api<{ posters: Poster[] }>(`/api/poster/history?profile=${p.id}`);
      setItems(r.data.posters ?? []);
    })();
  }, []);

  if (items === null) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (open) return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen(null)} className="text-sm text-brand-ink">{t.back}</button>
      <PosterCard poster={open} date={open.for_date ?? ""} caption={`${open.title} — ${name}`} />
    </div>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">{t.oldPosters}</h1>
      {items.length === 0 && <p className="text-sm text-muted">{t.noPosters} <Link href="/poster" className="text-brand-ink">{t.makeToday}</Link></p>}
      <div className="grid grid-cols-2 gap-3">
        {items.map((p) => (
          <button type="button" key={p.id} onClick={() => setOpen(p)} className="text-left rounded-xl overflow-hidden border border-border bg-surface2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.title} className="w-full aspect-[4/5] object-cover" loading="lazy" />
            <div className="p-2">
              <p className="text-xs font-semibold truncate">{p.title}</p>
              <p className="text-[11px] text-muted">{p.for_date} · {p.shares} {t.share}{p.style && p.style !== "classic" ? ` · ${p.style}` : ""}{p.video_url ? " · 🎬" : ""}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
