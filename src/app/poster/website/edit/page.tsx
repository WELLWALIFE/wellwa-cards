"use client";
// Website editor: the look (palette, fonts, hero layout, corners), the hero (words, picture, logo), the home page's
// sections (order, show/hide, trust facts) and the pages shown — with a live desktop preview above the controls.
// Everything here changes card.site.* only; the phone card, the pages and their text are untouched (those are
// edited in the full editor). One Save writes it all through PATCH /api/site/status.
import { checkSite } from "@/lib/site-quality";
import { isShubhoraSellerCard, sellerBaked, withoutFreeCard } from "@/lib/shubhora-page";
import { Children, Fragment, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Sparkles, ExternalLink, Eye, EyeOff, ChevronUp, ChevronDown, RefreshCw, Check, Palette, Type, LayoutTemplate, ListOrdered, Files, Link2, Image as ImageIcon, Sun, Moon, FileText, MousePointerClick, Package, BookUser, ListChecks, Star, User, Clock, Wallet, Megaphone, Globe, Search, Store, Camera, Paintbrush, Phone, Settings,  QrCode, Copy, MessageCircle, X, LayoutGrid, ChevronLeft, Undo2, Redo2, RotateCcw, Pencil, Plus, Maximize2, Minimize2, Info } from "lucide-react";
import QRCode from "qrcode";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { SITE_PHOTO_CREDITS } from "@/lib/site-pricing";
import { CreditPrice, UnlockDialog, useAiAccess } from "@/lib/ai-access";
import { SITE_PALETTES, FONT_PAIRS, HERO_LAYOUTS, RADII, brandPalette, type SitePalette } from "@/lib/site-style";
import { ADV_HERO_NAMES, HEADING_FONTS, HERO_IDS, SHAPES, VARIANT_IDS, homeSlugOf, repairOrder, type SectionKey } from "@/lib/site-advanced";
import { variantName } from "@/lib/site-advanced-names";
import { LayoutThumb } from "@/components/site-adv/layout-thumb";
import { allowedByFit, fitOf, groupOfCard, tradeAllows } from "@/lib/site-advanced-archetypes";
import { buildContent, sectionHasContent } from "@/components/site-adv/content";
import { catalogLabel, recipeFor } from "@/lib/site-recipes";
import { flowParts } from "@/components/site-adv/flow";
import { SitePhotos } from "@/components/poster/site-photos";
import { NoticeBox } from "@/components/poster/notice-box";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";
import { EmbedPane } from "@/components/poster/embed-pane";
import { EditFocus } from "@/components/poster/edit-focus";
import { completeness, partFor, partState } from "@/lib/edit-status";
import { editHref, partParam, rememberEdit } from "@/lib/edit-nav";
import { useEditHistory } from "@/lib/use-edit-history";
import { type Scope } from "@/components/poster/edit-parts";
import { AdvancedEntry } from "@/components/poster/advanced-entry";
import { homeSections, sectionLabel, trustFacts, isEmptyBlock } from "@/lib/site-home";
import type { Card, CardBlock, CardPage, HeroSlide, SiteStyle } from "@/lib/types";

const PREVIEW_KEY = "site-edit";
type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string; slides?: HeroSlide[]; focus?: string; focusOwn?: boolean };
/** "Keep in view": which part of a banner photo stays in the frame when it is cut to the banner's shape. */
const KEEP: readonly (readonly [string, string, string])[] = [["", "Automatic", "अपने-आप"], ["10% 40%", "Left", "बायाँ"], ["50% 40%", "Middle", "बीच"], ["90% 40%", "Right", "दायाँ"], ["50% 10%", "Top", "ऊपर"], ["50% 90%", "Bottom", "नीचे"]];
/** The screens that go with each screen (owner, 25 Nov 2026: "ek page pe gaye to usse related doosra link usi page pe dikh jaye"): shown under
 *  every screen's title, so the owner moves on from one to the next — banner words → banner photos → which part to keep, and back. */
