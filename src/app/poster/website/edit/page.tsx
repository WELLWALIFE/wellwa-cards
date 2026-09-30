"use client";
// Website editor: the look (palette, fonts, hero layout, corners), the hero (words, picture, logo), the home page's
// sections (order, show/hide, trust facts) and the pages shown — with a live desktop preview above the controls.
// Everything here changes card.site.* only; the phone card, the pages and their text are untouched (those are
// edited in the full editor). One Save writes it all through PATCH /api/site/status.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Sparkles, ExternalLink, Eye, EyeOff, ChevronUp, ChevronDown, RefreshCw, Check, Palette, Type, LayoutTemplate, ListOrdered, Files, Link2, Image as ImageIcon } from "lucide-react";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { SITE_PHOTO_CREDITS } from "@/lib/site-pricing";
import { CreditPrice, UnlockDialog, useAiAccess } from "@/lib/ai-access";
import { SITE_PALETTES, FONT_PAIRS, HERO_LAYOUTS, RADII, brandPalette, type SitePalette } from "@/lib/site-style";
import { homeSections, sectionLabel, trustFacts, isEmptyBlock } from "@/lib/site-home";
import type { Card, SiteStyle } from "@/lib/types";

const PREVIEW_KEY = "site-edit";
type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; site: Card["site"] | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string }; card?: Card };
type Tab = "look" | "hero" | "home" | "pages";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:bg-surface2"}`;

// eslint-disable-next-line @next/next/no-img-element
const Thumb = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} className="h-full w-full object-contain" />;

/** A palette as a small gradient disc. */
function Swatch({ p, on, onClick, label }: { p: SitePalette; on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} className="flex shrink-0 flex-col items-center gap-1.5">
      <span className={`grid h-12 w-12 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)] ${on ? "ring-brand" : "ring-transparent"}`} style={{ background: `linear-gradient(135deg, ${p.deep} 0%, ${p.mid} 55%, ${p.glow} 100%)` }}>
        {on && <Check className="h-5 w-5" style={{ color: p.ink }} />}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </button>
  );
}

