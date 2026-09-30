"use client";
import { initials } from "@/lib/initials";
import { SITE_URL } from "@/lib/site-url";
import { INTRODUCER_KEY } from "@/lib/username";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  Download, MessageCircle, Check, Play, FileText, Share2, Send, BadgeCheck,
  Sun, Moon, Star, ChevronDown, ChevronLeft, ChevronRight, Clock, CalendarClock, MapPin, BadgePercent, Copy, X, ShoppingBag,
  Languages, LoaderCircle, UserPlus, Settings, ArrowRight, Home, Images, HelpCircle, Phone, Wrench, Info, Compass, LayoutTemplate, Sparkles as SparklesIcon, Pencil,
  TrendingUp, Briefcase, IndianRupee } from "lucide-react";
import { lookOf, lookCss, lookFontHref } from "@/lib/looks";
import type { Card, CardBlock, CardImage, CardPage, CardTemplate } from "@/lib/types";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { CardChat } from "@/components/card-chat";
import { JoinNudge } from "@/components/join-nudge";
import { trackView, trackClick } from "@/lib/track";
import { localLine, pageHref } from "@/lib/seo";

const quickTypes = ["phone", "whatsapp", "email", "website", "location", "upi"] as const;

/** Curated template artwork (framed for its slot, safe to cover-fill). Anything
 *  else is the owner's own photo and is never auto-cropped. */
export const isCuratedArt = (url?: string | null) => !!url && (url.startsWith("/art/") || url.startsWith("/wellwa/") || url.startsWith("/api/stock/banners/"));
/** One of the generated trade banners (public/art/banners via /api/stock/banners): light left half, scene on the right. */
export const isTradeBanner = (url?: string | null) => !!url && url.startsWith("/api/stock/banners/");

/** "📅 Since 2015" → { glyph: "📅", text: "Since 2015" }; text without a leading emoji → { text }.
 *  One regex for the phone card and the website, so both split the same way. */
// The WHOLE emoji is taken, including a skin tone and a joined sequence such as \uD83E\uDDD1\u200D\uD83D\uDD27 ("person" + wrench):
// leaving half of one behind would print a stray wrench at the start of the label.
const GLYPH_RE = /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)?)*)\s*(.*)$/u;
export function splitGlyph(s: string): { glyph?: string; text: string } {
  const m = GLYPH_RE.exec(s);
  return { glyph: m?.[1], text: m?.[2] ?? s };
}

/** Translate an item whole (the visitor-language map is keyed on the full
 *  string, emoji included), then split off the emoji of the original. */
export function glyphText(s: string, t: (s: string) => string): { glyph?: string; text: string } {
  const { glyph } = splitGlyph(s.trim());
  const tr = t(s.trim());
  return { glyph, text: glyph ? splitGlyph(tr.trim()).text : tr };
}

/** A map link we are willing to put in an href: http(s) only. */
export const safeMapUrl = (u?: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : "");

/* ---- visitor language switch ----
 * The card's text is whatever its owner typed. When a visitor picks another
 * language we fetch an AI translation map (original → translated) once and
 * every string on the card runs through `t()`. */
const CARD_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "bn", label: "বাংলা" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

export const TranslateCtx = createContext<(s: string) => string>((s) => s);
/** Translate a card string into the visitor's chosen language. */
export function useT() {
  return useContext(TranslateCtx);
}

/** Visitor language state + translation map for one card — shared by the
 *  phone card and the website view so both speak the same language. */
