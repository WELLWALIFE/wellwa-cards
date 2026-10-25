"use client";
// Website editor: the look (palette, fonts, hero layout, corners), the hero (words, picture, logo), the home page's
// sections (order, show/hide, trust facts) and the pages shown — with a live desktop preview above the controls.
// Everything here changes card.site.* only; the phone card, the pages and their text are untouched (those are
// edited in the full editor). One Save writes it all through PATCH /api/site/status.
import { SiteLink } from "@/components/poster/card-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Sparkles, ExternalLink, Eye, EyeOff, ChevronUp, ChevronDown, RefreshCw, Check, Palette, Type, LayoutTemplate, ListOrdered, Files, Link2, Image as ImageIcon, Maximize2, Minimize2, Sun, Moon, Package, BookUser, ListChecks, Star, User, Clock, Wallet, Megaphone, Globe, Search, Store, Camera, Paintbrush, Phone, Settings } from "lucide-react";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { SITE_PHOTO_CREDITS } from "@/lib/site-pricing";
import { CreditPrice, UnlockDialog, useAiAccess } from "@/lib/ai-access";
import { SITE_PALETTES, FONT_PAIRS, HERO_LAYOUTS, RADII, brandPalette, type SitePalette } from "@/lib/site-style";
import { HEADING_FONTS, HERO_IDS, SHAPES } from "@/lib/site-advanced";
import { SitePhotos } from "@/components/poster/site-photos";
import { NoticeBox } from "@/components/poster/notice-box";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";
import { homeSections, sectionLabel, trustFacts, isEmptyBlock } from "@/lib/site-home";
import type { Card, HeroSlide, SiteStyle } from "@/lib/types";

const PREVIEW_KEY = "site-edit";
type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string; slides?: HeroSlide[] };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; site: Card["site"] | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string }; card?: Card };
type Tab = "look" | "hero" | "home" | "pages" | "photos" | "products" | "about" | "details" | "reviews" | "you" | "where" | "links" | "offer" | "domain" | "seo" | "trade";
type Group = "design" | "content" | "contact" | "settings";
/** Tabs whose own screen is shown inside this one (a frame): it saves by itself and tells this page (components/poster/embed-mode.tsx). */
const DONE = "/poster/embed-done";
const EMBED: Partial<Record<Tab, (cardId: string) => string>> = {
  products: () => `/poster/products?back=${DONE}`,
  about: () => `/poster/onboard?step=about&back=${DONE}`,
  details: () => `/poster/onboard?step=details&back=${DONE}`,
  reviews: () => `/poster/testimonials?back=${DONE}`,
  you: () => `/poster/onboard?step=you&back=${DONE}`,
  where: () => `/poster/onboard?step=where&back=${DONE}`,
  links: () => `/poster/onboard?step=extras&part=links&back=${DONE}`,
  seo: (id) => `/poster/site/seo?card=${encodeURIComponent(id)}&back=${DONE}`,
  trade: () => `/poster/onboard?step=trade&back=${DONE}`,
};

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:bg-surface2"}`;

// eslint-disable-next-line @next/next/no-img-element
const Thumb = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} className="h-full w-full object-contain" />;

/** A palette as a small gradient disc. */
function Swatch({ p, on, onClick, label }: { p: SitePalette; on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} className="flex shrink-0 flex-col items-center gap-1 pt-1">
      <span className={`grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)] ${on ? "ring-brand" : "ring-transparent"}`} style={{ background: `linear-gradient(135deg, ${p.deep} 0%, ${p.mid} 55%, ${p.glow} 100%)` }}>
        {on && <Check className="h-5 w-5" style={{ color: p.ink }} />}
      </span>
      <span className="text-[10px] text-muted">{label}</span>
    </button>
  );
}

/** Plain names for the Premium tops (lib/site-advanced.ts HERO_IDS), English and Hindi. */
const ADV_HERO_NAMES: Record<string, [string, string]> = {
  "split-frame": ["Words + framed photo", "शब्द + फ्रेम में photo"], "full-bleed": ["Full photo", "पूरी photo"],
  "editorial-marquee": ["Big letters + moving line", "बड़े अक्षर + चलती पट्टी"], "glass-card": ["Photo + glass card", "Photo + शीशे का card"],
  "stacked-poster": ["Centre + arch photo", "बीच में + arch photo"], "mosaic": ["Mosaic", "Mosaic"], "video-first": ["Video first", "पहले video"],
  "centered-minimal": ["Calm, centred", "शांत, बीच में"], "diagonal": ["Slanted photo", "तिरछी photo"], "masthead": ["Magazine title", "Magazine जैसा"],
  "kinetic-type": ["Giant headline", "बहुत बड़ी headline"], "pinned-story": ["Scroll story", "Scroll कहानी"], "parallax-collage": ["Floating collage", "तैरती photos"],
  "product-spotlight": ["Product spotlight", "Product spotlight"],
};

