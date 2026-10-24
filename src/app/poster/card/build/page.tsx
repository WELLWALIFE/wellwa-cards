"use client";

// "Make your V-Card": ONE scroll page of optional questions, prefilled from the setup, the owner's saved
// products and the answers they gave last time, autosaved to the server while they type. "Make my V-Card"
// builds the card on the server; the result is kept as a local draft, so Back, a reload or Android killing
// the tab shows the SAME preview again instead of building a second time.
//
// Arriving with no real card and no draft, the card is built straight away (the owner's rule: "when I reach
// V-Card, the card must be made automatically"); the form below stays as the "Make it better" path. Back
// always goes to /poster/setup — never to /poster/card, which is what used to make the endless build loop.
//
// Publishing merges the new words and pages INTO the live card (mergeBuiltCard), so the link, QR code,
// verified badge, pixels, look and website settings all stay as they are.
import { openPage, SiteLink } from "@/components/poster/card-sheet";
import { FinishBar } from "@/components/poster/site-finish";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import Link from "next/link";
import { SITE_PALETTES, FONT_PAIRS } from "@/lib/site-style";
import { MessageCircle, Palette, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, ExternalLink, Globe, LoaderCircle, Monitor, Pencil, Plus, RefreshCw, SlidersHorizontal, Smartphone, Sparkles, X, Eye } from "lucide-react";
import { FactsFields, Sec, type FactsPatch } from "@/components/poster/facts-fields";
import { TradeQuestions } from "@/components/poster/trade-questions";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { checkUsername, cleanUsername, fetchMyCardsStrict, publishCard, suggestUsername, OFFLINE } from "@/lib/cloud";
import { SHUBHORA_PAGE_SLUG, hasShubhoraPage, isShubhoraSellerCard, withShubhoraPage } from "@/lib/shubhora-page";
import { CardView } from "@/components/card-view";
import { applyLook, openingLook, threeLooks, type LookKey, type LookPlan } from "@/lib/site-looks";
import { paletteFor } from "@/lib/site-style";
import { SITE_HOST, SITE_URL } from "@/lib/site-url";
import type { Card, CardBlock } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import { SEED_KEY } from "@/lib/card-personalize";
import { goBack } from "@/lib/nav-back";
import { LAST_ONBOARD_SCREEN, screenHref } from "@/lib/setup-steps";
import { getLinkPref } from "@/lib/link-pref";
import { DomainPick } from "@/components/poster/domain-pick";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { dropStaleLocal } from "@/lib/local-reset";
import { CreditPrice, UnlockDialog, useAiAccess } from "@/lib/ai-access";
import {
  isThinCard, mergeBuiltCard, normalizeFacts, vcardDraftKey, vcardFormKey,
  type BuildRequest, type BuildResponse, type BuildRow, type CardFacts, type FactsResponse, type WriteAgainWant, writeAgainCredits,
  type Missing, type SetupInfo, type WebCheck,
} from "@/lib/card-facts";
import { SITE_CARDS, cleanSiteUrl, looksLikeSite, socialDetour } from "@/lib/site-role";
import { useT } from "@/lib/poster-i18n";
import { ProfileSteps } from "@/components/poster/profile-steps";
import { LookPicker } from "@/components/poster/look-picker";
import { LookTweaks } from "@/components/poster/look-tweaks";
import { AdvancedEntry, ADVANCED_HREF } from "@/components/poster/advanced-entry";

const box = "rounded-xl border border-border bg-surface px-3.5 py-3 text-[15px]";
const field = `mt-1 w-full ${box}`;
const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 6;

type Row = { id?: string; name: string; brand: string; price: string; photo: string; studio?: boolean; original?: string; busy?: boolean; note?: string; /** the note is a problem (shown in the error colour), not progress or success */ bad?: boolean };
/** A finished preview kept on this phone. `built` is the card the server wrote (before it was merged into the
 *  live card) and `liveSig` says which live card it was merged into, so a preview is never published on top of
 *  a card that has changed since. */
type Draft = { card: Card; built: TemplateCard | null; liveSig: string; checks: WebCheck[]; missing: Missing[]; off: string[]; savedAt: number; looks?: LookPlan[]; /** The link the card went live on from this screen, so a reload does not say "not live yet" about a live site. */ liveUser?: string };
/** The server's build, as GET/POST /api/card/build describe it (card-jobs.ts). */
type BuildStage = "details" | "website" | "pictures" | "writing" | "checking";
type JobView = { job: string; state: "running" | "done" | "failed"; stage: BuildStage; fresh: boolean; elapsed: number; claimed: boolean; status?: number; result?: unknown };
/** What finishing a build needs from the moment it was asked for (or from the load pass, before state exists). */
type FinishCtx = { live: Card | null; me: string; back: "form" | "preview" | "make"; f: CardFacts; also: boolean };
type FormBackup = { facts: CardFacts; rows: Row[]; dirty: boolean; savedAt: number };
const emptyRow = (): Row => ({ name: "", brand: "", price: "", photo: "" });

// Shared with the set-up, which drops both when the website or its role changes there.
const draftKey = vcardDraftKey;
const formKey = vcardFormKey;
const PREVIEW_KEY = "vcard-preview";
/** Where Make's Back falls back to when the app has no earlier screen (a link opened fresh, a reload): the set-up walk's last screen. */
const WALK_END = screenHref(LAST_ONBOARD_SCREEN);
/** The same test the load pass uses: a website that is made, switched on and live. Nothing may lead such an owner back to "Make". */
const isLiveSite = (c: Card | null): c is Card => !!c && c.active !== false && !!c.site?.enabled && !isThinCard(c);
/** Set (per tab) when Make's "Change" / "Add" opens onboard's one-screen edit: its Save comes back as a REPLACE of that screen by Make?saved=…,
 *  which leaves two entries of the Make screen in the history. */
const EDIT_MARK = "vcard-make-edit";
function setEditMark(on: boolean) {
  try { if (on) sessionStorage.setItem(EDIT_MARK, "1"); else sessionStorage.removeItem(EDIT_MARK); } catch { /* private mode */ }
}
function hasEditMark(): boolean {
  try { return sessionStorage.getItem(EDIT_MARK) === "1"; } catch { return false; }
}

/* Storage is never trusted: private mode, a full disk or a WebView with cookies off all throw. */
function readJson<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
function dropKey(key: string) {
  try { localStorage.removeItem(key); } catch { /* private mode */ }
}

/** A fingerprint of the live card at the moment a preview was made. When it no longer matches, the card was
 *  changed somewhere else (the editor, "Change design", another phone) and publishing the old preview would
 *  quietly undo that. */