const RELATED: Record<string, readonly string[]> = {
  hero: ["photos", "look", "offer", "home"],
  photos: ["hero", "products", "about"],
  products: ["photos", "details", "reviews"],
  about: ["photos", "you", "details"],
  details: ["products", "about", "text"],
  reviews: ["about", "links", "buttons"],
  you: ["where", "buttons", "links"],
  where: ["you", "buttons", "hero"],
  links: ["you", "buttons", "reviews"],
  buttons: ["you", "where", "links"],
  trade: ["you", "about", "seo"],
  text: ["hero", "about", "details", "pages"],
  look: ["hero", "home", "photos"],
  offer: ["hero", "buttons"],
  home: ["hero", "look", "text"],
  pages: ["text", "home"],
  seo: ["trade", "domain"],
  domain: ["seo", "website"],
  website: ["pages", "domain"],
};
/** The words on a related screen's button where its own name would not say why it is there. */
const RELATED_NAME: Record<string, Record<string, string>> = {
  photos: { hero: "Banner words & which part of the photo to keep" },
  hero: { photos: "Change banner photos" },
};
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; site: Card["site"] | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string }; card?: Card };
type Tab = "look" | "hero" | "home" | "pages" | "text" | "buttons" | "website" | "photos" | "products" | "about" | "details" | "reviews" | "you" | "where" | "links" | "offer" | "domain" | "seo" | "trade";
type Group = "design" | "content" | "photos" | "contact" | "settings";
/** Off: nothing in the editor goes live by itself any more — Save puts it on the website (owner, 24 Nov 2026). */
const AUTO_SAVE = false as boolean;
/** What Undo / Redo step through: the website settings, each page's order of sections and each page's top. */
const snapOf = (c: Card) => JSON.stringify({ site: c.site ?? null, orders: Object.fromEntries(c.pages.map((p) => [p.slug, p.blocks.map((b) => b.id)])), heads: Object.fromEntries(c.pages.map((p) => [p.slug, { label: p.label, head: p.head ?? null }])) });
/** Which group each part sits in (the list's GROUPS, for a part opened from the preview). */
/** The editor's names (final review, 24 Nov 2026 — https://claude.ai/artifact/HkXgzpjpzf9AgS5oP1bp8h): short, in English, one name per thing. */
const LABEL: Record<string, [string, string]> = {
  hero: ["Home banner", "The big heading and banner photos at the top of your home page"],
  look: ["Colours & fonts", "Colour, font, background and corners"],
  text: ["All pages & text", "Every page's text; add, rename or remove a page"],
  photos: ["Photo library", "Banner photos and the photo gallery"],
  products: ["Products", "Products, prices and their photos"],
  about: ["About us", "Your story and your logo"],
  details: ["Services & highlights", "What you offer and why people choose you"],
  reviews: ["Reviews & Google link", "Customer reviews and your Google review link"],
  you: ["Phone, WhatsApp & photo", "Also shown on your posters"],
  where: ["Address & hours", "Address, map pin and opening hours"],
  links: ["Payments & social", "UPI and social media links"],
  buttons: ["Contact buttons", "Call, WhatsApp, Email, Map — add, remove, reorder"],
  trade: ["Name & category", "Your business name and what you do"],
  offer: ["Announcement bar", "A line on top or a pop-up, e.g. “Diwali 20% off”"],
  website: ["Website on / off", "Show or hide the website; Premium features"],
  home: ["Key figures", "The trust numbers under the big line, and the section order"],
  pages: ["Pages shown", "Which pages appear in the website menu"],
  seo: ["Google search (SEO)", "Be found on Google in your city"],
  domain: ["Custom domain", "Your own address, like www.yourshop.com"],
};
/** The four tabs of the editor: every job in exactly one of them. */
const RTABS = [["sections", "Sections"], ["design", "Design"], ["info", "Business info"], ["settings", "Settings"]] as const;
type RTab = (typeof RTABS)[number][0];
/** A row of a list in the editor: a name, one line under it, and what can be done to it on the right. */
function EdRow({ Icon, title, sub, onClick, badge, children, dim = false }: { Icon?: typeof Palette; title: string; sub?: string; onClick?: () => void; badge?: React.ReactNode; children?: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`${ROW} ${dim ? "opacity-60" : ""}`}>
      {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"><Icon className="h-[18px] w-[18px]" /></span>}
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
      </button>
      {badge}
      {children}
    </div>
  );
}
/** Two or three choices side by side (Card | Website, Computer | Phone). */
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <span role="group" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-surface2 p-0.5">
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => v !== value && onChange(v)} className={`h-8 rounded-md px-3 text-[12px] font-semibold transition ${value === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>)}
    </span>
  );
}
/** "Saved" / an error under the top bar; "Saved" goes by itself after a moment, an error stays longer. */
function SaveToast({ note }: { note: { text: string; bad: boolean } | null }) {
  const [shown, setShown] = useState<{ text: string; bad: boolean } | null>(null);
  // Keyed on the words, not on the object: the caller hands a new object on every draw, so the note used to come back each time the
  // screen drew again and "Website saved" stayed up for minutes (review, 25 Nov 2026).
  const text = note?.text ?? "", bad = !!note?.bad;
  useEffect(() => {
    setShown(text ? { text, bad } : null);
    if (!text) return;
    const t = setTimeout(() => setShown(null), bad ? 7000 : 2800);
    return () => clearTimeout(t);
  }, [text, bad]);
  return shown ? <p role={shown.bad ? "alert" : "status"} className={`absolute inset-x-3 top-[calc(100%+6px)] z-40 rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)] ${shown.bad ? "bg-danger/95" : "bg-good/95"}`}>{shown.text}</p> : null;
}
/** What a design that does not fit yet needs, and where to add it. */
function needOf(k: string, id: string): { text: string; part: string; btn: string } {
  if (k === "hero" && id === "product-spotlight") return { text: "This design needs at least 2 products with photos.", part: "products", btn: "Add products" };
  if (k === "hero") return { text: "This design needs a banner photo.", part: "photos", btn: "Add a photo" };
  if (id === "tiers") return { text: "This design needs at least 2 products or plans.", part: "products", btn: "Add products" };
  return { text: "This design needs products with photos.", part: "products", btn: "Add product photos" };
}
const TB = "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-ink shadow-sm transition hover:-translate-y-px hover:shadow disabled:opacity-35 disabled:shadow-none";
const TBW = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12px] font-semibold text-ink shadow-sm transition hover:-translate-y-px hover:shadow disabled:opacity-35 disabled:shadow-none";
const IB = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink disabled:opacity-30";
/** A list in the editor: every row its own raised card (owner, 24 Nov 2026: "sab cheez page par ubhri hui dikhni chahiye"). */
const BOX = "space-y-2";
const ROW = "flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_6px_16px_-8px_rgba(16,24,40,0.16)] transition hover:-translate-y-px hover:border-brand/40 hover:shadow-[0_2px_4px_rgba(16,24,40,0.08),0_12px_24px_-10px_rgba(16,24,40,0.22)]";
const TAB_GROUP: Record<string, Group> = {
  look: "design", hero: "content", home: "content", text: "content", products: "content", about: "content", details: "content", reviews: "content",
  photos: "content", you: "contact", where: "contact", links: "contact", buttons: "contact", trade: "contact",
  offer: "settings", website: "settings", pages: "settings", seo: "settings", domain: "settings",
};
/** Tabs whose own screen is shown inside this one (a frame): it saves by itself and tells this page (components/poster/embed-mode.tsx). */
const DONE = "/poster/embed-done";
const EMBED: Partial<Record<Tab, (cardId: string) => string>> = {
  text: (id) => `/poster/d/editor?id=${encodeURIComponent(id)}&only=pages&back=${DONE}`,
  buttons: (id) => `/poster/d/editor?id=${encodeURIComponent(id)}&focus=links&back=${DONE}`,
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
/** One part of a Premium home page as the website draws it: a design section (`sec`), one of the Home page's own sections (`blk`), or both. */
type HomeRow = { id: string; sec: SectionKey | null; blk?: string; name: string; /** What the row is, for its icon. */ ic?: string; /** What kind of section it is, and how many items ("Photos · 9"). */ kind?: string };
/** A section's kind in plain words, for the line under its name. */
const KIND_NAME: Record<string, string> = {
  about: "About", highlights: "Key points", services: "Services", product: "Products", gallery: "Photos", image: "Photo", carousel: "Photos",
  video: "Video", testimonials: "Reviews", faq: "Questions", hours: "Timings", location: "Address", contact: "Contact form", form: "Form",
  cta: "Button", story: "Story", table: "Price list", showcase: "Showcase", compare: "Comparison", offer: "Offer", appointment: "Booking", pdf: "PDF",
};
const ROW_ICON: Record<string, typeof Palette> = {
  hero: ImageIcon, masthead: Type, trust: ListOrdered, about: BookUser, highlights: ListChecks, services: ListChecks, product: Package, table: Package,
  gallery: Camera, image: Camera, carousel: Camera, video: Camera, testimonials: Star, faq: FileText, hours: Clock, location: Clock,
  contact: Phone, form: Phone, appointment: Clock, cta: MousePointerClick, offer: Megaphone, story: BookUser, showcase: LayoutGrid, footer: LayoutTemplate,
};
function kindLine(b: CardBlock): string {
  const n = "items" in b && Array.isArray(b.items) ? b.items.length : "images" in b && Array.isArray(b.images) ? b.images.length : 0;
  return `${KIND_NAME[b.kind] ?? b.kind}${n > 1 ? ` · ${n}` : ""}`;
}
const rowFocus = (r: HomeRow): { top?: boolean; sec?: string; blk?: string } => (r.sec === "hero" ? { top: true } : r.blk ? { blk: r.blk, ...(r.sec ? { sec: r.sec } : {}) } : { sec: r.sec ?? "" });
/** The home page's sections put in the order of `ids`; a section the list does not name keeps its place. */
function orderHome(pages: Card["pages"], slug: string, ids: string[]): Card["pages"] {
  const pos = new Map(ids.map((id, n) => [id, n]));
  return pages.map((p) => {
    if (p.slug !== slug) return p;
    const named = p.blocks.filter((b) => pos.has(b.id)).sort((x, y) => pos.get(x.id)! - pos.get(y.id)!);
    let n = 0;
    return { ...p, blocks: p.blocks.map((b) => (pos.has(b.id) ? named[n++] : b)) };
  });
}
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


export default function WebsiteEditPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [tab, setTab] = useState<Tab>("look");
  const [group, setGroup] = useState<Group>("design");
  /** The list of parts (false) or one part open (true). */
  const [open, setOpen] = useState(false);
  /** Text & pages opened from a ✏️ on one section: the editor starts right at it. */
  const [atBlock, setAtBlock] = useState("");
  /** The section the owner has scrolled to inside Text & pages: the window follows it (and opens its page). */
  const [sync, setSync] = useState<{ text: string; page?: string; alt?: string[]; sec?: string; blk?: string } | null>(null);
  // Opened from the Card editor's switch with a part open (?part=): that part opens here too.
  const partDone = useRef(false);
  useEffect(() => {
    if (!card || partDone.current) return;
    partDone.current = true; rememberEdit("site");
    const p = partParam();
    if (p && TAB_GROUP[p]) { setGroup(TAB_GROUP[p]); setTab(p as Tab); setOpen(true); }
  }, [card]);
  /** A screen in a tab (Products, Timings …) showing its unsaved change: the window shows that copy until it is saved. */
  const [embedView, setEmbedView] = useState<{ card: Card; page?: string; focus?: { top?: boolean; text?: string } } | null>(null);
  const [savedTab, setSavedTab] = useState("");
  /** The full editor in "Text & pages" has unsaved changes: this page's Save bar saves them (saveTick tells it). */
  const [embedDirty, setEmbedDirty] = useState(false);
  /** The website as it was before the last Save ("Undo"): stays until the next Save or leaving; the last saved one is kept to know it. */
  const [undo, setUndo] = useState<Card | null>(null);
  const lastSaved = useRef<Card | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  /** This page's own changes wait for the editor's Save (it writes the whole card): they go right after it, on top. */
  const ownAfter = useRef(false);
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
  /** ↶ ↷ on the bar: each change on this screen is a step; loading or a Save starts afresh. */
  const [histReset, setHistReset] = useState(0);
  // Undo / Redo cover the website settings and the order of the Home page's sections (moved from the Sections tab).
  const histSnap = card ? snapOf(card) : null;
  const history = useEditHistory(histSnap, (v) => {
    const o = JSON.parse(v) as { site: Card["site"]; orders: Record<string, string[]>; heads?: Record<string, { label: string; head: CardPage["head"] | null }> };
    touched.current.add("homeBlocks");
    for (const sl of Object.keys(o.orders ?? {})) touched.current.add(`order:${sl}`);
    // The tops of the pages (Page heading) step back too: the name, the photo, the line and the shape as they were.
    const heads = o.heads ?? {};
    setCard((cur) => {
      if (!cur) return cur;
      const pages = Object.entries(o.orders ?? {}).reduce((pg, [sl, ids]) => orderHome(pg, sl, ids), cur.pages).map((p) => {
        const h = heads[p.slug];
        if (!h || (h.label === p.label && JSON.stringify(h.head ?? null) === JSON.stringify(p.head ?? null))) return p;
        touched.current.add(`head:${p.slug}`);
        const { head: _was, ...bare } = p; void _was;
        return { ...bare, label: h.label, ...(h.head ? { head: h.head } : {}) };
      });
      return { ...cur, site: o.site, pages };
    });
    // Back to exactly what is saved → nothing to save (owner, 25 Nov 2026: Undo to the start still said "Unsaved changes").
    const saved = lastSaved.current;
    setDirty(!saved || v !== snapOf(saved));
  }, `${card?.id ?? ""}-${histReset}`);
  const [refUrl, setRefUrl] = useState("");
  const [unlock, setUnlock] = useState(false);
  const access = useAiAccess();
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  // The window on top stays put while the options under it scroll (owner, 24 Oct 2026); a tap makes it big or small again.
  const [big, setBig] = useState(false);
  /** Phone only: the window folded away, so the editing has the whole screen (owner, 25 Nov 2026: only ~200px was left to edit in). */
  const [pvHide, setPvHide] = useState(false);
  // One screen of the website, not the whole page (a one-screen-tall hero grew with a page-tall frame; 24 Oct 2026): it scrolls inside.
  const [boxH, setBoxH] = useState(230);
  // Phone / computer view of the preview (master list #13): the same page in a 390 px wide window.
  const [phoneView, setPhoneView] = useState(false);
  const [boxW, setBoxW] = useState(0);
  const focusAsk = useRef<{ top?: boolean; text?: string; sec?: string; blk?: string } | null>(null);
  // One part of the home page, tapped in the window (or reached by "check my website"): its own sheet with everything that can be
  // changed about it — layout, words, photo — in one place (owner, 24 Nov 2026: "kuch chhupa na rahe"; master list #6, #11).
  const [sheet, setSheet] = useState<{ id: string } | null>(null);
  const [rtab, setRtab] = useState<RTab>("sections");
  /** Colours & fonts, or Section designs: two rows of the Design tab, one screen each. */
  const [lookMode, setLookMode] = useState<"style" | "sections">("style");
  const [healthOpen, setHealthOpen] = useState(false);
  // The top bar's height: the preview sits right under it while the page scrolls.
  const topBar = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(56);
  /** Where the window stays while a sheet is open (that part of the home page). */
  const sheetFocus = useRef<{ top?: boolean; sec?: string; blk?: string } | null>(null);
  /** A part opened from a section's sheet keeps the window on that section (sheetOpen): the screen inside reports where IT is scrolled
   *  while it opens (the page's first parts, then the block), and the window used to follow — up to the top, then to two other sections
   *  (final test, 25 Nov 2026). While pinned, only a different section the owner scrolls to himself, after the screen has settled, moves it. */
  const pin = useRef<{ sync: { text: string; page?: string; sec?: string; blk?: string }; at: number } | null>(null);
  /** The screen inside has sent this website's own card (onLive below): until then its "not saved" is its blank start, not a change. */
  const embedReal = useRef(false);
  const onEmbedSync = useCallback((at: { text: string; page?: string; alt?: string[]; blk?: string }) => {
    const p = pin.current;
    if (p && (Date.now() - p.at < 4000 || !at.blk || at.blk === p.sync.blk)) { setSync(p.sync); return; }
    pin.current = null; setSync(at);
  }, []);
  const homeRowsRef = useRef<HomeRow[]>([]);
  /** Show this part in the window: the top of the website, or the section / line with this text. */
  const focus = (f: { top?: boolean; text?: string }) => { focusAsk.current = f; };

  const load = useCallback(async (id?: string) => {
    setErr("");
    try {
      let r = await api<Status & { error?: string }>(`/api/site/status?full=1${id ? `&card=${id}` : ""}`);
      if (!r.ok) { setErr(r.data?.error || "No internet — tap to try again"); return; }
      // A Shubhora partner's website is written into his card exactly as it shows (api/site/bake), once: then every section is his to
      // edit, like anyone's. The website does not change.
      if (r.data.hasCard && r.data.card && isShubhoraSellerCard(r.data.card) && !sellerBaked(r.data.card)) {
        const cid = (r.data as { cardId?: string }).cardId;
        const b = await api<{ ok?: boolean; baked?: boolean }>("/api/site/bake", { method: "POST", json: cid ? { card_id: cid } : {} }).catch(() => null);
        if (b?.ok && b.data.baked) {
          const r2 = await api<Status & { error?: string }>(`/api/site/status?full=1${id ? `&card=${id}` : ""}`);
          if (r2.ok) r = r2;
        }
      }
      setS(r.data);
      if (r.data.hasCard && r.data.card) { setCard(r.data.card); lastSaved.current = r.data.card; setDirty(false); touched.current.clear(); }
    } catch { setErr("No internet — tap to try again"); }
  }, []);
  // Replace, not push: Back from the login page must not land here again and bounce straight back to it.
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace("/login?next=/poster/website/edit"); return; } load(); })(); }, [router, load]);

  // The live preview: the working copy goes to localStorage, the iframe (the real website renderer) re-reads it.
  // What the window shows: this page's working copy, or a tab screen's unsaved copy with this page's own unsaved changes on it.
  /** The last place asked of the window: asked again when the window loads afresh (another page of the website). */
  const lastFocus = useRef<Record<string, unknown> | null>(null);
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; });
  /** The page of the website the window shows while the list is open ("" = Home): the "Pages" chips set it (master list #8). */
  const [viewPage, setViewPage] = useState("");
  const viewPageRef = useRef("");
  useEffect(() => { viewPageRef.current = viewPage; });
  const previewPage = sync && open ? (sync.page && sync.page !== "home" ? sync.page : "") : embedView?.page ?? (open ? "" : viewPage);
  useEffect(() => {
    const shown = embedView && card ? keepTouched(embedView.card, card, touched.current) : card;
    if (!shown) return;
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(shown)); } catch { /* full or private */ }
    try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
    // A part's screen that only says "the top" (most do) leaves the window on the section that part changes.
    const ef = open ? { ...(sync ? (sync.text || sync.alt?.length || sync.sec || sync.blk ? { text: sync.text, alt: sync.alt, sec: sync.sec, blk: sync.blk, quiet: true } : { top: true }) : embedView?.focus && !embedView.focus.top ? embedView.focus : {}), part: tab } : embedView?.focus ?? null;
    const f = focusAsk.current ?? ef ?? null; focusAsk.current = null;
    if (f) { lastFocus.current = f; try { frame.current?.contentWindow?.postMessage({ type: "preview-focus", key: PREVIEW_KEY, ...f }, window.location.origin); } catch { /* ignore */ } }
  }, [card, embedView, open, tab, sync]);

  // A part opened: the window goes to the section it changes (back to the top on the list).
  useEffect(() => {
    // With the place the part's content sits at (partPlace → sync): the part's name alone sent the window to whatever heading matched a word.
    const t = setTimeout(() => { const sy = syncRef.current; try { frame.current?.contentWindow?.postMessage({ type: "preview-focus", key: PREVIEW_KEY, ...(open ? (sy ? (sy.text || sy.alt?.length || sy.sec || sy.blk ? { text: sy.text, alt: sy.alt, sec: sy.sec, blk: sy.blk, part: tab } : { top: true }) : { part: tab }) : sheetFocus.current ?? { top: true }) }, window.location.origin); } catch { /* ignore */ } }, 350);
    return () => clearTimeout(t);
  }, [open, tab]);

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
  useEffect(() => {
    const el = box.current;
    const fit = () => { if (!el) return; if (el.clientWidth) { setScale(Math.min(1, el.clientWidth / 1280)); setBoxW(el.clientWidth); } if (el.clientHeight) setBoxH(el.clientHeight); };
    fit();
    const ro = el && "ResizeObserver" in window ? new ResizeObserver(fit) : null;
    if (el) ro?.observe(el);
    window.addEventListener("resize", fit); return () => { ro?.disconnect(); window.removeEventListener("resize", fit); };
  }, [s]);
  const pvW = phoneView ? 390 : 1280;
  const pvScale = phoneView ? Math.min(1, (boxW || 390) / 390) : scale;
  const frameH = Math.round(boxH / pvScale);

  // Closing the tab or reloading with a change not saved: the browser asks first (owner, 26 Oct 2026: "bina save kiye kaam na khoye").
  useEffect(() => {
    if (!dirty && !embedDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, embedDirty]);
  // A ✏️ tapped in the preview opens that part (owner, 25 Oct 2026: "preview par tap karke edit").
  const tapState = useRef({ card, embedDirty, hi });
  useEffect(() => { tapState.current = { card, embedDirty, hi }; });
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { type?: string; key?: string; target?: { kind: string; blockId?: string; text?: string; sec?: string } } | null;
      const now = tapState.current;
      if (e.origin !== window.location.origin || d?.type !== "preview-edit" || d.key !== PREVIEW_KEY || !d.target || !now.card) return;
      const p = partFor(now.card, d.target, true);
      const key = p.key as Tab;
      if (now.embedDirty && !window.confirm(now.hi ? "बदलाव save नहीं हुआ। छोड़ दें?" : "Your change is not saved. Leave it?")) return;
      // A part of a Premium home page: its sheet (layout, words, photo) instead of going straight into one screen.
      const sec = d.target.sec ?? "", rows = homeRowsRef.current;
      // (only on the Home page: another page's "About" is not the Home page's part)
      const row = viewPageRef.current ? undefined : (d.target.blockId ? rows.find((r) => r.blk === d.target!.blockId) : undefined) ?? (sec ? rows.find((r) => r.sec === sec && !r.blk) ?? rows.find((r) => r.sec === sec) : undefined);
      if (row) {
        setEmbedDirty(false); setEmbedView(null); setOpen(false); pin.current = null;
        sheetFocus.current = rowFocus(row); setSheet({ id: row.id });
        window.scrollTo({ top: 0 });
        return;
      }
      setEmbedDirty(false); setEmbedView(null); setAtBlock(p.blockId ?? ""); setGroup(TAB_GROUP[key] ?? "content"); setTab(key); setOpen(true); window.scrollTo({ top: 0 });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const site = card?.site ?? { enabled: true };
  const style: SiteStyle = site.style ?? {};
  const set = (patch: Partial<Card["site"] & object>) => { if (!card) return; Object.keys(patch).forEach((k) => touched.current.add(k)); setNote((n) => (n?.k === "save" ? null : n)); setCard({ ...card, site: { ...(card.site ?? { enabled: true }), ...patch } }); setDirty(true); };
  const setStyle = (patch: Partial<SiteStyle>) => { focus({ top: true }); set({ style: { ...style, ...patch } }); };
  // A picture chosen for the top of the website is the website's own banner (site.bannerUrl): the preview shows it at once, the card's cover stays.
  /** "Keep in view" on a banner (i = which sliding banner; -1 = the one banner): the owner's pick, or back to automatic (read again on Save). */
  const keepBanner = (i: number, f: string) => {
    const h = site.hero ?? { headline: "", sub: "" };
    if (i >= 0) { setHero({ slides: (h.slides ?? []).map((x, j) => (j !== i ? x : f ? { ...x, focus: f, focusOwn: true } : { ...x, focus: undefined, focusOwn: undefined })) }); return; }
    touched.current.add("heroFocus");
    setHero(f ? { focus: f, focusOwn: true } : { focusOwn: false });
  };
  const setHero = (patch: Partial<Hero>) => { focus({ top: true }); set({ hero: { headline: "", sub: "", ...(site.hero ?? {}), ...patch }, ...(typeof patch.imageUrl === "string" ? { bannerUrl: patch.imageUrl || undefined } : {}) }); };
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
  const storeDesign = !!adv && typeof adv.seed === "string" && /\|fix:bridal-(couture-house|lookbook)/.test(adv.seed);
  // The Premium home page, top to bottom, as the website draws it (its design owns the order — the sections of "Text & pages" feed it but do
  // not order it; owner, 19 Nov 2026: "right side ka sequence screen jaisa nahi hai"). Only the sections that have something to show.
  // Where each design section is REALLY drawn — the first page that draws it, Home first, read with the renderer's own rule (flowParts:
  // a hidden section, an empty one, a gallery of more than nine photos or more than eight questions is NOT a design section). The list
  // of "Section designs" shows exactly these (owner, 25 Nov 2026: "aisa na ho ki section page par na ho tab bhi dikh raha ho, aur aisa
  // na ho ki section ho aur dikh hi na raha ho"): before this it listed every kind the card had words for, drawn or not.
  const drawnAt = useMemo(() => {
    const m = new Map<SectionKey, { slug: string; blk: string; name: string; on: string[]; list: boolean }>();
    if (!adv || storeDesign || !card) return m;
    const lang = card.language === "hi" ? "hi" : "en";
    const dc = isShubhoraSellerCard(card) ? withoutFreeCard(card, true) : card;
    const c = buildContent(dc, lang);
    const hasContact = card.links.some((l) => l.type === "phone" || l.type === "whatsapp");
    const homeSl = homeSlugOf(dc), off = new Set(dc.site?.hidden ?? []);
    const live = dc.pages.filter((p) => !p.hidden && !off.has(p.slug));
    for (const p of [...live.filter((x) => x.slug === homeSl), ...live.filter((x) => x.slug !== homeSl)]) {
      for (const part of flowParts(dc, p, c, lang, hasContact)) {
        if (!part.key) continue;
        // Every page that draws it is named under it ("On: Home · Photos"): one design, all its places. A product or service list on
        // a page of its own is drawn as that page's catalogue (flow.tsx), which takes only the broad look of the design (page-parts layoutFor).
        const label = p.slug === homeSl ? "Home" : (p.label || p.slug);
        const list = p.slug !== homeSl && (part.b.kind === "product" || (part.b.kind === "services" && part.key === "services"));
        const had = m.get(part.key);
        if (had) { if (!had.on.includes(label)) had.on.push(label); continue; }
        m.set(part.key, { slug: p.slug, blk: part.b.id, name: "title" in part.b ? (part.b.title ?? "").trim() : "", on: [label], list });
      }
    }
    return m;
  }, [adv, storeDesign, card]);
  const advRows = useMemo(() => {
    if (!adv || storeDesign || !card) return [] as { key: SectionKey; name: string; fixed: boolean }[];
    const c = buildContent(card, card.language === "hi" ? "hi" : "en");
    const hasContact = card.links.some((l) => l.type === "phone" || l.type === "whatsapp");
    const blocks = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);
    const titleOf = (...kinds: string[]) => (blocks.find((b) => kinds.includes(b.kind) && (b.title ?? "").trim())?.title ?? "").trim();
    const names: Record<string, [string, string]> = {
      hero: ["Home banner", "Home banner"], trust: ["Key points strip", "खास बातों की पट्टी"],
      about: [titleOf("about") || "About", titleOf("about") || "हमारे बारे में"], services: [titleOf("services", "product") || "Services / products", titleOf("services", "product") || "Services / products"],
      gallery: [titleOf("gallery", "image", "carousel") || "Photos", titleOf("gallery", "image", "carousel") || "Photos"], proof: [titleOf("testimonials") || "Customer reviews", titleOf("testimonials") || "Customer reviews"],
      process: ["Step by step", "Step by step"], faq: [titleOf("faq") || "Questions", titleOf("faq") || "सवाल-जवाब"],
      visit: ["Visit us (address, map, timings)", "पता, map और समय"], cta: ["Contact strip", "Contact पट्टी (WhatsApp / Call)"], footer: ["Footer", "सबसे नीचे"],
    };
    const always = new Set<SectionKey>(["hero", "trust", "cta", "footer"]);
    return repairOrder(adv.order).filter((k) => (always.has(k) ? sectionHasContent(k, c, hasContact) : drawnAt.has(k)))
      .map((k) => ({ key: k, name: (!always.has(k) && k !== "visit" && k !== "process" && drawnAt.get(k)?.name) || (names[k] ?? [k, k])[hi ? 1 : 0], fixed: k === "hero" || k === "footer" }));
  }, [adv, storeDesign, card, hi, drawnAt]);
  // "Build your own design" (owner, 24 Nov 2026): each part of the home page can wear any of its layouts, so the owner can take the
  // top of one design, the About of another, the footer of a third. The designs of the "choose" screen are read once, only to
  // say which design uses which layout ("Design 2").
  // The home page exactly as the website draws it (site-adv/index.tsx): the top, the key points, the Home page's own sections in the
  // owner's order, the contact strip, the bottom. The sheet and "check my website" walk these.
  const homeRows = useMemo(() => {
    if (!adv || storeDesign || !card) return [] as HomeRow[];
    const lang = card.language === "hi" ? "hi" : "en";
    // A Shubhora partner's home is drawn with the company's sections, headings and order (lib/shubhora-page.ts): the list shows that.
    const dc = isShubhoraSellerCard(card) ? withoutFreeCard(card, true) : card;
    const c = buildContent(dc, lang);
    const hasContact = card.links.some((l) => l.type === "phone" || l.type === "whatsapp");
    const nm = (k: SectionKey) => advRows.find((r) => r.key === k)?.name ?? k;
    // The page picked above the preview (owner, 24 Nov 2026: "section sirf home ka hai ya sabhi pages ka?" — every page's).
    const homeSl = homeSlugOf(dc);
    const slug = viewPage && dc.pages.some((p) => p.slug === viewPage) ? viewPage : homeSl;
    const onHome = slug === homeSl;
    const hp = dc.pages.find((p) => p.slug === slug);
    const rows: HomeRow[] = onHome
      ? [{ id: "hero", sec: "hero", ic: "hero", name: nm("hero"), kind: "Heading and photos · always on top" }]
      : [{ id: "masthead", sec: null, ic: "masthead", name: "Page heading", kind: "Page name and photo · always on top" }];
    if (onHome && sectionHasContent("trust", c, hasContact)) rows.push({ id: "trust", sec: "trust", ic: "trust", name: nm("trust"), kind: "Key figures · fixed position" });
    // A section the website adds by itself (the plans copy, the Google check) is not one of the owner's: fixed, no Move or Hide.
    const stored = new Set((card.pages.find((p) => p.slug === slug)?.blocks ?? []).map((b) => b.id));
    if (hp) for (const p of flowParts(dc, hp, c, lang, hasContact)) rows.push({ id: p.b.id, sec: p.key, ic: p.b.kind, kind: kindLine(p.b), ...(stored.has(p.b.id) ? { blk: p.b.id } : {}), name: ("title" in p.b ? (p.b.title ?? "").trim() : "") || (p.b.kind === "story" && p.b.style === "stats" ? "Key figures" : "") || (p.b.kind === "cta" && (p.b.joinLabel ?? "").trim() ? `${hi ? "बटन" : "Button"}: ${p.b.joinLabel.trim()}` : "") || (p.key ? nm(p.key) : sectionLabel({ key: p.b.id, kind: "block", block: p.b } as Parameters<typeof sectionLabel>[0], card.language)) });
    if (sectionHasContent("cta", c, hasContact)) rows.push({ id: "cta", sec: "cta", ic: "cta", name: nm("cta"), kind: "WhatsApp and Call · fixed position" });
    rows.push({ id: "footer", sec: "footer", ic: "footer", name: nm("footer"), kind: "Address and links · always at the bottom" });
    return rows;
  }, [adv, storeDesign, card, advRows, hi, viewPage]);
  /** The page whose sections the list shows, and its name. */
  const curSlug = card ? (viewPage && card.pages.some((p) => p.slug === viewPage) ? viewPage : homeSlugOf(card)) : "home";
  const curName = card?.pages.find((p) => p.slug === curSlug)?.label || "Home";
  useEffect(() => { homeRowsRef.current = homeRows; }, [homeRows]);
  const haveCard = !!card;
  useEffect(() => {
    const el = topBar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [haveCard]);
  /** The Home page's sections the owner hid: listed so each can be shown again. */
  const hiddenHome = useMemo(() => {
    if (!adv || storeDesign || !card) return [] as { id: string; name: string }[];
    const hid = new Set(card.site?.home?.hidden ?? []);
    const sl = viewPage && card.pages.some((p) => p.slug === viewPage) ? viewPage : homeSlugOf(card);
    const hp = card.pages.find((p) => p.slug === sl);
    return (hp?.blocks ?? []).filter((b) => hid.has(b.id) && !isEmptyBlock(b)).map((b) => ({ id: b.id, name: ("title" in b ? (b.title ?? "").trim() : "") || sectionLabel({ key: b.id, kind: "block", block: b } as Parameters<typeof sectionLabel>[0], card.language) }));
  }, [adv, storeDesign, card, viewPage]);
  const [mixDesigns, setMixDesigns] = useState<{ hero?: string; sections?: Record<string, string> }[] | null>(null);
  const mixCardId = s?.hasCard ? s.cardId : undefined;
  useEffect(() => {
    if ((tab !== "look" && !sheet) || !adv || storeDesign || mixDesigns || !mixCardId) return;
    let live = true;
    void api<{ designs?: { spec?: { seed?: string; hero?: string; sections?: Record<string, string> } }[] }>("/api/card/advanced", { method: "POST", json: { cardId: mixCardId, more: true } }).then((r) => {
      if (!live) return;
      const all = r.ok && r.data.designs?.length ? r.data.designs : [];
      // The same twelve (a trade's finished templates) or six, in the same order, as the "choose a design" screen numbers them.
      const fixed = all.filter((d) => String(d.spec?.seed ?? "").includes("|fix:"));
      setMixDesigns((fixed.length ? fixed.slice(0, 12) : all.slice(0, 12)).map((d) => ({ hero: d.spec?.hero, sections: d.spec?.sections ?? {} })));
    }).catch(() => { if (live) setMixDesigns([]); });
    return () => { live = false; };
  }, [tab, sheet, adv, storeDesign, mixDesigns, mixCardId]);
  // A layout tried in "build your own" is only shown in the window: it goes live when the owner presses Save (owner, 24 Nov 2026:
  // "save ka button laga do"), so trying ten layouts does not change the live website ten times. Everything else on this screen
  // still saves by itself.
  const [mixHeld, setMixHeld] = useState(false);
  // A layout a part wore once (the saved one, or one tried) stays a choice when another is tried (owner, 24 Nov 2026: the first one
  // went grey after picking a second, and there was no way back to it).
  const [mixSeen, setMixSeen] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState<Record<string, boolean>>({});
  const [need, setNeed] = useState<{ k: string; id: string } | null>(null);
  const remember = (k: string, id: string) => { if (id) setMixSeen((s0) => (s0.has(`${k}:${id}`) ? s0 : new Set(s0).add(`${k}:${id}`))); };
  // After a Save: "your website is live" with its link, a QR and a WhatsApp share (master list #14).
  const [liveBox, setLiveBox] = useState(false);
  const [liveQr, setLiveQr] = useState("");
  const [liveCopied, setLiveCopied] = useState(false);
  const mixBox = useRef<HTMLDivElement>(null);
  const [mixJump, setMixJump] = useState(false);
  useEffect(() => { if (!mixJump || tab !== "look" || !open) return; const t = setTimeout(() => { mixBox.current?.scrollIntoView({ behavior: "smooth", block: "start" }); setMixJump(false); }, 500); return () => clearTimeout(t); }, [mixJump, tab, open]);
  const mixHold = useRef(false);
  const mixAllow = useMemo(() => (card ? allowedByFit(fitOf(card)) : () => true), [card]);
  const [advDrag, setAdvDrag] = useState("");
  const [advOver, setAdvOver] = useState("");
  /** Moves one Premium section to another's place; shown in the window at once and saved by itself a moment later. */
  function moveAdv(from: SectionKey, to: SectionKey) {
    if (!adv || from === to) return;
    const all: SectionKey[] = repairOrder(adv.order).filter((k) => k !== "hero" && k !== "footer");
    const i = all.indexOf(from), j = all.indexOf(to);
    if (i < 0 || j < 0) return;
    all.splice(i, 1); all.splice(j, 0, from);
    advOrderTouched.current = true;
    setAdv({ order: ["hero", ...all, "footer"] });
    focusAsk.current = { sec: from };   // the window follows the section that was moved
    setSync({ text: "", page: "home" });
  }
  /** A row tapped: the window above shows that part of the website (owner, 19 Nov 2026). */
  // The window may be on another page (About, Plans…): it comes back to Home first, then goes to the part.
  /** Show a section in the window, on the page where the website really draws it (drawnAt): the gallery on its own page, the address
   *  on Contact, the questions on FAQ. Asked for on Home, the window found nothing there and jumped to the top or did not move at all
   *  (owner, 25 Nov 2026: "Real screens par click karne se screen top me chali jaati hai… ye kaam nahi kar raha"). */
  const showAdv = (k: SectionKey) => {
    const at = drawnAt.get(k);
    const f = k === "hero" ? { top: true } : at ? { blk: at.blk, sec: k } : { sec: k };
    const page = card && at && at.slug !== homeSlugOf(card) ? at.slug : "home";
    focusAsk.current = f; lastFocus.current = f; setSync({ text: "", page });
  };
  // The order of the home page is now the Home page's own sections (Text & pages → Home): this panel is not drawn any more.
  void showAdv;
  const advOrderPanel = advRows.length > 2 && (
    <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
      <p className="text-sm font-semibold">{hi ? "Home page का क्रम — जैसा website पर है" : "Order of your home page — as it is on the website"}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hi ? "नाम पर tap करें तो website का वही हिस्सा दिखेगा। खींचकर या तीर से ऊपर-नीचे करें — अपने-आप save होता है।" : "Tap a name to see that part on the website. Drag a row, or use the arrows, to move it — it saves by itself."}</p>
      <ul className="mt-2 space-y-1.5">
        {advRows.map((r, i) => {
          const prev = advRows[i - 1], next = advRows[i + 1];
          return (
            <li key={r.key} data-advk={r.key} draggable={!r.fixed}
              onDragStart={(e) => { setAdvDrag(r.key); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.key); } catch { /* ignore */ } }}
              onDragOver={(e) => { if (advDrag && !r.fixed && advDrag !== r.key) { e.preventDefault(); setAdvOver(r.key); } }}
              onDragEnd={() => { setAdvDrag(""); setAdvOver(""); }}
              onDrop={(e) => { e.preventDefault(); const f = advDrag as SectionKey; setAdvDrag(""); setAdvOver(""); if (f && !r.fixed) moveAdv(f, r.key); }}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${r.fixed ? "border-border bg-surface2 text-muted" : "cursor-grab border-border bg-surface active:cursor-grabbing"} ${advDrag === r.key ? "opacity-40" : ""} ${advOver === r.key ? "ring-2 ring-brand/40" : ""}`}>
              {/* A finger on the number moves the row on a phone (there is no mouse drag there): the row under the finger is where it lands. */}
              <span className={`min-w-6 shrink-0 select-none rounded text-center text-[11px] font-bold text-muted ${r.fixed ? "" : "bg-surface2 px-0.5 py-1"}`} style={r.fixed ? undefined : { touchAction: "none" }}
                onTouchStart={() => { if (!r.fixed) setAdvDrag(r.key); }}
                onTouchMove={(e) => { const t = e.touches[0]; if (!t || !advDrag) return; const row = (document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-advk]"); const k = row?.dataset.advk ?? ""; if (k && k !== "hero" && k !== "footer") setAdvOver(k); }}
                onTouchEnd={() => { const f = advDrag as SectionKey, to = advOver as SectionKey; setAdvDrag(""); setAdvOver(""); if (f && to) moveAdv(f, to); }}>{r.fixed ? i + 1 : `⇅ ${i + 1}`}</span>
              <button type="button" onClick={() => showAdv(r.key)} title={hi ? "Website पर यह हिस्सा दिखाएँ" : "Show this part on the website"} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-brand-ink">{r.name}</button>
              {r.fixed ? <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">{hi ? "🔒 यहीं रहता है" : "🔒 stays here"}</span> : (<>
                <button type="button" onClick={() => prev && !prev.fixed && moveAdv(r.key, prev.key)} disabled={!prev || prev.fixed} className="rounded p-1 text-muted disabled:opacity-30" aria-label="Up"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => next && !next.fixed && moveAdv(r.key, next.key)} disabled={!next || next.fixed} className="rounded p-1 text-muted disabled:opacity-30" aria-label="Down"><ChevronDown className="h-4 w-4" /></button>
              </>)}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">{hi ? "शब्द और photo बदलने के लिए नीचे उस हिस्से को खोलें।" : "To change the words and photos, open that section below."}</p>
    </section>
  );
  void advOrderPanel;
  const paletteKey = adv ? (adv.palette?.key && (adv.palette.key === "brand" || SITE_PALETTES.some((p) => p.key === adv.palette?.key)) ? adv.palette.key : "brand")
    : style.palette && SITE_PALETTES.some((p) => p.key === style.palette) ? style.palette : "brand";
  /** A change to the Premium design itself (fonts, the top, corners): shown in the window at once, saved with Save like the rest. */
  const setAdv = (patch: Record<string, unknown>) => { if (!adv) return; focus({ top: true }); set({ advanced: { ...adv, ...patch } as NonNullable<Card["site"]>["advanced"] }); };
  /** One part of the home page takes another layout; the window moves to that part so the change is seen. */
  const setAdvSection = (k: SectionKey, id: string) => { if (!adv || k === "hero") return; remember(k, (adv.sections as Record<string, string> | undefined)?.[k] ?? VARIANT_IDS[k][0]); mixHold.current = true; setMixHeld(true); set({ advanced: { ...adv, sections: { ...((adv.sections as Record<string, string> | undefined) ?? {}), [k]: id } } as NonNullable<Card["site"]>["advanced"] }); showAdv(k); };
  /** Which screen holds the words of a part of the home page (and the section inside "Text & pages", when it is one of those). */
  const sheetWords = (sec: SectionKey): { key: string; blockId?: string } => {
    const all = card ? card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).filter((b) => !isEmptyBlock(b)) : [];
    const blk = (...kinds: string[]) => all.find((b) => kinds.includes(b.kind));
    if (sec === "hero") return { key: "hero" };
    if (sec === "about") return { key: "about" };
    if (sec === "services") return { key: blk("product", "table") ? "products" : "details" };
    if (sec === "gallery") return { key: "photos" };
    if (sec === "proof") return { key: "reviews" };
    if (sec === "visit" || sec === "footer") return { key: "where" };
    if (sec === "cta") return { key: "buttons" };
    if (sec === "trust") return { key: "home" };
    const b = sec === "faq" ? blk("faq") : undefined;
    return { key: "text", ...(b ? { blockId: b.id } : {}) };
  };
  /** Which screen holds the photo of a part (none: the part has no photo of its own). */
  const SHEET_PHOTO: Partial<Record<SectionKey, string>> = { hero: "photos", about: "about", gallery: "photos", services: "products" };
  const sheetGo = (i: number) => { const r = homeRows[i]; if (!r) return; const f = rowFocus(r); sheetFocus.current = f; setSheet({ id: r.id }); focusAsk.current = f; lastFocus.current = f; setSync({ text: "", page: "home" }); window.scrollTo({ top: 0 }); };
  /** Hides one of the Home page's sections (it stays stored) or shows it again; goes to the website with Save. */
  function hideHomeBlock(id: string, hide: boolean) {
    const h = new Set(site.home?.hidden ?? []);
    if (hide) h.add(id); else h.delete(id);
    if (hide && sheet) {
      // Hidden from a section's sheet: the sheet goes on to the section that takes its place. From the list, the list stays as it is.
      const i = homeRows.findIndex((r) => r.id === id), next = homeRows[i + 1] ?? homeRows[i - 1];
      const f = next ? rowFocus(next) : { top: true };
      sheetFocus.current = next ? f : null; focusAsk.current = f; lastFocus.current = f; setSheet(next ? { id: next.id } : null);
    } else if (!hide) { const f = { blk: id }; focusAsk.current = f; lastFocus.current = f; }
    setHome({ hidden: [...h] });
  }
  const sheetClose = () => { sheetFocus.current = null; setSheet(null); focus({ top: true }); setSync({ text: "", page: "home" }); };
  /** One of the Home page's own sections changes place with the one above / below it; goes to the website with Save. */
  /** The top of a page other than Home (its name, photo, line and shape): changed in the "Page heading" sheet, shown in the window at
   *  once, kept by the one Save (owner, 25 Nov 2026: the Edit on this row used to open the list of all pages and nothing for the photo). */
  function setHead(slug: string, patch: Partial<NonNullable<CardPage["head"]>> & { label?: string }) {
    if (!card) return;
    const { label, ...h } = patch;
    touched.current.add(`head:${slug}`); setNote((n) => (n?.k === "save" ? null : n));
    setCard({ ...card, pages: card.pages.map((p) => (p.slug === slug ? { ...p, ...(label !== undefined ? { label } : {}), head: { ...(p.head ?? {}), ...h } } : p)) }); setDirty(true);
  }
  function moveHomeBlock(id: string, dir: -1 | 1) {
    if (!card) return;
    const slug = curSlug, hp = card.pages.find((p) => p.slug === slug);
    const onHome = slug === homeSlugOf(card);
    const own = homeRows.filter((r) => r.blk), i = own.findIndex((r) => r.blk === id), other = own[i + dir];
    if (!hp || i < 0 || !other) return;
    // The order as the website draws it, with the two swapped, becomes the page's order (a partner's home was re-sorted when drawn).
    const ids = own.map((r) => r.blk!); [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    const pos = new Map(ids.map((x, n) => [x, n]));
    const named = hp.blocks.filter((b) => pos.has(b.id)).sort((x, y) => pos.get(x.id)! - pos.get(y.id)!);
    const rest = hp.blocks.filter((b) => !pos.has(b.id));
    const blocks = [...named, ...rest];
    touched.current.add(onHome ? "homeBlocks" : `order:${slug}`); setNote((n) => (n?.k === "save" ? null : n));
    const f = { blk: id }; sheetFocus.current = f; focusAsk.current = f; lastFocus.current = f;
    // Asked again once the window has drawn the new order (the first ask can land before it).
    setTimeout(() => { try { frame.current?.contentWindow?.postMessage({ type: "preview-focus", key: PREVIEW_KEY, ...f }, window.location.origin); } catch { /* ignore */ } }, 700);
    setCard({ ...card, ...(onHome ? { site: { ...(card.site ?? { enabled: true }), homeOwnOrder: true } as Card["site"] } : {}), pages: card.pages.map((p) => (p === hp ? { ...hp, blocks } : p)) }); setDirty(true);
  }
  const pickHero = (id: string) => { remember("hero", String(adv?.hero ?? "")); setAdv({ hero: id }); };
  /** The designs of one section, the way a professional editor offers them (owner, 24 Nov 2026: "har category me alag ho sakti hai"):
   *  first the ones the business's own 12 designs use ("Recommended for your business"), the rest folded under "More designs", and the
   *  few made for another kind of business (a menu, a rate list, plans) left out unless one is in use. A design that needs more (a banner
   *  photo, product photos) says what and opens the place to add it, instead of sitting greyed out. */
  const layoutPicker = (k: SectionKey, cur: string, onPick: (id: string) => void) => {
    const all: readonly string[] = k === "hero" ? HERO_IDS : (VARIANT_IDS as Record<string, readonly string[]>)[k] ?? [];
    const rec = new Set((mixDesigns ?? []).map((d) => (k === "hero" ? d.hero : d.sections?.[k] ?? all[0])).filter((x): x is string => !!x));
    const okOf = (id: string) => mixAllow(k, id) || cur === id || mixSeen.has(`${k}:${id}`);
    // A menu, a rate list or plans side by side belong to their own trades — even when one of this trade's 12 designs happens to use
    // one (a mobile shop was offered "Plans side by side" and "Trader's rate list", 24 Nov 2026).
    const trade = card ? groupOfCard(card) : "general";
    const otherTrade = (id: string) => !tradeAllows(trade, k, id) && cur !== id;
    const main = rec.size ? all.filter((id) => (rec.has(id) && !otherTrade(id)) || id === cur) : all.filter((id) => !otherTrade(id));
    const more = rec.size ? all.filter((id) => !main.includes(id) && !otherTrade(id)) : [];
    const open = !!moreOpen[k];
    const name = (id: string) => (k === "hero" ? (ADV_HERO_NAMES[id] ?? [id, id])[0] : variantName(k, id, false));
    const btn = (id: string) => {
      const ok = okOf(id);
      // A sketch of the layout with its name under it (owner, 24 Nov 2026: a picture instead of a name).
      return <button key={id} type="button" aria-pressed={cur === id} title={ok ? name(id) : "Needs a little more — tap to see"} onClick={() => { if (ok) { setNeed(null); onPick(id); } else setNeed({ k, id }); }}
        className={`relative flex flex-col overflow-hidden rounded-xl border bg-surface text-left shadow-[0_1px_2px_rgba(16,24,40,0.06),0_6px_14px_-8px_rgba(16,24,40,0.18)] transition ${cur === id ? "border-brand ring-2 ring-brand/30" : ok ? "border-border hover:border-brand/50" : "border-dashed border-border opacity-60 hover:opacity-100"}`}>
        <LayoutThumb k={k} id={id} />
        {cur === id && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-white"><Check className="h-3 w-3" /></span>}
        {!ok && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-surface text-muted"><Plus className="h-3 w-3" /></span>}
        <span className={`line-clamp-2 px-1.5 py-1 text-[10.5px] font-medium leading-tight ${cur === id ? "text-brand-ink" : "text-ink"}`}>{name(id)}</span></button>;
    };
    const nd = need && need.k === k ? needOf(k, need.id) : null;
    return (
      <div className="space-y-2">
        {rec.size > 0 && <p className="text-[11px] font-semibold text-muted">Recommended for your business</p>}
        <div className="grid grid-cols-3 gap-2">{main.map(btn)}</div>
        {nd && <div className="flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2"><span className="min-w-0 flex-1 text-[12px] text-muted">{nd.text}</span><button type="button" onClick={() => { setNeed(null); openPart(nd.part); }} className={TBW}><Plus className="h-3.5 w-3.5" /> {nd.btn}</button></div>}
        {more.length > 0 && <button type="button" onClick={() => setMoreOpen((m) => ({ ...m, [k]: !m[k] }))} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-ink"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> {open ? "Fewer designs" : `More designs (${more.length})`}</button>}
        {open && <div className="grid grid-cols-3 gap-2">{more.map(btn)}</div>}
      </div>
    );
  };
  const sheetLayout = (k: SectionKey, id: string) => { if (k === "hero") pickHero(id); else setAdvSection(k, id); };
  const sheetOpen = (key: string, blockId?: string) => {
    openPart(key); if (blockId) setAtBlock(blockId);
    if (key === "text" && blockId === "__add") { setSync({ text: "", page: curSlug }); return; }
    // Opened from a section's sheet: the window stays on THAT section, on its page (owner, 25 Nov 2026: Contact strip → Edit, and the
    // window jumped to the Home banner because the part's own rule looked for a heading of its kind on Home).
    const f = sheetFocus.current;
    if (sheet && f && !f.top && (f.sec || f.blk)) {
      const sy = { text: "", page: curSlug, ...(f.sec ? { sec: f.sec } : {}), ...(f.blk ? { blk: f.blk } : {}) };
      // eslint-disable-next-line react-hooks/purity -- runs on the tap (sheetOpen is a handler), never while drawing
      pin.current = { sync: sy, at: Date.now() }; setSync(sy);
    } else pin.current = null;
  };
  /** The Premium page's background: light paper or dark (a dark page drops the ivory-paper "luxe" flag). */
  function setTone(t: "light" | "dark") {
    if (!adv) return;
    const { luxe: _l, ...rest } = (adv.palette ?? {}) as { luxe?: boolean } & Record<string, unknown>; void _l;
    setAdv({ palette: t === "dark" ? { ...rest, tone: "dark" } : { ...(adv.palette ?? {}), tone: "light" } });
  }
  const pickColour = (key: string, color?: string) => {
    focus({ top: true });
    const nextStyle = { ...style, palette: key, ...(color !== undefined ? { color } : {}) };
    if (adv) set({ style: nextStyle, advanced: { ...adv, palette: { ...(adv.palette ?? {}), own: true, key, ...(key === "brand" ? { color: color ?? style.color ?? card?.themeColor } : {}) } } as NonNullable<Card["site"]>["advanced"] });
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

  async function save(from?: Card) {
    if (!card || !s?.hasCard) return;
    const c = from ? { ...card, site: from.site } : card;
    const site = c.site ?? { enabled: true };
    const adv = (site as { advancedOn?: boolean }).advancedOn !== false && site.advanced ? site.advanced as { palette?: { key?: string; color?: string } } & Record<string, unknown> : null;
    const before = lastSaved.current;
    setBusy("save"); setNote(null); setUndo(null);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/site/status", { method: "PATCH", json: {
        card_id: s.cardId,
        style: site.style ?? {},
        home: { order: site.home?.order ?? [], hidden: site.home?.hidden ?? [], ...(site.home?.stats ? { stats: site.home.stats } : {}) },
        hero: { headline: site.hero?.headline ?? "", sub: site.hero?.sub ?? "", ctaLabel: site.hero?.ctaLabel ?? "", ...(site.hero?.imageUrl !== undefined ? { imageUrl: site.hero.imageUrl } : {}), ...(site.hero?.slides ? { slides: site.hero.slides.filter((x) => x.headline.trim()) } : {}), ...(touched.current.has("heroFocus") ? (site.hero?.focusOwn ? { focus: site.hero.focus ?? "", focusOwn: true } : { focusOwn: false }) : {}) },
        hideProfile: !!site.hideProfile,
        showcase: (site as { showcase?: boolean }).showcase === true,
        logoUrl: site.logoUrl ?? "",
        hidden: site.hidden ?? [],
        bar: site.bar?.text?.trim() ? { text: site.bar.text.trim(), link: site.bar.link ?? "", until: site.bar.until ?? "" } : null,
        float: site.float ?? "whatsapp",
        // The order of the Home page's own sections (moved from a part's sheet); an Undo sends the earlier order back.
        ...(() => {
          const src = from ?? card;
          const sl = from ? src.pages.map((p) => p.slug) : [...touched.current].filter((k) => k.startsWith("order:")).map((k) => k.slice(6));
          const po = Object.fromEntries(sl.filter((x) => x !== homeSlugOf(src)).map((x) => [x, (src.pages.find((p) => p.slug === x)?.blocks ?? []).map((b) => b.id)]));
          return Object.keys(po).length ? { pageOrders: po } : {};
        })(),
        // The tops of the pages that were changed (Page heading): name, photo, line and shape, page by page.
        ...(() => {
          if (from) return {};
          const sl = [...touched.current].filter((k) => k.startsWith("head:")).map((k) => k.slice(5));
          const ph = Object.fromEntries(sl.map((x) => { const p = card.pages.find((q) => q.slug === x); return [x, { ...(p?.label?.trim() ? { label: p.label.trim() } : {}), ...(p?.head ?? {}) }]; }));
          return sl.length ? { pageHeads: ph } : {};
        })(),
        ...(from || touched.current.has("homeBlocks") ? { homeBlocks: ((from ?? card).pages.find((p) => p.slug === homeSlugOf(from ?? card))?.blocks ?? []).map((b) => b.id) } : {}),
        ...(adv?.palette?.key ? { advancedPalette: { key: adv.palette.key, ...(adv.palette.color ? { color: adv.palette.color } : {}), ...((adv.palette as { own?: boolean }).own ? { own: true } : {}) } } : {}),
        ...(adv ? { advancedLook: { heading: (adv.fonts as { heading?: string } | undefined)?.heading, hero: adv.hero, shape: adv.shape, tone: (adv.palette as { tone?: string } | undefined)?.tone, ...((adv.palette as { corners?: boolean } | undefined)?.corners ? { corners: true } : {}), ...(Array.isArray(adv.order) ? { order: adv.order as string[] } : {}), ...(adv.sections && typeof adv.sections === "object" ? { sections: adv.sections as Record<string, string> } : {}) } } : {}),
      } });
      if (!r.ok) { say("save", r.data.error ?? (hi ? "Save नहीं हुआ। दोबारा try करें।" : "Could not save.")); return; }
      setDirty(false); touched.current.clear(); lastSaved.current = c; setHistReset((n) => n + 1); mixHold.current = false; setMixHeld(false);
      if (from) { setCard((cur) => (cur ? { ...cur, site: from.site, pages: orderHome(cur.pages, homeSlugOf(cur), (from.pages.find((p) => p.slug === homeSlugOf(from))?.blocks ?? []).map((b) => b.id)) } : from)); say("save", hi ? "↩️ पहले जैसा कर दिया।" : "↩️ Put back as it was.", false); }
      else { say("save", hi ? "✅ वेबसाइट सेव हो गई — लाइव लिंक पर दिखेगी।" : "✅ Website saved — it is live on your link.", false); if (before) setUndo(before); setLiveBox(true); setLiveQr(""); setLiveCopied(false); }
    } catch { say("save", hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again."); }
    finally { setBusy(""); }
  }
  // Letters & look and Top of page save by themselves a moment after a change (owner, 19 Nov 2026: "jo bhi edit kare saath ke saath save
  // kar de"); Undo on the bar puts the last one back. One try per change: a save that failed waits for the Save button, it is not hammered.
  // Which heading of a long part is open ("hero:2"); nothing chosen yet = the first one.
  const [foldAt, setFoldAt] = useState("");
  const foldIs = (id: string, first: boolean) => foldAt === id || (first && !foldAt.startsWith(`${id.split(":")[0]}:`));
  const foldTap = (id: string, first: boolean) => setFoldAt(foldIs(id, first) ? `${id.split(":")[0]}:none` : id);
  // One rule for the whole editor (master list #12, owner 24 Nov 2026 "do it"): a change shows in the window first and goes to
  // the real website only when Save is pressed. The two "save by itself" timers below stay in the code, switched off.
  const autoTried = useRef<Card | null>(null);
  const advOrderTouched = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!AUTO_SAVE || !dirty || !open || busy || !card || mixHold.current || (tab !== "look" && tab !== "hero" && !(advOrderTouched.current && (tab === "text" || tab === "home"))) || autoTried.current === card) return;
    const t = setTimeout(() => { autoTried.current = card; void saveRef.current(); }, tab === "hero" ? 1800 : 900);
    return () => clearTimeout(t);
  }, [dirty, open, busy, card, tab]);

  // Text & pages and Buttons (the full editor, shown inside this page) go live by themselves as well, a moment after the last change
  // (owner, 19 Nov 2026: "jo bhi changes karte hain site par live dikhne chahiye"). The forms with their own Save button are left alone.
  useEffect(() => {
    if (!AUTO_SAVE || !embedDirty || !open || (tab !== "text" && tab !== "buttons" && tab !== "pages")) return;
    const t = setTimeout(() => { setNote(null); ownAfter.current = dirty; setSaveTick((n) => n + 1); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one try per change: only a new "unsaved" from the editor starts it
  }, [embedDirty, open, tab]);

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
  async function upload(file: File | null, kind: "hero" | "logo" | "head") {
    if (!file) return; setBusy(kind); setNote(null);
    const failed = hi ? "Photo upload नहीं हुई। दोबारा try करें।" : "Could not upload the photo. Please try again.";
    try {
      const wide = kind !== "logo";
      const u = await uploadImage(await compressToFile(file, `${kind}.png`, wide ? 1400 : 800, wide ? 0.9 : 1, "png"), "logo");
      if (!u) { say(kind === "head" ? "save" : kind, failed); return; }
      if (kind === "hero") setHero({ imageUrl: u }); else if (kind === "head") setHead(curSlug, { photo: u, noPhoto: false }); else set({ logoUrl: u });
    } catch { say(kind === "head" ? "save" : kind, failed); }
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
  // Everything about the website on this one page (owner, 25 Oct 2026: "saari cheez yahi par"), in four groups. Each part says
  // what it changes and where it shows (card + website, or the website only).
  type TabDef = { key: Tab; label: string; Icon: typeof Palette; sub: string; scope: Scope };
  const RAW_GROUPS: { key: string; label: string; Icon: typeof Palette; tabs: TabDef[] }[] = [
    { key: "design", label: hi ? "डिज़ाइन" : "Design", Icon: Paintbrush, tabs: [
      { key: "look", label: hi ? "अक्षर और look" : "Letters & look", Icon: Palette, sub: hi ? "अक्षर, background, कोने — और पसंद की site का look" : "Letters, background, corners — and copy a look you like", scope: "site" },
      { key: "hero", label: hi ? "ऊपर का हिस्सा" : "Top of page", Icon: ImageIcon, sub: hi ? "बड़ी heading, banners और ऊपर की photo" : "The big heading, the banners and the top photo", scope: "site" },
    ] },
    { key: "content", label: hi ? "सामग्री" : "Content", Icon: Camera, tabs: [
      { key: "text", label: hi ? "Text और pages" : "Text & pages", Icon: FileText, sub: hi ? "किसी भी page के शब्द बदलें, नया page जोड़ें" : "Change any page's words, add a new page", scope: "both" },
      { key: "photos", label: hi ? "Photos और banner" : "Photos & banners", Icon: Camera, sub: hi ? "ऊपर के banners और photo gallery" : "Banners on top and the photo gallery", scope: "both" },
      { key: "products", label: hi ? "Products और दाम" : "Products & prices", Icon: Package, sub: hi ? "Products जोड़ें, दाम बदलें, photo लगाएँ" : "Add products, change prices, add photos", scope: "both" },
      { key: "about", label: hi ? "परिचय और logo" : "About & logo", Icon: BookUser, sub: hi ? "आपके बारे में कुछ लाइनें, logo" : "A few lines about you, your logo", scope: "both" },
      { key: "details", label: hi ? "आप क्या देते हैं" : "What you offer", Icon: ListChecks, sub: hi ? "आपका काम और लोग आपको क्यों चुनते हैं" : "Your work and why people choose you", scope: "both" },
      { key: "reviews", label: hi ? "Reviews" : "Reviews", Icon: Star, sub: hi ? "ग्राहकों के reviews और Google review link" : "Customer reviews and the Google review link", scope: "both" },
    ] },
    { key: "contact", label: hi ? "संपर्क" : "Contact", Icon: Phone, tabs: [
      { key: "you", label: hi ? "नाम, number, photo" : "Name, number, photo", Icon: User, sub: hi ? "Poster पर भी बदलेगा" : "Also changes on your posters", scope: "both" },
      { key: "where", label: hi ? "समय और पता" : "Timings & address", Icon: Clock, sub: hi ? "शहर, पता, map pin, खुलने का समय" : "City, address, map pin, opening hours", scope: "both" },
      { key: "links", label: hi ? "UPI और social" : "UPI & social", Icon: Wallet, sub: hi ? "ताकि लोग pay और follow कर सकें" : "So people can pay you and follow you", scope: "both" },
      { key: "buttons", label: hi ? "Buttons (जोड़ें / हटाएँ)" : "Buttons (add / remove)", Icon: MousePointerClick, sub: hi ? "Call, WhatsApp, Email, Map … जोड़ें, हटाएँ, क्रम बदलें" : "Call, WhatsApp, Email, Map … add, remove, reorder", scope: "both" },
    ] },
    { key: "settings", label: hi ? "Settings" : "Settings", Icon: Settings, tabs: [
      { key: "offer", label: hi ? "Offer / pop-up" : "Offer / pop-up", Icon: Megaphone, sub: hi ? "ऊपर पट्टी या pop-up: “Diwali 20% छूट”" : "A line on top or a pop-up: “Diwali 20% off”", scope: "both" },
      { key: "website", label: hi ? "Website ON/OFF और Premium" : "Website on/off & Premium", Icon: Sparkles, sub: hi ? "Computer पर website दिखे या नहीं; Premium design" : "Show the website on computers; the Premium design", scope: "site" },
      { key: "trade", label: hi ? "Business का नाम और काम" : "Business name & type", Icon: Store, sub: hi ? "आपके business का नाम और काम" : "Your business name and what you do", scope: "both" },
    ] },
    { key: "more", label: hi ? "और" : "More", Icon: Settings, tabs: [
      { key: "home", label: hi ? "हिस्से" : "Sections", Icon: ListOrdered, sub: hi ? "Home page के हिस्सों का क्रम — दिखाएँ या छुपाएँ" : "Order of the home page parts — show or hide each", scope: "site" },
      { key: "pages", label: hi ? "Pages" : "Pages", Icon: Files, sub: hi ? "Website पर कौन से pages दिखें" : "Which pages show on the website", scope: "site" },
      { key: "seo", label: hi ? "Google SEO" : "Google SEO", Icon: Search, sub: hi ? "अपने शहर में Google पर मिलें" : "Be found on Google in your city", scope: "site" },
      { key: "domain", label: hi ? "अपना web address" : "Own web address", Icon: Globe, sub: hi ? "www.yourshop.com" : "www.yourshop.com", scope: "site" },
    ] },
  ];
  // Five plain groups (master list #29, 24 Nov 2026 — https://claude.ai/artifact/UJXzJBJjKAssCmCsQGGB3u): the parts are the same,
  // only sorted by what a shop owner looks for: the design, the sections and their words, the photos, the shop's details, settings.
  // The business's own word for what it sells ("Menu", "Treatments", "Products"), as its website says it.
  const tradeWord = catalogLabel(recipeFor(card.seo?.categoryKey ?? "").catalog, "en");
  const allTabs = RAW_GROUPS.flatMap((g) => g.tabs).map((t) => (LABEL[t.key] ? { ...t, label: t.key === "products" && tradeWord ? tradeWord.charAt(0).toUpperCase() + tradeWord.slice(1) : LABEL[t.key][0], sub: t.key === "products" ? "Items, prices and their photos" : LABEL[t.key][1] } : t));
  const tabsOf = (...ks: Tab[]) => ks.map((k) => allTabs.find((t) => t.key === k)).filter((t): t is TabDef => !!t);
  const GROUPS: { key: Group; label: string; Icon: typeof Palette; tabs: TabDef[] }[] = [
    { key: "content", label: "Sections", Icon: ListOrdered, tabs: tabsOf("hero", "text", "products", "about", "details", "reviews", "photos", "home") },
    { key: "design", label: "Design", Icon: Paintbrush, tabs: tabsOf("look") },
    { key: "contact", label: "Business info", Icon: Store, tabs: tabsOf("trade", "you", "where", "links", "buttons") },
    { key: "settings", label: "Settings", Icon: Settings, tabs: tabsOf("offer", "pages", "seo", "domain", "website") },
  ];
  const TABS = GROUPS.find((g) => g.key === group)!.tabs;
  const pick = (t: Tab) => { setNote((n) => (n?.k === "save" ? n : null)); setEmbedView(null); setSync(null); setTab(t); };
  // "+ Add section": the page editor opens with its "Add section" list already open (atBlock "__add").
  const embedSrc = tab === "text" && atBlock === "__page" ? `${EMBED.text!(s.cardId)}&addpage=1` : tab === "text" && atBlock === "__add" ? `${EMBED.text!(s.cardId)}&add=${encodeURIComponent(curSlug)}` : tab === "text" && atBlock ? `${EMBED.text!(s.cardId)}&block=${encodeURIComponent(atBlock)}` : EMBED[tab]?.(s.cardId);
  const domainOk = tier === "growth" || tier === "pro";
  const siteOn = !!(s.site?.enabled ?? card.site?.enabled);
  async function setEnabled(on: boolean) {
    if (!s?.hasCard) return;
    setBusy("enabled"); setNote(null);
    try {
      const r = await api<{ error?: string }>("/api/site/status", { method: "PATCH", json: { card_id: s.cardId, enabled: on } });
      if (!r.ok) { say("ref", r.data?.error || (hi ? "Save नहीं हुआ — दोबारा try करें।" : "Could not save. Try again.")); return; }
      await refresh();
    } catch { say("ref", hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again."); }
    finally { setBusy(""); }
  }
  const customDomain = (s as { customDomain?: string }).customDomain ?? "";

  /** Back to the list of parts (asks first when the open part has a change not saved). */
  /** Open one part (from the list or a ✏️ in the preview). */
  const openPart = (key: string) => {
    embedReal.current = false;
    pin.current = null;   // sheetOpen pins again right after, when the part is opened from a section's sheet
    const g = GROUPS.find((x) => x.tabs.some((t) => t.key === key));
    if (!g) return;
    if (embedDirty && key !== tab && !window.confirm(hi ? "बदलाव save नहीं हुआ। छोड़ दें?" : "Your change is not saved. Leave it?")) return;
    setEmbedDirty(false); setAtBlock(""); setGroup(g.key); pick(key as Tab); setOpen(true); window.scrollTo({ top: 0 });
    // The window goes to what this part changes, on whichever page it lives (owner, 19 Nov 2026: Products opened and the window showed
    // another section): the first section of that kind on the card — its page, its heading, else its first line.
    const at = partPlace(key);
    if (at) setSync(at);
  };
  /** Where a part's content sits on the website: { page, text (the section's heading), alt (its first lines) }; null = leave it to the part's own rule. */
  function partPlace(key: string): { text: string; page?: string; alt?: string[]; sec?: string; blk?: string } | null {
    if (!card) return null;
    const KINDS: Record<string, string[][]> = {
      products: [["product"], ["table"], ["services"]], reviews: [["testimonials"]], about: [["about"]], details: [["services"], ["highlights"]],
      where: [["hours", "location"]], photos: [["gallery", "image", "carousel"]],
    };
    if (["you", "trade", "look", "hero", "offer", "website"].includes(key)) return { text: "", page: "home" };
    const tries = KINDS[key];
    if (!tries) return null;
    // A Premium home page has its own section for each of these (data-sec): the surest place when the page shown is Home.
    const SEC: Record<string, string> = { products: "services", details: "services", reviews: "proof", about: "about", where: "visit", photos: "gallery" };
    const pages = card.pages.filter((p) => !p.hidden && !(card.site?.hidden ?? []).includes(p.slug));
    for (const kinds of tries) for (const pg of pages) for (const b of pg.blocks) {
      if (!kinds.includes(b.kind) || isEmptyBlock(b)) continue;
      const alt: string[] = [];
      const first = "items" in b && Array.isArray(b.items) ? (b.items[0] as unknown) : null;
      if (typeof first === "string") alt.push(first);
      else if (first && typeof first === "object") { const o = first as { name?: string; q?: string; title?: string; text?: string }; for (const v of [o.name, o.q, o.title, o.text]) if (v && v.trim()) alt.push(v.trim()); }
      if (b.kind === "about" && (b.body ?? "").trim()) alt.push((b.body ?? "").trim().split(/[.\n]/)[0].slice(0, 60));
      return { blk: b.id, ...(pg.slug === "home" || !pg.slug ? { sec: SEC[key] } : {}), text: ("title" in b ? b.title ?? "" : "").trim(), page: pg.slug, alt: alt.map((x) => x.replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 60)).filter(Boolean).slice(0, 3) };
    }
    return null;
  }
  const toList = () => {
    if (embedDirty && !window.confirm(hi ? "बदलाव save नहीं हुआ। बिना save किए वापस जाएँ?" : "Your change is not saved. Go back without saving?")) return;
    setEmbedDirty(false); setEmbedView(null); setOpen(false); pin.current = null; window.scrollTo({ top: 0 });
  };
  const unsaved = dirty || embedDirty;
  /** The tab that holds what is open (a part's own screen, a section's sheet), else the one picked. */
  const curTab: RTab = open ? ({ content: "sections", design: "design", contact: "info", settings: "settings" } as Record<string, RTab>)[group] ?? rtab : sheet ? "sections" : rtab;
  const goTab = (k: RTab) => {
    if (open) {
      if (embedDirty && !window.confirm("Your change is not saved. Go back without saving?")) return;
      setEmbedDirty(false); setEmbedView(null); setOpen(false); pin.current = null;
    }
    if (sheet) { sheetFocus.current = null; setSheet(null); }
    setRtab(k); window.scrollTo({ top: 0 });
  };
  const liveUrl = `${s.url}?view=site`;
  const doSave = () => { if (embedDirty) { setNote(null); ownAfter.current = dirty; setSaveTick((n) => n + 1); } else if (dirty) void save(); };
  const doBack = () => {
    if (open) { toList(); return; }
    if (sheet) { sheetClose(); return; }
    if (unsaved && !window.confirm("Your changes are not saved. Leave without saving?")) return;
    goBack(router, "/poster/site");
  };
  const doSwitch = (to: "card" | "site") => {
    if (to === "site") return;
    if (unsaved && !window.confirm("Your changes are not saved. Leave them?")) return;
    rememberEdit(to); router.replace(editHref(to, open ? tab : ""));
  };
  return (
    // Computer (lg): the live preview stays on the left, tall and sticky; the controls on the right (app shell, 1 Nov 2026).
    <div className="space-y-3 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6 lg:space-y-0">
      <EditFocus />
      {/* ---- Top bar (final review, 24 Nov 2026): where you are, whether it is live, the view, Undo / Redo and one Save — always here. ---- */}
      <div ref={topBar} className="sticky z-30 -mx-4 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur lg:col-span-2 lg:mx-0 lg:rounded-2xl lg:border lg:px-4 lg:shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]" style={{ top: "calc(env(safe-area-inset-top) + var(--help-banner, 0px))" }}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={doBack} aria-label={open ? "Back to the list" : "Back"} title={open ? "Back to the list" : "Back"} className={TB}><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-[120px] flex-1 lg:pr-2">
            <p className="text-sm font-bold leading-tight text-ink">Website</p>
            <a href={liveUrl} target="_blank" rel="noreferrer" className={`flex min-w-0 items-center gap-1 text-[11px] font-semibold ${siteOn ? "text-good" : "text-muted"}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${siteOn ? "bg-good" : "bg-muted"}`} /><span className="truncate">{siteOn ? "Live" : "Off"} · {liveUrl.replace(/^https?:\/\//, "").replace(/\?view=site$/, "")}</span></a>
          </div>
          <div className="order-last flex w-full items-center gap-2 overflow-x-auto sm:order-none sm:w-auto">
            <Seg value={"site" as "card" | "site"} options={[["card", "Card"], ["site", "Website"]] as const} onChange={doSwitch} label="Card or website" />
            <Seg value={phoneView ? "phone" : "computer"} options={[["computer", "Computer"], ["phone", "Phone"]] as const} onChange={(v) => setPhoneView(v === "phone")} label="Preview size" />
            <a href={unsaved ? `/preview/site?k=${PREVIEW_KEY}` : liveUrl} target="_blank" rel="noreferrer" className={`${TBW} sm:hidden`}><ExternalLink className="h-3.5 w-3.5" /> View site</a>
          </div>
          <button type="button" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo" className={TB}><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo" className={TB}><Redo2 className="h-4 w-4" /></button>
          <span className={`hidden whitespace-nowrap text-[12px] font-medium xl:inline ${unsaved ? "text-[#b45309]" : "text-muted"}`}>{busy === "save" ? "Saving…" : unsaved ? "Unsaved changes" : "All changes saved"}</span>
          {undo && !unsaved && <button type="button" onClick={() => void save(undo)} className={TBW.replace("inline-flex", "hidden sm:inline-flex")} title="Put back the website as it was before the last Save"><RotateCcw className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Undo save</span></button>}
          <a href={unsaved ? `/preview/site?k=${PREVIEW_KEY}` : liveUrl} target="_blank" rel="noreferrer" className={TBW.replace("inline-flex", "hidden sm:inline-flex")} title="View site"><ExternalLink className="h-3.5 w-3.5" /> <span className="hidden xl:inline">View site</span></a>
          <button type="button" onClick={doSave} disabled={!unsaved || busy === "save"} className="h-9 shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-110 shadow-[0_2px_6px_rgba(16,24,40,0.25)] disabled:opacity-40 disabled:shadow-none">{busy === "save" ? "Saving…" : "Save"}</button>
        </div>
        <SaveToast note={note?.k === "save" ? { text: note.text, bad: note.bad } : null} />
      </div>

      {/* ---- Preview: the page chips above it, the real website renderer scaled to fit ---- */}
      <div className="sticky z-10 -mx-4 bg-surface px-4 pb-2 pt-2 lg:col-start-1 lg:row-span-[40] lg:mx-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0" style={{ top: `calc(env(safe-area-inset-top) + var(--help-banner, 0px) + ${barH + 8}px)` }}>
        {!open && visiblePages.length > 1 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Pages">
            {visiblePages.map((p) => { const home = p.slug === "home"; const on = home ? !viewPage : viewPage === p.slug; return <button key={p.slug} type="button" role="tab" aria-selected={on} onClick={() => { sheetFocus.current = null; setSheet(null); setViewPage(home ? "" : p.slug); }} className={`h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold shadow-sm transition ${on ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted hover:text-ink"}`}>{p.label || p.slug}</button>; })}
            <button type="button" title="Add a new page" onClick={() => sheetOpen("text", "__page")} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 text-[12px] font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" /> Page</button>
          </div>
        )}
        <div className="relative overflow-clip rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <div ref={box} className={`pv-box overflow-hidden ${phoneView ? "bg-surface2" : "bg-white"} transition-[height] duration-300`} style={{ height: `var(--pv-h, ${pvHide ? "0px" : big ? "68svh" : "32svh"})` }}>
            <div className="relative mx-auto" style={{ width: Math.round(pvW * pvScale), height: boxH }}>
              <iframe ref={frame} title="Website preview" onLoad={() => { const f = lastFocus.current; if (f) setTimeout(() => { try { frame.current?.contentWindow?.postMessage({ type: "preview-focus", key: PREVIEW_KEY, ...f }, window.location.origin); } catch { /* ignore */ } }, 600); }} src={`/preview/site?k=${PREVIEW_KEY}&tap=1${previewPage ? `&page=${encodeURIComponent(previewPage)}` : ""}`} className="absolute left-0 top-0 origin-top-left" style={{ width: pvW, height: frameH, border: 0, transform: `scale(${pvScale})` }} />
            </div>
          </div>
          {pvHide
            ? <button type="button" onClick={() => setPvHide(false)} className="flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-brand-ink lg:hidden"><Eye className="h-3.5 w-3.5" /> Show the preview</button>
            : <button type="button" onClick={() => { setBig(false); setPvHide(true); }} className="absolute bottom-2 left-2 z-10 inline-flex h-8 items-center gap-1 rounded-lg bg-black/60 px-2.5 text-[11px] font-semibold text-white backdrop-blur lg:hidden"><EyeOff className="h-3.5 w-3.5" /> Hide</button>}
          <button type="button" style={pvHide ? { display: "none" } : undefined} onClick={() => setBig((b) => !b)} className="absolute bottom-2 right-2 z-10 inline-flex h-8 items-center gap-1 rounded-lg bg-black/60 px-2.5 text-[11px] font-semibold text-white backdrop-blur lg:hidden">{big ? <><Minimize2 className="h-3.5 w-3.5" /> Smaller</> : <><Maximize2 className="h-3.5 w-3.5" /> Full screen</>}</button>
        </div>
      </div>

      <div className="space-y-3 pb-20 lg:col-start-2 lg:min-w-0 lg:pb-0">
      {/* ---- The four tabs, always there whatever is open (owner, 24 Nov 2026); Back, Undo, Redo and Save are on the one top bar. On a
          computer the tabs stay at the top of this column while it scrolls; on a phone they sit at the foot of the screen. ---- */}
      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:sticky lg:bottom-auto lg:left-auto lg:top-[var(--bar-top)] lg:z-20 lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:border lg:p-2 lg:shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]" style={{ ["--bar-top" as string]: `${barH + 8}px` }}>
        <div role="tablist" aria-label="Editor" className="flex rounded-xl bg-surface2 p-1">
          {RTABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={curTab === k} onClick={() => goTab(k)} className={`flex-1 rounded-lg px-1 py-2 text-[12.5px] font-semibold transition ${curTab === k ? "bg-brand text-white shadow-[0_2px_6px_rgba(16,24,40,0.25)]" : "text-muted hover:text-ink"}`}>{k === "info" ? <><span className="sm:hidden">Info</span><span className="hidden sm:inline">{l}</span></> : l}</button>)}
        </div>
      </div>
      {s.cards.length > 1 && (
        <div className="space-y-1.5">
          <select value={s.cardId} onChange={(e) => { setNote(null); void load(e.target.value); }} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
            {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
          </select>
          {err && <p className="text-xs font-semibold text-danger">{err.startsWith("No internet") ? (hi ? "Internet नहीं है — दोबारा try करें।" : "No internet — please try again.") : err}</p>}
        </div>
      )}

      {liveBox && !dirty && !embedDirty && (() => { const link = `${s.url}?view=site`; return (
        <section className="space-y-2 rounded-2xl border border-good/40 bg-good/10 p-3">
          <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-good"><span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Your website is live</span></p><button type="button" aria-label={hi ? "बंद" : "Close"} onClick={() => setLiveBox(false)} className="text-muted"><X className="h-4 w-4" /></button></div>
          <p className="break-all rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[12px]">{link.replace(/^https?:\/\//, "")}</p>
          <div className="flex flex-wrap gap-2">
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white"><ExternalLink className="h-3.5 w-3.5" /> {hi ? "Website देखें" : "See the website"}</a>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setLiveCopied(true)).catch(() => {}); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> {liveCopied ? (hi ? "कॉपी हो गया" : "Copied") : (hi ? "लिंक कॉपी" : "Copy link")}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366] bg-surface px-3 py-2 text-xs font-semibold text-[#128C7E]"><MessageCircle className="h-3.5 w-3.5" /> {hi ? "WhatsApp पर भेजें" : "Share on WhatsApp"}</a>
            <button type="button" onClick={() => { if (liveQr) { setLiveQr(""); return; } QRCode.toDataURL(link, { width: 320, margin: 1 }).then(setLiveQr).catch(() => setLiveQr("")); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold"><QrCode className="h-3.5 w-3.5" /> QR</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made on this phone */}
          {liveQr && <img src={liveQr} alt="QR" className="h-40 w-40 rounded-lg border border-border bg-white p-1" />}
        </section>); })()}

      {/* ---- One section of the home page: edit its text and photo, pick its layout, move or hide it ---- */}
      {/* eslint-disable-next-line react-hooks/refs -- the picks and moves run on the tap, never while drawing */}
      {!open && sheet && adv && card && (() => {
        const i = homeRows.findIndex((r) => r.id === sheet.id); const row = homeRows[i]; if (!row) return null;
        if (row.id === "masthead") {
          const pg = card.pages.find((p) => p.slug === curSlug); if (!pg) return null;
          const hd = pg.head ?? {};
          const mode = hd.noPhoto ? "none" : hd.photo ? "own" : "auto";
          // The website's own pictures to pick from: the gallery, the product photos, the story's photo.
          const picks = [...new Set(card.pages.flatMap((p) => p.blocks).flatMap((b) => b.kind === "gallery" ? b.images.map((q) => q.url ?? "") : b.kind === "image" || b.kind === "carousel" ? b.images.map((q) => q.url) : b.kind === "product" ? b.items.flatMap((it) => [it.imageUrl ?? "", ...(it.images ?? [])]) : b.kind === "about" ? [b.imageUrl ?? ""] : []).filter((u) => /^(https:\/\/|\/)/.test(u)))].slice(0, 10);
          const CH = (on: boolean) => `rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:border-brand/50"}`;
          const CAP = "text-[11px] font-semibold uppercase tracking-wide text-muted";
          const KINDS: [NonNullable<CardPage["head"]>["kind"] | undefined, string][] = [[undefined, "As the design"], ["ink", "Photo band"], ["split", "Photo card beside the name"], ["type", "Big letters"], ["poster", "Centred letters"]];
          return (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
              <div className="min-w-0 flex-1 pl-1"><p className="text-[11px] text-muted">Section {i + 1} of {homeRows.length}</p><p className="truncate text-sm font-bold text-ink">Page heading — {pg.label}</p></div>
              <button type="button" disabled className={TBW}>Previous</button>
              <button type="button" onClick={() => sheetGo(i + 1)} className={TBW}>Next</button>
            </div>
            <div className="space-y-4 p-3">
              <label className="block"><span className={CAP}>Page name</span>
                <input value={pg.label} maxLength={40} onChange={(e) => setHead(curSlug, { label: e.target.value })} className="ed-input mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
              <label className="block"><span className={CAP}>Short line under the name (optional)</span>
                <input value={hd.line ?? ""} maxLength={160} placeholder="e.g. Fresh arrivals every Friday" onChange={(e) => setHead(curSlug, { line: e.target.value })} className="ed-input mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
              <div>
                <p className={CAP}>Photo on top</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button type="button" aria-pressed={mode === "auto"} onClick={() => setHead(curSlug, { photo: "", noPhoto: false })} className={CH(mode === "auto")}>Automatic</button>
                  <label className={`${CH(mode === "own")} inline-flex cursor-pointer items-center gap-1.5`}>{busy === "head" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Upload a photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0] ?? null, "head"); e.target.value = ""; }} /></label>
                  <button type="button" aria-pressed={mode === "none"} onClick={() => setHead(curSlug, { noPhoto: true })} className={CH(mode === "none")}>No photo</button>
                </div>
                <p className="mt-1.5 text-[12px] text-muted">{mode === "auto" ? "Automatic: this page’s own first photo, or the Home banner." : mode === "own" ? "This page shows the photo you chose." : "This page’s top is words only."}</p>
                {picks.length > 0 && <>
                  <p className="mt-2 text-[12px] text-muted">Or pick one of your photos — best is a wide photo, 1600 × 900 px:</p>
                  <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                    {picks.map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element -- a small tile of the owner's own photo to pick from
                      <button key={u} type="button" aria-pressed={hd.photo === u && !hd.noPhoto} onClick={() => setHead(curSlug, { photo: u, noPhoto: false })} className={`overflow-hidden rounded-lg border-2 ${hd.photo === u && !hd.noPhoto ? "border-brand" : "border-transparent"}`}><img src={u} alt="" loading="lazy" className="aspect-square w-full object-cover" /></button>
                    ))}
                  </div>
                </>}
              </div>
              {mode !== "none" && <div>
                <p className={CAP}>Which part of the photo to keep</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([["", "Automatic"], ["50% 12%", "Top"], ["50% 50%", "Middle"], ["50% 88%", "Bottom"], ["12% 40%", "Left"], ["88% 40%", "Right"]] as const).map(([f, name]) => <button key={name} type="button" aria-pressed={(hd.focus ?? "") === f} onClick={() => setHead(curSlug, { focus: f })} className={CH((hd.focus ?? "") === f)}>{name}</button>)}
                </div>
                <p className="mt-1.5 text-[12px] text-muted">A small photo card shows only a square of a wide photo. If someone is cut off, pick the side they stand on.</p>
              </div>}
              <div>
                <p className={CAP}>Shape of the heading</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {KINDS.map(([k, name]) => <button key={name} type="button" aria-pressed={hd.kind === k} onClick={() => setHead(curSlug, { kind: k })} className={CH(hd.kind === k)}>{name}</button>)}
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-muted"><Info className="h-3.5 w-3.5" /> The window shows it at once; press Save to keep it. The Home page has its own banner.</p>
            </div>
          </section>);
        }
        const sec = row.sec;
        const w = row.blk ? partFor(card, { kind: "block", blockId: row.blk }, true) : sheetWords(sec ?? "hero");
        // The photo button only where that screen edits THIS section: the About screen edits the first About only, Products edits the
        // products (not a list of services), Photo library the first gallery. A second About ("Our craft & service" on Contact) or a
        // services list opened the Home page's About / the products instead (final test, 25 Nov 2026): their photos are in their own text.
        const ph = sec && !(row.blk && w.key === "text") ? SHEET_PHOTO[sec] : undefined;
        const bk = row.blk ? card.pages.flatMap((p) => p.blocks).find((b) => b.id === row.blk) : undefined;
        const withPics = !!bk && ["about", "services", "product", "gallery", "image", "carousel", "story", "showcase"].includes(bk.kind);
        const isHero = sec === "hero";
        const ids: readonly string[] = !sec ? [] : isHero ? HERO_IDS : (VARIANT_IDS as Record<string, readonly string[]>)[sec] ?? [];
        const cur = isHero ? String(adv.hero ?? "") : sec ? (adv.sections as Record<string, string> | undefined)?.[sec] ?? ids[0] : "";
        const own = homeRows.filter((r) => r.blk), at = own.findIndex((r) => r.id === row.id);
        const BIG = "flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-semibold text-ink hover:bg-surface2";
        return (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <div className="min-w-0 flex-1 pl-1"><p className="text-[11px] text-muted">Section {i + 1} of {homeRows.length}</p><p className="truncate text-sm font-bold text-ink">{row.name}</p></div>
            <button type="button" disabled={i === 0} onClick={() => sheetGo(i - 1)} className={TBW}>Previous</button>
            {i < homeRows.length - 1
              ? <button type="button" onClick={() => sheetGo(i + 1)} className={TBW}>Next</button>
              : <button type="button" onClick={sheetClose} className={TBW}><Check className="h-3.5 w-3.5" /> Done</button>}
          </div>
          <div className="space-y-4 p-3">
            <div className={`grid gap-2 ${ph && ph !== w.key ? "grid-cols-2" : ""}`}>
              <button type="button" onClick={() => sheetOpen(w.key, w.blockId)} className={BIG}><Pencil className="h-4 w-4" /> {ph === w.key ? (w.key === "products" ? "Edit products" : w.key === "photos" ? (sec === "hero" ? "Change banner photos" : "Change photos") : "Edit text & photo") : w.key === "text" ? (withPics ? "Edit text & photos" : "Edit text") : `Edit: ${LABEL[w.key]?.[0] ?? "text"}`}</button>
              {ph && ph !== w.key && <button type="button" onClick={() => sheetOpen(ph)} className={BIG}><Camera className="h-4 w-4" /> Change photo</button>}
            </div>
            {isHero && <BannerKeep hi={hi} card={card} onKeep={keepBanner} onPhotos={() => sheetOpen("photos")} />}
            {sec && ids.length > 1 && <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Design</p><p className="text-[12px] text-muted">Tap a design — the preview changes at once; press Save to keep it.</p>
              <div className="mt-2">
                {layoutPicker(sec, cur, (id) => sheetLayout(sec, id))}
              </div>
            </div>}
            {row.blk
              ? <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Position and visibility</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button type="button" disabled={at <= 0} onClick={() => moveHomeBlock(row.blk!, -1)} className={TBW}><ChevronUp className="h-4 w-4" /> Move up</button>
                    <button type="button" disabled={at < 0 || at >= own.length - 1} onClick={() => moveHomeBlock(row.blk!, 1)} className={TBW}><ChevronDown className="h-4 w-4" /> Move down</button>
                    <button type="button" onClick={() => hideHomeBlock(row.blk!, true)} className={TBW}><Eye className="h-4 w-4" /> Hide</button>
                  </div>
                </div>
              : <p className="flex items-center gap-1.5 text-[12px] text-muted"><Info className="h-3.5 w-3.5" /> This section has a fixed position on every website.</p>}
          </div>
        </section>); })()}

      {/* ---- The list: the health line, then four tabs — every job in exactly one of them ---- */}
      {!open && !sheet && (<>
        {(() => {
          const comp = completeness(card, true);
          const todo = checkSite(isShubhoraSellerCard(card) ? withoutFreeCard(card, true) : card).filter((n) => n.level === "todo");
          // A section of products or services on the home page with no photo at all: the design shows letters instead (seen on a demo,
          // 24 Nov 2026) — the thing that makes a website look unfinished, so it is counted.
          const hidH = new Set(card.site?.home?.hidden ?? []);
          const bare = (card.pages.find((p) => p.slug === homeSlugOf(card))?.blocks ?? []).filter((b) => !hidH.has(b.id) && (
            (b.kind === "product" && b.items.length > 0 && !b.items.some((x) => x.imageUrl || x.images?.length)) ||
            // only a section the design draws as tiles: numbered steps ("How to shop") need no photo
            (!!adv && b.kind === "services" && homeRows.find((r) => r.blk === b.id)?.sec === "services" && b.items.length > 0 && !b.items.some((x) => x.imageUrl))));
          const toFix = comp.empty.length + todo.length + bare.length;
          const FIX = "shrink-0 rounded-lg border border-border px-2.5 py-1 text-[12px] font-semibold text-brand-ink hover:bg-surface2";
          return (
            <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
              <button type="button" onClick={() => toFix && setHealthOpen((o) => !o)} aria-expanded={healthOpen} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span className="text-sm font-bold text-ink">{comp.pct}% ready</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"><span className="block h-full rounded-full bg-brand" style={{ width: `${comp.pct}%` }} /></span>
                <span className={`whitespace-nowrap text-[12px] font-semibold ${toFix ? "text-[#b45309]" : "text-good"}`}>{toFix ? `${toFix} to fix` : "All good"}</span>
                {toFix > 0 && <ChevronDown className={`h-4 w-4 text-muted transition-transform ${healthOpen ? "rotate-180" : ""}`} />}
              </button>
              {healthOpen && toFix > 0 && (
                <ul className="space-y-2 border-t border-border px-3.5 py-3">
                  {comp.empty.map((k) => <li key={k} className="flex items-center gap-2 text-[13px]"><span className="min-w-0 flex-1"><span className="font-semibold">{LABEL[k]?.[0] ?? k}</span> is empty</span><button type="button" onClick={() => openPart(k)} className={FIX}>Fix</button></li>)}
                  {bare.map((b) => <li key={b.id} className="flex items-center gap-2 text-[13px]"><span className="min-w-0 flex-1"><span className="font-semibold">{("title" in b && b.title?.trim()) || KIND_NAME[b.kind]}</span> has no photos — the website shows letters instead</span><button type="button" onClick={() => { if (b.kind === "product") openPart("products"); else sheetOpen("text", b.id); }} className={FIX}>Add photos</button></li>)}
                  {todo.map((n, j) => <li key={j} className="flex items-start gap-2 text-[13px]"><span className="min-w-0 flex-1"><span className="font-semibold">{n.page}:</span> {n.en}</span>{(n.blockId || n.part) && <button type="button" onClick={() => { if (n.blockId) sheetOpen("text", n.blockId); else if (n.part) openPart(n.part); }} className={FIX}>Fix</button>}</li>)}
                </ul>
              )}
            </section>
          );
        })()}


        {/* A website still on one of the older looks (no Premium design): the same editor, but the section designs come with the new
            designs — said plainly, with the way there (owner, 24 Nov 2026: "Haryana wali id me kuch aur dikhta hai, Sunita wali me kuch aur"). */}
        {/* The two whole-store designs (bridal couture house / lookbook) draw the page their own fixed way: no design per section. */}
        {adv && storeDesign && (rtab === "sections" || rtab === "design") && (
          <div className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft/40 px-3.5 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">This design has a fixed layout</p>
              <p className="mt-0.5 text-[12px] text-muted">Text and photos can be edited here. To change the design of each section, pick another of your 12 designs.</p>
            </div>
            <Link href="/poster/site/choose?all=1" className="shrink-0 rounded-lg bg-brand px-3 py-2 text-[12px] font-bold text-white">Choose a design</Link>
          </div>
        )}
        {!adv && (rtab === "sections" || rtab === "design") && (
          <div className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft/40 px-3.5 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Your website uses an older design</p>
              <p className="mt-0.5 text-[12px] text-muted">Pick one of the 12 new designs to change the design of each section, like every new website. Your text and photos stay.</p>
            </div>
            <Link href="/poster/site/choose?all=1" className="shrink-0 rounded-lg bg-brand px-3 py-2 text-[12px] font-bold text-white">Choose a design</Link>
          </div>
        )}
        {rtab === "sections" && (homeRows.length > 0 ? <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[13px] font-semibold text-ink">{curName} page — top to bottom</p>
            <button type="button" onClick={() => sheetGo(0)} className="text-[12px] font-semibold text-brand-ink hover:underline">Review one by one</button>
          </div>
          <div className={BOX}>
            {homeRows.map((r, i) => (
              <EdRow key={r.id} Icon={ROW_ICON[r.ic ?? ""] ?? FileText} title={r.name} sub={r.kind && !r.name.toLowerCase().startsWith((r.kind.split(" · ")[0] ?? "").toLowerCase()) ? r.kind : r.kind?.includes(" · ") ? r.kind : undefined} onClick={() => sheetGo(i)}>
                {r.blk
                  ? <button type="button" aria-label="Hide this section" title="Shown on the website — tap to hide" onClick={() => hideHomeBlock(r.blk!, true)} className={IB}><Eye className="h-4 w-4" /></button>
                  : <span className="w-8 shrink-0" aria-hidden />}
                <button type="button" aria-label="Edit" title="Edit text, photo, design and position" onClick={() => sheetGo(i)} className={IB}><Pencil className="h-4 w-4" /></button>
              </EdRow>
            ))}
          </div>
          {hiddenHome.length > 0 && <>
            <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Hidden sections</p>
            <div className={BOX}>
              {hiddenHome.map((x) => <EdRow key={x.id} title={x.name} sub="Hidden — not on the website" dim><button type="button" onClick={() => hideHomeBlock(x.id, false)} className={TBW}><EyeOff className="h-3.5 w-3.5" /> Show again</button></EdRow>)}
            </div>
          </>}
          <button type="button" onClick={() => sheetOpen("text", "__add")} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-sm font-semibold text-brand-ink hover:bg-surface2"><Plus className="h-4 w-4" /> Add section</button>
        </> : <>
          <p className="px-1 text-[13px] font-semibold text-ink">{curName} page — top to bottom</p>
          {curSlug !== homeSlugOf(card) ? <div className={BOX}>
            {/* Another page of an older-design website: its sections, each opening in the page editor. */}
            {(card.pages.find((p) => p.slug === curSlug)?.blocks ?? []).filter((b) => !isEmptyBlock(b)).map((b) => <EdRow key={b.id} title={("title" in b ? (b.title ?? "").trim() : "") || KIND_NAME[b.kind] || b.kind} sub={kindLine(b)} onClick={() => sheetOpen("text", b.id)}><button type="button" aria-label="Edit" onClick={() => sheetOpen("text", b.id)} className={IB}><Pencil className="h-4 w-4" /></button></EdRow>)}
          </div> : <div className={BOX}>
            <EdRow Icon={ImageIcon} title="Home banner" sub="Heading and photos · always on top" onClick={() => openPart("hero")}><button type="button" aria-label="Edit" onClick={() => openPart("hero")} className={IB}><Pencil className="h-4 w-4" /></button></EdRow>
            {sections.map((sec, i) => {
              const off = hiddenSections.has(sec.key);
              const edit = () => { const p = sec.kind === "block" ? partFor(card, { kind: "block", blockId: sec.key }, true) : partFor(card, { kind: "text", text: secText(sec.key) }, true); sheetOpen(p.key, p.blockId); };
              return (
                <EdRow key={sec.key} title={sectionLabel(sec, "en")} dim={off} sub={off ? "Hidden" : undefined} onClick={edit}>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(sec.key, -1)} className={IB}><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Move down" disabled={i === sections.length - 1} onClick={() => move(sec.key, 1)} className={IB}><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={off ? "Show this section" : "Hide this section"} title={off ? "Hidden — tap to show" : "Shown on the website — tap to hide"} onClick={() => toggleSection(sec.key)} className={IB}>{off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button type="button" aria-label="Edit" onClick={edit} className={IB}><Pencil className="h-4 w-4" /></button>
                </EdRow>
              );
            })}
          </div>}
          <button type="button" onClick={() => sheetOpen("text", "__add")} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-sm font-semibold text-brand-ink hover:bg-surface2"><Plus className="h-4 w-4" /> Add section</button>
        </>)}
        {rtab === "sections" && <>
          <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Library</p>
          <div className={BOX}>
            {((adv ? ["products", "photos", "reviews", "text"] : ["products", "photos", "reviews", "text", "home"]) as Tab[]).map((k) => { const t = allTabs.find((x) => x.key === k); return <EdRow key={k} Icon={t?.Icon} title={t?.label ?? k} sub={t?.sub} onClick={() => { openPart(k); if (k === "text") setSync({ text: "", page: curSlug }); }} badge={partState(card, k) === "empty" ? <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]">Empty</span> : undefined} />; })}
          </div>
        </>}

        {rtab === "design" && <div className={BOX}>
          <Link href="/poster/site/choose?all=1" className={ROW}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"><LayoutGrid className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{hi ? "पूरा layout बदलें" : "Change the whole layout"}</span><span className="block truncate text-[12px] text-muted">{hi ? "दूसरे तैयार designs देखें — हर design के sections भी बदल सकते हैं" : "See the other ready designs — each one's sections can be changed too"}</span></span><ChevronLeft className="h-4 w-4 rotate-180 text-muted" /></Link>
          <EdRow Icon={Palette} title={LABEL.look[0]} sub={LABEL.look[1]} onClick={() => { openPart("look"); setLookMode("style"); }} />
          {adv && !storeDesign && <EdRow Icon={LayoutTemplate} title="Section designs" sub="The design of the home banner and of each section" onClick={() => { openPart("look"); setLookMode("sections"); }} />}
        </div>}

        {(rtab === "info" || rtab === "settings") && <div className={BOX}>
          {(rtab === "info" ? (["trade", "you", "where", "links", "buttons"] as const) : (["offer", "pages", "seo", "domain", "website"] as const)).map((k) => {
            const t = allTabs.find((x) => x.key === k);
            return <EdRow key={k} Icon={t?.Icon} title={LABEL[k][0]} sub={LABEL[k][1]} onClick={() => openPart(k)} badge={partState(card, k) === "empty" ? <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]">Empty</span> : undefined} />;
          })}
        </div>}
      </>)}
      {/* The open part's name and what it changes; Back is on the top bar (final review: no second Back, no "Website only" tag). */}
      {open && (() => { const d = TABS.find((x) => x.key === tab); if (!d) return null; const I = d.Icon; return (
        <div className="flex items-center gap-2.5 px-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface2 text-muted"><I className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0"><p className="text-base font-bold leading-tight text-ink">{tab === "look" && lookMode === "sections" ? "Section designs" : d.label}</p><p className="truncate text-[12px] text-muted">{tab === "look" && lookMode === "sections" ? "The design of the home banner and of each section" : d.sub}</p></div>
        </div>); })()}
      {open && (RELATED[tab] ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1" aria-label="Related">
          <span className="text-[11px] font-semibold text-muted">{hi ? "साथ में:" : "Next:"}</span>
          {(RELATED[tab] ?? []).filter((k) => LABEL[k] && GROUPS.some((g) => g.tabs.some((t) => t.key === k))).map((k) => (
            <button key={k} type="button" onClick={() => openPart(k)} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink hover:border-brand/60 hover:text-brand-ink">
              {RELATED_NAME[tab]?.[k] ?? LABEL[k][0]} <ChevronLeft className="h-3 w-3 rotate-180" />
            </button>
          ))}
        </div>
      )}
      {open && (<>
      {tab === "look" && lookMode === "style" && <div className="overflow-hidden rounded-2xl border border-border">
        <div className="border-t border-border bg-surface px-2 pb-1.5 pt-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-muted"><Palette className="h-3.5 w-3.5 text-brand" /> {hi ? "रंग चुनें" : "Colour"}</p>
            {/* Background light / dark, right next to the colours (owner, 25 Oct 2026): a small two-part switch. Premium designs only. */}
            {adv && !storeDesign && (() => {
              const pal = (adv.palette ?? {}) as { key?: string; tone?: string; luxe?: boolean };
              const cur = pal.tone === "dark" ? "dark" : "light";
              const noDark = pal.key === "ivory" || pal.key === "pearl";
              return (
                <div className="inline-flex rounded-full border border-border bg-surface2 p-0.5" role="group" aria-label={hi ? "Background" : "Background"}>
                  <button type="button" onClick={() => setTone("light")} aria-pressed={cur === "light"} title={hi ? "हल्का background" : "Light background"}
                    className={`grid h-7 w-7 place-items-center rounded-full transition ${cur === "light" ? "bg-white text-[#d97706] shadow-sm" : "text-muted"}`}><Sun className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setTone("dark")} disabled={noDark} aria-pressed={cur === "dark"} title={hi ? "गहरा background" : "Dark background"}
                    className={`grid h-7 w-7 place-items-center rounded-full transition disabled:opacity-30 ${cur === "dark" ? "bg-[#15171c] text-white shadow-sm" : "text-muted"}`}><Moon className="h-4 w-4" /></button>
                </div>
              );
            })()}
          </div>
          <div className="mt-1.5 flex gap-2.5 overflow-x-auto pb-1">
            <Swatch p={brand} on={paletteKey === "brand"} onClick={() => pickColour("brand")} label={hi ? "आपका" : "Yours"} />
            {SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => <Swatch key={p.key} p={p} on={paletteKey === p.key} onClick={() => pickColour(p.key)} label={hi ? p.hi : p.name} />)}
          </div>
          {paletteKey === "brand" && (
            <label className="mt-0.5 inline-flex items-center gap-2 px-1 text-[11px] text-muted">
              <input type="color" value={style.color || card.themeColor || "#0e9e90"} onChange={(e) => pickColour("brand", e.target.value)} className="h-6 w-9 rounded border border-border bg-surface p-0.5" />
              {hi ? "अपना रंग" : "Your own colour"}
              {/* Copies the card's colour once; the two stay separate after (owner, 25 Oct 2026). */}
              {card.themeColor && (style.color || "").toLowerCase() !== card.themeColor.toLowerCase() && <button type="button" onClick={() => pickColour("brand", card.themeColor)} className="underline">{hi ? "कार्ड वाला रंग लें" : "Use the card's colour"}</button>}
            </label>
          )}
        </div>
      </div>}
      {savedTab && savedTab === tab && <p role="status" className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good"><Check className="h-4 w-4" /> {hi ? "Save हो गया — website पर live है" : "Saved — it is live on your website"}</p>}

      {/* Shop or information website (owner, 14 Nov 2026): a showroom that does not sell online keeps its products on show without an
          order / WhatsApp button on each one. Saved with Save, like the rest of this screen. */}
      {tab === "products" && card && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-3.5">
          <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] accent-[var(--color-brand)]" checked={(card.site as { showcase?: boolean } | undefined)?.showcase === true}
            onChange={(e) => set({ showcase: e.target.checked } as Partial<Card["site"] & object>)} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{hi ? "सिर्फ़ जानकारी वाली website (online बिक्री नहीं)" : "Information website (no online selling)"}</span>
            <span className="block text-xs text-muted">{hi ? "Products दिखेंगे, पर हर product पर WhatsApp / Order का button नहीं। Website का अपना WhatsApp और Call बना रहेगा। बदलाव के बाद Save दबाएँ।" : "Products are shown, but with no WhatsApp / Order button on each one. The website's own WhatsApp and Call stay. Tap Save after changing it."}</span>
          </span>
        </label>
      )}
      {/* A screen of its own (Products, Timings & address …), shown right here: it saves by itself, the window above shows its change. */}
      {embedSrc && (
        <EmbedPane src={embedSrc} title={TABS.find((t) => t.key === tab)?.label ?? ""} saveTick={saveTick} onSync={onEmbedSync}
          // The full editor inside ("All pages & text", "Contact buttons") posts its card from its first moment — a blank "Your Name /
          // Good work, done properly" card while it is still loading — and "not saved" with it: the window showed that blank site and the
          // bar said "Unsaved changes" every time the screen opened (owner, 25 Nov 2026: "ye page beech beech me kaise aa jata hai?").
          // Only this website's own card is shown, and "not saved" counts only once it has arrived.
          onLive={(v) => { if (!card || v.card?.id !== card.id) return; embedReal.current = true; setEmbedView(v); }}
          onDirty={(d) => { if (d && (tab === "text" || tab === "buttons") && !embedReal.current) return; setEmbedDirty(d); }}
          onSaved={() => { setEmbedDirty(false); setEmbedView(null); if (ownAfter.current) { ownAfter.current = false; void save().then(() => refresh()); } else void refresh(); say("save", hi ? "✅ Save हो गया — website पर live है।" : "✅ Saved — it is live on your website.", false); }}
          onError={(t) => { ownAfter.current = false; say("save", t); }}
          onDone={(saved) => { setEmbedView(null); if (saved) { setSavedTab(tab); void refresh(); setTimeout(() => setSavedTab(""), 4000); } }} />
      )}
      {tab === "photos" && (
        <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <SitePhotos hi={hi} cardId={s.cardId} scope="site" onChanged={() => void refresh()} />
        </section>
      )}
      {tab === "offer" && (
        <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard((cur) => (cur ? keepTouched(c, cur, touched.current) : c))} />
        </section>
      )}
      {tab === "website" && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 px-3 py-2.5">
            <span><span className="block text-sm font-semibold">{hi ? "Computer पर website" : "Website on computers"}</span>
              <span className="text-[11px] text-muted">{siteOn ? (adv ? (hi ? "ON — computer और phone दोनों पर website" : "ON — the website shows on computers and phones") : hi ? "ON — computer पर website, phone पर card" : "ON — website on computers, card on phones") : (hi ? "OFF — हर जगह card दिखता है" : "OFF — the card shows everywhere")}</span></span>
            <input type="checkbox" className="h-5 w-5" checked={siteOn} disabled={busy === "enabled"} onChange={(e) => void setEnabled(e.target.checked)} />
          </label>
          {line("ref")}
          <AdvancedEntry cardId={s.cardId} fetchState />
        </section>
      )}
      {tab === "domain" && (
        <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          {domainOk || customDomain
            ? <DomainConnect cardId={s.cardId} username={s.username} initialDomain={customDomain || undefined} />
            : <p className="text-sm text-muted">{hi ? "अपना web address (www.yourshop.com) Growth plan के साथ आता है।" : "Your own web address (www.yourshop.com) comes with the Growth plan."}</p>}
        </section>
      )}

      {tab === "look" && (
        <section className="space-y-2.5 rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <FoldGroups prefix="look" is={foldIs} tap={foldTap}>
          {/* A Premium website's own design lives on the Premium page (owner, 25 Oct 2026: "premium hai to premium design par jaana chahiye"). */}
          <p className={`text-[11px] text-muted ${lookMode === "style" ? "" : "hidden"}`}>{hi ? "Design बदलना हो तो " : "To change the design, go to "}<Link href="/poster/site/choose?all=1" className="font-semibold text-brand-ink">{hi ? "Website का design (12 में से चुनें)" : "Ready designs"}</Link>.</p>
          {/* Premium: the letters, the top and the corners are the Premium design's own (spec.fonts / spec.hero / spec.shape) — the basic
              site's choices below never reached it, so a tap changed nothing (owner, 25 Oct 2026). */}
          {adv ? (<>
            <div className={lookMode === "style" ? "" : "hidden"}>
              <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-4 w-4 text-brand" /> {hi ? "अक्षर (font)" : "Font"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HEADING_FONTS.map((f) => <button key={f} type="button" onClick={() => setAdv({ fonts: { ...((adv.fonts as { heading?: string; body?: string }) ?? {}), heading: f } })} className={chip((adv.fonts as { heading?: string } | undefined)?.heading === f)} style={{ fontFamily: `"${f}", Inter, sans-serif` }}>{f}</button>)}
              </div>
            </div>
            {/* The two whole-store designs have one top of their own: the list changed nothing there (owner, 19 Nov 2026), so it is not offered. */}
            {/* A section's layout is picked on that section (Sections tab), the top section included: one job, one place (final review, 24 Nov 2026). */}
            {lookMode !== "sections" ? null : storeDesign ? <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{hi ? "इस design का ऊपर का हिस्सा तय है। उसे बदलना हो तो Premium design में दूसरा design चुनें।" : "This design has its own top of the page. To change it, pick another design in Premium design."}</p> : <div>
              <p className="text-sm font-semibold flex items-center gap-1.5"><LayoutTemplate className="h-4 w-4 text-brand" /> {hi ? "ऊपर का हिस्सा कैसा सजे" : "Home banner design"}</p>
              <div className="mt-2">
                {/* eslint-disable-next-line react-hooks/refs -- the pick runs on the tap, never while drawing */}
                {layoutPicker("hero", String(adv.hero ?? ""), pickHero)}
              </div>
            </div>}
            {lookMode === "sections" && !storeDesign && advRows.some((r) => r.key !== "hero") && <div ref={mixBox} className="scroll-mt-24 rounded-xl border border-brand/30 bg-brand-soft/40 p-3">
              <p className="text-sm font-bold">Each section</p>
              <p className="mt-0.5 text-[11px] text-muted">Each section of your home page, with the designs recommended for your business first. Tap one — the preview changes at once. Colours and letters stay the same, so everything matches. Press Save to put it on the website.</p>
              <div className="mt-2 space-y-3">
                {/* eslint-disable-next-line react-hooks/refs -- the picks and moves run on the tap, never while drawing */}
                {advRows.filter((r) => r.key !== "hero").map((r) => { const cur = (adv.sections as Record<string, string> | undefined)?.[r.key] ?? VARIANT_IDS[r.key][0]; return (
                  <div key={r.key}>
                    <button type="button" onClick={() => showAdv(r.key)} className="text-left text-[13px] font-semibold underline decoration-dotted underline-offset-2">{r.name}</button>
                    {(() => { const at = drawnAt.get(r.key); if (!at) return null; return <p className="text-[11px] text-muted">On: {at.on.join(" · ")}{at.list ? " — the products page takes the broad look of this design" : ""}</p>; })()}
                    <div className="mt-1.5">
                      {layoutPicker(r.key, cur, (id) => setAdvSection(r.key, id))}
                    </div>
                  </div>); })}
              </div>
              {mixHeld && dirty && <div className="sticky bottom-2 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-surface p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
                <p className="min-w-0 flex-1 text-[12px] font-semibold">{hi ? "नया design अभी save नहीं हुआ है।" : "Your new design is not saved yet."}</p>
                <button type="button" disabled={busy === "save"} onClick={() => { const back = lastSaved.current; if (!back) return; mixHold.current = false; setMixHeld(false); touched.current.clear(); setCard(back); setDirty(false); focus({ top: true }); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{hi ? "छोड़ दें (पुराना रखें)" : "Discard (keep the old one)"}</button>
                <button type="button" disabled={busy === "save"} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy === "save" && <LoaderCircle className="h-4 w-4 animate-spin" />} {hi ? "Save करें — website पर लगाएँ" : "Save — put it on the website"}</button>
              </div>}
              <p className="mt-2 text-[11px] text-muted">{hi ? "धुँधले रूप आपकी website पर अभी नहीं बन सकते (जैसे फ़ोटो कम हैं)। जो हिस्सा यहाँ नहीं दिख रहा, उसमें अभी कुछ भरा नहीं है — पहले “Text & pages” में भरें।" : "Faded layouts cannot be drawn on your website yet (for example, too few photos). A part that is missing here has nothing in it yet — fill it in “Text & pages” first."}</p>
            </div>}
            <div className={lookMode === "style" ? "" : "hidden"}>
              <p className="text-sm font-semibold">{hi ? "कोने (गोल या सीधे)" : "Corners"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SHAPES.map((sh) => <button key={sh} type="button" onClick={() => setAdv({ shape: sh, palette: { ...(adv.palette ?? {}), corners: true } })} className={chip(adv.shape === sh)}>{sh === "sharp" ? (hi ? "शार्प" : "Sharp") : sh === "soft" ? (hi ? "सॉफ्ट" : "Soft") : (hi ? "राउंड" : "Round")}</button>)}
              </div>
            </div>
          </>) : (<>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-4 w-4 text-brand" /> {hi ? "अक्षर (font)" : "Font"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FONT_PAIRS.map((f) => <button key={f.key} type="button" onClick={() => setStyle({ font: f.key === "look" ? undefined : f.key })} className={chip((style.font ?? "look") === f.key)} title={f.blurb}>{hi ? f.hi : f.name}</button>)}
            </div>
            <p className="text-[11px] text-muted mt-1">{FONT_PAIRS.find((f) => f.key === (style.font ?? "look"))?.blurb}</p>
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><LayoutTemplate className="h-4 w-4 text-brand" /> {hi ? "ऊपर का हिस्सा कैसा सजे" : "Home banner design"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyle({ hero: undefined })} className={chip(!style.hero)}>{hi ? "अपने-आप" : "Automatic"}</button>
              {HERO_LAYOUTS.map((h) => <button key={h.key} type="button" onClick={() => setStyle({ hero: h.key, blueprint: undefined })} className={chip(style.hero === h.key)} title={h.blurb}>{hi ? h.hi : h.name}</button>)}
            </div>
            <p className="text-[11px] text-muted mt-1">{style.hero ? HERO_LAYOUTS.find((h) => h.key === style.hero)?.blurb : (hi ? "अपने-आप: product की photo हो तो शब्द + picture, banner हो तो बड़ी photo।" : "Automatic: words + picture when you have a product photo, a big photo when you have a banner.")}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{hi ? "कोने (गोल या सीधे)" : "Corners"}</p>
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
          </FoldGroups>
        </section>
      )}

      {tab === "hero" && (
        <section className="space-y-2.5 rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
          <BannerKeep hi={hi} card={card} onKeep={keepBanner} onPhotos={() => openPart("photos")} />
          {/* One heading, its own boxes under it; one opens at a time (owner, 19 Nov 2026: "jo heading hai uski editing usi ke andar ho"). */}
          <Fold title={hi ? "बड़ी line और उसके नीचे के शब्द" : "Big line and the words under it"} open={foldIs("hero:0", true)} onToggle={() => foldTap("hero:0", true)}>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "सबसे ऊपर की बड़ी लाइन" : "Big line at the top"}</span><input value={site.hero?.headline ?? ""} onChange={(e) => setHero({ headline: e.target.value })} placeholder={s.defaults.headline} maxLength={90} className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "बड़ी लाइन के नीचे 1–2 लाइन" : "One or two lines under the big line"}</span><textarea value={site.hero?.sub ?? ""} onChange={(e) => setHero({ sub: e.target.value })} placeholder={s.defaults.sub} rows={2} maxLength={240} className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "WhatsApp बटन का टेक्स्ट" : "Words on the WhatsApp button"}</span><input value={site.hero?.ctaLabel ?? ""} onChange={(e) => setHero({ ctaLabel: e.target.value })} placeholder="WhatsApp" maxLength={30} className={field} /></label>
          <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5"><span className="text-sm font-medium">{hi ? "बड़ी लाइन के नीचे मेरी फ़ोटो + नाम" : "My photo + name under the big line"}</span><input type="checkbox" className="h-5 w-5" checked={!site.hideProfile} onChange={(e) => set({ hideProfile: !e.target.checked })} /></label>
          </Fold>
          <Fold title={hi ? "बदलते banner (2–3, अपने-आप बदलते हैं)" : "Sliding banners (2–3 that change by themselves)"} open={foldIs("hero:1", false)} onToggle={() => foldTap("hero:1", false)}>
          <SlidesEditor hi={hi} card={card} images={s.images} slides={site.hero?.slides ?? []} onChange={(slides) => setHero({ slides })} cardId={s.cardId} />
          </Fold>
          <Fold title={hi ? "ऊपर की picture" : "Picture at the top"} open={foldIs("hero:2", false)} onToggle={() => foldTap("hero:2", false)}>
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
          </Fold>
          <Fold title={hi ? "Website का logo" : "Website logo"} open={foldIs("hero:3", false)} onToggle={() => foldTap("hero:3", false)}>
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
          </Fold>
          <Fold title={hi ? "गोल बटन (WhatsApp / Call)" : "Round button (WhatsApp / Call)"} open={foldIs("hero:4", false)} onToggle={() => foldTap("hero:4", false)}>
          <div>
            <p className="text-sm font-semibold">{hi ? "गोल बटन (वेबसाइट पर)" : "Round button on the website"}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {([["whatsapp", "WhatsApp"], ["call", hi ? "Call" : "Call"], ["none", hi ? "कोई नहीं" : "None"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => set({ float: k })} className={chip((site.float ?? "whatsapp") === k)}>{l}</button>)}
            </div>
            <p className="text-[11px] text-muted">{hi ? "कंप्यूटर पर यह गोल बटन नीचे-बाएँ रहता है। फ़ोन पर नीचे Call · WhatsApp · Directions की पट्टी हमेशा रहती है।" : "On a computer the round button sits at the bottom left. On a phone, a Call · WhatsApp · Directions bar is always at the bottom."}</p>
          </div>
          </Fold>
          <button type="button" onClick={() => openPart("offer")} className="flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm font-semibold">📣 {hi ? "Offer की पट्टी या pop-up लगाना है? “Offer / pop-up” खोलें" : "Want an offer bar or a pop-up? Open “Offer / pop-up”"}<span className="text-brand-ink">→</span></button>
        </section>
      )}

      {tab === "home" && (
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
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
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_28px_-10px_rgba(16,24,40,0.18)]">
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
          <button type="button" onClick={() => { setGroup("content"); pick("text"); }} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">{hi ? "हर page का text बदलें, नया page जोड़ें" : "Change any page's text, add a page"} →</button>
        </section>
      )}

      </>)}
      </div>
      {unlock && <UnlockDialog reason="Make good-looking AI photos for your website." onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );
}

