"use client";
import { authHeaders } from "@/lib/auth-headers";
import { isShubhoraCard } from "../../../bridge/shubhora-kb.mjs";
import { SITE_HOST } from "@/lib/site-url";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft, ExternalLink, Check, Cloud, ChevronUp, ChevronDown, Trash2,
  Plus, GripVertical, ShieldCheck, Sparkles, FileText, Image as ImageIcon,
  ListChecks, LayoutGrid, Video, MessageSquare, Type,
  Star, HelpCircle, Clock, CalendarClock, MapPin, BadgePercent, Package,
  LoaderCircle, Copy, AlertCircle, UserPlus, Eye, Pencil, X,
  CheckCircle2, CircleDot, CircleDashed, PauseCircle, Palette, MousePointerClick, SlidersHorizontal,
} from "lucide-react";
import type {
  Card, CardBlock, CardPage, CardLink, CardTemplate, LinkType,
} from "@/lib/types";
import { sampleCards } from "@/lib/sample-data";
import { CardView, type EditTarget } from "@/components/card-view";
import { useT } from "@/lib/poster-i18n";
import { linkOptions, setLinkPref } from "@/lib/link-pref";
import { BlockEditor } from "./block-editor";
import { ImageUpload } from "./image-upload";
import { TrainAiPanel, AiTextarea } from "./ai-fields";
import { TemplatePicker } from "./template-picker";
import { LOOKS } from "@/lib/looks";
import { loadOwnDetails, personalize, SEED_KEY, type OwnDetails } from "@/lib/card-personalize";
import { DomainConnect } from "@/components/domain-connect";
import { ShareKit } from "@/components/share-kit";
import { SeoPanel } from "./seo-panel";
import { useBrand, useCardHost } from "@/components/brand-context";
import type { CardTemplateDef } from "@/lib/templates";
import {
  publishCard, isCloudConfigured, fetchMyCardStrict, getSessionUser,
  checkUsername, cleanUsername, isDefaultUsername, nameSlug, suggestUsername, type UsernameCheck,
  getAccessToken, fetchCardDomain, type DomainState,
} from "@/lib/cloud";

/** Cheap stable hash of a card's content — used to tell whether a local
 *  draft was made from the cloud version currently on file. */
function fingerprint(c: Card): string {
  const str = JSON.stringify({ ...c, id: undefined });
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${str.length}`;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// The twelve looks (src/lib/looks.ts): the swatch shows each look's own header treatment in the owner's colour.
const templates: { id: CardTemplate; label: string; cover: (theme: string) => string }[] = LOOKS.map((l) => ({ id: l.key, label: l.name, cover: l.cover }));
const swatches = ["#0e9e90", "#14b8a6", "#6d5cf5", "#2563eb", "#f2a33c", "#e5673b", "#d24b4b", "#0d9488"];
const linkTypes: LinkType[] = ["phone", "whatsapp", "email", "website", "instagram", "facebook", "linkedin", "youtube", "location", "upi"];
/** Proper names for the button types (the raw keys read "Whatsapp", "Upi"…). */
const LINK_NAMES: Partial<Record<LinkType, string>> = {
  phone: "Call", whatsapp: "WhatsApp", email: "Email", website: "Website", instagram: "Instagram", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube", location: "Map", upi: "UPI payment",
};

const blockKinds: { kind: CardBlock["kind"]; label: string; icon: typeof Type }[] = [
  { kind: "about", label: "Text", icon: Type },
  { kind: "highlights", label: "Highlights", icon: ListChecks },
  { kind: "services", label: "Services", icon: LayoutGrid },
  { kind: "product", label: "Products", icon: Package },
  { kind: "gallery", label: "Gallery", icon: ImageIcon },
  { kind: "image", label: "Photos", icon: ImageIcon },
  { kind: "carousel", label: "Slider (arrows)", icon: ImageIcon },
  { kind: "video", label: "Video", icon: Video },
  { kind: "pdf", label: "PDF", icon: FileText },
  { kind: "testimonials", label: "Testimonials", icon: Star },
  { kind: "faq", label: "FAQ", icon: HelpCircle },
  { kind: "hours", label: "Business hours", icon: Clock },
  { kind: "appointment", label: "Appointment", icon: CalendarClock },
  { kind: "location", label: "Location", icon: MapPin },
  { kind: "offer", label: "Offer / coupon", icon: BadgePercent },
  { kind: "contact", label: "Contact", icon: MessageSquare },
  { kind: "cta", label: "Join now / referral link", icon: UserPlus },
  { kind: "compare", label: "Us vs them (comparison)", icon: ListChecks },
  { kind: "showcase", label: "Showcase (picture tiles with links)", icon: LayoutGrid },
];

function newBlock(kind: CardBlock["kind"]): CardBlock {
  const id = uid();
  switch (kind) {
    case "about": return { id, kind, title: "About", body: "" };
    case "highlights": return { id, kind, title: "Highlights", items: [""] };
    case "services": return { id, kind, title: "Services", items: [{ name: "", desc: "" }] };
    case "product": return {
      id, kind, title: "Products",
      items: [{ name: "", imageUrl: "", mrp: "", price: "", badge: "", desc: "", features: [""], specs: [{ label: "", value: "" }], ctaLabel: "Order on WhatsApp" }],
    };
    case "gallery": return { id, kind, title: "Gallery", images: [{ color: "#0e9e90", label: "" }] };
    case "image": return { id, kind, title: "Photos", images: [{ url: "" }] };
    case "carousel": return { id, kind, title: "Our products", images: [{ url: "" }, { url: "" }, { url: "" }] };
    case "video": return { id, kind, title: "Video", url: "", caption: "" };
    case "pdf": return { id, kind, title: "File", fileLabel: "Brochure.pdf" };
    case "testimonials": return { id, kind, title: "What customers say", items: [{ name: "", text: "", rating: 5 }] };
    case "faq": return { id, kind, title: "FAQ", items: [{ q: "", a: "" }] };
    case "hours": return {
      id, kind, title: "Business hours",
      rows: [
        { day: "Mon – Sat", time: "10:00 – 19:00" },
        { day: "Sunday", time: "Closed" },
      ],
    };
    case "appointment": return { id, kind, title: "Book a demo", url: "", note: "Free 15-min call" };
    case "location": return { id, kind, title: "Visit us", address: "" };
    case "offer": return { id, kind, title: "Special offer", text: "", code: "", expires: "" };
    case "contact": return { id, kind, title: "Get in touch" };
    case "cta": return { id, kind, title: "Join now", body: "", joinUrl: "", joinLabel: "Join Now", referralCode: "" };
    case "compare": return { id, kind, title: "How we compare", leftLabel: "Us", rightLabel: "Competitor", rows: [{ feature: "", left: "", right: "" }] };
    case "showcase": return { id, kind, title: "Our work", items: [{ imageUrl: "", label: "", sub: "", url: "" }] };
  }
}

function blankCard(id: string): Card {
  // Unique-ish default so two new users never collide on the same public URL.
  const slug = `card-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id, username: slug, name: "Your Name", jobTitle: "Your Title",
    company: "Your Company", tagline: "One line about you", about: "",
    avatarColor: "#0e9e90", themeColor: "#0e9e90", template: "gradient", verified: false,
    links: [{ id: uid(), type: "whatsapp", label: "WhatsApp", value: "+91" }],
    pages: [{ id: uid(), slug: "home", label: "Home", blocks: [newBlock("about")] }],
    plan: "free", active: true, views: 0, createdAt: "2026-08-02",
  };
}

