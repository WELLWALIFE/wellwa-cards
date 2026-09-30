"use client";
// Quick editor for the daily poster: text, accent colour, name size, photo
// side, show/hide parts. Saves to the profile's layout (applies to every
// future poster too) and re-renders today's poster.
import { useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import { api, LANGS, type Profile, type Layout } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
function Row({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-xs font-semibold text-muted mb-1 block">{label}</span>{children}</label>; }
const SWATCHES = ["#7fe3d6", "#fbbf24", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#22c55e", "#ffffff", "#ff9933"];

export function PosterEditor({ profile, onClose, onSaved, date, dayOverrides }: { profile: Profile; onClose: () => void; onSaved: () => void; date?: string; dayOverrides?: { title?: string; custom?: string; accent?: string } | null }) {
  const { lang } = useT(); const en = lang === "en";
  const [l, setL] = useState<Layout>({ ...(profile.layout ?? {}) });
  // Two kinds of change: this ONE day's poster (a heading for today's offer, a colour for the festival) or the
  // owner's standing settings (name, phone, what is shown). The one-day change never touches the settings, so an
  // offer heading typed for Diwali is not still there in January.
  const canDay = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const [scope, setScope] = useState<"day" | "all">(canDay ? "day" : "all");
  const [dTitle, setDTitle] = useState(dayOverrides?.title ?? "");
  const [dCustom, setDCustom] = useState(dayOverrides?.custom ?? "");
  const [dAccent, setDAccent] = useState(dayOverrides?.accent ?? "");
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [plang, setPlang] = useState(profile.lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p: Partial<Layout>) => setL({ ...l, ...p });
  const toggle = (k: keyof Layout) => setL({ ...l, [k]: l[k] ? undefined : true });

  async function save() {
    setBusy(true); setErr("");
    if (scope === "day") {
      const r = await api<{ ok?: boolean; error?: string }>("/api/poster/calendar", { method: "POST", json: { action: "day", profile: profile.id, for_date: date, overrides: { title: dTitle.trim(), custom: dCustom.trim(), accent: dAccent } } });
      setBusy(false);
      if (!r.ok) { setErr(r.data.error || "Could not save."); return; }
      onSaved();
      return;
    }
    const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: { ...profile, name, tagline, phone, lang: plang, layout: l } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || "Could not save."); return; }
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">✏️ {en ? "Edit poster" : "पोस्टर बदलें"}</h3><button type="button" onClick={onClose} className="rounded-lg p-1 text-muted" aria-label="Close"><X className="h-5 w-5" /></button></div>
        {canDay && (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border p-1 text-xs font-semibold">
            <button type="button" onClick={() => setScope("day")} className={`rounded-lg py-2 ${scope === "day" ? "grad-brand text-white" : "text-muted"}`}>{en ? "Only this poster" : "सिर्फ़ यह पोस्टर"}</button>
            <button type="button" onClick={() => setScope("all")} className={`rounded-lg py-2 ${scope === "all" ? "grad-brand text-white" : "text-muted"}`}>{en ? "Every poster (settings)" : "हर पोस्टर (सेटिंग)"}</button>
          </div>
        )}
        {scope === "day" && canDay && (
          <div className="space-y-3">
            <p className="text-xs text-muted">{en ? `Changes here apply to the poster of ${date} only — tomorrow's poster goes back to your usual settings.` : `ये बदलाव सिर्फ़ ${date} के पोस्टर पर लागू होंगे — कल का पोस्टर आपकी सामान्य सेटिंग पर वापस आ जाएगा।`}</p>
            <Row label={en ? "Heading (replaces today's title)" : "शीर्षक (आज के title की जगह)"}><input value={dTitle} onChange={(e) => setDTitle(e.target.value.slice(0, 60))} placeholder={en ? "e.g. Grand Opening Offer" : "जैसे: ग्रैंड ओपनिंग ऑफ़र"} className={inputCls} /></Row>
            <Row label={en ? "Extra line (offer / timing / message)" : "एक और लाइन (ऑफ़र / समय / संदेश)"}><input value={dCustom} onChange={(e) => setDCustom(e.target.value.slice(0, 60))} placeholder={en ? "e.g. Flat 20% off today · Free delivery" : "जैसे: आज 20% छूट · फ़्री डिलीवरी"} className={inputCls} /></Row>
            <div>
              <span className="text-xs font-semibold text-muted mb-1 block">{en ? "Accent colour for this poster" : "इस पोस्टर का मुख्य रंग"}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {SWATCHES.map((c) => <button key={c} type="button" onClick={() => setDAccent(c)} className={`h-7 w-7 rounded-full border-2 ${dAccent === c ? "border-ink" : "border-border"}`} style={{ background: c }} aria-label={c} />)}
                <input type="color" value={dAccent || l.accent || "#7fe3d6"} onChange={(e) => setDAccent(e.target.value)} className="h-7 w-9 rounded border border-border bg-surface p-0.5" />
                {dAccent && <button type="button" onClick={() => setDAccent("")} className="text-[11px] text-muted">{en ? "usual colour" : "सामान्य रंग"}</button>}
              </div>
            </div>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDTitle(""); setDCustom(""); setDAccent(""); }} className="rounded-xl border border-border px-3 py-2.5 text-sm text-muted">{en ? "Clear" : "हटाएँ"}</button>
              <button type="button" disabled={busy} onClick={save} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : en ? "Apply to this poster" : "इस पोस्टर पर लागू करें"}</button>
            </div>
          </div>
        )}
        {scope === "all" && <>
        <p className="mb-3 text-xs text-muted">{en ? "By default the poster shows only your firm name and logo (your photo if there is no logo; your name if there is no firm). Switch on name / designation / phone / photo below if you want them. Changes apply to today's and every future poster." : "डिफ़ॉल्ट में पोस्टर पर सिर्फ़ फ़र्म का नाम और लोगो (लोगो न हो तो आपकी फ़ोटो; फ़र्म न हो तो आपका नाम)। नाम / पद / फ़ोन / फ़ोटो चाहिए तो नीचे ON करें। बदलाव आज के और आगे के हर पोस्टर पर लागू।"}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Row label={en ? "Your name" : "आपका नाम"}><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Row>
            <Row label={en ? "Phone" : "फ़ोन"}><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Row>
          </div>
          <Row label={en ? "Firm / company name (shown by default)" : "फ़र्म / कंपनी का नाम (डिफ़ॉल्ट में यही दिखेगा)"}><input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputCls} /></Row>
          <div>
            <span className="text-xs font-semibold text-muted mb-1 block">{en ? "Poster language (title, voice, captions)" : "पोस्टर की भाषा (शीर्षक, आवाज़, कैप्शन)"}</span>
            <div className="flex flex-wrap gap-1.5">{LANGS.map((lg) => <button key={lg.key} type="button" onClick={() => setPlang(lg.key)} className={`rounded-full border px-2.5 py-1 text-xs ${plang === lg.key ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`}>{lg.label}</button>)}</div>
          </div>
          <Row label={en ? "Custom heading (replaces today's title, optional)" : "अपना शीर्षक (आज के title की जगह, optional)"}><input value={l.title ?? ""} onChange={(e) => set({ title: e.target.value || undefined })} placeholder={en ? "e.g. Grand Opening Offer" : "जैसे: ग्रैंड ओपनिंग ऑफ़र"} className={inputCls} /></Row>
          <Row label={en ? "Extra line (offer / timing / message)" : "एक और लाइन (ऑफ़र / समय / संदेश)"}><input value={l.custom ?? ""} onChange={(e) => set({ custom: e.target.value || undefined })} placeholder={en ? "e.g. Open 10am–8pm · Free home delivery" : "जैसे: सुबह 10 – रात 8 · फ़्री होम डिलीवरी"} className={inputCls} /></Row>
          <div>
            <span className="text-xs font-semibold text-muted mb-1 block">{en ? "Accent colour" : "मुख्य रंग"}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {SWATCHES.map((c) => <button key={c} type="button" onClick={() => set({ accent: c })} className={`h-7 w-7 rounded-full border-2 ${l.accent === c ? "border-ink" : "border-border"}`} style={{ background: c }} aria-label={c} />)}
              <input type="color" value={l.accent ?? "#7fe3d6"} onChange={(e) => set({ accent: e.target.value })} className="h-7 w-9 rounded border border-border bg-surface p-0.5" />
              {l.accent && <button type="button" onClick={() => set({ accent: undefined })} className="text-[11px] text-muted">{en ? "default" : "डिफ़ॉल्ट"}</button>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Row label={en ? "Name size" : "नाम का आकार"}>
              <div className="flex gap-1">{(["S", "M", "L"] as const).map((k) => <button key={k} type="button" onClick={() => set({ nameSize: k })} className={`flex-1 rounded-lg border py-1.5 text-sm ${(l.nameSize ?? "M") === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{k}</button>)}</div>
            </Row>
            <Row label={en ? "Photo side" : "फ़ोटो किस तरफ़"}>
              <div className="flex gap-1">{(["left", "right"] as const).map((k) => <button key={k} type="button" onClick={() => set({ photoSide: k === "right" ? "right" : undefined })} className={`flex-1 rounded-lg border py-1.5 text-sm ${(l.photoSide ?? "left") === k ? "border-brand bg-brand-soft font-semibold" : "border-border"}`}>{k === "left" ? (en ? "Left" : "बाएँ") : (en ? "Right" : "दाएँ")}</button>)}</div>
            </Row>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {([["showName", en ? "Show my name" : "मेरा नाम दिखाएँ"], ["showLine", en ? "Show designation / tagline" : "पद / टैगलाइन दिखाएँ"], ["showPhone", en ? "Show phone" : "फ़ोन दिखाएँ"], ["showPhoto", en ? "Show my photo (with logo)" : "मेरी फ़ोटो भी दिखाएँ (लोगो के साथ)"], ["hidePhoto", en ? "Hide photo" : "फ़ोटो छुपाएँ"], ["hideLogo", en ? "Hide logo" : "लोगो छुपाएँ"]] as const).map(([k, label]) => (
              <label key={k} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${l[k] ? "border-brand bg-brand-soft" : "border-border"}`}><input type="checkbox" className="hidden" checked={!!l[k]} onChange={() => toggle(k)} />{l[k] ? "✓ " : ""}{label}</label>
            ))}
          </div>
          <div className="space-y-1.5 rounded-xl border border-border p-2.5 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!l.varyStyle} onChange={() => set({ varyStyle: l.varyStyle ? undefined : true })} /> <span><b>{en ? "Vary style daily" : "रोज़ अलग स्टाइल"}</b> — {en ? "rotates Clean / Bold / Minimal / Classic / Traditional; festivals get Festive." : "Clean / Bold / Minimal / Classic / Traditional बदलते रहें; त्योहार पर Festive।"}</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={l.autoStatusVideo !== false} onChange={() => set({ autoStatusVideo: l.autoStatusVideo === false ? undefined : false })} /> <span><b>{en ? "Status video daily (4 AM)" : "रोज़ स्टेटस वीडियो (सुबह 4 बजे)"}</b> — {en ? "posts the video (with voice if on) to WhatsApp Status instead of the image. Personal / Business plan." : "इमेज की जगह वीडियो (आवाज़ के साथ, अगर ON) WhatsApp Status पर। Personal / Business plan।"}</span></label>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setL({ voice: l.voice, artGroup: l.artGroup, varyStyle: l.varyStyle, autoStatusVideo: l.autoStatusVideo }); }} className="rounded-xl border border-border px-3 py-2.5 text-sm text-muted">{en ? "Reset" : "रीसेट"}</button>
            <button type="button" disabled={busy} onClick={save} className="grad-brand flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : en ? "Apply to every poster" : "हर पोस्टर पर लागू करें"}</button>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
}