export default function WebsiteEditPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [tab, setTab] = useState<Tab>("look");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [refUrl, setRefUrl] = useState("");
  const [unlock, setUnlock] = useState(false);
  const access = useAiAccess();
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  const load = useCallback(async (id?: string) => {
    setErr("");
    try {
      const r = await api<Status & { error?: string }>(`/api/site/status?full=1${id ? `&card=${id}` : ""}`);
      if (!r.ok) { setErr(r.data?.error || "No internet — tap to try again"); return; }
      setS(r.data);
      if (r.data.hasCard && r.data.card) { setCard(r.data.card); setDirty(false); }
    } catch { setErr("No internet — tap to try again"); }
  }, []);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/website/edit"); return; } load(); })(); }, [router, load]);

  // The live preview: the working copy goes to localStorage, the iframe (the real website renderer) re-reads it.
  useEffect(() => {
    if (!card) return;
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(card)); } catch { /* full or private */ }
    try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
  }, [card]);
  useEffect(() => {
    const fit = () => { const w = box.current?.clientWidth ?? 0; if (w) setScale(Math.min(1, w / 1280)); };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, [s]);

  const site = card?.site ?? { enabled: true };
  const style: SiteStyle = site.style ?? {};
  const set = (patch: Partial<Card["site"] & object>) => { if (!card) return; setCard({ ...card, site: { ...(card.site ?? { enabled: true }), ...patch } }); setDirty(true); };
  const setStyle = (patch: Partial<SiteStyle>) => set({ style: { ...style, ...patch } });
  const setHero = (patch: Partial<Hero>) => set({ hero: { headline: "", sub: "", ...(site.hero ?? {}), ...patch } });
  const setHome = (patch: Partial<NonNullable<Card["site"]>["home"] & object>) => set({ home: { ...(site.home ?? {}), ...patch } });

  const visiblePages = useMemo(() => card ? card.pages.filter((p) => !(card.site?.hidden ?? []).includes(p.slug) && (p.slug === "home" || p.blocks.some((b) => !isEmptyBlock(b)))) : [], [card]);
  const sections = useMemo(() => card ? homeSections(card, visiblePages, { all: true }) : [], [card, visiblePages]);
  const hiddenSections = new Set(site.home?.hidden ?? []);
  const autoFacts = useMemo(() => card ? trustFacts({ ...card, site: { ...(card.site ?? { enabled: true }), home: { ...(card.site?.home ?? {}), stats: undefined } } }) : [], [card]);
  const stats = site.home?.stats ?? autoFacts;
  const brand = brandPalette(style.color || card?.themeColor || "#0e9e90");
  const paletteKey = style.palette && SITE_PALETTES.some((p) => p.key === style.palette) ? style.palette : "brand";

  function move(key: string, dir: -1 | 1) {
    const keys = sections.map((x) => x.key);
    const i = keys.indexOf(key); const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setHome({ order: keys });
  }
  function toggleSection(key: string) {
    const h = new Set(hiddenSections); if (h.has(key)) h.delete(key); else h.add(key);
    setHome({ hidden: [...h] });
  }
  function setStat(i: number, patch: Partial<{ value: string; label: string }>) {
    const next = stats.map((x, j) => (j === i ? { ...x, ...patch } : x));
    setHome({ stats: next });
  }

  async function save() {
    if (!card || !s?.hasCard) return;
    setBusy("save"); setMsg("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/site/status", { method: "PATCH", json: {
        card_id: s.cardId,
        style: site.style ?? {},
        home: { order: site.home?.order ?? [], hidden: site.home?.hidden ?? [], ...(site.home?.stats ? { stats: site.home.stats } : {}) },
        hero: { headline: site.hero?.headline ?? "", sub: site.hero?.sub ?? "", ctaLabel: site.hero?.ctaLabel ?? "", ...(site.hero?.imageUrl !== undefined ? { imageUrl: site.hero.imageUrl } : {}) },
        hideProfile: !!site.hideProfile,
        logoUrl: site.logoUrl ?? "",
        hidden: site.hidden ?? [],
        bar: site.bar?.text?.trim() ? { text: site.bar.text.trim(), link: site.bar.link ?? "", until: site.bar.until ?? "" } : null,
        float: site.float ?? "whatsapp",
      } });
      if (!r.ok) { setMsg(r.data.error ?? "Could not save."); return; }
      setDirty(false); setMsg(hi ? "✅ Website save ho gayi — live link par dikhegi." : "✅ Website saved — it is live on your link.");
    } catch { setMsg("No internet — please try again."); }
    finally { setBusy(""); }
  }
  async function copyLook() {
    if (!s?.hasCard || !refUrl.trim()) return;
    setBusy("ref"); setMsg("");
    try {
      const r = await api<{ ok?: boolean; site?: Card["site"]; error?: string }>("/api/site/status", { method: "PATCH", json: { card_id: s.cardId, reference: refUrl.trim() } });
      if (!r.ok || !r.data.site) { setMsg(r.data.error ?? "Could not read that website."); return; }
      if (card) setCard({ ...card, site: { ...(card.site ?? { enabled: true }), style: r.data.site.style, reference: r.data.site.reference } });
      setMsg(hi ? "✅ Us website ka look copy ho gaya — neeche preview dekhein." : "✅ Copied that website's look — see the preview.");
    } catch { setMsg("No internet — please try again."); }
    finally { setBusy(""); }
  }
  async function upload(file: File | null, kind: "hero" | "logo") {
    if (!file) return; setBusy(kind);
    try {
      const u = await uploadImage(await compressToFile(file, `${kind}.png`, kind === "hero" ? 1400 : 800, kind === "hero" ? 0.9 : 1, "png"), "logo");
      if (!u) { setMsg("Could not upload the photo. Please try again."); return; }
      if (kind === "hero") setHero({ imageUrl: u }); else set({ logoUrl: u });
    } catch { setMsg("Could not upload the photo. Please try again."); }
    finally { setBusy(""); }
  }
  async function aiHeroPhoto() {
    if (!s?.hasCard) return;
    if (!access.active) { setUnlock(true); return; }
    if (!confirm(`Make a new AI photo for the top of your website for ${SITE_PHOTO_CREDITS} credits?`)) return;
    setBusy("aiphoto"); setMsg("");
    try {
      const r = await api<{ ok?: boolean; url?: string; error?: string }>("/api/site/photo", { method: "POST", json: { card_id: s.cardId, slot: "hero" } });
      if (!r.ok || !r.data.url) { setMsg(r.data.error ?? "Could not make the photo."); return; }
      setHero({ imageUrl: r.data.url }); setMsg("✅ New AI photo added to the top of your website.");
    } catch { setMsg("No internet — please try again."); }
    finally { setBusy(""); }
  }

  if (!s || !card) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{err}</p>
      <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white"><RefreshCw className="h-5 w-5" /> Try again</button>
    </div>
  ) : s && !s.hasCard ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="text-sm text-muted">Create your card first — the website is built from it.</p>
      <Link href="/poster/card" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">Create card →</Link>
    </div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (!s.hasCard) return null;

  const TABS: { key: Tab; label: string; Icon: typeof Palette }[] = [
    { key: "look", label: hi ? "Look" : "Look", Icon: Palette },
    { key: "hero", label: hi ? "Top (hero)" : "Top (hero)", Icon: ImageIcon },
    { key: "home", label: hi ? "Home sections" : "Home sections", Icon: ListOrdered },
    { key: "pages", label: hi ? "Pages" : "Pages", Icon: Files },
  ];
  const PREVIEW_H = 2400;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <Link href="/poster/website" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">{hi ? "Website edit karein" : "Edit website"}</h1>
        <a href={`${s.url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{hi ? "Live dekhein" : "Open live"} <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
      {s.cards.length > 1 && (
        <select value={s.cardId} onChange={(e) => load(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
          {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
        </select>
      )}

      {/* ---- live preview (the real website renderer, scaled to fit) ---- */}
      <div ref={box} className="rounded-xl border border-border bg-white overflow-auto" style={{ height: Math.min(560, Math.round(PREVIEW_H * scale * 0.55)) }}>
        <div className="relative" style={{ width: Math.round(1280 * scale), height: Math.round(PREVIEW_H * scale) }}>
          <iframe ref={frame} title="Website preview" src={`/preview/site?k=${PREVIEW_KEY}`} className="absolute left-0 top-0 origin-top-left" style={{ width: 1280, height: PREVIEW_H, border: 0, transform: `scale(${scale})` }} />
        </div>
      </div>
      <p className="text-[11px] text-muted -mt-2">{hi ? "Ye preview computer par dikhne wali website hai — scroll karke poora dekhein. Save karne par hi live hoti hai." : "This is the website as computers see it — scroll inside to see it all. Changes go live only when you save."}</p>

      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => setTab(key)} className={`${chip(tab === key)} inline-flex shrink-0 items-center gap-1.5`}><Icon className="h-4 w-4" /> {label}</button>)}
      </div>

      {tab === "look" && (
        <section className="space-y-5 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><Palette className="h-4 w-4 text-brand" /> {hi ? "Colour palette" : "Colour palette"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "Website ke colours. Aapka card apne colour me hi rahega." : "The website's colours. Your phone card keeps its own colour."}</p>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              <Swatch p={brand} on={paletteKey === "brand"} onClick={() => setStyle({ palette: "brand" })} label={hi ? "Aapka" : "Yours"} />
              {SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => <Swatch key={p.key} p={p} on={paletteKey === p.key} onClick={() => setStyle({ palette: p.key })} label={hi ? p.hi : p.name} />)}
            </div>
            {paletteKey === "brand" && (
              <label className="mt-1 inline-flex items-center gap-2 text-xs text-muted">
                <input type="color" value={style.color || card.themeColor || "#0e9e90"} onChange={(e) => setStyle({ color: e.target.value })} className="h-7 w-10 rounded border border-border bg-surface p-0.5" />
                {hi ? "Website ka colour (card se alag rakh sakte hain)" : "Website colour (can differ from the card)"}
                {style.color && <button type="button" onClick={() => setStyle({ color: undefined })} className="underline">reset</button>}
              </label>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-4 w-4 text-brand" /> {hi ? "Fonts" : "Fonts"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FONT_PAIRS.map((f) => <button key={f.key} type="button" onClick={() => setStyle({ font: f.key === "look" ? undefined : f.key })} className={chip((style.font ?? "look") === f.key)} title={f.blurb}>{hi ? f.hi : f.name}</button>)}
            </div>
            <p className="text-[11px] text-muted mt-1">{FONT_PAIRS.find((f) => f.key === (style.font ?? "look"))?.blurb}</p>
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><LayoutTemplate className="h-4 w-4 text-brand" /> {hi ? "Top (hero) layout" : "Top (hero) layout"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyle({ hero: undefined })} className={chip(!style.hero)}>{hi ? "Auto" : "Auto"}</button>
              {HERO_LAYOUTS.map((h) => <button key={h.key} type="button" onClick={() => setStyle({ hero: h.key })} className={chip(style.hero === h.key)} title={h.blurb}>{hi ? h.hi : h.name}</button>)}
            </div>
            <p className="text-[11px] text-muted mt-1">{style.hero ? HERO_LAYOUTS.find((h) => h.key === style.hero)?.blurb : (hi ? "Auto: product photo ho to Split, banner ho to Photo." : "Auto: Split when there is a product photo, Photo when there is a banner.")}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Corners" : "Corners"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyle({ radius: undefined })} className={chip(!style.radius)}>{hi ? "Card jaisa" : "Like the card"}</button>
              {RADII.map((r) => <button key={r.key} type="button" onClick={() => setStyle({ radius: r.key })} className={chip(style.radius === r.key)}>{hi ? r.hi : r.name}</button>)}
            </div>
          </div>
          <div className="rounded-lg bg-surface2 p-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="h-4 w-4 text-brand" /> {hi ? "Kisi website jaisa look" : "Copy the look of a website you like"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "Us website ke colours, fonts aur layout copy honge — text, photo ya products nahi. Free." : "Only its colours, fonts and layout are copied — never its words, photos or products. Free."}</p>
            <div className="mt-2 flex gap-2">
              <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="e.g. somebrand.com" className={`${field} mt-0 flex-1`} />
              <button type="button" onClick={copyLook} disabled={busy === "ref" || !refUrl.trim()} className="rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "ref" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : (hi ? "Copy" : "Copy look")}</button>
            </div>
            {site.reference?.url && <p className="text-[11px] text-muted mt-1.5">{hi ? "Abhi ka look is website se:" : "Current look follows:"} {site.reference.url.replace(/^https?:\/\//, "")}</p>}
          </div>
        </section>
      )}

      {tab === "hero" && (
        <section className="space-y-4 rounded-xl border border-border p-3">
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "Headline (badi line)" : "Headline"}</span><input value={site.hero?.headline ?? ""} onChange={(e) => setHero({ headline: e.target.value })} placeholder={s.defaults.headline} maxLength={90} className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "Headline ke neeche 1–2 line" : "Sub text (1–2 lines)"}</span><textarea value={site.hero?.sub ?? ""} onChange={(e) => setHero({ sub: e.target.value })} placeholder={s.defaults.sub} rows={2} maxLength={240} className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "WhatsApp button ka text" : "WhatsApp button text"}</span><input value={site.hero?.ctaLabel ?? ""} onChange={(e) => setHero({ ctaLabel: e.target.value })} placeholder="WhatsApp" maxLength={30} className={field} /></label>
          <div>
            <p className="text-xs font-semibold text-muted mb-1.5">{hi ? "Top par image (product ya logo)" : "Picture at the top (a product or your logo)"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setHero({ imageUrl: "" })} className={`h-16 w-16 rounded-xl border-2 grid place-items-center text-[11px] ${site.hero?.imageUrl === "" ? "border-brand bg-brand-soft" : "border-border"}`}>none</button>
              {s.images.map((im) => <button key={im.url} type="button" title={im.label} onClick={() => setHero({ imageUrl: im.url })} className={`h-16 w-16 rounded-xl border-2 overflow-hidden bg-white ${site.hero?.imageUrl === im.url ? "border-brand" : "border-border"}`}><Thumb src={im.url} alt={im.label} /></button>)}
              {site.hero?.imageUrl && !s.images.some((im) => im.url === site.hero?.imageUrl) && <span className="h-16 w-16 rounded-xl border-2 border-brand overflow-hidden bg-white"><Thumb src={site.hero.imageUrl} alt="" /></span>}
              <label className="h-16 w-16 rounded-xl border-2 border-dashed border-border grid place-items-center text-[11px] cursor-pointer">{busy === "hero" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "+ upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? null, "hero")} /></label>
            </div>
            <button type="button" onClick={aiHeroPhoto} disabled={busy === "aiphoto"} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-60">
              {busy === "aiphoto" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Make a new AI photo<CreditPrice credits={SITE_PHOTO_CREDITS} />
            </button>
            <p className="text-[11px] text-muted mt-1">{hi ? "Kuch na chunein to pehle product ki photo aa jaati hai. Apna portrait yahan na lagayein." : "Leave it and the first product photo is used. Don't put your portrait here."}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted mb-1.5">{hi ? "Website logo (header aur footer)" : "Website logo (header and footer)"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set({ logoUrl: "" })} className={`h-16 w-16 rounded-xl border-2 grid place-items-center text-[11px] ${!site.logoUrl ? "border-brand bg-brand-soft" : "border-border"}`}>{hi ? "card photo" : "card photo"}</button>
              {s.images.filter((im) => im.label === "Logo").map((im) => <button key={im.url} type="button" onClick={() => set({ logoUrl: im.url })} className={`h-16 w-16 rounded-xl border-2 overflow-hidden bg-white ${site.logoUrl === im.url ? "border-brand" : "border-border"}`}><Thumb src={im.url} alt="Logo" /></button>)}
              {site.logoUrl && !s.images.some((im) => im.url === site.logoUrl) && <span className="h-16 w-16 rounded-xl border-2 border-brand overflow-hidden bg-white"><Thumb src={site.logoUrl} alt="" /></span>}
              <label className="h-16 w-16 rounded-xl border-2 border-dashed border-border grid place-items-center text-[11px] cursor-pointer">{busy === "logo" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "+ upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? null, "logo")} /></label>
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5"><span className="text-sm font-medium">{hi ? "Headline ke neeche meri photo + naam" : "My photo + name under the headline"}</span><input type="checkbox" className="h-5 w-5" checked={!site.hideProfile} onChange={(e) => set({ hideProfile: !e.target.checked })} /></label>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-semibold">📣 {hi ? "Announcement bar (header ke upar)" : "Announcement bar (above the header)"}</p>
            <input value={site.bar?.text ?? ""} onChange={(e) => set({ bar: { ...(site.bar ?? { text: "" }), text: e.target.value } })} maxLength={120} placeholder={hi ? "e.g. Diwali offer — 20% off, 5 Nov tak" : "e.g. Diwali offer — 20% off till 5 Nov"} className={`${field} mt-0`} />
            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              <input value={site.bar?.link ?? ""} onChange={(e) => set({ bar: { ...(site.bar ?? { text: "" }), link: e.target.value.trim() } })} placeholder={hi ? "Link (optional): #products ya https://…" : "Link (optional): #products or https://…"} className={`${field} mt-0`} />
              <input type="date" value={site.bar?.until ?? ""} onChange={(e) => set({ bar: { ...(site.bar ?? { text: "" }), until: e.target.value } })} className={`${field} mt-0`} title={hi ? "Is din tak dikhe" : "Show until"} />
            </div>
            <p className="text-[11px] text-muted">{hi ? "Khali chhodein to bar nahi dikhega. Date ke baad apne-aap hat jayega." : "Leave empty for no bar. It disappears after the date."}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Floating button (website par)" : "Floating button (on the website)"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {([["whatsapp", "WhatsApp"], ["call", hi ? "Call" : "Call"], ["none", hi ? "Koi nahi" : "None"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => set({ float: k })} className={chip((site.float ?? "whatsapp") === k)}>{l}</button>)}
            </div>
            <p className="text-[11px] text-muted">{hi ? "Computer par neeche-baayein gol button; phone par neeche Call · WhatsApp · Directions ki patti hamesha rahti hai." : "A round button bottom-left on computers; phones always get the Call · WhatsApp · Directions bar at the bottom."}</p>
          </div>
        </section>
      )}

      {tab === "home" && (
        <section className="space-y-4 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-semibold">{hi ? "Home page ke sections" : "Sections on the home page"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "Upar-neeche karein ya chhupayein. Text badalne ke liye full editor." : "Reorder or hide. To change the words, use the full editor."}</p>
            <ul className="mt-2 space-y-1.5">
              {sections.map((sec, i) => {
                const off = hiddenSections.has(sec.key);
                return (
                  <li key={sec.key} className={`flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 ${off ? "opacity-50" : ""}`}>
                    <span className="flex-1 truncate text-sm">{sectionLabel(sec, card.language)}{sec.kind !== "block" && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">{hi ? "preview" : "preview"}</span>}</span>
                    <button type="button" onClick={() => move(sec.key, -1)} disabled={i === 0} className="rounded p-1 text-muted disabled:opacity-30" aria-label="Up"><ChevronUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(sec.key, 1)} disabled={i === sections.length - 1} className="rounded p-1 text-muted disabled:opacity-30" aria-label="Down"><ChevronDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => toggleSection(sec.key)} className="rounded p-1 text-muted" aria-label={off ? "Show" : "Hide"}>{off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </li>
                );
              })}
            </ul>
            {(site.home?.order?.length || site.home?.hidden?.length) ? <button type="button" onClick={() => setHome({ order: undefined, hidden: undefined })} className="mt-2 text-xs font-semibold text-brand-ink">{hi ? "Default order par wapas" : "Back to the default order"}</button> : null}
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "Bharose ke numbers (hero ke neeche)" : "Trust numbers (under the top)"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "Card ke facts se automatic bante hain — 3 se kam ho to strip nahi dikhti. Aap apne likh sakte hain (jo sach ho)." : "Made from your card's own facts — the strip shows only with 3 or more. You can write your own (true ones only)."}</p>
            <div className="mt-2 grid gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                  <input value={stats[i]?.value ?? ""} onChange={(e) => setStat(i, { value: e.target.value })} placeholder={["4.8★", "Since 2015", "12+", "7 days"][i]} maxLength={24} className={`${field} mt-0`} />
                  <input value={stats[i]?.label ?? ""} onChange={(e) => setStat(i, { label: e.target.value })} placeholder={["customer reviews", "years of trust", "products", "open every day"][i]} maxLength={40} className={`${field} mt-0`} />
                </div>
              ))}
            </div>
            {site.home?.stats && <button type="button" onClick={() => setHome({ stats: undefined })} className="mt-2 text-xs font-semibold text-brand-ink">{hi ? "Automatic par wapas" : "Back to automatic"}</button>}
          </div>
        </section>
      )}

      {tab === "pages" && (
        <section className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{hi ? "Website par kaunse pages dikhein" : "Pages shown on the website"}</p>
          {s.pages.map((p) => {
            const h = new Set(site.hidden ?? []);
            return (
              <label key={p.slug} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{p.label} <span className="text-[11px] text-muted">· {p.blocks} sections</span></span>
                <input type="checkbox" className="h-5 w-5" checked={!h.has(p.slug)} onChange={(e) => { if (e.target.checked) h.delete(p.slug); else h.add(p.slug); set({ hidden: [...h] }); }} />
              </label>
            );
          })}
          {(() => { const h = new Set(site.hidden ?? []); const on = !h.has("updates"); return (
            <label className="flex items-center justify-between rounded-lg border border-brand/40 bg-brand-soft/30 px-3 py-2">
              <span className="text-sm">{hi ? "Updates" : "Updates"} <span className="text-[11px] text-muted">· {hi ? "aapke roz ke posters ka page (auto)" : "your daily posters as a page (automatic)"}</span></span>
              <input type="checkbox" className="h-5 w-5" checked={on} onChange={(e) => { if (e.target.checked) h.delete("updates"); else h.add("updates"); set({ hidden: [...h] }); }} />
            </label>
          ); })()}
          <Link href={`/poster/d/editor?id=${s.cardId}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">{hi ? "Text / photo / products badlein (full editor)" : "Change text, photos, products (full editor)"} →</Link>
        </section>
      )}

      {/* ---- save bar: above the app's bottom navigation, not over it (same as the explainer editor) ---- */}
      <div className="fixed bottom-[64px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs text-muted">{dirty ? (hi ? "Badlav abhi save nahi hue" : "Unsaved changes") : (hi ? "Sab save hai" : "All saved")}</p>
          <button type="button" onClick={save} disabled={busy === "save" || !dirty} className="rounded-xl grad-brand px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy === "save" ? "…" : (hi ? "Save karein" : "Save")}</button>
        </div>
      </div>
      {unlock && <UnlockDialog reason="Make professional AI photos for your website." onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );
}
