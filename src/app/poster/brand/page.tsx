"use client";
// Brand Kit: AI logo options + taglines + palette + voice + keywords, applied
// to the user's poster profile(s) in one tap.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Check } from "lucide-react";
import { api, isLoggedIn, type Profile } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";

type Style = "modern" | "classic" | "playful" | "premium";
type Kit = { options: string[]; variants?: { icon: string; wide: string; stacked: string; dark: string }[]; charged?: number; taglines: string[]; voice: string; palette: { name: string; hex: string }[]; keywords: string[]; partial?: boolean; error?: string };

export default function BrandKitPage() {
  const router = useRouter();
  const { lang } = useT();
  const hi = lang !== "en";
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [profileId, setProfileId] = useState("");
  const [business, setBusiness] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [style, setStyle] = useState<Style>("modern");
  const [colors, setColors] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState("");
  const [kit, setKit] = useState<Kit | null>(null);
  const [logo, setLogo] = useState("");
  const [tagline, setTagline] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      // replace, not push: Back from the login screen must not land here and bounce straight back to it.
      if (!(await isLoggedIn())) { router.replace("/login?next=/poster/brand"); return; }
      const r = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      const list = r.data.profiles ?? [];
      setProfiles(list);
      const def = list.find((p) => p.is_default) ?? list[0];
      if (def) {
        setProfileId(def.id);
        setBusiness((def.tagline || def.name || "").trim());
        setCity(def.city ?? "");
      }
    })();
  }, [router]);

  async function generate() {
    setBusy(true); setErr(""); setKit(null); setLogo(""); setTagline(""); setDone(false);
    const r = await api<Kit>("/api/poster/brand-kit", { method: "POST", json: { business, category, city, style, colors_hint: colors, lang, tagline: tagline || undefined } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || (hi ? "कुछ गड़बड़ हो गई। फिर से कोशिश करें।" : "Something went wrong. Please try again.")); return; }
    setKit(r.data);
    if (r.data.options?.[0]) setLogo(r.data.options[0]);
  }

  async function apply() {
    if (!logo) return;
    setApplying(true); setErr("");
    const r = await api<{ ok?: boolean; error?: string }>("/api/poster/brand-kit/apply", { method: "POST", json: { logo_url: logo, tagline: tagline || undefined, profile_id: profileId || undefined } });
    setApplying(false);
    if (!r.ok) { setErr(r.data.error || (hi ? "Logo नहीं लग पाया। फिर से कोशिश करें।" : "Could not put the logo on your profile. Please try again.")); return; }
    setDone(true);
  }

  // Opened by address only (the logo studio is parked): Back = the screen the owner was just on; opened fresh, the Brand door of Create.
  // Drawn while loading too (this page is in BackBar's OWN_BACK list, so a slow or offline phone would have no Back at all).
  const backBtn = <button type="button" onClick={() => goBack(router, "/poster/create?door=brand")} className="text-muted" aria-label={hi ? "पीछे" : "Back"}><ChevronLeft className="h-5 w-5" /></button>;
  if (profiles === null) return <div className="space-y-4"><div className="flex items-center gap-2">{backBtn}<h1 className="text-lg font-bold flex-1">Brand Kit</h1></div><div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div></div>;
  const selectedProfile = profiles.find((p) => p.id === profileId) ?? profiles.find((p) => p.is_default) ?? profiles[0];
  const hasExistingLogo = !!selectedProfile?.logo_url;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const STYLES: { key: Style; hi: string; en: string }[] = [
    { key: "modern", hi: "मॉडर्न", en: "Modern" }, { key: "classic", hi: "क्लासिक", en: "Classic" },
    { key: "playful", hi: "मज़ेदार", en: "Fun" }, { key: "premium", hi: "प्रीमियम", en: "Premium" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {backBtn}
        <h1 className="text-lg font-bold flex-1">{hi ? "Brand Kit" : "Brand Kit"}</h1>
      </div>
      <p className="text-xs text-muted">{hi ? "4 अच्छे logo (एक निशान + आपका नाम साफ़ अक्षरों में), नाम के नीचे की छोटी लाइनें, रंग, और आपके business की बोली — पहला set free, अगला 2 credits का। पसंद का logo चुनें और अपनी profile पर लगाएँ।" : "4 good logos (a small picture plus your name in clear letters), short lines for under your name, colours, and a style for how your business talks. The first set is free. Each set after that is 2 credits. Pick a logo and put it on your profile."}</p>

      <div className="rounded-xl border border-border p-3 space-y-3">
        {profiles.length > 1 && (
          <select className={inp} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.tagline ? ` — ${p.tagline}` : ""}</option>)}
          </select>
        )}
        <label className="block text-sm">
          <span className="font-semibold">{hi ? "बिज़नेस का नाम" : "Business name"}</span>
          <input className={`${inp} mt-1`} placeholder={hi ? "जैसे: Sharma Electronics" : "e.g. Sharma Electronics"} value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={60} />
          <span className="text-xs text-muted">{hi ? "नाम जैसा लिखेंगे, logo पर वैसा ही आएगा — Hindi या English, spelling कभी गलत नहीं होगी।" : "Your name will be on the logo exactly as you type it, in Hindi or English. It will never be spelt wrong."}</span>
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{hi ? "आपका काम" : "What you do"}</span>
          <input className={`${inp} mt-1`} placeholder={hi ? "जैसे: मोबाइल की दुकान, tiffin service, CA" : "e.g. mobile shop, tiffin service, CA"} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{hi ? "शहर" : "City"}</span>
          <input className={`${inp} mt-1`} placeholder={hi ? "जैसे: दिल्ली" : "e.g. Delhi"} value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} />
        </label>
        <div>
          <p className="text-sm font-semibold mb-1">{hi ? "स्टाइल" : "Style"}</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button key={s.key} type="button" onClick={() => setStyle(s.key)} className={`rounded-full px-3 py-1.5 text-sm border ${style === s.key ? "grad-brand text-white border-transparent" : "border-border text-muted"}`}>{hi ? s.hi : s.en}</button>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          <span className="font-semibold">{hi ? "पसंद के रंग" : "Colours you like"} <span className="text-muted font-normal">{hi ? "(ज़रूरी नहीं)" : "(optional)"}</span></span>
          <input className={`${inp} mt-1`} placeholder={hi ? "जैसे: नीला और सुनहरा" : "e.g. blue and gold"} value={colors} onChange={(e) => setColors(e.target.value)} maxLength={80} />
        </label>
        <button type="button" onClick={generate} disabled={busy || !business.trim()} className="w-full rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> {hi ? "बन रहा है… (लगभग 30 सेकंड)" : "Making… (about 30 seconds)"}</span> : hi ? "✨ Brand Kit बनाओ (₹0 अभी)" : "✨ Make my Brand Kit (₹0 for now)"}
        </button>
        {err && !kit && <p className="text-sm text-danger">{err}</p>}
      </div>

      {kit && (
        <div className="space-y-4">
          {kit.partial && <p className="text-xs text-muted">{hi ? "कुछ हिस्से नहीं बन पाए — बाकी नीचे हैं। आप फिर से कोशिश कर सकते हैं।" : "Some parts could not be made. The rest are below. You can try again."}</p>}

          {kit.options.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">{hi ? "Logo चुनें" : "Pick a logo"}</p>
              <div className="grid grid-cols-2 gap-2">
                {kit.options.map((u, i) => (
                  <button key={u} type="button" onClick={() => setLogo(u)} className={`relative aspect-square rounded-xl border-2 bg-white overflow-hidden ${logo === u ? "border-brand" : "border-border"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`Logo ${i + 1}`} className="h-full w-full object-contain" />
                    {logo === u && <span className="absolute top-1 right-1 h-5 w-5 rounded-full grad-brand text-white grid place-items-center"><Check className="h-3 w-3" /></span>}
                  </button>
                ))}
              </div>
              {(() => { const v = kit.variants?.find((x) => x.stacked === logo); return v ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[[v.wide, hi ? "चौड़ा" : "Wide"], [v.dark, hi ? "गहरे रंग पर" : "On dark colour"], [v.icon, hi ? "सिर्फ़ निशान" : "Symbol only"]].filter(([u]) => u).map(([u, l]) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-white p-1 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={l} className={`mx-auto h-14 w-full object-contain ${u === v.dark ? "rounded bg-[#12144a]" : ""}`} />
                      <span className="block text-[10px] text-muted">{l} ↓</span>
                    </a>
                  ))}
                </div>
              ) : null; })()}
            </div>
          )}

          {kit.taglines.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">{hi ? "नाम के नीचे की छोटी लाइन चुनें" : "Pick a short line for under your name"} <span className="text-muted font-normal">{hi ? "(ज़रूरी नहीं)" : "(optional)"}</span></p>
              <div className="space-y-1.5">
                {kit.taglines.map((tl) => (
                  <button key={tl} type="button" onClick={() => setTagline(tagline === tl ? "" : tl)} className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${tagline === tl ? "border-brand bg-brand-soft/40" : "border-border"}`}>{tl}</button>
                ))}
              </div>
              <p className="text-xs text-muted mt-1">{hi ? "यह लाइन तभी लगेगी जब profile में पहले से कोई लाइन न हो।" : "This line is used only if your profile does not have one yet."}</p>
            </div>
          )}

          {kit.palette.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">{hi ? "रंग" : "Colours"}</p>
              <div className="grid grid-cols-4 gap-2">
                {kit.palette.map((c) => (
                  <div key={c.name} className="rounded-xl border border-border overflow-hidden">
                    <div className="h-12" style={{ background: c.hex }} />
                    <div className="p-1.5 text-center"><p className="text-[11px] font-semibold capitalize">{c.name}</p><p className="text-[10px] text-muted">{c.hex}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {kit.voice && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold mb-1">{hi ? "आपके business की बोली" : "How your business talks"}</p>
              <p className="text-sm whitespace-pre-line">{kit.voice}</p>
            </div>
          )}

          {kit.keywords.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">{hi ? "आपके इलाके में लोग जो शब्द खोजते हैं" : "Words people search for near you"}</p>
              <div className="flex flex-wrap gap-1.5">
                {kit.keywords.map((k) => <span key={k} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted">{k}</span>)}
              </div>
            </div>
          )}

          {done ? (
            <div className="rounded-xl border border-brand bg-brand-soft/40 p-3 text-sm">
              <p className="font-semibold">✅ {hi ? "Logo आपकी profile पर लग गया!" : "Your logo is now on your profile!"}</p>
              <p className="text-muted mt-1">{hi ? "कल सुबह के poster से यह logo दिखेगा।" : "It will show on your posters from tomorrow morning."}</p>
              <Link href="/poster/profiles" className="inline-block mt-2 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white">{hi ? "प्रोफ़ाइल देखें →" : "View profiles →"}</Link>
            </div>
          ) : kit.options.length > 0 ? (
            <div className="space-y-2">
              {hasExistingLogo && <p className="text-xs text-amber-600 dark:text-amber-400">{hi ? "⚠️ इस profile में पहले से एक logo लगा है — यह लगाने पर पुराना logo बदल जाएगा।" : "⚠️ This profile already has a logo. Using this one will replace it."}</p>}
              {err && <p className="text-sm text-danger">{err}</p>}
              <button type="button" onClick={apply} disabled={applying || !logo} className="w-full rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {applying ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> {hi ? "लग रहा है…" : "Putting it on…"}</span> : hi ? "Profile पर लगाओ" : "Use on my profile"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