export default function WebsiteEditPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [tab, setTab] = useState<Tab>("look");
  const [group, setGroup] = useState<Group>("design");
  /** A screen in a tab (Products, Timings …) showing its unsaved change: the window shows that copy until it is saved. */
  const [embedView, setEmbedView] = useState<{ card: Card; page?: string; focus?: { top?: boolean; text?: string } } | null>(null);
  const [embedKey, setEmbedKey] = useState(0);
  const [embedH, setEmbedH] = useState(640);
  const [savedTab, setSavedTab] = useState("");
  const embedFrame = useRef<HTMLIFrameElement>(null);
  /** Which parts of the website this page changed and has not saved: kept when a tab's own Save brings the card back fresh. */
  const touched = useRef(new Set<string>());
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";
  const [tier, setTier] = useState<string | null>(null);
  useEffect(() => { api<{ tier?: string | null }>("/api/poster/plan").then((r) => { if (r.ok) setTier(r.data.tier ?? null); }).catch(() => undefined); }, []);
  const [busy, setBusy] = useState("");
  // ONE message at a time, tagged with the control it belongs to and shown right under that control (never a line at the top of the
  // page): "save" = in the Save bar, "ref" = under Copy look, "hero" / "logo" = under that picture row, "ai" = under the AI-photo button.
  const [note, setNote] = useState<{ k: "save" | "ref" | "hero" | "logo" | "ai"; text: string; bad: boolean } | null>(null);
  const say = (k: "save" | "ref" | "hero" | "logo" | "ai", text: string, bad = true) => setNote({ k, text, bad });
  const line = (k: "save" | "ref" | "hero" | "logo" | "ai", cls = "") => note?.k === k ? <p role={note.bad ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${note.bad ? "border-danger/40 bg-danger/10 text-danger" : "border-good/40 bg-good/10 text-good"} ${cls}`}>{note.text}</p> : null;
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [refUrl, setRefUrl] = useState("");
  const [unlock, setUnlock] = useState(false);
  const access = useAiAccess();
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  // The window on top stays put while the options under it scroll (owner, 24 Oct 2026); a tap makes it big or small again.
  const [big, setBig] = useState(false);
  // One screen of the website, not the whole page (a one-screen-tall hero grew with a page-tall frame; 24 Oct 2026): it scrolls inside.
  const [boxH, setBoxH] = useState(230);
  const focusAsk = useRef<{ top?: boolean; text?: string } | null>(null);
  /** Show this part in the window: the top of the website, or the section / line with this text. */
  const focus = (f: { top?: boolean; text?: string }) => { focusAsk.current = f; };

  const load = useCallback(async (id?: string) => {
    setErr("");
    try {
      const r = await api<Status & { error?: string }>(`/api/site/status?full=1${id ? `&card=${id}` : ""}`);
      if (!r.ok) { setErr(r.data?.error || "No internet — tap to try again"); return; }
      setS(r.data);
      if (r.data.hasCard && r.data.card) { setCard(r.data.card); setDirty(false); touched.current.clear(); }
    } catch { setErr("No internet — tap to try again"); }
  }, []);
  // Replace, not push: Back from the login page must not land here again and bounce straight back to it.
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace("/login?next=/poster/website/edit"); return; } load(); })(); }, [router, load]);

  // The live preview: the working copy goes to localStorage, the iframe (the real website renderer) re-reads it.
  // What the window shows: this page's working copy, or a tab screen's unsaved copy with this page's own unsaved changes on it.
  const previewPage = embedView?.page ?? "";
  useEffect(() => {
    const shown = embedView && card ? keepTouched(embedView.card, card, touched.current) : card;
    if (!shown) return;
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(shown)); } catch { /* full or private */ }
    try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
    const f = focusAsk.current ?? embedView?.focus ?? null; focusAsk.current = null;
    if (f) try { frame.current?.contentWindow?.postMessage({ type: "preview-focus", key: PREVIEW_KEY, ...f }, window.location.origin); } catch { /* ignore */ }
  }, [card, embedView]);

  /** The card again from the server (a tab's own Save changed it), with this page's unsaved changes kept on top. */
  const refresh = useCallback(async () => {
    if (!s?.hasCard) return;
    try {
      const r = await api<Status & { error?: string }>(`/api/site/status?full=1&card=${encodeURIComponent(s.cardId)}`);
      if (!r.ok || !r.data.hasCard || !r.data.card) return;
      setS(r.data);
      const fresh = r.data.card;
      setCard((cur) => (cur ? keepTouched(fresh, cur, touched.current) : fresh));
    } catch { /* offline: the window keeps what it shows */ }
  }, [s]);
  // Messages from the screen shown in a tab: its height, its unsaved copy for the window, and "saved" / "closed".
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !embedFrame.current || e.source !== embedFrame.current.contentWindow) return;
      const m = e.data as { type?: string; h?: number; card?: Card; page?: string; focus?: { top?: boolean; text?: string }; saved?: boolean };
      if (m?.type === "embed-height" && typeof m.h === "number") setEmbedH(Math.max(320, Math.min(m.h, 20000)));
      else if (m?.type === "embed-live" && m.card) setEmbedView({ card: m.card, page: m.page, focus: m.focus });
      else if (m?.type === "embed-done") {
        setEmbedView(null);
        if (m.saved) { setSavedTab(tab); void refresh(); setTimeout(() => setSavedTab(""), 4000); }
        setEmbedKey((k) => k + 1);   // the screen opens again, fresh
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [refresh, tab]);
  useEffect(() => {
    const el = box.current;
    const fit = () => { if (!el) return; if (el.clientWidth) setScale(Math.min(1, el.clientWidth / 1280)); if (el.clientHeight) setBoxH(el.clientHeight); };
    fit();
    const ro = el && "ResizeObserver" in window ? new ResizeObserver(fit) : null;
    if (el) ro?.observe(el);
    window.addEventListener("resize", fit); return () => { ro?.disconnect(); window.removeEventListener("resize", fit); };
  }, [s]);
  const frameH = Math.round(boxH / scale);

  const site = card?.site ?? { enabled: true };
  const style: SiteStyle = site.style ?? {};
  const set = (patch: Partial<Card["site"] & object>) => { if (!card) return; Object.keys(patch).forEach((k) => touched.current.add(k)); setNote((n) => (n?.k === "save" ? null : n)); setCard({ ...card, site: { ...(card.site ?? { enabled: true }), ...patch } }); setDirty(true); };
  const setStyle = (patch: Partial<SiteStyle>) => { focus({ top: true }); set({ style: { ...style, ...patch } }); };
  const setHero = (patch: Partial<Hero>) => { focus({ top: true }); set({ hero: { headline: "", sub: "", ...(site.hero ?? {}), ...patch } }); };
  const setHome = (patch: Partial<NonNullable<Card["site"]>["home"] & object>) => set({ home: { ...(site.home ?? {}), ...patch } });

  const visiblePages = useMemo(() => card ? card.pages.filter((p) => !(card.site?.hidden ?? []).includes(p.slug) && (p.slug === "home" || p.blocks.some((b) => !isEmptyBlock(b)))) : [], [card]);
  const sections = useMemo(() => card ? homeSections(card, visiblePages, { all: true }) : [], [card, visiblePages]);
  const hiddenSections = new Set(site.home?.hidden ?? []);
  const autoFacts = useMemo(() => card ? trustFacts({ ...card, site: { ...(card.site ?? { enabled: true }), home: { ...(card.site?.home ?? {}), stats: undefined } } }) : [], [card]);
  const stats = site.home?.stats ?? autoFacts;
  const brand = brandPalette(style.color || card?.themeColor || "#0e9e90");
  // A Premium design carries its own colours (site.advanced.palette): the colour row changes THOSE when it is the design on show
  // (owner, 23 Oct 2026: tapping a colour did nothing on a Premium site), and the basic site's colour along with it.
  const adv = (site as { advancedOn?: boolean }).advancedOn !== false && site.advanced ? site.advanced as { palette?: { key?: string; color?: string } } & Record<string, unknown> : null;
  const paletteKey = adv ? (adv.palette?.key && (adv.palette.key === "brand" || SITE_PALETTES.some((p) => p.key === adv.palette?.key)) ? adv.palette.key : "brand")
    : style.palette && SITE_PALETTES.some((p) => p.key === style.palette) ? style.palette : "brand";
  /** A change to the Premium design itself (fonts, the top, corners): shown in the window at once, saved with Save like the rest. */
  const setAdv = (patch: Record<string, unknown>) => { if (!adv) return; focus({ top: true }); set({ advanced: { ...adv, ...patch } as NonNullable<Card["site"]>["advanced"] }); };
  const pickColour = (key: string, color?: string) => {
    focus({ top: true });
    const nextStyle = { ...style, palette: key, ...(color !== undefined ? { color } : {}) };
    if (adv) set({ style: nextStyle, advanced: { ...adv, palette: { ...(adv.palette ?? {}), key, ...(key === "brand" ? { color: color ?? style.color ?? card?.themeColor } : {}) } } as NonNullable<Card["site"]>["advanced"] });
    else set({ style: nextStyle });
  };

  /** The words a section shows as its heading, to find it in the window. */
  const secText = (key: string) => {
    const sec = sections.find((x) => x.key === key);
    if (!sec) return "";
    if (sec.kind === "block") return "title" in sec.block ? (sec.block.title ?? "").trim() : "";
    return sec.title;
  };
  function move(key: string, dir: -1 | 1) {
    focus({ text: secText(key) });
    const keys = sections.map((x) => x.key);
    const i = keys.indexOf(key); const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setHome({ order: keys });
  }
  function toggleSection(key: string) {
    const h = new Set(hiddenSections);
    // Shown again: that section; hidden: the one now in its place.
    const at = sections.findIndex((x) => x.key === key);
    const near = sections.slice(at + 1).find((x) => !h.has(x.key)) ?? sections.slice(0, at).reverse().find((x) => !h.has(x.key));
    focus(h.has(key) ? { text: secText(key) } : near ? { text: secText(near.key) } : { top: true });
    if (h.has(key)) h.delete(key); else h.add(key);
    setHome({ hidden: [...h] });
  }
  function setStat(i: number, patch: Partial<{ value: string; label: string }>) {
    const next = stats.map((x, j) => (j === i ? { ...x, ...patch } : x));
    focus(next[i]?.value?.trim() ? { text: next[i].value.trim() } : { top: true });
    setHome({ stats: next });
  }

  async function save() {
    if (!card || !s?.hasCard) return;
    setBusy("save"); setNote(null);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/site/status", { method: "PATCH", json: {
        card_id: s.cardId,
        style: site.style ?? {},
        home: { order: site.home?.order ?? [], hidden: site.home?.hidden ?? [], ...(site.home?.stats ? { stats: site.home.stats } : {}) },
        hero: { headline: site.hero?.headline ?? "", sub: site.hero?.sub ?? "", ctaLabel: site.hero?.ctaLabel ?? "", ...(site.hero?.imageUrl !== undefined ? { imageUrl: site.hero.imageUrl } : {}), ...(site.hero?.slides ? { slides: site.hero.slides.filter((x) => x.headline.trim()) } : {}) },
        hideProfile: !!site.hideProfile,
        logoUrl: site.logoUrl ?? "",
        hidden: site.hidden ?? [],
        bar: site.bar?.text?.trim() ? { text: site.bar.text.trim(), link: site.bar.link ?? "", until: site.bar.until ?? "" } : null,
        float: site.float ?? "whatsapp",
        ...(adv?.palette?.key ? { advancedPalette: { key: adv.palette.key, ...(adv.palette.color ? { color: adv.palette.color } : {}) } } : {}),
        ...(adv ? { advancedLook: { heading: (adv.fonts as { heading?: string } | undefined)?.heading, hero: adv.hero, shape: adv.shape, tone: (adv.palette as { tone?: string } | undefined)?.tone } } : {}),
      } });
      if (!r.ok) { say("save", r.data.error ?? (hi ? "Save नहीं हुआ। दोबारा try करें।" : "Could not save.")); return; }
      setDirty(false); touched.current.clear(); say("save", hi ? "✅ वेबसाइट सेव हो गई — लाइव लिंक पर दिखेगी।" : "✅ Website saved — it is live on your link.", false);
    } catch { say("save", hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again."); }
    finally { setBusy(""); }
  }
  async function copyLook() {
    if (!s?.hasCard || !refUrl.trim()) return;
    setBusy("ref"); setNote(null);
    try {
      const r = await api<{ ok?: boolean; site?: Card["site"]; error?: string }>("/api/site/status", { method: "PATCH", json: { card_id: s.cardId, reference: refUrl.trim() } });
      if (!r.ok || !r.data.site) { say("ref", r.data.error ?? (hi ? "वो website पढ़ी नहीं जा सकी।" : "Could not read that website.")); return; }
      if (card) setCard({ ...card, site: { ...(card.site ?? { enabled: true }), style: r.data.site.style, reference: r.data.site.reference } });
      // A Premium website wears its own design: the copied colours, letters and corners go onto it too (owner, 25 Oct 2026: "Copy the look
      // bhi kaam nahi kar raha" — it only changed the basic site). Saved with Save, like the rest.
      const st = r.data.site.style ?? {};
      if (adv && card) {
        const head = FONT_PAIRS.find((f) => f.key === st.font)?.head;
        const shape = st.radius === "round" ? "pill" : st.radius === "sharp" ? "sharp" : st.radius === "soft" ? "soft" : undefined;
        const nextAdv = {
          ...adv,
          ...(st.palette ? { palette: { ...(adv.palette ?? {}), key: st.palette, ...(st.palette === "brand" && st.color ? { color: st.color } : {}) } } : {}),
          ...(head && (HEADING_FONTS as string[]).includes(head) ? { fonts: { ...((adv.fonts as object) ?? {}), heading: head } } : {}),
          ...(shape ? { shape } : {}),
        };
        setCard({ ...card, site: { ...(card.site ?? { enabled: true }), style: st, reference: r.data.site.reference, advanced: nextAdv as NonNullable<Card["site"]>["advanced"] } });
        touched.current.add("style"); touched.current.add("advanced");
        setDirty(true);
      }
      say("ref", hi ? "✅ उस वेबसाइट का लुक कॉपी हो गया — ऊपर preview देखें।" : "✅ Copied that website's look — see the preview above.", false);
    } catch { say("ref", hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again."); }
    finally { setBusy(""); }
  }
  async function upload(file: File | null, kind: "hero" | "logo") {
    if (!file) return; setBusy(kind); setNote(null);
    const failed = hi ? "Photo upload नहीं हुई। दोबारा try करें।" : "Could not upload the photo. Please try again.";
    try {
      const u = await uploadImage(await compressToFile(file, `${kind}.png`, kind === "hero" ? 1400 : 800, kind === "hero" ? 0.9 : 1, "png"), "logo");
      if (!u) { say(kind, failed); return; }
      if (kind === "hero") setHero({ imageUrl: u }); else set({ logoUrl: u });
    } catch { say(kind, failed); }
    finally { setBusy(""); }
  }
  async function aiHeroPhoto() {
    if (!s?.hasCard) return;
    if (!access.active) { setUnlock(true); return; }
    if (!confirm(`Make a new AI photo for the top of your website for ${SITE_PHOTO_CREDITS} credits?`)) return;
    setBusy("aiphoto"); setNote(null);
    try {
      const r = await api<{ ok?: boolean; url?: string; error?: string }>("/api/site/photo", { method: "POST", json: { card_id: s.cardId, slot: "hero" } });
      if (!r.ok || !r.data.url) { say("ai", r.data.error ?? (hi ? "Photo नहीं बन पाई। दोबारा try करें।" : "Could not make the photo.")); return; }
      setHero({ imageUrl: r.data.url }); say("ai", hi ? "✅ वेबसाइट के ऊपर नई AI photo लग गई।" : "✅ New AI photo added to the top of your website.", false);
    } catch { say("ai", hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again."); }
    finally { setBusy(""); }
  }

  if (!s || !card) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{err}</p>
      <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white"><RefreshCw className="h-5 w-5" /> Try again</button>
    </div>
  ) : s && !s.hasCard ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="text-sm text-muted">{hi ? "पहले अपना card बनाएँ।" : "Make your card first."}</p>
      <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{hi ? "मेरा card बनाएँ →" : "Make my card →"}</Link>
    </div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (!s.hasCard) return null;

  // Everything about the website on this one page (owner, 25 Oct 2026: "saari cheez yahi par"), in four groups.
  const GROUPS: { key: Group; label: string; Icon: typeof Palette; tabs: { key: Tab; label: string; Icon: typeof Palette }[] }[] = [
    { key: "design", label: hi ? "डिज़ाइन" : "Design", Icon: Paintbrush, tabs: [
      { key: "look", label: hi ? "अक्षर और look" : "Letters & look", Icon: Palette },
      { key: "hero", label: hi ? "ऊपर का हिस्सा" : "Top of page", Icon: ImageIcon },
      { key: "home", label: hi ? "हिस्से" : "Sections", Icon: ListOrdered },
      { key: "pages", label: hi ? "Pages" : "Pages", Icon: Files },
    ] },
    { key: "content", label: hi ? "सामग्री" : "Content", Icon: Camera, tabs: [
      { key: "photos", label: hi ? "Photos और banner" : "Photos & banners", Icon: Camera },
      { key: "products", label: hi ? "Products और दाम" : "Products & prices", Icon: Package },
      { key: "about", label: hi ? "परिचय और logo" : "About & logo", Icon: BookUser },
      { key: "details", label: hi ? "आप क्या देते हैं" : "What you offer", Icon: ListChecks },
      { key: "reviews", label: hi ? "Reviews" : "Reviews", Icon: Star },
    ] },
    { key: "contact", label: hi ? "संपर्क" : "Contact", Icon: Phone, tabs: [
      { key: "you", label: hi ? "नाम, number, photo" : "Name, number, photo", Icon: User },
      { key: "where", label: hi ? "समय और पता" : "Timings & address", Icon: Clock },
      { key: "links", label: hi ? "UPI और social" : "UPI & social", Icon: Wallet },
    ] },
    { key: "settings", label: hi ? "Settings" : "Settings", Icon: Settings, tabs: [
      { key: "offer", label: hi ? "Offer / pop-up" : "Offer / pop-up", Icon: Megaphone },
      { key: "domain", label: hi ? "अपना web address" : "Own web address", Icon: Globe },
      { key: "seo", label: hi ? "Google SEO" : "Google SEO", Icon: Search },
      { key: "trade", label: hi ? "Business का नाम और काम" : "Business name & type", Icon: Store },
    ] },
  ];
  const TABS = GROUPS.find((g) => g.key === group)!.tabs;
  const pick = (t: Tab) => { setNote((n) => (n?.k === "save" ? n : null)); setEmbedView(null); setTab(t); };
  const embedSrc = EMBED[tab]?.(s.cardId);
  const domainOk = tier === "growth" || tier === "pro";
  const customDomain = (s as { customDomain?: string }).customDomain ?? "";

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        {/* Back = the screen the owner was just on (Card & Website → Edit); opened fresh, that Edit. (It used to open /poster/website, which redirects to the first screen.) */}
        <button type="button" onClick={() => goBack(router, "/poster/site?edit=site")} className="text-muted" aria-label={hi ? "पीछे" : "Back"}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold flex-1">{hi ? "वेबसाइट एडिट करें" : "Edit website"}</h1>
        {/* Not saved yet: this opens the working copy (the same one the preview above shows), full size — the live link would still show
            the old look (owner, 23 Oct 2026: "colour change karke dekha to purana hi dikha"). */}
        {dirty
          ? <SiteLink href={`/preview/site?k=${PREVIEW_KEY}`} title={hi ? "Website" : "Website"} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{hi ? "बदलाव देखें" : "See changes"} <ExternalLink className="h-3.5 w-3.5" /></SiteLink>
          : <SiteLink href={`${s.url}?view=site`} title={hi ? "Website" : "Website"} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{hi ? "लाइव देखें" : "See it live"} <ExternalLink className="h-3.5 w-3.5" /></SiteLink>}
      </div>
      {s.cards.length > 1 && (
        <div className="space-y-1.5">
          <select value={s.cardId} onChange={(e) => { setNote(null); void load(e.target.value); }} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
            {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
          </select>
          {err && <p className="text-xs font-semibold text-danger">{err.startsWith("No internet") ? (hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again.") : err}</p>}
        </div>
      )}

      {/* ---- live preview (the real website renderer, scaled to fit), with the colours right under it (owner, 23 Oct 2026: "colour
          wali patti website ke just neeche — wahi colour badle aur site dikh jaaye") ---- */}
      <div className="sticky z-10 -mx-4 bg-surface px-4 pb-2 pt-1" style={{ top: "calc(max(0.6rem, env(safe-area-inset-top)) + 2.9rem + var(--help-banner, 0px))" }}>
        <div className="relative overflow-hidden rounded-2xl border border-border shadow-card">
          <div ref={box} className="bg-white overflow-hidden transition-[height] duration-300" style={{ height: big ? "68svh" : "32svh" }}>
            <div className="relative" style={{ width: Math.round(1280 * scale), height: boxH }}>
              <iframe ref={frame} title="Website preview" src={`/preview/site?k=${PREVIEW_KEY}${previewPage ? `&page=${encodeURIComponent(previewPage)}` : ""}`} className="absolute left-0 top-0 origin-top-left" style={{ width: 1280, height: frameH, border: 0, transform: `scale(${scale})` }} />
            </div>
          </div>
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">● {hi ? "Live" : "Live"}</span>
          <button type="button" onClick={() => setBig((b) => !b)} aria-label={big ? (hi ? "छोटा करें" : "Make small") : (hi ? "बड़ा करें" : "Make big")}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
            {big ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />} {big ? (hi ? "छोटा" : "Small") : (hi ? "बड़ा" : "Big")}
          </button>
        </div>
      </div>
      {group === "design" && <div className="overflow-hidden rounded-2xl border border-border">
        <div className="border-t border-border bg-surface px-2 pb-1.5 pt-2">
          <p className="flex items-center gap-1 px-1 text-[11px] font-semibold text-muted"><Palette className="h-3.5 w-3.5 text-brand" /> {hi ? "रंग चुनें" : "Pick a colour"}</p>
          <div className="mt-1.5 flex gap-2.5 overflow-x-auto pb-1">
            <Swatch p={brand} on={paletteKey === "brand"} onClick={() => pickColour("brand")} label={hi ? "आपका" : "Yours"} />
            {SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => <Swatch key={p.key} p={p} on={paletteKey === p.key} onClick={() => pickColour(p.key)} label={hi ? p.hi : p.name} />)}
          </div>
          {paletteKey === "brand" && (
            <label className="mt-0.5 inline-flex items-center gap-2 px-1 text-[11px] text-muted">
              <input type="color" value={style.color || card.themeColor || "#0e9e90"} onChange={(e) => pickColour("brand", e.target.value)} className="h-6 w-9 rounded border border-border bg-surface p-0.5" />
              {hi ? "अपना रंग" : "Your own colour"}
              {style.color && <button type="button" onClick={() => setStyle({ color: undefined })} className="underline">{hi ? "कार्ड जैसा" : "Same as the card"}</button>}
            </label>
          )}
        </div>
      </div>}

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface2 p-1">
        {GROUPS.map((g) => (
          <button key={g.key} type="button" onClick={() => { setGroup(g.key); pick(g.tabs[0].key); }}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition ${group === g.key ? "bg-surface text-brand-ink shadow-card" : "text-muted"}`}>
            <g.Icon className="h-4 w-4" /> {g.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => pick(key)} className={`${chip(tab === key)} inline-flex shrink-0 items-center gap-1.5`}><Icon className="h-4 w-4" /> {label}</button>)}
      </div>
      {savedTab && savedTab === tab && <p role="status" className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good"><Check className="h-4 w-4" /> {hi ? "Save हो गया — website पर live है" : "Saved — it is live on your website"}</p>}

      {/* A screen of its own (Products, Timings & address …), shown right here: it saves by itself, the window above shows its change. */}
      {embedSrc && (
        <iframe key={`${tab}-${embedKey}`} ref={embedFrame} title={TABS.find((t) => t.key === tab)?.label ?? ""} src={embedSrc}
          className="-mx-4 block w-[calc(100%+2rem)] border-0" style={{ height: embedH }} />
      )}
      {tab === "photos" && (
        <section className="rounded-xl border border-border p-3">
          <SitePhotos hi={hi} cardId={s.cardId} scope="site" onChanged={() => void refresh()} />
        </section>
      )}
      {tab === "offer" && (
        <section className="rounded-xl border border-border p-3">
          <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard((cur) => (cur ? keepTouched(c, cur, touched.current) : c))} />
        </section>
      )}
      {tab === "domain" && (
        <section className="rounded-xl border border-border p-3">
          {domainOk || customDomain
            ? <DomainConnect cardId={s.cardId} username={s.username} initialDomain={customDomain || undefined} />
            : <p className="text-sm text-muted">{hi ? "अपना web address (www.yourshop.com) Growth plan के साथ आता है।" : "Your own web address (www.yourshop.com) comes with the Growth plan."}</p>}
        </section>
      )}

      {tab === "look" && (
        <section className="space-y-5 rounded-xl border border-border p-3">
          {/* A Premium website's own design lives on the Premium page (owner, 25 Oct 2026: "premium hai to premium design par jaana chahiye"). */}
          <p className="text-[11px] text-muted">{hi ? "Design बदलना हो तो " : "To change the design, go to "}<Link href={adv ? "/poster/site/advanced" : "/poster/card/build?improve=1"} className="font-semibold text-brand-ink">{adv ? (hi ? "Premium design" : "Premium design") : (hi ? "Website का design" : "Website design")}</Link>.</p>
          {/* Premium: the letters, the top and the corners are the Premium design's own (spec.fonts / spec.hero / spec.shape) — the basic
              site's choices below never reached it, so a tap changed nothing (owner, 25 Oct 2026). */}
          {adv ? (<>
            {/* The page's background: light paper or dark (owner, 25 Oct 2026: "pura background black dikh raha — badal sakte hain?"). */}
            <div>
              <p className="text-sm font-semibold">{hi ? "Background (पीछे का रंग)" : "Background"}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((t) => {
                  const pal = (adv.palette ?? {}) as { key?: string; tone?: string; luxe?: boolean };
                  const on = (pal.tone === "dark" ? "dark" : "light") === t;
                  const off = t === "dark" && (pal.key === "ivory" || pal.key === "pearl");
                  return (
                    <button key={t} type="button" disabled={off} onClick={() => { const { luxe: _l, ...rest } = pal; void _l; setAdv({ palette: t === "dark" ? { ...rest, tone: "dark" } : { ...pal, tone: "light" } }); }}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-sm font-semibold disabled:opacity-40 ${on ? "border-brand ring-2 ring-brand/30" : "border-border"}`}>
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${t === "dark" ? "bg-[#15171c] text-white" : "bg-[#f7f5f0] text-[#333] ring-1 ring-border"}`}>{t === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</span>
                      {t === "dark" ? (hi ? "गहरा (Dark)" : "Dark") : (hi ? "हल्का (Light)" : "Light")}
                      {on && <Check className="ml-auto h-4 w-4 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-4 w-4 text-brand" /> {hi ? "अक्षर (font)" : "Letter style (font)"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HEADING_FONTS.map((f) => <button key={f} type="button" onClick={() => setAdv({ fonts: { ...((adv.fonts as { heading?: string; body?: string }) ?? {}), heading: f } })} className={chip((adv.fonts as { heading?: string } | undefined)?.heading === f)} style={{ fontFamily: `"${f}", Inter, sans-serif` }}>{f}</button>)}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5"><LayoutTemplate className="h-4 w-4 text-brand" /> {hi ? "ऊपर का हिस्सा कैसा सजे" : "How the top of the page is arranged"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HERO_IDS.map((h) => <button key={h} type="button" onClick={() => setAdv({ hero: h })} className={chip(adv.hero === h)}>{(ADV_HERO_NAMES[h] ?? [h, h])[hi ? 1 : 0]}</button>)}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">{hi ? "कोने (गोल या सीधे)" : "Corners (round or straight)"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SHAPES.map((sh) => <button key={sh} type="button" onClick={() => setAdv({ shape: sh })} className={chip(adv.shape === sh)}>{sh === "sharp" ? (hi ? "शार्प" : "Sharp") : sh === "soft" ? (hi ? "सॉफ्ट" : "Soft") : (hi ? "राउंड" : "Round")}</button>)}
              </div>
            </div>
          </>) : (<>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-4 w-4 text-brand" /> {hi ? "अक्षर (font)" : "Letter style (font)"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FONT_PAIRS.map((f) => <button key={f.key} type="button" onClick={() => setStyle({ font: f.key === "look" ? undefined : f.key })} className={chip((style.font ?? "look") === f.key)} title={f.blurb}>{hi ? f.hi : f.name}</button>)}
            </div>
            <p className="text-[11px] text-muted mt-1">{FONT_PAIRS.find((f) => f.key === (style.font ?? "look"))?.blurb}</p>
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><LayoutTemplate className="h-4 w-4 text-brand" /> {hi ? "ऊपर का हिस्सा कैसा सजे" : "How the top of the page is arranged"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyle({ hero: undefined })} className={chip(!style.hero)}>{hi ? "अपने-आप" : "Automatic"}</button>
              {HERO_LAYOUTS.map((h) => <button key={h.key} type="button" onClick={() => setStyle({ hero: h.key })} className={chip(style.hero === h.key)} title={h.blurb}>{hi ? h.hi : h.name}</button>)}
            </div>
            <p className="text-[11px] text-muted mt-1">{style.hero ? HERO_LAYOUTS.find((h) => h.key === style.hero)?.blurb : (hi ? "अपने-आप: product की photo हो तो शब्द + picture, banner हो तो बड़ी photo।" : "Automatic: words + picture when you have a product photo, a big photo when you have a banner.")}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "कोने (गोल या सीधे)" : "Corners (round or straight)"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyle({ radius: undefined })} className={chip(!style.radius)}>{hi ? "कार्ड जैसा" : "Same as the card"}</button>
              {RADII.map((r) => <button key={r.key} type="button" onClick={() => setStyle({ radius: r.key })} className={chip(style.radius === r.key)}>{hi ? r.hi : r.name}</button>)}
            </div>
          </div>
          </>)}
          <div className="rounded-lg bg-surface2 p-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="h-4 w-4 text-brand" /> {hi ? "किसी वेबसाइट जैसा लुक" : "Copy the look of a website you like"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "सिर्फ़ उसके रंग, अक्षर और सजावट कॉपी होंगे — शब्द, photo या product नहीं। फ़्री।" : "Only its colours, letters and arrangement are copied. Never its words, photos or products. Free."}</p>
            <div className="mt-2 flex gap-2">
              <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="e.g. somebrand.com" className={`${field} mt-0 flex-1`} />
              <button type="button" onClick={copyLook} disabled={busy === "ref" || !refUrl.trim()} className="rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "ref" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : (hi ? "Copy" : "Copy look")}</button>
            </div>
            {line("ref", "mt-2")}
            {site.reference?.url && <p className="text-[11px] text-muted mt-1.5">{hi ? "अभी का लुक इस वेबसाइट से:" : "Your look is copied from:"} {site.reference.url.replace(/^https?:\/\//, "")}</p>}
          </div>
        </section>
      )}

      {tab === "hero" && (
        <section className="space-y-4 rounded-xl border border-border p-3">
          <SlidesEditor hi={hi} card={card} images={s.images} slides={site.hero?.slides ?? []} onChange={(slides) => setHero({ slides })} cardId={s.cardId} />
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "सबसे ऊपर की बड़ी लाइन" : "Big line at the top"}</span><input value={site.hero?.headline ?? ""} onChange={(e) => setHero({ headline: e.target.value })} placeholder={s.defaults.headline} maxLength={90} className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "बड़ी लाइन के नीचे 1–2 लाइन" : "One or two lines under the big line"}</span><textarea value={site.hero?.sub ?? ""} onChange={(e) => setHero({ sub: e.target.value })} placeholder={s.defaults.sub} rows={2} maxLength={240} className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "WhatsApp बटन का टेक्स्ट" : "Words on the WhatsApp button"}</span><input value={site.hero?.ctaLabel ?? ""} onChange={(e) => setHero({ ctaLabel: e.target.value })} placeholder="WhatsApp" maxLength={30} className={field} /></label>
          <div>
            <p className="text-xs font-semibold text-muted mb-1.5">{hi ? "ऊपर की इमेज (प्रोडक्ट या लोगो)" : "Picture at the top (a product or your logo)"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setHero({ imageUrl: "" })} className={`h-16 w-16 rounded-xl border-2 grid place-items-center text-[11px] ${site.hero?.imageUrl === "" ? "border-brand bg-brand-soft" : "border-border"}`}>{hi ? "कोई नहीं" : "None"}</button>
              {s.images.map((im) => <button key={im.url} type="button" title={im.label} onClick={() => setHero({ imageUrl: im.url })} className={`h-16 w-16 rounded-xl border-2 overflow-hidden bg-white ${site.hero?.imageUrl === im.url ? "border-brand" : "border-border"}`}><Thumb src={im.url} alt={im.label} /></button>)}
              {site.hero?.imageUrl && !s.images.some((im) => im.url === site.hero?.imageUrl) && <span className="h-16 w-16 rounded-xl border-2 border-brand overflow-hidden bg-white"><Thumb src={site.hero.imageUrl} alt="" /></span>}
              <label className="h-16 w-16 rounded-xl border-2 border-dashed border-border grid place-items-center text-[11px] cursor-pointer">{busy === "hero" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : (hi ? "+ जोड़ें" : "+ Add")}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? null, "hero")} /></label>
            </div>
            {line("hero", "mt-2")}
            <button type="button" onClick={aiHeroPhoto} disabled={busy === "aiphoto"} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-60">
              {busy === "aiphoto" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Make a new AI photo<CreditPrice credits={SITE_PHOTO_CREDITS} />
            </button>
            {line("ai", "mt-2")}
            <p className="text-[11px] text-muted mt-1">{hi ? "कुछ न चुनें तो पहले product की photo लग जाती है। अपनी खुद की फ़ोटो यहाँ न लगाएँ।" : "If you choose nothing, your first product photo is used. Do not put a photo of your own face here."}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted mb-1.5">{hi ? "वेबसाइट लोगो (ऊपर और नीचे दिखेगा)" : "Website logo (shown at the top and bottom)"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { focus({ top: true }); set({ logoUrl: "" }); }} className={`h-16 w-16 rounded-xl border-2 grid place-items-center text-[11px] ${!site.logoUrl ? "border-brand bg-brand-soft" : "border-border"}`}>{hi ? "कार्ड फ़ोटो" : "card photo"}</button>
              {s.images.filter((im) => im.label === "Logo").map((im) => <button key={im.url} type="button" onClick={() => { focus({ top: true }); set({ logoUrl: im.url }); }} className={`h-16 w-16 rounded-xl border-2 overflow-hidden bg-white ${site.logoUrl === im.url ? "border-brand" : "border-border"}`}><Thumb src={im.url} alt="Logo" /></button>)}
              {site.logoUrl && !s.images.some((im) => im.url === site.logoUrl) && <span className="h-16 w-16 rounded-xl border-2 border-brand overflow-hidden bg-white"><Thumb src={site.logoUrl} alt="" /></span>}
              <label className="h-16 w-16 rounded-xl border-2 border-dashed border-border grid place-items-center text-[11px] cursor-pointer">{busy === "logo" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : (hi ? "+ जोड़ें" : "+ Add")}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? null, "logo")} /></label>
            </div>
            {line("logo", "mt-2")}
          </div>
          <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5"><span className="text-sm font-medium">{hi ? "बड़ी लाइन के नीचे मेरी फ़ोटो + नाम" : "My photo + name under the big line"}</span><input type="checkbox" className="h-5 w-5" checked={!site.hideProfile} onChange={(e) => set({ hideProfile: !e.target.checked })} /></label>
          {/* News / offers live in ONE place now — Card & Website → News (the notice bar / pop-up, src/lib/notice.ts); the old
              announcement bar here is gone (audit, 7 Oct 2026: two announcement systems). */}
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-semibold">📣 {hi ? "न्यूज़ / ऑफ़र की पट्टी" : "Offer bar"}</p>
            <p className="mt-1 text-[11px] text-muted">{hi ? "ऑफ़र, छुट्टी या ख़बर की पट्टी और पॉप-अप अब एक जगह से लगती है:" : "Offer, holiday and news bars and pop-ups are now set in one place:"} <Link href="/poster/site?edit=site" className="font-semibold text-brand-ink">{hi ? "Card & Website → News" : "Card & Website → News"}</Link></p>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "गोल बटन (वेबसाइट पर)" : "Round button on the website"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {([["whatsapp", "WhatsApp"], ["call", hi ? "Call" : "Call"], ["none", hi ? "कोई नहीं" : "None"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => set({ float: k })} className={chip((site.float ?? "whatsapp") === k)}>{l}</button>)}
            </div>
            <p className="text-[11px] text-muted">{hi ? "कंप्यूटर पर यह गोल बटन नीचे-बाएँ रहता है। फ़ोन पर नीचे Call · WhatsApp · Directions की पट्टी हमेशा रहती है।" : "On a computer the round button sits at the bottom left. On a phone, a Call · WhatsApp · Directions bar is always at the bottom."}</p>
          </div>
        </section>
      )}

      {tab === "home" && (
        <section className="space-y-4 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-semibold">{hi ? "पहले पेज के हिस्से" : "Sections of the first page"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "ऊपर-नीचे करें या छुपाएँ। शब्द बदलने के लिए पूरा editor खोलें।" : "Move up or down, or hide. To change the words, open the full editor."}</p>
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
            {(site.home?.order?.length || site.home?.hidden?.length) ? <button type="button" onClick={() => setHome({ order: undefined, hidden: undefined })} className="mt-2 text-xs font-semibold text-brand-ink">{hi ? "पहले वाले क्रम पर वापस" : "Back to the original order"}</button> : null}
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "भरोसे के नंबर (बड़ी लाइन के नीचे)" : "Numbers that make people trust you (under the big line)"}</p>
            <p className="text-[11px] text-muted mt-0.5">{hi ? "कार्ड की जानकारी से अपने-आप बनते हैं। 3 से कम हों तो पट्टी नहीं दिखती। आप अपने भी लिख सकते हैं, पर सच ही लिखें।" : "Made from the details on your card. The strip shows only if there are 3 or more. You can write your own, but only true ones."}</p>
            <div className="mt-2 grid gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                  <input value={stats[i]?.value ?? ""} onChange={(e) => setStat(i, { value: e.target.value })} placeholder={["4.8★", "Since 2015", "12+", "7 days"][i]} maxLength={24} className={`${field} mt-0`} />
                  <input value={stats[i]?.label ?? ""} onChange={(e) => setStat(i, { label: e.target.value })} placeholder={["customer reviews", "years of trust", "products", "open every day"][i]} maxLength={40} className={`${field} mt-0`} />
                </div>
              ))}
            </div>
            {site.home?.stats && <button type="button" onClick={() => setHome({ stats: undefined })} className="mt-2 text-xs font-semibold text-brand-ink">{hi ? "अपने-आप वाले पर वापस" : "Back to automatic"}</button>}
          </div>
        </section>
      )}

      {tab === "pages" && (
        <section className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{hi ? "वेबसाइट पर कौन से pages दिखें" : "Pages shown on the website"}</p>
          {s.pages.map((p) => {
            const h = new Set(site.hidden ?? []);
            return (
              <label key={p.slug} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{p.label} <span className="text-[11px] text-muted">· {p.blocks} {hi ? "हिस्से" : "sections"}</span></span>
                <input type="checkbox" className="h-5 w-5" checked={!h.has(p.slug)} onChange={(e) => { if (e.target.checked) h.delete(p.slug); else h.add(p.slug); set({ hidden: [...h] }); }} />
              </label>
            );
          })}
          {(() => { const h = new Set(site.hidden ?? []); const on = !h.has("updates"); return (
            <label className="flex items-center justify-between rounded-lg border border-brand/40 bg-brand-soft/30 px-3 py-2">
              <span className="text-sm">{hi ? "Updates" : "Updates"} <span className="text-[11px] text-muted">· {hi ? "आपके रोज़ के पोस्टर का पेज (अपने-आप)" : "your daily posters as a page (automatic)"}</span></span>
              <input type="checkbox" className="h-5 w-5" checked={on} onChange={(e) => { if (e.target.checked) h.delete("updates"); else h.add("updates"); set({ hidden: [...h] }); }} />
            </label>
          ); })()}
          <Link href={`/poster/d/editor?id=${s.cardId}&back=${encodeURIComponent("/poster/website/edit")}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">{hi ? "टेक्स्ट / फ़ोटो / प्रोडक्ट बदलें (पूरा एडिटर)" : "Change text, photos, products (full editor)"} →</Link>
        </section>
      )}

      {/* ---- save bar: above the app's bottom navigation, not over it (same as the explainer editor). The other tabs save by themselves:
          the bar shows there only while this page's own changes wait. ---- */}
      {(group === "design" || dirty || note?.k === "save") && <div className="fixed bottom-[64px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {line("save", "mb-2")}
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs text-muted">{dirty ? (hi ? "Save दबाएँ — तभी website पर लगेगा" : "Tap Save to put it on your website") : (hi ? "सब सेव है" : "All saved")}</p>
          <button type="button" onClick={save} disabled={busy === "save" || !dirty} className="rounded-xl grad-brand px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy === "save" ? "…" : (hi ? "Save करें" : "Save")}</button>
        </div>
      </div>}
      {unlock && <UnlockDialog reason="Make good-looking AI photos for your website." onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );
}

/** The Premium website's sliding banners (owner, 23 Oct 2026): up to 3, each its own big line, small line and picture. "AI से लिखें"
 *  fills three different big lines from the card's facts (/api/site/slides); the owner changes anything, then Save. */
function SlidesEditor({ hi, card, images, slides, onChange, cardId }: { hi: boolean; card: Card; images: { label: string; url: string }[]; slides: HeroSlide[]; onChange: (s: HeroSlide[]) => void; cardId: string }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const photos = useMemo(() => {
    const gallery = card.pages.flatMap((p) => p.blocks).flatMap((b) => (b.kind === "gallery" ? b.images.map((g) => g.url) : []));
    const all = [card.site?.hero?.imageUrl, card.coverUrl, ...gallery, ...images.filter((im) => im.label !== "Logo").map((im) => im.url)];
    return [...new Set(all.filter((u): u is string => !!u && /^https:\/\//.test(u)))].slice(0, 14);
  }, [card, images]);
  const setOne = (i: number, patch: Partial<HeroSlide>) => onChange(slides.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  async function write() {
    setBusy(true); setErr("");
    const r = await api<{ slides?: { headline: string; sub: string }[]; error?: string }>("/api/site/slides", { method: "POST", json: { card_id: cardId } }).catch(() => null);
    setBusy(false);
    if (!r?.ok || !r.data.slides) { setErr(r?.data.error || T("Could not write them. Try again.", "नहीं लिख पाए। दोबारा try करें।")); return; }
    onChange(r.data.slides.map((x, i) => ({ headline: x.headline, sub: x.sub, ...(slides[i]?.imageUrl || photos[i] ? { imageUrl: slides[i]?.imageUrl || photos[i] } : {}) })));
  }
  return (
    <div className="space-y-2.5 rounded-xl border-2 border-ai/30 bg-ai-soft/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-sm font-bold">🎞️ {T("Sliding banners", "बदलते banner")} <span className="ml-1 rounded-full bg-ai-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-ai">Premium</span></p>
          <p className="text-[11px] text-muted">{T("2–3 banners at the top that change by themselves, each with its own heading.", "ऊपर 2–3 banner जो अपने-आप बदलते हैं, हर एक की अपनी heading।")}</p></div>
        <button type="button" onClick={() => void write()} disabled={busy} className="inline-flex shrink-0 items-center gap-1 rounded-lg grad-brand px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {T("Write with AI", "AI से लिखें")}</button>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      {slides.map((sl, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border bg-surface p-2">
          <div className="flex items-center gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ai text-[10px] font-bold text-white">{i + 1}</span>
            <input value={sl.headline} onChange={(e) => setOne(i, { headline: e.target.value.slice(0, 90) })} placeholder={T("Big line", "बड़ी लाइन")} className={`${field} mt-0`} />
            <button type="button" onClick={() => onChange(slides.filter((_, j) => j !== i))} className="shrink-0 text-xs text-muted underline">{T("Remove", "हटाएँ")}</button></div>
          <input value={sl.sub ?? ""} onChange={(e) => setOne(i, { sub: e.target.value.slice(0, 240) })} placeholder={T("Small line (optional)", "छोटी लाइन (optional)")} className={`${field} mt-0`} />
          {photos.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {photos.map((u) => <button key={u} type="button" onClick={() => setOne(i, { imageUrl: u })} className={`h-11 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-white ${sl.imageUrl === u ? "border-brand" : "border-transparent"}`}><Thumb src={u} alt="" /></button>)}
            </div>
          )}
        </div>
      ))}
      {slides.length < 3 && <button type="button" onClick={() => onChange([...slides, { headline: "", imageUrl: photos[slides.length] }])} className="w-full rounded-lg border-2 border-dashed border-border py-2 text-xs font-semibold text-muted">+ {T("Add a banner", "banner जोड़ें")}</button>}
      {slides.length === 1 && <p className="text-[11px] text-muted">{T("Add at least 2 to make them slide.", "बदलने के लिए कम से कम 2 banner चाहिए।")}</p>}
    </div>
  );
}

/** `fresh` (a card just saved elsewhere, or a tab's unsaved copy) with the parts of the website this page changed and has not saved
 *  taken from `mine`. The top's words stay mine; its pictures and banners' pictures come from `fresh` (the Photos tab sets those). */
function keepTouched(fresh: Card, mine: Card, touched: Set<string>): Card {
  if (!touched.size) return fresh;
  const a = (fresh.site ?? { enabled: true }) as Record<string, unknown>;
  const b = (mine.site ?? { enabled: true }) as Record<string, unknown>;
  const site: Record<string, unknown> = { ...a };
  for (const k of touched) {
    if (k === "hero") {
      const fh = (a.hero ?? {}) as Hero, mh = (b.hero ?? {}) as Hero;
      const fs = fh.slides ?? [], ms = mh.slides ?? [];
      const n = Math.max(fs.length, ms.length);
      const slides = n ? Array.from({ length: n }, (_, i) => ({ ...(fs[i] ?? {}), ...(ms[i] ?? {}), ...(fs[i]?.imageUrl ? { imageUrl: fs[i].imageUrl } : {}) }) as HeroSlide).filter((x) => x.headline !== undefined) : undefined;
      site.hero = { ...fh, headline: mh.headline, sub: mh.sub, ctaLabel: mh.ctaLabel, ...(slides ? { slides } : {}) };
    } else site[k] = b[k];
  }
  return { ...fresh, site: site as Card["site"] };
}
