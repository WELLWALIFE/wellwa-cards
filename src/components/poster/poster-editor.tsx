"use client";
// Quick editor for the daily poster. Three things on top — a heading, one extra line (an offer), a colour — and they
// change THIS poster only (owner, 14 Oct 2026: "bada complicated bana hua hai"). Everything else (name, phone, language,
// what is shown, daily style) is folded under "More settings" and applies to every poster.
import { useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import { api, LANGS, type Profile, type Layout } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
function Row({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-xs font-semibold text-muted mb-1 block">{label}</span>{children}</label>; }
const SWATCHES = ["#fbbf24", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#22c55e", "#ffffff"];

export function PosterEditor({ profile, onClose, onSaved, date, dayOverrides }: { profile: Profile; onClose: () => void; onSaved: () => void; date?: string; dayOverrides?: { title?: string; custom?: string; accent?: string } | null }) {
  const { lang } = useT(); const en = lang === "en";
  const [l, setL] = useState<Layout>({ ...(profile.layout ?? {}) });
  // Two kinds of change: this ONE day's poster (a heading for today's offer, a colour for the festival) or the
  // owner's standing settings (name, phone, what is shown). The one-day change never touches the settings, so an
  // offer heading typed for Diwali is not still there in January.
  const canDay = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const [dTitle, setDTitle] = useState(dayOverrides?.title ?? "");
  const [dCustom, setDCustom] = useState(dayOverrides?.custom ?? "");
  const [dAccent, setDAccent] = useState(dayOverrides?.accent ?? "");
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [plang, setPlang] = useState(profile.lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [errFor, setErrFor] = useState<"day" | "all">("day"); // which of the two Save buttons the message belongs to
  const set = (p: Partial<Layout>) => setL({ ...l, ...p });
  const toggle = (k: keyof Layout) => setL({ ...l, [k]: l[k] ? undefined : true });

  async function save(which: "day" | "all") {
    setBusy(true); setErr(""); setErrFor(which);
    if (which === "day") {
      const r = await api<{ ok?: boolean; error?: string }>("/api/poster/calendar", { method: "POST", json: { action: "day", profile: profile.id, for_date: date, overrides: { title: dTitle.trim(), custom: dCustom.trim(), accent: dAccent } } });
      setBusy(false);
      if (!r.ok) { setErr(r.data.error || (en ? "Could not save. Please try again." : "Save नहीं हुआ। फिर से कोशिश करें।")); return; }
      onSaved();
      return;
    }
    const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: { ...profile, name, tagline, phone, lang: plang, layout: l } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || (en ? "Could not save. Please try again." : "Save नहीं हुआ। फिर से कोशिश करें।")); return; }
    onSaved();
  }
  const colourRow = (value: string, onPick: (c: string) => void, usual: string) => (
    <div>
      <span className="text-xs font-semibold text-muted mb-1.5 block">{en ? "Colour" : "रंग"}</span>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((c) => <button key={c} type="button" onClick={() => onPick(c)} className={`h-8 w-8 rounded-full border-2 ${value === c ? "border-ink" : "border-border"}`} style={{ background: c }} aria-label={c} />)}
        {value && <button type="button" onClick={() => onPick(usual)} className="text-xs text-muted underline">{en ? "usual colour" : "सामान्य रंग"}</button>}
      </div>
    </div>
  );
  const shows = [["showName", en ? "My name" : "मेरा नाम"], ["showLine", en ? "Short line under my name" : "नाम के नीचे की छोटी लाइन"], ["showPhone", en ? "Phone" : "फ़ोन"], ["showPhoto", en ? "My photo" : "मेरी फ़ोटो"]] as const;
  const settings = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Row label={en ? "Your name" : "आपका नाम"}><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Row>
        <Row label={en ? "Phone" : "फ़ोन"}><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Row>
      </div>
      <Row label={en ? "Business name (shown on the poster)" : "बिज़नेस का नाम (पोस्टर पर यही दिखेगा)"}><input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputCls} /></Row>
      <div>
        <span className="text-xs font-semibold text-muted mb-1 block">{en ? "Language" : "भाषा"}</span>
        <div className="flex flex-wrap gap-1.5">{LANGS.map((lg) => <button key={lg.key} type="button" onClick={() => setPlang(lg.key)} className={`rounded-full border px-2.5 py-1 text-xs ${plang === lg.key ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`}>{lg.label}</button>)}</div>
      </div>
      <div>
        <span className="text-xs font-semibold text-muted mb-1 block">{en ? "Also show on the poster" : "पोस्टर पर और क्या दिखे"}</span>
        <div className="flex flex-wrap gap-2 text-xs">
          {shows.map(([k, label]) => (
            <label key={k} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${l[k] ? "border-brand bg-brand-soft" : "border-border"}`}><input type="checkbox" className="hidden" checked={!!l[k]} onChange={() => toggle(k)} />{l[k] ? "✓ " : ""}{label}</label>
          ))}
        </div>
      </div>
      {colourRow(l.accent ?? "", (c) => set({ accent: c || undefined }), "")}
      <div className="space-y-2 rounded-xl border border-border p-2.5 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!l.varyStyle} onChange={() => set({ varyStyle: l.varyStyle ? undefined : true })} /> <span><b>{en ? "A different style every day" : "रोज़ अलग स्टाइल"}</b></span></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={l.autoStatusVideo !== false} onChange={() => set({ autoStatusVideo: l.autoStatusVideo === false ? undefined : false })} /> <span><b>{en ? "Status video every morning" : "रोज़ सुबह स्टेटस वीडियो"}</b></span></label>
      </div>
      {err && errFor === "all" && <p className="text-xs text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => save("all")} className="w-full rounded-xl border border-brand py-2.5 text-sm font-semibold text-brand-ink disabled:opacity-60">{busy ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : en ? "Save for every poster" : "हर पोस्टर के लिए save करें"}</button>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">✏️ {en ? "Edit poster" : "पोस्टर बदलें"}</h3><button type="button" onClick={onClose} className="rounded-lg p-1 text-muted" aria-label="Close"><X className="h-5 w-5" /></button></div>
        {canDay && (
          <div className="space-y-3">
            <p className="text-xs text-muted">{en ? "Only this poster changes. Other days go back to your usual poster." : "सिर्फ़ यही पोस्टर बदलेगा। बाक़ी दिन पहले जैसे रहेंगे।"}</p>
            <Row label={en ? "Heading" : "हेडिंग"}><input value={dTitle} onChange={(e) => setDTitle(e.target.value.slice(0, 60))} placeholder={en ? "e.g. Grand Opening Offer" : "जैसे: ग्रैंड ओपनिंग ऑफ़र"} className={inputCls} /></Row>
            <Row label={en ? "One more line (offer, timing)" : "एक और लाइन (ऑफ़र, समय)"}><input value={dCustom} onChange={(e) => setDCustom(e.target.value.slice(0, 60))} placeholder={en ? "e.g. Flat 20% off today" : "जैसे: आज 20% छूट"} className={inputCls} /></Row>
            {colourRow(dAccent, setDAccent, "")}
            {err && errFor === "day" && <p className="text-xs text-danger">{err}</p>}
            <button type="button" disabled={busy} onClick={() => save("day")} className="grad-brand w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : en ? "Change this poster" : "यह poster बदलें"}</button>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">{en ? "More settings (every poster)" : "और सेटिंग (हर पोस्टर के लिए)"}</summary>
              <div className="mt-3">{settings}</div>
            </details>
          </div>
        )}
        {!canDay && settings}
      </div>
    </div>
  );
}
