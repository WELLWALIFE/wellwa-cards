"use client";
import { useState } from "react";
import { Camera, Images, Image as ImageIcon, LoaderCircle } from "lucide-react";
import { PERSONAS, LANGS, uploadImage, type Persona, type Profile, type Party } from "@/lib/poster-client";
import { categoryOf, STYLE_LIST } from "@/lib/poster-categories";
import { X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { compressToFile, dataUrlToFile, shrinkForCrop } from "@/lib/image-utils";
import { ImageCropper } from "@/components/editor/image-cropper";
import { CategoryPicker } from "@/components/category-picker";

export type ProfileDraft = {
  id?: string; persona: Persona; name: string; tagline: string; phone: string; city: string; lang: string;
  photo_url: string | null; logo_url: string | null; mode?: "greeting" | "product";
  style?: string; category?: string; party?: Party | null; layout?: Profile["layout"];
};
const emptyParty = (): Party => ({ name: "", symbol_url: "", slogan: "", colors: [], leaders: [] });
export const emptyDraft = (persona: Persona = "personal"): ProfileDraft => ({ persona, name: "", tagline: "", phone: "", city: "", lang: "hi", photo_url: null, logo_url: null, mode: "greeting", style: "classic", category: "", party: null, layout: {} });
/** The style chip that is on: a Signature key as saved, the six originals only when the owner chose them ("old"), else the Signature default. */
const chosenStyle = (d: ProfileDraft) => (d.style === "signature" || d.style === "signature-classic") ? d.style : d.layout?.look === "old" ? (d.style ?? "classic") : d.layout?.look === "classic" ? "signature-classic" : "signature";
export const fromProfile = (p: Profile): ProfileDraft => ({ id: p.id, persona: p.persona, name: p.name, tagline: p.tagline ?? "", phone: p.phone ?? "", city: p.city ?? "", lang: p.lang, photo_url: p.photo_url, logo_url: p.logo_url, mode: p.mode ?? "greeting", style: p.style ?? "classic", category: p.category ?? "", party: p.party ?? null, layout: p.layout ?? {} });

export function ProfileForm({ draft, onChange, onSubmit, busy, submitLabel, showPersona = true }: {
  draft: ProfileDraft; onChange: (d: ProfileDraft) => void; onSubmit: () => void; busy: boolean; submitLabel: string; showPersona?: boolean;
}) {
  const persona = PERSONAS.find((p) => p.key === draft.persona) ?? PERSONAS[1];
  const [uploading, setUploading] = useState<"" | "photo" | "logo">("");
  const { t, lang } = useT();
  const hint = t.personas[persona.key][2];

  // A picked photo opens the crop / zoom window first; the framed square is what gets uploaded.
  const [crop, setCrop] = useState<{ kind: "photo" | "logo"; src: string } | null>(null);
  async function pick(kind: "photo" | "logo", file: File | null) {
    if (!file) return;
    try { setCrop({ kind, src: await shrinkForCrop(file, kind === "logo" ? 1600 : 2000) }); } catch { /* an undecodable file: the picker simply stays as it was */ }
  }
  async function upload(kind: "photo" | "logo", dataUrl: string) {
    setCrop(null); setUploading(kind);
    // Logos keep transparency (PNG); face photos are JPEG — the cropper already made them small.
    const url = await uploadImage(dataUrlToFile(dataUrl, kind === "logo" ? "logo.png" : "photo.jpg"), kind);
    setUploading("");
    if (url) onChange({ ...draft, [kind === "photo" ? "photo_url" : "logo_url"]: url });
    else alert(t.uploadFail);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
      {crop && (
        <ImageCropper src={crop.src} aspect={1} outWidth={600} round={crop.kind === "photo"} format={crop.kind === "logo" ? "png" : "jpeg"}
          onApply={(d) => upload(crop.kind, d)} onCancel={() => setCrop(null)} />
      )}
      <div>
        <p className="text-sm font-semibold mb-1">{lang === "en" ? "Your business / work" : "आपका काम / व्यवसाय"}</p>
        <CategoryPicker value={draft.category ?? ""} lang={lang === "en" ? "en" : "hi"} className="!mt-0 !py-2.5 !rounded-lg !text-sm"
          placeholder={lang === "en" ? "Choose a category (sets look & wording)" : "श्रेणी चुनें (लुक और शब्द अपने-आप सेट)"}
          onChange={(k) => { const c = categoryOf(k); onChange(c ? { ...draft, category: c.key, persona: c.persona, style: draft.id ? (draft.style ?? c.style) : c.style, layout: { ...(draft.layout ?? {}), accent: c.accent }, party: c.persona === "community" ? (draft.party ?? emptyParty()) : draft.party } : { ...draft, category: "" }); }} />
      </div>
      {showPersona && (
        <div>
          <p className="text-sm font-semibold mb-2">{t.whoAreYou}</p>
          <div className="grid grid-cols-2 gap-2">
            {PERSONAS.map((p) => (
              <button type="button" key={p.key} onClick={() => onChange({ ...draft, persona: p.key })}
                className={`text-left rounded-xl border p-3 transition-colors ${draft.persona === p.key ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
                <span className="text-xl">{p.emoji}</span>
                <span className="block text-sm font-semibold mt-1">{t.personas[p.key][0]}</span>
                <span className="block text-[11px] text-muted leading-snug mt-0.5">{t.personas[p.key][1]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <span className="relative h-20 w-20 rounded-full bg-surface2 border border-border grid place-items-center overflow-hidden shrink-0">
          {draft.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.photo_url} alt="" className="h-full w-full object-cover" />
          ) : uploading === "photo" ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <Camera className="h-6 w-6 text-muted" />}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{t.yourPhoto}</p>
          <p className="text-xs text-muted mb-1.5">{t.photoHint}</p>
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
              <Camera className="h-3.5 w-3.5" /> {lang === "en" ? "Camera" : "कैमरा"}
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pick("photo", e.target.files?.[0] ?? null)} />
            </label>
            <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
              <Images className="h-3.5 w-3.5" /> Gallery
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pick("photo", e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold mb-1 block">{t.name} <span className="text-danger">*</span></span>
        <input required value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder={t.namePh}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold mb-1 block">{hint}</span>
        <input value={draft.tagline} onChange={(e) => onChange({ ...draft, tagline: e.target.value })} placeholder={hint}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />
      </label>
      {draft.persona !== "student" && (
        <label className="block">
          <span className="text-sm font-semibold mb-1 block">{t.mobile} <span className="text-faint font-normal">{t.onPoster}</span></span>
          <input type="tel" inputMode="numeric" value={draft.phone} onChange={(e) => onChange({ ...draft, phone: e.target.value })} placeholder="98765 43210"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />
        </label>
      )}
      {persona.needsLogo && (
        <div className="flex items-center gap-4">
          <span className="relative h-16 w-24 rounded-lg bg-surface2 border border-border grid place-items-center overflow-hidden shrink-0">
            {draft.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logo_url} alt="" className="h-full w-full object-contain p-1" />
            ) : uploading === "logo" ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <ImageIcon className="h-5 w-5 text-muted" />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t.logo} <span className="text-faint font-normal">{t.optional}</span></p>
            <div className="flex gap-2 mt-1">
              <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                <Camera className="h-3.5 w-3.5" /> {lang === "en" ? "Camera" : "कैमरा"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick("logo", e.target.files?.[0] ?? null)} />
              </label>
              <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                <Images className="h-3.5 w-3.5" /> Gallery
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pick("logo", e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <p className="text-xs text-muted">{t.logoHint}</p>
          </div>
        </div>
      )}
      {draft.persona !== "student" && (
        <div>
          <p className="text-sm font-semibold mb-1">{t.posterMode}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["greeting", "product"] as const).map((m) => (
              <button type="button" key={m} onClick={() => onChange({ ...draft, mode: m })}
                className={`rounded-xl border p-3 text-left ${(draft.mode ?? "greeting") === m ? "border-brand bg-brand-soft" : "border-border"}`}>
                <span className="block text-sm font-semibold">{m === "greeting" ? t.modeGreeting : t.modeProduct}</span>
                <span className="block text-[11px] text-muted mt-0.5">{m === "greeting" ? t.modeGreetingSub : t.modeProductSub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-sm font-semibold mb-1">{lang === "en" ? "Poster style" : "पोस्टर का स्टाइल"}</p>
        <div className="flex flex-wrap gap-2">
          {STYLE_LIST.map((st) => (
            <button type="button" key={st.key}
              onClick={() => onChange(st.key.startsWith("signature")
                ? { ...draft, style: st.key, layout: { ...(draft.layout ?? {}), look: st.key === "signature-classic" ? "classic" : "vibrant" } }
                : { ...draft, style: st.key, layout: { ...(draft.layout ?? {}), look: "old" } })}
              className={`rounded-full border px-3 py-1.5 text-sm ${chosenStyle(draft) === st.key ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`}>{st.emoji} {lang === "en" ? st.en : st.hi}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-1">{lang === "en" ? "Signature: your photo or a real photo of your trade, the day's line, your five highlights and a WhatsApp button — one design for WhatsApp, Facebook, Instagram and Google." : "सिग्नेचर: आपकी या आपके काम की असली फ़ोटो, दिन की लाइन, आपकी 5 ख़ास बातें और WhatsApp बटन — एक ही डिज़ाइन WhatsApp, Facebook, Instagram और Google के लिए।"}</p>
      </div>
      <div>
        <p className="text-sm font-semibold mb-1">{lang === "en" ? "Your 5 highlights" : "आपकी 5 ख़ास बातें"} <span className="text-faint font-normal text-xs">{lang === "en" ? "(Signature poster)" : "(सिग्नेचर पोस्टर)"}</span></p>
        <textarea rows={4} value={(draft.layout?.usps ?? []).join("\n")}
          onChange={(e) => onChange({ ...draft, layout: { ...(draft.layout ?? {}), usps: e.target.value.split("\n").slice(0, 5) } })}
          placeholder={lang === "en" ? "Home Delivery | nearby\nUPI / Cash | accepted\nTrusted | for years" : "होम डिलीवरी | पास के इलाक़े\nUPI / Cash | सब चलता है\nभरोसा | सालों का"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />
        <p className="text-[11px] text-muted mt-1">{lang === "en" ? "One per line: heading | small line. Leave empty and we write them for your trade." : "एक लाइन में एक: शीर्षक | छोटी लाइन। खाली छोड़ें तो आपके काम के हिसाब से हम लिख देंगे।"}</p>
      </div>
      <div>
        <p className="text-sm font-semibold mb-1">{lang === "en" ? "Poster art scene" : "पोस्टर का आर्ट (माहौल)"} <span className="text-faint font-normal text-xs">{lang === "en" ? "(Personal/Business plan)" : "(Personal/Business plan)"}</span></p>
        <select value={draft.layout?.artGroup ?? "auto"} onChange={(e) => onChange({ ...draft, layout: { ...(draft.layout ?? {}), artGroup: e.target.value === "auto" ? undefined : e.target.value } })} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand">
          <option value="auto">{lang === "en" ? "Auto (from your category)" : "ऑटो (आपकी श्रेणी से)"}</option>
          {[["Retail", "Shop / bazaar", "दुकान / बाज़ार"], ["Food", "Food / kitchen", "खाना / रसोई"], ["Health", "Health / wellness", "सेहत / वेलनेस"], ["Services", "Office / city", "ऑफ़िस / शहर"], ["Education", "Education", "शिक्षा"], ["Sales", "Growth / partnership", "ग्रोथ / पार्टनरशिप"], ["Industry", "Farm / factory", "खेत / फ़ैक्टरी"], ["Community", "Rally / community", "रैली / समाज"], ["Personal", "General (shared art)", "सामान्य (साझा आर्ट)"]].map(([k, en, hi]) => <option key={k} value={k}>{lang === "en" ? en : hi}</option>)}
        </select>
        <p className="text-[11px] text-muted mt-1">{lang === "en" ? "Same festival, but the scene matches your trade — a doctor gets a clean wellness look, a kirana gets a bazaar look." : "त्योहार वही, पर माहौल आपके काम जैसा — डॉक्टर को वेलनेस लुक, किराना को बाज़ार लुक।"}</p>
      </div>
      {draft.persona === "community" && (
        <PartySection party={draft.party ?? emptyParty()} onChange={(party) => onChange({ ...draft, party })} lang={lang} />
      )}
      <div>
        <p className="text-sm font-semibold mb-1">{t.posterLang}</p>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button type="button" key={l.key} onClick={() => onChange({ ...draft, lang: l.key })}
              className={`rounded-full border px-3 py-1.5 text-sm ${draft.lang === l.key ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`}>{l.label}</button>
          ))}
        </div>
      </div>
      <button type="submit" disabled={busy || !draft.name.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60">
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}{submitLabel}
      </button>
    </form>
  );
}

/* ---- political / organisation: party or sanstha branding on every poster ---- */
function PartySection({ party, onChange, lang }: { party: Party; onChange: (p: Party) => void; lang: string }) {
  const en = lang === "en";
  const [up, setUp] = useState("");
  async function pickImg(kind: "symbol" | `leader${number}`, file: File | null) {
    if (!file) return; setUp(kind);
    const small = kind === "symbol" ? await compressToFile(file, "symbol.png", 800, 1, "png") : await compressToFile(file, "leader.jpg", 600);
    const url = await uploadImage(small, kind === "symbol" ? "logo" : "photo");
    setUp("");
    if (!url) return;
    if (kind === "symbol") onChange({ ...party, symbol_url: url });
    else { const i = Number(kind.slice(6)); const leaders = [...party.leaders]; leaders[i] = { ...(leaders[i] ?? { name: "" }), photo_url: url }; onChange({ ...party, leaders }); }
  }
  const setColor = (i: number, v: string) => { const colors = [...(party.colors ?? [])]; colors[i] = v; onChange({ ...party, colors }); };
  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <p className="text-sm font-semibold">🚩 {en ? "Party / organisation branding" : "पार्टी / संगठन की ब्रांडिंग"}</p>
      <p className="text-xs text-muted">{en ? "Symbol top-left, up to 3 leaders top-right, party colours and slogan on every poster." : "हर पोस्टर पर: चिह्न ऊपर-बाएँ, 3 नेता ऊपर-दाएँ, पार्टी के रंग और नारा।"}</p>
      <input value={party.name} onChange={(e) => onChange({ ...party, name: e.target.value })} placeholder={en ? "Party / organisation name" : "पार्टी / संगठन का नाम"} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
      <input value={party.slogan} onChange={(e) => onChange({ ...party, slogan: e.target.value })} placeholder={en ? "Slogan (optional)" : "नारा (optional), जैसे: सबका साथ, सबका विकास"} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
      <div className="flex items-center gap-3">
        <span className="h-14 w-14 rounded-lg bg-surface2 border border-border grid place-items-center overflow-hidden">{party.symbol_url ? <img src={party.symbol_url} alt="" className="h-full w-full object-contain p-1" /> : up === "symbol" ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : <span className="text-xs text-muted">🚩</span>}</span>
        <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer"><Images className="h-3.5 w-3.5" /> {en ? "Symbol / logo" : "चिह्न / लोगो"}<input type="file" accept="image/*" className="hidden" onChange={(e) => pickImg("symbol", e.target.files?.[0] ?? null)} /></label>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">{en ? "Colours" : "रंग"}
          <input type="color" value={party.colors?.[0] ?? "#ff9933"} onChange={(e) => setColor(0, e.target.value)} className="h-7 w-9 rounded border border-border bg-surface p-0.5" title={en ? "Accent" : "मुख्य रंग"} />
          <input type="color" value={party.colors?.[1] ?? "#1f2937"} onChange={(e) => setColor(1, e.target.value)} className="h-7 w-9 rounded border border-border bg-surface p-0.5" title={en ? "Band" : "पट्टी का रंग"} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted mb-1">{en ? "Leaders (up to 3)" : "नेता / पदाधिकारी (3 तक)"}</p>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => {
            const l = party.leaders[i];
            return (
              <div key={i} className="flex-1 space-y-1">
                <label className="block h-16 w-16 mx-auto rounded-full bg-surface2 border border-border overflow-hidden grid place-items-center cursor-pointer">
                  {l?.photo_url ? <img src={l.photo_url} alt="" className="h-full w-full object-cover" /> : up === `leader${i}` ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : <Camera className="h-4 w-4 text-muted" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImg(`leader${i}`, e.target.files?.[0] ?? null)} />
                </label>
                <input value={l?.name ?? ""} onChange={(e) => { const leaders = [...party.leaders]; leaders[i] = { ...(leaders[i] ?? { photo_url: "" }), name: e.target.value }; onChange({ ...party, leaders }); }} placeholder={en ? "Name" : "नाम"} className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-[11px]" />
                {l?.photo_url && <button type="button" onClick={() => onChange({ ...party, leaders: party.leaders.filter((_, j) => j !== i) })} className="mx-auto block text-[10px] text-danger"><X className="inline h-3 w-3" /> {en ? "remove" : "हटाएँ"}</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
