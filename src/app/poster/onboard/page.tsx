"use client";

// The setup journey, one short screen each (owner's call, 5 Oct 2026: "steps clear and easy, professional, looking
// interesting to fill"; the list is src/lib/setup-steps.ts, one count on every bar):
//   1. About you        — name, mobile, photo; skipped when sign-up already gave them
//   2. Card for what    — own business / sell Shubhora / both (one tap)
//   3. Website?         — own / a brand's (dealer) / one they like / none — asked early, because a site fills the
//                         next screens (name, logo, about, city, trade), read while they go on
//   4. Your business    — the name and what you do (the trade's own words when the list has no fit)
//   5. About your trade — the trade's own questions, a few taps
//   6. Where & when     — city, address, map pin, reach, timings, home service, areas
//   7. About & logo     — the about (the AI writes it), logo, since / experience / team, role, degree, GST
//   8. Photos & more    — banner and photos, payments, social — all optional — then Save
// Every screen writes what it has before the next opens (the account's business object, the card facts once the
// profile exists) and keeps a local draft while typing, so nothing typed is ever lost. Saved once, used everywhere:
// the poster profile (posters, card, website), the account (the AI reads "about") and the card facts.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, CheckCircle2, ChevronLeft, Globe, Layers, LoaderCircle, Mail, MapPin, Search, Sparkles, Store, TriangleAlert, User } from "lucide-react";
import { SitePhotos } from "@/components/poster/site-photos";
import { api, authHeaders, isLoggedIn, setCurrentProfileId, uploadImage, type Profile } from "@/lib/poster-client";
import { dataUrlToFile, shrinkForCrop } from "@/lib/image-utils";
import { ImageCropper } from "@/components/editor/image-cropper";
import { CategoryPicker } from "@/components/category-picker";
import { syncCardFromSetup, loadOwnDetails, personalize, applySetup, setupCard } from "@/lib/card-personalize";
import { LiveWindow, type LiveFocus } from "@/components/poster/live-window";
import { getTemplate } from "@/lib/templates";
import { fetchMyCardsStrict, publishCard, suggestUsername } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { categoryOf } from "@/lib/poster-categories";
import { exactCategory, matchCategory } from "@/lib/category-match";
import type { Business } from "@/lib/journey";
import type { Card, CardBlock } from "@/lib/types";
import { ClaimUsername } from "@/components/poster/claim-username";
import { useT } from "@/lib/poster-i18n";
import { useAssociate } from "@/lib/associate";
import { ProfileSteps } from "@/components/poster/profile-steps";
import { usernameOk, INTRODUCER_KEY, INTRODUCER_LEG_KEY } from "@/lib/username";
import { dropStaleLocal, onLocalReset } from "@/lib/local-reset";
import { normalizeFacts, vcardDraftKey, vcardFormKey, UPI_RE, type CardFacts, type FactsResponse } from "@/lib/card-facts";
import { COMPANY_FACT_KEYS, FactsFields, pickFacts, PRODUCT_FACT_KEYS, type FactsPatch } from "@/components/poster/facts-fields";
/** Every fact the business screens ask (the highlights moved here from the Products page, 6 Oct 2026). */
const SCREEN_FACT_KEYS = [...COMPANY_FACT_KEYS, ...PRODUCT_FACT_KEYS] as const;
import { catalogCopyFor, exampleNameFor, exampleSiteFor, orgWordFor } from "@/lib/catalog-copy";
import { TradeQuestions } from "@/components/poster/trade-questions";
import { partsLabel, partsOf } from "@/lib/trade-parts";
import { SITE_CARDS, cleanSiteUrl, hostOf, isShubhoraHost, looksLikeEmail, looksLikeSite, socialDetour, toFactsRole, type SiteKind } from "@/lib/site-role";
import { ONBOARD_SCREENS, SETUP_HOME, SETUP_SCREENS, type ScreenKey } from "@/lib/setup-steps";
import { canGoBackInApp, goBack } from "@/lib/nav-back";
import { tradeQuestionsFor } from "@/lib/trade-questions";
import { isEmbedded } from "@/components/poster/embed-mode";
import { Help, type HelpKey } from "@/components/poster/field-help";

