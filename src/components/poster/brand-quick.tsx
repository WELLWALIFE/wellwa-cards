"use client";
// "Your posters' look" — one small optional box at the end of the set-up's trade screen (owner, 2 Nov 2026: Scalio asks for colours,
// tone and language in the set-up; the owner wants the fewest questions). Nothing to type: the colour starts from the logo (or the
// trade), the tone and the language are already chosen from the trade; a tap changes one and is saved at once (/api/poster/brand).
// The full brand screen (/poster/brand/setup) has the rest.
import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { api, LANGS } from "@/lib/poster-client";
import { PALETTE_PRESETS, TONES, HEX6, type BrandSnapshot } from "@/lib/brand-plan";

type Suggest = { accent: string; tone: string[] };

/** onChange: the screen around it keeps its own copy of the profile and saves it later — it must carry these choices, not the old ones. */
export function BrandQuick({ profileId, hi, onChange }: { profileId: string; hi: boolean; onChange?: (b: { accent: string; palette: string[]; tone: string[]; lang: string }) => void }) {
  const [b, setB] = useState<BrandSnapshot | null>(null);
  const [saved, setSaved] = useState(false);
  const started = useRef("");

  useEffect(() => {
    if (!profileId || started.current === profileId) return;
    started.current = profileId;
    (async () => {
      try {
        const r = await api<{ brand?: BrandSnapshot; suggest?: Suggest }>(`/api/poster/brand?profile=${profileId}&suggest=1`, { fresh: true });
        const br = r.data.brand; if (!r.ok || !br) return;
        const s = r.data.suggest;
        // A brand with nothing chosen yet gets the suggestion as its start — saved, so the first posters already look like the business.
        if (s && (!br.accent || !br.tone.length)) {
          const start = { ...br, accent: br.accent || s.accent, palette: br.palette.length ? br.palette : s.accent ? [s.accent] : [], tone: br.tone.length ? br.tone : s.tone.slice(0, 2) };
          setB(start); onChange?.({ accent: start.accent, palette: start.palette, tone: start.tone, lang: start.lang });
          void api("/api/poster/brand", { method: "POST", json: { profile: profileId, accent: start.accent, palette: start.palette, tone: start.tone } }).catch(() => undefined);
        } else setB(br);
      } catch { /* the box simply does not show */ }
    })();
  }, [profileId]);

  async function save(p: Partial<BrandSnapshot>) {
    if (!b) return;
    const n = { ...b, ...p }; setB(n); setSaved(false); onChange?.({ accent: n.accent, palette: n.palette, tone: n.tone, lang: n.lang });
    try {
      const r = await api("/api/poster/brand", { method: "POST", json: { profile: profileId, accent: n.accent, palette: n.palette, tone: n.tone, lang: n.lang } });
      if (r.ok) setSaved(true);
    } catch { /* the next tap tries again */ }
  }

  if (!b) return null;
  // A steady row (a tapped colour must not jump to the front under the finger): the presets, and the logo's own colour first only when it is not one of them.
  const presetHex = PALETTE_PRESETS.map((c) => c.hex);
  const colours = [...(HEX6.test(b.accent) && !presetHex.includes(b.accent) ? [b.accent] : []), ...presetHex];
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><Palette className="h-4 w-4 text-brand" /> {hi ? "आपके posters का look" : "Your posters' look"} <span className="text-xs font-normal text-muted">{hi ? "· पहले से चुना है, बदलना हो तो tap करें" : "· already chosen — tap to change"}</span>{saved && <Check className="ml-auto h-4 w-4 text-good" />}</p>
      <div className="flex flex-wrap gap-1.5">
        {colours.map((h, i) => <button key={h} type="button" onClick={() => save({ accent: h, palette: [h, ...b.palette.filter((x) => x !== h)].slice(0, 3) })} aria-label={i === 0 && h === b.accent ? (hi ? "मुख्य रंग" : "Main colour") : h} className={`h-8 w-8 rounded-full border-2 ${b.accent === h ? "border-ink" : "border-transparent"}`} style={{ background: h }}>{b.accent === h && <Check className="mx-auto h-4 w-4 text-white" />}</button>)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TONES.slice(0, 8).map((t) => { const on = b.tone.includes(t.key); return <button key={t.key} type="button" onClick={() => save({ tone: on ? b.tone.filter((x) => x !== t.key) : [...b.tone, t.key].slice(-3) })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border"}`}>{hi ? t.hi : t.en}</button>; })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{hi ? "Posts की भाषा:" : "Posts in:"}</span>
        {LANGS.slice(0, 6).map((l) => <button key={l.key} type="button" onClick={() => save({ lang: l.key })} className={`rounded-full border px-2.5 py-1 text-xs ${b.lang === l.key ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border"}`}>{l.label}</button>)}
      </div>
    </div>
  );
}
