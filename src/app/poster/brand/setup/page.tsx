"use client";
// My brand — one screen (owner, 1 Nov 2026): what every poster, caption and the month plan sound and look like.
// The website fills it if there is one; the AI suggests the rest; nothing here is required except the name.
// A live preview beside it (computer) / above Save (phone) shows the brand as a poster tile, so the owner SEES the choice.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, LoaderCircle, Sparkles, Globe, Upload, X, Check, Plus, CalendarDays, ImagePlus } from "lucide-react";
import { api, isLoggedIn, currentProfileId, uploadImage, LANGS, type Profile } from "@/lib/poster-client";
import { CATEGORIES, CATEGORY_GROUPS, categoryOf } from "@/lib/poster-categories";
import { TONES, PALETTE_PRESETS, HEX6, type BrandSnapshot } from "@/lib/brand-plan";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";

type Suggest = { accent: string; tone: string[]; audience: string; usps: string[]; tagline: string };
type Peek = { ok: boolean; name?: string; logo?: string; about?: string; city?: string; category?: string; reason?: string };

const inputCls = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

export default function BrandSetupPage() {
  const router = useRouter(); const { lang } = useT(); const hi = lang !== "en";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [b, setB] = useState<BrandSnapshot | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [site, setSite] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteMsg, setSiteMsg] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [upBusy, setUpBusy] = useState<"" | "logo" | "photo">("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const logoIn = useRef<HTMLInputElement>(null);
  const photoIn = useRef<HTMLInputElement>(null);
  const NET = hi ? "Internet नहीं चल रहा। फिर से कोशिश करें।" : "No internet. Please try again.";

  const patch = useCallback((p: Partial<BrandSnapshot>) => { setSaved(false); setB((x) => (x ? { ...x, ...p } : x)); }, []);

  const suggest = useCallback(async (p: Profile, cur: BrandSnapshot, quiet: boolean) => {
    setAiBusy(true); setAiMsg("");
    try {
      const r = await api<{ suggest?: Suggest; error?: string }>(`/api/poster/brand?profile=${p.id}&suggest=1`, { fresh: true });
      const s = r.data.suggest;
      if (!r.ok || !s) { if (!quiet) setAiMsg(r.data.error || (hi ? "अभी सुझाव नहीं आ पाए।" : "No suggestions just now.")); return; }
      // only fill what is empty — never overwrite the owner's own words
      setB((x) => x ? {
        ...x,
        accent: x.accent || s.accent, palette: x.palette.length ? x.palette : s.accent ? [s.accent] : [],
        tone: x.tone.length ? x.tone : s.tone, audience: x.audience || s.audience, usps: x.usps.length ? x.usps : s.usps, tagline: x.tagline || s.tagline,
      } : x);
      if (!quiet) setAiMsg(hi ? "खाली जगहें भर दीं — जो ठीक न लगे, बदल दें।" : "Filled the empty parts — change anything that is not right.");
      void cur;
    } catch { if (!quiet) setAiMsg(NET); }
    finally { setAiBusy(false); }
  }, [hi, NET]);

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/brand/setup"); return; }
    try {
      const r = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      const list = r.data.profiles ?? [];
      const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
      if (!p) { router.replace("/poster/onboard"); return; }
      setProfile(p);
      const br = await api<{ brand?: BrandSnapshot; error?: string }>(`/api/poster/brand?profile=${p.id}`, { fresh: true });
      if (!br.ok || !br.data.brand) { setLoadErr(br.data.error || (hi ? "Brand नहीं खुल पाया।" : "Could not open the brand.")); return; }
      setB(br.data.brand); setSite(br.data.brand.website);
      // a new brand: let the AI fill the empty parts once, quietly
      if (!br.data.brand.tone.length && !br.data.brand.audience) suggest(p, br.data.brand, true);
    } catch { setLoadErr(NET); }
  })(); }, [router, hi, NET, suggest]);

  async function readSite() {
    const url = site.trim(); if (!url || !b) return;
    setSiteBusy(true); setSiteMsg("");
    try {
      const r = await api<Peek>("/api/site/peek", { method: "POST", json: { url, role: "own" } });
      if (!r.ok || !r.data.ok) { setSiteMsg(hi ? "यह website नहीं पढ़ पाए। नीचे खुद भर दें — 1 मिनट लगेगा।" : "Could not read this website. Fill it in below — it takes a minute."); return; }
      const d = r.data;
      patch({ name: b.name || d.name || "", logo_url: b.logo_url || d.logo || "", city: b.city || d.city || "", category: b.category || d.category || "", about: b.about || d.about || "", website: url });
      setSiteMsg(hi ? "Website से भर दिया ✓ — देखकर ठीक कर लें।" : "Filled from the website ✓ — check and correct.");
    } catch { setSiteMsg(NET); }
    finally { setSiteBusy(false); }
  }

  async function upload(kind: "logo" | "photo", files: FileList | null) {
    if (!files?.length || !b) return;
    setUpBusy(kind);
    try {
      if (kind === "logo") { const u = await uploadImage(files[0], "logo"); if (u) patch({ logo_url: u }); }
      else {
        const urls: string[] = [];
        for (const f of Array.from(files).slice(0, 12 - b.photos.length)) { const u = await uploadImage(f, "wide"); if (u) urls.push(u); }
        if (urls.length) patch({ photos: [...b.photos, ...urls].slice(0, 12) });
      }
    } finally { setUpBusy(""); }
  }

  async function save(thenPlan: boolean) {
    if (!b || !profile) return;
    if (!b.name.trim()) { setSaveMsg(hi ? "Business का नाम लिखें।" : "Write the business name."); return; }
    setSaving(true); setSaveMsg("");
    try {
      const r = await api<{ brand?: BrandSnapshot; error?: string }>("/api/poster/brand", { method: "POST", json: {
        profile: profile.id, name: b.name, tagline: b.tagline, city: b.city, category: b.category, lang: b.lang, logo_url: b.logo_url,
        accent: b.accent, palette: b.palette, tone: b.tone, audience: b.audience, usps: b.usps, photos: b.photos,
      } });
      if (!r.ok || !r.data.brand) { setSaveMsg(r.data.error || (hi ? "Save नहीं हुआ। फिर से कोशिश करें।" : "Could not save. Please try again.")); return; }
      setB(r.data.brand); setSaved(true);
      if (thenPlan) router.push("/poster/calendar?plan=1");
    } catch { setSaveMsg(NET); }
    finally { setSaving(false); }
  }

  const accent = b?.accent && HEX6.test(b.accent) ? b.accent : "#1d4ed8";
  const cat = b ? categoryOf(b.category) : null;
  const toneWords = useMemo(() => (b?.tone ?? []).map((t) => TONES.find((x) => x.key === t)).filter(Boolean).map((t) => (hi ? t!.hi : t!.en)), [b?.tone, hi]);

  const head = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => goBack(router, "/poster/create?door=poster")} className="text-muted" aria-label={hi ? "पीछे" : "Back"}><ChevronLeft className="h-5 w-5" /></button>
      <h1 className="text-lg font-bold flex-1">{hi ? "मेरा brand" : "My brand"}</h1>
      <button type="button" onClick={() => router.push("/poster/calendar")} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"><CalendarDays className="h-3.5 w-3.5" /> {hi ? "महीने का plan" : "Month plan"}</button>
    </div>
  );
  if (loadErr) return <div className="space-y-4">{head}<p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{loadErr}</p></div>;
  if (!b) return <div className="space-y-4">{head}<div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div></div>;

  const preview = (
    <div className="rounded-2xl border border-border bg-surface p-3 space-y-3">
      <p className="text-[11px] mono uppercase tracking-wide text-faint">{hi ? "आपका brand ऐसा दिखेगा" : "Your brand at a glance"}</p>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl" style={{ background: `linear-gradient(160deg, ${accent} 0%, ${accent}cc 45%, #0f172a 100%)` }}>
        {b.photos[0] && /* eslint-disable-line @next/next/no-img-element */ <img src={b.photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity" />}
        <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
          <div className="flex items-center gap-2">
            {b.logo_url ? /* eslint-disable-line @next/next/no-img-element */ <img src={b.logo_url} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-1" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-sm font-bold">{(b.name || "B").slice(0, 1)}</span>}
            <span className="text-sm font-bold leading-tight">{b.name || (hi ? "आपका business" : "Your business")}</span>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">{toneWords.join(" · ") || (hi ? "आपका अंदाज़" : "Your tone")}</p>
            <p className="mt-1 text-2xl font-extrabold leading-tight">{b.tagline || cat?.[hi ? "hi" : "en"] || (hi ? "आपकी tagline यहाँ" : "Your tagline here")}</p>
            {b.usps.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{b.usps.slice(0, 3).map((u, i) => <span key={`${i}-${u}`} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">{u.split("|")[0]}</span>)}</div>}
          </div>
          <p className="text-[11px] text-white/85">{[b.city, LANGS.find((l) => l.key === b.lang)?.label].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">{hi ? "यह सिर्फ़ झलक है। असली poster आपके trade की photo और दिन के शब्दों से बनते हैं — इन्हीं रंगों और अंदाज़ में।" : "Only a glimpse. Real posters use a photo of your trade and the day's words — in these colours and this tone."}</p>
    </div>
  );

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:space-y-0">
      <div className="space-y-4 min-w-0">
        {head}
        <p className="text-sm text-muted">{hi ? "एक बार बताइए — फिर हर poster, caption और महीने का plan आपके brand की तरह दिखेगा और बोलेगा।" : "Tell us once — then every poster, caption and month plan looks and sounds like your brand."}</p>

        {/* 1 · Website */}
        <section className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2"><Globe className="h-4 w-4 text-brand" /> {hi ? "Website (हो तो)" : "Website (if you have one)"}</p>
          <div className="flex gap-2">
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourshop.com" className={inputCls} inputMode="url" />
            <button type="button" onClick={readSite} disabled={siteBusy || !site.trim()} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-brand px-3 text-sm font-semibold text-brand-ink disabled:opacity-50">{siteBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{hi ? "पढ़ें" : "Read"}</button>
          </div>
          {siteMsg && <p className="text-xs text-muted">{siteMsg}</p>}
        </section>

        {/* 2 · Name, logo, trade */}
        <section className="rounded-2xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">{hi ? "नाम और पहचान" : "Name and identity"}</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => logoIn.current?.click()} className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-surface2" aria-label={hi ? "Logo" : "Logo"}>
              {upBusy === "logo" ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : b.logo_url ? /* eslint-disable-line @next/next/no-img-element */ <img src={b.logo_url} alt="" className="h-full w-full object-contain p-1" /> : <Upload className="h-5 w-5 text-muted" />}
            </button>
            <input ref={logoIn} type="file" accept="image/*" hidden onChange={(e) => { upload("logo", e.target.files); e.target.value = ""; }} />
            <div className="flex-1 space-y-2">
              <input value={b.name} onChange={(e) => patch({ name: e.target.value })} maxLength={60} placeholder={hi ? "Business का नाम" : "Business name"} className={inputCls} />
              <input value={b.tagline} onChange={(e) => patch({ tagline: e.target.value })} maxLength={80} placeholder={hi ? "Tagline — जैसे: शुद्ध घी की मिठाई, 1985 से" : "Tagline — e.g. Pure ghee sweets since 1985"} className={inputCls} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={b.category} onChange={(e) => patch({ category: e.target.value })} className={inputCls}>
              <option value="">{hi ? "काम चुनें" : "Pick your trade"}</option>
              {CATEGORY_GROUPS.map((g) => <optgroup key={g} label={g}>{CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{hi ? c.hi : c.en}</option>)}</optgroup>)}
            </select>
            <input value={b.city} onChange={(e) => patch({ city: e.target.value })} maxLength={40} placeholder={hi ? "शहर" : "City"} className={inputCls} />
          </div>
        </section>

        {/* 3 · Colours */}
        <section className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-sm font-semibold">{hi ? "Brand के रंग" : "Brand colours"} <span className="font-normal text-muted text-xs">{hi ? "· पहला रंग poster का मुख्य रंग" : "· the first is the posters' main colour"}</span></p>
          <div className="flex flex-wrap items-center gap-2">
            {b.palette.map((h, i) => (
              <span key={h + i} className="inline-flex items-center gap-1 rounded-full border border-border py-1 pl-1 pr-2 text-xs">
                <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: h }} />{i === 0 ? (hi ? "मुख्य" : "Main") : h}
                <button type="button" onClick={() => { const p = b.palette.filter((_, j) => j !== i); patch({ palette: p, accent: p[0] ?? "" }); }} aria-label={hi ? "हटाएँ" : "Remove"}><X className="h-3.5 w-3.5 text-muted" /></button>
              </span>
            ))}
            {b.palette.length < 3 && <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> {hi ? "अपना रंग" : "Own colour"}<input type="color" className="sr-only" onChange={(e) => { const p = [...b.palette, e.target.value].slice(0, 3); patch({ palette: p, accent: p[0] }); }} /></label>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE_PRESETS.map((c) => {
              const on = b.palette.includes(c.hex);
              return <button key={c.hex} type="button" onClick={() => { const p = on ? b.palette.filter((x) => x !== c.hex) : [...b.palette, c.hex].slice(-3); patch({ palette: p, accent: p[0] ?? "" }); }} title={hi ? c.hi : c.en} className={`h-8 w-8 rounded-full border-2 ${on ? "border-ink" : "border-transparent"}`} style={{ background: c.hex }} aria-label={hi ? c.hi : c.en}>{on && <Check className="mx-auto h-4 w-4 text-white" />}</button>;
            })}
          </div>
        </section>

        {/* 4 · Tone + language */}
        <section className="rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">{hi ? "आपका अंदाज़ (3 तक)" : "Your tone (up to 3)"}</p>
            <button type="button" onClick={() => profile && suggest(profile, b, false)} disabled={aiBusy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-60">{aiBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-brand" />} {hi ? "AI सुझाव" : "AI suggest"}</button></div>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => { const on = b.tone.includes(t.key); return <button key={t.key} type="button" onClick={() => patch({ tone: on ? b.tone.filter((x) => x !== t.key) : [...b.tone, t.key].slice(-3) })} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border"}`}>{hi ? t.hi : t.en}</button>; })}
          </div>
          {aiMsg && <p className="text-xs text-muted">{aiMsg}</p>}
          <p className="text-sm font-semibold">{hi ? "Posts की भाषा" : "Language of the posts"}</p>
          <div className="flex flex-wrap gap-1.5">
            {LANGS.map((l) => <button key={l.key} type="button" onClick={() => patch({ lang: l.key })} className={`rounded-full border px-3 py-1.5 text-xs ${b.lang === l.key ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border"}`}>{l.label}</button>)}
          </div>
        </section>

        {/* 5 · Customers + why us */}
        <section className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-sm font-semibold">{hi ? "आपके ग्राहक कौन हैं?" : "Who are your customers?"}</p>
          <input value={b.audience} onChange={(e) => patch({ audience: e.target.value })} maxLength={120} placeholder={hi ? "जैसे: शहर के परिवार जो त्योहार पर मिठाई लेते हैं" : "e.g. Families in town who buy sweets for festivals"} className={inputCls} />
          <p className="pt-2 text-sm font-semibold">{hi ? "लोग आपको क्यों चुनें (4 तक)" : "Why people pick you (up to 4)"}</p>
          {[0, 1, 2, 3].map((i) => {
            const [label = "", sub = ""] = (b.usps[i] ?? "").split("|");
            if (i > b.usps.length) return null;
            const setUsp = (l: string, s: string) => { const u = [...b.usps]; u[i] = `${l.slice(0, 22)}|${s.slice(0, 22)}`.replace(/\|$/, ""); patch({ usps: u.filter((x) => x && x !== "|") }); };
            return <div key={i} className="grid grid-cols-2 gap-2"><input value={label} onChange={(e) => setUsp(e.target.value, sub)} maxLength={22} placeholder={hi ? "जैसे: 100% शुद्ध घी" : "e.g. 100% pure ghee"} className={inputCls} /><input value={sub} onChange={(e) => setUsp(label, e.target.value)} maxLength={22} placeholder={hi ? "छोटी लाइन (optional)" : "Small line (optional)"} className={inputCls} /></div>;
          })}
        </section>

        {/* 6 · Photos */}
        <section className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-sm font-semibold">{hi ? "दुकान / काम की photos" : "Photos of your shop and work"} <span className="font-normal text-muted text-xs">{b.photos.length}/12</span></p>
          <p className="text-xs text-muted">{hi ? "असली photos से posts और website ज़्यादा भरोसेमंद लगते हैं। 5 हों तो बढ़िया।" : "Real photos make posts and the website feel trusted. Five is great."}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {b.photos.map((u, i) => (
              <div key={`${i}-${u}`} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-line @next/next/no-img-element */}<img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => patch({ photos: b.photos.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label={hi ? "हटाएँ" : "Remove"}><X className="h-3 w-3" /></button>
              </div>
            ))}
            {b.photos.length < 12 && <button type="button" onClick={() => photoIn.current?.click()} className="grid aspect-square place-items-center rounded-lg border border-dashed border-border text-muted">{upBusy === "photo" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}</button>}
          </div>
          <input ref={photoIn} type="file" accept="image/*" multiple hidden onChange={(e) => { upload("photo", e.target.files); e.target.value = ""; }} />
        </section>

        <div className="lg:hidden">{preview}</div>

        <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl border border-border bg-surface/95 p-3 backdrop-blur lg:static">
          {saveMsg && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{saveMsg}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => save(false)} disabled={saving} className="rounded-xl border border-border py-3 text-sm font-semibold disabled:opacity-60">{saved ? (hi ? "Save हो गया ✓" : "Saved ✓") : (hi ? "Save करें" : "Save")}</button>
            <button type="button" onClick={() => save(true)} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {hi ? "महीने का plan बनाएँ" : "Plan my month"}</button>
          </div>
        </div>
      </div>
      <aside className="hidden lg:block"><div className="sticky top-6">{preview}</div></aside>
    </div>
  );
}