/** The Premium website's sliding banners (owner, 23 Oct 2026): up to 3, each its own big line, small line and picture. "AI से लिखें"
 *  fills three different big lines from the card's facts (/api/site/slides); the owner changes anything, then Save. */
/** The banner photos and, under each, which part of it stays in view (owner, 25 Nov 2026: "banner ko edit kar rahe hain to usi page pe
 *  saath me banner ke next option bhi de do"): first on the banner's screen and on its section card, with the way to change the photos. */
function BannerKeep({ hi, card, onKeep, onPhotos }: { hi: boolean; card: Card; onKeep: (i: number, f: string) => void; onPhotos: () => void }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const h = card.site?.hero;
  const all = h?.slides ?? [];
  // As the website draws it (photos/route.ts siteTop): two or more banners with a big line slide, each its own picture; else one banner.
  const many = all.filter((x) => x && x.headline).length >= 2;
  const one = card.site?.bannerUrl || card.coverUrl || "";
  const rows = many
    ? all.map((x, i) => ({ i, url: x.imageUrl || (i === 0 ? one : ""), own: x.focusOwn ? x.focus ?? "" : "" })).filter((r) => r.url)
    : one ? [{ i: -1, url: one, own: h?.focusOwn ? h.focus ?? "" : "" }] : [];
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface2/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-ink">{T("Banner photo — which part to keep", "Banner photo — कौन सा हिस्सा दिखे")}</p>
        <button type="button" onClick={onPhotos} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-ink hover:border-brand/60"><Camera className="h-3.5 w-3.5" /> {T("Change photos", "Photo बदलें")}</button>
      </div>
      {rows.length === 0 && <p className="text-[11px] text-muted">{T("No banner photo yet — tap Change photos.", "अभी banner photo नहीं है — Photo बदलें दबाएँ।")}</p>}
      {rows.map((r) => (
        <div key={r.i} className="flex items-center gap-2">
          <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-white"><Thumb src={r.url} alt="" /></span>
          <div className="min-w-0 flex-1">
            {many && <p className="text-[11px] font-semibold text-muted">{T(`Banner ${r.i + 1}`, `Banner ${r.i + 1}`)}</p>}
            <div className="flex flex-wrap gap-1">
              {KEEP.map(([f, en, hn]) => {
                const on = r.own === f;
                return <button key={f || "auto"} type="button" aria-pressed={on} onClick={() => onKeep(r.i, f)} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink"}`}>{T(en, hn)}</button>;
              })}
            </div>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted">{T("If a person is cut off in the banner, pick the side they stand on. The window shows it at once; press Save to keep it.", "Banner में कोई कट रहा हो तो वो जिस तरफ़ है वो चुनें। ऊपर तुरंत दिखेगा; रखने के लिए Save दबाएँ।")}</p>
    </div>
  );
}
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
              {photos.map((u) => <button key={u} type="button" onClick={() => setOne(i, { imageUrl: u, focus: undefined, focusOwn: undefined })} className={`h-11 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-white ${sl.imageUrl === u ? "border-brand" : "border-transparent"}`}><Thumb src={u} alt="" /></button>)}
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

/** One heading of a long part: a bar, and its boxes under it when open. */
function Fold({ title, open, onToggle, children }: { title: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border ${open ? "border-brand/40" : "border-border"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold ${open ? "rounded-t-xl bg-brand-soft/50" : "rounded-xl"}`}>
        <ChevronDown className={`h-4 w-4 shrink-0 text-brand transition-transform ${open ? "" : "-rotate-90"}`} /><span className="min-w-0 flex-1">{title}</span>
      </button>
      {open && <div className="space-y-3 p-3">{children}</div>}
    </div>
  );
}
/** Folds the groups of a part by themselves: every <div> that starts with its heading line becomes a bar with the rest under it. */
function FoldGroups({ prefix, is, tap, children }: { prefix: string; is: (id: string, first: boolean) => boolean; tap: (id: string, first: boolean) => void; children: React.ReactNode }) {
  const flat: React.ReactNode[] = [];
  const walk = (n: React.ReactNode) => Children.forEach(n, (c) => { if (isValidElement(c) && c.type === Fragment) walk((c.props as { children?: React.ReactNode }).children); else flat.push(c); });
  walk(children);
  let n = 0;
  return <>{flat.map((c, i) => {
    if (!isValidElement(c) || c.type !== "div") return <Fragment key={i}>{c}</Fragment>;
    // A group switched off for this screen (className "hidden") is not drawn at all.
    if (/(^|\s)hidden(\s|$)/.test(String((c.props as { className?: string }).className ?? ""))) return null;
    const kids = Children.toArray((c.props as { children?: React.ReactNode }).children);
    const head = kids[0];
    if (!isValidElement(head) || head.type !== "p" || !/font-semibold/.test(String((head.props as { className?: string }).className ?? ""))) return <Fragment key={i}>{c}</Fragment>;
    const id = `${prefix}:${n}`, first = n === 0; n += 1;
    return <Fold key={i} title={(head.props as { children?: React.ReactNode }).children} open={is(id, first)} onToggle={() => tap(id, first)}>{kids.slice(1)}</Fold>;
  })}</>;
}