type Tab = "content" | "design" | "links" | "settings";

/** Grip-handle drag-and-drop reordering for a list. Spread `handle(i)` on the
 *  grip element and `drop(i)` on the row wrapper. Arrows remain as fallback. */
function useDragReorder<T>(items: T[], commit: (next: T[]) => void) {
  const from = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return {
    over,
    handle: (i: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        from.current = i;
        e.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: () => { from.current = null; setOver(null); },
    }),
    drop: (i: number) => ({
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(i); },
      onDragLeave: () => setOver((o) => (o === i ? null : o)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const f = from.current;
        from.current = null;
        setOver(null);
        if (f === null || f === i) return;
        const next = items.slice();
        const [moved] = next.splice(f, 1);
        next.splice(i, 0, moved);
        commit(next);
      },
    }),
  };
}

export function CardEditor({ id }: { id: string }) {
  const router = useRouter();
  const initial = useMemo(() => (id === "new" ? blankCard(uid()) : blankCard(id)), [id]);
  const [card, setCard] = useState<Card>(initial);
  const [tab, setTab] = useState<Tab>("content");
  const [activePage, setActivePage] = useState(initial.pages[0]?.id ?? "");
  const [qr, setQr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);
  // The card could not be read (no network / session not ready / not found). Never fall back to a blank card with
  // the same id: pressing Save on that would replace the live card with "Your Name". A retry screen instead.
  const [loadErr, setLoadErr] = useState<"" | "offline" | "missing">("");
  const [attempt, setAttempt] = useState(0);
  const [pub, setPub] = useState<{ state: "idle" | "busy" | "done" | "error"; msg?: string }>({ state: "idle" });
  // Draft or live? (owner's call, 25 Sep 2026: people could not tell.) `liveBase` is the fingerprint of the card as it
  // is live right now — null while it has never been published. Anything different on screen = "changes not live yet".
  const [liveBase, setLiveBase] = useState<string | null>(null);
  // The link the card is live on right now — the link field says "your live link" instead of "free — tap Save".
  const [savedUser, setSavedUser] = useState("");
  // Phone-width editor: one thing at a time — the form, or the card preview (tap "Edit" on the preview to jump back).
  const [view, setView] = useState<"edit" | "preview">("edit");
  // Hindi labels inside the Shubhora app when the app is in Hindi; the desktop dashboard stays English.
  const { lang } = useT();
  const pathname = usePathname();
  const hi = lang === "hi" && !!pathname?.startsWith("/poster");
  const L = (en: string, hiText: string) => (hi ? hiText : en);
  // Local drafts are namespaced per user — otherwise two people sharing a
  // browser (or a logout/login) would inherit each other's unsaved edits.
  const [draftKey, setDraftKey] = useState<string | null>(null);
  // New cards start on the template picker (skipped once a draft exists).
  const [picking, setPicking] = useState(id === "new");
  // An unsaved /cards/new draft is offered on the picker instead of silently
  // resuming — otherwise "New card" would always reopen the old draft.
  const [pendingDraft, setPendingDraft] = useState<Card | null>(null);

  // ?template=<key> jumps straight into that template: on /cards/new as the starting point, and on an EXISTING card
  // (…/editor?id=<id>&template=vcard-reseller) as "replace my pages with this design" — the link, username and plan
  // stay; the owner still publishes by hand. The existing card must be loaded first, or the load would undo it.
  const templated = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || templated.current) return;
    if (id !== "new" && !loaded) return;
    const key = new URLSearchParams(window.location.search).get("template");
    if (!key) return;
    templated.current = true;
    authHeaders().then((headers) => fetch("/api/templates", { headers }))
      .then((r) => r.json())
      .then((d: { templates: CardTemplateDef[] }) => {
        const tpl = d.templates?.find((x) => x.key === key);
        if (tpl) { applyTemplate(tpl, id !== "new"); setPendingDraft(null); }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loaded]);

  // The owner's own details from the setup: a picked template is filled with them straight away.
  const [own, setOwn] = useState<OwnDetails | null>(null);
  useEffect(() => { loadOwnDetails().then(setOwn).catch(() => {}); }, []);

  // ?seed=1: a card the AI just made (/poster/card/build) opens here for editing before it is published.
  const seeded = useRef(false);
  useEffect(() => {
    if (!loaded || seeded.current || typeof window === "undefined" || new URLSearchParams(window.location.search).get("seed") !== "1") return;
    seeded.current = true;
    let seed: Partial<Card> | null = null;
    try { seed = JSON.parse(sessionStorage.getItem(SEED_KEY) ?? "null"); sessionStorage.removeItem(SEED_KEY); } catch { seed = null; }
    if (!seed?.pages?.length) return;
    setCard((c) => ({ ...c, ...seed, id: c.id, username: seed!.username || c.username, plan: c.plan, active: c.active, views: c.views, createdAt: c.createdAt }));
    setActivePage(seed.pages[0]?.id ?? "");
    setPendingDraft(null);
    setPicking(false);
  }, [loaded]);

  // ?pick=1 on an existing card opens the design picker ("Change design").
  useEffect(() => {
    if (id !== "new" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pick") === "1") setPicking(true);
  }, [id]);

  function applyTemplate(tpl: CardTemplateDef, silent = false) {
    if (id !== "new" && !silent && !confirm("Use this design? Your card's pages are replaced by the design's pages, filled with your details. Publish only when you are happy.")) return;
    const data = tpl.key === "ai" ? tpl.data : personalize(tpl.data, own, { keepSamples: !!tpl.brand || !!tpl.keepContent, identityOnly: !!tpl.keepContent });
    setCard((c) => ({
      ...c,
      ...data,
      id: c.id,
      username: c.username,
      plan: c.plan, active: c.active, views: c.views, createdAt: c.createdAt,
      // A new design = a new business on the card: the old Google title / description / keywords go with the old
      // pages (they kept the previous business name). The owner's site-verification code stays.
      seoTitle: data.seoTitle ?? "", seoDescription: data.seoDescription ?? "",
      seo: { ...(data.seo ?? {}), ...(c.seo?.googleVerify ? { googleVerify: c.seo.googleVerify } : {}) },
    }));
    setActivePage(data.pages[0]?.id ?? "");
    setPicking(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadErr("");
      let me = await getSessionUser().catch(() => null);
      if (!me && id !== "new" && isCloudConfigured()) {
        // the session can take a moment on a slow phone — one more try before giving up
        await new Promise((r) => setTimeout(r, 1200));
        me = await getSessionUser().catch(() => null);
      }
      const key = `ne-card-${me?.id ?? "guest"}-${id}`;
      if (cancelled) return;
      setDraftKey(key);

      // 1) my card from the cloud (ownership enforced server-side)
      if (id !== "new" && isCloudConfigured() && !sampleCards.some((c) => c.id === id)) {
        if (!me) { setLoadErr("offline"); setLoaded(true); return; }
        let mine: Card | null = null;
        try { mine = await fetchMyCardStrict(id, me.id); } catch { if (!cancelled) { setLoadErr("offline"); setLoaded(true); } return; }
        if (cancelled) return;
        if (!mine) { setLoadErr("missing"); setLoaded(true); return; }
        if (mine) {
          setCard(mine);
          setActivePage(mine.pages[0]?.id ?? "");
          // A local draft is only trusted if it was started from THIS cloud
          // version. If the cloud copy changed elsewhere (another device, an
          // admin fix), a stale draft must not silently win — publishing it
          // would roll the live card back.
          const base = fingerprint(mine);
          if (mine.active !== false) { setLiveBase(base); setSavedUser(mine.username); }
          try { localStorage.setItem(`${key}:base`, base); } catch { /* ignore */ }
          applyDraft(key, mine.id, base);
          setLoaded(true);
          return;
        }
      }

      // 2) demo mode (no cloud): the sample card is fine to explore
      if (!me && !isCloudConfigured()) {
        const demo = sampleCards.find((c) => c.id === id);
        if (demo) {
          setCard(demo);
          setActivePage(demo.pages[0]?.id ?? "");
          applyDraft(key, demo.id);
          setLoaded(true);
          return;
        }
      }

      // 3) logged in but this id isn't mine → don't show anyone else's card
      if (me && id !== "new" && sampleCards.some((c) => c.id === id)) {
        setDenied(true);
        setLoaded(true);
        return;
      }

      // 4) brand-new card
      applyDraft(key, id);
      setLoaded(true);
    })();

    function applyDraft(key: string, cardId: string, base?: string) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        if (base !== undefined) {
          const draftBase = localStorage.getItem(`${key}:draft-base`);
          if (draftBase !== base) {
            // Draft predates the current cloud version — drop it.
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}:draft-base`);
            return;
          }
        }
        const parsed = JSON.parse(raw) as Card;
        parsed.id = cardId;
        if (id === "new") {
          // offer it on the picker rather than jumping straight in
          setPendingDraft(parsed);
          return;
        }
        setCard(parsed);
        setActivePage(parsed.pages[0]?.id ?? "");
      } catch { /* ignore */ }
    }

    return () => { cancelled = true; };
  }, [id, attempt]);

  // autosave the draft locally (per user + card) — tracked so the header
  // badge tells the truth instead of always claiming success (a full quota,
  // e.g. from embedded base64 media, used to fail silently here).
  const [localSaveError, setLocalSaveError] = useState(false);
  useEffect(() => {
    if (!loaded || !draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(card));
      const base = localStorage.getItem(`${draftKey}:base`);
      if (base) localStorage.setItem(`${draftKey}:draft-base`, base);
      setLocalSaveError(false);
    } catch {
      setLocalSaveError(true);
    }
  }, [card, loaded, draftKey]);

  // live QR — points at the branded address on a partner host
  const cardHost = useCardHost();
  const brand = useBrand();
  const publicHost = cardHost(card.username);
  useEffect(() => {
    QRCode.toDataURL(`https://${publicHost}`, {
      width: 480, margin: 1, color: { dark: card.themeColor, light: "#ffffff" },
    }).then(setQr).catch(() => {});
  }, [publicHost, card.themeColor]);

  /* ---------- mutators ---------- */
  const patch = (p: Partial<Card>) => setCard((c) => ({ ...c, ...p }));

  const setPages = (pages: CardPage[]) => patch({ pages });
  const updatePage = (pid: string, up: Partial<CardPage>) =>
    setPages(card.pages.map((p) => (p.id === pid ? { ...p, ...up } : p)));
  const addPage = () => {
    const np: CardPage = { id: uid(), slug: "page-" + (card.pages.length + 1), label: "New Page", blocks: [] };
    setPages([...card.pages, np]); setActivePage(np.id); setTab("content");
  };
  const removePage = (pid: string) => {
    if (card.pages.length <= 1) return;
    const rest = card.pages.filter((p) => p.id !== pid);
    setPages(rest);
    if (activePage === pid) setActivePage(rest[0].id);
  };
  const movePage = (pid: string, dir: -1 | 1) => {
    const i = card.pages.findIndex((p) => p.id === pid);
    const j = i + dir;
    if (j < 0 || j >= card.pages.length) return;
    const next = card.pages.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next);
  };


  const setLinks = (links: CardLink[]) => patch({ links });
  const addLink = () => setLinks([...card.links, { id: uid(), type: "website", label: "Website", value: "" }]);
  const updateLink = (lid: string, up: Partial<CardLink>) =>
    setLinks(card.links.map((l) => (l.id === lid ? { ...l, ...up } : l)));
  const removeLink = (lid: string) => setLinks(card.links.filter((l) => l.id !== lid));
  const moveLink = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= card.links.length) return;
    const next = card.links.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setLinks(next);
  };

  const inApp = !!pathname?.startsWith("/poster");
  /** The one Save: publishes the card (first time = it goes live) and opens the card page with its link and QR. */
  async function save() {
              if (!isCloudConfigured()) {
                setPub({ state: "error", msg: "Cloud not configured yet — edits stay in this browser." });
                return;
              }
              setPub({ state: "busy" });
              // First publish with the auto-assigned slug? Build the link from
              // the person's name (rajkumar, rajkumar2, …). The field in
              // Settings stays fully editable — this only fills the default.
              let toPublish = card;
              if (isDefaultUsername(card.username)) {
                const named = await suggestUsername(card.name, card.id);
                if (named) {
                  toPublish = { ...card, username: named };
                  patch({ username: named });
                }
              }
              const wasLive = liveBase !== null;
              const res = await publishCard(toPublish);
              if (res.ok) {
                const saved = { ...toPublish, username: res.username || toPublish.username };
                if (saved.username !== card.username) patch({ username: saved.username });
                setLiveBase(fingerprint(saved));
                setSavedUser(saved.username);
                // the draft is now a real card — don't offer it as "unsaved" again
                if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
                if (wasLive) {
                  // An edit to a live card (owner's review, 25 Sep 2026): stay here — "Saved", keep editing. Being sent
                  // to the card page after every small change was tiring.
                  setPub({ state: "done", msg: L("Saved — your card is updated.", "Save हो गया — आपका card update हो गया।") });
                  setTimeout(() => setPub((p) => (p.state === "done" ? { state: "idle" } : p)), 4000);
                } else {
                  // First time live: the card page with the link, QR and share buttons (owner's call, 24 Sep 2026).
                  setPub({ state: "done", msg: `${L("Saved! Your card is live", "Save हो गया! Card live है")} — ${cardHost(saved.username)}` });
                  setTimeout(() => router.push("/poster/card?published=1"), 700);
                }
              } else {
                setPub({ state: "error", msg: res.error });
              }
            }

  // "Setup", not "Settings": the sidebar already has a Settings page for the
  // account, and two identically-named screens sent people to the wrong one.
  const tabs: { id: Tab; label: string; icon: typeof Type }[] = [
    { id: "content", label: L("Text & photos", "शब्द और photo"), icon: Type },
    { id: "design", label: L("Look", "रूप-रंग"), icon: Palette },
    { id: "links", label: L("Buttons", "Buttons"), icon: MousePointerClick },
    { id: "settings", label: L("More", "और"), icon: SlidersHorizontal },
  ];

  /* ---------- draft / live ---------- */
  const current = useMemo(() => fingerprint(card), [card]);
  const status: "draft" | "live" | "changed" | "off" = !card.active ? "off" : liveBase === null ? "draft" : current === liveBase ? "live" : "changed";
  useEffect(() => { if (pub.state === "done" && status !== "live") setPub({ state: "idle" }); }, [status, pub.state]);

  /* ---------- jump to a part of the card: ✏️ on the preview, or ?focus=… from the card checklist ---------- */
  function flash(elId: string) {
    setTimeout(() => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-brand", "rounded-2xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-brand"), 1800);
    }, 90);
  }
  function editFrom(t: EditTarget) {
    setView("edit");
    if (t.kind === "profile") { setTab("content"); flash("ed-profile"); return; }
    if (t.kind === "links") { setTab("links"); flash("ed-links"); return; }
    const pg = card.pages.find((p) => p.blocks.some((b) => b.id === t.blockId));
    if (pg) setActivePage(pg.id);
    setTab("content");
    flash(`ed-block-${t.blockId}`);
  }
  // ?focus=hours|location|gallery|product|testimonials|about|photo|cover|tagline|upi|whatsapp — the "Make your card
  // complete" checklist sends people straight to the missing piece; a missing section is added on the first page.
  const focused = useRef(false);
  useEffect(() => {
    if (!loaded || focused.current || typeof window === "undefined") return;
    const f = new URLSearchParams(window.location.search).get("focus") ?? "";
    if (!f) return;
    focused.current = true;
    if (f === "photo" || f === "cover" || f === "tagline") { editFrom({ kind: "profile" }); return; }
    if (f === "upi" || f === "whatsapp") {
      const have = card.links.find((l) => l.type === f && l.value.trim().length > 3);
      const newId = uid();
      if (!have) {
        setCard((c) => ({ ...c, links: [...c.links.filter((l) => !(l.type === f && l.value.trim().length <= 3)), { id: newId, type: f, label: f === "upi" ? "Pay by UPI" : "WhatsApp", value: f === "whatsapp" ? "+91" : "" }] }));
      }
      setView("edit"); setTab("links");
      flash(`ed-link-${have ? have.id : newId}`);
      return;
    }
    const kinds = f === "reviews" ? ["testimonials"] : f === "gallery" ? ["gallery", "image", "carousel"] : f === "products" ? ["product"] : [f];
    if (!blockKinds.some((k) => k.kind === kinds[0])) return;
    const hit = card.pages.flatMap((p) => p.blocks.map((b) => ({ p, b }))).find(({ b }) => kinds.includes(b.kind));
    if (hit) { editFrom({ kind: "block", blockId: hit.b.id }); return; }
    const nb = newBlock(kinds[0] as CardBlock["kind"]);
    const home = card.pages[0];
    if (!home) return;
    setCard((c) => ({ ...c, pages: c.pages.map((p, i) => (i === 0 ? { ...p, blocks: [...p.blocks, nb] } : p)) }));
    setActivePage(home.id);
    setTab("content");
    flash(`ed-block-${nb.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // drag-and-drop reordering (grip handles)
  const linksDnd = useDragReorder(card.links, setLinks);

  if (loadErr) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="rounded-2xl border border-border bg-surface p-8 space-y-3">
          <p className="text-4xl">{loadErr === "offline" ? "📶" : "🔍"}</p>
          <h1 className="text-lg font-semibold">{loadErr === "offline" ? L("Your card did not load", "आपका card load नहीं हुआ") : L("Card not found", "Card नहीं मिला")}</h1>
          <p className="text-sm text-muted">{loadErr === "offline"
            ? L("Check the internet and try again. Nothing on your card has changed.", "Internet check करके फिर से कोशिश करें। आपके card में कुछ नहीं बदला।")
            : L("This card is not on your account. Open your own card from My V-Card.", "ये card आपके account में नहीं है। My V-Card से अपना card खोलें।")}</p>
          {loadErr === "offline"
            ? <button type="button" onClick={() => { setLoaded(false); setAttempt((n) => n + 1); }} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">{L("Try again", "फिर से कोशिश करें")}</button>
            : <Link href="/poster/card" className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">{L("My V-Card", "मेरा V-Card")}</Link>}
        </div>
      </div>
    );
  }

  if (!loaded && id !== "new") return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  if (picking) {
    return (
      <TemplatePicker
        onCancel={id !== "new" ? () => setPicking(false) : undefined}
        onPick={(tpl) => { setPendingDraft(null); applyTemplate(tpl); }}
        draft={pendingDraft}
        onResumeDraft={() => {
          if (!pendingDraft) return;
          setCard(pendingDraft);
          setActivePage(pendingDraft.pages[0]?.id ?? "");
          setPendingDraft(null);
          setPicking(false);
        }}
        onDiscardDraft={() => {
          if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
          setPendingDraft(null);
        }}
      />
    );
  }

  if (denied) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="rounded-2xl border border-border bg-surface p-8">
          <h1 className="text-lg font-semibold tracking-tight">This card isn&apos;t yours</h1>
          <p className="mt-2 text-sm text-muted">
            You can only edit cards on your own account.
          </p>
          <Link href="/cards"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">
            Go to My Cards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-0 max-w-full overflow-x-hidden">
      {/* Name of the card + its link. Inside the app the page above already has a back arrow, so no second one. */}
      <div className="flex items-center gap-3 min-w-0">
        {!inApp && <Link href="/cards" className="text-muted hover:text-ink shrink-0"><ArrowLeft className="h-5 w-5" /></Link>}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight truncate">{(card.lead === "business" && card.company?.trim() ? card.company : card.name) || L("My card", "मेरा card")}</h1>
          <p className="text-xs text-muted mono truncate">{publicHost}</p>
        </div>
        {liveBase !== null && (
          <Link href={`/c/${card.username}`} target="_blank" className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">
            <ExternalLink className="h-4 w-4" /> {L("See card", "Card देखें")}
          </Link>
        )}
      </div>

      {/* ONE box, ONE button (owner's call, 25 Sep 2026 — simple enough for a child): what the card is right now,
          and "Save". Live and nothing changed → the button rests as "Saved". */}
      <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${localSaveError ? "border-danger/40 bg-danger/10" : status === "live" ? "border-good/40 bg-good/10" : "border-amber/50 bg-amber/10"}`}>
        {localSaveError ? <AlertCircle className="h-6 w-6 shrink-0 text-danger" />
          : status === "live" ? <CheckCircle2 className="h-6 w-6 shrink-0 text-good" />
          : status === "changed" ? <CircleDot className="h-6 w-6 shrink-0 text-amber" />
          : status === "draft" ? <CircleDashed className="h-6 w-6 shrink-0 text-amber" />
          : <PauseCircle className="h-6 w-6 shrink-0 text-muted" />}
        <p className="min-w-0 flex-1 text-sm leading-snug">
          {localSaveError ? <b className="text-danger">{L("Phone storage is full — tap Save now.", "Phone की storage भर गई — अभी Save दबाएँ।")}</b>
            : status === "live" ? <><b className="text-good">{L("Your card is live", "आपका card live है")}</b><span className="block text-xs text-muted">{L("All changes are saved.", "सारे बदलाव save हैं।")}</span></>
            : status === "changed" ? <><b>{L("Changes not saved", "बदलाव save नहीं हुए")}</b><span className="block text-xs text-muted">{L("Tap Save to update your card.", "Card update करने के लिए Save दबाएँ।")}</span></>
            : status === "draft" ? <><b>{L("Not published yet", "अभी publish नहीं हुआ")}</b><span className="block text-xs text-muted">{L("Tap Save to make your card live.", "Card live करने के लिए Save दबाएँ।")}</span></>
            : <><b>{L("Card is switched off", "Card बंद है")}</b><span className="block text-xs text-muted">{L("Turn it on in More → Card active.", "और → Card active से चालू करें।")}</span></>}
        </p>
        <button type="button" onClick={save} disabled={pub.state === "busy" || (status === "live" && !localSaveError)}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-base font-bold shadow-card disabled:shadow-none ${status === "live" && !localSaveError ? "bg-surface text-good border border-good/40" : "grad-brand text-white"} disabled:opacity-90`}>
          {pub.state === "busy" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : status === "live" ? <Check className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
          {pub.state === "busy" ? L("Saving…", "Save हो रहा है…") : status === "live" && !localSaveError ? L("Saved", "Saved") : L("Save", "Save")}
        </button>
      </div>

      {pub.msg && (
        <p className={`text-sm font-semibold ${pub.state === "error" ? "text-danger" : "text-good"}`}>
          {pub.msg}
        </p>
      )}

      {/* Two columns only when the editor itself is wide (container query), not the screen: inside the phone-width
          Shubhora app (/poster/d/editor) a wide computer screen used to squeeze the form into a sliver. */}
      <div className="@container min-w-0">
      {/* Phone width: Edit or Preview, one at a time (on a wide screen both show side by side). */}
      <div className="@3xl:hidden mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1">
        {([["edit", L("Edit", "बदलें"), Pencil], ["preview", L("Preview", "Preview"), Eye]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => { setView(k); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } }}
            className={`inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold ${view === k ? "bg-surface shadow-sm text-ink" : "text-muted"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <p className="@3xl:hidden -mt-2 mb-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        {view === "edit"
          ? <>{L("Tip: in Preview, tap", "आसान तरीका: Preview में")} <span className="inline-flex items-center gap-1 rounded-full bg-[#12144a] px-2 py-0.5 text-[10px] font-semibold text-white"><Pencil className="h-2.5 w-2.5" /> {L("Edit", "बदलें")}</span> {L("on any part to change it.", "पर tap करके कुछ भी बदलें।")}</>
          : <>{L("Tap", "जो बदलना है उस पर")} <span className="inline-flex items-center gap-1 rounded-full bg-[#12144a] px-2 py-0.5 text-[10px] font-semibold text-white"><Pencil className="h-2.5 w-2.5" /> {L("Edit", "बदलें")}</span> {L("on the part you want to change.", "tap करें।")}</>}
      </p>
      <div className="grid @3xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start min-w-0">
        {/* ---------------- Controls ---------------- */}
        <div className={`min-w-0 ${view === "preview" ? "hidden @3xl:block" : ""}`}>
          {/* tab bar — the same pill style as the pages on the card: the open tab tinted, the others outlined */}
          {/* Four equal tiles, all visible at once (a scrolling pill row hid "More" off the edge). */}
          <div className="mb-4 grid grid-cols-4 gap-2">
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 text-center text-[12px] font-semibold leading-tight transition-all ${on ? "border-brand bg-brand-soft text-brand-ink shadow-card" : "border-border bg-surface text-ink hover:bg-surface2"}`}>
                  <t.icon className={`h-5 w-5 ${on ? "text-brand" : "text-muted"}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ---- CONTENT ---- */}
          {tab === "content" && (
            <div className="space-y-6">
              <Panel id="ed-profile" title={L("Your photo & name", "आपकी photo और नाम")}>
                <div className="grid @xl:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[13px] font-medium mb-1 block text-muted">{L("Profile photo", "आपकी photo / logo")}</span>
                    <ImageUpload shape="avatar" round={(card.avatarShape ?? "circle") === "circle"}
                      value={card.avatarUrl} onChange={(url) => patch({ avatarUrl: url })} />
                    {/* A circle clips logos/product shots — square shows them fully */}
                    <div className="mt-2 flex gap-1 p-1 rounded-lg border border-border bg-surface2/50 w-fit">
                      {([
                        { id: "circle", label: "Circle" },
                        { id: "square", label: "Square" },
                      ] as const).map((s) => {
                        const on = (card.avatarShape ?? "circle") === s.id;
                        return (
                          <button key={s.id} onClick={() => patch({ avatarShape: s.id })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${on ? "bg-surface shadow-card" : "text-muted hover:text-ink"}`}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted mt-1">{L("Logo? Choose Square.", "Logo है? Square चुनें।")}</p>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium mb-1 block text-muted">{L("Banner / cover", "ऊपर की बड़ी photo (banner)")}</span>
                    <ImageUpload shape="cover" value={card.coverUrl} onChange={(url) => patch({ coverUrl: url })} />
                  </div>
                </div>
                <Field label={L("Full name", "पूरा नाम")}><input className="ed-input" value={card.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
                <div className="grid @xl:grid-cols-2 gap-3">
                  <Field label={L("Job title", "पद / काम")}><input className="ed-input" value={card.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} /></Field>
                  <Field label={L("Company", "Business / company")}><input className="ed-input" value={card.company} onChange={(e) => patch({ company: e.target.value })} /></Field>
                </div>
                <Field label={<span className="flex items-center gap-1.5">{L("Tagline", "एक line (tagline)")} <Sparkles className="h-3.5 w-3.5 text-ai" /><span className="text-ai text-[11px] mono">AI writer</span></span>}>
                  <AiTextarea
                    value={card.tagline}
                    onChange={(v) => patch({ tagline: v })}
                    task="tagline"
                    role={card.jobTitle}
                    company={card.company}
                    minH="min-h-11"
                    rows={1}
                    placeholder="One punchy line about what you do"
                  />
                </Field>
              </Panel>

              {/* Every page of the card, one after the other (owner's call, 28 Sep 2026: only the open page's text used to
                  show — people thought the rest was missing). Each page: its name, arrows, bin, then its sections. */}
              <div id="ed-pages" className="scroll-mt-28 rounded-2xl border border-border bg-surface p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{L("Pages on your card", "Card के pages")} <span className="font-normal text-muted">({card.pages.length})</span></h2>
                  <button className="ed-add !w-auto" onClick={addPage}><Plus className="h-3.5 w-3.5" /> {L("Add page", "Page जोड़ें")}</button>
                </div>
                <p className="mt-1 text-xs text-muted">{L("Tap a page name to jump to it. Below, every page's text and photos are open for editing.", "Page के नाम पर tap करके वहाँ जाएँ। नीचे हर page के शब्द और photo बदल सकते हैं।")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {card.pages.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setActivePage(p.id); flash(`ed-page-${p.id}`); }}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.id === activePage ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{p.label || L("Page", "Page")}</button>
                  ))}
                </div>
              </div>
              {card.pages.map((p, i) => (
                <PageSections key={p.id} page={p} index={i} total={card.pages.length} L={L}
                  onRename={(label) => updatePage(p.id, { label, slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page" })}
                  onMove={(dir) => movePage(p.id, dir)} onRemove={() => removePage(p.id)}
                  onBlocks={(blocks) => updatePage(p.id, { blocks })} onFocus={() => setActivePage(p.id)} />
              ))}
            </div>
          )}

          {/* ---- DESIGN ---- */}
          {tab === "design" && (
            <div className="space-y-6">
              <Panel title={L("Look", "Card का रूप")}>
                <p className="-mt-1 text-xs text-muted">{L("Tap a look — the card below changes at once. Then tap Save.", "किसी look पर tap करें — नीचे card तुरंत बदल जाता है। फिर Save दबाएँ।")}</p>
                <div className="grid grid-cols-3 @xl:grid-cols-4 gap-2">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => patch({ template: t.id })}
                      className={`rounded-xl border overflow-hidden text-left ${card.template === t.id ? "border-brand ring-1 ring-brand" : "border-border"}`}>
                      <div className="h-10" style={{ background: t.cover(card.themeColor) }} />
                      <div className="px-2 py-1 text-[11px] font-medium truncate">{t.label}</div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title={L("Theme color", "Card का रंग")}>
                <div className="flex flex-wrap gap-2 items-center">
                  {swatches.map((s) => (
                    <button key={s} onClick={() => patch({ themeColor: s, avatarColor: s })}
                      className={`h-8 w-8 rounded-full transition-transform ${card.themeColor === s ? "ring-2 ring-offset-2 ring-offset-bg scale-110" : ""}`}
                      style={{ background: s, boxShadow: card.themeColor === s ? `0 0 0 2px ${s}` : "none" }} aria-label={s} />
                  ))}
                  <label className="flex items-center gap-2 text-sm text-muted ml-1">
                    Custom
                    <input type="color" value={card.themeColor} onChange={(e) => patch({ themeColor: e.target.value, avatarColor: e.target.value })}
                      className="h-8 w-8 rounded-lg border border-border bg-transparent" />
                  </label>
                </div>
              </Panel>

              <Panel title="Options">
                <Toggle checked={!!card.verified} onChange={(v) => patch({ verified: v })}
                  icon={<ShieldCheck className="h-4 w-4 text-brand" />} label="Verified badge" hint="Show a verified check next to your name." />
              </Panel>

              {/* Phone: the card right under the looks, so each tap on a look or a colour shows at once (owner's call,
                  28 Sep 2026) — no more Preview → Edit → Preview. Wide screens already have the preview beside the form. */}
              <div className="@3xl:hidden">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><Eye className="h-3.5 w-3.5" /> {L("This is how your card looks now — scroll inside to see more", "आपका card अभी ऐसा दिखता है — और देखने के लिए अंदर scroll करें")}</p>
                <div className="rounded-[1.5rem] border-[6px] border-ink/90 bg-bg overflow-hidden shadow-float max-h-[70vh] overflow-y-auto overflow-x-hidden no-scrollbar">
                  <div className="w-full min-w-0 [&>*]:max-w-full">
                    {qr && <CardView key={`design-${card.template}-${card.themeColor}`} card={card} qr={qr} onEdit={editFrom} editLabel={L("Edit", "बदलें")} />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- LINKS ---- */}
          {tab === "links" && (
            <Panel id="ed-links" title={L("Buttons — call, WhatsApp, UPI, map…", "Buttons — call, WhatsApp, UPI, map…")} action={<button className="ed-add !w-auto" onClick={addLink}><Plus className="h-3.5 w-3.5" /> {L("Add button", "Button जोड़ें")}</button>}>
              <div className="space-y-2">
                {card.links.map((l, i) => (
                  <div key={l.id} id={`ed-link-${l.id}`} {...linksDnd.drop(i)}
                    className={`rounded-lg border p-2.5 space-y-2 ${linksDnd.over === i ? "border-brand border-dashed" : "border-border"}`}>
                    <div className="flex gap-2 items-center">
                      <span {...linksDnd.handle(i)} className="cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder">
                        <GripVertical className="h-4 w-4 text-faint" />
                      </span>
                      <select className="ed-input !w-32" value={l.type}
                        onChange={(e) => updateLink(l.id, { type: e.target.value as LinkType })}>
                        {linkTypes.map((t) => <option key={t} value={t}>{LINK_NAMES[t] ?? t}</option>)}
                      </select>
                      <input className="ed-input" value={l.label} placeholder={L("Button text", "Button पर लिखा")} onChange={(e) => updateLink(l.id, { label: e.target.value })} />
                      <button className="ed-icon" onClick={() => moveLink(i, -1)} disabled={i === 0}><ChevronUp className="h-4 w-4" /></button>
                      <button className="ed-icon" onClick={() => moveLink(i, 1)} disabled={i === card.links.length - 1}><ChevronDown className="h-4 w-4" /></button>
                      <button className="ed-icon hover:text-danger" onClick={() => removeLink(l.id)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {l.type === "phone" || l.type === "whatsapp" ? (
                      // +91 sits in its own box and only 10 digits go in (owner's call, 28 Sep 2026): no wrong numbers by mistake.
                      <div className="flex items-stretch gap-2">
                        <span className="inline-flex items-center rounded-lg border border-border bg-surface2 px-3 text-sm font-semibold text-muted">+91</span>
                        <input className="ed-input" value={indianMobile(l.value)} inputMode="numeric" placeholder="98765 43210" maxLength={10}
                          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 10); updateLink(l.id, { value: d ? `+91${d}` : "" }); }} />
                      </div>
                    ) : (
                    <input className="ed-input" value={l.value}
                      placeholder={l.type === "email" ? "you@example.com" : l.type === "upi" ? "yourname@upi" : l.type === "location" ? L("Google Maps link", "Google Maps link") : "https://"}
                      inputMode={l.type === "email" ? "email" : "url"}
                      onChange={(e) => updateLink(l.id, { value: e.target.value })} />
                    )}
                  </div>
                ))}
                {card.links.length === 0 && <p className="text-sm text-faint">No links yet.</p>}
              </div>
            </Panel>
          )}

          {/* ---- SETTINGS ---- */}
          {tab === "settings" && (
            <div className="space-y-6">
              <Panel title={L("Card link & domain", "Card का link और domain")}>
                <LinkField
                  value={card.username}
                  cardId={card.id}
                  personName={card.name}
                  businessName={card.company}
                  liveValue={savedUser}
                  host={cardHost}
                  onChange={(username) => patch({ username })}
                />
                {brand?.baseDomain ? (
                  <p className="text-xs text-faint">
                    Your card lives at <span className="mono">{publicHost}</span> — it goes live on Publish, nothing else to set up.
                  </p>
                ) : (
                  <DomainField card={card} onChange={(customDomain) => patch({ customDomain })} />
                )}
              </Panel>

              <Panel title={L("Google search (SEO)", "Google search (SEO)")}>
                <SeoPanel card={card} onChange={patch} address={publicHost} />
              </Panel>

              <Panel title={L("Train AI bot", "AI bot को सिखाएँ")}>
                {isShubhoraCard(card) && (
                  <p className="mb-3 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-xs text-brand-ink">
                    Shubhora ki poori jaankari (plans, price, features, app, partner business) aapke AI ko apne aap milti hai
                    aur hamesha latest rehti hai — card aur WhatsApp dono par. Yahan sirf apni baatein likhiye: aapka shahar,
                    timing, language, demo kaise dete hain.
                  </p>
                )}
                <TrainAiPanel
                  persona={card.botPersona ?? ""}
                  knowledge={card.botKnowledge ?? ""}
                  onPersona={(v) => patch({ botPersona: v })}
                  onKnowledge={(v) => patch({ botKnowledge: v })}
                />
              </Panel>

              <Panel title={L("Language & privacy", "भाषा और privacy")}>
                <Field label={L("Card language", "Card की भाषा")}>
                  <select className="ed-input" value={card.language ?? "en"} onChange={(e) => patch({ language: e.target.value })}>
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="mr">मराठी (Marathi)</option>
                    <option value="gu">ગુજરાતી (Gujarati)</option>
                  </select>
                </Field>
                <Toggle checked={!!card.locked} onChange={(v) => patch({ locked: v })} label="Card lock" hint="Require a password to view this card." />
                <Toggle checked={card.active} onChange={(v) => patch({ active: v })} label="Card active" hint="Turn off to take the card offline." />
              </Panel>

              {/* QR and share kit last (owner's call, 28 Sep 2026) — it is the thing you print, not a setting. */}
              <ShareKit card={card} />
            </div>
          )}
          {/* Room under the last field for the bottom bar (phone). */}
          <div className="h-16 @3xl:hidden" aria-hidden />
        </div>

        {/* ---------------- Live preview ---------------- */}
        <div className={`@3xl:sticky @3xl:top-24 min-w-0 ${view === "edit" ? "hidden @3xl:block" : "pb-16"}`}>
          <button type="button" onClick={() => { setView("edit"); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } }}
            className="@3xl:hidden mb-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold">
            <X className="h-4 w-4" /> {L("Close preview", "Preview बंद करें")}
          </button>
          <div className="hidden @3xl:flex items-center justify-between mb-2">
            <p className="text-xs mono uppercase tracking-wide text-faint">{L("Live preview", "Live preview")}</p>
            <span className="text-xs mono text-faint truncate max-w-[180px]">{publicHost}</span>
          </div>
          <div className="rounded-2xl border border-border bg-bg overflow-hidden @3xl:rounded-[2rem] @3xl:border-8 @3xl:border-ink/90 @3xl:shadow-float @3xl:max-h-[70vh] @3xl:overflow-y-auto overflow-x-hidden no-scrollbar">
            <div className="w-full min-w-0 [&>*]:max-w-full">
              {qr && <CardView key={card.template + card.themeColor} card={card} qr={qr} onEdit={editFrom} editLabel={L("Edit", "बदलें")} />}
            </div>
          </div>
        </div>
      </div>
      {/* Phone width: a solid bar just above the bottom tabs (owner's review, 28 Sep 2026 — the floating pill used to sit
          on top of the text people were typing). Save when needed, and the way in and out of the preview. */}
      <div className="@3xl:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2">
          {view === "preview" ? (
            <button type="button" onClick={() => { setView("edit"); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#12144a] px-4 py-2.5 text-sm font-semibold text-white">
              <X className="h-4 w-4" /> {L("Close preview — back to editing", "Preview बंद करें — वापस edit पर")}
            </button>
          ) : (
            <>
              {(status === "changed" || status === "draft" || localSaveError) && (
                <button type="button" onClick={save} disabled={pub.state === "busy"}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl grad-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70">
                  {pub.state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />} {pub.state === "busy" ? L("Saving…", "Save हो रहा है…") : L("Save", "Save")}
                </button>
              )}
              <button type="button" onClick={() => { setView("preview"); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink">
                <Eye className="h-4 w-4" /> {L("Preview my card", "Card का preview")}
              </button>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---------- small building blocks ---------- */

/** The 10-digit Indian mobile inside a stored button value ("+91 98765 43210", "09876543210", "919876543210" → "9876543210"). */
function indianMobile(v: string): string {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d === "91" || d === "0") return "";                 // the empty "+91" a new button starts with
  if (d.length > 10 && d.startsWith("91")) return d.slice(2, 12);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d.slice(0, 10);
}

/** One page of the card in the editor: its name (tap to rename), arrows, bin — and every section on it, open for editing. */
function PageSections({ page, index, total, L, onRename, onMove, onRemove, onBlocks, onFocus }: {
  page: CardPage; index: number; total: number; L: (en: string, hi: string) => string;
  onRename: (label: string) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void; onBlocks: (blocks: CardBlock[]) => void; onFocus: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const dnd = useDragReorder(page.blocks, onBlocks);
  const update = (bid: string, b: CardBlock) => onBlocks(page.blocks.map((x) => (x.id === bid ? b : x)));
  const remove = (bid: string) => onBlocks(page.blocks.filter((x) => x.id !== bid));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= page.blocks.length) return;
    const next = page.blocks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onBlocks(next);
  };
  return (
    <section id={`ed-page-${page.id}`} className="scroll-mt-28 rounded-2xl border border-brand/30 bg-surface p-3 shadow-card space-y-3" onFocusCapture={onFocus}>
      <div className="flex items-center gap-2 rounded-xl bg-brand-soft/50 p-2">
        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{L("Page", "Page")} {index + 1}</span>
        <input className="ed-input !bg-transparent !px-2 flex-1 !border-dashed font-semibold focus:!border-solid" value={page.label} title={L("Tap to rename this page", "नाम बदलने के लिए tap करें")} placeholder={L("Page name", "Page का नाम")}
          onChange={(e) => onRename(e.target.value)} />
        <button className="ed-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move page up"><ChevronUp className="h-4 w-4" /></button>
        <button className="ed-icon" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move page down"><ChevronDown className="h-4 w-4" /></button>
        <button className="ed-icon hover:text-danger" onClick={() => { if (total > 1 && confirm(L(`Remove the page "${page.label}" and everything on it?`, `"${page.label}" page और उसका सारा सामान हटा दें?`))) onRemove(); }} disabled={total <= 1} aria-label="Remove page"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{L("Tap any box to change it. Arrows move a section; the bin removes it.", "किसी भी box में tap करके बदलें। तीर से हिस्सा ऊपर-नीचे करें; bin से हटाएँ।")}</p>
        <div className="relative shrink-0">
          <button className="ed-add !w-auto" onClick={() => setAdding((v) => !v)}><Plus className="h-3.5 w-3.5" /> {L("Add section", "हिस्सा जोड़ें")}</button>
          {adding && (
            <div className="absolute right-0 mt-1 z-20 w-48 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface shadow-float p-1">
              {blockKinds.map(({ kind, label, icon: Icon }) => (
                <button key={kind} onClick={() => { onBlocks([...page.blocks, newBlock(kind)]); setAdding(false); }} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left hover:bg-surface2">
                  <Icon className="h-4 w-4 text-muted" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {page.blocks.map((b, i) => (
          <div key={b.id} id={`ed-block-${b.id}`} {...dnd.drop(i)} className={`scroll-mt-28 transition-shadow ${dnd.over === i ? "rounded-xl ring-1 ring-brand ring-dashed" : ""}`}>
            <BlockEditor block={b} onChange={(nb) => update(b.id, nb)} onRemove={() => remove(b.id)} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)}
              canUp={i > 0} canDown={i < page.blocks.length - 1} dragHandleProps={dnd.handle(i)} />
          </div>
        ))}
        {page.blocks.length === 0 && <p className="text-sm text-faint">{L("Nothing on this page yet — tap “Add section”.", "इस page पर अभी कुछ नहीं — “हिस्सा जोड़ें” दबाएँ।")}</p>}
      </div>
    </section>
  );
}
function Panel({ id, title, action, children }: { id?: string; title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-border bg-surface p-4 shadow-card transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * The card's public link, with live availability.
 *
 * Checking as you type matters here: the link is the one thing a card holder
 * prints on flyers and puts on a QR, and finding out it was taken only after
 * hitting Publish means redoing that work.
 */
function LinkField({ value, cardId, personName, businessName, liveValue, host, onChange }: {
  value: string; cardId: string; personName?: string; businessName?: string; liveValue?: string; host: (u: string) => string; onChange: (v: string) => void;
}) {
  const [check, setCheck] = useState<UsernameCheck>({ state: "idle" });
  const [copied, setCopied] = useState(false);
  // One tap: the link from your name or from the business name (owner's call, 25 Sep 2026) — each checked free.
  const [opts, setOpts] = useState<{ name: string | null; business: string | null }>({ name: null, business: null });
  useEffect(() => {
    let alive = true;
    linkOptions(personName ?? "", businessName ?? "", cardId).then((o) => { if (alive) setOpts(o); }).catch(() => undefined);
    return () => { alive = false; };
  }, [personName, businessName, cardId]);
  const url = host(value);
  // "shubhora.com/c/" sits before the slug; on a partner host the slug comes first.
  const branded = !url.startsWith(`${SITE_HOST}/`);

  // Debounced so we ask once the user pauses, not on every keystroke.
  useEffect(() => {
    if (!value) return setCheck({ state: "idle" });
    setCheck({ state: "checking" });
    const t = setTimeout(() => {
      let live = true;
      checkUsername(value, cardId).then((r) => { if (live) setCheck(r); });
      return () => { live = false; };
    }, 450);
    return () => clearTimeout(t);
  }, [value, cardId]);

  const ok = check.state === "ok";
  const bad = check.state === "bad";
  const ring = ok ? "border-good" : bad ? "border-danger" : "border-border";

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked — the link is still visible above */ }
  }

  return (
    <Field label={<span>Your card link <span className="font-normal text-faint">— select any one</span></span>}>
      {opts.name && opts.business && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          {([["business", opts.business!, "Business name"], ["name", opts.name!, "Your name"]] as const).map(([k, slug, label]) => {
            const on = value === slug;
            return (
              <button key={k} type="button" onClick={() => { onChange(slug); void setLinkPref(k); }}
                className={`rounded-xl border-2 px-2.5 py-2 text-left ${on ? "border-brand bg-brand-soft" : "border-border"}`}>
                <span className="flex items-center gap-1 text-[11px] text-muted">{on && <Check className="h-3 w-3 text-brand" />}{label}</span>
                <span className="block truncate text-xs font-semibold">/c/{slug}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className={`flex items-center rounded-lg border ${ring} bg-surface overflow-hidden transition-colors`}>
        {!branded && <span className="mono text-sm text-faint pl-3 pr-1 shrink-0">{SITE_HOST}/c/</span>}
        <input
          className={`flex-1 min-w-0 bg-transparent py-2.5 pr-2 text-sm outline-none mono ${branded ? "pl-3" : ""}`}
          value={value}
          placeholder="your-name"
          onChange={(e) => onChange(cleanUsername(e.target.value))}
        />
        {branded && <span className="mono text-sm text-faint pr-1 shrink-0">.{url.slice(value.length + 1)}</span>}
        <span className="px-2.5 shrink-0">
          {check.state === "checking" ? <LoaderCircle className="h-4 w-4 animate-spin text-faint" />
            : ok ? <Check className="h-4 w-4 text-good" />
            : bad ? <AlertCircle className="h-4 w-4 text-danger" />
            : null}
        </span>
      </div>

      <div className="mt-1.5 flex items-start gap-2">
        <p className={`text-xs flex-1 ${bad ? "text-danger" : ok ? "text-good" : "text-faint"}`}>
          {bad ? check.reason
            : isDefaultUsername(value) && nameSlug(personName ?? "")
            ? `On Save this becomes “${nameSlug(personName ?? "")}” automatically (from your name) — or type your own link here.`
            : ok && liveValue && value === liveValue ? `${url} is your live link.`
            : ok ? `${url} is free — tap Save to use it.`
            : "Letters, numbers and hyphens. Change it any time; the old link stops working."}
        </p>
        <button type="button" onClick={copy}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
          {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Field>
  );
}

/**
 * Connect a domain the card holder already owns, e.g. rajkumar.wellwalife.com.
 *
 * Two steps, because that's what DNS forces: save the domain to get the record
 * to add, then verify once it has propagated. Verifying is what issues the
 * certificate and switches the domain live, so the button stays available until
 * it succeeds — DNS often isn't ready on the first try.
 */
function DomainField({ card, onChange }: { card: Card; onChange: (v: string) => void }) {
  const [initial, setInitial] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetchCardDomain(card.id).then((d) => { setInitial(d?.domain ?? (card.customDomain || undefined)); setReady(true); }).catch(() => setReady(true));
  }, [card.id, card.customDomain]);
  return (
    <Field label="Your own domain">
      {ready ? <DomainConnect cardId={card.id} username={card.username} initialDomain={initial} onChange={onChange} /> : <LoaderCircle className="h-4 w-4 animate-spin text-muted" />}
    </Field>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label, hint, icon }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center gap-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">{icon}{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </span>
      <span className={`relative h-6 w-10 rounded-full transition-colors shrink-0 ${checked ? "bg-brand" : "bg-surface2 border border-border"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-all ${checked ? "left-[1.15rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