function cardSig(c: Card | null): string {
  if (!c) return "none";
  const s = JSON.stringify(c);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${c.id}:${s.length}:${(h >>> 0).toString(36)}`;
}

/** A saved or backed-up value → a complete facts object, WITHOUT the normalising that would wipe a
 *  half-typed answer (a year still being typed, a UPI ID missing its @…). The server normalises. */
function asFacts(x: unknown): CardFacts {
  const base = normalizeFacts({});
  if (!x || typeof x !== "object" || Array.isArray(x)) return base;
  const o = x as Partial<CardFacts>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  return {
    ...base, ...o, v: 1,
    customers: arr(o.customers), special: arr(o.special), payments: arr(o.payments),
    photos: arr(o.photos), hidden: arr(o.hidden),
    social: { ...base.social, ...(o.social && typeof o.social === "object" ? o.social : {}) },
  };
}

/** The card as the owner left it after "Please check": the details they unticked go back to their own
 *  words, and the maker's specification table comes off that product. */
function applyChecks(card: Card, checks: WebCheck[], off: string[]): Card {
  if (!off.length || !checks.length) return card;
  const drop = new Set(off.map((n) => n.trim().toLowerCase()));
  const byName = new Map(checks.map((c) => [c.name.trim().toLowerCase(), c]));
  return {
    ...card,
    pages: (card.pages ?? []).map((pg) => ({
      ...pg,
      blocks: (pg.blocks ?? []).map((b): CardBlock => {
        if (b.kind !== "product") return b;
        return {
          ...b,
          items: b.items.map((it) => {
            const key = (it.name ?? "").trim().toLowerCase();
            const c = drop.has(key) ? byName.get(key) : undefined;
            return c ? { ...it, desc: c.plain.desc, features: c.plain.features, specs: [] } : it;
          }),
        };
      }),
    })),
  };
}

// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; alt?: string; className?: string }) => <img src={p.src} alt={p.alt ?? ""} className={p.className} />;

/** The blueprint's shape in a few CSS boxes (bento: four tiles; cinematic: a wide frame; story: a phone with its dots). */
function LookGlyph({ k, ink }: { k: LookKey; ink: string }) {
  if (k === "bento") return <span className="grid h-6 w-7 grid-cols-2 gap-[3px]">{[0, 1, 2, 3].map((i) => <span key={i} className="rounded-[2px]" style={{ background: ink, opacity: 0.85 }} />)}</span>;
  if (k === "cinematic") return <span className="relative block h-5 w-8 rounded-[3px] border-2" style={{ borderColor: ink, opacity: 0.85 }}><span className="absolute bottom-0.5 left-0.5 h-[3px] w-3 rounded-full" style={{ background: ink }} /></span>;
  // Poster: a filled block with the photo card hanging over its edge.
  return <span className="relative block h-6 w-7 rounded-[3px]" style={{ background: ink, opacity: 0.85 }}><span className="absolute -bottom-1 right-1 h-3 w-3 rounded-[2px] border" style={{ background: ink, borderColor: "rgba(255,255,255,.9)" }} /></span>;
}

export default function BuildCard() {
  const router = useRouter();
  const access = useAiAccess();
  const { lang } = useT();
  const hi = lang !== "en";
  const T = useCallback((en: string, hiText: string) => (hi ? hiText : en), [hi]);

  const [state, setState] = useState<"loading" | "error" | "form" | "make" | "building" | "preview" | "style" | "domain" | "done">("loading");
  // Step 5 (owner's call, 2 Oct 2026): "Save and continue" opens a page of its own with two tabs — Standard for the
  // free plan, Premium for the paid one — and the build starts from there, never by itself.
  const [, setPlan] = useState<"standard" | "premium">("standard");
  const [uid, setUid] = useState("");
  /** The person chose "Both — my business and Shubhora" at set-up: their own card is built exactly as usual,
   *  and the Shubhora page is added to it (its own hidden link) when it is published. */
  const [alsoShubhora, setAlsoShubhora] = useState(false);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [facts, setFacts] = useState<CardFacts>(() => normalizeFacts({}));
  const [rows, setRows] = useState<Row[]>([]);
  const [brandProducts, setBrandProducts] = useState(false);
  const [existing, setExisting] = useState<Card | null>(null);
  const [edits, setEdits] = useState(0);

  const [card, setCard] = useState<Card | null>(null);
  /** The card the server wrote, kept so Publish can merge it into the live card as it is at that moment. */
  const [built, setBuilt] = useState<TemplateCard | null>(null);
  const [liveSig, setLiveSig] = useState("none");
  /** The website the server had when this screen opened, and whether the set-up just changed it. */
  const serverSite = useRef("");
  const siteNew = useRef(false);
  const [checks, setChecks] = useState<WebCheck[]>([]);
  const [missing, setMissing] = useState<Missing[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [qr, setQr] = useState("");
  const [tab, setTab] = useState<"phone" | "site">("site");
  const [scale, setScale] = useState(0.28);
  // The website preview opens at phone width (owner's call, 5 Oct 2026: the 1280 px page scaled to a quarter was
  // unreadable); "Computer view" shows the scaled desktop frame as before.
  // The website preview opens in the computer view (owner, 24 Oct 2026); "Phone" switches it.
  const [desk, setDesk] = useState(true);
  /** Make screen: the owner asked to make a new website although one is made. */
  const [remake, setRemake] = useState(false);
  // "Website की पसंद": both boxes closed behind a tick unless already filled (owner, 24 Oct 2026: "check box me click kare to field open").
  const [likeOpen, setLikeOpen] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  /** The "Change…" sheet: adjust this look, edit details, edit card, write again — one place instead of five paths. */
  const [more, setMore] = useState(false);
  const [viewed, setViewed] = useState<string[]>([]);          // the designs the owner has tapped
  const [confirmDesign, setConfirmDesign] = useState(false);   // "have you seen the others?" before the first Save and next
  const [designOpen, setDesignOpen] = useState(false);          // the six designs, opened from the bottom bar          // colours and fonts of the chosen design


  const [busy, setBusy] = useState("");
  /** "Update your live website?" asked in the app, not with the browser's own confirm box (owner, 19 Oct 2026: a native dialog is not the app). Holds the publish options to run on Yes. */
  const [askLive, setAskLive] = useState<{ card?: Card; quiet?: boolean } | null>(null);
  const [err, setErr] = useState("");
  /** The one on-screen error line (the preview's bar, the Make cards, the form's Save): scrolled into view when it appears, so it is never off-screen. */
  const errRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => { try { errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ } }, 80);
    return () => clearTimeout(t);
  }, [err, state]);
  /** Which Make button was tapped: its message shows under THAT button, not at the bottom of the screen. */
  const [makeFrom, setMakeFrom] = useState<"" | "free" | "premium">("");
  /** "Help me write" failures, shown under the button that was tapped (inside the Write again sheet, which sits above the page's own error line). */
  const [helpErr, setHelpErr] = useState<{ kind: "image" | "words"; msg: string } | null>(null);
  /** A problem with an action in the "Change…" sheet, shown inside the sheet. */
  const [moreMsg, setMoreMsg] = useState("");
  /** Keep / Another / Back to stock: a failed "Back to stock photo" says so inside the banner box. */
  const [bannerMsg, setBannerMsg] = useState("");
  /** "Copy link" on the finished screen: copied, or why not. */
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState("");
  const [unlock, setUnlock] = useState(false);
  const [premiumUnlock, setPremiumUnlock] = useState(false);
  /** Opened from Card & Website → Edit → Website design (?improve=1): Back and Done return there, not to the set-up. */
  const [improveMode, setImproveMode] = useState(false);
  const [designNote, setDesignNote] = useState("");
  // "Write again" (owner's call, 4 Oct 2026): Premium, 5 credits a time. Free is shown the Premium sheet; a Premium
  // account short of credits is asked for them.
  const [againUnlock, setAgainUnlock] = useState(false);
  // "What should change?" (owner's call, 4 Oct 2026: "poochhe kya change karna hai — hero image, look, text"):
  // the owner ticks what they want different, adds a line if they like, and only that changes.
  type Want = Exclude<WriteAgainWant, "pictures">;
  const [againAsk, setAgainAsk] = useState(false);
  // Background page stays still while the sheet is open, so a finger drag scrolls the sheet, not the preview under it.
  useEffect(() => {
    if (!againAsk && !more) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [againAsk, more]);
  const [againWants, setAgainWants] = useState<Want[]>(["look"]);
  const [againNote, setAgainNote] = useState("");
  // The picture and the words, described (owner's call, 4 Oct 2026: "image kaisi chahiye, text me kya — box ho, aur
  // AI ki help: wo kuch likhe to AI usko poora prompt bana de").
  const [imageNote, setImageNote] = useState("");
  const [wordsNote, setWordsNote] = useState("");
  const [helping, setHelping] = useState<"" | "image" | "words">("");
  // How many new AI photos (one credit each) and whether they join the gallery or replace the AI-made ones.
  const [photoCount, setPhotoCount] = useState(2);
  const [photoMode, setPhotoMode] = useState<"add" | "replace">("add");
  async function helpWrite(kind: "image" | "words") {
    const raw = (kind === "image" ? imageNote : wordsNote).trim();
    if (!raw || helping) return;
    setHelping(kind); setHelpErr(null);
    try {
      const r = await fetch("/api/ai/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        task: kind === "image" ? "image-wish" : "words-wish", input: raw, company: shown?.company || shown?.name || "", role: setup?.categoryLabel ?? "",
      }) }).then((x) => x.json()).catch(() => ({}));
      const text = String(r?.text ?? "").trim();
      if (text) { if (kind === "image") setImageNote(text.slice(0, 600)); else setWordsNote(text.slice(0, 400)); }
      else setHelpErr({ kind, msg: r?.error || T("The AI could not write it now — your own words will be used.", "AI अभी नहीं लिख पाया — आपके शब्द ही जाएँगे।") });
    } finally { setHelping(""); }
  }
  const WANTS: { k: Want; t: string; th: string; s: string; sh: string }[] = [
    { k: "look", t: "Look & colours", th: "Look और रंग", s: "Palette, fonts", sh: "रंग, font" },
    { k: "layout", t: "Layout", th: "Layout", s: "Hero style, section order", sh: "Hero का ढंग, sections का क्रम" },
    { k: "banner", t: "Hero image", th: "Hero image", s: "A new banner on top", sh: "ऊपर नया banner" },
    { k: "photos", t: "Photos", th: "Photos", s: "New AI photos for the gallery", sh: "Gallery के लिए नई AI photos" },
    { k: "words", t: "Words", th: "शब्द", s: "Headline, about, sections", sh: "Headline, about, sections" },
  ];
  // One credit per thing asked (owner's call, 4 Oct 2026); the total shows on the button before anything is spent.
  function writeAgain() {
    if (busy) return; // the "Change…" sheet keeps itself open and says why when it is busy
    if (!access.subscribed) { setPremiumUnlock(true); return; }
    setHelpErr(null);
    setAgainAsk(true);
  }
  // Three looks for the website on screen (site-looks.ts, docs/website-looks-v2.md): three blueprints — a tile board,
  // full-screen scenes, swipe slides — on the same content; a tap swaps the whole design on the spot.
  const [plans, setPlans] = useState<LookPlan[] | undefined>(undefined);
  const looks = useMemo(() => (built?.site ? threeLooks(built, built.site.style, plans) : []), [built, plans]);
  /** A look or an adjustment on a LIVE site goes live by itself — the live link would otherwise keep opening on the
   *  first look (owner's report, 4 Oct 2026). Taps are debounced: while one publish runs, the latest card waits and
   *  is published once it is done, so the last tap always wins and none is lost. */
  const pendingPublish = useRef<Card | null>(null);
  const publishing = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishRef = useRef<(opts?: { card?: Card; quiet?: boolean }) => Promise<void>>(async () => undefined);
  useEffect(() => { publishRef.current = publish; });
  function flushPublish() {
    flushTimer.current = null;
    const next = pendingPublish.current;
    if (!next || publishing.current) return;
    pendingPublish.current = null;
    void publishRef.current({ card: next, quiet: true });
  }
  function queuePublish(next: Card) {
    pendingPublish.current = next;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushPublish, 500);
  }
  /** A look or an adjustment goes live when the site is live — and also while the first card is on its way live
   *  (goLive / publish running): it is queued and published the moment that finishes, instead of being snapped back
   *  to the pre-tap card when the publish writes the card to the screen. */
  function liveTap(next: Card) {
    if (liveUser || publishing.current) queuePublish(next);
  }
  /** Leaving the screen with a tap still in its 500 ms wait: it is published now, not forgotten. */
  useEffect(() => () => { if (flushTimer.current) { clearTimeout(flushTimer.current); flushPublish(); } }, []);
  /** Everything queued or running is put live before the screen is left for the editor, so the editor opens on
   *  the card as the owner last saw it — not on the look before their tap. Capped: a stuck publish never holds
   *  the owner here. */
  async function settlePublish() {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    const next = pendingPublish.current;
    if (next && !publishing.current) { pendingPublish.current = null; await publishRef.current({ card: next, quiet: true }); }
    const until = Date.now() + 15000;
    while ((publishing.current || pendingPublish.current) && Date.now() < until) await new Promise((res) => setTimeout(res, 150));
  }
  function pickLook(k: LookKey) {
    const look = looks.find((l) => l.key === k);
    if (!look || !card) return;
    setErr("");
    setViewed((v) => (v.includes(k) ? v : [...v, k]));
    const next = applyLook(card, look);
    setCard(next);
    // A look is the website's: the website preview opens so the change is seen (the phone card does not wear it).
    setTab("site");
    liveTap(next);
    // The design is picked: keep the six tabs at the top of the screen with the website right under them, so the page
    // can be seen change while choosing (owner, 13 Oct 2026).
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  // "Send 6 test links on WhatsApp": the six designs as six links, to the owner's own WhatsApp or anyone's, to open on any phone and compare.
  const [sendingLinks, setSendingLinks] = useState(false);
  const [linksNote, setLinksNote] = useState("");
  async function sendTestLinks() {
    if (!card || !looks.length || sendingLinks) return;
    setLinksNote(""); setSendingLinks(true);
    // WhatsApp opens in a window made NOW (a tap), filled in when the links are ready: a window opened after the wait is taken for a pop-up.
    const win = window.open("", "_blank");
    try {
      const body = JSON.stringify({ card, looks });
      if (body.length > 3_500_000) throw new Error(T("This card is too big to send as links.", "यह card links भेजने के लिए बहुत बड़ा है।"));
      const r = await api<{ token?: string; error?: string }>("/api/card/test-links", { method: "POST", json: { card, looks } });
      if (!r.ok || !r.data.token) throw new Error(r.data.error || T("Could not make the links. Please try again.", "links नहीं बन पाए। दोबारा try करें।"));
      const lines = looks.map((l, i) => `${i + 1}. ${l.name}: ${SITE_URL}/t/${r.data.token}/${l.key}`);
      const who = (shown?.company || shown?.name || "").trim();
      const text = `${T("Website design test", "Website design का test")}${who ? ` — ${who}` : ""}\n${T("Open each link to see that design:", "हर link खोलकर वो design देखें:")}\n\n${lines.join("\n")}`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (win) win.location.href = url; else window.location.href = url;
    } catch (e) {
      win?.close();
      setLinksNote(e instanceof Error ? e.message : T("Could not make the links. Please try again.", "links नहीं बन पाए। दोबारा try करें।"));
    } finally { setSendingLinks(false); }
  }
  /** The website in this look, full size in a new tab: the live link once live, else the preview of this phone. */
  function openLookInTab(k: LookKey) {
    const look = looks.find((l) => l.key === k);
    if (!look || !card) return;
    const next = applyLook(card, look);
    // Each design opens under its OWN key (owner, 18 Oct 2026: six tabs opened to compare all turned into the last one, because they shared one
    // preview key and the page follows its key live). A tab is a fixed picture of that design, so the six can sit side by side.
    const key = `vcard-look-${String(k).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 40);
    writeJson(key, { ...next, username: "__preview" });
    // On a phone it opens over the app with a Close button (a new tab had none, and Share Screen did not show it).
    openPage(liveUser && username === liveUser && next.site?.style?.blueprint === shown?.site?.style?.blueprint ? `${SITE_URL}/c/${username}?view=site` : `/preview/site?k=${key}`, T("Website", "Website"));
  }
  const [elapsed, setElapsed] = useState(0);
  // First V-Card (owner's call, 25 Sep 2026): it goes live by itself the moment the AI finishes — no "is it live or
  // not?" moment. `liveUser` is the link it went live on; a changed link afterwards needs one more save.
  const [liveUser, setLiveUser] = useState("");
  /** The same, for the banner's follower: it was started from an older render and must read the value of now. */
  const liveUserRef = useRef("");
  useEffect(() => { liveUserRef.current = liveUser; }, [liveUser]);
  // The AI banner, made at Final (docs/website-looks-v2.md §7): the site goes live on its stock pictures, then
  // /api/card/banner paints the banner in the chosen look and it lands here, with Keep / Another / Back to stock.
  type BannerState = { state: "idle" | "running" | "done" | "failed"; job?: string; elapsed?: number; error?: string; charged?: number; prev?: boolean };
  const [banner, setBanner] = useState<BannerState>({ state: "idle" });
  const madeByUs = (u?: string) => !!u && /\/ref-\d+(-\d+)?\.(png|jpe?g|webp)(\?|$)/i.test(u);
  const ownBanner = !!facts.bannerUrl && !madeByUs(facts.bannerUrl);

  /** "Check your details" — the company / product answers, folded; a "Make it better" chip opens it. */
  const reviewRef = useRef<HTMLDetailsElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** The preview tabs: the finished flow scrolls here when moving from the website to the card. */
  const previewRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef(false);
  /** The owner reached "Make" through the questions form (its Save and continue): Make's Back returns to the form. */
  const cameFromForm = useRef(false);
  /** The finished screen was reached from the design screen in this visit (publish, or Next on a live site): only then is the design screen "the one just before". */
  const doneFromPreview = useRef(false);
  /** The build is the server's (card-jobs.ts): this screen only follows it, and stops asking once it is gone. */
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  /** Where the server's build is, and whether this phone lost the connection while following it. */
  const [stage, setStage] = useState<BuildStage>("details");
  const [lost, setLost] = useState(false);

  const setF = useCallback((p: FactsPatch) => {
    setFacts((f) => ({ ...f, ...p, social: { ...f.social, ...(p.social ?? {}) } }));
    setEdits((n) => n + 1);
  }, []);
  const patchRow = useCallback((i: number, p: Partial<Row>) => {
    setRows((rs) => rs.map((x, k) => (k === i ? { ...x, ...p } : x)));
    setEdits((n) => n + 1);
  }, []);

  /* ---------------- load ---------------- */

  const load = useCallback(async () => {
    // Just saved on onboard's one-screen edit that Make's "Change" / "Add" opened (?saved=…): that Save REPLACED the edit screen, so the entry before
    // this one is the Make screen the owner tapped from. Step back onto it (it loads afresh and shows the new answer) instead of keeping a second copy
    // of Make in the history — otherwise the first Back from here would land on the same screen and look dead, once per edit.
    try {
      const fromMake = hasEditMark();
      setEditMark(false);
      if (fromMake && new URL(window.location.href).searchParams.has("saved") && window.history.length > 1) { router.back(); return; }
    } catch { /* ignore */ }
    setState("loading"); setErr("");
    try {
      // Replace, not push: Back from the login page must not land here again and bounce straight back to it. The address comes back as it
      // was (?make=1 …) — a bare /poster/card/build would build the card at once instead of opening the Make screen.
      if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/card/build${window.location.search}`)}`); return; }
      const who = await getBrowserSupabase()?.auth.getUser();
      const me = who?.data.user?.id ?? "";
      setUid(me);
      // Cleared by Super Admin since this phone last looked: the form backup and the built preview kept here are
      // the OLD trade's, and go before anything below reads them.
      dropStaleLocal(who?.data.user);
      setAlsoShubhora(!!who?.data.user?.user_metadata?.also_shubhora);
      // "Make my V-Card again with AI" asks for a NEW card, so any saved preview is thrown away first.
      let again = false;
      // ?flow=1 — step 4 of the profile: the form opens, nothing is built until step 5. ?make=1 — straight to step 5.
      let flow = false, makeNow = false;
      // ?improve=1 — "Improve your website" / "Change the look" from Card & Website (owner's call, 4 Oct 2026: Write
      // again any time): the LIVE card opens in the preview as it is, nothing is built; the five looks are there and
      // a look chosen goes live at once. &ask=1 opens "What should change?" straight away.
      let improve = false, ask = false, rewrite = false;
      try {
        const u = new URL(window.location.href);
        again = u.searchParams.get("again") === "1";
        improve = u.searchParams.get("improve") === "1";
        // &rewrite=1 is put on the address by this page while a rewrite waits for "Make it live" (see below): a reload or the browser's Back
        // reopens THAT rewrite, a fresh tap on "Website design" (a bare ?improve=1) opens the live website.
        rewrite = u.searchParams.get("rewrite") === "1";
        ask = u.searchParams.get("ask") === "1";
        // ?ask=1 is one-shot (a reload must not reopen the sheet). ?improve=1 STAYS in the address: Back from the editor or a reload
        // reopens this same screen on the live card, not the questions form a bare /poster/card/build would show.
        if (ask) { u.searchParams.delete("ask"); window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`); }
        flow = u.searchParams.get("flow") === "1";
        makeNow = u.searchParams.get("make") === "1" || flow;
        // ?site=new — the set-up just saved a different website (or role): the site's words lead this build.
        if (u.searchParams.get("site") === "new") siteNew.current = true;
        if (again || u.searchParams.has("site")) { u.searchParams.delete("again"); u.searchParams.delete("site"); window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`); }
      } catch { /* ignore */ }

      const [cards, fr] = await Promise.all([fetchMyCardsStrict(), api<FactsResponse>("/api/card/facts")]);
      if (!fr.ok) throw new Error("facts");
      const server = fr.data;
      serverSite.current = server.facts?.website ?? "";
      const live = cards.find((c) => c.id === server.facts?.primaryCardId) ?? cards[0] ?? null;
      setExisting(live);
      setSetup(server.setup);
      // Skipped the setup? The card is made FROM those details — collect them first, then come straight back here.
      const s = server.setup;
      const nameOk = !!(s?.person || s?.business);
      if (!live && (!nameOk || !s?.phone || !s?.category)) { router.replace(`/poster/onboard?next=${encodeURIComponent(`/poster/card/build${window.location.search}`)}`); return; }
      setBrandProducts(!!server.brandProducts);

      // A draft from an earlier build: show that preview again instead of building a second time — but only
      // while the live card is still exactly the one it was built from. A draft made before the owner edited
      // their card in the editor is dropped, because publishing it would undo every one of those changes.
      const raw = me ? readJson<Draft>(draftKey(me)) : null;
      const usable = raw?.card && Array.isArray(raw.card.pages) && Date.now() - (raw.savedAt ?? 0) < 14 * DAY ? raw : null;
      const draft = !again && usable && usable.liveSig === cardSig(live) ? usable : null;
      if (!draft && me) dropKey(draftKey(me));

      const saved = me ? readJson<FormBackup>(formKey(me)) : null;
      const backup = saved && Date.now() - (saved.savedAt ?? 0) < 7 * DAY ? saved : null;
      let next = asFacts(backup?.dirty ? backup.facts : server.facts);
      // The website and whose it is are answered at set-up now. A dirty backup from an earlier visit on this
      // phone must not put the old website (or none) back over what the set-up just saved on the server.
      if (backup?.dirty && server.facts?.website && backup.facts?.website !== server.facts.website) {
        next = { ...next, website: server.facts.website, websiteRole: server.facts.websiteRole, dealerAssertedAt: server.facts.dealerAssertedAt ?? "" };
      }
      if (!next.social.google && server.setup?.map) next = { ...next, social: { ...next.social, google: server.setup.map } };
      setFacts(next);

      // Products the owner took OFF the V-Card stay off it (they are still on their Products page).
      const mine = server.brandProducts ? [] : (server.products ?? []).filter((pr) => !next.hidden.includes(pr.name.trim().toLowerCase()));
      const fromSaved: Row[] = mine.slice(0, MAX_ROWS).map((p) => ({ id: p.id, name: p.name, brand: p.brand, price: p.price, photo: p.photo, original: p.photo }));
      const backupRows = backup && Array.isArray(backup.rows) ? backup.rows.slice(0, MAX_ROWS).map((r) => ({ ...r, busy: false, note: "", bad: false })) : null;
      const startRows = backupRows?.length ? backupRows : fromSaved.length ? fromSaved : [emptyRow(), emptyRow(), emptyRow()];
      setRows(startRows);

      // A build asked for earlier — still running on the server, or finished while this screen was closed — is
      // picked up here: the website made then is shown (and a first card goes live), never made a second time.
      const jr = await api<JobView | { job: null }>("/api/card/build").catch(() => null);
      const jv = jr?.ok && jr.data.job ? (jr.data as JobView) : null;
      if (jv && !jv.claimed) {
        const ctx: FinishCtx = { live, me, back: makeNow ? "make" : "form", f: next, also: !!who?.data.user?.user_metadata?.also_shubhora };
        autoRef.current = true;
        if (jv.state === "running") void follow(jv, ctx);
        else { setState(ctx.back); void finish(jv, ctx); }
        return;
      }

      // A banner left running (or finished while this screen was closed) is followed to its end here.
      if (live) {
        const bj = await api<JobView | { job: null }>("/api/card/banner").catch(() => null);
        if (bj?.ok && bj.data.job && !(bj.data as JobView).claimed) void followBanner(bj.data as JobView, live.id);
      }

      // ?improve=1 now stays in the address, so a reload must not throw away a rewrite that is waiting for "Make it live" (its credits are
      // spent and its job is claimed): on an address marked &rewrite=1 such a draft (it was never live) wins over the live card and is shown
      // with the improve exits. A fresh tap on "Website design" is not marked, so an old unsent rewrite never hides the live website.
      if (improve && live && !(rewrite && draft && !draft.liveUser)) {
        // A card made before websites had one: a seed site, so the three looks can be drawn and worn (owner's call, 5 Oct 2026).
        const withSite = live.site ? live : { ...live, site: { enabled: true } };
        const { id: _i, username: _u, plan: _p, active: _a, views: _v, createdAt: _c, ...tpl } = withSite; void _i; void _u; void _p; void _a; void _v; void _c;
        setCard(withSite); setBuilt(tpl as TemplateCard); setLiveSig(cardSig(live)); setLiveUser(live.username);
        setImproveMode(true);
        setState("preview"); setTab("site");
        if (ask) setTimeout(() => setAgainAsk(true), 300);
        return;
      }
      if (draft) {
        setCard(draft.card); setBuilt(draft.built ?? null); setLiveSig(draft.liveSig); setLiveUser(draft.liveUser ?? "");
        setChecks(draft.checks ?? []); setMissing(draft.missing ?? []); setOff(draft.off ?? []); setPlans(draft.looks);
        setImproveMode(improve && !!live);
        // "Finish setup" and the Make pill arrive with ?make=1: a website already built waits on its preview, never
        // behind "Make my free website" again (which would build a second time).
        setState("preview");
        return;
      }
      // ?make=1 on an account whose website is already made and live (a reload, the "Make" step, the browser's Back): the
      // finished screen, never "Make my website" again — that would be a second build (owner, 15 Oct 2026: "website ban
      // chuki thi, wapas aane par dobara process karna padega — galat hai"). Making it again is only ?again=1 or "Write again".
      if (makeNow && !again && !siteNew.current && isLiveSite(live)) {
        const { id: _i, username: _u, plan: _p, active: _a, views: _v, createdAt: _c, ...tpl } = live; void _i; void _u; void _p; void _a; void _v; void _c;
        setCard(live); setBuilt(tpl as TemplateCard); setLiveSig(cardSig(live)); setLiveUser(live.username);
        setTab("site"); setState("done");
        return;
      }
      if (makeNow) { setState("make"); return; }
      // The owner's rule: reaching the V-Card with nothing real yet makes the card at once. The form
      // below stays as the "Make it better" path; the draft it saves stops any second build.
      // An owner who has already started answering (a saved form backup) is left alone with their
      // answers — otherwise a reload would take a half-filled form away from them.
      setState("form");
      if (!flow && (again || ((!live || isThinCard(live)) && !backup)) && !autoRef.current) {
        autoRef.current = true;
        void build({ facts: next, rows: startRows, existing: live, uid: me, back: "form" });
      }
    } catch {
      setState("error"); // no internet: never treat this as "no card"
    }
    // build() only uses the values handed to it here, so it never needs to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => { load(); }, [load]);

  /* ---------------- autosave (server facts + local backup) ---------------- */

  useEffect(() => {
    if (!uid || !edits) return;
    writeJson(formKey(uid), { facts, rows, dirty: true, savedAt: Date.now() });
    const t = setTimeout(async () => {
      try {
        // primaryCardId is left out on purpose: it is set when a card is published, never by this form.
        const patch: FactsPatch = { ...facts, primaryCardId: undefined };
        const r = await api<{ facts?: CardFacts }>("/api/card/facts", { method: "PATCH", json: { facts: patch } });
        if (r.ok) writeJson(formKey(uid), { facts, rows, dirty: false, savedAt: Date.now() });
      } catch { /* offline: the local backup keeps the answers */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [edits, facts, rows, uid]);

  /* keep the draft in step with the preview (link change, "Please check" ticks) */
  useEffect(() => {
    if (state !== "preview" || !card || !uid) return;
    writeJson(draftKey(uid), { card, built, liveSig, checks, missing, off, savedAt: Date.now(), ...(plans ? { looks: plans } : {}), ...(liveUser ? { liveUser } : {}) } satisfies Draft);
  }, [state, card, built, liveSig, checks, missing, off, uid, plans, liveUser]);

  /* A built website on screen always has an address that reopens it. A bare /poster/card/build (the auto-build, ?again=1 and ?site=new
     arrive that way) would open the questions form on a live website after Back from the editor or a reload — and from there it is two
     taps to a second build. ?make=1 reopens the saved preview, or the finished screen once the site is live. Replace: no history entry. */
  useEffect(() => {
    if (state !== "preview" && state !== "done") return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("make") === "1" || u.searchParams.get("improve") === "1") return;
      u.searchParams.set("make", "1");
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    } catch { /* ignore */ }
  }, [state]);

  /* A rewrite waiting for "Make it live" inside the improve flow marks its own address (&rewrite=1). The mark belongs to this history entry, so a
     reload and the browser's Back reopen the rewrite, while a new tap on "Website design" (a fresh ?improve=1) opens the live website. Replace: no history entry. */
  useEffect(() => {
    if (state !== "preview" || !improveMode || liveUser) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("improve") !== "1" || u.searchParams.get("rewrite") === "1") return;
      u.searchParams.set("rewrite", "1");
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    } catch { /* ignore */ }
  }, [state, improveMode, liveUser]);

  const username = card?.username ?? "";
  useEffect(() => {
    if (!username) return;
    QRCode.toDataURL(`${SITE_URL}/c/${username}`, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [username]);

  /* staged wording while the server works */
  useEffect(() => {
    if (state !== "building") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  // A card with no blueprint of its own (built before the looks, or by a build the designer skipped) is shown wearing the
  // first look, which is the one the picker marks (owner, 6 Oct 2026: the "Bento" tick showed a plain cover).
  const shown = useMemo(() => (card ? applyChecks(!card.site?.style?.blueprint && looks[0] ? applyLook(card, looks[0]) : card, checks, off) : null), [card, checks, off, looks]);
  /** The look on screen is read off the card itself (a draft restore, ?improve=1 or a banner refresh used to leave a
   *  separate "picked" state pointing at the wrong one). */
  const activeLook: LookKey | undefined = shown?.site?.style?.blueprint ?? looks[0]?.key;
  const isStory = activeLook === "story";
  // The pictures on the site now, as thumbnails (owner's call, 4 Oct 2026: "chhota preview, taaki pehchan sake
  // kaunsi image badalni hai"): with Replace, the owner taps the ones to change — one credit each.
  const [replaceUrls, setReplaceUrls] = useState<string[]>([]);
  const galleryNow = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    const add = (u?: string) => { if (u && /^https?:\/\//.test(u) && !seen.has(u) && out.length < 12) { seen.add(u); out.push(u); } };
    for (const u of facts.photos) add(u);
    for (const pg of shown?.pages ?? []) { if (pg.hidden) continue; for (const b of pg.blocks) { if (b.kind === "gallery") for (const im of b.images) add(im.url); } }
    return out;
  }, [facts.photos, shown]);
  const photosAsked = photoMode === "replace" ? Math.max(1, replaceUrls.length) : photoCount;
  const againCost = writeAgainCredits(againWants, `${againNote}${imageNote}${wordsNote}`, photosAsked);
  /** A link that is taken or too short: it can neither be saved nor published (offline = "idle", where
   *  publishing itself is the judge). */

  /* the website preview: the real desktop renderer in an iframe, scaled down to the phone's width */
  const previewFrame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if ((state !== "preview" && state !== "style") || tab !== "site" || !shown) return;
    writeJson(PREVIEW_KEY, { ...shown, username: "__preview" });
    // The frame is told as well: a storage event alone did not reach it on every browser (the five looks only
    // ever showed the first, owner's report 4 Oct 2026).
    try { previewFrame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
  }, [state, tab, shown]);

  useEffect(() => {
    if (state !== "preview" || tab !== "site" || !desk) return;
    const el = frameRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth || 360) / 1280));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state, tab, desk]);

  /* ---------------- photos ---------------- */

  async function productPhoto(i: number, f: File) {
    patchRow(i, { busy: true, note: "", bad: false });
    try {
      const url = await uploadImage(await compressToFile(f, "product.jpg", 1600, 0.88), "product");
      if (!url) { patchRow(i, { busy: false, bad: true, note: T("Could not upload the photo. Please try again.", "Photo upload नहीं हो पाई। दोबारा try करें।") }); return; }
      patchRow(i, { photo: url, original: url, studio: false, busy: false });
    } catch {
      patchRow(i, { busy: false, bad: true, note: T(OFFLINE, "internet नहीं है — दोबारा try करें।") });
    }
  }

  async function studio(i: number) {
    const row = rows[i];
    if (!row?.photo) return;
    if (!access.active || access.balance < 5) { setUnlock(true); return; }
    patchRow(i, { busy: true, bad: false, note: T("Making it look professional… (about 20 seconds)", "Photo professional बनाई जा रही है… (करीब 20 second)") });
    try {
      const r = await api<{ url?: string; error?: string }>("/api/card/product-photo", {
        method: "POST",
        json: { photo_url: row.photo, product: row.name, brand: row.brand, allowPaid: true, product_id: row.id },
      });
      if (r.ok && r.data.url) patchRow(i, { original: row.photo, photo: r.data.url, studio: true, busy: false, bad: false, note: T("✨ Studio photo ready", "✨ Studio photo तैयार") });
      else { patchRow(i, { busy: false, bad: true, note: r.data.error ?? T("Your photo is kept as it is.", "आपकी photo वैसी ही रहेगी।") }); if (r.status === 402) setUnlock(true); }
    } catch {
      patchRow(i, { busy: false, bad: true, note: T(OFFLINE, "internet नहीं है — दोबारा try करें।") });
    } finally {
      access.refresh();
    }
  }



  /* ---------------- build ---------------- */

  /** The whole build. The load pass hands in what it just read, because this function was made before
   *  that state existed; every other caller uses what is on screen. */
  /** "dps school" instead of a link (owner, 2 Oct 2026: "yahan name se koi site search nahi hui"): the official
   *  website is looked up by name — the same lookup as step 2 — and put in the box; the person sees what was
   *  found and can clear it. A name nothing is found for is left as typed, with a line saying so. */
  const [finding, setFinding] = useState("");
  const [found, setFound] = useState<{ q: string; url: string; name: string } | null>(null);
  async function resolveSite(): Promise<string> {
    const v = facts.website.trim();
    if (!v || looksLikeSite(cleanSiteUrl(v)) || socialDetour(v) || v.length < 2) return cleanSiteUrl(v);
    if (found && found.q === v) return found.url;
    setFinding(v);
    try {
      const r = await api<{ ok: boolean; url?: string; name?: string }>("/api/site/find", { method: "POST", json: { q: v } });
      const url = r.ok && r.data.ok && r.data.url ? r.data.url : "";
      if (url) { setF({ website: url }); setFound({ q: v, url, name: r.data.name || url }); }
      else setFound({ q: v, url: "", name: "" });
      return url;
    } catch { setFound({ q: v, url: "", name: "" }); return ""; } finally { setFinding(""); }
  }

  /** How many times "Write again" was pressed on this preview: each try differs from the last. */
  const freshRound = useRef(0);
  async function build(over?: { facts?: CardFacts; rows?: Row[]; existing?: Card | null; uid?: string; back?: "form" | "preview" | "make"; fresh?: boolean; wants?: WriteAgainWant[]; note?: string; imageNote?: string; wordsNote?: string; photoCount?: number; photoMode?: "add" | "replace"; replaceUrls?: string[] }) {
    const f = over?.facts ?? facts;
    const rs = over?.rows ?? rows;
    const live = over && "existing" in over ? over.existing ?? null : existing;
    const me = over?.uid ?? uid;
    // A failed build returns to the screen it was asked from: the Make screen (with its message) is not swapped for the questions form.
    const back = over?.back ?? (state === "preview" ? "preview" : state === "make" ? "make" : "form");
    setErr(""); setNotice(""); setElapsed(0); setStage("details"); setState("building");
    try {
      const products: BuildRow[] = rs
        .filter((r) => r.name.trim())
        .map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), brand: r.brand.trim(), price: r.price.trim(), photo: r.photo, studio: !!r.studio }));
      // The site is "new" when the set-up said so, or when the website typed on this form differs from the one
      // the server had when the form opened.
      const siteChanged = siteNew.current || (!!f.website && f.website !== serverSite.current);
      // "Write again": the look on screen goes along as the one to avoid (owner's call, 4 Oct 2026).
      const leaving = over?.fresh ? (shown ?? card) : null;
      const wants: WriteAgainWant[] = over?.wants?.length ? over.wants : over?.note?.trim() ? [] : ["look", "layout"];
      const fresh = over?.fresh ? { style: leaving?.site?.style ?? {}, round: ++freshRound.current, wants: [...wants], ...(over?.note?.trim() ? { note: over.note.trim().slice(0, 200) } : {}), ...(over?.imageNote?.trim() ? { imageNote: over.imageNote.trim().slice(0, 600) } : {}), ...(over?.wordsNote?.trim() ? { wordsNote: over.wordsNote.trim().slice(0, 400) } : {}), ...(over?.photoCount ? { photoCount: over.photoCount } : {}), ...(over?.photoMode ? { photoMode: over.photoMode } : {}), ...(over?.replaceUrls?.length ? { replaceUrls: over.replaceUrls.slice(0, 12) } : {}) } : null;
      // Words not asked for: the card as it is goes along, so its words and pages stay and only the rest changes.
      const keepWords = !!fresh && !wants.includes("words") && !!leaving;
      const body: BuildRequest = { facts: { ...f, primaryCardId: undefined }, products, ...(siteChanged ? { siteChanged: true } : {}), ...(fresh ? { fresh } : {}), ...(keepWords ? { refresh: true, current: leaving as unknown as Record<string, unknown> } : {}) };
      siteNew.current = false;
      const r = await api<JobView & { error?: string }>("/api/card/build", { method: "POST", json: { ...body, async: true } });
      if (!r.ok || !r.data?.job) { setErr(r.data?.error || T("Could not make your website. Please try again.", "आपकी website नहीं बन पाई। दोबारा try करें।")); setState(back); return; }
      await follow(r.data, { live, me, back, f, also: alsoShubhora });
    } catch {
      setErr(T(OFFLINE, "internet नहीं है — दोबारा try करें।")); setState(back);
    }
  }

  /** Waits for the server's build — asking every few seconds — and turns its card into the preview. A lost
   *  connection only pauses the asking: the build carries on on the server and is picked up when the phone is back. */
  async function follow(first: JobView, ctx: FinishCtx) {
    setState("building");
    let v = first;
    while (v.state === "running") {
      if (!mounted.current) return;
      setStage(v.stage); setElapsed(v.elapsed);
      await new Promise((res) => setTimeout(res, 3000));
      try {
        const r = await api<JobView | { job: null }>("/api/card/build");
        if (r.ok && r.data.job) { v = r.data as JobView; setLost(false); }
        else if (r.ok) { setErr(T("Could not make your website. Please try again.", "आपकी website नहीं बन पाई। दोबारा try करें।")); setState(ctx.back); return; }
        else setLost(true);
      } catch { setLost(true); }
    }
    setLost(false);
    if (mounted.current) await finish(v, ctx);
  }

  /** A finished build (just now, or while the screen was closed) → the preview; the first card goes live. */
  async function finish(v: JobView, ctx: FinishCtx) {
    const { live, me, back, f } = ctx;
    const claimIt = () => api("/api/card/build", { method: "POST", json: { claim: v.job } }).catch(() => undefined);
    const r = { ok: (v.status ?? 500) < 400, status: v.status ?? 500, data: (v.result ?? {}) as Partial<BuildResponse> & { error?: string } };
    try {
      const built = r.data?.card;
      if (!r.ok || !built) {
        void claimIt();
        // The server's own word on Write again: Premium, or 5 credits short.
        if (r.status === 402 && (r.data as { plan?: boolean } | undefined)?.plan) { setState(back); setPremiumUnlock(true); return; }
        if (r.status === 402 && (r.data as { needCredits?: number } | undefined)?.needCredits) { setState(back); setAgainUnlock(true); access.refresh(); return; }
        setErr(r.data?.error || T("Could not make your website. Please try again.", "आपकी website नहीं बन पाई। दोबारा try करें।")); setState(back); return;
      }

      let name = live?.username ?? "";
      if (!name) {
        // The card's link is the person's NAME (owner's call, 24 Sep 2026): /c/rajesh-kumar, not the account
        // username. The username stays for the referral link and the partner panel. Name first, then the business
        // name, then the account username — and a random slug only when nothing else is available.
        // Owner's choice (setup / this screen / editor): business name first when they picked it.
        const bizFirst = (await getLinkPref()) === "business" && !!built.company?.trim();
        const [first, second] = bizFirst ? [built.company, built.name] : [built.name || built.company, built.company || ""];
        const picked = await suggestUsername(first || "").catch(() => null)
          ?? await suggestUsername(second || "").catch(() => null);
        let fallback = "";
        if (!picked) {
          const acct = await api<{ username: string | null }>("/api/account").catch(() => null);
          const mine = acct?.ok && acct.data.username ? cleanUsername(acct.data.username) : "";
          const mineFree = mine ? (await checkUsername(mine).catch(() => ({ state: "idle" as const }))).state !== "bad" : false;
          fallback = mineFree ? mine : "";
        }
        name = picked ?? fallback ?? `card-${Math.random().toString(36).slice(2, 8)}`;
        if (!name) name = `card-${Math.random().toString(36).slice(2, 8)}`;
      }
      const full0 = mergeBuiltCard(live, built, { id: live?.id ?? crypto.randomUUID(), username: name });
      const nextChecks = r.data.checks ?? [];
      const nextMissing = r.data.missing ?? [];
      const sig = cardSig(live);
      const nextLooks = (r.data.looks ?? []) as LookPlan[];
      // A first build opens on the Colour poster (owner, 14 Oct 2026) — or, for a trade a poster does not suit, the trade's own first blueprint
      // (site-looks.ts openingLook); a rewrite keeps the look it was asked for.
      const storyLook = !v.fresh && built.site ? openingLook(threeLooks(built, built.site.style, nextLooks.length ? nextLooks : undefined), built.seo?.categoryKey) : undefined;
      const full = storyLook ? applyLook(full0, storyLook) : full0;
      // The website first (the looks are its), then the card — so the preview opens on the Website tab.
      setCard(full); setBuilt(built); setLiveSig(sig); setChecks(nextChecks); setMissing(nextMissing); setOff([]); setTab(built.site?.enabled === false && !live?.site?.enabled ? "phone" : "site"); setDesk(true); setPlans(nextLooks.length ? nextLooks : undefined);
      // A new build is never the card that is live, however the screen got there (Write again on a live preview,
      // ?improve=1, a restored draft): "Make it live" comes back, with its "update your live card?" question. It
      // used to stay "Live", so a paid rewrite could not be published at all — except silently, by tapping a look.
      setLiveUser("");
      if (v.fresh) access.refresh();
      if (me) writeJson(draftKey(me), { card: full, built, liveSig: sig, checks: nextChecks, missing: nextMissing, off: [], savedAt: Date.now(), ...(nextLooks.length ? { looks: nextLooks } : {}) } satisfies Draft);
      // Kept on this phone now (the draft above), so the server need not offer it again.
      void claimIt();
      // Three different things, which used to be one vague line:
      //   • the site could not be opened at all;
      //   • it opened and gave us nothing, because it is built in JavaScript — the page is empty until a
      //     browser runs its scripts, so there is nothing for us (or anything else that does not run them)
      //     to read. Saying "could not open it" there was simply wrong;
      //   • it opened and gave us products and pictures, which is the normal case and needs no notice.
      // The designer's own line, so the owner sees the site was designed for them (and a build with no plan shows as such).
      setDesignNote(r.data.design?.why ?? "");
      const found = r.data.siteFound;
      if (r.data.siteRead === false) {
        setNotice(f.websiteRole === "reference" && f.website
          ? T("We could not open that website, so your card got our own look — you can change it any time under Card & Website → Edit → Website design.", "वो website खुल नहीं पाई, इसलिए आपके card को हमारा look मिला — Card & Website → Edit → Website design से जब चाहें बदल सकते हैं।")
          : T("We could not open your website, so your website was made from your other details.", "आपकी website खुल नहीं पाई, इसलिए V-Card आपकी बाकी जानकारी से बना है।"));
      } else if (r.data.aiPhotos && !(f.websiteRole === "reference" && f.website)) {
        setNotice(hi
          ? `आपके काम की ${r.data.aiPhotos} pictures बनाई गईं ताकि website खाली न लगे। अपनी असली photos लगाते ही ये हट जाएँगी: Card & Website → Edit → Photo & banner।`
          : `${r.data.aiPhotos} pictures were made for your trade so the website is not empty. Your real photos replace them the moment you add some: Card & Website → Edit → Photo & banner.`);
      } else if (r.data.aiPhotos) {
        setNotice(hi
          ? `आपका card उस website के look में बना है, और उसे भरने के लिए आपके काम की ${r.data.aiPhotos === 1 ? "1 picture" : `${r.data.aiPhotos} pictures`} बनाई गई — किसी और site की photo हम कभी copy नहीं करते। अपनी photo जब चाहें लगा लें: Card & Website → Edit → Photo & banner।`
          : `Your card was built in that website's look, and ${r.data.aiPhotos === 1 ? "a picture was" : `${r.data.aiPhotos} pictures were`} made for your trade to fill it — we never copy another site's photos. Swap them for your own any time: Card & Website → Edit → Photo & banner.`);
      } else if (f.websiteRole === "reference" && f.website) {
        setNotice(T("Your card was built in that website's look, with photos of your trade — we never copy another site's pictures. Put your own photos in any time: Card & Website → Edit → Photo & banner.", "आपका card उस website के look में बना है, photos आपके काम की हैं — किसी और site की photo हम कभी copy नहीं करते। अपनी photos जब चाहें डाल लें: Card & Website → Edit → Photo & banner।"));
      } else if (found && !found.products && !found.photos && f.websiteRole !== "reference") {
        setNotice(T("We opened your website but it had nothing we could read — its pages are drawn by JavaScript, so they are empty until a browser runs them. Your card was made from your other details. Add your products below (or on the Products screen) and they will appear with photos and prices.", "आपकी website खुली, पर पढ़ने के लिए कुछ नहीं मिला — उसके page JavaScript से बनते हैं, इसलिए browser चलाए बिना खाली रहते हैं। आपका card बाकी जानकारी से बना है। नीचे (या Products screen पर) अपने products डाल दें — photo और price के साथ दिख जाएँगे।"));
      } else if (r.data.standIns?.length) {
        // What the build had to stand in for (card-audit.ts): said plainly, so the owner knows what to replace.
        const si = r.data.standIns;
        const parts: string[] = [];
        if (si.includes("stock-photos")) parts.push(T("the photos are stock pictures of your trade — put your own in from Card & Website → Edit → Photo & banner", "photos आपके काम की stock pictures हैं — Card & Website → Edit → Photo & banner से अपनी photos लगा लें"));
        const typical = (["typical-services", "typical-steps", "typical-why-us", "typical-faq"] as const).filter((k) => si.includes(k))
          .map((k) => (hi
            ? { "typical-services": "services", "typical-steps": "steps", "typical-why-us": "why-us points", "typical-faq": "सवाल-जवाब" }
            : { "typical-services": "services", "typical-steps": "the steps", "typical-why-us": "the why-us points", "typical-faq": "the questions" })[k]);
        if (typical.length) parts.push(hi
          ? `${typical.join(", ")} आपके काम में आम तौर पर जो होते हैं, वही हैं — जो ठीक न लगे बदल लें`
          : `${typical.join(", ")} are the usual ones for your trade — edit any that do not fit`);
        setNotice(hi ? `आपका card तैयार है। ${parts.join("; ")}।` : `Your card is ready. ${parts.join("; ")}.`);
      }
      setState("preview");
      try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
      // Nothing goes live on its own (owner, 6 Oct 2026: "website bante hi 3 option dikhe — view and select any one —
      // then 'looking nice, live this'"): the owner looks at the three designs, picks one, taps Live.
      void live; void me; void ctx;
    } catch {
      // The finished card stays on the server (not claimed): opening this screen again picks it up.
      setErr(T(OFFLINE, "internet नहीं है — दोबारा try करें।")); setState(back);
    }
  }

  /* ---------------- publish ---------------- */

  /** The live card as the server has it now → the screen (after the banner landed, or was put back). */
  async function refreshLive(cardId: string) {
    try {
      const cards = await fetchMyCardsStrict();
      const row = cards.find((c) => c.id === cardId);
      if (!row) return;
      setExisting(row); setLiveSig(cardSig(row));
      // The screen is replaced only while it shows the live card itself. A fresh build waiting for "Make it live"
      // (liveUser is "" then), or a look tapped and not yet live, would otherwise be thrown away for the live row
      // when the banner lands a minute later — the paid rewrite gone, its job already claimed.
      if (!liveUserRef.current || publishing.current || pendingPublish.current) return;
      // A new link saved but not yet put live stays too: the row would put the old one back.
      setCard((c) => (c && c.username !== row.username ? c : row)); if (row.active) setLiveUser(row.username);
      const { id: _i, username: _u, plan: _p, active: _a, views: _v, createdAt: _c, ...tpl } = row; void _i; void _u; void _p; void _a; void _v; void _c; setBuilt(tpl as TemplateCard);
    } catch { /* offline: the next open shows it */ }
  }
  /** Starts (or joins) the banner job and follows it to the end. `again`: one more, a credit a picture. */
  async function startBanner(cardId: string, again = false) {
    if (!access.subscribed) { setPremiumUnlock(true); return; }
    setBannerMsg("");
    setBanner({ state: "running", elapsed: 0 });
    const r = await api<JobView & { error?: string; charged?: number; own?: boolean; needCredits?: number; plan?: boolean }>("/api/card/banner", { method: "POST", json: { cardId, ...(again ? { again: true, count: 1 } : {}) } }).catch(() => null);
    if (!r || !r.ok || !r.data?.job) {
      if (r?.data?.own) { setBanner({ state: "idle" }); return; }
      if (r?.status === 402 && r.data?.needCredits) { setBanner({ state: "idle" }); setAgainUnlock(true); access.refresh(); return; }
      setBanner({ state: "failed", error: r?.data?.error || T("The banner could not be made now.", "Banner अभी नहीं बन पाया।") }); return;
    }
    void followBanner(r.data, cardId, r.data.charged);
  }
  async function followBanner(first: JobView, cardId: string, charged?: number) {
    let v = first;
    while (v.state === "running") {
      if (!mounted.current) return;
      setBanner({ state: "running", job: v.job, elapsed: v.elapsed, charged });
      await new Promise((res) => setTimeout(res, 4000));
      const r = await api<JobView | { job: null }>("/api/card/banner").catch(() => null);
      if (r?.ok && r.data.job) v = r.data as JobView;
    }
    if (!mounted.current) return;
    const res = (v.result ?? {}) as { ok?: boolean; error?: string; prev?: unknown };
    if (v.state === "done" && res.ok) { await refreshLive(cardId); setBanner({ state: "done", job: v.job, charged, prev: !!res.prev }); if (charged) access.refresh(); }
    else { setBanner({ state: "failed", job: v.job, error: res.error || T("The banner could not be made now.", "Banner अभी नहीं बन पाया।") }); void api("/api/card/banner", { method: "POST", json: { claim: v.job } }).catch(() => undefined); }
  }
  async function bannerKeep() { setBannerMsg(""); if (banner.job) void api("/api/card/banner", { method: "POST", json: { claim: banner.job } }).catch(() => undefined); setBanner({ state: "idle" }); }
  async function bannerRevert(cardId: string) {
    if (!banner.job) { setBannerMsg(T("The old photo cannot be put back now.", "पुरानी photo अभी वापस नहीं लग सकती।")); return; }
    setBusy("banner"); setBannerMsg("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/card/banner", { method: "POST", json: { revert: banner.job } });
      if (r.ok) { await refreshLive(cardId); setBanner({ state: "idle" }); }
      else setBannerMsg(r.data?.error || T("Could not put the old photo back. Please try again.", "पुरानी photo वापस नहीं लग पाई। दोबारा try करें।"));
    } catch { setBannerMsg(T(OFFLINE, "internet नहीं है — दोबारा try करें।")); }
    finally { setBusy(""); }
  }

  /** The first card goes live on its own. A failure just leaves the "Make it live" button, nothing is lost. */
  async function goLive(full: Card, me: string, also = alsoShubhora) {
    // Marked like publish(): a look tapped meanwhile waits in pendingPublish (never a second publish alongside this
    // one) and goes live from the finally below.
    publishing.current = true;
    setBusy("publish");
    try {
      // "Both — my business and Shubhora": the first card goes live from here without ever reaching publish(),
      // so the hidden Shubhora page is added here too — otherwise the choice made at set-up was simply lost.
      let out = full;
      const addShubhora = also && !hasShubhoraPage(out);
      if (addShubhora) out = withShubhoraPage(out, { visible: false });
      const r = await publishCard(out);
      if (!r.ok) return;
      void getBrowserSupabase()?.auth.updateUser({ data: { setup_pos: null } }).catch(() => undefined);
      if (addShubhora) {
        setAlsoShubhora(false);
        await getBrowserSupabase()?.auth.updateUser({ data: { also_shubhora: null } }).catch(() => undefined);
      }
      if (me) { dropKey(draftKey(me)); dropKey(formKey(me)); }
      // A look tapped while this ran is ahead of `out`: the card on screen keeps it (only the live id and link are
      // taken) and the queued publish puts it live next. Nothing tapped: the published card, as before.
      setCard((c) => (c ? pendingPublish.current ? { ...c, id: out.id, username: r.username || c.username } : { ...out, username: r.username || c.username } : c));
      setLiveUser(r.username || out.username);
      // The finished flow (owner's call, 2 Oct 2026): the website first, then the card, then OK → home.
      setTab("site");
      try {
        const cards = await fetchMyCardsStrict();
        const row = cards.find((c) => c.username === (r.username || out.username));
        if (row) {
          setExisting(row); setLiveSig(cardSig(row));
          await api("/api/card/facts", { method: "PATCH", json: { facts: { primaryCardId: row.id } } });
          // Final (docs/website-looks-v2.md §7): the AI banner is painted now, in the look that went live.
          if (access.subscribed && !ownBanner && !madeByUs(row.coverUrl)) void startBanner(row.id);
        }
      } catch { /* the card is live; the primary mark can wait */ }
    } catch { /* offline: the button stays */ } finally {
      publishing.current = false;
      setBusy("");
      if (pendingPublish.current) flushPublish();
    }
  }

  /** `card`: the card to put live when it is not the one on screen yet (a look just tapped — React state has not
   *  settled, and the stale `shown` used to copy the previous look's tiles and home order over the new one).
   *  `quiet`: a look / adjustment on a live site — the page must not jump to the top. */
  async function publish(opts?: { card?: Card; quiet?: boolean; confirmed?: boolean }) {
    if (!shown || !card) return;
    const base = opts?.card ? applyChecks(opts.card, checks, off) : shown;
    if (existing && existing.active && !isThinCard(existing) && !liveUser && !opts?.confirmed) { setAskLive(opts ?? {}); return; }
    publishing.current = true;
    setBusy("publish"); setErr("");
    try {
      // The live card is read again and the new words are merged into THAT, not into the copy this preview was
      // made from. Anything the owner changed in the editor meanwhile (popup, pixels, a new page, the design)
      // therefore stays, instead of being overwritten by an older preview.
      let out = base;
      // mergeBuiltCard replaces the card's pages with the newly built ones, so a Shubhora page that is
      // already live would be thrown away by a rebuild. Remember it (and whether its tab was switched on)
      // and put it back below.
      let keepShubhora = hasShubhoraPage(base);
      let shubhoraVisible = !base.pages.find((p) => p.slug === SHUBHORA_PAGE_SLUG)?.hidden;
      if (built) {
        let live: Card | null;
        try {
          const cards = await fetchMyCardsStrict();
          live = cards.find((c) => c.id === existing?.id) ?? cards.find((c) => c.username === card.username) ?? null;
        } catch { setErr(T(OFFLINE, "internet नहीं है — दोबारा try करें।")); return; }
        if (live && hasShubhoraPage(live)) {
          keepShubhora = true;
          shubhoraVisible = !live.pages.find((p) => p.slug === SHUBHORA_PAGE_SLUG)?.hidden;
        }
        // The screen shows the live card itself (it went live from here, or opened with ?improve=1) and only its look,
        // adjustments or link changed: the live row AS IT IS NOW is the base, with the look laid on below. Merging
        // the build it came from would put that build's stock picture back over the AI banner (§7) the banner
        // job has since painted, and lose anything else done to the card meanwhile. A new build merges as before.
        out = live && liveUser
          ? applyChecks({ ...live, username: card.username, site: { ...live.site, enabled: !!live.site?.enabled || access.subscribed } }, checks, off)
          : applyChecks(mergeBuiltCard(live, built, { id: live?.id ?? card.id, username: card.username }), checks, off);
        // The look on screen is the one that goes live (owner's call, 4 Oct 2026: "jisko select kare wo open honi
        // chahiye"). The merge above keeps a live card's earlier style and the server's card carries the designer's;
        // the preview the owner approved carries the look they picked, and that wins over both.
        const pickedStyle = base.site?.style;
        if (pickedStyle && out.site) out = { ...out, site: { ...out.site, style: { ...pickedStyle } } };
        // A card built for the owner's OWN business over a Shubhora seller card must not keep that card's seller marks (demo, 19 Oct 2026:
        // "Sharma Sweets" went live with kb "shubhora" and the Shubhora logo): the assistant would answer as Shubhora and the plan-photo sync would run.
        if (!liveUser && out.kb === "shubhora" && !isShubhoraSellerCard(out)) {
          const { kb: _kb, ...rest } = out; void _kb;
          out = { ...rest, ...(out.site?.logoUrl === "/art/brand/shubhora-logo.png" ? { site: { ...out.site, logoUrl: undefined } } : {}) } as Card;
        }
        // The owner's adjustments on the preview (tiles, clip / photo, section order and hidden list) go live too.
        if (out.site && base.site) {
          const h = base.site.hero;
          out = { ...out, site: { ...out.site, ...(base.site.home ? { home: base.site.home } : {}), ...(out.site.hero ? { hero: { ...out.site.hero, ...(h?.tiles ? { tiles: h.tiles } : {}), ...(h?.video !== undefined ? { video: h.video } : {}) } } : {}) } };
        }
      }
      // "Both — my business and Shubhora": the Shubhora page rides along on the first publish, so the choice
      // made at set-up is not lost on the way to the finished card. It is appended last and marked hidden, so
      // the card still opens on the owner's own home page and their customers never see it. A page that was
      // already live is put back the same way, with its tab left however the owner had it.
      const addShubhora = (alsoShubhora || keepShubhora) && !hasShubhoraPage(out);
      if (addShubhora) out = withShubhoraPage(out, { visible: keepShubhora && shubhoraVisible });
      const r = await publishCard(out);
      if (!r.ok) { setErr(r.error); return; }
      void getBrowserSupabase()?.auth.updateUser({ data: { setup_pos: null } }).catch(() => undefined);
      // The choice has been carried out, so it is not carried again: someone who later takes the page off and
      // rebuilds their card with AI should not have it come back on its own. Adding it again is one tap on
      // My V-Card.
      if (addShubhora && alsoShubhora) {
        setAlsoShubhora(false);
        await getBrowserSupabase()?.auth.updateUser({ data: { also_shubhora: null } }).catch(() => undefined);
      }
      if (uid) { dropKey(draftKey(uid)); dropKey(formKey(uid)); }
      try {
        const cards = await fetchMyCardsStrict();
        const row = cards.find((c) => c.username === r.username);
        if (row) {
          // The live card is this one now: the draft kept here matches it, so a reload shows this preview, live.
          setExisting(row); setLiveSig(cardSig(row));
          await api("/api/card/facts", { method: "PATCH", json: { facts: { primaryCardId: row.id } } });
          if (access.subscribed && !ownBanner && !madeByUs(row.coverUrl)) void startBanner(row.id);
        }
      } catch { /* the card is live; the primary mark can wait */ }
      // The same finished flow as an automatic build: website first, then the card, then OK → home.
      // A newer tap is already waiting: the card on screen is ahead of this one, so it is left alone.
      if (!pendingPublish.current) setCard((c) => (c ? { ...out, username: r.username || c.username } : c));
      setLiveUser(r.username || out.username);
      // A quiet publish (a look, in the background) leaves the tabs and the bar as the owner has them: it used to pull
      // the Card tab back to the Website and flip the bar's button under their finger.
      if (!opts?.quiet) { if (uid) dropKey(draftKey(uid)); setTab("site"); doneFromPreview.current = true; setState(improveMode ? "done" : "style"); try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } }
    } catch {
      setErr(T(OFFLINE, "internet नहीं है — दोबारा try करें।"));
    } finally {
      publishing.current = false;
      setBusy("");
      if (pendingPublish.current) flushPublish();
    }
  }

  async function editFirst() {
    if (!shown) return;
    // Already live from this screen: the editor opens the live card itself (no stale copy on top of it) — once a
    // look still on its way live has landed, or the editor would load the old look and save it back over the new.
    if (liveUser && existing) {
      if (pendingPublish.current || publishing.current) { setBusy("edit"); try { await settlePublish(); } finally { setBusy(""); } }
      router.push(`/poster/d/editor?id=${existing.id}`); return;
    }
    try { sessionStorage.setItem(SEED_KEY, JSON.stringify(shown)); } catch { /* private mode */ }
    // The editor takes over from here: this saved preview must never come back later and undo what is done there.
    if (uid) { dropKey(draftKey(uid)); dropKey(formKey(uid)); }
    router.push(existing ? `/poster/d/editor?id=${existing.id}&seed=1` : "/poster/d/editor?seed=1");
  }

  /* ---------------- Back ---------------- */

  // ONE rule (owner, 15 Oct 2026: "back matlab previous page"): Back is the screen the owner was just on (lib/nav-back). Inside this one
  // address the screens are steps — the questions form, Make, the design screen, the finished screen — and Back is the step before. A
  // website that is already live never goes back to the questions or to Make: that is how it used to be built a second time.
  // The browser's own Back / Android back leaves this page (the steps are not history entries: two entries on one address would need two
  // taps to leave after every reload, or return to Make on a live site) — it lands on the screen before this page.
  const toTop = () => { try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } };
  /** Make → the questions form when the owner came through it, else the screen before Make (the set-up's last screen when the app has no earlier one). */
  function backFromMake() {
    setErr(""); setMakeFrom("");                                            // a message belongs to the step it came from, not the next one
    if (cameFromForm.current) { cameFromForm.current = false; setState("form"); toTop(); return; }
    goBack(router, WALK_END);
  }
  /** The questions form → the website it was opened from ("Edit details"), else the screen before it. */
  function backFromForm() {
    setErr(""); setMakeFrom("");
    if (card) { setState("preview"); toTop(); return; }
    goBack(router, WALK_END);
  }
  /** The design screen → Make, only before anything is live. */
  function backFromPreview() {
    if (busy === "publish") return;                                        // going live: the finished screen follows by itself
    // Opened from Card & Website, Products, the AI page or the banner notification (?improve=1): back to where it was opened from.
    if (improveMode) { goBack(router, "/poster/site?edit=site"); return; }
    // Live: never Make (it would offer to build it again). Make is in-page state, not a history entry, so Back lands on the screen before this page.
    if (liveUser) { goBack(router, "/poster"); return; }
    // A new build of a website that is already live (?again=1, a new website at set-up): back to where it was asked for, never to Make.
    // With no earlier screen (opened fresh): the last form step of the set-up, not Card & Website (owner, 20 Oct 2026: Back = the previous step).
    if (isLiveSite(existing)) { goBack(router, screenHref(LAST_ONBOARD_SCREEN)); return; }
    setErr(""); setMakeFrom("");
    setState("make"); toTop();
  }
  /** The finished screen → the design screen when the owner came from it; opened straight (the dock, Home, a reload) it is the screen before this page. */
  function backFromDone() {
    setErr(""); setMakeFrom("");
    if (doneFromPreview.current) { setState("domain"); toTop(); return; }
    goBack(router, "/poster/site");
  }

  /* ---------------- screens ---------------- */

  // The free plan is the digital card only (owner, 16 Oct 2026). `freeMake`: the Make screen offers a free account its card, and the website as
  // the Standard plan's. `cardOnly`: the build the server just made came back with the website off (a free account with no website
  // on) -- the preview, the next steps and the finished screen then talk about the card; a website already live is left exactly as it was.
  const freeMake = !access.subscribed && !existing?.site?.enabled;
  const cardOnly = built?.site?.enabled === false && !existing?.site?.enabled;

  if (state === "loading") return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  if (state === "error") return (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{T("No internet — tap to try again", "internet नहीं है — दोबारा try करें")}</p>
      <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> {T("Try again", "दोबारा try करें")}
      </button>
    </div>
  );

  if (state === "building") {
    // A website of their own (or their brand's) is read page by page — a JavaScript-built one in a real browser.
    const readingSite = !!(facts.website && facts.websiteRole !== "reference") || (!facts.website && !!setup?.website);
    const ORDER: BuildStage[] = ["details", "website", "pictures", "writing", "checking"];
    const at = ORDER.indexOf(stage);
    const steps: [BuildStage, string][] = [
      ["details", T("Reading your details", "आपकी जानकारी पढ़ी जा रही है")],
      ...(readingSite ? [["website", T("Reading your website — logo, photos, products", "आपकी website पढ़ी जा रही है — logo, photos, products")] as [BuildStage, string]] : []),
      ["pictures", T("Choosing photos of your trade", "आपके काम की photos चुनी जा रही हैं")],
      ["writing", T("Writing your website", "आपकी website लिखी जा रही है")],
      ["checking", T("Checking the design", "Design जाँचा जा रहा है")],
    ];
    const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
    return (
      <div className="mx-auto max-w-sm space-y-5 py-14">
        <div className="grid place-items-center gap-2 text-center">
          <LoaderCircle className="h-7 w-7 animate-spin text-brand" />
          <p className="text-lg font-bold">{T("Your website is being made", "आपकी website बन रही है")}</p>
          <p className="text-xs text-muted">{T("About 1 minute", "लगभग 1 मिनट")} · {clock}</p>
        </div>
        <ul className="space-y-2.5 rounded-2xl border border-border bg-surface p-4 text-sm">
          {steps.map(([k, label]) => {
            const i = ORDER.indexOf(k);
            return (
              <li key={k} className={`flex items-center gap-2.5 ${i > at ? "text-muted" : ""}`}>
                {i < at ? <CheckCircle2 className="h-5 w-5 shrink-0 text-good" /> : i === at ? <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-brand" /> : <CircleDashed className="h-5 w-5 shrink-0" />}
                <span className={i === at ? "font-semibold" : ""}>{label}</span>
              </li>
            );
          })}
        </ul>
        {/* The build is the server's (card-jobs.ts): closing the screen no longer loses it, and a second tap joins it. */}
        {/* Short (owner, 24 Oct 2026: "lambi line… simple likho"). */}
        <p className="text-center text-xs text-muted">✓ {T("You can close this screen.", "Screen बंद कर सकते हैं।")}</p>
        {lost && <p className="rounded-xl border border-amber/50 bg-amber/10 px-3 py-2 text-center text-xs">{T("No internet. It is still being made.", "Internet नहीं है। Website बन रही है।")}</p>}
      </div>
    );
  }

  /** The Premium sheet: asked for from the Make screen, the preview (Write again, the banner) and finish() alike. */
  const premiumDialog = premiumUnlock && <UnlockDialog subscriptionOnly title={T("This needs the Standard plan", "इसके लिए Standard plan चाहिए")} reason={T("No Shubhora tag, your website on Google, an AI banner and AI edits, WhatsApp AI 24×7. Activate the plan, then try again.", "Shubhora tag नहीं, website Google पर, AI banner और AI edits, WhatsApp AI 24×7। Plan चालू करें, फिर दोबारा try करें।")} onClose={() => { setPremiumUnlock(false); access.refresh(); }} />;

  /** The AI banner's state (painting / failed / made: Keep, Another, Back to stock) — on the design screen AND on the finished screen,
   *  because a publish moves the owner to the finished screen while the banner is still being painted. Its message sits in its own box. */
  const bannerBlock = (
    <>
      {banner.state === "running" && <p className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin text-brand" /> {T("Painting your AI banner…", "आपका AI banner बन रहा है…")} <span className="text-xs text-muted">{T("about a minute; you can close this screen", "करीब 1 मिनट; screen बंद कर सकते हैं")}</span></p>}
      {banner.state === "failed" && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{banner.error} <button type="button" onClick={() => existing && startBanner(existing.id)} className="ml-2 font-semibold underline">{T("Try again", "दोबारा")}</button></p>}
      {banner.state === "done" && existing && (
        <div className="space-y-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm">
          <p><b className="text-good">✨ {T("Your AI banner is on the website.", "आपकी website पर AI banner लग गया।")}</b> <span className="text-xs text-muted">{T("See it on the Website tab.", "Website tab में देखें।")}</span></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={bannerKeep} className="rounded-lg grad-brand px-3.5 py-2 text-sm font-semibold text-white">{T("Keep it", "रखो")}</button>
            <button type="button" disabled={busy === "banner"} onClick={() => startBanner(existing.id, true)} className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold disabled:opacity-60">{T("Make another", "दूसरा बनाओ")} <CreditPrice credits={1} /></button>
            {banner.prev && <button type="button" disabled={busy === "banner"} onClick={() => bannerRevert(existing.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold disabled:opacity-60">{busy === "banner" && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{T("Back to stock photo", "Stock photo वापस")}</button>}
          </div>
          {bannerMsg && <p className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">{bannerMsg}</p>}
        </div>
      )}
    </>
  );

  // The finished flow (owner, 7 Oct 2026): Save and next → "Congratulations, your website and e-card are live" →
  // Edit now (Create → Card & Website → Edit) or Later (home).
  // Colours and fonts — its own step between the design and "Congratulations" (owner, 15 Oct 2026): pick or skip.
  /** Where the owner is after the build (owner, 24 Oct 2026: "kahi koi confusion hi na rahe"): Design → Colours → Link → Ready. */
  const afterSteps = (at: number) => {
    const names = cardOnly ? [T("Design", "Design"), T("Link", "Link"), T("Ready", "तैयार")] : [T("Design", "Design"), T("Colours", "रंग"), T("Link", "Link"), T("Ready", "तैयार")];
    const i = cardOnly && at > 0 ? at - 1 : at;
    return (
      <ol className="flex items-center gap-1" aria-label={T("Steps", "Steps")}>
        {names.map((n, k) => (
          <li key={n} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className={`h-1.5 w-full rounded-full ${k < i ? "bg-good" : k === i ? "bg-brand" : "bg-surface2"}`} />
            <span className={`truncate text-[10px] font-semibold ${k === i ? "text-brand-ink" : k < i ? "text-good" : "text-muted"}`}>{k < i ? "✓ " : ""}{n}</span>
          </li>
        ))}
      </ol>
    );
  };

  if (state === "style" && shown && card?.site) {
    // Next is "Select your domain", then Congratulations (owner, 24 Oct 2026).
    const goDone = () => { setState("domain"); try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } };
    const restyle = (patch: Record<string, unknown>) => { const next = { ...card, site: { ...card.site!, style: { ...(card.site!.style ?? {}), ...patch } } } as Card; setCard(next); liveTap(next); };
    return (
      <div className="space-y-3 py-2">
        {/* Colours and fonts, one look (owner, 24 Oct 2026: "upar ka text zaroori nahi, professional look"): title, the live preview,
            one panel with the two choices, and Skip / Done at the foot. */}
        {afterSteps(1)}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { doneFromPreview.current = false; setState("preview"); toTop(); }} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="min-w-0 flex-1 text-xl font-bold tracking-tight">{T("Colours and fonts", "रंग और अक्षर")}</h1>
          <span className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-muted">{T("Optional", "ज़रूरी नहीं")}</span>
        </div>
        <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-3xl border border-border bg-white shadow-card" style={{ height: "min(50dvh, 440px)", minHeight: 280 }}>
          <iframe ref={previewFrame} title="Website preview" src="/preview/site" onLoad={() => { try { previewFrame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ } }} className="h-full w-full border-0" />
        </div>
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <div className="px-4 pb-2 pt-3.5">
            <p className="flex items-center gap-1.5 text-sm font-bold"><Palette className="h-4 w-4 text-brand" /> {T("Choose your favourite colour", "अपना पसंदीदा रंग चुनें")}</p>
            <div className="-mx-1 mt-2 flex gap-3 overflow-x-auto px-1 pb-2 pt-1">
              {SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => {
                const on = (card.site?.style?.palette ?? "") === p.key;
                return (
                  <button key={p.key} type="button" onClick={() => restyle({ palette: p.key })} aria-pressed={on} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
                    <span className={`grid h-11 w-11 place-items-center rounded-full shadow-card ring-2 ring-offset-2 ring-offset-[var(--surface)] transition ${on ? "ring-brand scale-105" : "ring-transparent"}`} style={{ background: `linear-gradient(135deg, ${p.deep} 0%, ${p.mid} 100%)` }}>{on && <Check className="h-5 w-5" style={{ color: p.ink }} />}</span>
                    <span className={`w-full truncate text-center text-[11px] ${on ? "font-bold text-ink" : "text-muted"}`}>{hi ? p.hi : p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t border-border px-4 pb-4 pt-3.5">
            <p className="flex items-center gap-1.5 text-sm font-bold"><span className="grid h-4 w-4 place-items-center text-[13px] font-black leading-none text-brand">A</span> {T("Choose your letter style", "अपने अक्षर का style चुनें")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
              {FONT_PAIRS.map((f) => {
                const on = (card.site?.style?.font ?? "look") === f.key;
                return (
                  <button key={f.key} type="button" onClick={() => restyle({ font: f.key === "look" ? undefined : f.key })} aria-pressed={on}
                    className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-xs font-semibold transition ${on ? "border-brand bg-brand-soft/50 text-brand-ink" : "border-border bg-surface"}`}>
                    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-border-strong"}`}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                    <span className="min-w-0 truncate">{hi ? f.hi : f.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="sticky bottom-20 z-20 grid grid-cols-[auto_1fr] gap-2 rounded-2xl border border-border bg-surface p-2.5 shadow-float">
          <button type="button" onClick={goDone} className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-base font-semibold">{T("Keep as is", "जैसा है ठीक")}</button>
          <button type="button" onClick={goDone} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white"><Check className="h-5 w-5" /> {T("Done — next", "हो गया — आगे")}</button>
        </div>
      </div>
    );
  }

  // "Select your domain" — between the final website and Congratulations (owner, 24 Oct 2026): the free link (two ready, or typed
  // here) and the own domain, set up on this same page.
  if (state === "domain" && shown) {
    return (
      <div className="space-y-3 py-2">
        {afterSteps(2)}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setState(cardOnly ? "preview" : "style"); toTop(); }} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="min-w-0 flex-1 text-xl font-bold tracking-tight">{T("Select your domain", "अपना domain चुनें")}</h1>
        </div>
        <p className="-mt-1 text-xs text-muted">{T("People open your website and card at this address.", "लोग इसी address पर आपकी website और card खोलेंगे।")}</p>
        <DomainPick current={liveUser || username} cardOnly={cardOnly} hi={hi} beforeChange={settlePublish}
          onChanged={(u) => { setLiveUser(u); setCard((c) => (c ? { ...c, username: u } : c)); }} />
        <div className="sticky bottom-20 z-20 rounded-2xl border border-border bg-surface p-2.5 shadow-float">
          <button type="button" onClick={() => { setState("done"); toTop(); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white"><Check className="h-5 w-5" /> {T("Done — next", "हो गया — आगे")}</button>
        </div>
      </div>
    );
  }

  if (state === "done" && shown) {
    const liveLink = `${SITE_HOST}/c/${liveUser || username}`;
    return (
      <div className="space-y-4 py-2">
        {afterSteps(3)}
        <div className="flex items-center gap-2">
          <button type="button" onClick={backFromDone} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        </div>
        {/* The finished screen, in order (owner, 24 Oct 2026: "systematically, professional look"): the good news and the link, then
            two numbered boxes — 1 finish the website, 2 grow — and Home / Edit at the foot (the link is chosen on the screen before). */}
        <section className="relative overflow-hidden rounded-3xl px-5 py-6 text-center text-white shadow-float grad-brand">
          <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-white/10" />
          <div className="relative space-y-2.5">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20 text-2xl" aria-hidden="true">🎉</span>
            <h1 className="text-2xl font-extrabold tracking-tight">{T("Congratulations!", "बधाई हो!")}</h1>
            <p className="text-sm text-white/90">{cardOnly ? T("Your card is live.", "आपका card live है।") : T("Your website and card are live.", "आपकी website और card live हैं।")}</p>
            <SiteLink href={`https://${liveLink}`} title={T("Website", "Website")} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm"><Globe className="h-4 w-4 shrink-0 text-brand" /> <span className="truncate">{liveLink}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" /></SiteLink>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a href={`https://wa.me/?text=${encodeURIComponent(`${T("Have a look at us:", "हमें यहाँ देखें:")} https://${liveLink}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2.5 text-sm font-semibold ring-1 ring-white/30"><MessageCircle className="h-4 w-4" /> {T("WhatsApp", "WhatsApp")}</a>
              <button type="button" onClick={async () => { setCopied(""); try { await navigator.clipboard.writeText(`https://${liveLink}`); setCopied("ok"); setTimeout(() => setCopied(""), 2500); } catch { setCopied("fail"); } }} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2.5 text-sm font-semibold ring-1 ring-white/30">{copied === "ok" ? <><Check className="h-4 w-4" /> {T("Copied", "Copy हो गया")}</> : T("Copy link", "Link copy करें")}</button>
            </div>
            {copied === "fail" && <p className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-danger">{T("Could not copy — hold the link above to copy it.", "Copy नहीं हुआ — ऊपर का link दबाकर रखें।")}</p>}
          </div>
        </section>
        {bannerBlock}

        {(() => {
          const boxHead = (n: number, title: string, sub: string, grad: string) => (
            <div className={`flex items-center gap-3 px-4 py-3 text-white ${grad}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-extrabold">{n}</span>
              <div className="min-w-0"><p className="text-base font-bold leading-tight">{title}</p><p className="text-[11px] text-white/85">{sub}</p></div>
            </div>
          );
          return (
            <>
              {/* One box, one button: the guided finish, one step at a time (owner, 24 Oct 2026; lib/site-finish.ts). */}
              <FinishBar hi={hi} />

              <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                {boxHead(2, T("Grow further", "आगे बढ़ें"), cardOnly ? T("Get a full website", "पूरी website पाएँ") : T("A premium website for more customers", "ज़्यादा ग्राहकों के लिए Premium website"), "bg-gradient-to-r from-[#8b3dff] to-[#c04ee8]")}
                <div className="p-3">
                  {/* The Rs 5,999 segment (owner, 15-16 Oct 2026) / a free account's next step up (17 Oct 2026). */}
                  {cardOnly ? (
                    <Link href="/poster/plan" className="flex items-center gap-3 rounded-2xl border border-border p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#8b3dff]/10 text-[#8b3dff]"><Globe className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{T("Website with Standard", "Standard में website")}</span><span className="block text-[11px] text-muted">{T("Website + daily poster + WhatsApp AI · ₹2,999/month", "Website + रोज़ poster + WhatsApp AI · ₹2,999/महीना")}</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  ) : <AdvancedEntry cardId={existing?.id} fetchState />}
                </div>
              </section>
            </>
          );
        })()}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => router.push("/poster/site?edit=1")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-base font-semibold"><Pencil className="h-5 w-5" /> {T("Edit", "Edit करें")}</button>
          <button type="button" onClick={() => router.push("/poster")} className="inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-card">{T("Done", "हो गया")} <ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    );
  }

  if (state === "preview" && shown) return (
    <div className="space-y-4 py-2">
      {/* Owner's call, 5 Oct 2026 ("site banne ke baad 3 view nahi dikh rahe, bada complicated UI"): ONE status card,
          then the three looks, then the preview — everything else goes below it or behind "Change…" / "Details". */}
      {afterSteps(0)}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={backFromPreview} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="min-w-0 flex-1 text-lg font-bold">{cardOnly ? (liveUser ? T("Card live", "Card live") : T("Your card is ready", "आपका card तैयार है")) : liveUser ? T("Website live · Card live", "Website live · Card live") : existing ? T("Your new website is ready", "आपकी नई website तैयार है") : T("Your website is ready", "आपकी website तैयार है")}</h1>
        </div>
        {(liveUser || busy === "publish") && <p className="flex items-start gap-1.5 text-xs text-muted">
          {liveUser ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-good" /> : busy === "publish" ? <LoaderCircle className="mt-px h-3.5 w-3.5 shrink-0 animate-spin text-brand" /> : <CircleDashed className="mt-px h-3.5 w-3.5 shrink-0 text-amber" />}
          <span>
            {liveUser
              ? cardOnly
                ? T("Live. One link: your card opens everywhere. Share it on WhatsApp or with a QR code.", "Live। एक ही link: आपका card हर जगह खुलता है। WhatsApp या QR code से share करें।")
              : isStory
                ? T("Live. One link — it opens as the website on phones too.", "Live। एक ही link — phone पर भी website ही खुलती है।")
                : T("Live. One link: the website on a computer, your card on a phone.", "Live। एक ही link: computer पर website, phone पर card।")
              : busy === "publish"
                ? T("Making it live…", "Live किया जा रहा है…")
                : checks.length > 0
                  ? T(`View the six designs, select one, check the ${checks.length} details below — then Save and next.`, `छह design देखें, एक चुनें, नीचे ${checks.length} details देख लें — फिर Save and next दबाएँ।`)
                  : existing
                  ? T("View the six designs and select one — your current card stays until you tap Save and next.", "छह design देखें और एक चुनें — Save and next दबाने तक पुराना card वैसा ही रहेगा।")
                  : T("View the six designs and select one — then Save and next.", "छह design देखें, एक चुनें — फिर Save and next दबाएँ।")}
          </span>
        </p>}
      </div>
      {/* Free = the digital card only (owner, 16 Oct 2026): the website on the Website tab is what Standard gives, and this says so plainly. */}
      {cardOnly && (
        <div className="space-y-2 rounded-xl border border-brand/40 bg-brand-soft/40 p-3">
          <p className="text-sm font-semibold">{T("Your free plan publishes your digital card", "आपका free plan आपका digital card publish करता है")}</p>
          <p className="text-xs text-muted">{T("The website on the Website tab is part of Standard (₹2,999 a month) or Premium. Your card stays free.", "Website tab वाली website Standard plan (₹2,999 / महीना) या Premium में मिलती है। आपका card free ही रहेगा।")}</p>
          <button type="button" onClick={() => setPremiumUnlock(true)} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> {T("Get a website with Standard", "Standard लेकर website पाएँ")}</button>
        </div>
      )}
      {/* The AI banner: promised before Final, in the making after it, and then Keep / Another / Back to stock. */}
      {access.subscribed && !ownBanner && !liveUser && banner.state === "idle" && !madeByUs(shown.coverUrl) && (
        <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs">✨ {T("Your AI banner is painted by AI when you make it live (about a minute).", "Live करते ही AI आपका AI banner बनाएगा (करीब 1 मिनट)।")}</p>
      )}
      {bannerBlock}
      {/* The preview fills the screen; Website | Card, Computer view and the six designs live in the bottom bar (owner, 15 Oct 2026). */}
      <div ref={previewRef} className="scroll-mt-16" />
      {tab === "phone" ? (
        <div className="-mx-4 rounded-none border-y border-border bg-surface2/40 py-4">
          <CardView card={{ ...shown, username: "__preview" }} qr={qr} shareUrl={`${SITE_URL}/c/${username}`} />
          {liveUser && (
            <p className="mt-3 text-center text-xs">
              <a href={`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital visiting card है — contact, products और बाकी सब एक tap में: ${SITE_URL}/c/${username}` : `Hi! Here is my digital visiting card — contact, products and more in one tap: ${SITE_URL}/c/${username}`)}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink underline">{T("Share on WhatsApp", "WhatsApp पर share करें")}</a>
            </p>
          )}
        </div>
      ) : (
        <div>
          {desk ? (
            <div ref={frameRef} className="overflow-hidden rounded-xl border border-border bg-white" style={{ height: 1600 * scale }}>
              <iframe ref={previewFrame} title="Website preview" src="/preview/site" onLoad={() => { try { previewFrame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ } }} style={{ width: 1280, height: 1600, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-2xl border border-border bg-white" style={{ height: "calc(100dvh - 300px)", minHeight: 440 }}>
              <iframe ref={previewFrame} title="Website preview" src="/preview/site" onLoad={() => { try { previewFrame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ } }} className="h-full w-full border-0" />
            </div>
          )}
        </div>
      )}

      {/* Everything that used to sit above the fold: the designer's line, the notice, "Please check", "Make it better". */}
      {(designNote || notice || checks.length > 0) && (
        <details open={checks.length > 0 && !liveUser} className="rounded-2xl border border-border bg-surface2/40">
          {/* Open on its own while there are details to check and the card is not live yet: finish() holds the first
              go-live back for exactly this pause, which a closed fold took away (the maker's specs went live unread). */}
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
            <span>{T("Details", "Details")} <span className="text-xs font-normal text-muted">{checks.length > 0 ? T(`· ${checks.length} to check`, `· ${checks.length} देखने हैं`) : ""}</span></span>
            <span className="text-xs font-semibold text-brand-ink">{T("Open", "खोलें")}</span>
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            {designNote && <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">🎨 {T("Designer", "Designer")}: {designNote}</p>}
            {notice && <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">{notice}</p>}
            {checks.length > 0 && (
              <div className="space-y-2 rounded-2xl border-2 border-amber/40 bg-amber/10 p-3">
                <p className="text-[15px] font-semibold">{T("Please check", "एक बार देख लें")}</p>
                <p className="text-xs text-muted">{T("These details came from the maker’s website. Keep only what is right.", "ये जानकारी बनाने वाली company की website से आई है। जो सही है, वही रखें।")}</p>
                {checks.map((c) => (
                  <label key={c.name} className="flex items-start gap-2.5 rounded-xl bg-surface p-2.5 text-sm">
                    <input type="checkbox" checked={!off.includes(c.name)} onChange={() => setOff((o) => (o.includes(c.name) ? o.filter((x) => x !== c.name) : [...o, c.name]))} className="mt-0.5 h-5 w-5 shrink-0" />
                    <span className="min-w-0">
                      <b className="block">{c.name}</b>
                      {c.web.summary && <span className="block text-xs text-muted">{c.web.summary}</span>}
                      {c.web.features.length > 0 && <span className="block text-xs text-muted">{c.web.features.slice(0, 3).join(" · ")}</span>}
                      {c.web.specs.length > 0 && <span className="block text-xs text-muted">{c.web.specs.slice(0, 3).map((s) => `${s.label}: ${s.value}`).join(" · ")}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {/* The bottom bar (owner, 15 Oct 2026: "website upar, baaki sab buttons Save and next wale bar me, bottom se khulne wala"): Website | Card,
          Computer view, the six designs (opens upward, the website above stays visible and changes as you tap) and Save and next. */}
      <div className="sticky bottom-20 z-20 overflow-hidden rounded-2xl border border-border bg-surface shadow-float">
        {/* The error sits INSIDE the bar, right above Save and next / the designs it belongs to — the page behind is long, so a line in the page flow was often off-screen. */}
        {err && <p ref={errRef} role="alert" className="border-b border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{err}</p>}
        {designOpen && looks.length > 0 && shown.site && (
          <div className="max-h-[58dvh] space-y-3 overflow-y-auto border-b border-border p-3">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">6</span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-tight">{T("Select one design from six", "छह में से एक design चुनें")}</p>
                <p className="text-xs text-muted">{T("View to see it full · Select to use it", "देखें = पूरा देखें · चुनें = लगाएँ")}</p>
              </div>
              <button type="button" onClick={() => setDesignOpen(false)} aria-label={T("Close", "बंद करें")} className="rounded-lg p-1 text-muted"><ChevronDown className="h-5 w-5" /></button>
            </div>
          {/* The 7th choice (owner, 23 Oct 2026: "6 design ke saath premium website ka option nahi aaya"): the Premium website, made by AI
              only for this business — its own page, which also takes the payment when the plan does not include it yet. */}
          <Link href={`${ADVANCED_HREF}${existing?.id ? `?card=${encodeURIComponent(existing.id)}` : ""}`} className="flex items-center gap-2.5 rounded-xl border-2 border-ai/40 bg-ai-soft/40 px-3 py-2.5">
            <Sparkles className="h-5 w-5 shrink-0 text-ai" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{T("Premium website", "Premium website")} <span className="ml-1 rounded-full bg-ai-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-ai">Premium</span></span><span className="block text-[11px] leading-tight text-muted">{T("A layout made by AI only for your business", "AI से सिर्फ़ आपके business के लिए बना खास layout")}</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
          <div className="grid grid-cols-3 gap-2">
            {looks.map((l, idx) => {
              const on = activeLook === l.key;
              const p = paletteFor({ themeColor: shown.themeColor, site: { enabled: true, style: l.style } });
              return (
                <div key={l.key} className={`min-w-0 overflow-hidden rounded-2xl border-2 ${on ? "border-brand bg-brand-soft shadow-card" : "border-border bg-surface"}`}>
                  {/* Two clear buttons per design (owner, 24 Oct 2026: "view aur select likho jo user ko samajh aaye"). */}
                  <button type="button" onClick={() => openLookInTab(l.key)} className="block w-full p-1.5 pb-1 text-left" aria-label={T(`View design ${idx + 1}`, `Design ${idx + 1} देखें`)}>
                    <span className="relative grid aspect-[16/11] w-full place-items-center rounded-xl" style={{ background: `linear-gradient(135deg, ${p.deep} 0%, ${p.mid} 100%)` }}>
                      <LookGlyph k={l.key} ink={p.ink} />
                      <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-[10px] font-bold text-ink">{idx + 1}</span>
                    </span>
                    <span className="mt-1 block truncate text-[12px] font-bold">{hi ? l.hi : l.name}</span>
                  </button>
                  <div className="grid grid-cols-2 border-t border-border/70 text-[11px] font-bold">
                    <button type="button" onClick={() => openLookInTab(l.key)} className="inline-flex items-center justify-center gap-1 py-2 text-brand-ink"><Eye className="h-3.5 w-3.5" /> {T("View", "देखें")}</button>
                    <button type="button" onClick={() => pickLook(l.key)} aria-pressed={on} className={`inline-flex items-center justify-center gap-1 py-2 ${on ? "bg-brand text-white" : "border-l border-border/70 text-ink"}`}>
                      <Check className="h-3.5 w-3.5" /> {on ? T("Selected", "चुना") : T("Select", "चुनें")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => void sendTestLinks()} disabled={sendingLinks || !looks.length}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#25d366] bg-[#25d366]/10 px-3 py-2.5 text-sm font-bold text-[#128c4a] disabled:opacity-60">
            {sendingLinks ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {T("Send 6 test links on WhatsApp", "6 test links WhatsApp पर भेजें")}
          </button>
          <p className="mt-1 text-center text-[11px] text-muted">{linksNote ? <span className="text-danger">{linksNote}</span> : T("Send them to yourself or anyone: each design opens on its own, to test and compare. Links work for 14 days.", "अपने या किसी और के WhatsApp पर भेजें: हर design अलग खुलता है, test और compare के लिए। Links 14 दिन चलते हैं।")}</p>
          </div>
        )}
        <div className="space-y-2 p-2.5">
          <div className="flex items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl bg-surface2 p-1">
              {([["site", T("Website", "Website"), Globe], ["phone", T("Card", "Card"), Smartphone]] as const).map(([k, l, I]) => {
                // Each tab has a small "open in a new tab" icon (owner, 16 Oct 2026): the website opens the live link, or this phone's preview before it is live;
                // the card opens its live page (there is no card preview outside the app, so before it is live the icon is not shown).
                const out = k === "site" ? (liveUser ? `${SITE_URL}/c/${username}?view=site` : "") : (liveUser ? `${SITE_URL}/c/${username}?view=card` : "");
                const openOut = () => {
                  if (k === "site" && !liveUser) { if (shown) { writeJson(PREVIEW_KEY, { ...shown, username: "__preview" }); openPage(`/preview/site?k=${PREVIEW_KEY}`, T("Website", "Website")); } return; }
                  if (out) openPage(out, k === "site" ? T("Website", "Website") : T("My card", "मेरा card"));
                };
                const canOpen = k === "site" ? !!(liveUser || shown) : !!liveUser;
                return (
                  <div key={k} className={`flex items-stretch overflow-hidden rounded-lg ${tab === k ? "bg-surface shadow-sm" : "text-muted"}`}>
                    <button type="button" onClick={() => setTab(k)} className="inline-flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-semibold"><I className="h-4 w-4" /> {l}</button>
                    {canOpen && <button type="button" onClick={openOut} aria-label={T(`Open ${l} in a new tab`, `${l} नए tab में खोलें`)} title={T("Open in a new tab", "नए tab में खोलें")} className="inline-flex w-8 shrink-0 items-center justify-center border-l border-border/60 hover:bg-surface2"><ExternalLink className="h-3.5 w-3.5" /></button>}
                  </div>
                );
              })}
            </div>
            {tab === "site" && <button type="button" onClick={() => setDesk((d) => !d)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-2 text-xs font-semibold">{desk ? <><Smartphone className="h-3.5 w-3.5" /> {T("Phone", "Phone")}</> : <><Monitor className="h-3.5 w-3.5" /> {T("Computer", "Computer")}</>}</button>}
            {liveUser && <SiteLink href={`${SITE_URL}/c/${username}?view=site`} title={T("Website", "Website")} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-2 text-xs font-semibold text-brand-ink"><ExternalLink className="h-3.5 w-3.5" /> {T("Live", "Live")}</SiteLink>}
          </div>
          {/* Previous / Next through the six designs right on the preview, instead of the pop-up (owner, 24 Oct 2026: "pasand nahi aaye,
              next dabaye to next web site ka view aa jaye"), then "Yes, select this design". */}
          {looks.length > 1 && (() => {
            const at = Math.max(0, looks.findIndex((l) => l.key === activeLook));
            const cur = looks[at];
            const stepTo = (d: number) => { const n = looks[(at + d + looks.length) % looks.length]; if (n) pickLook(n.key); };
            return (
              <>
              <div className="flex items-stretch gap-2">
                <button type="button" onClick={() => stepTo(-1)} disabled={!!busy && busy !== "publish"} aria-label={T("Previous design", "पिछला design")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-border bg-surface px-3 text-sm font-bold disabled:opacity-60"><ChevronLeft className="h-5 w-5" /><span className="hidden min-[400px]:inline">{T("Previous", "पिछला")}</span></button>
                <div className="min-w-0 flex-1 rounded-xl bg-surface2 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{T("Design", "Design")} {at + 1}/{looks.length}</p>
                  <p className="truncate text-sm font-bold">{cur ? (hi ? cur.hi : cur.name) : ""}</p>
                </div>
                <button type="button" onClick={() => stepTo(1)} disabled={!!busy && busy !== "publish"} aria-label={T("Next design", "अगला design")}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-xl border-2 px-3 text-sm font-bold disabled:opacity-60 ${viewed.length === 0 ? "design-glow border-amber bg-amber text-white" : "border-brand/60 bg-surface text-brand-ink"}`}><span className="hidden min-[400px]:inline">{T("Next", "अगला")}</span><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="flex items-center justify-center gap-2 px-1 text-xs font-semibold">
                <button type="button" onClick={() => setDesignOpen((o) => !o)} aria-expanded={designOpen} className="inline-flex items-center gap-1 text-muted"><Palette className="h-3.5 w-3.5" /> {designOpen ? T("Close list", "List बंद करें") : T("All 6 together", "सभी 6 एक साथ")}</button>
              </div>
              </>
            );
          })()}
          <div className={`grid gap-2 ${liveUser ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
        {liveUser ? (
          // Already live (a design tapped goes live by itself): from Card & Website this is Done, on to the saved Card & Website
          // (replace: Back from there must not return to this finished screen); in the first flow it is Next, on to the congratulations.
          <button type="button" onClick={() => { if (improveMode) router.replace("/poster/site?edit=site&saved=1"); else { if (uid) dropKey(draftKey(uid)); doneFromPreview.current = true; setTab(cardOnly ? "phone" : "site"); setState(cardOnly ? "domain" : "style"); try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } } }} disabled={busy === "publish"} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white disabled:opacity-60"><Check className="h-5 w-5" /> {improveMode ? T("Done", "हो गया") : T("Next →", "आगे →")}</button>
        ) : (
          <button type="button" onClick={() => { if (viewed.length === 0 && !improveMode) setConfirmDesign(true); else void publish(); }} disabled={!!busy} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white disabled:opacity-60">
            {busy === "publish" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Yes, select this design", "हाँ, यही design चुनें")}
          </button>
        )}
        {liveUser && <button type="button" onClick={() => { setMoreMsg(""); setMore(true); }} disabled={!!busy && busy !== "publish"} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-semibold disabled:opacity-60"><SlidersHorizontal className="h-5 w-5" /> {T("Change…", "बदलें…")}</button>}

          </div>
        </div>
      </div>
      {confirmDesign && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setConfirmDesign(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-full max-w-md space-y-3 rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-2xl">
            <p className="text-lg font-bold">{T("Have you seen the other designs?", "क्या आपने बाक़ी design देखे?")}</p>
            <p className="text-sm text-muted">{T(`You are choosing “${hi ? (looks.find((l) => l.key === activeLook)?.hi ?? "") : (looks.find((l) => l.key === activeLook)?.name ?? "this design")}”. There are six designs and each one looks very different. Tap each one to see your website in it — it takes a minute.`, `आप “${looks.find((l) => l.key === activeLook)?.hi ?? "ये design"}” चुन रहे हैं। कुल छह design हैं और हर एक बहुत अलग दिखता है। हर एक पर दबाकर अपनी website उसमें देखें — एक मिनट लगता है।`)}</p>
            <button type="button" onClick={() => { setConfirmDesign(false); const at = Math.max(0, looks.findIndex((l) => l.key === activeLook)); const n = looks[(at + 1) % looks.length]; if (n) pickLook(n.key); }} className="w-full rounded-xl grad-brand py-3 text-base font-semibold text-white">{T("See the other designs", "बाक़ी design देखें")}</button>
            <button type="button" onClick={() => { setConfirmDesign(false); setViewed(looks.map((l) => l.key)); void publish(); }} className="w-full rounded-xl border border-border py-3 text-base font-semibold">{T("Keep this design", "यही रखें")}</button>
          </div>
        </div>
      )}
      {more && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setMore(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-float sm:max-h-[90dvh] sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">{T("Change…", "बदलें…")}</p>
              <button type="button" onClick={() => setMore(false)} className="rounded-lg p-1 text-muted" aria-label={T("Close", "बंद करें")}><X className="h-5 w-5" /></button>
            </div>
            {/* Add / remove (docs/website-looks-v2.md §6): tiles, sections, dark / light, clip / photo — instant, no build,
                no credit. On a live site the change goes live by itself, like a look. */}
            {shown.site && <LookTweaks card={card!} hi={hi} premium={access.subscribed} onChange={(next) => { setCard(next); setTab("site"); liveTap(next); }} />}
            <div className="divide-y divide-border rounded-xl border border-border bg-surface">
              <button type="button" onClick={() => { setMore(false); setErr(""); setMakeFrom(""); setState("form"); try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } }} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <ChevronLeft className="h-5 w-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1"><b className="block text-sm">{T("Edit details", "जानकारी बदलें")}</b><span className="block text-xs text-muted">{T("Back to the questions — website, look, products", "सवालों पर वापस — website, look, products")}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </button>
              <button type="button" onClick={() => { setMore(false); void editFirst(); }} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <Pencil className="h-5 w-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1"><b className="block text-sm">{T("Edit card", "Card edit करें")}</b><span className="block text-xs text-muted">{T("The editor: words, photos, pages", "Editor: शब्द, photos, pages")}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </button>
              <button type="button" onClick={() => { if (busy) { setMoreMsg(T("Please wait — your website is being saved. Then try again.", "ज़रा रुकिए — आपकी website save हो रही है। फिर दोबारा दबाइए।")); return; } setMoreMsg(""); setMore(false); writeAgain(); }} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <Sparkles className="h-5 w-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1"><b className="block text-sm">{T("Write again", "दोबारा लिखवाएँ")}</b><span className="block text-xs text-muted">{T("The AI writes it afresh — say what should change", "AI दोबारा लिखता है — बताएँ क्या बदले")}</span></span>
                {access.loading ? null : access.subscribed ? <span className="shrink-0 text-[11px] text-muted">{T("from 1 credit", "1 credit से")}</span> : <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#12144a] px-1.5 py-0.5 text-[10px] font-bold text-[#ffd54a]">🔒 Standard</span>}
              </button>
            </div>
            {moreMsg && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{moreMsg}</p>}
          </div>
        </div>
      )}
      {againAsk && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setAgainAsk(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-4 pb-0 shadow-float sm:max-h-[90dvh] sm:rounded-2xl">
            <p className="text-lg font-bold">{T("What should change?", "क्या बदलना है?")}</p>
            <p className="text-xs text-muted">{T("Tick what you want different — the rest stays exactly as it is.", "जो बदलना हो वो दबाएँ — बाकी वैसा ही रहेगा।")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {WANTS.map((w) => {
                const on = againWants.includes(w.k);
                return (
                  <button key={w.k} type="button" aria-pressed={on} onClick={() => setAgainWants((cur) => (cur.includes(w.k) ? cur.filter((x) => x !== w.k) : [...cur, w.k]))}
                    className={`rounded-xl border-2 p-3 text-left ${on ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{on ? "✓ " : ""}{hi ? w.th : w.t}</span><span className="shrink-0 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted">{w.k === "photos" ? T("1 credit each", "1 credit / photo") : "1 credit"}</span></span>
                    <span className="block text-[11px] text-muted">{hi ? w.sh : w.s}</span>
                  </button>
                );
              })}
            </div>
            {againWants.includes("banner") && shown.coverUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface2/40 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shown.coverUrl} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
                <p className="text-xs text-muted">{T("This banner on top will be remade.", "ऊपर का यह banner दोबारा बनेगा।")}</p>
              </div>
            )}
            {againWants.includes("photos") && (
              <div className="mt-3 rounded-xl border border-border bg-surface2/40 p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => setPhotoMode("add")} className={`rounded-lg border px-2.5 py-2 text-left text-xs ${photoMode === "add" ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}><b>{T("Add to the gallery", "Gallery में जोड़ें")}</b><span className="block text-muted">{T("the ones there stay", "जो हैं वो रहेंगी")}</span></button>
                  <button type="button" onClick={() => setPhotoMode("replace")} className={`rounded-lg border px-2.5 py-2 text-left text-xs ${photoMode === "replace" ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}><b>{T("Replace some", "कुछ बदलें")}</b><span className="block text-muted">{T("tap the ones to change", "जो बदलनी हों उन पर tap करें")}</span></button>
                </div>
                {photoMode === "add" ? (
                  <>
                    <p className="mt-3 text-sm font-semibold">{T("How many new photos?", "कितनी नई photos?")} <span className="font-normal text-muted">({T("1 credit each", "हर photo 1 credit")})</span></p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => setPhotoCount(n)} className={`h-9 min-w-9 rounded-lg border px-2.5 text-sm font-semibold ${photoCount === n ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{n}</button>)}
                    </div>
                    {galleryNow.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{galleryNow.map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u} src={u} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover opacity-80" />
                    ))}</div>}
                    {galleryNow.length > 0 && <p className="mt-1 text-[11px] text-muted">{T(`These ${galleryNow.length} stay; the new ones join them.`, `ये ${galleryNow.length} रहेंगी; नई इनके साथ जुड़ेंगी।`)}</p>}
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-semibold">{T("Tap the photos to change", "जो photos बदलनी हों उन पर tap करें")} <span className="font-normal text-muted">({T("1 credit each", "हर photo 1 credit")})</span></p>
                    {galleryNow.length ? (
                      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                        {galleryNow.map((u) => {
                          const on = replaceUrls.includes(u);
                          return (
                            <button key={u} type="button" aria-pressed={on} onClick={() => setReplaceUrls((cur) => (cur.includes(u) ? cur.filter((x) => x !== u) : cur.length < 6 ? [...cur, u] : cur))}
                              className={`relative aspect-square overflow-hidden rounded-lg border-2 ${on ? "border-brand" : "border-transparent"}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt="" className={`h-full w-full object-cover ${on ? "" : "opacity-80"}`} />
                              {on && <span className="absolute inset-0 grid place-items-center bg-brand/40 text-lg font-bold text-white">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : <p className="mt-1 text-xs text-muted">{T("No photos on the site yet — choose Add instead.", "अभी site पर photos नहीं — Add चुनें।")}</p>}
                    <p className="mt-1 text-[11px] text-muted">{T(`${replaceUrls.length} chosen — each is remade from your description above.`, `${replaceUrls.length} चुनी — हर एक ऊपर के विवरण से दोबारा बनेगी।`)}</p>
                  </>
                )}
              </div>
            )}
            {(againWants.includes("banner") || againWants.includes("photos")) && (
              <div className="mt-3 rounded-xl border border-border bg-surface2/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="image-note" className="text-sm font-semibold">{T("The picture — what should it show?", "Picture — उसमें क्या दिखे?")}</label>
                  <button type="button" onClick={() => void helpWrite("image")} disabled={!imageNote.trim() || !!helping} className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60">
                    {helping === "image" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {T("Help me write", "AI से लिखवाएँ")}
                  </button>
                </div>
                {helpErr?.kind === "image" && <p role="alert" className="mt-1 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">{helpErr.msg}</p>}
                <textarea id="image-note" value={imageNote} onChange={(e) => { setImageNote(e.target.value.slice(0, 600)); setHelpErr(null); }} rows={3} placeholder={T("In your words — e.g. our shop from outside in the evening, lights on, two customers at the counter", "अपने शब्दों में — जैसे शाम को हमारी दुकान बाहर से, lights जली हुई, counter पर दो ग्राहक")} className={`${field} text-sm`} />
                <p className="mt-1 text-[11px] text-muted">{T("Write a few words, then tap Help me write — the AI turns them into a full picture brief you can edit.", "थोड़े शब्द लिखें, फिर AI से लिखवाएँ दबाएँ — AI पूरा picture brief बना देगा, जिसे आप बदल भी सकते हैं।")}</p>
              </div>
            )}
            {againWants.includes("words") && (
              <div className="mt-3 rounded-xl border border-border bg-surface2/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="words-note" className="text-sm font-semibold">{T("The words — what should change?", "शब्द — क्या बदले?")}</label>
                  <button type="button" onClick={() => void helpWrite("words")} disabled={!wordsNote.trim() || !!helping} className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60">
                    {helping === "words" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {T("Help me write", "AI से लिखवाएँ")}
                  </button>
                </div>
                {helpErr?.kind === "words" && <p role="alert" className="mt-1 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">{helpErr.msg}</p>}
                <textarea id="words-note" value={wordsNote} onChange={(e) => { setWordsNote(e.target.value.slice(0, 400)); setHelpErr(null); }} rows={3} placeholder={T("e.g. shorter headline, mention 20 years of experience, friendlier tone, keep the prices", "जैसे छोटा headline, 20 साल का अनुभव बताओ, दोस्ताना लहजा, दाम वही रहें")} className={`${field} text-sm`} />
                <p className="mt-1 text-[11px] text-muted">{T("Write a few words, then tap Help me write — the AI turns them into a full instruction you can edit.", "थोड़े शब्द लिखें, फिर AI से लिखवाएँ दबाएँ — AI पूरा निर्देश बना देगा, जिसे आप बदल भी सकते हैं।")}</p>
              </div>
            )}
            <input value={againNote} onChange={(e) => setAgainNote(e.target.value.slice(0, 200))} placeholder={T("Anything else? e.g. lighter colours, bigger photos", "कुछ और? जैसे हल्के रंग, बड़ी photos")} className={`${field} mt-3`} />
            {/* The sheet grows past the screen once photos/describe boxes open, so it scrolls and the total + button stay pinned. */}
            <div className="sticky bottom-0 -mx-4 mt-3 border-t border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <p className="flex items-center justify-between text-sm"><span className="text-muted">{T("Total", "कुल")}</span><b>{againCost} {againCost === 1 ? T("credit", "credit") : T("credits", "credits")}</b></p>
            {!access.loading && access.balance < againCost && <p className="mt-1 text-xs text-danger">{T(`You have ${access.balance} credits — add some to continue.`, `आपके पास ${access.balance} credit हैं — आगे के लिए credit डालें।`)}</p>}
            {(!againWants.length && !againNote.trim() && !imageNote.trim() && !wordsNote.trim())
              ? <p className="mt-1 text-xs font-medium text-danger">{T("Tick at least one thing above, or write a line below.", "ऊपर कम से कम एक चीज़ चुनें, या नीचे एक line लिखें।")}</p>
              : (againWants.includes("photos") && photoMode === "replace" && !replaceUrls.length)
                ? <p className="mt-1 text-xs font-medium text-danger">{T("Tap the photos you want to change (or choose Add to the gallery).", "जो photos बदलनी हैं उन पर tap करें (या Gallery में जोड़ें चुनें)।")}</p>
                : null}
            <button type="button" disabled={(!againWants.length && !againNote.trim() && !imageNote.trim() && !wordsNote.trim()) || (againWants.includes("photos") && photoMode === "replace" && !replaceUrls.length)} onClick={() => { setAgainAsk(false); if (access.balance < againCost) { setAgainUnlock(true); return; } void build({ fresh: true, wants: againWants, note: againNote, imageNote, wordsNote, photoCount: photosAsked, photoMode, replaceUrls: photoMode === "replace" ? replaceUrls : [] }); }}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              <Sparkles className="h-5 w-5" /> {T(`Write again · ${againCost} ${againCost === 1 ? "credit" : "credits"}`, `दोबारा लिखवाएँ · ${againCost} credit`)}
            </button>
            </div>
          </div>
        </div>
      )}
      {askLive && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <p className="text-base font-bold">{T("Update your live website and card?", "अपनी live website और card update करें?")}</p>
            <p className="text-sm text-muted">{T("Your link, QR code, verified badge and settings stay the same. Only the words, photos and design change.", "आपका link, QR code, verified badge और settings वैसे ही रहेंगे। सिर्फ़ शब्द, photos और design बदलेंगे।")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAskLive(null)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Not now", "अभी नहीं")}</button>
              <button type="button" onClick={() => { const o = askLive; setAskLive(null); void publish({ ...o, confirmed: true }); }} className="rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white">{T("Yes, update", "हाँ, update करें")}</button>
            </div>
          </div>
        </div>
      )}
      {premiumDialog}
      {againUnlock && <UnlockDialog title={T("Write again: one credit per change", "दोबारा लिखवाना: हर बदलाव 1 credit")} reason={T("Add credits — your website stays as it is meanwhile.", "Credit डालें — तब तक आपकी website वैसी ही रहेगी।")} onClose={() => { setAgainUnlock(false); access.refresh(); }} />}
      {unlock && <UnlockDialog reason={T("A studio photo uses 5 credits. Add credits or activate your plan — your own photo is kept meanwhile.", "Studio photo में 5 credit लगते हैं। Credit डालें या अपना plan चालू करें — तब तक आपकी photo वैसी ही रहेगी।")} onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );

  /* ---------------- the form ---------------- */

  const chip = (on: boolean) => `rounded-full border-2 px-3.5 py-2 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`;


  if (state === "make") {
    // A website built in this session (or restored from this phone's draft) or already live.
    const madeAlready = !!card && (!!built || !!liveUser || isLiveSite(existing));
    const li = (text: string) => <li className="flex items-start gap-2 text-sm"><span className="text-good">✓</span><span>{text}</span></li>;
    return (
      <div className="space-y-4 py-2">
        <ProfileSteps current="make" category={setup?.category} onBack={backFromMake} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={backFromMake} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="min-w-0 flex-1 text-xl font-bold">{T("Make my website & card", "मेरी website और card बनाएँ")}</h1>
        </div>
        {/* Came back from a built website: it is kept — the big button goes on to it, and making a new one is a small, asked-for choice
            (owner, 24 Oct 2026: "pehle se web site bani ho to dobara process na kare"). */}
        {madeAlready && !remake && (
          <section className="space-y-3 rounded-3xl border border-good/40 bg-good/5 p-4 shadow-card">
            <p className="flex items-center gap-2 text-base font-bold"><CheckCircle2 className="h-5 w-5 text-good" /> {T("Your website is already made", "आपकी website पहले से बनी हुई है")}</p>
            <button type="button" onClick={() => { setErr(""); setMakeFrom(""); setState("preview"); toTop(); }} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white">
              {T("Show my website", "मेरी website देखें")} <ChevronRight className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setRemake(true)} className="block w-full text-center text-xs font-semibold text-muted underline underline-offset-2">{T("Make a new one instead", "नई website बनानी है")}</button>
          </section>
        )}
        {(!madeAlready || remake) && <>
        {!finding && found && !found.url && facts.website === found.q && (
          <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-sm">{T(`No website was found for “${found.q}”, so it is used as typed. To use a website, go back and paste its link.`, `“${found.q}” की website नहीं मिली, इसलिए उसे वैसे ही रखा गया है। website लगानी हो तो वापस जाकर उसका link डालें।`)}</p>
        )}
        {/* Made short (owner, 24 Oct 2026: "short and simple, professional"): check the details, then one button. */}
        {setup && (
          <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
            <p className="border-b border-border px-4 py-3 text-sm font-bold">{T("Check your details", "अपनी जानकारी देख लें")}</p>
            <ul className="divide-y divide-border">
              {([
                { l: T("Name", "नाम"), v: setup.business || setup.person, step: "trade" },
                { l: T("Work", "काम"), v: setup.categoryLabel, step: "trade" },
                { l: T("City", "शहर"), v: setup.city, step: "trade" },
                { l: T("Timings", "समय"), v: facts.hours, step: "where" },
                { l: T("About", "परिचय"), v: setup.about ? `${setup.about.slice(0, 60)}${setup.about.length > 60 ? "…" : ""}` : "", step: "about" },
              ] as const).map((r) => (
                <li key={r.l} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${r.v ? "bg-good/15 text-good" : "bg-amber/15 text-amber"}`}>{r.v ? "✓" : "!"}</span>
                  <span className="w-14 shrink-0 text-muted">{r.l}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.v || T("Not filled", "भरा नहीं")}</span>
                  {/* ?back= : that one screen, Save, and straight back to Make — not the whole walk again (onboard's focused-edit mode). */}
                  <Link href={`/poster/onboard?step=${r.step}&back=${encodeURIComponent("/poster/card/build?make=1")}`} onClick={() => setEditMark(true)} className="shrink-0 text-xs font-semibold text-brand-ink">{r.v ? T("Change", "बदलें") : T("Add", "भरें")}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Free: one button, no wall (owner's call, 3 Oct 2026). A Premium owner's build is Premium whatever button is tapped: only that one. */}
        {!access.subscribed && (
          <section className="space-y-3 rounded-3xl border-2 border-brand/40 bg-brand-soft/30 p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-base font-bold">{T("Free", "Free")}</p><span className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-bold text-good">₹0</span></div>
            <ul className="space-y-1">
              {freeMake ? <>{li(T("Digital card on one link", "एक link पर digital card"))}{li(T("Share on WhatsApp / QR", "WhatsApp / QR से share"))}</>
                : <>{li(T("Website + digital card", "Website + digital card"))}{li(T("Daily poster, leads in CRM", "रोज़ poster, leads CRM में"))}</>}
            </ul>
            <button type="button" onClick={() => { setPlan("standard"); setMakeFrom("free"); void build(); }} disabled={!!busy} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              <Sparkles className="h-5 w-5" /> {freeMake ? T("Make my free card", "मेरा free card बनाओ") : T("Make my free website", "मेरी free website बनाओ")}
            </button>
            {err && makeFrom === "free" && <p ref={errRef} role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{err}</p>}
          </section>
        )}
        <section className="space-y-3 rounded-3xl border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between"><p className="text-base font-bold">Standard</p><span className="rounded-full bg-[#12144a] px-2 py-0.5 text-[11px] font-bold text-[#ffd54a]">{access.subscribed ? T("In your plan", "आपके plan में") : T("₹2,999 / month", "₹2,999 / महीना")}</span></div>
          <ul className="space-y-1">
            {li(T("No Shubhora tag · on Google", "Shubhora tag नहीं · Google पर"))}
            {li(T("AI banner · WhatsApp AI 24×7", "AI banner · WhatsApp AI 24×7"))}
            {li(T("Your own domain", "अपना domain"))}
          </ul>
          {access.subscribed ? (
            <button type="button" onClick={() => { setPlan("premium"); setMakeFrom("premium"); void build(); }} disabled={!!busy || access.loading} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#12144a] py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {access.loading ? <LoaderCircle className="h-5 w-5 animate-spin text-[#ffd54a]" /> : <Sparkles className="h-5 w-5 text-[#ffd54a]" />} {T("Make my website", "मेरी website बनाएँ")}
            </button>
          ) : (
            <button type="button" onClick={() => { setErr(""); setMakeFrom(""); setPremiumUnlock(true); }} disabled={access.loading} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#12144a] py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {access.loading ? <LoaderCircle className="h-5 w-5 animate-spin text-[#ffd54a]" /> : <Sparkles className="h-5 w-5 text-[#ffd54a]" />} {T("Get Standard", "Standard लें")}
            </button>
          )}
          {err && (access.subscribed || makeFrom !== "free") && <p ref={errRef} role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{err}</p>}
        </section>
        </>}
        <p className="text-center text-[11px] text-muted">{T("AI writes only what you told us.", "AI वही लिखता है जो आपने बताया।")}</p>
        {premiumDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <ProfileSteps current="make" category={setup?.category} onBack={backFromForm} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={backFromForm} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 text-xl font-bold">{T("How should your website look?", "Website की पसंद")}</h1>
      </div>
      {/* A "Make it better" chip brings the owner here from a finished V-Card: this takes them back to it
          without paying for another build. */}
      {card && (
        <button type="button" onClick={() => { setErr(""); setMakeFrom(""); setState("preview"); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold">
          <ChevronLeft className="h-4 w-4" /> {T("Back to my website", "मेरी website पर वापस")}
        </button>
      )}
      <p className="text-sm text-muted">{T("All optional. Skip it and the AI picks.", "सब optional है। छोड़ दें तो AI खुद चुनेगा।")}</p>

      {/* Short and closed (owner, 24 Oct 2026: "is page per bhi bahut kuch likha hai"): a tick opens each box. */}
      <section id="q-site" className="scroll-mt-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <label className="flex cursor-pointer items-center gap-3 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] px-4 py-3 text-white">
          <input type="checkbox" checked={likeOpen || !!facts.website} onChange={(e) => { setLikeOpen(e.target.checked); if (!e.target.checked) { setF({ website: "" }); setFound(null); } }} className="h-5 w-5 shrink-0 accent-white" />
          <span className="min-w-0"><span className="block text-base font-bold leading-tight">{T("I like a website", "मुझे कोई website पसंद है")}</span><span className="block text-[11px] text-white/85">{T("We make yours in that style", "उसी style में आपकी बनाएँगे")}</span></span>
        </label>
        {(likeOpen || !!facts.website) && (
          <div className="space-y-2 p-3">
            <input autoFocus={likeOpen && !facts.website} value={facts.website} onChange={(e) => { setF({ website: e.target.value.trim() }); setFound(null); }} onBlur={() => void resolveSite()} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={setup?.website || T("Link or name", "Link या नाम")} className={field} />
            {finding && <p className="text-xs text-muted">{T("Searching…", "खोज रहे हैं…")}</p>}
            {!finding && found && found.url && facts.website === found.url && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs"><span className="font-semibold text-good">✓ {found.name}</span><span className="text-muted">{found.url.replace(/^https?:\/\//, "")}</span><button type="button" onClick={() => { setF({ website: "" }); setFound(null); }} className="font-semibold text-brand-ink underline">{T("Not this", "ये नहीं")}</button></p>
            )}
            {!finding && found && !found.url && facts.website === found.q && (
              <p className="text-xs text-amber">{T("Not found — paste the link.", "नहीं मिली — link डालें।")}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {SITE_CARDS.filter((c) => c.k !== "none").map((c) => (
                <button key={c.k} type="button" onClick={() => setF({ websiteRole: c.k === "none" ? "own" : c.k })} className={chip(facts.websiteRole === c.k)}>{c.e} {hi ? c.th : c.t}</button>
              ))}
            </div>
            {facts.websiteRole === "dealer" && !!facts.website && (
              facts.dealerAssertedAt
                ? <p className="flex items-center gap-1.5 text-xs font-semibold text-good"><CheckCircle2 className="h-3.5 w-3.5" /> {T("Authorised dealer — confirmed", "Authorised dealer — confirm")}</p>
                : <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm">
                    <input type="checkbox" checked={false} onChange={() => setF({ dealerAssertedAt: new Date().toISOString() })} className="mt-0.5 h-4 w-4" />
                    <span>{T("I am this brand’s authorised dealer and may show its photos.", "मैं इस brand का authorised dealer हूँ, इसकी photos दिखा सकता हूँ।")}</span>
                  </label>
            )}
          </div>
        )}
      </section>

      <section id="q-look" className="scroll-mt-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <label className="flex cursor-pointer items-center gap-3 bg-gradient-to-r from-[#8b3dff] to-[#c04ee8] px-4 py-3 text-white">
          <input type="checkbox" checked={lookOpen || Object.keys(facts.style ?? {}).length > 0} onChange={(e) => { setLookOpen(e.target.checked); if (!e.target.checked) setF({ style: {} }); }} className="h-5 w-5 shrink-0 accent-white" />
          <span className="min-w-0"><span className="block text-base font-bold leading-tight">{T("Choose colour & font", "रंग और font चुनें")}</span><span className="block text-[11px] text-white/85">{T("Or the AI picks for your work", "नहीं तो AI आपके काम के हिसाब से चुनेगा")}</span></span>
        </label>
        {(lookOpen || Object.keys(facts.style ?? {}).length > 0) && (
          <div className="p-3"><LookPicker value={facts.style ?? {}} onChange={(style) => setF({ style })} categoryKey={setup?.category ?? ""} hi={hi} business={setup?.business || setup?.person || ""} /></div>
        )}
      </section>

      {/* Steps 2 and 3 again, folded (owner's flow, 2 Oct 2026): the company and product answers were given on
          their own screens; here they are checked, and a "Make it better" chip lands on the exact question. */}
      <details id="q-review" ref={reviewRef} className="group overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          <span>{T("Products, photos, timings", "Products, photos, समय")} <span className="text-xs font-normal text-muted">({T("optional", "ज़रूरी नहीं")})</span></span>
          <span className="text-xs font-semibold text-brand-ink">{T("Open", "खोलें")}</span>
        </summary>
        <div className="space-y-3 border-t border-border p-3">
      <Sec id="q-products" title={T("Your products or services", "आपके products या services")} hint={T("Photo and name. Price, brand optional.", "Photo और नाम। Price, brand ज़रूरी नहीं।")}>
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="space-y-1.5 rounded-xl bg-surface2/60 p-2">
            <div className="flex items-start gap-2">
              {r.photo && <Img src={r.photo} className="h-14 w-14 shrink-0 rounded-lg border border-border bg-white object-contain" />}
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold">
                  {r.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {r.photo ? T("Change photo", "Photo बदलें") : T("📷 Add photo", "📷 Photo डालें")}
                  <input type="file" accept="image/*" className="hidden" disabled={r.busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) productPhoto(i, f); }} />
                </label>
                {r.photo && !r.studio && !r.busy && (
                  <button type="button" onClick={() => studio(i)} className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-ink">✨ Studio photo<CreditPrice credits={5} /></button>
                )}
              </div>
              <button type="button" onClick={() => {
                setRemoved(r.id ? T("Removed from your V-Card (still on your Products page)", "V-Card से हटा दिया (आपके Products page पर रहेगा)") : "");
                if (r.id && r.name.trim()) setF({ hidden: [...facts.hidden, r.name.trim().toLowerCase()] });
                setRows(rows.filter((_, k) => k !== i)); setEdits((n) => n + 1);
              }} className="shrink-0 rounded-lg border border-border p-2 text-muted" aria-label={T("Remove this product", "ये product हटाएँ")}><X className="h-4 w-4" /></button>
            </div>
            {r.note && (
              <p className={`text-xs ${r.bad ? "font-medium text-danger" : "text-muted"}`}>
                {r.note}
                {r.studio && r.original && r.original !== r.photo && (
                  <button type="button" onClick={() => patchRow(i, { photo: r.original ?? "", studio: false, note: "", bad: false })} className="ml-1.5 font-semibold text-brand-ink underline">{T("Use original", "पुरानी photo रखें")}</button>
                )}
              </p>
            )}
            <input value={r.name} onChange={(e) => patchRow(i, { name: e.target.value })} placeholder={(hi ? ["जैसे काजू कतली / Water purifier / Hair cut", "Product या service 2", "Product या service 3"] : ["e.g. Kaju katli / Water purifier / Hair cut", "Product or service 2", "Product or service 3"])[i] ?? T("Product or service", "Product या service")} className={`${box} w-full`} />
            <div className="flex gap-1.5">
              <input value={r.price} onChange={(e) => patchRow(i, { price: e.target.value.replace(/[^\d.,/ a-zA-Z₹-]/g, "") })} placeholder="₹ price" className={`${box} w-28 shrink-0 py-2.5 text-sm`} />
              <input value={r.brand} onChange={(e) => patchRow(i, { brand: e.target.value })} placeholder={T("Brand (optional)", "Brand (ज़रूरी नहीं)")} className={`${box} min-w-0 flex-1 py-2.5 text-sm`} />
            </div>
          </div>
        ))}
        {removed && <p className="text-xs font-medium text-good">{removed}</p>}
        {brandProducts && <p className="text-xs text-muted">{T("✓ Your company’s products are shown on your V-Card.", "✓ आपकी company के products आपके V-Card पर दिख रहे हैं।")}</p>}
        {rows.length < MAX_ROWS && (
          <button type="button" onClick={() => { setRemoved(""); setRows([...rows, emptyRow()]); setEdits((n) => n + 1); }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" /> {T("Add one more", "एक और जोड़ें")}</button>
        )}
        {rows.length >= MAX_ROWS && <p className="text-xs text-muted">{T(`Up to ${MAX_ROWS} here. Add the rest on your Products page.`, `यहाँ ${MAX_ROWS} तक। बाक़ी Products page पर जोड़ें।`)}</p>}
      </Sec>

          {!!setup?.category && <TradeQuestions category={setup.category} facts={facts} setF={setF} hi={hi} tradeLabel={setup.categoryLabel} />}
          <FactsFields group="company" facts={facts} setF={setF} hi={hi} professional={setup?.persona === "professional"} role={setup?.role} hasAbout={!!setup?.about} />
          <FactsFields group="products" facts={facts} setF={setF} hi={hi} hasAbout={!!setup?.about} category={setup?.category} />
        </div>
      </details>


      {err && <p ref={errRef} role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{err}</p>}
      <button type="button" id="make" onClick={async () => { setErr(""); setMakeFrom(""); await resolveSite(); setPlan(access.subscribed ? "premium" : "standard"); cameFromForm.current = true; setState("make"); window.scrollTo({ top: 0 }); }} disabled={!!busy || !!finding} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
        {finding ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {finding ? T("Looking up your website…", "आपकी website खोजी जा रही है…") : T("Continue →", "आगे बढ़ें →")}
      </button>
      {unlock && <UnlockDialog reason={T("A studio photo uses 5 credits. Add credits or activate your plan — your own photo is kept meanwhile.", "Studio photo में 5 credit लगते हैं। Credit डालें या अपना plan चालू करें — तब तक आपकी photo वैसी ही रहेगी।")} onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );
}