const box = "rounded-xl border border-border bg-surface px-3.5 py-3 text-base font-normal";
/** The compact field of "About you" (one screen, no scroll). */
const cField = "mt-1 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base font-normal text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ABOUT_MAX_WORDS = 150;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** Waits for a save, but not for ever: on a slow or dead connection the owner goes on to the next screen and the draft keeps the answers. */
const keepGoing = (work: Promise<unknown>, ms = 15_000) => Promise.race([work.catch(() => undefined), new Promise((res) => setTimeout(res, ms))]);
/** The result of `work`, or null when it fails or takes longer than `ms`: a call to the network must never hold a screen for ever. */
function orNull<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    work.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}
/** What an About text was written for: the business name and the trade as they read at that moment. */
const aboutKey = (b: { name?: string; category?: string; trade?: string }) => [(b.name ?? "").trim().toLowerCase().replace(/\s+/g, " "), b.category ?? "", (b.trade ?? "").trim().toLowerCase()].join("|");
/** A short fingerprint of the text itself, so any change by hand (here or on the website) is noticed. */
const textSum = (s: string) => { let h = 5381; for (const c of s.trim()) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
/** Set only on an About the AI wrote from nothing (the box was empty): the name + trade it was written for, and the text's fingerprint. */
type AboutMade = { k: string; h: string };
/** The About that the AI wrote for another business name or trade than the form now has, and nobody has touched since:
 *  it describes someone else's business, so it is thrown away and written again (owner, 14 Oct 2026: a new business kept the old
 *  "Welcome to Sharma Paints…"). Text the owner typed, or edited, is never judged this way. */
const aboutIsStale = (b: { name?: string; category?: string; trade?: string; about?: string; aboutMade?: AboutMade }) =>
  !!b.aboutMade && !!(b.about ?? "").trim() && b.aboutMade.h === textSum(b.about ?? "") && b.aboutMade.k !== aboutKey(b);
/** Mobile sign-ups get a made-up address like 919812345678@phone.shubhora.com — they have no real email. */
const IS_PHONE_EMAIL = /@phone\./i;
const LOCATION_OFF = { en: "Location is off. Turn it on, or paste your Google Maps link on Photos & more.", hi: "Location बंद है। चालू करें, या Photos & more पर Google Maps link paste करें।" };
/** Why the phone / browser gave no position (owner, 15 Oct 2026: "pin it on the map shayad kaam nahi kar raha" — every failure said "Location is off"). */
const LOCATION_BLOCKED = { en: "Location is blocked for this website. Tap the lock icon next to the address, choose Location → Allow, then tap the button again. Or paste a Google Maps link below.", hi: "इस website के लिए Location बंद (block) है। Address के पास lock icon दबाएँ, Location → Allow चुनें, फिर बटन दोबारा दबाएँ। या नीचे Google Maps link paste करें।" };
const LOCATION_NOFIX = { en: "Could not find your location. Check that Location (GPS) is on, stand near a window or outside, and try again. Or paste a Google Maps link below.", hi: "आपकी location नहीं मिली। देखें कि Location (GPS) चालू है, खिड़की के पास या बाहर खड़े हों, और फिर दबाएँ। या नीचे Google Maps link paste करें।" };
const looksLikeMapLink = (v: string) => /^https?:\/\/(?:[\w-]+\.)*(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page|share\.google)\S*$/i.test(v.trim());
/** The website step's answer. kind "" = nothing chosen yet; the step insists on one, so a link never exists
 *  without a role (a pasted link silently treated as "own" would import a stranger's name and products). */
type SiteState = { kind: SiteKind | ""; url: string; assertedAt: string };
/** What /api/site/peek learned from the home page. */
type PeekData = { url: string; name: string; logo?: string; about?: string; city?: string; address?: string; phone?: string; products: number; category?: string; empty?: boolean };
type PeekState = { state: "idle" | "reading" | "found" | "unreadable" | "empty"; url: string; role: "own" | "dealer" | "reference"; data: PeekData | null };
const NO_PEEK: PeekState = { state: "idle", url: "", role: "own", data: null };
/** The one social / maps link that was pasted as a "website" and kept as what it is. */
type Detour = { key: "instagram" | "facebook" | "youtube" | "map"; url: string; label: string };

function Photo({ url, label, hint, round, busy, onPick, hi }: { url?: string | null; label: string; hint: string; round?: boolean; busy: boolean; onPick: (f: File) => void; hi?: boolean }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <span className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden border-2 border-dashed border-border bg-surface2 ${round ? "rounded-full" : "rounded-2xl"}`}>
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`h-full w-full ${round ? "object-cover" : "object-contain"}`} />
        ) : <Camera className="h-6 w-6 text-muted" />}
      </span>
      <span className="text-sm font-semibold text-brand-ink">{url ? (hi ? `${label} बदलें` : `Change ${label}`) : (hi ? `${label} जोड़ें` : `Add ${label}`)}
        <span className="block text-xs font-normal text-muted">{hi ? "ज़रूरी नहीं" : "Optional"} · {hint}</span></span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
    </label>
  );
}

/** A message that belongs to one control, shown right under it (owner, 15 Oct 2026: "error saath me hi dikhana chahiye"): the same red box as the
 *  pin button's. `id` lets the screen scroll to it (ob-err-<id>). Renders nothing without a message. */
function FieldErr({ id, msg, className = "" }: { id: string; msg?: string; className?: string }) {
  return msg ? <span id={`ob-err-${id}`} role="alert" className={`mt-1 block rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger ${className}`}>{msg}</span> : null;
}

function Onboard() {
  const router = useRouter();
  const params = useSearchParams();
  type StepKey = Exclude<ScreenKey, "products" | "make">;
  /** ?step=business from older links opens the first business screen. */
  const asStep = (v: string | null): StepKey | null => (v === "business" ? "trade" : v === "highlights" ? "details" : ((ONBOARD_SCREENS as string[]).includes(v ?? "") || v === "extras" || v === "where" || v === "about") ? (v as StepKey) : null);
  const [step, setStep] = useState<StepKey>(asStep(params.get("step")) ?? "you");
  // A partner's name is what their KYC says: shown, never edited here. The account itself says so too (read in load()), so the
  // screens that follow "About you" know at once, not after the page-wide lookup has come back.
  const hookAssociate = useAssociate();
  const [partnerMeta, setPartnerMeta] = useState(false);
  const associate = hookAssociate || (partnerMeta ? "partner" : null);
  /** Is this account a partner? "yes": it carries a partner ID. "no": the server itself says it has no partner panel to register one in.
   *  "unknown": anything else (not looked at yet, the panel was down). A partner ID can be written WHILE this screen is open (a Google
   *  sign-up claims its username here, and the server registers the ID): the account is read again after that, and a screen that decides
   *  from it waits for that first look. An account is saved as "own business only" without a choice only when this says "no". */
  const partnerRef = useRef<"unknown" | "yes" | "no">("unknown");
  const markPartner = useCallback(() => { partnerRef.current = "yes"; setPartnerMeta(true); }, []);
  useEffect(() => { if (hookAssociate) markPartner(); }, [hookAssociate, markPartner]);
  const wanted = params.get("step");
  const part = params.get("part");   // an edit tile that shares a screen: "photos" or "links"
  // ?next=/poster/card/build — the card (or another tool) needs these details first: no skip, and "Save" returns there.
  // An in-app path only, like ?back= below (never //other-site, never /\other-site).
  const SAFE_PATH = /^\/(?![/\\])[^\s]*$/;
  const next = SAFE_PATH.test(params.get("next") ?? "") ? params.get("next")! : "";
  // ?skip=1 — the plan page's Skip: create the minimal profile and open the app without showing the form.
  const autoSkip = params.get("skip") === "1";
  // ?back=/poster/more — an EDIT of name / mobile / photo (Me → "Edit name / mobile"): only "About you", a Save
  // button, and straight back there afterwards (owner's call, 26 Sep 2026). With ?step=about|where|extras and a back
  // (Card & Website → Edit, 7 Oct 2026) the same: that one screen, Save, and back — the live website follows.
  const back = SAFE_PATH.test(params.get("back") ?? "") ? params.get("back")! : "";
  const editing = !!back;
  /** What the set-up had when it opened: a focused edit writes onto the live card only what CHANGED here. */
  const atLoad = useRef<{ about: string; hours: string; address: string; banner: string; photos: string[]; name?: string }>({ about: "", hours: "", address: "", banner: "", photos: [] });
  const stepRef = useRef(step);
  stepRef.current = step;
  // Every screen of the walk has an address of its own (…?step=trade), one history entry each (owner, 15 Oct 2026: "back matlab previous
  // page"): the browser's Back, the Back arrow and "Previous" all land on the screen the owner was just on, and a reload stays on it.
  // `window.history` (not router.push): no round trip to the server per screen; Next keeps useSearchParams in step with it.
  function stepUrl(to: StepKey): string {
    const q = new URLSearchParams(window.location.search);   // ?back= ?next= ?part= ?card= travel along
    q.set("step", to);
    return `${window.location.pathname}?${q.toString()}`;
  }
  function writeStepUrl(to: StepKey, how: "push" | "replace") {
    try {
      const shown = new URLSearchParams(window.location.search).get("step");
      if (how === "push") {
        // The screen being left gets its own address first (the walk may have been opened at /poster/onboard with no ?step=), or Back could not return to it.
        if (shown !== stepRef.current) window.history.replaceState(null, "", stepUrl(stepRef.current));
        window.history.pushState(null, "", stepUrl(to));
      } else if (shown !== to) window.history.replaceState(null, "", stepUrl(to));
    } catch { /* the screen itself has changed either way */ }
  }
  /** Opens a screen of the walk. "replace": a hand-off the owner must not Back into (the first screen skipped for them, "Who is this website for?" for a non-partner). */
  function go(to: StepKey, how: "push" | "replace" = "push") {
    const same = to === stepRef.current;
    setStep(to);
    if (!same) { try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } }
    if (same && how === "push") return;   // already on it: no second copy of it in the history
    writeStepUrl(to, how);
  }
  const onPage = useRef(true);
  useEffect(() => { onPage.current = true; return () => { onPage.current = false; }; }, []);
  /** Is the owner still on screen `s`? A save that lands after they pressed Back, tapped a step chip or left the page must not push them
   *  forward again (owner, 15 Oct 2026: "back kahi ka kahi lekar jaata hai") — every move made after an `await` asks this first. The address
   *  bar changes the instant Back is pressed and the screen state follows a moment later, so both are asked. */
  function stillOn(s: StepKey): boolean {
    if (!onPage.current || stepRef.current !== s) return false;
    try { const shown = asStep(new URLSearchParams(window.location.search).get("step")); return !shown || shown === s; } catch { return true; }
  }
  useEffect(() => {
    const w = asStep(wanted);
    if (!w) return;
    // An address change this page did not make itself (the browser's Back / Forward, a step chip): the old screen's message goes with it.
    if (w !== stepRef.current) clearMsgs();
    setStep(w);
  }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  // Step 1 "About you": name, mobile, WhatsApp (same as the mobile unless unticked), email, photo. The home city and
  // address are not asked any more (owner's call, 7 Oct 2026: "ye KYC ka part hai") — the business city comes on
  // "Where & when".
  const [you, setYou] = useState({ name: "", phone: "", photo: "" as string | null, whatsapp: "", waSame: true, phone2: "" });
  /** Step 1 was finished once on this account (its Next writes you_done_at; older accounts left a home city). */
  const [youDone, setYouDone] = useState(false);
  // The mobile number the account was made with is the account's own: shown, never edited here (owner, 14 Oct 2026).
  const [phoneLocked, setPhoneLocked] = useState(false);
  // The profile's detail answers (card facts): step 1 adds the designation / WhatsApp, step 2 the company details.
  // Loaded with the account, saved with "Save and continue" (the facts route needs the profile to exist first).
  const [facts, setFacts] = useState<CardFacts>(() => normalizeFacts({}));
  const [liveBase, setLiveBase] = useState<Card | null>(null);   // the live window's card (edit screens only)
  const [liveVer, setLiveVer] = useState(0);
  const [photoFocus, setPhotoFocus] = useState<LiveFocus>(null);
  const liveStep = editing && (["you", "trade", "where", "about", "extras"] as string[]).includes(step) && part !== "links";
  useEffect(() => {
    if (!liveStep) return;
    let off = false;
    void setupCard().then((c) => { if (!off) setLiveBase(c); });
    return () => { off = true; };
  }, [liveStep, liveVer]);
  const factsDirty = useRef(false);
  const setF = (p: FactsPatch) => { factsDirty.current = true; setFacts((f) => ({ ...f, ...p, social: { ...f.social, ...(p.social ?? {}) } })); };
  // Four ways a card can lead (owner's call, 23 Sep 2026): a shop/company by its name, a professional or an agent by
  // their own name, or a personal card with no products. Stored as `role`; the older `kind` (business | person) is
  // derived from it for everything downstream.
  type Role = "business" | "professional" | "agent" | "personal";
  const ROLES: { k: Role; t: string; s: string; th: string; sh: string; e: string }[] = [
    { k: "business", e: "🏪", t: "Shop / Business", s: "Shop, restaurant, salon, company — the business name leads", th: "दुकान / Business", sh: "Shop, restaurant, salon, company — card पर business का नाम" },
    { k: "professional", e: "👨‍⚕️", t: "Professional", s: "Doctor, CA, lawyer, teacher, photographer — your name leads", th: "Professional", sh: "Doctor, CA, lawyer, teacher, photographer — आपके नाम से" },
    { k: "agent", e: "🤝", t: "Agent / Network partner", s: "LIC, property, loan, direct selling — your name + company", th: "Agent / Network partner", sh: "LIC, property, loan, direct selling — आपका नाम + company" },
    { k: "personal", e: "👤", t: "Personal / Job / Student", s: "No business — just contact and about", th: "Personal / Job / Student", sh: "कोई business नहीं — सिर्फ़ contact और about" },
  ];
  const roleOf = (catKey: string): Role => {
    const c = categoryOf(catKey);
    if (/^(mlm|distributor|sales|agent|insurance|finance|realestate)$/.test(catKey)) return "agent";
    if (!c) return "business";
    if (c.persona === "professional") return "professional";
    if (c.persona === "personal" || c.persona === "student" || c.persona === "community" || /^(employee|govt|army|influencer)$/.test(catKey)) return "personal";
    return "business";
  };
  // How far the service goes (owner's call, 23 Sep 2026): city stays (local SEO, posters, "top ID of your city");
  // this decides the wording — "Serving Jaipur & nearby" vs "all over India" vs "online, worldwide".
  type Reach = "local" | "india" | "online";
  const REACH: { k: Reach; t: string; s: string; th: string; sh: string; e: string }[] = [
    { k: "local", e: "📍", t: "Local", s: "Your city and nearby", th: "Local", sh: "अपना शहर और आस-पास" },
    { k: "india", e: "🇮🇳", t: "All India", s: "Courier, agent, online seller", th: "पूरा भारत", sh: "Courier, agent, online seller" },
    { k: "online", e: "🌐", t: "Online / Worldwide", s: "IT, coaching, freelancer", th: "Online / दुनिया भर", sh: "IT, coaching, freelancer" },
  ];
  const reachOf = (role: Role, catKey: string): Reach =>
    role === "agent" || /^(courier|transport|manufacturer|wholesale|cleanprod|distributor|textile|pharma|agri)$/.test(catKey) ? "india" : /^(it|influencer|astro)$/.test(catKey) ? "online" : "local";
  const [biz, setBiz] = useState<Business & { logo?: string | null; kind: "business" | "person"; role: Role; roleTouched?: boolean; reachTouched?: boolean; linkBy?: "name" | "business"; /** Set while the About is one the AI wrote from nothing (see aboutIsStale). */ aboutMade?: AboutMade; /** The trade guessed from the name (not picked): kept in the state, not a ref, because a setState updater runs twice in dev and must stay pure. */ guessed?: string }>({ kind: "business", role: "business", reach: "local" });
  /** The card link the owner picked — or, untouched, the business name for a shop and the person's name otherwise. */
  const linkBy = (): "name" | "business" => biz.linkBy ?? (biz.role === "business" && (biz.name ?? "").trim() ? "business" : "name");
  const [uid, setUid] = useState("");
  // ---- the website step ----
  const [site, setSite] = useState<SiteState>({ kind: "", url: "", assertedAt: "" });
  /** The website answer as the latest render has it — and as `continueWithoutSite` sets it — for the saves that run before the next render. */
  const siteRef = useRef(site);
  siteRef.current = site;
  const [siteErr, setSiteErr] = useState("");
  const [peek, setPeek] = useState<PeekState>(NO_PEEK);
  /** A peek that comes back after a newer one started, or after Save, is thrown away. */
  const peekSeq = useRef(0);
  /** The read in flight (or last finished), so a blur followed by Next does not start the same read twice. */
  const peekFor = useRef({ url: "", role: "", state: "" });
  /** Fields the person typed into: a late peek result never writes over them. */
  const touched = useRef(new Set<string>());
  /** The trade the business name suggested (not the owner's own pick, and not the website's). */
  /** A social / maps link pasted as the website, waiting for "keep it as that?" */
  const [pendingSocial, setPendingSocial] = useState<Detour | null>(null);
  const [detours, setDetours] = useState<Detour[]>([]);
  /** The website and role as stored when the screen opened — a change means the card must be built again. */
  const siteAtLoad = useRef({ url: "", role: "own" });
  const factsLoaded = useRef(false);   // the card facts came back at load: only then may a save write the WhatsApp / second number
  const hadLiveCard = useRef(false);
  /** The live card as it was when this screen opened: a changed business (another name, or Shubhora card for an own business now) is built again. */
  const liveCard = useRef<{ company: string; kb?: string } | null>(null);
  const [youSkipped, setYouSkipped] = useState(false);
  /** "About your business" is written by the AI on its own when the name is known and it is still empty — or was written for another
   *  name or trade (aboutIsStale). Holds the name + trade it was last tried for, so one try is made per name, never a loop. */
  const autoAbout = useRef("");
  const [needEmail, setNeedEmail] = useState(false);
  /** "Add one more number" ticked (or a second number already there). */
  const [showP2, setShowP2] = useState(false);
  const p2Open = showP2 || !!you.phone2;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  // Messages that belong to ONE control are shown right under it, not in `err` (the line above the Next button, far from the field):
  // a missing / wrong answer under its field (+ focus), a failed photo under that photo, the AI's failure under "Write with AI", Skip's under Skip.
  const [fieldErr, setFieldErr] = useState<{ k: string; msg: string } | null>(null);
  const [photoErr, setPhotoErr] = useState<{ kind: "photo" | "logo"; msg: string } | null>(null);
  const [aboutErr, setAboutErr] = useState("");
  const [skipErr, setSkipErr] = useState("");
  /** Every message of the screen being left goes with it (Back, a step chip, the address changing). */
  function clearMsgs() { setErr(""); setSiteErr(""); setFieldErr(null); setPhotoErr(null); setAboutErr(""); setSkipErr(""); }
  /** The answer `k` is missing or wrong: the message appears under that field, which is focused and scrolled to the middle. A new object every
   *  time, so trying again scrolls again. */
  function failField(k: string, msg: string) { setFieldErr({ k, msg }); }
  /** Typing in the field answers its message. */
  const clearFE = (k: string) => setFieldErr((f) => (f && f.k === k ? null : f));
  const fe = (k: string) => (fieldErr?.k === k ? fieldErr.msg : "");
  useEffect(() => {
    if (!fieldErr) return;
    const t = setTimeout(() => {
      try {
        const inp = document.getElementById(`ob-in-${fieldErr.k}`) ?? (fieldErr.k === "about" ? document.getElementById("about") : null);
        (inp as HTMLElement | null)?.focus?.({ preventScroll: true });
        (document.getElementById(`ob-err-${fieldErr.k}`) ?? inp)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch { /* the message is on screen either way */ }
    }, 40);
    return () => clearTimeout(t);
  }, [fieldErr]);
  // A website message is under the link box (or the dealer's tick, or the amber "keep it as…" box): scrolled to, so Next never looks dead.
  useEffect(() => {
    if (!siteErr) return;
    const t = setTimeout(() => {
      try { (document.getElementById("ob-err-site") ?? document.getElementById("ob-err-tick") ?? document.getElementById("ob-err-pick") ?? document.getElementById("ob-pending-social"))?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* ignore */ }
    }, 40);
    return () => clearTimeout(t);
  }, [siteErr]);
  const [crop, setCrop] = useState<{ kind: "photo" | "logo"; src: string } | null>(null);
  const { lang } = useT();
  const hi = lang === "hi";
  // "school", "clinic", "shop"… — every header on this screen says what the owner runs (owner's call, 4 Oct 2026:
  // "school ki baat kar rahe hain to Company details kyon?").
  const org = orgWordFor(biz.category);
  const place = hi ? org.hi : org.en;
  // Examples in the trade's own kind, never a real brand (owner's call, 4 Oct 2026): the name box says "Sunrise
  // Public School" to a school, the About box "nursery to class 12, CBSE…", the city is always Delhi.
  const egName = exampleNameFor(biz.category);
  const egSite = exampleSiteFor(biz.category);
  const copy = catalogCopyFor(biz.category);
  const T = (en: string, hiText: string) => (hi ? hiText : en);
  // "Your card leads with…" is worked out from "What do you do?"; the four choices open only on "Change".
  const [showRole, setShowRole] = useState(false);
  // "What is your card for?" — Both is the default (owner's call, 4 Oct 2026): their own business, with the Shubhora
  // page riding along on its own hidden link. Continue runs the chosen flow.
  const [promote, setPromote] = useState<"both" | "own" | "shubhora">("both");
  // The account's one username. Google sign-ups arrive without it: it is claimed here (from the sign-up form's
  // choice when there was one, else the person picks it now) so the card link and partner account exist from day one.
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const loadUsername = useCallback(async () => {
    const r = await api<{ username: string | null; partner?: { code?: string } | null }>("/api/account");
    // The answer carries the partner account when there is one (the server registers it by itself for an account that has none yet).
    if (r.ok && r.data.partner?.code) markPartner();
    if (r.ok) setUsername(r.data.username);
    return r.ok ? r.data.username : null;
  }, [markPartner]);
  /** The first look at the account (username, partner ID) is over — done or given up. A screen that decides from the partner ID waits for it. */
  const accountStep = useRef<Promise<unknown>>(Promise.resolve());
  const [accountReady, setAccountReady] = useState(false);
  useEffect(() => {
    accountStep.current = (async () => {
      try {
        const u = await loadUsername();
        if (u === null) {
          const sb = getBrowserSupabase();
          const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
          const md = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
          if (typeof md.wanted_username === "string" && usernameOk(md.wanted_username)) {
            let by = typeof md.introduced_by === "string" ? md.introduced_by : "";
            try { by = by || localStorage.getItem(INTRODUCER_KEY) || ""; } catch { /* ignore */ }
            let leg = typeof md.introduced_leg === "string" ? md.introduced_leg : "";
            try { leg = leg || localStorage.getItem(INTRODUCER_LEG_KEY) || ""; } catch { /* ignore */ }
            const r = await fetch("/api/account", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ username: md.wanted_username, by: by || undefined, leg: leg === "L" || leg === "R" ? leg : undefined }) });
            if (r.ok) { try { localStorage.removeItem(INTRODUCER_KEY); localStorage.removeItem(INTRODUCER_LEG_KEY); } catch { /* ignore */ } await loadUsername(); }
          }
        }
        // The claim, and the partner registration that /api/account runs (on the claim, or by itself on this very read), rewrite the account:
        // the version guard follows our own writes, or the first Next read them as "changed elsewhere" and reloaded the form away. The same
        // read finds the partner ID they wrote — from the server itself, not from the answer kept since the screen opened.
        await bumpServerBase(true);
        // Still no partner ID: ask whether this server has a partner panel at all.
        if (partnerRef.current === "unknown") await askPartnerPanel();
      } catch { /* offline: nothing more is known, and nothing is guessed */ }
      finally { setAccountReady(true); }
    })();
  }, [loadUsername]);   // eslint-disable-line react-hooks/exhaustive-deps
  /** An account with no partner ID: asks the server to register one. Registered → a partner. "not linked" → this server has no partner panel,
   *  so the account is not a partner and never will be. Any other answer (the panel was down) leaves it unknown. */
  async function askPartnerPanel() {
    const r = await api<{ ok?: boolean; code?: string; error?: string }>("/api/account", { method: "POST", json: { action: "register" } });
    if (r.ok && r.data.code) { markPartner(); await bumpServerBase(true); }
    else if (r.data.error === "not linked") partnerRef.current = "no";
  }

  /** One read of the account + profile. A network failure shows a retry, never an endless spinner. */
  const load = useCallback(async () => {
    setLoadErr(""); setLoading(true);
    try {
      // Back to the very screen asked for (?step=…&back=…) after the login, not the first one.
      if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/onboard${window.location.search}`)}`); return; }
      const sb = getBrowserSupabase();
      if (!sb) throw new Error("no session");
      const [{ data }, prof, fr, cards] = await Promise.all([
        sb.auth.getUser(),
        api<{ profiles?: Profile[] }>("/api/poster/profiles"),
        api<FactsResponse>("/api/card/facts").catch(() => null),
        fetchMyCardsStrict().catch(() => []),
      ]);
      const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; phone?: string; photo_url?: string; contact_email?: string; business?: Business; whatsapp?: string; home_city?: string; you_done_at?: string; also_shubhora?: boolean | null; primaryCardId?: string; associate_id?: string };
      setUid(data.user?.id ?? "");
      // Only ever a "yes" from here: this read can be older than the partner ID the first look at the account is writing.
      if (typeof meta.associate_id === "string" && meta.associate_id) markPartner();
      // Cleared by Super Admin since this phone last looked: the draft kept here is from before, and goes.
      dropStaleLocal(data.user);
      // The website already on record: the card facts first (they know whose site it is), else the account's own
      // website from an earlier set-up. Our own address, left by the seller template, is never anyone's website.
      const f = fr?.ok ? fr.data.facts : null;
      factsLoaded.current = !!f;
      const storedUrl = cleanSiteUrl(f?.website || "") || (isShubhoraHost(meta.business?.website ?? "") ? "" : cleanSiteUrl(meta.business?.website ?? ""));
      const storedRole = f?.website ? f.websiteRole : "own";
      siteAtLoad.current = { url: storedUrl, role: storedRole };
      hadLiveCard.current = cards.some((c) => c.active !== false);
      const lc = cards.find((c) => c.active !== false);
      liveCard.current = lc ? { company: (lc.company ?? "").trim(), kb: lc.kb } : null;
      if (storedUrl) setSite({ kind: storedRole, url: storedUrl, assertedAt: f?.dealerAssertedAt ?? "" });
      const p = prof.data.profiles?.find((x) => x.is_default) ?? prof.data.profiles?.[0] ?? null;
      setProfile(p);
      if (f) setFacts(f);
      atLoad.current = { about: meta.business?.about ?? "", hours: f?.hours ?? "", address: [meta.business?.address, meta.business?.city].filter(Boolean).join(", "), banner: f?.bannerUrl ?? "", photos: f?.photos ?? [], name: meta.business?.name ?? "" };
      const phone0 = (p?.phone || meta.phone || "").replace(/^\+91/, "");
      // Before the profile exists the WhatsApp number waits on the account (step 1 saves it there).
      const wa = f?.whatsapp || (meta.whatsapp ?? "").replace(/\D/g, "").slice(-10);
      setYou({
        name: meta.display_name || meta.full_name || (p?.persona !== "business" ? p?.name : "") || "",
        phone: phone0,
        photo: p?.photo_url ?? meta.photo_url ?? null,
        whatsapp: wa, waSame: !wa || wa === phone0.replace(/\D/g, "").slice(-10), phone2: f?.phone2 ?? "",
      });
      // Locked only when the account itself was made with this number (its login address is the phone one); someone who signed in
      // with an email or Google and typed a number later can still correct it.
      setPhoneLocked(IS_PHONE_EMAIL.test(data.user?.email ?? "") && phone0.replace(/\D/g, "").length >= 10);
      setYouDone(!!(meta.you_done_at || meta.home_city));
      // The answer given last time comes back (Both is the default; "Only my own business" wrote false).
      // "Selling Shubhora" set the business itself to Shubhora (promoteShubhora), so that answer shows as ticked again too.
      setPromote(meta.also_shubhora === false ? "own" : isPartnerBiz(meta.business) ? "shubhora" : "both");
      // What the account already holds: Next on the website screen does not write (or, for Shubhora, re-publish) it again.
      promoteSaved.current = meta.also_shubhora === false ? "own" : isPartnerBiz(meta.business) ? "shubhora" : meta.also_shubhora === true ? "both" : "";
      setBiz({ kind: p && p.persona !== "business" && !meta.business?.name ? "person" : "business", role: (meta.business?.role as Role) || (p && p.persona !== "business" && !meta.business?.name ? "professional" : "business"), ...meta.business, name: meta.business?.name || (p?.persona === "business" ? p.name : ""), category: meta.business?.category || p?.category || "", city: meta.business?.city || p?.city || "", logo: p?.logo_url ?? null });
      const mail = data.user?.email ?? "";
      setNeedEmail(IS_PHONE_EMAIL.test(mail));
      setEmail(meta.contact_email || (IS_PHONE_EMAIL.test(mail) ? "" : mail));
      // What this phone had typed and not yet saved comes back over what the server knows (it is newer: the
      // draft is cleared the moment Save or Skip goes through). Seven days old is forgotten.
      try {
        const key = `onboard-draft:${data.user?.id ?? ""}`;
        const raw = localStorage.getItem(key);
        const d = raw ? JSON.parse(raw) as { v?: number; at?: number; base?: number; step?: string; site?: SiteState; biz?: typeof biz; you?: typeof you; facts?: CardFacts; detours?: Detour[]; promote?: "both" | "own" | "shubhora"; touched?: string[] } : null;
        // Only a draft typed over THIS server version comes back; one from before a reset or another phone's save is thrown away.
        const serverAt = Date.parse(String(data.user?.updated_at ?? "")) || 0;
        serverBase.current = Math.max(serverBase.current, serverAt);   // never back to an older version than the first look at the account has seen
        // Inside Card / Website edit a part opens as it is saved, never over an old draft from another screen (live check 26 Oct 2026:
        // "What you offer" came up with another trade's choices for a few seconds).
        const fresh = !isEmbedded() && d?.v === 2 && d.base === serverAt && Date.now() - (d.at ?? 0) < 7 * 86_400_000;
        if (d && !fresh) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
        if (d && fresh) {
          if (d.site?.kind) setSite(d.site);
          if (d.biz) setBiz((b) => ({ ...b, ...d.biz }));
          if (d.you) setYou((y) => ({ ...y, ...d.you, photo: d.you?.photo || y.photo }));
          if (d.facts) { setFacts(normalizeFacts(d.facts)); factsDirty.current = true; }
          if (Array.isArray(d.detours)) setDetours(d.detours);
          if (d.promote) setPromote(d.promote);
          for (const k of d.touched ?? []) touched.current.add(k);
          if (!wanted && d.step && d.step !== "you") setStep(asStep(d.step) ?? "trade");
        }
      } catch { /* a bad draft is just ignored */ }
      // A focused edit of the about (Card & Website → Edit → About & logo): the box shows the about the WEBSITE has
      // now (the AI's, or the one edited since), not the set-up's short lines the owner never saw on the site.
      if (back && asStep(wanted) === "about") {
        const live = cards.find((c) => c.id === f?.primaryCardId) ?? cards[0];
        const liveAbout = live ? (live.pages.flatMap((pg) => pg.blocks).find((bl) => bl.kind === "about")?.body || live.about || "").trim() : "";
        if (liveAbout) { setBiz((b) => ({ ...b, about: liveAbout })); atLoad.current.about = liveAbout; }
      }
      draftReady.current = true;
      setLoading(false);
    } catch {
      setLoadErr("net");
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  useEffect(() => { load(); }, [load]);

  // Everything typed here is kept on this phone as it is typed (owner's call, 4 Oct 2026: "card fill karte jaayein
  // to auto save hona chahiye"): a page reload, a tap on another step's link or a closed tab brings it all back —
  // the website answer included, which used to snap back to "my own" until Save. Cleared by Save and Skip.
  const draftReady = useRef(false);
  /** The account's server version (auth updated_at) this screen loaded over. A draft is only ever restored onto the
   *  SAME version: after a demo / admin reset, or a save from another phone, the version moves and the draft is
   *  dropped. A second tab still open from before a reset (owner, 4 Oct 2026: a medical shop kept coming out as a
   *  school) carries the old version and may not write over the fresh one. */
  const serverBase = useRef(0);
  /** Set by clearDraft (Save, Skip): the unmount flush below must not write the draft back after it was cleared. */
  const draftDead = useRef(false);
  const writeDraft = useCallback(() => {
    if (!draftReady.current || !uid || draftDead.current || editing) return;
    try {
      const key = `onboard-draft:${uid}`;
      const cur = JSON.parse(localStorage.getItem(key) || "null") as { base?: number } | null;
      if (cur?.base && cur.base > serverBase.current) return;   // a newer tab owns the draft
      localStorage.setItem(key, JSON.stringify({ v: 2, at: Date.now(), base: serverBase.current, step, site, biz, you, facts, detours, promote, touched: [...touched.current] }));
    } catch { /* storage full or off: nothing lost but the convenience */ }
  }, [uid, step, site, biz, you, facts, detours, promote, editing]);
  useEffect(() => {
    const t = setTimeout(writeDraft, 400);
    // Leaving within the 400 ms (a step pill, a closed tab) used to lose the last edit: the draft is written now.
    window.addEventListener("pagehide", writeDraft);
    return () => { clearTimeout(t); window.removeEventListener("pagehide", writeDraft); writeDraft(); };
  }, [writeDraft]);
  // Typing is kept on the server too (owner, 18 Oct 2026: a customer may leave at any point and must never have to fill a screen again):
  // 2.5 s after the last change the screen's answers are written exactly as "Next" would write them, without moving on. "About you" has its
  // own save (it changes the account's name and login number), so it is left to its Next.
  const autosaved = useRef("");
  useEffect(() => {
    if (!draftReady.current || !uid || editing || moved.current || draftDead.current || step === "you" || busy) return;
    const sig = JSON.stringify([biz, facts, site, promote]);
    if (!autosaved.current) { autosaved.current = sig; return; }   // what the screen opened with is already on the server
    if (sig === autosaved.current) return;
    const t = setTimeout(() => { autosaved.current = sig; void track(persistStep()); }, 2500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biz, facts, site, promote, step, busy, uid, editing]);
  /** The account as the server has it NOW. getUser() keeps its answer for 20 s (lib/supabase/browser.ts) — only a screen's own save clears that —
   *  so it would still show the account as it was before a write the SERVER made (a partner ID registered, a username claimed). Asking with the
   *  session's own token is never reused. */
  async function freshUser() {
    const sb = getBrowserSupabase();
    if (!sb) return null;
    const { data: s } = await sb.auth.getSession();
    return (await sb.auth.getUser(s.session?.access_token)).data.user ?? null;
  }
  /** After this screen itself writes to the account (Both, Shubhora), the version moves on and the draft follows. `fresh`: after a write the
   *  server made, not this screen. The same read tells whether the account has a partner ID by now. A dead connection leaves things as they are. */
  async function bumpServerBase(fresh = false) {
    try {
      const user = await orNull(fresh ? freshUser() : Promise.resolve(getBrowserSupabase()?.auth.getUser()).then((r) => r?.data.user ?? null), 8_000);
      if (!user) return;
      serverBase.current = Math.max(serverBase.current, Date.parse(String(user.updated_at ?? "")) || 0);
      const code = (user.user_metadata as { associate_id?: unknown } | undefined)?.associate_id;
      if (typeof code === "string" && code) markPartner();
    } catch { /* keep */ }
  }
  /** The saves of this screen that are still on their way. The 15 s wait of "Next" gives up on a slow one, but it goes on, and moves the account's
   *  version when it lands: the version check waits for these, or it reads our own save as "changed elsewhere". */
  const writing = useRef(new Set<Promise<unknown>>());
  function track<T>(work: Promise<T>): Promise<T> {
    writing.current.add(work);
    const done = () => { writing.current.delete(work); };
    work.then(done, done);
    return work;
  }
  function clearDraft() { draftDead.current = true; try { if (uid) localStorage.removeItem(`onboard-draft:${uid}`); } catch { /* ignore */ } }
  /** Set once the account is known to have moved on (a reset, another phone's save): this screen's answers are the OLD ones and
   *  nothing more is written from it — not the draft, not the account, not the website link. */
  const moved = useRef(false);
  // The demo's Reset button (here or in another tab of this phone): the draft stops being written, and a tab that is not the one
  // resetting reloads onto the fresh account instead of going on with the old answers.
  useEffect(() => onLocalReset((own) => { draftDead.current = true; moved.current = true; if (!own) window.location.reload(); }), []);
  // The phone may keep this page when Back is pressed and show it again exactly as it was — with the old business, the old About
  // and the old profile id, after the account was reset. Coming back to it, the account is looked at first.
  useEffect(() => {
    // A page this phone already knows is stale (its own Reset ran here) is not shown again; any other is checked against the server first.
    const onShow = (e: PageTransitionEvent) => { if (!e.persisted) return; if (moved.current) window.location.reload(); else void accountMoved(true); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A picked photo opens the crop / zoom window first; the framed square is what gets uploaded. */
  async function choose(file: File, kind: "photo" | "logo") {
    setErr(""); setPhotoErr(null);
    try { setCrop({ kind, src: await shrinkForCrop(file, kind === "logo" ? 1600 : 2000) }); }
    catch { setPhotoErr({ kind, msg: T("Could not open that photo — please pick a JPG or PNG.", "वो photo खुल नहीं पाई — JPG या PNG चुनें।") }); }
  }
  async function upload(dataUrl: string, kind: "photo" | "logo") {
    setCrop(null); setBusy(kind); setErr(""); setPhotoErr(null);
    try {
      const url = await uploadImage(dataUrlToFile(dataUrl, kind === "logo" ? "logo.png" : "photo.jpg"), kind);
      if (!url) { setPhotoErr({ kind, msg: T("Could not upload the photo. Please try again.", "Photo upload नहीं हो पाई। दोबारा try करें।") }); return; }
      if (kind === "photo") setYou((y) => ({ ...y, photo: url })); else { touch("logo"); setBiz((b) => ({ ...b, logo: url })); }
    } catch {
      setPhotoErr({ kind, msg: T("Could not upload the photo. Please try again.", "Photo upload नहीं हो पाई। दोबारा try करें।") });
    } finally {
      setBusy("");
    }
  }

  /** The AI writes "About your business" from the name, the type and any notes already typed. */
  async function writeAbout(auto = false): Promise<string> {
    setErr(""); setAboutErr(""); clearFE("about");
    if (!biz.name?.trim() && !biz.category) { if (!auto) setAboutErr(T("Add the business name and what you do first — the AI writes from those.", "पहले business का नाम और काम लिखें — AI उन्हीं से लिखता है।")); return ""; }
    // An About the AI wrote for another name or trade is not notes to improve: it goes, and the AI starts again from the name.
    const stale = aboutIsStale(biz);
    if (auto && (biz.about ?? "").trim() && !stale) return biz.about ?? "";
    const notes = stale ? "" : (biz.about ?? "");
    const madeFor = aboutKey(biz);
    // Written in the background while another screen is open (the walk has no About screen now): that screen's buttons are not held.
    const showBusy = !auto || stepRef.current === "about";
    if (showBusy) setBusy("about");
    try {
      const r = await fetch("/api/ai/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        task: "about-business", input: `${notes}${biz.city ? `\nCity: ${biz.city}` : ""}`.trim(),
        company: biz.name ?? you.name, role: tradeWord(),
      }) }).then((x) => x.json()).catch(() => ({ error: "" }));
      // Never overwrite what the owner typed with canned text: no text means an honest error.
      if (!r.text) { if (!auto) setAboutErr(hi ? "AI लिख नहीं पाया। कुछ लाइनें खुद लिख दें।" : (r.error || "The AI could not write it. Please type a few lines yourself.")); return ""; }
      const text = String(r.text).trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ");
      // Written on its own: only into an about that is still empty (or one for another name) — never over what was typed meanwhile.
      // Marked as the AI's own only when it started from nothing: an About made from the owner's notes is theirs to keep.
      setBiz((b) => (auto && (b.about ?? "").trim() && !aboutIsStale(b) ? b : { ...b, about: text, aboutMade: notes.trim() ? undefined : { k: madeFor, h: textSum(text) } }));
      return text;
    } catch {
      if (!auto) setAboutErr(T("The AI could not write it. Please type a few lines yourself.", "AI लिख नहीं पाया। कुछ लाइनें खुद लिख दें।"));
      return "";
    } finally {
      if (showBusy) setBusy("");
    }
  }

  /** Step 1 is saved to the account the moment "Next" is tapped, so closing the app loses nothing.
   *  Once the setup has been done (a poster profile exists) this is an EDIT, and it goes everywhere at once: the
   *  login (the new number signs in), the posters, the V-Card and the partner ID — /api/account/details does the
   *  server side, then the setup's own card sync re-publishes the card picture / number. Before, "Next" only
   *  changed the login, and the card and posters kept the old details until the whole setup was saved again. */
  /** The fact keys a save sends. The Photos edit changes the banner and the gallery on the server itself (one tap at a time), so
   *  this screen's older copy of them must never be sent back over those changes. */
  function factKeys(): readonly (keyof CardFacts)[] {
    return editing ? SCREEN_FACT_KEYS.filter((k) => k !== "bannerUrl" && k !== "photos") : SCREEN_FACT_KEYS;
  }
  /** Step 1's fact: the WhatsApp number, only when it differs from the mobile. */
  /** On the "UPI & social" screen only: what goes on the card's buttons (a UPI ID that does not look right is left out). */
  function linksSync(): { upi?: string; instagram?: string; facebook?: string; youtube?: string } {
    // Only from that screen, and only once the saved answers are loaded: an empty box from a page still loading must never take a link off.
    if (step !== "extras" || part === "photos" || !factsLoaded.current) return {};
    const upi = facts.upi.trim();
    return { ...(upi && !UPI_RE.test(upi) ? {} : { upi }), instagram: facts.social.instagram ?? "", facebook: facts.social.facebook ?? "", youtube: facts.social.youtube ?? "" };
  }
  function youFacts(): { whatsapp: string; phone2: string } {
    const mobile = you.phone.replace(/\D/g, "").slice(-10);
    const wa = you.waSame ? "" : you.whatsapp.replace(/\D/g, "").slice(-10);
    const p2 = you.phone2.replace(/\D/g, "").slice(-10);
    return { whatsapp: wa && wa !== mobile ? wa : "", phone2: p2.length === 10 && p2 !== mobile ? p2 : "" };
  }
  /** The account's business object as it stands now — written early, so closing the app loses nothing; the
   *  last Save writes the full, checked version again. */
  function bizMeta(): Business & { aboutMade?: AboutMade } {
    return { name: (biz.name ?? "").trim(), role: biz.role, reach: biz.reach ?? "local", category: biz.category || "", trade: (biz.trade ?? "").trim().slice(0, 40), gstin: (biz.gstin ?? "").trim().toUpperCase(),
      address: (biz.address ?? "").trim(), city: (biz.city ?? "").trim(), about: (biz.about ?? "").trim(), website: ownSiteUrl(), map: (biz.map ?? "").trim(), linkBy: (biz.name ?? "").trim() ? linkBy() : "name",
      ...(biz.nameFromSite !== undefined ? { nameFromSite: biz.nameFromSite } : {}), ...(biz.categoryFromSite !== undefined ? { categoryFromSite: biz.categoryFromSite } : {}), ...(biz.aboutFromSite !== undefined ? { aboutFromSite: biz.aboutFromSite } : {}), ...madeMeta() };
  }
  /** The mark that the About is the AI's own, kept on the account only while the text is still exactly what the AI wrote. */
  function madeMeta(): { aboutMade?: AboutMade } {
    return biz.aboutMade && (biz.about ?? "").trim() && biz.aboutMade.h === textSum(biz.about ?? "") ? { aboutMade: biz.aboutMade } : {};
  }

  /** The contact email of a mobile sign-up, kept the moment it is typed: it used to be written only by the last
   *  "Save and continue", so Next, Skip or a closed tab lost it and Super Admin showed no email (owner, 4 Oct 2026). */
  const emailMeta = (): { contact_email?: string } => {
    const e = email.trim().slice(0, 120);
    return needEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? { contact_email: e } : {};
  };

  async function nextFromYou() {
    setErr(""); setFieldErr(null);
    const digits = you.phone.replace(/\D/g, "");
    const p2 = you.phone2.replace(/\D/g, "");
    if (p2 && p2.slice(-10).length !== 10) { failField("yphone2", T("The second number needs 10 digits — or clear it.", "दूसरा number 10 अंकों का चाहिए — या उसे ख़ाली छोड़ें।")); return; }
    if (you.name.trim().length < 2 || digits.length < 10) { failField(you.name.trim().length < 2 ? "yname" : "yphone", T("Write your name and 10-digit mobile number.", "अपना नाम और 10 अंकों का mobile number लिखें।")); return; }
    // These two were dropped without a word before: a short WhatsApp number or a wrong email simply never reached the card.
    const wa = you.whatsapp.replace(/\D/g, "");
    if (!you.waSame && wa && wa.slice(-10).length !== 10) { failField("ywa", T("The WhatsApp number needs 10 digits — or tick “WhatsApp is the same number”.", "WhatsApp number 10 अंकों का चाहिए — या “WhatsApp भी यही number है” पर tick करें।")); return; }
    if (needEmail && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { failField("yemail", T("The email does not look right — fix it, or leave it empty.", "Email ठीक नहीं लगता — ठीक करें, या खाली छोड़ें।")); return; }
    // Busy before the version check: a second tap while it waits on the network must not run the save twice.
    setBusy("you");
    // The first look at the account may still be running, and it can be the one that registers the partner ID: it is waited for (ten seconds
    // at most), so a partner is not taken past "Who is this website for?" as if they were not one.
    await keepGoing(accountStep.current, 10_000);
    // A tab left open from before a reset must not write its old answers over the fresh account (see accountMoved).
    if (await accountMoved()) { setBusy(""); return; }
    // Only a partner is asked "Who is this website for?"; everyone else is simply an owner of their own business and goes on to the website question.
    // "Who is this website for?" now sits on top of the website screen itself (owner, 24 Oct 2026: "dono page ko mila kar ek"), so everyone goes there.
    const after: StepKey = "site";
    // The sign that step 1 was done: after a reset the name and mobile stay but this goes, so the step shows again.
    // "Own business only" is written for them here only when the server says it has no partner panel at all (an account that is simply not known as a
    // partner yet is left as it is: nobody is saved as own-only without choosing).
    const home = { you_done_at: new Date().toISOString(), setup_pos: after, ...(partnerRef.current === "no" ? { also_shubhora: false } : {}) };
    if (profile || editing) {
      const phone = digits.slice(-10);
      let partnerMissed = false;
      try {
        const r = await api<{ ok?: boolean; error?: string; note?: string }>("/api/account/details", { method: "POST", json: { name: you.name.trim(), phone, photo: you.photo || "" } });
        if (!r.ok) { setErr(hi ? "Save नहीं हुआ। दोबारा try करें।" : (r.data.error ?? "Could not save. Please try again.")); return; }
        // The WhatsApp number lives in the card facts (the profile exists, so the route takes it); the city and
        // address go on the account's business right away.
        if (profile) await api("/api/card/facts", { method: "PATCH", json: { facts: youFacts() } }).catch(() => undefined);
        if (!editing) await getBrowserSupabase()?.auth.updateUser({ data: { ...home, ...emailMeta(), business: bizMeta() } }).catch(() => undefined);
        partnerMissed = !!r.data.note;
        // The name and number were changed on the server: refresh this session's copy of them.
        await getBrowserSupabase()?.auth.refreshSession().catch(() => undefined);
        // This screen's own write moved the account's version; the guard must follow it, or the last Save would
        // take our own step-1 write for "changed elsewhere" and reload the form away.
        await bumpServerBase();
        await syncCardFromSetup({
          name: you.name.trim(), business: (biz.name ?? "").trim(), photo: you.photo || null, logo: biz.logo || null, phone, ...(factsLoaded.current ? { whatsapp: youFacts().whatsapp, phone2: youFacts().phone2 } : {}),
          oldPhoto: profile?.photo_url ?? null, oldLogo: profile?.logo_url ?? null,
        }).catch(() => undefined);
      } catch {
        setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); return;
      } finally { setBusy(""); }
      if (!stillOn("you")) return;   // Back / Cancel was pressed while it saved: they stay where they went
      // Replace, not push: Back from the page it returns to must not land on this finished edit form again.
      if (back) { router.replace(`${back}${back.includes("?") ? "&" : "?"}saved=${partnerMissed ? "details-np" : "details"}`); return; }
      go(after);
      return;
    }
    try {
      await getBrowserSupabase()?.auth.updateUser({ data: {
        full_name: you.name.trim(), display_name: you.name.trim(), phone: `+91${digits.slice(-10)}`, photo_url: you.photo || "",
        whatsapp: youFacts().whatsapp, ...home, ...emailMeta(), business: bizMeta(),
      } });
      await bumpServerBase();
    } catch { /* offline: the full save on the next screen writes it again */ } finally { setBusy(""); }
    if (!stillOn("you")) return;
    go(after);
  }

  /** "Promote Shubhora" (owner's call, 24 Sep 2026): most partners sell Shubhora itself, so no business form —
   *  the account is set up as a Shubhora partner, the 3 plans become their products, the Shubhora seller card is
   *  built with their name / photo / number and published on their username, and the editor opens on it. */
  async function promoteShubhora() {
    setBusy("shubhora"); setErr("");
    try {
      if (await accountMoved()) return;
      const digits = you.phone.replace(/\D/g, "").slice(-10);
      const sb = getBrowserSupabase();
      const cat = categoryOf("mlm");
      // 1. account + profile (agent for Shubhora, Pan India)
      await sb?.auth.updateUser({ data: {
        full_name: you.name.trim(), display_name: you.name.trim(), phone: `+91${digits}`, photo_url: you.photo || "",
        business: { name: "Shubhora", role: "agent", reach: "india", category: "mlm", city: (biz.city ?? "").trim(), address: "", about: "", website: "https://shubhora.com", map: "", gstin: "" },
        setup_pos: null,
      } });
      clearDraft();
      const pr = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: {
        id: profile?.id, is_default: true, persona: "business", name: you.name.trim(), tagline: "Shubhora Partner", phone: digits, city: (biz.city ?? "").trim(), lang: profile?.lang ?? "hi",
        photo_url: you.photo || null, logo_url: "/art/brand/shubhora-logo.png", category: "mlm", style: profile?.style ?? cat?.style ?? "classic", mode: "product", layout: profile?.layout ?? {},
      } });
      if (pr.ok && pr.data.profile) setCurrentProfileId(pr.data.profile.id);
      // 2. the 3 Shubhora plans as products (skipped when already there)
      const have = await api<{ products?: { name: string; brand?: string }[] }>("/api/poster/products");
      if (!(have.ok && (have.data.products ?? []).some((p) => /shubhora/i.test(p.name) || /shubhora/i.test(p.brand ?? "")))) {
        for (const d of SHUBHORA_PRODUCTS) await api("/api/poster/products", { method: "POST", json: d });
      }
      // 3. the seller card on the person's NAME (/c/rajesh-kumar) — identity in, everything else exactly as the
      //    template says. An existing card keeps its link; the account username is only the last resort.
      const tpl = getTemplate("vcard-reseller");
      const own = await loadOwnDetails();
      const mine = await fetchMyCardsStrict().catch(() => []);
      const existingCard = mine[0] ?? null;
      const handle = existingCard?.username || (await suggestUsername(you.name.trim()).catch(() => null)) || username || "";
      if (tpl && handle) {
        const data = personalize(tpl.data, own ? { ...own, name: you.name.trim(), photo: you.photo || own.photo, phone: digits || own.phone } : null, { keepSamples: true, identityOnly: true });
        // The old card's Google title / description / keywords described the OLD business — they must not survive
        // the switch (bug: the Shubhora card kept "Sharma Sweets" in its search title). Only the site-verification
        // code is the owner's own setting and stays.
        // The partner's website is the Shubhora pages of this template (owner, 19 Oct 2026: "sirf card banata hai, website nahi"):
        // switched ON here, so a computer opens it as the website, "My website" is in Share Links and the set-up step counts as done.
        const card = { ...(existingCard ?? {}), ...data, id: existingCard?.id ?? Math.random().toString(36).slice(2, 10), username: handle, active: true,
          site: { ...(existingCard?.site ?? {}), ...(data.site ?? {}), enabled: true },
          seoTitle: data.seoTitle ?? "", seoDescription: data.seoDescription ?? "",
          seo: { ...(data.seo ?? {}), ...(existingCard?.seo?.googleVerify ? { googleVerify: existingCard.seo.googleVerify } : {}) } } as Parameters<typeof publishCard>[0];
        const r = await publishCard(card);
        // Replace: the Shubhora card now exists — Back must not land on this question to be answered (and published) again. It lands on
        // Card & Website with a "ready" note (owner, 19 Oct 2026: straight into the editor felt like nothing had been made), not the raw editor.
        if (r.ok) { router.replace("/poster/site?made=shubhora"); return; }
        setErr(hi ? "Card publish नहीं हो पाया — editor खोलकर Publish दबाएँ।" : (r.error || "Could not publish the card — open the editor and press Publish."));
      }
      // no username yet (or publish failed): the editor with the template, publish by hand
      router.replace(existingCard ? `/poster/d/editor?id=${existingCard.id}&template=vcard-reseller` : "/poster/d/editor?id=new&template=vcard-reseller");
    } catch {
      setErr(T("Something went wrong. Please try again.", "कुछ गड़बड़ हुई। दोबारा try करें।"));
    } finally { setBusy(""); }
  }

  /** The third choice (owner's call): the person does BOTH — their own shop, clinic or service, AND selling
   *  Shubhora. Before this the two choices replaced each other, so anyone doing both had to give one up.
   *
   *  Here their own business is set up exactly as it always was (this walks straight on to the business form
   *  and the AI builds their card from it). What changes is that the choice is remembered on the account, and
   *  when that card is published the Shubhora page rides along on its own hidden link — /c/<user>/shubhora.
   *  The two never mix: their customers see only their business, that one link shows only Shubhora, and the
   *  daily posters stay their own. */
  async function bothFlow(): Promise<boolean> {
    setBusy("both"); setErr("");
    try {
      if (await accountMoved()) return false;
      const sb = getBrowserSupabase();
      // Remembered on the account, not in this screen's state: the card is built on a later screen, and the
      // person may well close the app in between.
      const up = await sb?.auth.updateUser({ data: { also_shubhora: true, setup_pos: "site", ...(isPartnerBiz(biz) ? { business: null } : {}) } });
      if (isPartnerBiz(biz)) setBiz(freshBiz);
      if (up?.error) { setErr(T("Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।")); return false; }
      await bumpServerBase();
      return true;
    } catch {
      setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"));
      return false;
    } finally { setBusy(""); }
  }

  /** "Only my own business or work": remembered on the account like the other two answers, then the website screen. */
  async function ownFlow(): Promise<boolean> {
    setBusy("own"); setErr("");
    try {
      if (await accountMoved()) return false;
      const up = await getBrowserSupabase()?.auth.updateUser({ data: { also_shubhora: false, setup_pos: "site", ...(isPartnerBiz(biz) ? { business: null } : {}) } });
      if (isPartnerBiz(biz)) {
        setBiz(freshBiz);
        // The Shubhora plans the partner flow put on the Products page go too: on an own-business account they would still make the daily
        // poster ("Shubhora Premium" on a sweets shop, 19 Oct 2026) and sit "On card" on the Products page.
        try {
          const r = await api<{ products?: { id: string; category?: string; brand?: string; name: string }[] }>("/api/poster/products");
          for (const pr of r.ok ? (r.data.products ?? []) : []) if (/shubhora/i.test(`${pr.category ?? ""} ${pr.brand ?? ""}`)) await api(`/api/poster/products?id=${pr.id}`, { method: "DELETE" });
        } catch { /* the Products page can still delete them by hand */ }
      }
      if (up?.error) { setErr(T("Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।")); return false; }
      await bumpServerBase();
      return true;
    } catch {
      setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"));
      return false;
    } finally { setBusy(""); }
  }

  /** Save's one AI try for an empty About, and the re-run of Save once it is written. */
  const aboutTried = useRef(false);
  /** "About your trade": the two tick boxes for the extra questions. */
  const [extraOpen, setExtraOpen] = useState({ hours: false, more: false });
  const [saveGo, setSaveGo] = useState(0);
  /** The partner's "for whom" answer, written once per choice (a second Next after a link error does not save it again). */
  const promoteSaved = useRef<string>("");
  /** After the answer is saved the website part runs on the NEXT render, with the business the save may have reset. */
  const [siteGo, setSiteGo] = useState<{ n: number; how: "next" | "without" }>({ n: 0, how: "next" });
  async function nextFromSiteScreen(how: "next" | "without") {
    if (associate) {
      if (promote === "shubhora") {
        // Already a Shubhora card: nothing to build again — straight to Card & Website.
        if (promoteSaved.current === "shubhora") { router.replace("/poster/site"); return; }
        await promoteShubhora(); return;
      }
      if (promoteSaved.current !== promote) {
        const ok = promote === "both" ? await bothFlow() : await ownFlow();
        if (!ok || !stillOn("site")) return;
        promoteSaved.current = promote;
        setSiteGo((g) => ({ n: g.n + 1, how }));
        return;
      }
    }
    if (how === "without") await continueWithoutSite(); else await nextFromWebsite();
  }

  /* ================= the website step ================= */

  /** "What do you do?" also decides how the card leads and how far the service goes — unless those were set by hand. */
  const withCategory = (b: typeof biz, k: string) => {
    const role = b.roleTouched ? b.role : roleOf(k);
    return { ...b, category: k, role, kind: role === "business" ? "business" as const : "person" as const, reach: b.reachTouched ? b.reach : reachOf(role, k) };
  };
  const touch = (k: string) => { touched.current.add(k); };
  /** A different trade asks different questions: the old trade's ticks would otherwise show up as the owner's own
   *  typed answers (they are not in the new lists — a school's "classes" are not a coaching's) and reach the AI as
   *  if they had written them. Every answer goes, not only the offerings. */
  const changeTrade = (k: string) => { if (k !== biz.category && Object.keys(facts.tradeAnswers ?? {}).length > 0) setF({ tradeAnswers: {} }); };
  /** Most Indian businesses say their trade in their name — "Sharma Sweets", "Apollo Clinic", "Verma Electricals".
   *  When the owner has not picked a trade themselves, the name picks it, so the list never has to be opened. */
  function guessTrade(b: typeof biz): typeof biz {
    if (touched.current.has("category")) return b;
    const k = matchCategory(`${b.name ?? ""} ${b.about ?? ""}`);
    if (!k || !categoryOf(k)) {
      // The guess stood on the name a few letters ago ("Yadav Drone Car" → auto, mid-typing "Yadav Drone Care"): the
      // finished name no longer says it, so it goes — only what the owner ends up typing counts.
      if (b.category && b.category === b.guessed) return { ...withCategory(b, ""), guessed: "" };
      return b;
    }
    if (k === b.category) return b;
    return { ...withCategory(b, k), guessed: k };
  }
  /** False while the trade is only a guess from the name that the name, as it now reads, no longer supports. */
  const guessHolds = () => !biz.guessed || biz.category !== biz.guessed || matchCategory(`${biz.name ?? ""} ${biz.about ?? ""}`) === biz.category;

  /** The website's own account of itself goes into the fields that are still empty — never over anything typed. */
  function prefill(d: PeekData) {
    setBiz((b) => {
      const t = touched.current;
      let n = { ...b };
      if (!t.has("name") && !(b.name ?? "").trim() && d.name) n.name = d.name.slice(0, 80);
      if (!t.has("city") && !(b.city ?? "").trim() && d.city) n.city = d.city.slice(0, 60);
      if (!t.has("address") && !(b.address ?? "").trim() && d.address) n.address = d.address.slice(0, 200);
      // A website new to this account replaces an older about and trade too (they described an earlier set-up);
      // a site already on record only fills what is empty.
      const fresh = !siteAtLoad.current.url || hostOf(d.url) !== hostOf(siteAtLoad.current.url);
      if (!t.has("about") && (fresh || !(b.about ?? "").trim()) && d.about) { n.about = d.about.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" "); n.aboutMade = undefined; }
      if (!t.has("logo") && !b.logo && d.logo) n.logo = d.logo;
      if (!t.has("category") && (fresh || !b.category) && d.category && categoryOf(d.category)) n = withCategory(n, d.category);
      return n;
    });
  }

  /** A brand's site fills what the dealer's form can take from it: the trade (a Maruti dealer is an auto showroom)
   *  and, until the dealer uploads their own, the brand's logo (owner's call, 2 Oct 2026). Never the name / city. */
  function prefillDealer(d: PeekData) {
    setBiz((b) => {
      const t = touched.current;
      let n = { ...b };
      if (!t.has("category") && !b.category && d.category && categoryOf(d.category)) n = withCategory(n, d.category);
      if (!t.has("logo") && !b.logo && d.logo) n.logo = d.logo;
      return n;
    });
  }

  /** A website the person likes says what trade they are in (owner's call, 4 Oct 2026: "reference website se bhi
   *  category auto select") — only the trade, and only until they pick one themselves. */
  function prefillReference(d: PeekData) {
    setBiz((b) => (!touched.current.has("category") && d.category && categoryOf(d.category) && d.category !== b.category ? withCategory(b, d.category) : b));
  }

  /** "maruti car" instead of a link: the official website is looked up by name, then read like a pasted link. */
  /** Why the last name search gave no link, when it was not just "nothing found": the request failed or ran out of time ("failed"), it was used
   *  too often ("wait" — the server allows 20 in ten minutes), or the text was an email address ("email" — never searched). */
  const lookupWhy = useRef<"" | "failed" | "wait" | "email">("");
  /** The name search in flight, so "Carry on without a website" can let it go. */
  const lookupCtl = useRef<AbortController | null>(null);
  /** Moved on when the owner leaves the website step ("Next", "Carry on without a website"): a name search still running is let go, and what
   *  it finds later is not used. */
  const siteRun = useRef(0);
  /** The link found for a name; "" when there is none. A failed request used to throw out of the Next button and the search
   *  button, so they did nothing at all; a connection that never answered held them for ever — now twelve seconds is the most. */
  async function findByName(q: string): Promise<string> {
    lookupWhy.current = "";
    if (looksLikeEmail(q)) { lookupWhy.current = "email"; return ""; }   // an email address is not a brand's name: not searched
    const ctrl = new AbortController();
    lookupCtl.current = ctrl;
    try {
      // Twelve seconds is the most a name search may take (no answer, or a failed request, both read as "could not look it up").
      const r = await orNull(api<{ ok: boolean; url?: string; name?: string }>("/api/site/find", { method: "POST", json: { q }, signal: ctrl.signal }), 12_000);
      if (!r) { ctrl.abort(); lookupWhy.current = "failed"; return ""; }
      if (!r.ok) lookupWhy.current = r.status === 429 ? "wait" : "failed";
      return r.ok && r.data.ok && r.data.url ? r.data.url : "";
    } finally { if (lookupCtl.current === ctrl) lookupCtl.current = null; }
  }
  const [finding, setFinding] = useState("");
  async function resolveTyped(): Promise<string> {
    const v = site.url.trim();
    lookupWhy.current = "";   // what went wrong with an earlier search must not colour the words for this one
    if (!v || looksLikeSite(cleanSiteUrl(v)) || socialDetour(v) || v.length < 2) return cleanSiteUrl(v);
    const run = siteRun.current;
    setFinding(v);
    try {
      const url = await findByName(v);
      if (siteRun.current !== run) return "";   // the owner went on without a website while this was looking
      if (url) { setSite((st) => ({ ...st, url })); return url; }
      return "";
    } finally { setFinding(""); }
  }
  /** The words for a name that gave no website. */
  const notFoundMsg = (v: string) => lookupWhy.current === "email"
    ? T("That is an email address, not a website. Write the website link, e.g. sharmasweets.com, or carry on without a website.", "यह email है, website नहीं। website का link लिखें, जैसे sharmasweets.com, या बिना website के आगे बढ़ें।")
    : lookupWhy.current === "wait"
    ? T("You searched too many times. Wait a few minutes and try again, or paste the link (e.g. brandname.com), or carry on without a website.", "आपने बहुत बार खोजा। कुछ मिनट रुककर फिर try करें, या link डालें (जैसे brandname.com), या बिना website के आगे बढ़ें।")
    : lookupWhy.current === "failed"
    ? T("Could not look it up just now. Try again, paste the link (e.g. brandname.com), or carry on without a website.", "अभी ढूँढ नहीं पाए। दोबारा try करें, link डालें (जैसे brandname.com), या बिना website के आगे बढ़ें।")
    : T(`Could not find a website for "${v}". Paste the link, e.g. brandname.com, or carry on without a website.`, `"${v}" की website नहीं मिली। link डालें, जैसे brandname.com, या बिना website के आगे बढ़ें।`);

  /** Reads the home page while the person is still on the form: ≤45 s, one page, never blocks anything. */
  async function startPeek(next?: SiteState) {
    const st = next ?? site;
    const url = cleanSiteUrl(st.url);
    if ((st.kind !== "own" && st.kind !== "dealer" && st.kind !== "reference") || !url || !looksLikeSite(url) || socialDetour(url) || isShubhoraHost(url)) return;
    const same = peekFor.current.url === url && peekFor.current.role === st.kind;
    if (same && peekFor.current.state !== "unreadable") return;
    const seq = ++peekSeq.current;
    const role = st.kind;
    peekFor.current = { url, role, state: "reading" };
    setPeek({ state: "reading", url, role, data: null });
    const ctrl = new AbortController();
    const guard = setTimeout(() => ctrl.abort(), 45_000);
    try {
      const r = await api<PeekData & { ok: boolean; reason?: string }>("/api/site/peek", { method: "POST", json: { url, role }, signal: ctrl.signal });
      if (seq !== peekSeq.current) return;
      if (!r.ok || !r.data.ok) {
        const state = r.data.reason === "empty" ? "empty" : "unreadable";
        peekFor.current = { url, role, state };
        setPeek({ state, url, role, data: null });
        return;
      }
      peekFor.current = { url, role, state: "found" };
      setPeek({ state: "found", url, role, data: r.data });
      if (role === "own") prefill(r.data);
      else if (role === "dealer") prefillDealer(r.data);
      else prefillReference(r.data);
    } catch {
      if (seq === peekSeq.current) { peekFor.current = { url, role, state: "unreadable" }; setPeek({ state: "unreadable", url, role, data: null }); }
    } finally { clearTimeout(guard); }
  }

  function pickSite(k: SiteKind) {
    setSiteErr(""); setPendingSocial(null);
    const next: SiteState = { kind: k, url: k === "none" ? "" : site.url, assertedAt: k === "dealer" ? site.assertedAt : "" };
    setSite(next);
    if (k === "none") { peekSeq.current++; peekFor.current = { url: "", role: "", state: "" }; setPeek(NO_PEEK); }
    else if (next.url) void startPeek(next);
  }

  function onUrlChange(v: string) {
    setSiteErr("");
    setSite((st) => ({ ...st, url: v }));
    const d = v.trim() ? socialDetour(v) : null;
    setPendingSocial(d ? { ...d, url: cleanSiteUrl(v) } : null);
  }

  /** "Yes, keep it as my Instagram": the link is stored where it belongs (the facts' social links, so every save
   *  carries it and Photos & more shows it), and the website answer becomes a reference with no link — none. */
  function keepSocial() {
    if (!pendingSocial) return;
    const d = pendingSocial;
    if (d.key === "map") setBiz((b) => ({ ...b, map: d.url }));
    else { setDetours((list) => [...list.filter((x) => x.key !== d.key), d]); setF({ social: { [d.key]: d.url } }); }
    setPendingSocial(null); setSiteErr("");
    setSite({ kind: "reference", url: "", assertedAt: "" });
    peekSeq.current++; peekFor.current = { url: "", role: "", state: "" }; setPeek(NO_PEEK);
  }

  /** "Change" on Photos & more opens the website screen; its Next comes back here instead of walking on to Your business. */
  const returnTo = useRef<StepKey | null>(null);
  // Only meaningful while the website screen is open: leaving it any other way (Back, a step chip) forgets where it was opened from, or the
  // next visit to this screen by the normal walk would jump to Photos & more.
  useEffect(() => { if (step !== "site") returnTo.current = null; }, [step]);
  /** Leaves the website screen: the answer and the screen about to open go to the server (like every other Next). */
  async function leaveWebsite() {
    const run = ++siteRun.current;   // a newer leave ("Carry on without a website" while this waits on a slow connection) takes over from this one
    const to = returnTo.current ?? "trade";
    setBusy("next");
    try {
      if (await accountMoved()) return;
      await keepGoing(track(persistStep(to)));
    } finally { if (siteRun.current === run) setBusy(""); }
    if (siteRun.current !== run) return;
    if (!stillOn("site")) return;   // the owner went somewhere else (Back, a step chip, another page) while it saved
    const opener = returnTo.current;
    returnTo.current = null;
    // Opened from Photos & more → Change: that screen is the one just before this, so go back to it (no second copy of it in the history).
    if (opener && canGoBackInApp()) { setStep(opener); router.back(); return; }
    go(to, opener ? "replace" : "push");
  }
  useEffect(() => {
    if (saveGo) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveGo]);
  useEffect(() => {
    if (!siteGo.n) return;
    if (siteGo.how === "without") void continueWithoutSite(); else void nextFromWebsite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteGo]);
  /** The dealer's tick is missing: said under the tick box itself, not under the link box. */
  const tickMsg = T("Tick first that you are this brand's authorised dealer.", "पहले tick करें कि आप इस brand के authorised dealer हैं।");
  async function nextFromWebsite() {
    setSiteErr("");
    if (!site.kind) { setSiteErr(T("Pick one of the three first.", "पहले तीन में से एक चुनें।")); return; }
    if (site.kind === "none") { await leaveWebsite(); return; }
    // A reference without a link is simply none: the person has no website and none in mind.
    if (site.kind === "reference" && !site.url.trim()) { setSite({ kind: "reference", url: "", assertedAt: "" }); await leaveWebsite(); return; }
    let url = cleanSiteUrl(site.url);
    if (site.url.trim() && !pendingSocial && !looksLikeSite(url)) {
      // The name search can take a few seconds: the button says so instead of looking dead, and "Carry on without a website" stays tappable.
      const run = siteRun.current;
      setBusy("next");
      let found = "";
      try { found = await resolveTyped(); } finally { if (siteRun.current === run) setBusy(""); }
      if (siteRun.current !== run) return;   // "Carry on without a website" took the owner on while the name was being looked up
      if (found) url = found;
      else { setSiteErr(notFoundMsg(site.url.trim())); return; }
    }
    if (!site.url.trim()) { setSiteErr(T("Write the website link, e.g. sharmasweets.com. No website? Tap “I have no website — use an example”, or carry on without one.", "website का link लिखें, जैसे sharmasweets.com। Website नहीं है? “मेरी website नहीं है — कोई example लें” दबाएँ, या बिना website के आगे बढ़ें।")); return; }
    if (pendingSocial) { setSiteErr(T(`That is a ${pendingSocial.label} page, not a website — keep it as a ${pendingSocial.label} link, or change the link.`, `ये ${pendingSocial.label} page है, website नहीं — social link की तरह रखें, या link बदलें`)); return; }
    if (!url || !looksLikeSite(url)) { setSiteErr(T("That does not look like a website link. For example: sharmasweets.com", "ये website का link नहीं लगता। जैसे sharmasweets.com")); return; }
    if (isShubhoraHost(url)) { setSiteErr(T("That is Shubhora's own site. Put in your business's website.", "ये Shubhora की site है। अपने business की website डालें।")); return; }
    if (site.kind === "dealer" && !site.assertedAt) { setSiteErr(tickMsg); return; }
    setSite((st) => ({ ...st, url }));
    void startPeek({ ...site, url });
    await leaveWebsite();
  }
  /** The way out of every website error: no link, an example only (the third card's answer) — and on to the next screen. */
  async function continueWithoutSite() {
    siteRun.current++;                // a name search still running is let go: what it finds later is not used
    lookupCtl.current?.abort();
    setFinding("");
    setSiteErr(""); setPendingSocial(null);
    peekSeq.current++; peekFor.current = { url: "", role: "", state: "" }; setPeek(NO_PEEK);
    const none: SiteState = { kind: "reference", url: "", assertedAt: "" };
    siteRef.current = none;   // the save inside leaveWebsite reads this render's site: it must already be the empty one
    setSite(none);
    await leaveWebsite();
  }
  // The website answer is written as soon as the step is left, not only at Save (owner's call, 4 Oct 2026: it
  // snapped back to "my own" on return). Needs the profile the facts route insists on; before that, the draft holds it.
  useEffect(() => {
    if (step === "site" || step === "promote" || !profile || !site.kind || !draftReady.current) return;
    void saveSiteFacts().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The link box searches by itself (owner's call, 4 Oct 2026: "auto search hona chahiye"): a pause after typing
  // looks the site up — a name becomes its link, a link is read — and the 🔍 button does the same on demand.
  const typedUrl = useRef("");
  useEffect(() => {
    const v = site.url.trim();
    typedUrl.current = v;
    if (!site.kind || site.kind === "none" || v.length < 3 || pendingSocial) return;
    const t = setTimeout(() => { if (typedUrl.current === v) void lookupTyped(); }, looksLikeSite(cleanSiteUrl(v)) ? 700 : 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.url, site.kind]);
  async function lookupTyped(explicit = false) {
    // Enter in an empty box (the button is switched off then) must answer too.
    if (explicit && site.url.trim().length < 2) { setSiteErr(T("Type the website link or just the name first.", "पहले website का link या सिर्फ़ नाम लिखें।")); return; }
    const url = await resolveTyped();
    if (url && site.kind && site.kind !== "none") void startPeek({ ...site, url });
    // The search button and Enter must answer even when nothing is found; the automatic search while typing stays quiet.
    else if (!url && explicit && !pendingSocial && site.url.trim().length >= 2) setSiteErr(notFoundMsg(site.url.trim()));
  }

  /** The "paste a Google Maps link" box under the pin button: opens by itself when the GPS gives nothing. */
  /** Shown right under the pin button (the screen's own error line sits far below it, by Next). */
  const [pinErr, setPinErr] = useState("");
  const [mapPaste, setMapPaste] = useState<{ open: boolean; value: string; bad: boolean }>({ open: false, value: "", bad: false });
  function pasteMapLink(raw: string) {
    const v = raw.trim();
    setMapPaste({ open: true, value: raw, bad: false });
    if (!v) return;
    if (!looksLikeMapLink(v)) { setMapPaste({ open: true, value: raw, bad: true }); return; }
    setErr(""); setPinErr("");
    setBiz((b) => ({ ...b, map: v }));
    if (!facts.social.google) setF({ social: { ...facts.social, google: v } });
    setMapPaste({ open: false, value: "", bad: false });
  }

  /** 📍 Uses the phone's GPS where the owner is standing — an exact map pin, no typing. */
  function pinShop() {
    setPinErr("");
    if (typeof navigator === "undefined" || !navigator.geolocation) { setPinErr(T(LOCATION_NOFIX.en, LOCATION_NOFIX.hi)); setMapPaste((m) => ({ ...m, open: true })); return; }
    setBusy("pin");
    const got = async (p: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = p.coords;
      const pin = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
      setBiz((b) => ({ ...b, map: pin }));
      setMapPaste({ open: false, value: "", bad: false }); setPinErr("");
      // The pin is the Google Maps link: the "Google Maps link" box on Photos & more shows it instead of asking again.
      // A new pin (re-pin) replaces the old one everywhere; a first pin only fills an empty Google Maps box.
      const repin = !!(biz.map ?? "").trim();
      if (repin || !facts.social.google) setF({ social: { ...facts.social, google: pin } });
      setBusy("");
      // The pin also knows the city and the locality: the owner does not type what the phone already knows.
      try {
        const r = await fetch(`/api/geo/city?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
        const g = (await r.json()) as { ok?: boolean; city?: string; area?: string };
        if (g.ok) setBiz((b) => ({
          ...b,
          ...(g.city && !touched.current.has("city") && !(b.city ?? "").trim() ? { city: g.city } : {}),
          ...(g.area && !touched.current.has("address") && !(b.address ?? "").trim() ? { address: g.area } : {}),
        }));
      } catch { /* the pin alone is still worth having */ }
    };
    const failed = (e: GeolocationPositionError) => {
      setBusy("");
      setPinErr((e.code === 1 ? T(LOCATION_BLOCKED.en, LOCATION_BLOCKED.hi) : T(LOCATION_NOFIX.en, LOCATION_NOFIX.hi)) + ` (${e.code === 1 ? "blocked" : e.code === 2 ? "no position" : "timed out"})`);
      setMapPaste((m) => ({ ...m, open: true }));
    };
    // The GPS first (exact, what a shop pin needs). A computer, or a phone indoors, often gives no GPS fix: then the network position
    // (Wi-Fi / mobile tower) is taken instead of failing. Only "blocked" stops here.
    // watchPosition, not getCurrentPosition: a laptop (macOS) often answers "no position yet" at once and finds one a few seconds later;
    // a watch keeps trying and the first fix wins. Only "blocked" stops it. After 25 s the network position is the last try.
    let settled = false;
    const finish = (fn: () => void) => { if (settled) return; settled = true; fn(); };
    const id = navigator.geolocation.watchPosition(
      (p) => finish(() => { navigator.geolocation.clearWatch(id); clearTimeout(timer); void got(p); }),
      (e) => { if (e.code === 1) finish(() => { navigator.geolocation.clearWatch(id); clearTimeout(timer); failed(e); }); },
      { enableHighAccuracy: true, maximumAge: 60_000 },
    );
    const timer = setTimeout(() => finish(() => {
      navigator.geolocation.clearWatch(id);
      navigator.geolocation.getCurrentPosition((p) => void got(p), failed, { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60_000 });
    }), 25000);
  }

  /** "Skip for now" (owner's call, 23 Sep 2026): whatever is filled is kept, nothing is required, and the app opens.
   *  A minimal profile is created when there is none (the app needs one to show its screens), so the person can come
   *  back to any step later from Setup — the floating "Finish setup" sheet keeps the unfinished steps in view. */
  async function skipForNow() {
    setBusy("skip"); setErr(""); setSkipErr("");
    // The plan / welcome page's "Skip" opens this address (?skip=1) and the app opens straight away: that address must not stay behind
    // it, or Back from the home screen would run the skip again and bounce on.
    const from = stepRef.current;
    const leave = () => { if (!stillOn(from)) return; if (autoSkip) router.replace("/poster"); else router.push("/poster"); };   // not if they pressed Back meanwhile
    try {
      await keepGoing(accountStep.current, 10_000);   // the partner ID may be on its way (see nextFromYou)
      // The words go under Skip itself (the page's own error line is at the foot of the screen, far from it).
      if (await accountMoved()) { setErr(""); setSkipErr(T("This account was changed elsewhere (a reset, or another phone). Reloading…", "यह account कहीं और बदला गया (reset, या दूसरे phone से)। दोबारा खुल रहा है…")); return; }
      const digits = you.phone.replace(/\D/g, "").slice(-10);
      const sb = getBrowserSupabase();
      let email = "";
      try { email = (await sb?.auth.getUser())?.data.user?.email ?? ""; } catch { /* ignore */ }
      const name = you.name.trim().length >= 2 ? you.name.trim() : (email && !/@phone\./.test(email) ? email.split("@")[0] : "My business");
      const cat = categoryOf(biz.category ?? "");
      const bizName = (biz.name ?? "").trim();
      const city = (biz.city ?? "").trim();
      // account details — only what was typed
      await sb?.auth.updateUser({ data: {
        ...(you.name.trim().length >= 2 ? { full_name: you.name.trim(), display_name: you.name.trim() } : {}),
        ...(digits.length === 10 ? { phone: `+91${digits}` } : {}),
        ...(you.photo ? { photo_url: you.photo } : {}),
        ...emailMeta(),
        ...(biz.category || bizName || city || site.kind ? { business: { name: bizName, role: biz.role, reach: biz.reach ?? "local", category: biz.category || "", trade: (biz.trade ?? "").trim().slice(0, 40), city, address: (biz.address ?? "").trim(), about: (biz.about ?? "").trim(), website: ownSiteUrl(), map: (biz.map ?? "").trim(), gstin: (biz.gstin ?? "").trim().toUpperCase(), linkBy: bizName ? linkBy() : "name", ...madeMeta() } } : {}),
        setup_skipped_at: new Date().toISOString(),
        // Both is the default answer to "What is your card for?" (owner's call, 4 Oct 2026), skipped or not — for a partner, who is asked.
        // Not a partner: own business only, written only when the server says it has no partner panel (never guessed).
        ...(partnerRef.current === "yes" ? (promote === "both" ? { also_shubhora: true } : {}) : partnerRef.current === "no" ? { also_shubhora: false } : {}),
      } }).catch(() => undefined);
      await bumpServerBase();
      if (!profile) {
        const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: {
          is_default: true, persona: biz.role === "business" ? (cat?.persona ?? "business") : biz.role === "personal" ? "personal" : biz.role === "agent" ? "business" : "professional",
          name: biz.role === "business" && bizName ? bizName : name, tagline: tradeWord(), phone: digits.length === 10 ? digits : "", city, lang: "hi",
          photo_url: you.photo || null, logo_url: biz.logo || null, category: biz.category || "", style: cat?.style ?? "classic", mode: "greeting", layout: {},
        } });
        if (r.ok && r.data.profile) setCurrentProfileId(r.data.profile.id);
      } else await syncProfile().catch(() => undefined);
      // The website answer survives the skip (the facts route needs the profile that now exists).
      await saveSiteFacts().catch(() => undefined);
      clearDraft();
      leave();
    } catch {
      leave();
    } finally { setBusy(""); }
  }

  /** The account's own website: only a site the person called their OWN. A brand's site (dealer) and a site
   *  they merely like live in the card facts only, so the card never prints someone else's site as theirs.
   *  When the website step was not shown this visit (?step=business), whatever was on record stays. */
  function ownSiteUrl(): string {
    const st = siteRef.current;
    if (!st.kind) return isShubhoraHost(biz.website ?? "") ? "" : cleanSiteUrl(biz.website ?? "");
    return st.kind === "own" ? cleanSiteUrl(st.url) : "";
  }

  /** The website, whose it is, the dealer's confirmation and any social link kept on the way → card facts.
   *  Nothing is written when the step was not shown. Returns true when the website or its role changed. */
  async function saveSiteFacts(): Promise<boolean> {
    const st = siteRef.current;
    if (!st.kind || moved.current) return false;
    const url = st.kind === "none" ? "" : cleanSiteUrl(st.url);
    const role = toFactsRole(st.kind);
    const facts: Record<string, unknown> = {
      website: url, websiteRole: role,
      dealerAssertedAt: st.kind === "dealer" && url ? st.assertedAt : "",
    };
    const social = Object.fromEntries(detours.filter((d) => d.key !== "map").map((d) => [d.key, d.url]));
    if (Object.keys(social).length) facts.social = social;
    await api("/api/card/facts", { method: "PATCH", json: { facts } });
    const changed = url !== siteAtLoad.current.url || (url ? role : "own") !== (siteAtLoad.current.url ? siteAtLoad.current.role : "own");
    if (changed && uid) {
      // This phone's copy of the V-Card form would otherwise show the OLD preview again, or let a stale backup
      // put the old website back over this one.
      try { localStorage.removeItem(vcardDraftKey(uid)); localStorage.removeItem(vcardFormKey(uid)); } catch { /* ignore */ }
    }
    return changed;
  }

  // "About you" asks again what the sign-up form just asked (owner's call, 25 Sep 2026: too many steps). When the
  // name, the mobile and the username are already there, setup opens on the next step; "1. About you" stays tappable
  // for the photo. you_done_at (written by step 1's Next) is the sign that step 1 was done: after a reset the name
  // and mobile stay but it is gone, and the step is shown again instead of skipped (owner, 4 Oct 2026).
  const skippedYou = useRef(false);
  useEffect(() => {
    // Not before the first look at the account is over: it may be the one that gives a new partner their ID.
    if (skippedYou.current || loading || wanted || autoSkip || username === undefined || !accountReady) return;
    skippedYou.current = true;
    // "About you" is not shown: its address is replaced by the next screen's (Back from there leaves the walk, it cannot stop on a screen never seen).
    if (step === "you" && username && you.name.trim().length >= 2 && you.phone.replace(/\D/g, "").length >= 10 && youDone) { setYouSkipped(true); go("site", "replace"); }
    // Opened at /poster/onboard with no ?step=: the screen shown gets its address now, so the browser's Back can come back to it.
    else writeStepUrl(step, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, username, accountReady]);

  // "Who is this website for?" is a partner's question. A link or a saved place that still points at it (an account that left the
  // set-up there before the question became partners-only) goes on to the website question instead of asking a shop owner about Shubhora.
  useEffect(() => {
    // After the first look at the account (a partner ID it is about to write must not send a partner on past the question).
    // The question is part of the website screen now: an old link or saved place on "promote" opens that screen.
    if (!loading && accountReady && step === "promote") go("site", "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accountReady, step, associate]);

  // The About screen promises "the AI writes them": it does so the moment the screen opens empty (the name box's
  // blur only fired when the trade was already known — type the name, then pick the trade, and nothing happened).
  useEffect(() => {
    if (step !== "about" || loading || !(biz.name ?? "").trim() || !biz.category) return;
    const empty = !(biz.about ?? "").trim();
    // A focused edit of a finished website leaves its About alone unless it is empty (the website's own text may have been edited).
    if (!empty && (editing || !aboutIsStale(biz))) return;
    const k = aboutKey(biz);
    if (autoAbout.current === k) return;
    autoAbout.current = k;
    // The About of another name or trade is cleared at once, so the owner never reads it under the new name.
    if (!empty) setBiz((b) => (aboutIsStale(b) ? { ...b, about: "", aboutMade: undefined } : b));
    void writeAbout(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loading]);
  const autoSkipped = useRef(false);
  useEffect(() => {
    if (!autoSkip || autoSkipped.current || loading) return;
    autoSkipped.current = true;
    skipForNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSkip, loading]);

  /** The screen after the last Save: Card & Website when the card is live already; the Make screen when the website
   *  supplies the products (a dealer's from the brand's site, an own site that lists them); else the Products step.
   *  A site that showed none (a JavaScript shell, a plain brochure site) still gets the products screen. */
  /** The live card no longer fits the business on this form (owner, 19 Oct 2026: the form was filled as Sharma Sweets and Card & Website still
   *  showed the Shubhora card): another business name, or Shubhora own card while the person now chose their own business. */
  function cardOutdated(): boolean {
    const lc = liveCard.current;
    if (!lc) return false;
    if (lc.kb === "shubhora" && promote !== "shubhora") return true;
    // Only a name the owner actually changed on this form makes the website again (owner, 24 Oct 2026: Back into the form and Next again
    // rebuilt a finished website — the AI's company line "Sharma Sweets & Namkeen" never matched the typed "Sharma Sweets").
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, "");
    const now = norm(biz.name ?? "");
    if (!now || now === norm(atLoad.current.name ?? "")) return false;
    return !!lc.company && !norm(lc.company).includes(now) && !now.includes(norm(lc.company));
  }
  function nextStep(): string {
    if (hadLiveCard.current) return cardOutdated() ? "/poster/card/build?again=1" : "/poster/site";
    if (site.kind === "dealer" || (site.kind === "own" && peek.state === "found" && (peek.data?.products ?? 0) > 0)) return "/poster/card/build?make=1";
    return "/poster/card/build?make=1";
  }

  /** A tab left open from before a reset (or another phone's save) must not write its old answers back over the
   *  fresh account: when the server version moved under it, the screen reloads instead of saving. */
  async function accountMoved(fresh = false): Promise<boolean> {
    // A connection that never answers must not hold the screen: no answer in 8 s counts as "not moved" (offline: let the save try).
    return (await orNull(versionMoved(fresh), 8_000)) ?? false;
  }
  async function versionMoved(fresh: boolean): Promise<boolean> {
    try {
      // A save of ours that "Next" stopped waiting for may still be on its way. It moves the version when it lands, and that must not read
      // as "changed elsewhere" (the screen reloaded and the draft was lost): it is let land first. Still not landed: the version cannot be
      // told from ours, so nothing is called moved.
      if (writing.current.size) {
        await Promise.allSettled([...writing.current]);
        if (writing.current.size) return false;
      }
      // `fresh`: a page the phone gave back from its cache asks the server itself — the answer kept from before it was left is not trusted.
      const got = fresh ? { data: { user: await freshUser() } } : await getBrowserSupabase()?.auth.getUser();
      const now = Date.parse(String(got?.data.user?.updated_at ?? "")) || 0;
      // NEWER than the version this screen holds. An answer kept from before our own server-side registration is older, not a change.
      if (serverBase.current && now && now > serverBase.current) {
        moved.current = true; draftDead.current = true;   // the answers held here are the old ones: no draft flush, no write
        setErr(T("This account was changed elsewhere (a reset, or another phone). Reloading…", "यह account कहीं और बदला गया (reset, या दूसरे phone से)। दोबारा खुल रहा है…"));
        setTimeout(() => window.location.reload(), 1200);
        return true;
      }
    } catch { /* offline: let the save try */ }
    return false;
  }

  /** One save for both steps: the poster profile + the account details. */
  async function save() {
    setErr(""); setFieldErr(null);
    const from = step;
    const phone = you.phone.replace(/\D/g, "").slice(-10);
    // A focused edit (?back=) checks only the fields on the open screen; the rest of the account stays as it is.
    const here = (k: StepKey) => !editing || step === k;
    if (!editing && you.name.trim().length < 2) { go("you"); failField("yname", T("Write your name.", "अपना नाम लिखें।")); return; }
    if (!editing && phone.length !== 10) { go("you"); failField("yphone", T("Write your 10-digit mobile number.", "10 अंकों का mobile number लिखें।")); return; }
    const phone2Digits = you.phone2.replace(/\D/g, "");
    if (phone2Digits && phone2Digits.slice(-10).length !== 10 && (!editing || step === "you")) { go("you"); failField("yphone2", T("The second number needs 10 digits — or clear it.", "दूसरा number 10 अंकों का चाहिए — या उसे ख़ाली छोड़ें।")); return; }
    const isBiz = biz.role === "business";
    const bizName = (biz.name ?? "").trim();   // any role may carry a company / brand; required only for a business
    const city = (biz.city ?? "").trim();
    // A missing answer that lives on another screen takes the owner THERE: the Save button sits on the last screen, and
    // "Choose what you do." under it, with nothing to choose from, was a dead end.
    // The message goes under the field itself (the field `k` of that screen), which is focused and scrolled to.
    const fail = (to: StepKey, k: string, msg: string) => { if (!editing) go(to); failField(k, msg); };
    // What you do decides the card, the website and the posters, so it is never left empty.
    if (here("trade") && !(biz.category ?? "").trim()) { fail("trade", "category", T("Choose what you do.", "अपना काम चुनें।")); return; }
    if (here("trade") && biz.category === "other" && !(biz.trade ?? "").trim()) { fail("trade", "trade", T("Write your trade in a few words, e.g. drone repair.", "अपना काम दो-तीन शब्दों में लिखें, जैसे drone repair।")); return; }
    if (here("trade") && isBiz && !bizName) { fail("trade", "bname", T(`Write your ${org.en} name.`, `अपने ${place} का नाम लिखें।`)); return; }
    if ((editing ? step === "where" || step === "trade" : true) && biz.role !== "personal" && !city) { fail(editing ? step : "trade", "city", T("Write your city — needed even for Pan India / online.", "अपना शहर लिखें — Pan India / online में भी चाहिए।")); return; }
    // The card, the website and every customer reply are written from this (owner's call, 4 Oct 2026: mandatory).
    // Both live on the About screen: a Save from "Photos & more" has no About box under it to scroll to, so the owner is taken there.
    // Out of the walk (owner, 24 Oct 2026): the AI writes it on its own (one more try here); only its own edit screen insists on it.
    if (!editing && biz.role !== "personal" && !(biz.about ?? "").trim() && !aboutTried.current && (biz.name ?? "").trim() && biz.category) {
      aboutTried.current = true;
      setBusy("save");
      const t = await writeAbout(true);
      setBusy("");
      if (t) { setSaveGo((n) => n + 1); return; }   // saved on the next render, with the About in it
    }
    if (editing && step === "about" && biz.role !== "personal" && !(biz.about ?? "").trim()) { fail("about", "about", T(`Write a line about your ${org.en} — or tap Write with AI.`, `अपने ${place} के बारे में एक लाइन लिखें — या AI से लिखवाएँ दबाएँ।`)); return; }
    const gst = (biz.gstin ?? "").trim().toUpperCase();
    if (step === "about" && gst && !GSTIN.test(gst)) { fail("about", "gst", T("The GST number does not look right (15 characters, e.g. 07ABCDE1234F1Z5). Leave it empty if you don't have one.", "GST number ठीक नहीं लगता (15 अक्षर, जैसे 07ABCDE1234F1Z5)। नहीं है तो खाली छोड़ें।")); return; }
    // A UPI ID that is typed but wrong is said out loud; the server would drop it and the card would go out with no Pay button.
    // Only on the screen that HAS the UPI box (this check ran on every Save, so a wrong ID could stop a Save on a screen with no
    // UPI box at all), and whether or not UPI is ticked — the box is always there now. An EMPTY ID never stops anything.
    if (step === "extras" && facts.upi.trim() && !UPI_RE.test(facts.upi.trim())) {
      setErr(T("The UPI ID does not look right (it looks like name@bank). Fix it, or tap “No UPI ID — clear it” under the box.", "UPI ID ठीक नहीं लगती (जैसे name@bank)। ठीक करें, या box के नीचे “UPI ID नहीं है — हटाएँ” दबाएँ।"));
      // Leaving the box is what shows the red line and the "clear it" button under it (a phone keeps the box focused on a Save tap).
      (document.activeElement as HTMLElement | null)?.blur?.();
      document.getElementById("q-pay")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const peekName = peek.state === "found" && peek.role === "own" ? (peek.data?.name ?? "").trim() : "";
    const nameFromSite: boolean | undefined = !peekName ? undefined : bizName.toLowerCase() === peekName.toLowerCase() ? true : touched.current.has("name") ? false : undefined;
    setBusy("save");
    if (await accountMoved()) { setBusy(""); return; }
    // Where this Save leads (and so what "Finish setup" should reopen): the Make screen or the Products step.
    const to = next || nextStep();
    try {
      const before = profile;
      const cat = categoryOf(biz.category ?? "");
      const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: {
        id: profile?.id, is_default: true,
        persona: isBiz ? (cat?.persona ?? "business") : biz.role === "personal" ? (cat?.persona && cat.persona !== "business" ? cat.persona : "personal") : biz.role === "agent" ? "business" : "professional",
        // A focused edit (UPI, photos…) of an account whose business name is empty used to stop here with "Name is required."
        name: isBiz && bizName ? bizName : (you.name.trim() || profile?.name || "My business"),
        // The trade as it stands now, not as it was when ensureProfile made the profile at the first Next.
        tagline: tradeWord() || profile?.tagline || "",
        phone, city, lang: profile?.lang ?? "hi",
        photo_url: you.photo || null, logo_url: biz.logo || null,
        category: biz.category || "", style: profileStyle(profile), mode: profile?.mode ?? "greeting", layout: profile?.layout ?? {},
      } });
      if (!r.ok || !r.data.profile) { setErr(hi ? "Save नहीं हुआ। दोबारा try करें।" : (r.data.error ?? "Could not save. Please try again.")); return; }
      setProfile(r.data.profile); setCurrentProfileId(r.data.profile.id);
      // The full business object is saved for both kinds: a solo worker also has a trade, a city and an address.
      const sb = getBrowserSupabase();
      const up = await sb?.auth.updateUser({ data: {
        // display_name is ours: Google rewrites full_name on every Google sign-in.
        full_name: you.name.trim(), display_name: you.name.trim(), phone: `+91${phone}`, photo_url: you.photo || "",
        ...(needEmail ? { contact_email: email.trim().slice(0, 120) } : {}),
        // Only in the real set-up — a focused edit of a finished account leaves the pointer alone.
        ...(back ? {} : { setup_pos: to.startsWith("/poster/card/build") ? "make" : "products" }),
        business: {
          name: bizName, role: biz.role, reach: biz.role === "personal" ? "local" : (biz.reach ?? "local"), category: biz.category || "", trade: (biz.trade ?? "").trim().slice(0, 40), gstin: gst, address: (biz.address ?? "").trim(),
          city, about: (biz.about ?? "").trim(), website: ownSiteUrl(), map: (biz.map ?? "").trim(),
          linkBy: bizName ? linkBy() : "name",
          ...madeMeta(),
          // The site's name was shown and kept → the build may keep taking the name from the site; shown and
          // corrected → the build keeps this one. Not peeked this visit → whatever was on record. Same for the
          // trade and the about text.
          ...(nameFromSite !== undefined ? { nameFromSite } : biz.nameFromSite !== undefined ? { nameFromSite: biz.nameFromSite } : {}),
          ...(peekName ? { categoryFromSite: !touched.current.has("category") && !!peek.data?.category && biz.category === peek.data.category } : biz.categoryFromSite !== undefined ? { categoryFromSite: biz.categoryFromSite } : {}),
          ...(peekName ? { aboutFromSite: !touched.current.has("about") && !!peek.data?.about && (biz.about ?? "").trim() === peek.data.about.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") } : biz.aboutFromSite !== undefined ? { aboutFromSite: biz.aboutFromSite } : {}),
        },
      } });
      if (!sb || up?.error) { setErr(T("Could not save your business details. Please try again.", "Business की जानकारी save नहीं हुई। दोबारा try करें।")); return; }
      // A result still on its way from the website must not land in the form after this point.
      peekSeq.current++;
      // Written after the profile exists (the facts route refuses before). Best effort: the build reads the
      // website from here, but the card is made either way.
      let siteChanged = false;
      try { siteChanged = await saveSiteFacts(); } catch { /* the V-Card form asks again */ }
      // Step 1's designation / WhatsApp and step 2's company details (timings, photos, payments, social…).
      try { await api("/api/card/facts", { method: "PATCH", json: { facts: { ...youFacts(), ...(factsDirty.current ? pickFacts(facts, factKeys()) : {}) } } }); } catch { /* the build form shows them again */ }
      // Keep the published V-Card in step with the setup (name, business, photo, logo, number).
      // A changed website on a live card is rebuilt below (and that publish asks first): then only the identity is
      // synced now, never the new site's about / address ahead of the owner's answer.
      const rebuilds = siteChanged && hadLiveCard.current;
      await syncCardFromSetup({
        name: you.name.trim(), business: bizName, photo: you.photo || null, logo: biz.logo || null, phone, ...(factsLoaded.current ? { whatsapp: youFacts().whatsapp, phone2: youFacts().phone2 } : {}),
        oldPhoto: before?.photo_url ?? null, oldLogo: before?.logo_url ?? null,
        ...(rebuilds ? {} : { facts: { about: (biz.about ?? "").trim(), oldAbout: atLoad.current.about, hours: facts.hours, oldHours: atLoad.current.hours, address: [(biz.address ?? "").trim(), city].filter(Boolean).join(", "), oldAddress: atLoad.current.address, map: (biz.map ?? "").trim(), ...linksSync(), banner: facts.bannerUrl, oldBanner: atLoad.current.banner, photos: facts.photos, oldPhotos: atLoad.current.photos } }),
      }).catch(() => undefined);
      clearDraft();
      if (!stillOn(from)) return;   // Back / Cancel was pressed while it saved: it is saved, and they stay where they went
      // A different website (or a different role for it) on an account that already has a live card: that card
      // is built again from the new site — ?again=1 throws the old preview away; publishing still asks first.
      if (siteChanged && hadLiveCard.current) { router.push("/poster/card/build?again=1&site=new"); return; }
      // A focused edit (Card & Website → Edit): saved, on the website, back where it came from. Replace: Back from there must not land on this finished edit form.
      if (back) { router.replace(`${back}${back.includes("?") ? "&" : "?"}saved=1`); return; }
      router.push(siteChanged && to.startsWith("/poster/card/build") ? `${to}${to.includes("?") ? "&" : "?"}site=new` : to);
    } catch {
      setErr(T("Could not save your business details. Please try again.", "Business की जानकारी save नहीं हुई। दोबारा try करें।"));
    } finally {
      setBusy("");
    }
  }

  /** The trade as a heading reads it: the owner's own words, else the list's short name in the app's language. */
  function tradeName(): string {
    const typed = (biz.trade ?? "").trim();
    if (typed) return typed;
    const part = partsLabel(biz.category, facts.tradeAnswers, hi);   // a combined trade with only some parts ticked: "Cleaning"
    if (part) return part;
    const all = partsOf(biz.category);   // a combined trade with every part (or none) ticked is all of them: "Pest control + Cleaning"
    const c = categoryOf(biz.category ?? "");
    if (all.length > 1) return !all.some((x) => x.label) ? all.map((x) => (hi ? x.hi : x.en)).join(" + ") : c ? (hi ? c.hi : c.en) : "";   // parts that name a role (makes / supplies, AC technician) read better as the whole trade
    return c && c.key !== "other" ? (hi ? c.hi : c.en).split(" / ")[0].split(" (")[0] : "";
  }
  /** The trade in the owner's own words when they typed one, else the list's name — never the word "Other". */
  function tradeWord(): string {
    const typed = (biz.trade ?? "").trim();
    if (typed) return typed;
    const c = categoryOf(biz.category ?? "");
    return c && c.key !== "other" ? c.en : "";
  }

  /* ================= the screens, one after another ================= */

  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;
  /** The poster style follows the trade: a trade other than the one the profile has takes its own style; the same
   *  trade keeps the style the profile already has. */
  function profileStyle(p: Profile | null): string {
    const cat = categoryOf(biz.category ?? "");
    return p?.style && (p.category ?? "") === (biz.category || "") ? p.style : cat?.style ?? p?.style ?? "classic";
  }
  /** The poster profile as these screens would write it now. The route PATCHes the whole row, so the full body goes
   *  every time; what the profile already has (lang, mode, layout) is kept. */
  function profileBody(p: Profile | null) {
    const digits = you.phone.replace(/\D/g, "").slice(-10);
    const cat = categoryOf(biz.category ?? "");
    const bizName = (biz.name ?? "").trim();
    return {
      ...(p ? { id: p.id } : {}), is_default: true,
      persona: biz.role === "business" ? (cat?.persona ?? "business") : biz.role === "personal" ? "personal" : biz.role === "agent" ? "business" : "professional",
      name: biz.role === "business" && bizName ? bizName : you.name.trim() || "My business", tagline: tradeWord() || p?.tagline || "", phone: digits.length === 10 ? digits : "", city: (biz.city ?? "").trim(), lang: p?.lang ?? "hi",
      photo_url: you.photo || null, logo_url: biz.logo || null, category: biz.category || "", style: profileStyle(p), mode: p?.mode ?? "greeting", layout: p?.layout ?? {},
    };
  }
  /** The create in flight: a second Next while the first still waits shares it, so there is never a second profile. */
  const creating = useRef<Promise<Profile | null> | null>(null);
  /** The poster profile the facts route needs, made the moment the name and the trade are known (screen 4), so
   *  every later screen can save its answers on the server right away; the last Save fills it in fully. */
  async function ensureProfile(): Promise<Profile | null> {
    if (profileRef.current) return profileRef.current;
    if (moved.current) return null;
    if (creating.current) return creating.current;
    creating.current = (async () => {
      const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: profileBody(null) }).catch(() => null);
      if (r?.ok && r.data.profile) { profileRef.current = r.data.profile; setProfile(r.data.profile); setCurrentProfileId(r.data.profile.id); return r.data.profile; }
      return null;
    })();
    try { return await creating.current; } finally { creating.current = null; }
  }
  /** The profile made earlier gets what the later screens corrected or added (city, logo, a fixed name or trade):
   *  before this only Save wrote them, so a Skip or the card's build read a profile with no logo and the first
   *  guess's trade. Nothing is sent when nothing differs. */
  async function syncProfile() {
    const p = profileRef.current;
    if (!p || moved.current) return;
    const body = profileBody(p);
    const same = body.persona === p.persona && body.name === p.name && body.tagline === (p.tagline ?? "") && body.phone === (p.phone ?? "") && body.city === (p.city ?? "")
      && body.photo_url === p.photo_url && body.logo_url === p.logo_url && body.category === (p.category ?? "") && body.style === (p.style ?? "classic");
    if (same) return;
    const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: body }).catch(() => null);
    if (r?.ok && r.data.profile) { profileRef.current = r.data.profile; setProfile(r.data.profile); }
  }
  /** What this screen has goes to the server before the next opens (best effort; the draft holds it either way).
   *  `nxt` — the screen about to open, remembered on the account so "Finish setup" comes back to it. */
  async function persistStep(nxt?: StepKey) {
    if (moved.current) return;
    try {
      const sb = getBrowserSupabase();
      if ((biz.category ?? "").trim() && (you.name.trim().length >= 2 || (biz.name ?? "").trim())) { if (profileRef.current) await syncProfile(); else await ensureProfile(); }
      await sb?.auth.updateUser({ data: { ...emailMeta(), business: bizMeta(), ...(nxt ? { setup_pos: nxt } : {}) } });
      await bumpServerBase();
      if (profileRef.current && factsDirty.current) await api("/api/card/facts", { method: "PATCH", json: { facts: pickFacts(facts, factKeys()) } }).catch(() => undefined);
    } catch { /* offline: the draft keeps it; Save writes it all again */ }
  }
  // "Who is this website for?" is for partners only: everyone else is simply an owner of their own business.
  const skipped: ScreenKey[] = ["promote"];
  const at = ONBOARD_SCREENS.indexOf(step);
  const screenInfo = SETUP_SCREENS.find((x) => x.key === step)!;
  /** A trade with no questions of its own (a personal card) has nothing on the Details screen: it is skipped. */
  const noDetails = () => !!biz.category && tradeQuestionsFor(biz.category).length === 0;
  /** Back: the screen the owner was just on — the walk keeps one history entry per screen, so after "Next" that is the screen before it, and
   *  after "Change" on the Make screen it is the Make screen. Only with no earlier screen in the app (a link opened fresh, a reload) does it go
   *  to the walk's own previous screen, and from the first one to the page the set-up opens from. */
  function stepBack() {
    clearMsgs();
    // The website question opened from "Photos & more → Change" goes back to where it was opened from, not to the start of the walk.
    const opener = step === "site" ? returnTo.current : null;
    returnTo.current = null;
    if (canGoBackInApp()) { router.back(); return; }
    // A screen outside the walk (Photos & more) sits after the last walk screen — its Back used to jump to "About you".
    const here = at >= 0 ? at : ONBOARD_SCREENS.length;
    let prev: StepKey | null = opener ?? (here > 0 ? ONBOARD_SCREENS[here - 1] : null);
    if (!opener && prev === "promote") prev = here > 1 ? ONBOARD_SCREENS[here - 2] : null;
    // The first screen the owner saw ("About you" was skipped for them): there is nothing before it in the walk.
    if (!prev || (prev === "you" && youSkipped)) { router.push(SETUP_HOME); return; }
    go(prev, "replace");
  }
  /** Next from the business screens: this screen's checks, its write-through, then the next screen. */
  async function goNext() {
    setErr(""); setFieldErr(null);
    const isBiz = biz.role === "business";
    if (step === "trade") {
      if (!(biz.category ?? "").trim()) { failField("category", T("Choose what you do — or type it if it is not in the list.", "अपना काम चुनें — list में न हो तो लिख दें।")); return; }
      if (biz.category === "other" && !(biz.trade ?? "").trim()) { failField("trade", T("Write your trade in a few words, e.g. drone repair.", "अपना काम दो-तीन शब्दों में लिखें, जैसे drone repair।")); return; }
      if (isBiz && !(biz.name ?? "").trim()) { failField("bname", T(`Write your ${org.en}'s name.`, `अपने ${place} का नाम लिखें।`)); return; }
      // The city is on this screen now (owner, 24 Oct 2026: "business se related sab ishi page per").
      if (biz.role !== "personal" && !(biz.city ?? "").trim()) { failField("city", T("Write your city.", "अपना शहर लिखें।")); return; }
      // The About is written by the AI while the next screen is open — there is no About screen in the walk any more.
      if ((biz.name ?? "").trim() && biz.category && (!(biz.about ?? "").trim() || aboutIsStale(biz)) && autoAbout.current !== aboutKey(biz)) {
        autoAbout.current = aboutKey(biz);
        if ((biz.about ?? "").trim()) setBiz((b) => (aboutIsStale(b) ? { ...b, about: "", aboutMade: undefined } : b));
        void writeAbout(true);
      }
    }
    if (step === "where" && biz.role !== "personal" && !(biz.city ?? "").trim()) { failField("city", T("Write your city — needed even for Pan India / online.", "अपना शहर लिखें — Pan India / online में भी चाहिए।")); return; }
    if (step === "about") {
      if (biz.role !== "personal" && !(biz.about ?? "").trim()) { failField("about", T(`Write a line about your ${org.en} — or tap Write with AI.`, `अपने ${place} के बारे में एक लाइन लिखें — या AI से लिखवाएँ दबाएँ।`)); return; }
      const gst = (biz.gstin ?? "").trim().toUpperCase();
      if (gst && !GSTIN.test(gst)) { failField("gst", T("The GST number does not look right (15 characters). Leave it empty if you don't have one.", "GST number ठीक नहीं लगता (15 अक्षर)। नहीं है तो खाली छोड़ें।")); return; }
    }
    setBusy("next");
    if (await accountMoved()) { setBusy(""); return; }
    let nxt = ONBOARD_SCREENS[Math.min(ONBOARD_SCREENS.length - 1, at + 1)];
    if (nxt === "promote") {
      // Not a partner: no question asked. Saved as "own business only" only when the server says it has no partner panel.
      if (partnerRef.current === "no") { try { await getBrowserSupabase()?.auth.updateUser({ data: { also_shubhora: false } }); } catch { /* the site step saves it again */ } }
      nxt = ONBOARD_SCREENS[Math.min(ONBOARD_SCREENS.length - 1, at + 2)];
    }
    try { await keepGoing(track(persistStep(nxt))); } finally { setBusy(""); }
    if (!stillOn(step)) return;   // Back was pressed while it saved: what they typed is kept, they are not pushed on to the next screen again
    go(nxt);
  }
  /** The screen's header: the number, the title, what it is for. */
  /** The screen's header: the title and what it is for (the bar above already counts "Step N of 11"). */
  const head = (title: string, blurb?: string, help?: HelpKey) => (
    // Inside Card / Website edit the part's own head already says this (data-embed-hide).
    <div data-embed-hide>
      <h1 className="text-xl font-bold tracking-tight">{title}{help && <Help k={help} className="translate-y-0" />}</h1>
      {blurb && <p className="text-xs text-muted">{blurb}</p>}
    </div>
  );
  /** Next / Save at the foot of a business screen, with the error above it. */
  const nextBar = (lastScreen = false) => {
    // A focused edit (?back=…) saves from any screen and returns there.
    const last = lastScreen || editing;
    return (
    <div className="space-y-2">
      {err && <p className="text-sm text-danger">{err}</p>}
      <button type="button" onClick={last ? save : goNext} disabled={busy === "save" || busy === "next"} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
        {busy === "save" || busy === "next" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : last ? <Check className="h-5 w-5" /> : null} {editing ? T("Save", "Save करें") : last ? T("Save and continue", "Save करके आगे बढ़ें") : T("Next →", "आगे →")}
      </button>
      {editing && <p className="text-center text-[11px] text-muted">{T("Save puts it on your website right away.", "Save करते ही website पर आ जाएगा।")}</p>}
      {!last && <p className="text-center text-[11px] text-muted">{T("Your answers are saved automatically. You can come back any time.", "आपके जवाब अपने आप save होते हैं। कभी भी वापस आ सकते हैं।")}</p>}
    </div>
    );
  };

  if (loading) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (loadErr) return (
    <div className="py-24 grid place-items-center">
      <button type="button" onClick={load} className="rounded-2xl border border-border px-5 py-3.5 text-sm font-semibold">{T("No internet — tap to try again", "Internet नहीं है — दोबारा try करने के लिए दबाएँ")}</button>
    </div>
  );

  // The live window on the edit screens (owner, 24 Oct 2026: "jo change kar raha hai usko sath ke sath dikhana chahiye"): the card as
  // Save would make it, from what is typed right now; photos change the card at once, so the card is read again after each.

  const liveView = liveBase && liveStep ? applySetup(liveBase, {
    name: you.name.trim(), business: (biz.name ?? "").trim(), photo: you.photo || null, logo: biz.logo || null, phone: you.phone.replace(/\D/g, "").slice(-10),
    oldPhoto: profile?.photo_url ?? null, oldLogo: profile?.logo_url ?? null,
    facts: { about: (biz.about ?? "").trim(), hours: facts.hours, address: [(biz.address ?? "").trim(), (biz.city ?? "").trim()].filter(Boolean).join(", "), map: (biz.map ?? "").trim(), ...linksSync(), banner: facts.bannerUrl, photos: facts.photos },
  }) : null;
  const liveFocus: LiveFocus = photoFocus ?? (step === "where" && (biz.address ?? "").trim() ? { text: (biz.address ?? "").trim().slice(0, 18) }
    : step === "about" && (biz.about ?? "").trim() ? { text: (biz.about ?? "").trim().slice(0, 24) } : { top: true });

  return (
    <div className="space-y-5 py-2">
      {crop && (
        <ImageCropper src={crop.src} aspect={1} outWidth={600} round={crop.kind === "photo"} format={crop.kind === "logo" ? "png" : "jpeg"}
          onApply={(d) => upload(d, crop.kind)} onCancel={() => setCrop(null)} />
      )}
      {editing ? (
      <div data-embed-hide className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1 text-xs font-semibold text-muted"><button type="button" onClick={() => { clearDraft(); goBack(router, back); }} className="-ml-1 mr-0.5 text-ink" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>{T("Edit", "बदलें")} · {step === "extras" && part === "links" ? T("UPI & social links", "UPI और social links") : step === "extras" && part === "photos" ? T("Photos & banner", "Photos और banner") : step === "details" ? T("What you offer & why people choose you", "आप क्या देते हैं और लोग आपको क्यों चुनते हैं") : hi ? screenInfo.hi : screenInfo.en}</p>
        <button type="button" onClick={() => { clearDraft(); goBack(router, back); }} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">{T("Cancel", "रहने दें")}</button>
      </div>
      ) : <>
      <ProfileSteps current={screenInfo.chapter === "you" ? "you" : "business"} category={biz.category} screen={step === "highlights" ? "details" : step} skipped={skipped} onBack={step !== "you" ? stepBack : undefined} />
      {!(next && step === "you") && <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{next ? T("Your details are needed for the card", "Card के लिए आपकी जानकारी चाहिए") : T("Setup", "सेटअप")}</p>
        {next ? (
          <span className="text-xs text-muted">{T("Fill once. The card and website are made from these.", "एक बार भरें। Card और website इन्हीं से बनते हैं।")}</span>
        ) : (
          <button type="button" onClick={skipForNow} disabled={busy === "skip"} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink disabled:opacity-60">
            {busy === "skip" ? T("Opening the app…", "App खुल रहा है…") : T("Skip for now →", "अभी छोड़ें →")}
          </button>
        )}
      </div>}
      {skipErr && <FieldErr id="skip" msg={skipErr} />}
      </>}
      {liveView && <LiveWindow card={liveView} k="onboard-live" page={step === "where" ? liveView.pages.find((pg) => !pg.hidden && pg.slug !== "home" && pg.blocks.some((b) => b.kind === "location" || b.kind === "hours"))?.slug : undefined} view={params.get("for") === "card" ? "card" : "site"} focus={liveFocus} hi={hi} />}

      {step === "promote" ? (
        <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : step === "site" ? (
        <section className="space-y-3">
          {/* One screen for "Who is this website for?" (partners only) and "Do you have a website?" (owner, 24 Oct 2026: "dono page ko mila
              kar ek"): short lines, compact tick rows, only the ticked row opens. */}
          <div><h1 className="text-xl font-bold tracking-tight">{associate ? T("Your website", "आपकी Website") : T("Do you have a website?", "क्या आपकी website है?")}<Help k="site" className="translate-y-0" /></h1>
            <p className="text-xs text-muted">{T("If you have one, we fill your details from it.", "हो तो उसी से आपकी जानकारी भर देंगे।")}</p></div>

          {associate && (
            <div className="rounded-3xl border border-border bg-surface p-3.5 shadow-card">
              <p className="mb-2 text-xs font-semibold text-muted">{T("Who is it for?", "Website किसके लिए?")}<Help k="promote" /></p>
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-surface2 p-1">
                {([
                  { k: "own" as const, icon: <Store className="h-4 w-4" />, t: T("My business", "मेरा business") },
                  // eslint-disable-next-line @next/next/no-img-element
                  { k: "shubhora" as const, icon: <img src="/art/brand/shubhora-logo.png" alt="" className="h-4 w-4 object-contain" />, t: "Shubhora" },
                  { k: "both" as const, icon: <Layers className="h-4 w-4" />, t: T("Both", "दोनों") },
                ]).map((c) => {
                  const on = promote === c.k;
                  return (
                    <button key={c.k} type="button" onClick={() => { setPromote(c.k); setErr(""); }} disabled={!!busy} aria-pressed={on}
                      className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-bold transition disabled:opacity-60 ${on ? "bg-surface text-brand-ink shadow-card ring-1 ring-brand/40" : "text-muted"}`}>
                      {c.icon}<span className="leading-tight">{c.t}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted">{promote === "shubhora" ? T("A ready Shubhora card and website with your name.", "आपके नाम से तैयार Shubhora card और website।") : promote === "both" ? T("Your own website + a separate Shubhora link.", "आपकी अपनी website + Shubhora का अलग link।") : T("Only your own business.", "सिर्फ़ आपका अपना business।")}</p>
            </div>
          )}

          {/* Three choices, one of them required (owner's call, 7 Oct 2026): "No website" is gone — a reference
              website (any business like theirs) is what someone without a site of their own picks. Not asked when the partner picks
              Shubhora only: that website is ready-made. */}
          {!(associate && promote === "shubhora") && (
          <div className="space-y-2 rounded-3xl border border-border bg-surface p-3.5 shadow-card">
          {associate && <p className="text-xs font-semibold text-muted">{T("Do you have a website?", "क्या आपकी website है?")}</p>}
          {SITE_CARDS.filter((c) => c.k !== "none").map((c) => {
            const on = site.kind === c.k;
            const bad = siteErr && !site.kind;
            const short = c.k === "own" ? T("Yes, I have my website", "हाँ, मेरी website है") : c.k === "dealer" ? T("I am a brand's dealer", "मैं किसी brand का dealer हूँ") : T("No — I'll give an example", "नहीं है — example दूँगा");
            return (
              <div key={c.k} className={`overflow-hidden rounded-2xl border transition-colors ${on ? "border-brand/50 bg-brand-soft/30" : bad ? "border-danger/60" : "border-border"}`}>
                <button type="button" onClick={() => pickSite(c.k)} disabled={!!busy} aria-pressed={on}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-60">
                  <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 ${on ? "border-brand bg-brand text-white" : "border-border-strong bg-surface"}`}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                  <span className="text-lg leading-none">{c.e}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{short}</span>
                </button>
                {on && c.k !== "none" && (
                  <div className="space-y-2 px-3 pb-3">
                    <label className="block text-xs font-semibold text-muted">
                      {c.k === "own" ? T("Your website link or name", "आपकी website का link या नाम") : c.k === "dealer" ? T("Brand's website or name", "Brand की website या नाम") : T("A website like yours (optional)", "आपके जैसी कोई website (ज़रूरी नहीं)")}<Help k="siteLink" />
                      <div className="mt-1 flex items-stretch gap-2">
                        <input value={site.url} onChange={(e) => onUrlChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void lookupTyped(true); } }} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                          placeholder={c.k === "dealer" ? T("e.g. brandname.com — or just the brand name", "जैसे brandname.com — या सिर्फ़ brand का नाम") : T(`e.g. ${egSite} — or the name`, `जैसे ${egSite} — या नाम`)} className={`${box} min-w-0 flex-1 py-2.5 text-ink ${siteErr && siteErr !== tickMsg && site.kind && !pendingSocial ? "border-danger" : ""}`} />
                        <button type="button" onClick={() => void lookupTyped(true)} disabled={!!finding || site.url.trim().length < 2} aria-label={T("Search", "खोजें")} title={T("Search", "खोजें")}
                          className="grid w-11 shrink-0 place-items-center rounded-xl grad-brand text-white disabled:opacity-50">{finding ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}</button>
                      </div>
                    </label>
                    {siteErr && siteErr !== tickMsg && !pendingSocial && <FieldErr id="site" msg={siteErr} />}
                    {finding && <p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {T(`Finding the website of "${finding}"…`, `"${finding}" की website ढूँढ रहे हैं…`)}</p>}
                    {pendingSocial ? (
                      <div id="ob-pending-social" className="rounded-xl border border-amber/50 bg-amber/10 px-3 py-2.5 text-sm">
                        <p className="font-semibold"><TriangleAlert className="mr-1 inline h-4 w-4 text-amber" />{T(`That is a ${pendingSocial.label} page, not a website.`, `ये ${pendingSocial.label} page है, website नहीं।`)} {pendingSocial.key === "map" ? T("Keep it as your map pin?", "इसे map pin की तरह रखें?") : T(`Keep it as your ${pendingSocial.label} link?`, `इसे ${pendingSocial.label} link की तरह रखें?`)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={keepSocial} className="rounded-full grad-brand px-3.5 py-1.5 text-xs font-semibold text-white">{T("Yes, keep it", "हाँ, रखें")}</button>
                          <button type="button" onClick={() => { setPendingSocial(null); setSiteErr(""); setSite((st) => ({ ...st, url: "" })); }} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold">{T("Change the link", "link बदलें")}</button>
                        </div>
                      </div>
                    ) : null}
                    {c.k === "dealer" && (
                      <div>
                        <label className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${siteErr === tickMsg ? "border-danger" : "border-border bg-surface2"}`}>
                          <input type="checkbox" checked={!!site.assertedAt} onChange={(e) => { setSiteErr(""); setSite((st) => ({ ...st, assertedAt: e.target.checked ? new Date().toISOString() : "" })); }} className="mt-0.5 h-4 w-4" />
                          <span>{T("I am this brand's authorised dealer.", "मैं इस brand का authorised dealer हूँ।")}</span>
                        </label>
                        {siteErr === tickMsg && <FieldErr id="tick" msg={siteErr} />}
                      </div>
                    )}
                    {/* …and only while it still describes the link in the box: typing a new one must not leave
                        "Found: Haldiram's" standing under a box that now says bikano.com. */}
                    {peek.state !== "idle" && peek.role === c.k && peek.url === cleanSiteUrl(site.url) && (
                      <p className={`flex items-start gap-1.5 text-xs font-semibold ${peek.state === "found" ? "text-good" : peek.state === "reading" ? "text-muted" : "text-amber"}`}>
                        {peek.state === "reading" ? <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : peek.state === "found" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                        <span>
                          {peek.state === "reading" ? T(`Reading ${hostOf(peek.url)}…`, `${hostOf(peek.url)} पढ़ रहे हैं…`)
                            : peek.state === "found" ? (c.k === "reference"
                              ? (peek.data?.category && categoryOf(peek.data.category) ? T(`Looks like a ${categoryOf(peek.data.category)!.en.toLowerCase()} website — "What do you do?" is filled from it, change it if wrong.`, `${categoryOf(peek.data.category)!.hi} की website लगती है — "आप क्या काम करते हैं?" इससे भरा, गलत हो तो बदलें।`) : T("Read for its look.", "look के लिए पढ़ ली।"))
                              : `${T("Found", "मिला")}: ${[peek.data?.name || hostOf(peek.url), c.k === "own" && peek.data?.logo ? "logo" : "", peek.data?.products ? `${peek.data.products} products` : ""].filter(Boolean).join(" · ")}`)
                            : peek.state === "empty" ? T("The site opened but was empty — write the name yourself; we read it fully when the card is built.", "website खुली पर खाली है — नाम आप लिख दें, card बनाते समय पूरी पढ़ेंगे")
                            : T("This website does not let us read it — you can go on, but nothing will come from it.", "ये website हमें पढ़ने नहीं देती — आगे बढ़ सकते हैं, पर इससे कुछ नहीं मिलेगा")}
                        </span>
                      </p>
                    )}
                    {siteAtLoad.current.url && (
                      <button type="button" onClick={() => { setSite({ kind: "reference", url: "", assertedAt: "" }); peekSeq.current++; peekFor.current = { url: "", role: "", state: "" }; setPeek(NO_PEEK); setSiteErr(""); }} className="text-xs font-semibold text-muted underline">{T("Remove this website", "ये website हटाएँ")}</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {detours.length > 0 && (
            <p className="text-xs text-muted">{T("Kept as links", "link की तरह रखा")}: {detours.map((d) => d.label).join(", ")}</p>
          )}
          {/* Only "pick one of the three" belongs down here (above Next, with the three cards just over it); every message about a link is under its box. */}
          {!site.kind && <FieldErr id="pick" msg={siteErr} />}
          </div>
          )}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={() => void nextFromSiteScreen("next")} disabled={!!busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-card disabled:opacity-70">
            {busy === "both" || busy === "own" || busy === "shubhora" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {T("Saving…", "Save हो रहा है…")}</> : busy === "next" ? (finding ? T("Looking for the website…", "Website ढूँढ रहे हैं…") : T("Saving…", "Save हो रहा है…")) : T("Next →", "आगे →")}
          </button>
          {/* Whatever goes wrong with a link — or while a name is still being looked up — the owner is never stuck: one tap carries on with no
              website (an example only). It stays tappable during the name search; only the saves that follow hold it. */}
          {!!site.kind && !(associate && promote === "shubhora") && (!!siteErr || (busy === "next" && !!finding)) && (
            <button type="button" onClick={() => void nextFromSiteScreen("without")} disabled={!!busy && !(busy === "next" && !!finding)}
              className="w-full rounded-2xl border-2 border-border bg-surface py-3.5 text-sm font-semibold disabled:opacity-60">
              {T("Carry on without a website →", "बिना website के आगे बढ़ें →")}
            </button>
          )}
        </section>
      ) : step === "you" ? (
        <section className="space-y-3">
          {/* "About you" on one screen, no scroll, a premium look (owner, 24 Oct 2026): photo + name side by side, the WhatsApp and
              second number stay closed until their box is ticked, and every line is short. */}
          {editing
            ? <h1 data-embed-hide className="text-xl font-bold">{T("Your name and mobile", "आपका नाम और मोबाइल")}</h1>
            : <div data-embed-hide><h1 className="text-xl font-bold tracking-tight">{T("About you", "आपके बारे में")}</h1><p className="text-xs text-muted">{T("Goes on your card and website.", "यही card और website पर आएगा।")}</p></div>}
          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
            <div className="flex items-center gap-3.5 bg-gradient-to-br from-brand-soft via-brand-soft/40 to-surface px-4 py-3.5">
              <label className="relative shrink-0 cursor-pointer" aria-label={T("Your photo", "आपकी photo")}>
                <span className={`grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border-[3px] border-white bg-surface2 shadow-card ${photoErr?.kind === "photo" ? "ring-2 ring-danger" : ""}`}>
                  {busy === "photo" ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : you.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={you.photo} alt="" className="h-full w-full object-cover" />
                  ) : <User className="h-8 w-8 text-muted" />}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full grad-brand text-white shadow-card"><Camera className="h-3.5 w-3.5" /></span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void choose(f, "photo"); }} />
              </label>
              <label className="block min-w-0 flex-1 text-xs font-semibold text-muted">{T("Your name", "आपका नाम")} <span className="text-danger">*</span><Help k="name" />
                <input id="ob-in-yname" value={you.name} onChange={(e) => { if (!associate) { clearFE("yname"); setYou({ ...you, name: e.target.value }); } }} readOnly={!!associate} placeholder={T("e.g. Rajesh Sharma", "जैसे Rajesh Sharma")} className={`${cField} ${associate ? "bg-surface2 text-muted" : ""} ${fe("yname") ? "border-danger" : ""}`} />
                <span className="mt-1 block text-[11px] font-normal">{associate ? T("As on your KYC", "KYC के अनुसार") : you.photo ? T("Tap the photo to change it", "photo बदलने के लिए उस पर दबाएँ") : T("Photo: tap the circle (optional)", "Photo: गोले पर दबाएँ (ज़रूरी नहीं)")}</span>
              </label>
            </div>
            {(fe("yname") || photoErr?.kind === "photo") && <div className="px-4"><FieldErr id="yname" msg={fe("yname")} /><FieldErr id="photo" msg={photoErr?.kind === "photo" ? photoErr.msg : ""} /></div>}
            <div className="space-y-2.5 px-4 pb-4 pt-3">
              <label className="block text-xs font-semibold text-muted">{T("Mobile number", "Mobile number")} <span className="text-danger">*</span><Help k="phone" />
                <input id="ob-in-yphone" value={you.phone} onChange={(e) => { clearFE("yphone"); setYou({ ...you, phone: e.target.value }); }} inputMode="tel" placeholder={T("10-digit mobile", "10 अंकों का mobile")} readOnly={phoneLocked} className={`${cField} ${phoneLocked ? "bg-surface2 text-muted" : ""} ${fe("yphone") ? "border-danger" : ""}`} />
                <FieldErr id="yphone" msg={fe("yphone")} />
              </label>
              {/* Ticked = the box opens; unticked = it stays shut (owner, 24 Oct 2026: "jab check box me click kare to field open"). */}
              <div className={`rounded-2xl border transition-colors ${!you.waSame ? "border-brand/50 bg-brand-soft/30" : "border-border"}`}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={!you.waSame} onChange={(e) => { clearFE("ywa"); setYou({ ...you, waSame: !e.target.checked }); }} className="h-[18px] w-[18px] accent-[var(--color-brand)]" />
                  <span className="flex-1">{T("WhatsApp number is different", "WhatsApp number अलग है")}</span><Help k="whatsapp" />
                </label>
                {!you.waSame && <div className="px-3 pb-3"><input id="ob-in-ywa" autoFocus value={you.whatsapp} onChange={(e) => { clearFE("ywa"); setYou({ ...you, whatsapp: e.target.value }); }} inputMode="tel" placeholder={T("WhatsApp number (10 digits)", "WhatsApp number (10 अंक)")} className={`${cField} mt-0 ${fe("ywa") ? "border-danger" : ""}`} /></div>}
                {fe("ywa") && <div className="px-3 pb-3"><FieldErr id="ywa" msg={fe("ywa")} className="mt-0" /></div>}
              </div>
              <div className={`rounded-2xl border transition-colors ${p2Open ? "border-brand/50 bg-brand-soft/30" : "border-border"}`}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={p2Open} onChange={(e) => { clearFE("yphone2"); setShowP2(e.target.checked); if (!e.target.checked) setYou({ ...you, phone2: "" }); }} className="h-[18px] w-[18px] accent-[var(--color-brand)]" />
                  <span className="flex-1">{T("Add one more number", "एक और number जोड़ें")}</span>
                </label>
                {p2Open && <div className="px-3 pb-3"><input id="ob-in-yphone2" autoFocus={showP2 && !you.phone2} value={you.phone2} onChange={(e) => { clearFE("yphone2"); setYou({ ...you, phone2: e.target.value }); }} inputMode="tel" placeholder={T("Second number (10 digits)", "दूसरा number (10 अंक)")} className={`${cField} mt-0 ${fe("yphone2") ? "border-danger" : ""}`} /><FieldErr id="yphone2" msg={fe("yphone2")} /></div>}
              </div>
              {needEmail ? (
                <label className="block text-xs font-semibold text-muted">Email <span className="font-normal">({T("optional", "ज़रूरी नहीं")})</span><Help k="email" />
                  <input id="ob-in-yemail" value={email} onChange={(e) => { clearFE("yemail"); setEmail(e.target.value.trim()); }} inputMode="email" autoCapitalize="none" spellCheck={false} placeholder={T("e.g. sharma@gmail.com", "जैसे sharma@gmail.com")} className={`${cField} ${fe("yemail") ? "border-danger" : ""}`} />
                  <FieldErr id="yemail" msg={fe("yemail")} />
                </label>
              ) : email ? (
                <p className="flex items-center gap-2 rounded-2xl bg-surface2 px-3 py-2.5 text-sm"><Mail className="h-4 w-4 shrink-0 text-muted" /><span className="min-w-0 flex-1 truncate">{email}</span><CheckCircle2 className="h-4 w-4 shrink-0 text-good" /></p>
              ) : null}
            </div>
          </div>
          {username === null && <ClaimUsername onDone={async () => { await bumpServerBase(true); return loadUsername(); }} />}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={nextFromYou} disabled={busy === "you"}
            className="w-full rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-card disabled:opacity-70">
            {busy === "you" ? T("Saving…", "Save हो रहा है…") : editing ? T("Save", "Save करें") : T("Next →", "आगे →")}
          </button>
        </section>
      ) : step === "trade" ? (
        <section className="space-y-3">
          {/* Everything about the business on one screen (owner, 24 Oct 2026): logo + name, what you do, then where it is. The link
              (sub domain) is chosen after the website is made, on the "Live" choice of the finished screen. */}
          {(() => {
            const ownPeek = site.kind === "own" && peek.role === "own" && peek.url === cleanSiteUrl(site.url) ? peek : null;
            const filled = ownPeek?.state === "found";
            return (
              <div>
                {head(T(biz.category ? `Your ${org.en}` : "Your business", biz.category ? `आपका ${org.hi}` : "आपका business"), filled
                  ? T("This came from your website — correct? Fix anything that is off.", "Website से ये मिला — सही है? गलत हो तो ठीक करें।")
                  : T("Name, work and city.", "नाम, काम और शहर।"))}
                {ownPeek && ownPeek.state !== "idle" && (
                  <p className={`mt-2 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${filled ? "bg-good/10 text-good" : ownPeek.state === "reading" ? "bg-surface2 text-muted" : "bg-amber/10 text-amber"}`}>
                    {ownPeek.state === "reading" ? <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : filled ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span>{ownPeek.state === "reading" ? T(`Reading ${hostOf(ownPeek.url)}… the fields fill in by themselves`, `${hostOf(ownPeek.url)} पढ़ रहे हैं… fields अपने आप भरेंगे`)
                      : filled ? T("Filled from your website — have a look, fix what is wrong.", "आपकी website से भरा — देख लें, गलत हो तो ठीक करें।")
                      : T("Could not read it — fill these in; the website is read again when the card is built.", "पढ़ नहीं पाए — ये भर दें; website card बनाते समय फिर पढ़ी जाएगी।")}</span>
                  </p>
                )}
                {/* Their own website stays theirs (owner, 28 Oct 2026: "AI uski website hi send kare, card me bhi uski website ka link ho"). */}
                {site.kind === "own" && !!cleanSiteUrl(site.url) && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-ai/10 px-3 py-2 text-xs text-ink">
                    <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
                    <span>{T(`${hostOf(site.url)} stays your website: a Website button on your card, and the AI sends customers this link. Change it any time in Card & Website.`, `${hostOf(site.url)} आपकी website रहेगी: card पर Website button, और AI ग्राहकों को यही link भेजेगा। बाद में Card & Website में बदल सकते हैं।`)}</span>
                  </p>
                )}
                {site.kind === "dealer" && peek.state === "found" && peek.url === cleanSiteUrl(site.url) && peek.data?.name && (
                  <p className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{T("Brand", "Brand")}: <b className="text-ink">{peek.data.name}</b>{peek.data.products ? ` · ${peek.data.products} products ${T("will come across as MRP", "MRP के साथ आएँगे")}` : ""} — {T("below, your OWN shop's name and city.", "नीचे अपनी दुकान का नाम और शहर।")}</p>
                )}
              </div>
            );
          })()}

          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <div className="flex items-start gap-3.5 bg-gradient-to-br from-brand-soft via-brand-soft/40 to-surface px-4 py-3.5">
            <label className="relative mt-1 shrink-0 cursor-pointer" aria-label={T("Logo", "Logo")}>
              <span className={`grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-[3px] border-white bg-surface2 shadow-card ${photoErr?.kind === "logo" ? "ring-2 ring-danger" : ""}`}>
                {busy === "logo" ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : biz.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={biz.logo} alt="" className="h-full w-full object-contain" />
                ) : <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Logo</span>}
              </span>
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full grad-brand text-white shadow-card"><Camera className="h-3 w-3" /></span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void choose(f, "logo"); }} />
            </label>
            <div className="min-w-0 flex-1">
          {/* 1 — the name first (owner's call, 4 Oct 2026): "Sharma Sweets" already says the trade, so the trade box below fills itself */}
          <label className="block text-sm font-semibold">
            {biz.role === "business" ? T(biz.category ? `${org.En} name` : "Business name", biz.category ? `${org.hi} का नाम` : "Business का नाम") : biz.role === "agent" ? T("Company / brand you represent", "आप किस company / brand के लिए काम करते हैं") : biz.role === "professional" ? T(`${org.En} / firm name`, `${org.hi} / firm का नाम`) : T("Company / organisation", "Company / संस्था")}
            {biz.role !== "business" && biz.role !== "agent" && <span className="font-normal text-muted"> ({T("optional", "optional")})</span>}<Help k="bizName" />
            <input id="ob-in-bname" value={biz.name ?? ""} onChange={(e) => { touch("name"); clearFE("bname"); setBiz((b) => guessTrade({ ...b, name: e.target.value })); }}
              onBlur={() => { if (!autoAbout.current && (biz.name ?? "").trim() && biz.category && guessHolds() && !(biz.about ?? "").trim()) { autoAbout.current = aboutKey(biz); void writeAbout(true); } }}
              placeholder={biz.role === "business" ? `e.g. ${egName}` : biz.role === "agent" ? T("e.g. the company or brand you represent", "जैसे जिस company / brand के लिए काम करते हैं") : T(`e.g. ${egName} — or leave empty`, `जैसे ${egName} — या खाली छोड़ें`)} className={`${cField} ${fe("bname") ? "border-danger" : ""}`} />
            <FieldErr id="bname" msg={fe("bname")} />
            {site.kind === "own" && peek.state === "found" && !!peek.data?.name && (biz.name ?? "").trim().toLowerCase() !== peek.data.name.trim().toLowerCase() && (
              <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-normal text-muted">
                <span>{T("On your website", "आपकी website पर")}: <b className="text-ink">{peek.data.name}</b></span>
                <button type="button" onClick={() => { touched.current.delete("name"); setBiz({ ...biz, name: peek.data!.name.slice(0, 80) }); }} className="font-semibold text-brand-ink underline">{T("Use this", "इसे लें")}</button>
              </span>
            )}</label>
            <span className="mt-1 block text-[11px] text-muted">{biz.logo ? T("Tap the logo to change it", "logo बदलने के लिए उस पर दबाएँ") : site.kind === "dealer" ? T("Logo: none? the brand's is used", "Logo: नहीं है? brand का लगेगा") : T("Logo: tap the box (optional)", "Logo: box पर दबाएँ (ज़रूरी नहीं)")}</span>
            </div>
          </div>
          {photoErr?.kind === "logo" && <div className="px-4"><FieldErr id="logo" msg={photoErr.msg} /></div>}
          <div className="space-y-3 px-4 pb-4 pt-3">
          {/* 2 — what you do (decides the card, the website and the posters) */}
          <div className="block text-sm font-semibold">{T("What do you do?", "आप क्या काम करते हैं?")}<Help k="trade" />
            <CategoryPicker value={biz.category ?? ""} onChange={(k) => { touch("category"); clearFE("category"); changeTrade(k); setBiz((b) => ({ ...withCategory(b, k), trade: "" })); }} placeholder={T("Choose your type of business", "अपना काम चुनें")}
              custom={biz.trade ?? ""} onCustom={(text) => { touch("category"); clearFE("category"); const k = exactCategory(text) || "other"; changeTrade(k); setBiz((b) => ({ ...withCategory(b, k), trade: text.trim().slice(0, 40) })); }} />
            {/* Never the picker's fuzzy "nearest", nor matchCategory's single word hit ("Drone repair" → mobile, by the
                alias "repair"; the details screen then asked mobile-shop questions — owner, 5 Oct 2026): only the
                whole text naming a listed trade leaves "other". */}
            {/* "Other" from the list: the trade in the owner's own words, kept as typed — it names the website, the
                card and the AI's brief (owner, 5 Oct 2026: typed text vanished; a card said "Other"). */}
            <FieldErr id="category" msg={fe("category")} />
            {biz.category === "other" && (
              <label className="mt-2 block text-sm font-semibold">{T("Your trade, in your words", "आपका काम, अपने शब्दों में")} <span className="text-danger">*</span>
                <input id="ob-in-trade" value={biz.trade ?? ""} onChange={(e) => { touch("category"); clearFE("trade"); setBiz((b) => ({ ...b, trade: e.target.value.slice(0, 40) })); }} placeholder={T("e.g. drone repair, tiffin service, event anchor", "जैसे drone repair, tiffin service, event anchor")} className={`${cField} ${fe("trade") ? "border-danger" : ""}`} />
                <FieldErr id="trade" msg={fe("trade")} />
                <span className="mt-1 block text-[11px] font-normal text-muted">{T("The website and card are written for exactly this.", "Website और card ठीक इसी के लिए लिखे जाएँगे।")}</span>
              </label>
            )}
            {!touched.current.has("category") && !!biz.category && (
              (site.kind === "own" || site.kind === "dealer" || site.kind === "reference") && peek.state === "found" && biz.category === peek.data?.category
                ? <span className="mt-1 block text-[11px] font-normal text-muted">{site.kind === "reference" ? T("Guessed from the website you like — change it if wrong.", "आपकी पसंद की website से अंदाज़ा — गलत हो तो बदलें।") : T("Guessed from your website — change it if wrong.", "website से अंदाज़ा — गलत हो तो बदलें।")}</span>
                : !!biz.guessed && biz.category === biz.guessed
                ? <span className="mt-1 block text-[11px] font-normal text-muted">{T("Guessed from your name — change it if wrong.", "आपके नाम से अंदाज़ा — गलत हो तो बदलें।")}</span>
                : null
            )}
          </div>

          {(() => { const r = ROLES.find((x) => x.k === biz.role) ?? ROLES[0]; return (
            <div className="-mt-2 rounded-xl bg-surface2 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-muted">{T("Card type", "Card का प्रकार")}: <b className="text-ink">{hi ? r.th : r.t}</b><Help k="role" /></span>
                <button type="button" onClick={() => setShowRole((v) => !v)} className="shrink-0 font-semibold text-brand-ink">{showRole ? T("Done", "ठीक है") : T("Change", "बदलें")}</button>
              </div>
              {showRole && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ROLES.map((x) => (
                    <button key={x.k} type="button" onClick={() => { setBiz({ ...biz, role: x.k, kind: x.k === "business" ? "business" : "person", roleTouched: true, reach: biz.reachTouched ? biz.reach : reachOf(x.k, biz.category ?? "") }); setShowRole(false); }}
                      className={`rounded-xl border-2 bg-surface p-2.5 text-left ${biz.role === x.k ? "border-brand bg-brand-soft" : "border-border"}`}>
                      <span className="block text-sm font-semibold"><span className="mr-1.5">{x.e}</span>{hi ? x.th : x.t}</span>
                      <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted">{hi ? x.sh : x.s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ); })()}

            </div>
          </div>

          {/* 3 — where it is: the city (needed), the address and the map pin (owner, 24 Oct 2026: "business name ke baad city aur address"). */}
          <div className="space-y-2.5 rounded-3xl border border-border bg-surface p-4 shadow-card">
            <p className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-brand" /> {T("Where is it?", "कहाँ है?")}</p>
            <label className="block text-xs font-semibold text-muted">{T("City", "शहर")}{biz.role !== "personal" && <span className="text-danger"> *</span>}<Help k="city" />
              <input id="ob-in-city" value={biz.city ?? ""} onChange={(e) => { touch("city"); clearFE("city"); setBiz({ ...biz, city: e.target.value }); }} placeholder={T("e.g. Delhi", "जैसे Delhi")} className={`${cField} ${fe("city") ? "border-danger" : ""}`} />
              <FieldErr id="city" msg={fe("city")} /></label>
            <label className="block text-xs font-semibold text-muted">{T("Full address", "पूरा पता")} <span className="font-normal">({T("optional", "ज़रूरी नहीं")})</span><Help k="address" />
              <input value={biz.address ?? ""} onChange={(e) => { touch("address"); setBiz({ ...biz, address: e.target.value }); }} placeholder={T("Shop no., street, area", "Shop no., गली, इलाका")} className={cField} /></label>
            {biz.map ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-xs font-semibold text-good">
                <CheckCircle2 className="h-4 w-4" /> <span className="flex-1">{T("Pinned on the map", "Map पर pin हो गया")}</span>
                <button type="button" onClick={pinShop} disabled={busy === "pin"} className="underline disabled:opacity-60">{busy === "pin" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : T("Pin again", "फिर से")}</button>
                <button type="button" onClick={() => { setPinErr(""); setBiz({ ...biz, map: "" }); }} className="text-muted underline">{T("Remove", "हटाएँ")}</button>
              </div>
            ) : (
              <button type="button" onClick={pinShop} disabled={busy === "pin"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand-soft/30 px-3 py-2.5 text-sm font-semibold text-brand-ink disabled:opacity-60">
                {busy === "pin" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} {T("At my shop — pin it on the map", "दुकान पर हूँ — map पर pin करें")}
              </button>
            )}
            {pinErr && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{pinErr}</p>}
            {(!biz.map || !!pinErr) && (mapPaste.open ? (
              <div className="space-y-1">
                <input value={mapPaste.value} onChange={(e) => pasteMapLink(e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={T("Paste your Google Maps link", "अपना Google Maps link paste करें")} className={cField} />
                {mapPaste.bad && <p className="text-xs font-semibold text-danger">{T("That is not a Google Maps link.", "ये Google Maps link नहीं है।")}</p>}
              </div>
            ) : (
              <button type="button" onClick={() => setMapPaste((m) => ({ ...m, open: true }))} className="text-xs font-semibold text-muted underline underline-offset-2">{T("Or paste a Google Maps link", "या Google Maps link paste करें")}</button>
            ))}
          </div>
          {nextBar()}
        </section>
      ) : step === "details" || step === "highlights" ? (
        <section className="space-y-4">
          {/* One screen for "about your trade" and "why customers choose you" (owner, 14 Oct 2026: fewer steps). A trade with no questions of its own shows only the second part. */}
          {noDetails()
            ? head(T("Why do customers choose you?", "ग्राहक आपको क्यों चुनते हैं?"), T("Tap what is true. This goes on your website.", "जो सही है वो दबाएँ। यही आपकी website पर दिखेगा।"))
            : head(T(`About your ${tradeName() || org.en}`, `आपके ${tradeName() || place} के बारे में`), T("Tap what is true. Skip the rest.", "जो सही है वो दबाएँ। बाकी छोड़ दें।"))}
          {!!biz.category && !noDetails() && <TradeQuestions category={biz.category} facts={facts} setF={setF} hi={hi} tradeLabel={tradeName() || undefined} title={false} />}
          {/* Only what the AI cannot guess (owner, 24 Oct 2026: "jitana kam se kaam chal sake utana kam data"): "Who buys from you" goes (the AI
              works it out from the trade), and "Any offer?" is added later from Card & Website → Offer / pop-up. */}
          <FactsFields group="products" only={["q-special"]} category={biz.category} facts={facts} setF={setF} hi={hi} hasAbout />
          {/* What the old "Where & when" and "About & logo" screens asked beyond the basics, closed until ticked (owner, 24 Oct 2026). */}
          {!editing && ([
            { k: "hours" as const, t: T("Add opening hours / delivery", "खुलने का समय / delivery जोड़ें"), body: <FactsFields group="company" only={["q-hours", "q-delivery"]} category={biz.category} facts={facts} setF={setF} hi={hi} professional={biz.role === "professional"} role={biz.role} hasAbout={!!(biz.about ?? "").trim()} /> },
            { k: "more" as const, t: T("Add more (since when, post, degree)", "और जानकारी (कब से, पद, degree)"), body: <FactsFields group="company" only={biz.role === "personal" ? ["q-designation"] : ["q-since", "q-designation", "q-qual"]} category={biz.category} facts={facts} setF={setF} hi={hi} professional={biz.role === "professional"} role={biz.role} hasAbout={!!(biz.about ?? "").trim()} /> },
          ]).map((x) => {
            const on = extraOpen[x.k];
            return (
              <div key={x.k} className={`rounded-2xl border transition-colors ${on ? "border-brand/50 bg-brand-soft/20" : "border-border bg-surface"}`}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3.5 py-3 text-sm font-semibold">
                  <input type="checkbox" checked={on} onChange={(e) => setExtraOpen((o) => ({ ...o, [x.k]: e.target.checked }))} className="h-[18px] w-[18px] accent-[var(--color-brand)]" />
                  <span className="flex-1">{x.t}</span>
                </label>
                {on && <div className="px-3.5 pb-3.5">{x.body}</div>}
              </div>
            );
          })}
          {nextBar(true)}
        </section>
      ) : step === "where" ? (
        <section className="space-y-3">
          {head(T("Where & when", "कहाँ और कब"), T("City, address, map and timings.", "शहर, पता, map और समय।"))}
          {/* 3 — city */}
          <label className="block text-sm font-semibold">{T(`${org.En} city`, `${place} का शहर`)} <span className="text-danger">*</span><Help k="city" /><input id="ob-in-city" value={biz.city ?? ""} onChange={(e) => { touch("city"); clearFE("city"); setBiz({ ...biz, city: e.target.value }); }} placeholder={T("e.g. Delhi", "जैसे Delhi")} className={`${cField} ${fe("city") ? "border-danger" : ""}`} /><FieldErr id="city" msg={fe("city")} /></label>
          <div className="space-y-3">
              <label className="block text-sm font-semibold">{T("Full address", "पूरा पता")}<Help k="address" /><input value={biz.address ?? ""} onChange={(e) => { touch("address"); setBiz({ ...biz, address: e.target.value }); }} placeholder={T("Shop no., street, area", "Shop no., गली, इलाका")} className={cField} /></label>
              {biz.map ? (
                <>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm font-semibold text-good">
                  <CheckCircle2 className="h-4 w-4" /> <span>{T("Pinned on the map", "Map पर pin हो गया")}</span>
                  <a href={biz.map} target="_blank" rel="noreferrer" className="underline">{T("Open", "खोलें")}</a>
                  <button type="button" onClick={pinShop} disabled={busy === "pin"} className="inline-flex items-center gap-1 underline disabled:opacity-60">{busy === "pin" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}{T("Pin again", "फिर से pin करें")}</button>
                  <button type="button" onClick={() => { setPinErr(""); setBiz({ ...biz, map: "" }); }} className="underline text-muted">{T("Remove", "हटाएँ")}</button>
                </div>
                <p className="-mt-1 text-xs text-muted">{T("To move the pin: stand at your shop and tap “Pin again”.", "pin बदलनी हो तो अपनी दुकान पर खड़े होकर “फिर से pin करें” दबाएँ।")}</p>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={pinShop} disabled={busy === "pin"} className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-semibold disabled:opacity-60">
                    {busy === "pin" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-brand" />} {T("I am at my shop — pin it on the map", "मैं अपनी दुकान पर हूँ — map पर pin करें")}
                  </button>
                  <Help k="map" />
                </div>
              )}
              {pinErr && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{pinErr}</p>}
              {/* "Pin again" that could not read the position says "paste a link below": the box is there too, though a pin exists. */}
              {(!biz.map || !!pinErr) && (mapPaste.open ? (
                <div className="space-y-1">
                  <input value={mapPaste.value} onChange={(e) => pasteMapLink(e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={T("Paste your Google Maps link", "अपना Google Maps link paste करें")} className={cField} />
                  <p className={`text-xs ${mapPaste.bad ? "font-semibold text-danger" : "text-muted"}`}>{mapPaste.bad ? T("Not a Google Maps link. Maps → Share → Copy link.", "ये Google Maps link नहीं है। Maps → Share → Copy link।") : T("Google Maps → your shop → Share → Copy link.", "Google Maps → आपकी दुकान → Share → Copy link।")}</p>
                </div>
              ) : (
                <button type="button" onClick={() => setMapPaste((m) => ({ ...m, open: true }))} className="text-xs font-semibold text-brand-ink underline underline-offset-2">{T("Or paste a Google Maps link", "या Google Maps link paste करें")}</button>
              ))}
          </div>
          <div className="space-y-4">
              {biz.role !== "personal" && (
                <div>
                  <p className="text-sm font-semibold">{T("Where do you serve customers?", "आप कहाँ तक service देते हैं?")}<Help k="reach" /></p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {REACH.map((r) => (
                      <button key={r.k} type="button" onClick={() => setBiz({ ...biz, reach: r.k, reachTouched: true })}
                        className={`rounded-xl border-2 p-2.5 text-left ${(biz.reach ?? "local") === r.k ? "border-brand bg-brand-soft" : "border-border"}`}>
                        <div className="text-lg leading-none">{r.e}</div>
                        <div className="mt-1 text-xs font-semibold leading-tight">{hi ? r.th : r.t}</div>
                        <div className="mt-0.5 text-[10px] leading-tight text-muted">{hi ? r.sh : r.s}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
          {/* The areas question is gone (owner's call, 7 Oct 2026): the city is asked right here, and "where you serve" above says how far. */}
          <FactsFields group="company" only={["q-hours", "q-delivery"]} category={biz.category} facts={facts} setF={setF} hi={hi} professional={biz.role === "professional"} role={biz.role} hasAbout={!!(biz.about ?? "").trim()} />
          {nextBar(true)}
        </section>
      ) : step === "about" ? (
        <section className="space-y-3">
          {head(T("About & logo", "परिचय और logo"), T("AI writes it. Change what you like.", "AI लिखता है। जो चाहें बदलें।"))}
          {/* 4 — about (the AI writes it) */}
          <div className="block text-sm font-semibold">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="about">{T(`About your ${org.en}`, `आपके ${place} के बारे में`)} <span className="font-normal text-danger">*</span><Help k="about" /></label>
              <button type="button" onClick={() => writeAbout()} disabled={busy === "about"} className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60">
                {busy === "about" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {biz.about?.trim() ? T("Improve with AI", "AI से बेहतर करें") : T("Write with AI", "AI से लिखवाएँ")}
              </button>
            </div>
            {aboutErr && <FieldErr id="aboutai" msg={aboutErr} />}
            <textarea id="about" value={biz.about ?? ""} onChange={(e) => { touch("about"); clearFE("about"); setAboutErr(""); const v = e.target.value; setBiz({ ...biz, about: words(v) > ABOUT_MAX_WORDS ? v.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") : v, aboutMade: undefined }); }} rows={4}
              placeholder={T(`A few words is enough — e.g. “${copy.aboutEg}” — then tap Write with AI.`, `थोड़े शब्द काफ़ी हैं — जैसे “${copy.aboutEgHi}” — फिर AI से लिखवाएँ दबाएँ।`)} className={`${cField} ${fe("about") ? "border-danger" : ""}`} />
            <FieldErr id="about" msg={fe("about")} />
            <span className="mt-1 flex justify-between gap-2 text-xs font-normal text-muted">
              <span>{T("Used on your card and website.", "Card और website पर यही जाएगा।")}</span>
              <span className={`shrink-0 tabular-nums ${words(biz.about ?? "") >= ABOUT_MAX_WORDS ? "text-amber" : ""}`}>{words(biz.about ?? "")}/{ABOUT_MAX_WORDS}</span>
            </span>
          </div>
          {(biz.role === "business" || !!(biz.name ?? "").trim()) && <div><div className="flex items-center"><Photo url={biz.logo} label={biz.role === "business" ? T("your logo", "अपना logo") : T("company / brand logo", "company / brand logo")}
            hint={site.kind === "dealer" ? T("none? the brand's logo is used", "नहीं है? brand का logo लगेगा") : T("if you have one", "अगर है तो")} busy={busy === "logo"} onPick={(f) => choose(f, "logo")} hi={hi} /><Help k="logo" /></div>
            <FieldErr id="logo" msg={photoErr?.kind === "logo" ? photoErr.msg : ""} /></div>}
          {site.kind === "dealer" && !biz.logo && !!peek.data?.logo && <p className="-mt-2 text-xs text-muted">{T(`Using ${peek.data?.name || "the brand"}'s logo for now.`, `अभी ${peek.data?.name || "brand"} का logo लगेगा।`)}</p>}
          <FactsFields group="company" only={biz.role === "personal" ? ["q-designation"] : ["q-since", "q-designation", "q-qual"]} category={biz.category} facts={facts} setF={setF} hi={hi} professional={biz.role === "professional"} role={biz.role} hasAbout={!!(biz.about ?? "").trim()} />
              {(biz.role === "business" || biz.role === "agent") && <label className="block text-sm font-semibold">{T("GST number", "GST number")} <span className="font-normal text-muted">({T("if you have one", "अगर है तो")})</span><Help k="gst" /><input id="ob-in-gst" value={biz.gstin ?? ""} onChange={(e) => { clearFE("gst"); setBiz({ ...biz, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15) }); }} inputMode="text" autoCapitalize="characters" spellCheck={false} placeholder="07ABCDE1234F1Z5" className={`${cField} uppercase tracking-wide ${fe("gst") ? "border-danger" : ""}`} />
                <span className="mt-1 block text-xs font-normal text-muted">{(biz.gstin ?? "").length}/15</span><FieldErr id="gst" msg={fe("gst")} /></label>}
          {nextBar(true)}
        </section>
      ) : (
        <section className="space-y-3">
          {/* Two edit tiles share this screen: ?part=photos (the pictures) and ?part=links (payments, social, Maps); the set-up shows both. */}
          {head(editing && part === "photos" ? T("Photos & banner", "Photos और banner") : editing && part === "links" ? T("Payments & social links", "Payment और social links") : T("Photos & more", "Photos और बाकी"), editing && part === "photos" ? T("Every picture on your website.", "आपकी website की हर picture।") : editing && part === "links" ? T("UPI and social links. All optional.", "UPI और social links। सब ज़रूरी नहीं।") : T("All optional.", "सब ज़रूरी नहीं।"))}
          {/* A focused edit shows the photos that are on the website, one by one; the set-up (no website yet) asks for the banner and photos. */}
          {editing && part !== "links" && <SitePhotos hi={hi} cardId={params.get("card") ?? undefined} scope={params.get("for") === "card" ? "card" : params.get("for") === "site" ? "site" : undefined}
            onChanged={(slot) => {
              // A gallery photo (or one just added): the Photos section; anything else (the banner, the logo): the top.
              const gTitle = (liveBase?.pages.flatMap((pg) => pg.blocks).find((b: CardBlock) => b.kind === "gallery") as { title?: string } | undefined)?.title?.trim();
              setPhotoFocus(!slot || slot.startsWith("gallery:") ? (gTitle ? { text: gTitle } : { top: true }) : { top: true });
              setLiveVer((n) => n + 1);
            }} />}
          {!(editing && part === "photos") && <FactsFields group="company" only={editing ? ["q-pay", "q-social"] : ["q-photos", "q-pay", "q-social"]} category={biz.category} facts={facts} setF={setF} hi={hi} professional={biz.role === "professional"} role={biz.role} hasAbout={!!(biz.about ?? "").trim()} />}
          {!editing && <div className="space-y-3 rounded-2xl border border-border p-4">
              {/* The website is asked on its own step; here it is only shown, with one way back to change it. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Globe className="h-4 w-4 shrink-0 text-muted" />
                <span className="font-semibold">Website:</span><Help k="site" />
                {site.kind && site.kind !== "none" && site.url
                  ? <span className="min-w-0 truncate text-muted">{hostOf(site.url)} · {site.kind === "own" ? T("my own", "मेरी अपनी") : site.kind === "dealer" ? T("the brand's (dealer)", "brand की (dealer)") : T("for its look", "look के लिए")}</span>
                  : ownSiteUrl()
                  ? <span className="min-w-0 truncate text-muted">{hostOf(ownSiteUrl())} · {T("my own", "मेरी अपनी")}</span>
                  : <span className="text-muted">{T("none", "नहीं है")}</span>}
                <button type="button" onClick={() => { setSiteErr(""); returnTo.current = "extras"; go("site"); }} className="font-semibold text-brand-ink underline">{T("Change", "बदलें")}</button>
              </div>
          </div>}
          {editing && part === "photos"
            ? <button type="button" onClick={() => { clearDraft(); goBack(router, back); }} className="w-full rounded-2xl grad-brand py-4 text-base font-semibold text-white">{T("Done", "हो गया")}</button>
            : nextBar(true)}
        </section>
      )}
    </div>
  );
}

// The Shubhora plans (Free, Standard, Premium, Custom Solutions) as products (same as "Shubhora seller card banao" on My products).
const SHUBHORA_PRODUCTS = [
  { name: "Shubhora AI Business Assistant — Standard", price: "2,999 / month", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-growth.jpg", photos: [{ url: "/api/stock/vcard/plan-growth.jpg", view: "front", role: "identity" }], offer: "Pre-launch: join free", benefits: ["Digital business card + Standard website (up to 5 pages)", "With a sub-domain address, no Shubhora tag", "Daily poster on Facebook, Instagram and WhatsApp Status", "Meta Ads, AI Ad Studio and Reel Maker", "WhatsApp AI assistant answers customers and filters leads", "Google reviews and Google Business posts", "12 Indian languages; 1,000 WhatsApp AI replies a month"] },
  { name: "Shubhora Premium — Website + Google SEO", price: "5,999 first month only", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-growth.jpg", photos: [{ url: "/api/stock/vcard/plan-growth.jpg", view: "front", role: "identity" }], offer: "Then ₹2,999 a month, one autopay", benefits: ["Everything in Standard", "Premium website: a page for every product and service", "Google SEO: every page and product on Google", "Try up to 3 layouts and keep the one you like", "Standard customers pay only the ₹3,000 difference"] },
  { name: "Shubhora Custom Solutions — Software & Automation", price: "On request — contact us", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-pro.jpg", photos: [{ url: "/api/stock/vcard/plan-pro.jpg", view: "front", role: "identity" }], offer: "Every kind of software and automation. Tell us what you need", benefits: ["A manager from Shubhora just for you", "Software, apps and websites built for you", "Shubhora set up the way your business works", "Daily work done by itself: WhatsApp, follow-ups, billing, reports", "Your own CRM and business software, with logins for your team", "Screens that show your numbers", "AI assistants and chat bots taught about your business", "Works with online payments, Tally, Google Sheets and your tools", "More brands and branches on one account", "Price on request, quoted per requirement"] },
  { name: "Free Digital Business Card", price: "FREE for 1 year (worth ₹1,499)", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-free.jpg", photos: [{ url: "/api/stock/vcard/plan-free.jpg", view: "front", role: "identity" }], offer: "", benefits: ["Digital business card on one link", "Made by AI in 5 minutes from your details", "Share on WhatsApp or with a QR code", "People contact you directly from the card", "Free for 1 year, then ₹1,499 a year"] },
];

/** The business as "Selling Shubhora as a partner" sets it (promoteShubhora): Shubhora, network marketing. Choosing one's own business after that
 *  must not start the form with Shubhora's name, trade and logo in it (owner, 19 Oct 2026). */
const isPartnerBiz = (b: { name?: string; category?: string } | null | undefined) => !!b && /^shubhora$/i.test((b.name ?? "").trim()) && (b.category ?? "") === "mlm";
const freshBiz = { kind: "business" as const, role: "business" as const, name: "", category: "", city: "", logo: null, about: "", website: "", address: "", map: "", gstin: "" };

export default function OnboardPage() {
  return <Suspense><Onboard /></Suspense>;
}