export function useCardLang(username: string) {
  const [lang, setLang] = useState("en");
  const [dict, setDict] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem("ne-card-lang"); if (saved && saved !== "en") setLang(saved); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("ne-card-lang", lang); } catch { /* ignore */ }
    if (lang === "en") { setDict({}); return; }
    let cancelled = false;
    setTranslating(true);
    fetch(`/api/translate/${username}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDict(d.strings ?? {}); })
      .catch(() => { if (!cancelled) setDict({}); })
      .finally(() => { if (!cancelled) setTranslating(false); });
    return () => { cancelled = true; };
  }, [lang, username]);
  const t = (s: string) => (s ? dict[s.trim()] ?? s : s);
  return { lang, setLang, translating, t };
}

export function LanguagePicker({
  lang, setLang, busy, theme,
}: {
  lang: string; setLang: (l: string) => void; busy: boolean; theme: string;
}) {
  const [open, setOpen] = useState(false);
  const current = CARD_LANGS.find((l) => l.code === lang) ?? CARD_LANGS[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface2 transition-colors"
        aria-label="Change language"
      >
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" style={{ color: theme }} />}
        {current.label}
        <ChevronDown className="h-3 w-3 text-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-40 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface shadow-float p-1">
            {CARD_LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-left hover:bg-surface2 ${l.code === lang ? "font-semibold" : ""}`}
              >
                {l.label}
                {l.code === lang && <Check className="h-3.5 w-3.5" style={{ color: theme }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- video embed resolver ----
 * `vertical`: a 9:16 video (YouTube Shorts, Facebook reels) — shown in a tall player instead of a 16:9 box.
 * Facebook (owner's call, 26 Sep 2026: the tutorial lives on the Shubhora page): a public video / reel link plays
 * in Facebook's own player. A share link (facebook.com/share/v/…) cannot be resolved in the browser, so paste the
 * reel / video address itself where possible; the player is tried with the share link otherwise. */
export function embed(url: string): { type: "iframe" | "video" | "link"; src: string; vertical?: boolean } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/);
  if (yt) return { type: "iframe" as const, src: `https://www.youtube.com/embed/${yt[1]}`, vertical: /youtube\.com\/shorts\//.test(url) };
  if (/^https:\/\/(?:(?:www|m|web)\.)?(?:facebook\.com\/(?:reel\/\d+|watch\/?\?v=\d+|[^/?#]+\/videos\/|share\/[vr]\/)|fb\.watch\/)/i.test(url)) {
    const href = url.replace(/^https:\/\/(?:m|web)\./i, "https://www.");
    return { type: "iframe" as const, src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`, vertical: /\/reel\/|\/share\/r\//i.test(url) };
  }
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { type: "iframe" as const, src: `https://player.vimeo.com/video/${vim[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { type: "video" as const, src: url };
  return { type: "link" as const, src: url };
}

/* ---- per-template header presentation ----
 * `avatarMt`: how far the avatar overlaps up into the cover. A short cover
 * (minimal without a banner) uses NO negative margin so the avatar never
 * clips over the card's top edge. `overlay`: darken an uploaded banner so the
 * day/night toggle stays readable. */
function headerCfg(template: CardTemplate, theme: string, hasCover: boolean): {
  coverH: string; bg: string; centered: boolean; avatarMt: string; mobileAuto?: boolean;
} {
  // The avatar overlaps up into the cover and paints ON TOP of it — the wrapper
  // carries `relative z-10`, without which the cover's absolutely-positioned
  // banner image would paint over the (static) avatar and bury it.
  const overlap = "-mt-12";
  const look = lookOf(template);
  switch (template) {
    case "royal":
      return { coverH: hasCover ? "h-40" : "h-36", bg: look.cover(theme), centered: true, avatarMt: overlap };
    case "glass":
      return { coverH: hasCover ? "h-44" : "h-40", bg: look.cover(theme), centered: true, avatarMt: overlap };
    case "corporate":
      return { coverH: hasCover ? "h-36" : "h-24", bg: look.cover(theme), centered: false, avatarMt: overlap };
    case "earthy":
      return { coverH: hasCover ? "h-40" : "h-32", bg: look.cover(theme), centered: false, avatarMt: overlap };
    case "neon":
      return { coverH: hasCover ? "h-40" : "h-36", bg: look.cover(theme), centered: false, avatarMt: overlap };
    case "editorial":
      return hasCover
        ? { coverH: "h-auto sm:h-56", mobileAuto: true, bg: look.cover(theme), centered: false, avatarMt: overlap }
        : { coverH: "h-2", bg: "var(--theme)", centered: false, avatarMt: "mt-5" };
    case "gradient":
      return { coverH: "h-32", bg: `linear-gradient(135deg, ${theme}, ${theme}cc 55%, #0b1214)`, centered: false, avatarMt: overlap };
    case "minimal":
      return hasCover
        ? { coverH: "h-28", bg: "var(--surface-2)", centered: true, avatarMt: overlap }
        : { coverH: "h-3", bg: "var(--surface-2)", centered: true, avatarMt: "mt-3" };
    case "dark":
      return { coverH: "h-32", bg: "linear-gradient(135deg, #0d1a1c, #12242a)", centered: false, avatarMt: overlap };
    case "photo":
      // Mobile is full-bleed: the banner renders at its natural aspect ratio
      // (full image, no crop — the tallest it can honestly be). sm+ keeps the
      // original fixed height inside the framed card.
      return { coverH: hasCover ? "h-auto sm:h-52" : "h-44", mobileAuto: hasCover, bg: `linear-gradient(135deg, ${theme}, ${theme}aa)`, centered: true, avatarMt: overlap };
    case "bold":
      return { coverH: "h-36", bg: `linear-gradient(160deg, ${theme}, #0b1214)`, centered: false, avatarMt: overlap };
    default:
      return { coverH: "h-28", bg: `linear-gradient(120deg, ${theme}, ${theme}aa)`, centered: false, avatarMt: overlap };
  }
}

/* ---- day/night toggle styled for the card cover ---- */
function CardDayNight() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const a = document.documentElement.dataset.theme;
    setDark(a ? a === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("wellwa-theme", next); } catch {}
    setDark(!dark);
  }
  return (
    <button onClick={toggle} aria-label="Day / night"
      className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/25 text-white backdrop-blur hover:bg-black/40 transition-colors">
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

/** White-label owner of the domain this card is being viewed on, if any. */
export type CardBrand = {
  name: string;
  logoUrl?: string | null;
  hideBranding?: boolean;
};

/**
 * Free plan: the whole card stays — every page and block. Only the AI chat
 * assistant (it costs us money per message) needs the subscription.
 */
/** Editor preview only: what a tapped "✏️ Edit" chip on the preview points at. */
export type EditTarget = { kind: "profile" } | { kind: "links" } | { kind: "block"; blockId: string };

/** The small "✏️ Edit" chip the editor preview puts on each part of the card (never on the public card). */
function EditChip({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`z-20 inline-flex items-center gap-1.5 rounded-full bg-[#12144a]/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-card ring-1 ring-white/30 hover:bg-[#12144a] ${className}`}>
      <Pencil className="h-3 w-3" /> {label}
    </button>
  );
}

export function CardView({ card, qr, brand, expired = false, shareUrl, initialPage, linkBase, joinHandle, nudge = false, onEdit, editLabel = "Edit" }: {
  card: Card; qr: string; brand?: CardBrand | null; expired?: boolean;
  /** Editor preview: shows an "✏️ Edit" chip on the header, the buttons and every section; tapping one opens it in the editor. */
  onEdit?: (target: EditTarget) => void;
  /** The chip's word ("Edit" / "बदलें"). */
  editLabel?: string;
  /** The owner's account username: the "Get your own Shubhora" button at the bottom carries it, so whoever
   *  signs up from this card joins the owner's team without typing anything. Unset on white-label and previews. */
  joinHandle?: string | null;
  /** Shubhora partner cards: the "Aapko ye V-Card kaisa laga?" strip that opens the same joining link (see join-nudge.tsx). */
  nudge?: boolean;
  /** Canonical public URL of this card — on a white-label host that is
   *  https://<user>.<brand-domain>, which the QR already encodes. */
  shareUrl?: string;
  /** The page this address opened (/c/<user>/<slug>); every page has its own URL for search engines. */
  initialPage?: string;
  /** Base for page links on this host: "/c/<user>" on Shubhora, "" on the owner's domain. Unset: no page URLs (editor preview). */
  linkBase?: string;
}) {
  const first = card.pages[0]?.slug ?? "home";
  const [active, setActiveState] = useState(initialPage && card.pages.some((p) => p.slug === initialPage) ? initialPage : first);
  const hrefFor = (slug: string) => (linkBase === undefined ? `#${slug}` : pageHref(linkBase, encodeURIComponent(slug), slug === first));
  // Switching pages updates the address too, so every page can be shared and bookmarked.
  const setActive = (slug: string) => {
    setActiveState(slug);
    if (linkBase !== undefined && typeof history !== "undefined") history.pushState({ slug }, "", hrefFor(slug) + window.location.search);
  };
  useEffect(() => {
    if (linkBase === undefined) return;
    const back = (e: PopStateEvent) => { const slug = (e.state as { slug?: string } | null)?.slug; setActiveState(slug && card.pages.some((p) => p.slug === slug) ? slug : initialPage ?? first); };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const page = card.pages.find((p) => p.slug === active) ?? card.pages[0];
  const theme = card.themeColor;
  // view + ?src= source. The owner's own preview ("__preview") is never counted as a visit.
  useEffect(() => { if (!(card.username ?? "").startsWith("__")) trackView(card.username); }, [card.username]);
  // Whose card was this? Remembered on this browser (first card wins), so a person who later opens the sign-up on
  // their own — not through the button — is still introduced by the owner of the card they saw.
  useEffect(() => {
    if (!joinHandle || brand) return;
    try { if (!localStorage.getItem(INTRODUCER_KEY)) localStorage.setItem(INTRODUCER_KEY, joinHandle); } catch { /* private mode */ }
  }, [joinHandle, brand]);

  // #slug deep-links a block's "Know More" button (or a shared URL) straight to
  // that page — e.g. a Home CTA linking to "#gallery" for real photos/proof.
  useEffect(() => {
    const applyHash = () => {
      const slug = window.location.hash.slice(1);
      if (slug && card.pages.some((p) => p.slug === slug)) setActiveState(slug);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A "Know More"/#hash CTA sits at the bottom of a long page, so after the
  // switch the viewport is left deep inside the NEW page ("business plan opens
  // at its bottom"). Bring the new page's first block up to just under the
  // sticky tab bar. The first render is left alone so a shared deep link still
  // opens on the header.
  const blocksRef = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(true);
  useEffect(() => {
    if (skipScroll.current) { skipScroll.current = false; return; }
    const el = blocksRef.current;
    if (!el) return;
    const navH = (el.previousElementSibling as HTMLElement | null)?.offsetHeight ?? 48;
    const top = el.getBoundingClientRect().top;
    if (top < navH) window.scrollBy({ top: top - navH, behavior: "smooth" });
  }, [active]);

  // ---- visitor-chosen language (shared hook with the website view) ----
  const { lang, setLang, translating, t } = useCardLang(card.username);
  const cfg = headerCfg(card.template, theme, !!card.coverUrl);
  const primary = card.links.find((l) => l.type === "whatsapp") ?? card.links[0];
  const quicks = quickTypes
    .map((t) => card.links.find((l) => l.type === t && l.value?.trim()))
    .filter(Boolean) as Card["links"];
  // Shops lead with the business name; the owner moves to a line of their own.
  const bizLead = card.lead === "business" && !!card.company?.trim();
  const ownerLine = bizLead && card.name?.trim() && card.name.trim().toLowerCase() !== card.company.trim().toLowerCase()
    ? `${card.language === "hi" ? "मालिक" : "Owner"}: ${card.name.trim()}`
    : "";
  // The owner's logo as a white chip on the cover, when the avatar is not already that logo.
  // A minimal card without a banner has a 12px cover strip, too short to hold it.
  const logoChip = card.site?.logoUrl && card.avatarUrl !== card.site.logoUrl && !(card.template === "minimal" && !card.coverUrl)
    ? card.site.logoUrl : "";
  const ownCover = !!card.coverUrl && !isCuratedArt(card.coverUrl);
  const look = lookOf(card.template);
  const fontHref = lookFontHref(look);

  return (
    <TranslateCtx.Provider value={t}>
    {/* The visitor popup never shows in the editor's preview (onEdit) — it covered the owner's own card while editing. */}
    {!onEdit && <WelcomePopup card={card} theme={theme} active={active} />}
    {/* The look: fonts + palette + corners for everything inside this card (see src/lib/looks.ts). */}
    {fontHref && <link rel="stylesheet" href={fontHref} />}
    <style dangerouslySetInnerHTML={{ __html: lookCss(look, theme) }} />
    <div className="mx-auto w-full max-w-md animate-rise" data-look={look.key} data-tone={look.tone}>
      <div className="rounded-none border-0 sm:rounded-[1.75rem] sm:border border-border bg-surface overflow-hidden shadow-float">
        {/* ---- Header ---- */}
        <div className={`relative ${cfg.coverH} overflow-hidden`} style={{ background: cfg.bg }}>
          {card.coverUrl && (
            <>
              {/* The owner's banner is shown whole (object-contain). A blurred,
                  enlarged copy of it fills the space around it, so there are no
                  flat colour bars and nothing gets cropped. */}
              {ownCover && !cfg.mobileAuto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.coverUrl} alt="" aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60" />
              )}
              {/* object-contain: the banner you set is shown in full. With
                  object-cover the card would re-crop an image the user had
                  already framed in the crop tool.
                  Curated template artwork under /art or /wellwa is already
                  framed for a banner, so it covers and fills the header at any
                  viewport width. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.coverUrl}
                alt=""
                className={`${
                  cfg.mobileAuto
                    // Mobile: in-flow at natural aspect ratio — the whole banner,
                    // uncropped, as tall as it honestly is. sm+: absolute fill.
                    ? "w-full h-auto sm:absolute sm:inset-0 sm:h-full sm:w-full"
                    : "absolute inset-0 h-full w-full"
                } ${
                  isCuratedArt(card.coverUrl)
                    // Trade banners are drawn with the scene on the right and a light, empty left half (room for
                    // text). Anchor right so the scene always stays in view; the left is tinted below.
                    ? (isTradeBanner(card.coverUrl) ? "object-cover object-right" : "object-cover")
                    : "object-contain"
                }`}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.05) 45%, transparent)" }} />
              {/* The banner's empty left half reads as "half hidden" behind the avatar — a soft brand tint turns it
                  into a designed cover instead (only for the generated trade banners, never the owner's own image). */}
              {isTradeBanner(card.coverUrl) && (
                <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${theme}cc 0%, ${theme}66 32%, ${theme}00 58%)` }} />
              )}
            </>
          )}
          {logoChip && (
            <span className="absolute top-3 left-3 z-10 rounded-xl bg-white p-1.5 shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoChip} alt={card.company ? `${card.company} logo` : "Logo"} className="block h-10 w-auto max-w-[120px] object-contain" />
            </span>
          )}
          <CardDayNight />
        </div>

        <div className={`relative z-10 px-6 ${cfg.centered ? "text-center " + cfg.avatarMt : cfg.avatarMt}`}>
          {/* Language switch sits just BELOW the banner, in the empty space to
              the right of the avatar — never covers the cover art, and its menu
              opens inward. `top-14` clears the banner edge (avatar is -mt-12). */}
          <div className="absolute right-5 top-14 z-30">
            <LanguagePicker lang={lang} setLang={setLang} busy={translating} theme={theme} />
          </div>
          <div className={cfg.centered ? "flex justify-center" : ""}>
            <Avatar card={card} />
          </div>
          <div className={`mt-3 flex items-center gap-1.5 ${cfg.centered ? "justify-center" : ""}`}>
            <h1 className="text-2xl font-semibold tracking-tight">{bizLead ? t(card.company) : card.name}</h1>
            {card.verified && <BadgeCheck className="h-5 w-5 shrink-0" style={{ color: theme }} />}
          </div>
          <p className="text-muted">{t(card.jobTitle)}</p>
          {bizLead
            ? ownerLine && <p className="text-muted">{ownerLine}</p>
            : <p className="text-muted">{t(card.company)}</p>}
          <p className="mt-2 font-medium look-tagline" style={{ color: theme }}>{t(card.tagline)}</p>
          {onEdit && <div className={`mt-2 flex ${cfg.centered ? "justify-center" : ""}`}><EditChip label={`${editLabel} — photo, name`} onClick={() => onEdit({ kind: "profile" })} /></div>}

          {/* Quick actions — up to six (call, WhatsApp, email, website, map, UPI);
              they wrap instead of scrolling sideways on a very narrow phone. */}
          <div className={`mt-4 flex flex-wrap gap-2 ${cfg.centered ? "justify-center" : ""}`}>
            {quicks.map((l) => (
              <a key={l.id} href={linkHref(l.type, l.value)} target="_blank"
                onClick={() => trackClick(card.username, l.type)}
                className="look-quick h-11 w-11 rounded-xl grid place-items-center text-white transition-transform hover:scale-105 shadow-card"
                style={{ background: theme }} aria-label={l.label}>
                <LinkIcon type={l.type} className="h-5 w-5" />
              </a>
            ))}
          </div>

          {/* Primary buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <a href={`/c/${card.username}/vcf`}
              onClick={() => trackClick(card.username, "vcard")}
              className="look-btn inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={{ background: theme, boxShadow: `0 10px 24px -10px ${theme}` }}>
              <Download className="h-4 w-4" /> Save contact
            </a>
            {primary && (
              <a href={linkHref(primary.type, primary.value)} target="_blank"
                onClick={() => trackClick(card.username, `primary-${primary.type}`)}
                // Outline in the card's own colour (owner's call, 26 Sep 2026): the pale grey edge disappeared on white.
                className="look-btn look-btn-2 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold border-[1.5px] hover:bg-surface2 transition-colors"
                style={{ borderColor: theme }}>
                <MessageCircle className="h-4 w-4" /> {primary.label}
              </a>
            )}
          </div>
          {onEdit && <div className={`mt-2 flex ${cfg.centered ? "justify-center" : ""}`}><EditChip label={`${editLabel} — buttons`} onClick={() => onEdit({ kind: "links" })} /></div>}
        </div>

        {/* ---- Page navigation ---- */}
        <PageTabs pages={card.pages} active={active} onSelect={setActive} theme={theme} hrefFor={hrefFor} />

        {/* ---- Blocks ---- */}
        <div ref={blocksRef} className="px-6 py-6 space-y-6 min-h-40">
          {(page?.blocks ?? [])
            .map((b) => onEdit
              ? <div key={b.id} className="relative"><EditChip label={editLabel} onClick={() => onEdit({ kind: "block", blockId: b.id })} className="absolute -top-3 right-0" /><Block block={b} card={card} theme={theme} /></div>
              : <Block key={b.id} block={b} card={card} theme={theme} />)}
          <ExploreTiles pages={card.pages} active={active} theme={theme} hrefFor={hrefFor} onSelect={setActive} lang={card.language} />
        </div>

        {/* ---- QR footer ---- */}
        <div className="px-6 pb-8">
          <div className="look-sec rounded-2xl border border-border p-5 flex items-center gap-4 bg-surface2/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code" className="h-24 w-24 rounded-lg bg-white p-1" />
            <div className="text-sm min-w-0">
              <p className="font-medium">Scan to open</p>
              <p className="text-muted mono text-xs mt-1 break-all">{shareUrl ? shareUrl.replace(/^https?:\/\//, "") : `/c/${card.username}`}</p>
              <ShareRow card={card} theme={theme} shareUrl={shareUrl} />
            </div>
          </div>
          {localLine(card) && <p className="mt-3 text-center text-xs text-muted">{localLine(card)}</p>}
          {card.gstin?.trim() && <p className={`${localLine(card) ? "mt-1" : "mt-3"} text-center text-xs text-muted mono`}>GSTIN {card.gstin.trim()}</p>}
        </div>
      </div>

      {/* Every card ends with one door into Shubhora. The link silently carries the owner's username. */}
      {joinHandle && !brand && (
        <a href={`/signup?by=${encodeURIComponent(joinHandle)}`} data-join-door className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-white" style={{ background: "#2f4bd8" }}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Get your own Shubhora — free</span>
            <span className="block text-xs text-white/80">Card, website, daily posters, WhatsApp AI</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </a>
      )}

      {/* Footer credit. A white-label partner replaces it with their own mark;
          "hide branding" drops it entirely, which is what they are paying for. */}
      {brand ? (
        brand.hideBranding ? null : (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-faint">
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="h-4 w-auto opacity-80" />
            )}
            <span className="mono">Powered by {brand.name}</span>
          </p>
        )
      ) : (
        <p className="mt-6 text-center text-xs text-faint mono">Powered by Shubhora</p>
      )}

      {/* Discreet owner entry: a tiny gear under the footer that goes to the
          login page and straight into this card's editor. Visitors barely see
          it; the card holder always knows where to find it. */}
      <a
        href={`/login?next=${encodeURIComponent(`/cards/${card.id}`)}`}
        aria-label="Card owner login"
        title="Card owner login"
        className="mt-3 mb-1 mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted opacity-70 hover:opacity-100 transition-opacity"
      >
        <Settings className="h-4 w-4" />
      </a>

      {/* Floating AI chat assistant */}
      {!expired && <CardChat username={card.username} name={card.name} theme={theme} />}
      {nudge && joinHandle && !brand && <JoinNudge username={card.username} href={`/signup?by=${encodeURIComponent(joinHandle)}`} lang={lang} page={active} />}
    </div>
    </TranslateCtx.Provider>
  );
}

function ShareRow({ card, theme, shareUrl }: { card: Card; theme: string; shareUrl?: string }) {
  const [copied, setCopied] = useState(false);
  // The server already knows the canonical URL (a white-label member shares
  // https://<user>.<brand-domain>, never <host>/c/<user>). Only without it do
  // we fall back to the real origin after mount (reading window during render
  // would cause a hydration mismatch).
  const [url, setUrl] = useState(shareUrl ?? `${SITE_URL}/c/${card.username}`);
  useEffect(() => {
    if (!shareUrl) setUrl(`${window.location.origin}/c/${card.username}`);
  }, [card.username, shareUrl]);
  // Per-channel ?src= tags → the analytics page shows which platform sends leads.
  const tagged = (src: string) => `${url}?src=${src}`;
  // A shop shares under its business name; everyone else under their own name.
  const biz = card.lead === "business" && !!card.company?.trim();
  const title = biz ? card.company.trim() : card.name;
  const intro = biz ? [title, card.jobTitle?.trim()].filter(Boolean).join(" — ") : `${card.name} — ${card.jobTitle}, ${card.company}`;
  const text = `${intro}. Save my contact: ${tagged("share")}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: tagged("share") });
        trackClick(card.username, "share");
        return;
      }
    } catch { /* fall through to copy */ }
    try {
      await navigator.clipboard.writeText(tagged("copy"));
      trackClick(card.username, "share-copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button onClick={share} className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: theme }}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        {copied ? "Link copied" : "Share card"}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${intro}. Save my contact: ${tagged("whatsapp")}`)}`} target="_blank"
        onClick={() => trackClick(card.username, "share-whatsapp")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </a>
    </div>
  );
}

function Avatar({ card }: { card: Card }) {
  // A circle always clips the corners of a photo — fine for a face, bad for a
  // logo or product shot. `avatarShape: "square"` keeps the whole image visible.
  // object-contain means we never auto-crop; cropping is the user's choice in
  // the editor's crop/zoom tool.
  const round = card.avatarShape === "square" ? "rounded-2xl" : "rounded-full";
  if (card.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.avatarUrl} alt={card.name}
        className={`look-avatar h-24 w-24 ${round} object-contain bg-surface ring-4 ring-surface shadow-card`} />
    );
  }
  return (
    <div className={`look-avatar h-24 w-24 ${round} ring-4 ring-surface grid place-items-center text-white text-3xl font-bold shadow-card`}
      style={{ background: `linear-gradient(135deg, ${card.avatarColor}, ${card.avatarColor}bb)` }}>
      {initials(card.lead === "business" && card.company?.trim() ? card.company : card.name)}
    </div>
  );
}

/* ============ Block renderer ============ */
export function Block({ block, card, theme }: { block: CardBlock; card: Card; theme: string }) {
  const t = useT();
  switch (block.kind) {
    case "about":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          {block.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.imageUrl} alt="" loading="lazy" decoding="async" className="w-full rounded-2xl mb-3 object-contain bg-surface2/50 max-h-56" />
          )}
          <div className="look-sec rounded-2xl bg-surface2 p-4 text-sm text-muted leading-relaxed whitespace-pre-line">{t(block.body)}</div>
        </section>
      );

    case "highlights":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <ul className="grid grid-cols-2 gap-2">
            {block.items.filter(Boolean).map((it, i) => {
              // "📅 Since 2015": the emoji takes the place of the tick.
              const { glyph, text } = glyphText(it, t);
              return (
                <li key={i} className="look-sec flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
                  {glyph
                    ? <span aria-hidden="true" className="w-4 shrink-0 mt-0.5 text-center text-base leading-none">{glyph}</span>
                    : <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme }} />}
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      );

    case "services":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="space-y-2">
            {block.items.map((s, i) => (
              <div key={i} className="look-sec rounded-xl border border-border p-3.5 hover:border-border-strong transition-colors">
                <p className="font-medium text-sm">{t(s.name)}</p>
                <p className="text-sm text-muted mt-0.5">{t(s.desc)}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "product":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="space-y-4">
            {block.items.filter((p) => p.name || p.imageUrl).map((p, i) => (
              <ProductCard key={i} product={p} card={card} theme={theme} />
            ))}
          </div>
        </section>
      );

    case "compare":
      // Left-vs-right table. Each row is its own card with a two-column body
      // so it still reads on a phone; the left column is "us" in the theme
      // colour, the right is the generic competitor.
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="rounded-xl px-3 py-2 text-center text-sm font-semibold text-white" style={{ background: theme }}>{t(block.leftLabel)}</div>
            <div className="rounded-xl px-3 py-2 text-center text-sm font-semibold bg-surface2 text-muted">{t(block.rightLabel)}</div>
          </div>
          <div className="space-y-2">
            {block.rows.filter((r) => r.feature).map((r, i) => {
              const lOk = r.leftOk !== false;
              const rOk = r.rightOk === true;
              return (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted bg-surface2/60">{t(r.feature)}</p>
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="flex items-start gap-1.5 p-3 text-sm" style={{ background: `${theme}0d` }}>
                      {lOk ? <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme }} /> : <X className="h-4 w-4 shrink-0 mt-0.5 text-danger" />}
                      <span className="font-medium">{t(r.left)}</span>
                    </div>
                    <div className="flex items-start gap-1.5 p-3 text-sm text-muted">
                      {rOk ? <Check className="h-4 w-4 shrink-0 mt-0.5 text-muted" /> : <X className="h-4 w-4 shrink-0 mt-0.5 text-danger" />}
                      <span>{t(r.right)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );

    case "gallery":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="grid grid-cols-3 gap-2">
            {block.images.map((img, i) =>
              img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img.url} alt={img.label} loading="lazy" decoding="async" className="aspect-square w-full rounded-xl object-contain bg-surface2/50 shadow-card" />
              ) : (
                <div key={i} className="aspect-square rounded-xl grid place-items-center text-white text-xs font-medium shadow-card"
                  style={{ background: `linear-gradient(135deg, ${img.color}, ${img.color}bb)` }}>
                  {t(img.label)}
                </div>
              ),
            )}
          </div>
        </section>
      );

    case "showcase":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {block.items.filter((it) => it.imageUrl || it.label).map((it, i) => {
              const inner = (
                <>
                  <div className="aspect-[16/9] w-full overflow-hidden bg-surface2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.imageUrl && <img src={it.imageUrl} alt={it.label} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[12px] font-semibold leading-tight">{t(it.label)}</p>
                    {it.sub && <p className="truncate text-[10.5px] text-muted">{t(it.sub)}</p>}
                  </div>
                </>
              );
              const cls = "look-sec group block overflow-hidden rounded-xl border border-border bg-surface shadow-card";
              return it.url
                ? <a key={i} href={it.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
                : <div key={i} className={cls}>{inner}</div>;
            })}
          </div>
        </section>
      );

    case "image":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="space-y-3">
            {block.images.map((img, i) => (
              <figure key={i} className="rounded-2xl overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption ?? ""} loading="lazy" decoding="async" className="w-full object-contain bg-surface2/50" />
                {img.caption && <figcaption className="p-2.5 text-xs text-muted">{t(img.caption)}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      );

    case "carousel":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <ProductCarousel images={block.images} theme={theme} />
        </section>
      );

    case "video": {
      // An empty slot (owner hasn't added the video yet) must not render a
      // decorative player that plays nothing.
      if (!block.url) return null;
      const e = embed(block.url);
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="rounded-2xl overflow-hidden border border-border">
            {e?.type === "iframe" ? (
              <iframe src={e.src} title={block.title} className={e.vertical ? "block mx-auto w-full max-w-[320px] aspect-[9/16] bg-black" : "w-full aspect-video"} allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" />
            ) : e?.type === "video" ? (
              <video src={e.src} poster={block.posterUrl} preload="metadata" controls className="w-full aspect-video bg-black object-cover" />
            ) : (
              <div className="aspect-video grid place-items-center" style={{ background: `linear-gradient(135deg, ${theme}, ${theme}88)` }}>
                <span className="h-14 w-14 rounded-full bg-white/90 grid place-items-center shadow-float">
                  <Play className="h-6 w-6 translate-x-0.5" style={{ color: theme }} fill="currentColor" />
                </span>
              </div>
            )}
            {block.caption && <p className="p-3 text-sm text-muted">{t(block.caption)}</p>}
          </div>
        </section>
      );
    }

    case "pdf": {
      const Cmp = block.fileUrl ? "a" : "button";
      // A poster turns the row into a document card: the preview image sits on
      // top and the whole card downloads the PDF (owner's choice — the file is
      // meant to be kept and forwarded, not just viewed).
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <Cmp
            {...(block.fileUrl ? { href: block.fileUrl, download: block.fileLabel } : {})}
            className="w-full block rounded-xl border border-border overflow-hidden text-left hover:bg-surface2 transition-colors"
          >
            {block.posterUrl && (
              <img src={block.posterUrl} alt={block.fileLabel} loading="lazy" decoding="async" className="w-full aspect-video object-cover" />
            )}
            <span className="flex items-center gap-3 p-3.5">
              <span className="h-10 w-10 rounded-lg grid place-items-center text-white shrink-0" style={{ background: theme }}>
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{block.fileLabel}</span>
                <span className="block text-xs text-muted">{block.fileUrl ? t(block.hint || "Tap to download") : "File attaches after upload"}</span>
              </span>
              <Download className="h-4 w-4 text-muted shrink-0" />
            </span>
          </Cmp>
        </section>
      );
    }

    case "testimonials":
      if (!block.items.length) return null; // stay invisible until real reviews are added
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <TestimonialSlider items={block.items} theme={theme} />
        </section>
      );

    case "faq":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="space-y-2">
            {block.items.map((f, i) => (
              <details key={i} className="look-sec group rounded-xl border border-border overflow-hidden">
                <summary className="flex items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium cursor-pointer list-none hover:bg-surface2 transition-colors">
                  {t(f.q)}
                  <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <p className="px-3.5 pb-3.5 text-sm text-muted leading-relaxed">{t(f.a)}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case "hours":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="look-sec rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {block.rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-muted"><Clock className="h-3.5 w-3.5" /> {t(r.day)}</span>
                <span className={`font-medium mono text-xs ${/closed/i.test(r.time) ? "text-danger" : ""}`}>{t(r.time)}</span>
              </div>
            ))}
          </div>
        </section>
      );

    case "appointment":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <AppointmentBlock block={block} username={card.username} theme={theme} />
        </section>
      );

    case "location": {
      // The exact pin when the owner set one; otherwise a search for the address.
      const address = block.address?.trim() ?? "";
      const pin = safeMapUrl(block.mapUrl);
      if (!address && !pin) return null;
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <a href={pin || `https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"
            className={`flex ${address ? "items-start" : "items-center"} gap-3 rounded-xl border border-border p-3.5 hover:bg-surface2 transition-colors`}>
            <span className="h-10 w-10 rounded-lg grid place-items-center text-white shrink-0" style={{ background: theme }}>
              <MapPin className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              {address && <span className="block text-sm font-medium leading-snug">{block.address}</span>}
              <span className={address ? "block text-xs mt-1" : "block text-sm font-medium"} style={{ color: theme }}>Open in Google Maps →</span>
            </span>
          </a>
        </section>
      );
    }

    case "offer":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <div className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: theme, background: `color-mix(in srgb, ${theme} 7%, transparent)` }}>
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5" style={{ color: theme }} />
              <p className="text-sm font-semibold flex-1">{t(block.text)}</p>
            </div>
            {block.code && (
              <button
                onClick={() => { try { navigator.clipboard.writeText(block.code); } catch {} }}
                className="mt-3 w-full flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                <span className="mono text-sm font-bold tracking-widest">{block.code}</span>
                <span className="flex items-center gap-1 text-xs text-muted"><Copy className="h-3.5 w-3.5" /> Copy</span>
              </button>
            )}
            {block.expires && <p className="mt-2 text-[11px] text-muted">Valid till {block.expires}</p>}
          </div>
        </section>
      );

    case "cta": {
      const sep = block.joinUrl.includes("?") ? "&" : "?";
      const link = block.referralCode ? `${block.joinUrl}${sep}ref=${encodeURIComponent(block.referralCode)}` : block.joinUrl;
      const isInternal = link.startsWith("#"); // same-card page link, e.g. "#gallery"
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          {block.body && <p className="text-sm text-muted mb-3">{t(block.body)}</p>}
          <div className="space-y-2">
            <a href={link || undefined} {...(isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              onClick={() => trackClick(card.username, "cta-join")}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={{ background: theme, boxShadow: `0 10px 24px -10px ${theme}` }}>
              {isInternal
                // A link to another page of this card ("#products") reads as "go there".
                ? <>{t(block.joinLabel || "See more")} <ArrowRight className="h-4 w-4" /></>
                : <><UserPlus className="h-4 w-4" /> {block.joinLabel || "Join Now"}</>}
            </a>
            {link && block.referralCode && (
              <button
                onClick={() => { try { navigator.clipboard.writeText(link); } catch { /* ignore */ } }}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <span className="text-xs text-muted truncate">{link}</span>
                <span className="flex items-center gap-1 text-xs text-muted shrink-0"><Copy className="h-3.5 w-3.5" /> Copy referral link</span>
              </button>
            )}
          </div>
        </section>
      );
    }

    case "contact":
      return (
        <section>
          <BlockTitle>{t(block.title)}</BlockTitle>
          <ContactForm username={card.username} theme={theme} />
          {block.note && <p className="mt-2 text-center text-xs text-muted">{t(block.note)}</p>}

          <div className="mt-6 grid grid-cols-4 gap-3">
            {card.links.map((l) => (
              <a key={l.id} href={linkHref(l.type, l.value)} target="_blank" className="flex flex-col items-center gap-1.5 group">
                <span className="h-14 w-14 rounded-2xl grid place-items-center text-white transition-transform group-hover:scale-105 shadow-card" style={{ background: theme }}>
                  <LinkIcon type={l.type} className="h-5 w-5" />
                </span>
                <span className="text-[11px] text-muted text-center">{l.label}</span>
              </a>
            ))}
          </div>

        </section>
      );

    default:
      return null;
  }
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  // An empty title must not leave an empty heading and its gap above the block.
  if (children == null || children === false || (typeof children === "string" && !children.trim())) return null;
  return <h2 className="look-title text-xs mono uppercase tracking-wide text-faint mb-2.5">{children}</h2>;
}


/* ---- what a page is about: icon + a short hint ("6 products · prices", "8 photos") ---- */
export function pageMeta(page: CardPage, lang?: string): { Icon: typeof Home; hint: string } {
  const hi = lang === "hi";
  const kinds = page.blocks.map((b) => b.kind);
  const count = (k: CardBlock["kind"]) => page.blocks.filter((b) => b.kind === k).reduce((n, b) => n + ((b as { items?: unknown[]; images?: unknown[] }).items?.length ?? (b as { images?: unknown[] }).images?.length ?? 0), 0);
  const slug = page.slug.toLowerCase();
  if (slug === "home" || page === undefined) return { Icon: Home, hint: "" };
  // Named pages first (the Shubhora seller card): a templates page is a design gallery, an "inside" page lists features.
  if (slug === "templates" || slug === "designs") { const n = count("showcase") + count("gallery"); return { Icon: LayoutTemplate, hint: n ? `${n} ${hi ? "डिज़ाइन" : "designs"}` : (hi ? "डिज़ाइन" : "designs") }; }
  if (slug === "inside" || slug === "features") { const n = count("services"); return { Icon: SparklesIcon, hint: n ? `${n} ${hi ? "फ़ीचर" : "features"}` : (hi ? "फ़ीचर" : "features") }; }
  // The Shubhora seller card's other named pages: why it matters, the plans, the partner business.
  if (slug === "why" || slug === "why-us") return { Icon: TrendingUp, hint: hi ? "क्यों ज़रूरी है" : "why it matters" };
  if (slug === "plans" || slug === "pricing") { const n = count("product"); return { Icon: IndianRupee, hint: n ? `${n} ${hi ? "प्लान" : n === 1 ? "plan" : "plans"}` : (hi ? "प्लान" : "plans") }; }
  if (slug === "business" || slug === "opportunity") return { Icon: Briefcase, hint: hi ? "बिज़नेस प्लान" : "business plan" };
  if (kinds.includes("product")) { const n = count("product"); const priced = page.blocks.some((b) => b.kind === "product" && b.items.some((i) => i.price)); return { Icon: ShoppingBag, hint: n ? `${n} ${hi ? "प्रोडक्ट" : n === 1 ? "product" : "products"}${priced ? (hi ? " · दाम" : " · prices") : ""}` : "" }; }
  if (kinds.includes("services") && !kinds.includes("product")) { const n = count("services"); return { Icon: Wrench, hint: n ? `${n} ${hi ? "सेवाएँ" : n === 1 ? "service" : "services"}` : "" }; }
  if (kinds.includes("gallery") || kinds.includes("image") || kinds.includes("carousel")) { const n = count("gallery") + count("image") + count("carousel"); return { Icon: Images, hint: n ? `${n} ${hi ? "फ़ोटो" : "photos"}` : "" }; }
  if (kinds.includes("faq")) { const n = count("faq"); return { Icon: HelpCircle, hint: n ? `${n} ${hi ? "सवाल-जवाब" : "questions answered"}` : "" }; }
  if (kinds.includes("testimonials")) { const n = count("testimonials"); return { Icon: Star, hint: n ? `${n} ${hi ? "समीक्षाएँ" : "reviews"}` : "" }; }
  if (kinds.includes("video")) return { Icon: Play, hint: hi ? "वीडियो" : "video" };
  if (kinds.includes("pdf")) return { Icon: FileText, hint: hi ? "फ़ाइल" : "brochure" };
  if (kinds.includes("contact") || kinds.includes("location") || kinds.includes("hours") || kinds.includes("appointment")) {
    const bits = [kinds.includes("location") && (hi ? "पता" : "address"), kinds.includes("hours") && (hi ? "समय" : "timings"), kinds.includes("appointment") && (hi ? "बुकिंग" : "booking"), kinds.includes("contact") && (hi ? "संदेश" : "message")].filter(Boolean) as string[];
    return { Icon: Phone, hint: bits.slice(0, 3).join(" · ") };
  }
  if (kinds.includes("about")) return { Icon: Info, hint: hi ? "हमारे बारे में" : "about us" };
  return { Icon: Compass, hint: "" };
}

/* ---- "See more" tiles at the end of the first page: the other pages, big enough to be noticed ---- */
function ExploreTiles({ pages, active, theme, hrefFor, onSelect, lang }: { pages: CardPage[]; active: string; theme: string; hrefFor: (slug: string) => string; onSelect: (slug: string) => void; lang?: string }) {
  const t = useT();
  const first = pages[0]?.slug;
  if (active !== first) return null;
  const others = pages.filter((p) => p.slug !== first && p.blocks.length);
  if (!others.length) return null;
  const hi = lang === "hi";
  return (
    <section className="look-explore">
      <BlockTitle>{hi ? "और देखें" : t("See more")}</BlockTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {others.map((p) => {
          const { Icon, hint } = pageMeta(p, lang);
          return (
            <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); onSelect(p.slug); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="look-sec group flex items-center gap-2.5 rounded-2xl border border-border bg-surface2 p-3 transition-transform active:scale-[.98]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-card" style={{ background: theme }}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-tight">{t(p.label)}</span>
                {hint && <span className="mt-0.5 block text-[11px] leading-tight text-muted">{hint}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </a>
          );
        })}
      </div>
    </section>
  );
}

/* ---- page tabs with an "and more →" hint while tabs overflow off-screen ---- */
function PageTabs({ pages, active, onSelect, theme, hrefFor }: {
  pages: CardPage[]; active: string; onSelect: (slug: string) => void; theme: string; hrefFor: (slug: string) => string;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const update = () => {
    const el = ref.current;
    if (el) setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
  };
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // A tab chosen by tap or a #hash "Know More" link glides into view.
  useEffect(() => {
    const el = ref.current;
    const btn = el?.querySelector<HTMLElement>(`[data-slug="${active}"]`);
    if (el && btn) el.scrollTo({ left: Math.max(0, btn.offsetLeft - 48), behavior: "smooth" });
  }, [active]);
  // Visitors used to miss the tabs (plain grey words). Now: icon pills, the active one filled in the theme colour,
  // a count on the others ("Photos 8") and, the first time a card opens, one gentle nudge so the eye lands there.
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    if (pages.length < 2) return;
    let seen = false; try { seen = sessionStorage.getItem("ne-tabs-nudged") === "1"; } catch { /* ignore */ }
    if (seen) return;
    const id = setTimeout(() => { setNudge(true); try { sessionStorage.setItem("ne-tabs-nudged", "1"); } catch { /* ignore */ } setTimeout(() => setNudge(false), 2600); }, 1200);
    return () => clearTimeout(id);
  }, [pages.length]);
  const countOf = (p: CardPage) => { const m = pageMeta(p).hint.match(/^(\d+)\s/); return m ? m[1] : ""; };
  // Owner's call (23 Sep 2026): one row (scrolls, with the "more →" arrow); the OPEN page is a light tint of the
  // theme with a steady outline; the OTHER pages blink softly — they are the ones asking to be tapped.
  return (
    <nav className="look-tabs mt-5 border-b border-border sticky top-0 glass z-10 relative">
      <style>{`@keyframes ne-tab-nudge{0%,100%{transform:translateX(0)}20%{transform:translateX(-14px)}40%{transform:translateX(8px)}60%{transform:translateX(-4px)}} @keyframes ne-tab-glow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 4px color-mix(in srgb, ${theme} 30%, transparent)}} @keyframes ne-tab-on{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb, ${theme} 55%, transparent)}50%{box-shadow:0 0 0 5px color-mix(in srgb, ${theme} 0%, transparent)}} .ne-nudge{animation:ne-tab-nudge 1.2s ease-in-out 1} .ne-nudge a:not([aria-current]){animation:ne-tab-glow 1.3s ease-in-out 2} .ne-tab-off{animation:ne-tab-on 2.4s ease-out infinite} @media (prefers-reduced-motion: reduce){.ne-nudge,.ne-nudge a,.ne-tab-off{animation:none}}`}</style>
      <div ref={ref} onScroll={update} className={`flex gap-2 overflow-x-auto no-scrollbar px-3 py-2.5 ${nudge ? "ne-nudge" : ""}`}>
        {pages.map((p) => {
          const on = p.slug === active;
          const { Icon } = pageMeta(p);
          const n = on ? "" : countOf(p);
          return (
            <a key={p.id} data-slug={p.slug} href={hrefFor(p.slug)} aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); onSelect(p.slug); }}
              className={`look-tab relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all ${on ? "" : "ne-tab-off"}`}
              style={on
                ? { background: `color-mix(in srgb, ${theme} 14%, var(--surface))`, borderColor: theme, color: theme }
                : { borderColor: "var(--border-strong)", color: "var(--ink)", background: "var(--surface)" }}>
              <Icon className="h-4 w-4" style={{ color: theme }} />
              {t(p.label)}
              {n && <span className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: theme }}>{n}</span>}
            </a>
          );
        })}
      </div>
      {more && (
        <button
          onClick={() => ref.current?.scrollBy({ left: 160, behavior: "smooth" })}
          aria-label="More pages"
          className="absolute right-0 top-0 bottom-0 flex items-center pl-10 pr-1.5"
          style={{ background: "linear-gradient(90deg, transparent, var(--surface) 55%)" }}>
          <span className="h-6 w-6 rounded-full grid place-items-center text-white shadow-card animate-pulse" style={{ background: theme }}>
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      )}
    </nav>
  );
}

/* ---- swipeable review slider — scroll-snap for touch, arrows for tap ---- */
function TestimonialSlider({ items, theme }: {
  items: { name: string; text: string; rating: number }[]; theme: string;
}) {
  const t = useT();
  const [i, setI] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const go = (n: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = (n + items.length) % items.length;
    // Arrows wrap around (…9, 10, 1, 2…). Jump instantly on the wrap so the
    // track never visibly rewinds through every card in reverse.
    const wrapped = n < 0 || n >= items.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: wrapped ? "auto" : "smooth" });
  };
  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-2xl"
      >
        {items.map((r, d) => (
          <figure key={d} className="w-full shrink-0 snap-center border border-border rounded-2xl p-4 bg-surface2/40">
            <div className="flex gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="h-3.5 w-3.5" fill={s <= r.rating ? theme : "none"}
                  style={{ color: s <= r.rating ? theme : "var(--faint)" }} />
              ))}
            </div>
            <blockquote className="text-sm leading-relaxed">&ldquo;{t(r.text)}&rdquo;</blockquote>
            <figcaption className="mt-2 text-xs font-medium text-muted">— {r.name}</figcaption>
          </figure>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button onClick={() => go(i - 1)} aria-label="Previous review"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-border grid place-items-center backdrop-blur-sm"
            style={{ background: "color-mix(in srgb, var(--surface) 55%, transparent)", color: "var(--muted)" }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => go(i + 1)} aria-label="Next review"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-border grid place-items-center backdrop-blur-sm"
            style={{ background: "color-mix(in srgb, var(--surface) 55%, transparent)", color: "var(--muted)" }}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mt-2 flex justify-center gap-1.5">
            {items.map((_, d) => (
              <button key={d} onClick={() => go(d)} aria-label={`Go to review ${d + 1}`}
                className="h-1.5 w-1.5 rounded-full transition-colors" style={{ background: d === i ? theme : "var(--faint)" }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- one-at-a-time product slider — opens on the middle photo, arrows either side ---- */
function ProductCarousel({ images, theme }: { images: CardImage[]; theme: string }) {
  const t = useT();
  const [i, setI] = useState(Math.floor(images.length / 2));
  if (!images.length) return null;
  const img = images[i];
  return (
    <figure className="rounded-2xl overflow-hidden border border-border">
      <div className="relative">
        {/* Curated art fills the frame; the owner's own product photo is shown whole on white. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={img.caption ?? ""} loading="lazy" decoding="async"
          className={`w-full aspect-[4/5] ${isCuratedArt(img.url) ? "object-cover bg-surface2/50" : "object-contain bg-white"}`} />
        {images.length > 1 && (
          <>
            <button onClick={() => setI((v) => (v - 1 + images.length) % images.length)} aria-label="Previous product"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white grid place-items-center backdrop-blur-sm">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setI((v) => (v + 1) % images.length)} aria-label="Next product"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white grid place-items-center backdrop-blur-sm">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
              {images.map((_, d) => (
                <button key={d} onClick={() => setI(d)} aria-label={`Go to photo ${d + 1}`}
                  className="h-1.5 w-1.5 rounded-full transition-colors" style={{ background: d === i ? theme : "rgba(255,255,255,.6)" }} />
              ))}
            </div>
          </>
        )}
      </div>
      {img.caption && <figcaption className="p-2.5 text-xs text-muted text-center">{t(img.caption)}</figcaption>}
    </figure>
  );
}

/* ---- full-screen image viewer (tap product photo → opens here) ---- */
export function ImageLightbox({
  images, index, onIndex, onClose, alt,
}: {
  images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void; alt: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [index, images.length, onClose, onIndex]);

  // Portal to <body> — same transformed-ancestor trap as the appointment dialog.
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-rise"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={alt}
        className="max-h-[80vh] max-w-full object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <div className="mt-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {images.map((g, i) => (
            <button
              key={i}
              onClick={() => onIndex(i)}
              className={`h-14 w-14 rounded-lg overflow-hidden border-2 bg-white/10 ${i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-0.5" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-white/60">{alt}</p>
    </div>,
    document.body,
  );
}

/* ---- professional product card ---- */
export function parsePrice(s?: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ProductCard({
  product: p, card, theme,
}: {
  product: Extract<CardBlock, { kind: "product" }>["items"][number];
  card: Card;
  theme: string;
}) {
  const mrp = parsePrice(p.mrp);
  const price = parsePrice(p.price);
  const saved = mrp && price && mrp > price ? mrp - price : null;
  const discount = saved && mrp ? Math.round((saved / mrp) * 100) : null;

  const wa = card.links.find((l) => l.type === "whatsapp")?.value?.replace(/[^0-9]/g, "");
  const ctaHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${card.name.split(" ")[0]}, I'm interested in "${p.name}". Please share details.`)}`
    : undefined;
  const features = p.features.filter(Boolean);
  const specs = p.specs.filter((s) => s.label || s.value);

  // Gallery: new images[] plus the legacy single imageUrl, max 3, de-duplicated.
  const gallery = [...(p.images ?? []), ...(p.imageUrl ? [p.imageUrl] : [])]
    .filter((u, i, a) => u && a.indexOf(u) === i)
    .slice(0, 3);
  const [shot, setShot] = useState(0);
  const [zoom, setZoom] = useState(false);
  const tr = useT();
  const main = gallery[Math.min(shot, gallery.length - 1)];

  return (
    <article className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
      {main && (
        <div className="relative">
          {/* object-contain on a soft backdrop → nothing is cropped top/bottom */}
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="block w-full bg-surface2/60 cursor-zoom-in"
            aria-label={`${p.name} — view full image`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main} alt={p.name} loading="lazy" decoding="async" className="w-full h-56 object-contain p-3" />
          </button>
          {p.badge && (
            <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
              style={{ background: theme }}>{p.badge}</span>
          )}
          {gallery.length > 1 && (
            <div className="flex justify-center gap-2 pb-3">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setShot(i)}
                  className={`h-12 w-12 rounded-lg overflow-hidden border-2 bg-surface transition-colors ${i === shot ? "" : "border-border opacity-60 hover:opacity-100"}`}
                  style={i === shot ? { borderColor: theme } : undefined}
                  aria-label={`Photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {zoom && main && (
        <ImageLightbox
          images={gallery}
          index={shot}
          onIndex={setShot}
          onClose={() => setZoom(false)}
          alt={p.name}
        />
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[15px] leading-snug">{tr(p.name)}</h3>
          {!main && p.badge && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: theme }}>{p.badge}</span>
          )}
        </div>

        {p.desc && <p className="text-sm text-muted leading-relaxed">{tr(p.desc)}</p>}

        {(price || mrp) && (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              {price && <span className="text-xl font-bold" style={{ color: theme }}>{p.price}</span>}
              {mrp && mrp !== price && <span className="text-sm text-faint line-through">{p.mrp}</span>}
              {discount && (
                <span className="rounded-md bg-good/10 text-good px-1.5 py-0.5 text-[11px] font-semibold">{discount}% OFF</span>
              )}
            </div>
            {saved && (
              <p className="text-[12px] font-medium text-good">You save ₹{saved.toLocaleString("en-IN")}</p>
            )}
          </div>
        )}

        {features.length > 0 && (
          <ul className="space-y-1.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme }} />
                <span>{tr(f)}</span>
              </li>
            ))}
          </ul>
        )}

        {specs.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            {specs.map((s, i) => (
              <div key={i} className={`flex text-sm ${i % 2 ? "bg-surface2/40" : ""}`}>
                <span className="w-2/5 px-3 py-2 text-muted border-r border-border">{tr(s.label)}</span>
                <span className="flex-1 px-3 py-2 font-medium">{tr(s.value)}</span>
              </div>
            ))}
          </div>
        )}

        {ctaHref && (
          <a href={ctaHref} target="_blank" rel="noopener noreferrer"
            onClick={() => trackClick(card.username, `product:${p.name.slice(0, 30)}`)}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-transform active:scale-[0.98]"
            style={{ background: theme }}>
            <ShoppingBag className="h-4 w-4" /> {tr(p.ctaLabel || "Order on WhatsApp")}
          </a>
        )}
      </div>
    </article>
  );
}

/**
 * Lead-capture modal (name + phone + email) offering the owner's incentive.
 *
 * Timing is engagement-based, not a blunt timer: it opens once the visitor
 * has actually shown interest — opened a second page or read half of one —
 * and at least 6 s in; a visitor who never engages gets it once at 30 s.
 * Never twice in a visit; never again after they sign up; a dismissal buys
 * them three quiet days before it may return.
 */
const POPUP_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export function WelcomePopup({ card, theme, active }: { card: Card; theme: string; active: string }) {
  const cfg = card.popup;
  const u = card.username;
  const doneKey = `ne-popup-done:${u}`;      // signed up — never again
  const snoozeKey = `ne-popup-snooze:${u}`;  // dismissed — wait 3 days
  const sessionKey = `ne-popup-shown:${u}`;  // once per visit
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const firstPage = useRef(active);
  const engaged = useRef(false);

  // Only for visitors who are not Shubhora members (owner's call, 29 Sep 2026): a signed-in account never sees it.
  const [member, setMember] = useState<boolean | null>(null);
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) { setMember(false); return; }
    sb.auth.getSession().then(({ data }) => setMember(!!data.session)).catch(() => setMember(false));
  }, []);
  useEffect(() => {
    if (!cfg?.enabled || member !== false) return;
    try {
      if (localStorage.getItem(doneKey)) return;
      const snoozed = Number(localStorage.getItem(snoozeKey) || 0);
      if (snoozed && Date.now() - snoozed < POPUP_SNOOZE_MS) return;
      if (sessionStorage.getItem(sessionKey)) return;
    } catch { /* storage blocked — fall through and show once */ }
    let opened = false;
    const start = Date.now();
    const fire = () => {
      if (opened) return;
      opened = true;
      setShow(true);
      try { sessionStorage.setItem(sessionKey, "1"); } catch { /* ignore */ }
    };
    const maybe = () => { if (engaged.current && Date.now() - start >= 6000) fire(); };
    const onScroll = () => {
      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight >= doc.scrollHeight * 0.5) { engaged.current = true; maybe(); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const tick = setInterval(maybe, 1000);
    const fallback = setTimeout(fire, 30000);
    return () => { window.removeEventListener("scroll", onScroll); clearInterval(tick); clearTimeout(fallback); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.enabled, u, member]);

  // Opening a second page is the clearest sign of interest.
  useEffect(() => { if (active !== firstPage.current) engaged.current = true; }, [active]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(snoozeKey, String(Date.now())); } catch { /* ignore */ }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { submitLead } = await import("@/lib/cloud");
    await submitLead(u, { ...f, message: `🎁 Welcome popup — ${cfg?.title ?? "offer"}`, source: "popup" });
    setState("done");
    try { localStorage.setItem(doneKey, "1"); } catch { /* ignore */ }
  }

  if (!cfg?.enabled || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={dismiss}>
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-float" onClick={(e) => e.stopPropagation()}>
        <button onClick={dismiss} className="absolute right-3 top-3 text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        {state === "done" ? (
          <div className="py-3">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: theme }}>
              <Check className="h-6 w-6" />
            </span>
            <p className="mt-3 font-semibold">You&apos;re in! 🎉</p>
            <p className="mt-1 text-sm text-muted">We&apos;ll share your offer on WhatsApp or email shortly.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: theme }}>
              <BadgePercent className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold leading-snug">{cfg.title === "See your own card, free" ? "Make free card" : cfg.title}</h3>
            {cfg.subtitle && <p className="text-sm text-muted">{cfg.subtitle}</p>}
            <input required placeholder="First name" className="wp-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input required placeholder="Mobile number" className="wp-input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input required type="email" placeholder="Email address" className="wp-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <button type="submit" disabled={state === "busy"}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: theme }}>
              {state === "busy" ? "Sending…" : cfg.ctaLabel}
            </button>
            {cfg.terms && <p className="text-[11px] text-faint leading-snug">{cfg.terms}</p>}
            <style>{`.wp-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:.6rem;padding:.65rem .85rem;font-size:.875rem;outline:none;color:var(--ink)}.wp-input:focus{border-color:${theme}}`}</style>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function AppointmentBlock({ block, username, theme }: {
  block: Extract<CardBlock, { kind: "appointment" }>; username: string; theme: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", date: "", time: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { submitLead } = await import("@/lib/cloud");
    await submitLead(username, {
      name: f.name, phone: f.phone, email: "",
      message: `📅 Demo/appointment request — ${f.date} ${f.time}`.trim(),
    });
    setState("done");
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-2xl p-4 text-white shadow-card transition-transform hover:-translate-y-0.5 text-left"
        style={{ background: `linear-gradient(135deg, ${theme}, ${theme}cc)` }}>
        <span className="h-11 w-11 rounded-xl bg-white/20 grid place-items-center shrink-0">
          <CalendarClock className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Book an appointment</span>
          {block.note && <span className="block text-xs text-white/80 mt-0.5">{t(block.note)}</span>}
        </span>
      </button>

      {/* Portal to <body>: the card wrapper's CSS transform would otherwise
          re-anchor position:fixed to the tall card instead of the viewport,
          opening the dialog far away from where the visitor tapped. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
            {state === "done" ? (
              <div className="text-center py-4">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: theme }}>
                  <Check className="h-6 w-6" />
                </span>
                <p className="mt-3 font-semibold">Request sent! 🎉</p>
                <p className="mt-1 text-sm text-muted">We&apos;ll confirm your slot on WhatsApp shortly.</p>
                <button onClick={() => setOpen(false)} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface2">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Book a free demo</h3>
                  <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
                </div>
                <input required placeholder="Your name" className="apt-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                <input required placeholder="WhatsApp number" className="apt-input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" required className="apt-input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                  <select required className="apt-input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>
                    <option value="">Time</option>
                    {["Morning", "Afternoon", "Evening"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={state === "busy"} className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: theme }}>
                  {state === "busy" ? "Sending…" : "Request slot"}
                </button>
                <style>{`.apt-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:.6rem;padding:.6rem .8rem;font-size:.875rem;outline:none;color:var(--ink)}.apt-input:focus{border-color:${theme}}`}</style>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function ContactForm({ username, theme, fill = false }: { username: string; theme: string; fill?: boolean }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { submitLead } = await import("@/lib/cloud");
    const res = await submitLead(username, f);
    if (res.ok) { setState("done"); return; }
    if (res.error === "demo") {
      setState("done"); // demo mode: pretend success so the flow is demo-able
      return;
    }
    setErr(res.error ?? "Something went wrong. Try WhatsApp instead.");
    setState("error");
  }

  if (state === "done") {
    return (
      <div className="look-sec rounded-2xl border border-border p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full text-white" style={{ background: theme }}>
          <Check className="h-5 w-5" />
        </span>
        <p className="mt-3 font-semibold text-sm">Message sent!</p>
        <p className="mt-1 text-xs text-muted">You&apos;ll get a reply soon — usually within a few hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`space-y-3 ${fill ? "flex flex-col h-full" : ""}`}>
      {/* The input styles live with the form so every host (card, website) gets them. */}
      <style>{`.cf-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:.75rem;padding:.7rem .85rem;font-size:.9rem;outline:none;color:var(--ink)}.cf-input:focus{border-color:${theme};box-shadow:0 0 0 3px color-mix(in srgb, ${theme} 16%, transparent)}`}</style>
      <input required placeholder="Your name" className="cf-input" value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="Phone" className="cf-input" value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input type="email" placeholder="Email" className="cf-input" value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })} />
      </div>
      <textarea placeholder="Message" className={`cf-input resize-y ${fill ? "flex-1 min-h-40" : "min-h-20"}`} value={f.message}
        onChange={(e) => setF({ ...f, message: e.target.value })} />
      {state === "error" && <p className="text-xs text-danger">{err}</p>}
      <button type="submit" disabled={state === "busy"}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: theme }}>
        <Send className="h-4 w-4" /> {state === "busy" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
