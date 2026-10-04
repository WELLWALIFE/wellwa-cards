"use client";

// The setup journey, one simple screen each (owner's call, 1 Oct 2026: the person should type as little as possible):
//   0. About you      — name, mobile, photo; skipped when sign-up already gave them
//   1. Card for what  — own business / sell Shubhora / both (one tap)
//   2. Website?       — own / a brand's (dealer) / one they like / none — asked FIRST, because a site they have
//                       fills the next screen for them (name, logo, about, city, trade), read while they look on
//   3. Your business  — confirm what the site gave, or type the three things a card cannot do without
// Saved once, used everywhere: the poster profile (posters, card, website), the account (the AI reads "about")
// and the card facts (the website and whose it is).
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, CheckCircle2, ChevronDown, Globe, Layers, LoaderCircle, MapPin, Search, Sparkles, Store, TriangleAlert } from "lucide-react";
import { api, authHeaders, isLoggedIn, setCurrentProfileId, uploadImage, type Profile } from "@/lib/poster-client";
import { dataUrlToFile } from "@/lib/image-utils";
import { ImageCropper } from "@/components/editor/image-cropper";
import { CategoryPicker } from "@/components/category-picker";
import { syncCardFromSetup, loadOwnDetails, personalize } from "@/lib/card-personalize";
import { getTemplate } from "@/lib/templates";
import { fetchMyCardsStrict, nameSlug, publishCard, suggestUsername } from "@/lib/cloud";
import { SITE_HOST } from "@/lib/site-url";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { categoryOf } from "@/lib/poster-categories";
import { matchCategory } from "@/lib/category-match";
import type { Business } from "@/lib/journey";
import { ClaimUsername } from "@/components/poster/claim-username";
import { useT } from "@/lib/poster-i18n";
import { useAssociate } from "@/lib/associate";
import { ProfileSteps } from "@/components/poster/profile-steps";
import { usernameOk, INTRODUCER_KEY, INTRODUCER_LEG_KEY } from "@/lib/username";
import { dropStaleLocal } from "@/lib/local-reset";
import { normalizeFacts, vcardDraftKey, vcardFormKey, type CardFacts, type FactsResponse } from "@/lib/card-facts";
import { COMPANY_FACT_KEYS, FactsFields, pickFacts, type FactsPatch } from "@/components/poster/facts-fields";
import { catalogCopyFor, exampleNameFor, exampleSiteFor, orgWordFor } from "@/lib/catalog-copy";
import { TradeQuestions } from "@/components/poster/trade-questions";
import { SITE_CARDS, cleanSiteUrl, hostOf, isShubhoraHost, looksLikeSite, socialDetour, toFactsRole, type SiteKind } from "@/lib/site-role";

const box = "rounded-xl border border-border bg-surface px-3.5 py-3 text-base font-normal";
const field = `mt-1 w-full ${box}`;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ABOUT_MAX_WORDS = 150;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** Mobile sign-ups get a made-up address like 919812345678@phone.shubhora.com — they have no real email. */
const IS_PHONE_EMAIL = /@phone\./i;
const LOCATION_OFF = "Location is off. Turn it on, or paste your Google Maps link later.";
/** The website step's answer. kind "" = nothing chosen yet; the step insists on one, so a link never exists
 *  without a role (a pasted link silently treated as "own" would import a stranger's name and products). */
type SiteState = { kind: SiteKind | ""; url: string; assertedAt: string };
/** What /api/site/peek learned from the home page. */
type PeekData = { url: string; name: string; logo?: string; about?: string; city?: string; address?: string; phone?: string; products: number; category?: string; empty?: boolean };
type PeekState = { state: "idle" | "reading" | "found" | "unreadable" | "empty"; url: string; role: "own" | "dealer" | "reference"; data: PeekData | null };
const NO_PEEK: PeekState = { state: "idle", url: "", role: "own", data: null };
/** The one social / maps link that was pasted as a "website" and kept as what it is. */
type Detour = { key: "instagram" | "facebook" | "youtube" | "map"; url: string; label: string };

function Photo({ url, label, hint, round, busy, onPick }: { url?: string | null; label: string; hint: string; round?: boolean; busy: boolean; onPick: (f: File) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <span className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden border-2 border-dashed border-border bg-surface2 ${round ? "rounded-full" : "rounded-2xl"}`}>
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`h-full w-full ${round ? "object-cover" : "object-contain"}`} />
        ) : <Camera className="h-6 w-6 text-muted" />}
      </span>
      <span className="text-sm font-semibold text-brand-ink">{url ? `Change ${label}` : `Add ${label}`}
        <span className="block text-xs font-normal text-muted">Optional · {hint}</span></span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
    </label>
  );
}

function Onboard() {
  const router = useRouter();
  const params = useSearchParams();
  type StepKey = "you" | "promote" | "site" | "business";
  const [step, setStep] = useState<StepKey>(params.get("step") === "business" ? "business" : params.get("step") === "site" ? "site" : "you");
  // A partner's name is what their KYC says: shown, never edited here.
  const associate = useAssociate();
  const wanted = params.get("step");
  // ?next=/poster/card/build — the card (or another tool) needs these details first: no skip, and "Save" returns there.
  const next = (params.get("next") ?? "").startsWith("/") ? params.get("next")! : "";
  // ?skip=1 — the plan page's Skip: create the minimal profile and open the app without showing the form.
  const autoSkip = params.get("skip") === "1";
  // ?back=/poster/more — an EDIT of name / mobile / photo (Me → "Edit name / mobile"): only "About you", a Save
  // button, and straight back there afterwards (owner's call, 26 Sep 2026).
  const back = (params.get("back") ?? "").startsWith("/") ? params.get("back")! : "";
  const editing = !!back;
  useEffect(() => { if (wanted === "you" || wanted === "business" || wanted === "promote" || wanted === "site") setStep(wanted); }, [wanted]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  // Step 1 "About you": name, mobile, WhatsApp (same as the mobile unless unticked), email, photo, city and address.
  const [you, setYou] = useState({ name: "", phone: "", photo: "" as string | null, whatsapp: "", waSame: true, city: "", address: "" });
  // The profile's detail answers (card facts): step 1 adds the designation / WhatsApp, step 2 the company details.
  // Loaded with the account, saved with "Save and continue" (the facts route needs the profile to exist first).
  const [facts, setFacts] = useState<CardFacts>(() => normalizeFacts({}));
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
    role === "agent" || /^(courier|transport|manufacturer|wholesale|distributor|textile|pharma|agri)$/.test(catKey) ? "india" : /^(it|influencer|astro)$/.test(catKey) ? "online" : "local";
  const [biz, setBiz] = useState<Business & { logo?: string | null; kind: "business" | "person"; role: Role; roleTouched?: boolean; reachTouched?: boolean; linkBy?: "name" | "business" }>({ kind: "business", role: "business", reach: "local" });
  /** The card link the owner picked — or, untouched, the business name for a shop and the person's name otherwise. */
  const linkBy = (): "name" | "business" => biz.linkBy ?? (biz.role === "business" && (biz.name ?? "").trim() ? "business" : "name");
  const [uid, setUid] = useState("");
  // ---- the website step ----
  const [site, setSite] = useState<SiteState>({ kind: "", url: "", assertedAt: "" });
  const [siteErr, setSiteErr] = useState("");
  const [peek, setPeek] = useState<PeekState>(NO_PEEK);
  /** A peek that comes back after a newer one started, or after Save, is thrown away. */
  const peekSeq = useRef(0);
  /** The read in flight (or last finished), so a blur followed by Next does not start the same read twice. */
  const peekFor = useRef({ url: "", role: "", state: "" });
  /** Fields the person typed into: a late peek result never writes over them. */
  const touched = useRef(new Set<string>());
  /** The trade the business name suggested (not the owner's own pick, and not the website's). */
  const guessedTrade = useRef("");
  /** A social / maps link pasted as the website, waiting for "keep it as that?" */
  const [pendingSocial, setPendingSocial] = useState<Detour | null>(null);
  const [detours, setDetours] = useState<Detour[]>([]);
  /** The website and role as stored when the screen opened — a change means the card must be built again. */
  const siteAtLoad = useRef({ url: "", role: "own" });
  const hadLiveCard = useRef(false);
  const [youSkipped, setYouSkipped] = useState(false);
  /** "About your business" is written by the AI once, on its own, when the name is known and it is still empty. */
  const autoAbout = useRef(false);
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
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
    const r = await api<{ username: string | null }>("/api/account");
    if (r.ok) setUsername(r.data.username);
    return r.ok ? r.data.username : null;
  }, []);
  useEffect(() => {
    (async () => {
      const u = await loadUsername();
      if (u !== null) return;
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
    })();
  }, [loadUsername]);

  /** One read of the account + profile. A network failure shows a retry, never an endless spinner. */
  const load = useCallback(async () => {
    setLoadErr(""); setLoading(true);
    try {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/onboard"); return; }
      const sb = getBrowserSupabase();
      if (!sb) throw new Error("no session");
      const [{ data }, prof, fr, cards] = await Promise.all([
        sb.auth.getUser(),
        api<{ profiles?: Profile[] }>("/api/poster/profiles"),
        api<FactsResponse>("/api/card/facts").catch(() => null),
        fetchMyCardsStrict().catch(() => []),
      ]);
      const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; phone?: string; photo_url?: string; contact_email?: string; business?: Business; whatsapp?: string; home_city?: string; home_address?: string };
      setUid(data.user?.id ?? "");
      // Cleared by Super Admin since this phone last looked: the draft kept here is from before, and goes.
      dropStaleLocal(data.user);
      // The website already on record: the card facts first (they know whose site it is), else the account's own
      // website from an earlier set-up. Our own address, left by the seller template, is never anyone's website.
      const f = fr?.ok ? fr.data.facts : null;
      const storedUrl = cleanSiteUrl(f?.website || "") || (isShubhoraHost(meta.business?.website ?? "") ? "" : cleanSiteUrl(meta.business?.website ?? ""));
      const storedRole = f?.website ? f.websiteRole : "own";
      siteAtLoad.current = { url: storedUrl, role: storedRole };
      hadLiveCard.current = cards.some((c) => c.active !== false);
      if (storedUrl) setSite({ kind: storedRole, url: storedUrl, assertedAt: f?.dealerAssertedAt ?? "" });
      const p = prof.data.profiles?.find((x) => x.is_default) ?? prof.data.profiles?.[0] ?? null;
      setProfile(p);
      if (f) setFacts(f);
      const phone0 = (p?.phone || meta.phone || "").replace(/^\+91/, "");
      // Before the profile exists the WhatsApp number waits on the account (step 1 saves it there).
      const wa = f?.whatsapp || (meta.whatsapp ?? "").replace(/\D/g, "").slice(-10);
      setYou({
        name: meta.display_name || meta.full_name || (p?.persona !== "business" ? p?.name : "") || "",
        phone: phone0,
        photo: p?.photo_url ?? meta.photo_url ?? null,
        city: (meta.home_city ?? "").slice(0, 60), address: (meta.home_address ?? "").slice(0, 200),
        whatsapp: wa, waSame: !wa || wa === phone0.replace(/\D/g, "").slice(-10),
      });
      setBiz({ kind: p && p.persona !== "business" && !meta.business?.name ? "person" : "business", role: (meta.business?.role as Role) || (p && p.persona !== "business" && !meta.business?.name ? "professional" : "business"), ...meta.business, name: meta.business?.name || (p?.persona === "business" ? p.name : ""), category: meta.business?.category || p?.category || "", city: meta.business?.city || p?.city || "", logo: p?.logo_url ?? null });
      const mail = data.user?.email ?? "";
      setNeedEmail(IS_PHONE_EMAIL.test(mail));
      setEmail(meta.contact_email || (IS_PHONE_EMAIL.test(mail) ? "" : mail));
      // What this phone had typed and not yet saved comes back over what the server knows (it is newer: the
      // draft is cleared the moment Save or Skip goes through). Seven days old is forgotten.
      try {
        const key = `onboard-draft:${data.user?.id ?? ""}`;
        const raw = localStorage.getItem(key);
        const d = raw ? JSON.parse(raw) as { v?: number; at?: number; base?: number; step?: StepKey; site?: SiteState; biz?: typeof biz; you?: typeof you; facts?: CardFacts; detours?: Detour[]; touched?: string[] } : null;
        // Only a draft typed over THIS server version comes back; one from before a reset or another phone's save is thrown away.
        const serverAt = Date.parse(String(data.user?.updated_at ?? "")) || 0;
        serverBase.current = serverAt;
        const fresh = d?.v === 2 && d.base === serverAt && Date.now() - (d.at ?? 0) < 7 * 86_400_000;
        if (d && !fresh) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
        if (d && fresh) {
          if (d.site?.kind) setSite(d.site);
          if (d.biz) setBiz((b) => ({ ...b, ...d.biz }));
          if (d.you) setYou((y) => ({ ...y, ...d.you, photo: d.you?.photo || y.photo }));
          if (d.facts) { setFacts(normalizeFacts(d.facts)); factsDirty.current = true; }
          if (Array.isArray(d.detours)) setDetours(d.detours);
          for (const k of d.touched ?? []) touched.current.add(k);
          if (!wanted && d.step && d.step !== "you") setStep(d.step);
        }
      } catch { /* a bad draft is just ignored */ }
      draftReady.current = true;
      setLoading(false);
    } catch {
      setLoadErr("No internet — tap to try again");
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
  useEffect(() => {
    if (!draftReady.current || !uid) return;
    const t = setTimeout(() => {
      try {
        const key = `onboard-draft:${uid}`;
        const cur = JSON.parse(localStorage.getItem(key) || "null") as { base?: number } | null;
        if (cur?.base && cur.base > serverBase.current) return;   // a newer tab owns the draft
        localStorage.setItem(key, JSON.stringify({ v: 2, at: Date.now(), base: serverBase.current, step, site, biz, you, facts, detours, touched: [...touched.current] }));
      } catch { /* storage full or off: nothing lost but the convenience */ }
    }, 400);
    return () => clearTimeout(t);
  }, [uid, step, site, biz, you, facts, detours]);
  /** After this screen itself writes to the account (Both, Shubhora), the version moves on and the draft follows. */
  async function bumpServerBase() {
    try { const { data } = (await getBrowserSupabase()?.auth.getUser()) ?? { data: { user: null } }; serverBase.current = Date.parse(String(data.user?.updated_at ?? "")) || serverBase.current; } catch { /* keep */ }
  }
  function clearDraft() { try { if (uid) localStorage.removeItem(`onboard-draft:${uid}`); } catch { /* ignore */ } }

  /** A picked photo opens the crop / zoom window first; the framed square is what gets uploaded. */
  function choose(file: File, kind: "photo" | "logo") {
    const r = new FileReader();
    r.onload = () => setCrop({ kind, src: String(r.result) });
    r.readAsDataURL(file);
  }
  async function upload(dataUrl: string, kind: "photo" | "logo") {
    setCrop(null); setBusy(kind); setErr("");
    try {
      const url = await uploadImage(dataUrlToFile(dataUrl, kind === "logo" ? "logo.png" : "photo.jpg"), kind);
      if (!url) { setErr("Could not upload the photo. Please try again."); return; }
      if (kind === "photo") setYou((y) => ({ ...y, photo: url })); else { touch("logo"); setBiz((b) => ({ ...b, logo: url })); }
    } catch {
      setErr("Could not upload the photo. Please try again.");
    } finally {
      setBusy("");
    }
  }

  /** The AI writes "About your business" from the name, the type and any notes already typed. */
  async function writeAbout(auto = false) {
    setErr("");
    if (!biz.name?.trim() && !biz.category) { if (!auto) setErr("Add the business name and what you do first — the AI writes from those."); return; }
    if (auto && (biz.about ?? "").trim()) return;
    setBusy("about");
    try {
      const r = await fetch("/api/ai/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        task: "about-business", input: `${biz.about ?? ""}${biz.city ? `\nCity: ${biz.city}` : ""}`.trim(),
        company: biz.name ?? you.name, role: categoryOf(biz.category ?? "")?.en ?? "",
      }) }).then((x) => x.json()).catch(() => ({ error: "The AI is busy. Please try again." }));
      // Never overwrite what the owner typed with canned text: no text means an honest error.
      if (!r.text) { if (!auto) setErr(r.error ?? "The AI could not write it. Please type a few lines yourself."); return; }
      // Written on its own: only into an about that is still empty — never over what was typed meanwhile.
      setBiz((b) => (auto && (b.about ?? "").trim() ? b : { ...b, about: String(r.text).trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") }));
    } catch {
      if (!auto) setErr("The AI could not write it. Please type a few lines yourself.");
    } finally {
      setBusy("");
    }
  }

  /** Step 1 is saved to the account the moment "Next" is tapped, so closing the app loses nothing.
   *  Once the setup has been done (a poster profile exists) this is an EDIT, and it goes everywhere at once: the
   *  login (the new number signs in), the posters, the V-Card and the partner ID — /api/account/details does the
   *  server side, then the setup's own card sync re-publishes the card picture / number. Before, "Next" only
   *  changed the login, and the card and posters kept the old details until the whole setup was saved again. */
  /** Step 1's fact: the WhatsApp number, only when it differs from the mobile. */
  function youFacts(): { whatsapp: string } {
    const mobile = you.phone.replace(/\D/g, "").slice(-10);
    const wa = you.waSame ? "" : you.whatsapp.replace(/\D/g, "").slice(-10);
    return { whatsapp: wa && wa !== mobile ? wa : "" };
  }
  /** The account's business object as it stands now — step 1 writes the city / address into it early, so
   *  closing the app after step 1 loses nothing; step 2's Save writes the full, checked version again. */
  function bizMeta(): Business {
    return { name: (biz.name ?? "").trim(), role: biz.role, reach: biz.reach ?? "local", category: biz.category || "", gstin: (biz.gstin ?? "").trim().toUpperCase(),
      address: (biz.address ?? "").trim(), city: (biz.city ?? "").trim(), about: (biz.about ?? "").trim(), website: biz.website ?? "", map: (biz.map ?? "").trim(),
      ...(biz.nameFromSite !== undefined ? { nameFromSite: biz.nameFromSite } : {}), ...(biz.categoryFromSite !== undefined ? { categoryFromSite: biz.categoryFromSite } : {}), ...(biz.aboutFromSite !== undefined ? { aboutFromSite: biz.aboutFromSite } : {}) };
  }

  async function nextFromYou() {
    setErr("");
    const digits = you.phone.replace(/\D/g, "");
    if (you.name.trim().length < 2 || digits.length < 10) { setErr("Write your name and 10-digit mobile number."); return; }
    // Step 1 of the profile (not the name / mobile edit): the residential city and address are required (owner's call).
    if (!editing && !you.city.trim()) { setErr(T("Write your city.", "अपना शहर लिखें।")); return; }
    if (!editing && you.address.trim().length < 6) { setErr(T("Write your residential address.", "अपना घर का पता लिखें।")); return; }
    const home = { home_city: you.city.trim().slice(0, 60), home_address: you.address.trim().slice(0, 200) };
    // The business city, still empty, starts as the home city (changed on the next step when the shop is elsewhere).
    if (!editing && !(biz.city ?? "").trim() && home.home_city) setBiz((b) => ({ ...b, city: home.home_city }));
    if (profile || editing) {
      const phone = digits.slice(-10);
      let partnerMissed = false;
      setBusy("you");
      try {
        const r = await api<{ ok?: boolean; error?: string; note?: string }>("/api/account/details", { method: "POST", json: { name: you.name.trim(), phone, photo: you.photo || "" } });
        if (!r.ok) { setErr(r.data.error ?? "Could not save. Please try again."); return; }
        // The WhatsApp number lives in the card facts (the profile exists, so the route takes it); the city and
        // address go on the account's business right away.
        if (profile) await api("/api/card/facts", { method: "PATCH", json: { facts: youFacts() } }).catch(() => undefined);
        if (!editing) await getBrowserSupabase()?.auth.updateUser({ data: { ...home, business: { ...bizMeta(), city: (biz.city ?? "").trim() || home.home_city } } }).catch(() => undefined);
        partnerMissed = !!r.data.note;
        // The name and number were changed on the server: refresh this session's copy of them.
        await getBrowserSupabase()?.auth.refreshSession().catch(() => undefined);
        await syncCardFromSetup({
          name: you.name.trim(), business: (biz.name ?? "").trim(), photo: you.photo || null, logo: biz.logo || null, phone,
          oldPhoto: profile?.photo_url ?? null, oldLogo: profile?.logo_url ?? null,
        }).catch(() => undefined);
      } catch {
        setErr("No internet — please try again."); return;
      } finally { setBusy(""); }
      if (back) { router.push(`${back}${back.includes("?") ? "&" : "?"}saved=${partnerMissed ? "details-np" : "details"}`); return; }
      setStep("promote");
      return;
    }
    try {
      getBrowserSupabase()?.auth.updateUser({ data: {
        full_name: you.name.trim(), display_name: you.name.trim(), phone: `+91${digits.slice(-10)}`, photo_url: you.photo || "",
        whatsapp: youFacts().whatsapp, ...home, business: { ...bizMeta(), city: (biz.city ?? "").trim() || home.home_city },
      } }).catch(() => undefined);
    } catch { /* offline: the full save on the next screen writes it again */ }
    setStep("promote");
  }

  /** "Promote Shubhora" (owner's call, 24 Sep 2026): most partners sell Shubhora itself, so no business form —
   *  the account is set up as a Shubhora partner, the 3 plans become their products, the Shubhora seller card is
   *  built with their name / photo / number and published on their username, and the editor opens on it. */
  async function promoteShubhora() {
    setBusy("shubhora"); setErr("");
    try {
      const digits = you.phone.replace(/\D/g, "").slice(-10);
      const sb = getBrowserSupabase();
      const cat = categoryOf("mlm");
      // 1. account + profile (agent for Shubhora, Pan India)
      await sb?.auth.updateUser({ data: {
        full_name: you.name.trim(), display_name: you.name.trim(), phone: `+91${digits}`, photo_url: you.photo || "",
        business: { name: "Shubhora", role: "agent", reach: "india", category: "mlm", city: (biz.city ?? "").trim(), address: "", about: "", website: "https://shubhora.com", map: "", gstin: "" },
      } });
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
        const card = { ...(existingCard ?? {}), ...data, id: existingCard?.id ?? Math.random().toString(36).slice(2, 10), username: handle, active: true,
          seoTitle: data.seoTitle ?? "", seoDescription: data.seoDescription ?? "",
          seo: { ...(data.seo ?? {}), ...(existingCard?.seo?.googleVerify ? { googleVerify: existingCard.seo.googleVerify } : {}) } } as Parameters<typeof publishCard>[0];
        const r = await publishCard(card);
        if (r.ok) { router.push(`/poster/d/editor?id=${card.id}`); return; }
        setErr(r.error || "Could not publish the card — open the editor and press Publish.");
      }
      // no username yet (or publish failed): the editor with the template, publish by hand
      router.push(existingCard ? `/poster/d/editor?id=${existingCard.id}&template=vcard-reseller` : "/poster/d/editor?id=new&template=vcard-reseller");
    } catch {
      setErr("Something went wrong. Please try again.");
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
  async function bothFlow() {
    setBusy("both"); setErr("");
    try {
      const sb = getBrowserSupabase();
      // Remembered on the account, not in this screen's state: the card is built on a later screen, and the
      // person may well close the app in between.
      const up = await sb?.auth.updateUser({ data: { also_shubhora: true } });
      if (up?.error) { setErr("Could not save. Please try again."); return; }
      await bumpServerBase();
      setStep("site");
    } catch {
      setErr("No internet — please try again.");
    } finally { setBusy(""); }
  }

  /* ================= the website step ================= */

  /** "What do you do?" also decides how the card leads and how far the service goes — unless those were set by hand. */
  const withCategory = (b: typeof biz, k: string) => {
    const role = b.roleTouched ? b.role : roleOf(k);
    return { ...b, category: k, role, kind: role === "business" ? "business" as const : "person" as const, reach: b.reachTouched ? b.reach : reachOf(role, k) };
  };
  const touch = (k: string) => { touched.current.add(k); };
  /** Most Indian businesses say their trade in their name — "Sharma Sweets", "Apollo Clinic", "Verma Electricals".
   *  When the owner has not picked a trade themselves, the name picks it, so the list never has to be opened. */
  function guessTrade(b: typeof biz): typeof biz {
    if (touched.current.has("category")) return b;
    const k = matchCategory(`${b.name ?? ""} ${b.about ?? ""}`);
    if (!k || k === b.category || !categoryOf(k)) return b;
    guessedTrade.current = k;
    return withCategory(b, k);
  }

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
      if (!t.has("about") && (fresh || !(b.about ?? "").trim()) && d.about) n.about = d.about.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ");
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
  async function findByName(q: string): Promise<string> {
    const r = await api<{ ok: boolean; url?: string; name?: string }>("/api/site/find", { method: "POST", json: { q } });
    return r.ok && r.data.ok && r.data.url ? r.data.url : "";
  }
  const [finding, setFinding] = useState("");
  async function resolveTyped(): Promise<string> {
    const v = site.url.trim();
    if (!v || looksLikeSite(cleanSiteUrl(v)) || socialDetour(v) || v.length < 2) return cleanSiteUrl(v);
    setFinding(v);
    try {
      const url = await findByName(v);
      if (url) { setSite((st) => ({ ...st, url })); return url; }
      return "";
    } finally { setFinding(""); }
  }

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

  /** "Yes, keep it as my Instagram": the link is stored where it belongs, and the website answer goes back to "none". */
  function keepSocial() {
    if (!pendingSocial) return;
    const d = pendingSocial;
    if (d.key === "map") setBiz((b) => ({ ...b, map: d.url }));
    else setDetours((list) => [...list.filter((x) => x.key !== d.key), d]);
    setPendingSocial(null);
    setSite({ kind: "none", url: "", assertedAt: "" });
    peekSeq.current++; peekFor.current = { url: "", role: "", state: "" }; setPeek(NO_PEEK);
  }

  async function nextFromWebsite() {
    setSiteErr("");
    if (!site.kind) { setSiteErr(T("Pick one — do you have a website?", "पहले एक चुनें — website है या नहीं")); return; }
    if (site.kind === "none") { setStep("business"); return; }
    let url = cleanSiteUrl(site.url);
    if (site.url.trim() && !pendingSocial && !looksLikeSite(url)) {
      const found = await resolveTyped();
      if (found) url = found;
      else { setSiteErr(T(`Could not find a website for "${site.url.trim()}" — paste the link, e.g. brandname.com`, `"${site.url.trim()}" की website नहीं मिली — link डालें, जैसे brandname.com`)); return; }
    }
    if (!site.url.trim()) { setSiteErr(T("Write the website link, e.g. sharmasweets.com — or tap ❌ No website", "website का link लिखें, जैसे sharmasweets.com — नहीं है तो ❌ नहीं है दबाएँ")); return; }
    if (pendingSocial) { setSiteErr(T(`That is a ${pendingSocial.label} page, not a website — keep it as a ${pendingSocial.label} link, or change the link.`, `ये ${pendingSocial.label} page है, website नहीं — social link की तरह रखें, या link बदलें`)); return; }
    if (!url || !looksLikeSite(url)) { setSiteErr(T("That does not look like a website link. For example: sharmasweets.com", "ये website का link नहीं लगता। जैसे sharmasweets.com")); return; }
    if (isShubhoraHost(url)) { setSiteErr(T("That is Shubhora's own site — put in your business's website, or tap ❌ No website", "ये Shubhora की site है — अपने business की website डालें, या ❌ नहीं है दबाएँ")); return; }
    if (site.kind === "dealer" && !site.assertedAt) { setSiteErr(T("Please confirm first that you are this brand's authorised dealer / distributor.", "पहले confirm करें कि आप इस brand के authorised dealer / distributor हैं।")); return; }
    setSite((st) => ({ ...st, url }));
    void startPeek({ ...site, url });
    setStep("business");
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
  async function lookupTyped() {
    const url = await resolveTyped();
    if (url && site.kind && site.kind !== "none") void startPeek({ ...site, url });
  }

  /** 📍 Uses the phone's GPS where the owner is standing — an exact map pin, no typing. */
  function pinShop() {
    setErr("");
    if (typeof navigator === "undefined" || !navigator.geolocation) { setErr(LOCATION_OFF); return; }
    setBusy("pin");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        setBiz((b) => ({ ...b, map: `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}` }));
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
        setBusy("");
      },
      () => { setBusy(""); setErr(LOCATION_OFF); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  /** "Skip for now" (owner's call, 23 Sep 2026): whatever is filled is kept, nothing is required, and the app opens.
   *  A minimal profile is created when there is none (the app needs one to show its screens), so the person can come
   *  back to any step later from Setup — the floating "Finish setup" sheet keeps the unfinished steps in view. */
  async function skipForNow() {
    setBusy("skip"); setErr("");
    try {
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
        ...(biz.category || bizName || city || site.kind ? { business: { name: bizName, role: biz.role, reach: biz.reach ?? "local", category: biz.category || "", trade: (biz.trade ?? "").trim().slice(0, 40), city, address: (biz.address ?? "").trim(), about: (biz.about ?? "").trim(), website: ownSiteUrl(), map: (biz.map ?? "").trim(), gstin: (biz.gstin ?? "").trim().toUpperCase(), linkBy: bizName ? linkBy() : "name" } } : {}),
        setup_skipped_at: new Date().toISOString(),
        // Both is the default answer to "What is your card for?" (owner's call, 4 Oct 2026), skipped or not.
        ...(promote === "both" ? { also_shubhora: true } : {}),
      } }).catch(() => undefined);
      if (!profile) {
        const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: {
          is_default: true, persona: biz.role === "business" ? (cat?.persona ?? "business") : biz.role === "personal" ? "personal" : biz.role === "agent" ? "business" : "professional",
          name: biz.role === "business" && bizName ? bizName : name, tagline: cat?.en ?? "", phone: digits.length === 10 ? digits : "", city, lang: "hi",
          photo_url: you.photo || null, logo_url: biz.logo || null, category: biz.category || "", style: cat?.style ?? "classic", mode: "greeting", layout: {},
        } });
        if (r.ok && r.data.profile) setCurrentProfileId(r.data.profile.id);
      }
      // The website answer survives the skip (the facts route needs the profile that now exists).
      await saveSiteFacts().catch(() => undefined);
      clearDraft();
      router.push("/poster");
    } catch {
      router.push("/poster");
    } finally { setBusy(""); }
  }

  /** The account's own website: only a site the person called their OWN. A brand's site (dealer) and a site
   *  they merely like live in the card facts only, so the card never prints someone else's site as theirs.
   *  When the website step was not shown this visit (?step=business), whatever was on record stays. */
  function ownSiteUrl(): string {
    if (!site.kind) return isShubhoraHost(biz.website ?? "") ? "" : cleanSiteUrl(biz.website ?? "");
    return site.kind === "own" ? cleanSiteUrl(site.url) : "";
  }

  /** The website, whose it is, the dealer's confirmation and any social link kept on the way → card facts.
   *  Nothing is written when the step was not shown. Returns true when the website or its role changed. */
  async function saveSiteFacts(): Promise<boolean> {
    if (!site.kind) return false;
    const url = site.kind === "none" ? "" : cleanSiteUrl(site.url);
    const role = toFactsRole(site.kind);
    const facts: Record<string, unknown> = {
      website: url, websiteRole: role,
      dealerAssertedAt: site.kind === "dealer" && url ? site.assertedAt : "",
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
  // for the photo. The home city is step 1's own answer (required there), so it is the sign that step 1 was
  // done: after a reset the name and mobile stay but the city, address, photo and WhatsApp are gone, and the
  // step is shown again instead of skipped (owner, 4 Oct 2026).
  const skippedYou = useRef(false);
  useEffect(() => {
    if (skippedYou.current || loading || wanted || autoSkip || username === undefined) return;
    skippedYou.current = true;
    if (step === "you" && username && you.name.trim().length >= 2 && you.phone.replace(/\D/g, "").length >= 10 && you.city.trim()) { setYouSkipped(true); setStep("promote"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, username]);

  const autoSkipped = useRef(false);
  useEffect(() => {
    if (!autoSkip || autoSkipped.current || loading) return;
    autoSkipped.current = true;
    skipForNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSkip, loading]);

  /** Straight to the next unfinished step: products already added → make the V-Card. */
  async function nextStep(): Promise<string> {
    // Products the website will supply are not asked for: a dealer's come from the brand's site in the build,
    // and an own site that lists products on its home page brings them in the same way. A site that showed
    // none (a JavaScript shell, a plain brochure site) still gets the products screen.
    if (site.kind === "dealer" || (site.kind === "own" && peek.state === "found" && (peek.data?.products ?? 0) > 0)) return hadLiveCard.current ? "/poster/card" : "/poster/card/build";
    try {
      const r = await api<{ products?: unknown[] }>("/api/poster/products");
      return r.ok && (r.data.products?.length ?? 0) > 0 ? "/poster/card" : "/poster/products?setup=1";
    } catch {
      return "/poster/products?setup=1";
    }
  }

  /** A tab left open from before a reset (or another phone's save) must not write its old answers back over the
   *  fresh account: when the server version moved under it, the screen reloads instead of saving. */
  async function accountMoved(): Promise<boolean> {
    try {
      const { data } = (await getBrowserSupabase()?.auth.getUser()) ?? { data: { user: null } };
      const now = Date.parse(String(data.user?.updated_at ?? "")) || 0;
      if (serverBase.current && now && now !== serverBase.current) {
        setErr(T("This account was changed elsewhere (a reset, or another phone). Reloading…", "यह account कहीं और बदला गया (reset, या दूसरे phone से)। दोबारा खुल रहा है…"));
        clearDraft();
        setTimeout(() => window.location.reload(), 1200);
        return true;
      }
    } catch { /* offline: let the save try */ }
    return false;
  }

  /** One save for both steps: the poster profile + the account details. */
  async function save() {
    setErr("");
    if (await accountMoved()) return;
    const phone = you.phone.replace(/\D/g, "").slice(-10);
    if (you.name.trim().length < 2) { setStep("you"); setErr("Write your name."); return; }
    if (phone.length !== 10) { setStep("you"); setErr("Write your 10-digit mobile number."); return; }
    const isBiz = biz.role === "business";
    const bizName = (biz.name ?? "").trim();   // any role may carry a company / brand; required only for a business
    const city = (biz.city ?? "").trim();
    // What you do decides the card, the website and the posters, so it is never left empty.
    if (!(biz.category ?? "").trim()) { setErr("Choose what you do."); return; }
    if (isBiz && !bizName) { setErr("Write your business name."); return; }
    if (biz.role !== "personal" && !city) { setErr("Write your city — it is needed even for Pan India / online (where you are based)."); return; }
    // The card, the website and every customer reply are written from this (owner's call, 4 Oct 2026: mandatory).
    if (biz.role !== "personal" && !(biz.about ?? "").trim()) { setErr(T(`Write a line about your ${org.en} — or tap Write with AI.`, `अपने ${place} के बारे में एक लाइन लिखें — या AI से लिखवाएँ दबाएँ।`)); document.getElementById("about")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const gst = (biz.gstin ?? "").trim().toUpperCase();
    if (gst && !GSTIN.test(gst)) { setErr("The GST number does not look right (15 characters, e.g. 07ABCDE1234F1Z5). Leave it empty if you don't have one."); return; }
    const peekName = peek.state === "found" && peek.role === "own" ? (peek.data?.name ?? "").trim() : "";
    const nameFromSite: boolean | undefined = !peekName ? undefined : bizName.toLowerCase() === peekName.toLowerCase() ? true : touched.current.has("name") ? false : undefined;
    setBusy("save");
    try {
      const before = profile;
      const cat = categoryOf(biz.category ?? "");
      const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: {
        id: profile?.id, is_default: true,
        persona: isBiz ? (cat?.persona ?? "business") : biz.role === "personal" ? (cat?.persona && cat.persona !== "business" ? cat.persona : "personal") : biz.role === "agent" ? "business" : "professional",
        name: isBiz ? bizName : you.name.trim(),
        tagline: profile?.tagline || cat?.en || "",
        phone, city, lang: profile?.lang ?? "hi",
        photo_url: you.photo || null, logo_url: biz.logo || null,
        category: biz.category || "", style: profile?.style ?? cat?.style ?? "classic", mode: profile?.mode ?? "greeting", layout: profile?.layout ?? {},
      } });
      if (!r.ok || !r.data.profile) { setErr(r.data.error ?? "Could not save. Please try again."); return; }
      setProfile(r.data.profile); setCurrentProfileId(r.data.profile.id);
      // The full business object is saved for both kinds: a solo worker also has a trade, a city and an address.
      const sb = getBrowserSupabase();
      const up = await sb?.auth.updateUser({ data: {
        // display_name is ours: Google rewrites full_name on every Google sign-in.
        full_name: you.name.trim(), display_name: you.name.trim(), phone: `+91${phone}`, photo_url: you.photo || "",
        ...(needEmail ? { contact_email: email.trim().slice(0, 120) } : {}),
        business: {
          name: bizName, role: biz.role, reach: biz.role === "personal" ? "local" : (biz.reach ?? "local"), category: biz.category || "", trade: (biz.trade ?? "").trim().slice(0, 40), gstin: gst, address: (biz.address ?? "").trim(),
          city, about: (biz.about ?? "").trim(), website: ownSiteUrl(), map: (biz.map ?? "").trim(),
          linkBy: bizName ? linkBy() : "name",
          // The site's name was shown and kept → the build may keep taking the name from the site; shown and
          // corrected → the build keeps this one. Not peeked this visit → whatever was on record. Same for the
          // trade and the about text.
          ...(nameFromSite !== undefined ? { nameFromSite } : biz.nameFromSite !== undefined ? { nameFromSite: biz.nameFromSite } : {}),
          ...(peekName ? { categoryFromSite: !touched.current.has("category") && !!peek.data?.category && biz.category === peek.data.category } : biz.categoryFromSite !== undefined ? { categoryFromSite: biz.categoryFromSite } : {}),
          ...(peekName ? { aboutFromSite: !touched.current.has("about") && !!peek.data?.about && (biz.about ?? "").trim() === peek.data.about.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") } : biz.aboutFromSite !== undefined ? { aboutFromSite: biz.aboutFromSite } : {}),
        },
      } });
      if (!sb || up?.error) { setErr("Could not save your business details. Please try again."); return; }
      // A result still on its way from the website must not land in the form after this point.
      peekSeq.current++;
      // Written after the profile exists (the facts route refuses before). Best effort: the build reads the
      // website from here, but the card is made either way.
      let siteChanged = false;
      try { siteChanged = await saveSiteFacts(); } catch { /* the V-Card form asks again */ }
      // Step 1's designation / WhatsApp and step 2's company details (timings, photos, payments, social…).
      try { await api("/api/card/facts", { method: "PATCH", json: { facts: { ...youFacts(), ...(factsDirty.current ? pickFacts(facts, COMPANY_FACT_KEYS) : {}) } } }); } catch { /* the build form shows them again */ }
      // Keep the published V-Card in step with the setup (name, business, photo, logo, number).
      await syncCardFromSetup({
        name: you.name.trim(), business: bizName, photo: you.photo || null, logo: biz.logo || null, phone,
        oldPhoto: before?.photo_url ?? null, oldLogo: before?.logo_url ?? null,
      }).catch(() => undefined);
      clearDraft();
      // A different website (or a different role for it) on an account that already has a live card: that card
      // is built again from the new site — ?again=1 throws the old preview away; publishing still asks first.
      if (siteChanged && hadLiveCard.current) { router.push("/poster/card/build?again=1&site=new"); return; }
      const to = next || await nextStep();
      router.push(siteChanged && to.startsWith("/poster/card/build") ? `${to}${to.includes("?") ? "&" : "?"}site=new` : to);
    } catch {
      setErr("Could not save your business details. Please try again.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (loadErr) return (
    <div className="py-24 grid place-items-center">
      <button type="button" onClick={load} className="rounded-2xl border border-border px-5 py-3.5 text-sm font-semibold">{loadErr}</button>
    </div>
  );

  return (
    <div className="space-y-5 py-2">
      {crop && (
        <ImageCropper src={crop.src} aspect={1} outWidth={600} round={crop.kind === "photo"} format={crop.kind === "logo" ? "png" : "jpeg"}
          onApply={(d) => upload(d, crop.kind)} onCancel={() => setCrop(null)} />
      )}
      {editing ? (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{T("Edit your details", "अपनी जानकारी बदलें")}</p>
        <button type="button" onClick={() => router.push(back)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">{T("Cancel", "रहने दें")}</button>
      </div>
      ) : <>
      <ProfileSteps current={step === "you" ? "you" : "business"} category={biz.category} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{next ? T("Your details are needed for the card", "Card के लिए आपकी जानकारी चाहिए") : "Setup"}</p>
        {next ? (
          <span className="text-xs text-muted">Fill these once — the card, website and posters are made from them.</span>
        ) : (
          <button type="button" onClick={skipForNow} disabled={busy === "skip"} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink disabled:opacity-60">
            {busy === "skip" ? T("Opening the app…", "App खुल रहा है…") : T("Skip for now →", "अभी छोड़ें →")}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        {/* The auto-skipped "About you" pill is hidden: four pills fit a 360 px phone, five do not. */}
        {(["you", "promote", "site", "business"] as const).filter((k) => k !== "you" || !youSkipped).map((k, i) => (
          <button key={k} type="button" onClick={() => setStep(k)} className={`min-w-0 flex-1 truncate rounded-full px-1 py-1.5 ${step === k ? "bg-brand text-white" : "bg-surface2 text-muted"}`}>{i + 1}. {k === "you" ? T("You", "आप") : k === "promote" ? T("Card for", "किसलिए") : k === "site" ? "Website" : "Business"}</button>
        ))}
      </div>
      </>}

      {step === "promote" ? (
        <section className="space-y-4">
          {/* Owner's call, 25 Sep 2026: a referral link does not make someone a networker — many take Shubhora for their
              own shop. So everyone gets this choice, answerable in one look. Both is ticked by default (owner's call,
              4 Oct 2026): the person's own business, and a Shubhora page of its own on a hidden link. */}
          <div>
            <h1 className="text-2xl font-bold">{T("What is your card for?", "आपका card किस काम के लिए है?")}</h1>
            <p className="text-sm text-muted">{T("Both is ticked — change it if you want only one. You can change it later too.", "दोनों चुना हुआ है — सिर्फ़ एक चाहिए तो बदल लें। बाद में भी बदल सकते हैं।")}</p>
          </div>

          {([
            { k: "both" as const, icon: <Layers className="h-6 w-6" />, t: T("Both — my business and Shubhora", "दोनों — मेरा business और Shubhora"), s: T("Two separate links from one login: your own card and website, and a Shubhora page of its own. Your customers never see Shubhora; the Shubhora link never shows your business.", "एक login से दो अलग link: आपका अपना card और website, और एक अलग Shubhora page। आपके customers को Shubhora नहीं दिखता; Shubhora link पर आपका business नहीं।"), eg: T("Your daily posters stay your own business's.", "रोज़ के poster आपके अपने business के ही बनेंगे।") },
            { k: "own" as const, icon: <Store className="h-6 w-6" />, t: T("Only my own business or work", "सिर्फ़ मेरा अपना business / काम"), s: T("Shop, clinic, school, office, service or profession. Your business, products and number go on the card, and customers reach you.", "दुकान, clinic, school, office, service या profession। Card पर आपका business, products और number होगा — customers सीधे आपसे जुड़ेंगे।"), eg: `${T("For example", "जैसे")}: ${egName} · City Care Clinic · Raj Electricals` },
            // eslint-disable-next-line @next/next/no-img-element
            { k: "shubhora" as const, icon: <img src="/art/brand/shubhora-logo.png" alt="" className="h-8 w-8 object-contain" />, t: T("Only selling Shubhora as a partner", "सिर्फ़ Shubhora partner बनकर Shubhora बेचना"), s: T("Help other businesses get Shubhora and earn partner income. A ready Shubhora card (plans, demo video, business plan) is made with your name, photo and number.", "दूसरे businesses को Shubhora दिलाएँ और partner income कमाएँ। आपके नाम, photo और number के साथ तैयार Shubhora card बनता है (plans, demo video, business plan)।"), eg: "" },
          ]).map((c) => {
            const on = promote === c.k;
            return (
              <button key={c.k} type="button" onClick={() => setPromote(c.k)} disabled={!!busy} aria-pressed={on}
                className={`w-full rounded-2xl border-2 p-4 text-left disabled:opacity-60 ${on ? "border-brand bg-brand-soft/60" : "border-border bg-surface"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface text-brand shadow-card">{c.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold">{c.t}{c.k === "both" && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-white">{T("Default", "Default")}</span>}</p>
                    <p className="mt-0.5 text-sm text-muted">{c.s}</p>
                    {c.eg && <p className="mt-1.5 text-xs text-muted">{c.eg}</p>}
                  </div>
                  <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-border-strong"}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                </div>
              </button>
            );
          })}

          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={() => { if (promote === "both") void bothFlow(); else if (promote === "shubhora") void promoteShubhora(); else setStep("site"); }} disabled={!!busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
            {busy === "both" || busy === "shubhora" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {T("Saving…", "Save हो रहा है…")}</> : <>{T("Continue", "आगे बढ़ें")} →</>}
          </button>
          <p className="text-center text-xs text-muted">{T("Not sure? Keep Both — the Shubhora page can be taken off any time from My V-Card.", "पक्का नहीं? दोनों रहने दें — Shubhora page कभी भी My V-Card से हटा सकते हैं।")}</p>
        </section>
      ) : step === "site" ? (
        <section className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{T("Does your business have a website?", "क्या आपके business की website है?")}</h1>
            <p className="text-sm text-muted">{T("If so, paste the link — the name, logo and products all come from it. If not, no problem.", "है तो link डालें — नाम, logo, products सब उसी से आ जाएँगे। नहीं है तो कोई बात नहीं।")}</p>
          </div>

          {SITE_CARDS.map((c) => {
            const on = site.kind === c.k;
            const bad = siteErr && !site.kind;
            return (
              <div key={c.k}>
                <button type="button" onClick={() => pickSite(c.k)} disabled={!!busy}
                  className={`w-full rounded-2xl border-2 p-3.5 text-left disabled:opacity-60 ${on ? "border-brand bg-brand-soft/60" : bad ? "border-danger/60 bg-surface" : "border-border bg-surface"}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-xl shadow-card">{c.e}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold leading-snug">{hi ? c.th : c.t}</p>
                      <p className="mt-0.5 text-xs text-muted">{hi ? c.sh : c.s}</p>
                    </div>
                    <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-border-strong"}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                  </div>
                </button>
                {on && c.k !== "none" && (
                  <div className="-mt-1 space-y-2.5 rounded-b-2xl border-2 border-t-0 border-brand/40 bg-surface px-3.5 pb-3.5 pt-4">
                    <label className="block text-sm font-semibold">
                      {c.k === "own" ? T("Your website link", "आपकी website का link") : c.k === "dealer" ? T("The brand's website link", "Company / brand की website का link") : T("That website's link", "उस website का link")}
                      <div className="mt-1 flex items-stretch gap-2">
                        <input value={site.url} onChange={(e) => onUrlChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void lookupTyped(); } }} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                          placeholder={c.k === "dealer" ? T("e.g. brandname.com — or just the brand name", "जैसे brandname.com — या सिर्फ़ brand का नाम") : T(`e.g. ${egSite} — or the name`, `जैसे ${egSite} — या नाम`)} className={`${box} min-w-0 flex-1 ${siteErr && site.kind && !pendingSocial ? "border-danger" : ""}`} />
                        <button type="button" onClick={() => void lookupTyped()} disabled={!!finding || site.url.trim().length < 2} aria-label={T("Search", "खोजें")} title={T("Search", "खोजें")}
                          className="grid w-12 shrink-0 place-items-center rounded-xl grad-brand text-white disabled:opacity-50">{finding ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}</button>
                      </div>
                      <span className="mt-1 block text-[11px] font-normal text-muted">{T("Type the link or just the name — it is looked up by itself.", "link या सिर्फ़ नाम लिखें — अपने आप खोज लेंगे।")}</span>
                    </label>
                    {finding && <p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {T(`Finding the website of "${finding}"…`, `"${finding}" की website ढूँढ रहे हैं…`)}</p>}
                    {pendingSocial ? (
                      <div className="rounded-xl border border-amber/50 bg-amber/10 px-3 py-2.5 text-sm">
                        <p className="font-semibold"><TriangleAlert className="mr-1 inline h-4 w-4 text-amber" />{T(`That is a ${pendingSocial.label} page, not a website.`, `ये ${pendingSocial.label} page है, website नहीं।`)} {pendingSocial.key === "map" ? T("Keep it as your map pin?", "इसे map pin की तरह रखें?") : T(`Keep it as your ${pendingSocial.label} link?`, `इसे ${pendingSocial.label} link की तरह रखें?`)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={keepSocial} className="rounded-full grad-brand px-3.5 py-1.5 text-xs font-semibold text-white">{T("Yes, keep it", "हाँ, रखें")}</button>
                          <button type="button" onClick={() => { setPendingSocial(null); setSite((st) => ({ ...st, url: "" })); }} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold">{T("Change the link", "link बदलें")}</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted">{T("An Instagram, Facebook, YouTube or Google-Maps link is not a website.", "Instagram / Facebook / YouTube / Google-Maps link website नहीं है।")}</p>
                    )}
                    {c.k === "dealer" && (
                      <label className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${siteErr && site.kind === "dealer" && !site.assertedAt ? "border-danger" : "border-border bg-surface2"}`}>
                        <input type="checkbox" checked={!!site.assertedAt} onChange={(e) => { setSiteErr(""); setSite((st) => ({ ...st, assertedAt: e.target.checked ? new Date().toISOString() : "" })); }} className="mt-0.5 h-4 w-4" />
                        <span>{T("I am this brand's authorised dealer / distributor and may show its product photos on my card.", "मैं इस brand का authorised dealer / distributor हूँ और इसके product photos अपने card पर दिखा सकता हूँ।")}</span>
                      </label>
                    )}
                    <p className="text-xs text-muted">{hi ? c.takesHi : c.takes}</p>
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
                      <button type="button" onClick={() => { setSite({ kind: "none", url: "", assertedAt: "" }); peekSeq.current++; peekFor.current = { url: "", role: "", state: "" }; setPeek(NO_PEEK); setSiteErr(""); }} className="text-xs font-semibold text-muted underline">{T("Remove this website", "ये website हटाएँ")}</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {detours.length > 0 && (
            <p className="text-xs text-muted">{T("Kept as links", "link की तरह रखा")}: {detours.map((d) => d.label).join(", ")}</p>
          )}
          {siteErr && <p className="text-sm font-semibold text-danger">{siteErr}</p>}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={nextFromWebsite} disabled={!!busy}
            className="w-full rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-70">
            {T("Next →", "आगे बढ़ें →")}
          </button>
        </section>
      ) : step === "you" ? (
        <section className="space-y-4">
          {editing
            ? <div><h1 className="text-2xl font-bold">{T("Your name and mobile", "आपका नाम और मोबाइल")}</h1><p className="text-sm text-muted">{T("One save changes them everywhere — your V-Card, your posters, your login and your partner ID. Your username stays the same.", "एक बार Save करने से हर जगह बदल जाएगा — V-Card, poster, login और partner ID। Username वही रहेगा।")}</p></div>
            : <div><h1 className="text-2xl font-bold">{T("About you", "आपके बारे में")}</h1><p className="text-sm text-muted">{T("Takes 30 seconds. Your company comes next.", "30 second लगेंगे। अगला step आपकी company।")}</p></div>}
          <label className="block text-sm font-semibold">Your name<input value={you.name} onChange={(e) => { if (!associate) setYou({ ...you, name: e.target.value }); }} readOnly={!!associate} placeholder="e.g. Rajesh Sharma" className={`${field} ${associate ? "bg-surface2 text-muted" : ""}`} />
            {associate && <span className="mt-1 block text-[11px] font-normal text-muted">{T("As on your partner KYC — it cannot be changed here.", "आपके partner KYC के अनुसार — यहाँ नहीं बदलेगा।")}</span>}</label>
          <label className="block text-sm font-semibold">{T("Mobile number", "Mobile number")}<input value={you.phone} onChange={(e) => setYou({ ...you, phone: e.target.value })} inputMode="tel" placeholder="10-digit mobile" className={field} /></label>
          <div className="text-sm font-semibold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={you.waSame} onChange={(e) => setYou({ ...you, waSame: e.target.checked })} className="h-4 w-4" /> {T("WhatsApp is the same number", "WhatsApp भी यही number है")}</label>
            {!you.waSame && <input value={you.whatsapp} onChange={(e) => setYou({ ...you, whatsapp: e.target.value })} inputMode="tel" placeholder={T("WhatsApp number (10 digits)", "WhatsApp number (10 अंक)")} className={field} />}
          </div>
          <label className="block text-sm font-semibold">Email{!needEmail && <span className="font-normal text-muted"> ({T("from your sign-up", "sign-up से")})</span>}
            <input value={email} onChange={(e) => setEmail(e.target.value.trim())} readOnly={!needEmail} inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="e.g. sharma@gmail.com" className={`${field} ${needEmail ? "" : "bg-surface2 text-muted"}`} />
            {needEmail && <span className="mt-1 block text-xs font-normal text-muted">{T("Customers can email you from your card.", "Customers card से आपको email कर सकेंगे।")}</span>}
          </label>
          <Photo url={you.photo} label="your photo" hint="a clear photo of your face — shown on your card and daily posters" round busy={busy === "photo"} onPick={(f) => choose(f, "photo")} />
          {!editing && (<>
            <label className="block text-sm font-semibold">{T("Your city", "आपका शहर")}<input value={you.city} onChange={(e) => setYou({ ...you, city: e.target.value })} placeholder="e.g. Rewari" className={field} /></label>
            <label className="block text-sm font-semibold">{T("Residential address", "घर का पता")}<input value={you.address} onChange={(e) => setYou({ ...you, address: e.target.value })} placeholder={T("House no., street, area, PIN", "मकान नं., गली, इलाका, PIN")} className={field} />
              <span className="mt-1 block text-[11px] font-normal text-muted">{T("Your home address — the shop / office address comes on the company step.", "आपके घर का पता — दुकान / office का पता company step पर आएगा।")}</span></label>
          </>)}
          {username === null && <ClaimUsername onDone={loadUsername} />}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={nextFromYou} disabled={busy === "you"}
            className="w-full rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-70">
            {busy === "you" ? T("Saving…", "Save हो रहा है…") : editing ? T("Save", "Save करें") : "Next"}
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          {(() => {
            const ownPeek = site.kind === "own" && peek.role === "own" && peek.url === cleanSiteUrl(site.url) ? peek : null;
            const filled = ownPeek?.state === "found";
            return (
              <div>
                <h1 className="text-2xl font-bold">{T(biz.category ? `Your ${org.en}` : "Your business", biz.category ? `आपका ${org.hi}` : "आपका business")}</h1>
                <p className="text-sm text-muted">{filled
                  ? T("This came from your website — correct? Fix anything that is off and Save.", "Website से ये मिला — सही है? ठीक करें और Save दबाएँ।")
                  : T("Just three things — what you do, the name, the city. Your card, website and posters are made from them.", "बस तीन बातें — काम, नाम, शहर। इन्हीं से आपका card, website और posters बनेंगे।")}</p>
                {ownPeek && ownPeek.state !== "idle" && (
                  <p className={`mt-2 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${filled ? "bg-good/10 text-good" : ownPeek.state === "reading" ? "bg-surface2 text-muted" : "bg-amber/10 text-amber"}`}>
                    {ownPeek.state === "reading" ? <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : filled ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span>{ownPeek.state === "reading" ? T(`Reading ${hostOf(ownPeek.url)}… the fields fill in by themselves`, `${hostOf(ownPeek.url)} पढ़ रहे हैं… fields अपने आप भरेंगे`)
                      : filled ? T("Filled from your website — have a look, fix what is wrong.", "आपकी website से भरा — देख लें, गलत हो तो ठीक करें।")
                      : T("Could not read it — fill these in; the website is read again when the card is built.", "पढ़ नहीं पाए — ये भर दें; website card बनाते समय फिर पढ़ी जाएगी।")}</span>
                  </p>
                )}
                {site.kind === "dealer" && peek.state === "found" && peek.url === cleanSiteUrl(site.url) && peek.data?.name && (
                  <p className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{T("Brand", "Brand")}: <b className="text-ink">{peek.data.name}</b>{peek.data.products ? ` · ${peek.data.products} products ${T("will come across as MRP", "MRP के साथ आएँगे")}` : ""} — {T("below, your OWN shop's name and city.", "नीचे अपनी दुकान का नाम और शहर।")}</p>
                )}
              </div>
            );
          })()}

          {/* 1 — the name first (owner's call, 4 Oct 2026): "Sharma Sweets" already says the trade, so the trade box below fills itself */}
          <label className="block text-sm font-semibold">
            {biz.role === "business" ? T(biz.category ? `${org.En} name` : "Business name", biz.category ? (categoryOf(biz.category)?.hint || `${org.hi} का नाम`) : "Business का नाम") : biz.role === "agent" ? T("Company / brand you represent", "आप किस company / brand के लिए काम करते हैं") : T("Company / brand you promote", "Company / brand")}
            {biz.role !== "business" && biz.role !== "agent" && <span className="font-normal text-muted"> ({T("optional", "optional")})</span>}
            <input value={biz.name ?? ""} onChange={(e) => { touch("name"); setBiz((b) => guessTrade({ ...b, name: e.target.value })); }}
              onBlur={() => { if (!autoAbout.current && (biz.name ?? "").trim() && biz.category && !(biz.about ?? "").trim()) { autoAbout.current = true; void writeAbout(true); } }}
              placeholder={biz.role === "business" ? `e.g. ${egName}` : biz.role === "agent" ? T("e.g. the company or brand you represent", "जैसे जिस company / brand के लिए काम करते हैं") : T(`e.g. ${egName} — or leave empty`, `जैसे ${egName} — या खाली छोड़ें`)} className={field} />
            {site.kind === "own" && peek.state === "found" && !!peek.data?.name && (biz.name ?? "").trim().toLowerCase() !== peek.data.name.trim().toLowerCase() && (
              <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-normal text-muted">
                <span>{T("On your website", "आपकी website पर")}: <b className="text-ink">{peek.data.name}</b></span>
                <button type="button" onClick={() => { touched.current.delete("name"); setBiz({ ...biz, name: peek.data!.name.slice(0, 80) }); }} className="font-semibold text-brand-ink underline">{T("Use this", "इसे लें")}</button>
              </span>
            )}</label>
          {/* 2 — what you do (decides the card, the website and the posters) */}
          <div className="block text-sm font-semibold">{T("What do you do?", "आप क्या काम करते हैं?")}
            <CategoryPicker value={biz.category ?? ""} onChange={(k) => { touch("category"); setBiz((b) => ({ ...withCategory(b, k), trade: "" })); }} placeholder={T("Choose your type of business", "अपना काम चुनें")}
              custom={biz.trade ?? ""} onCustom={(text) => { touch("category"); setBiz((b) => ({ ...withCategory(b, matchCategory(text) || "other"), trade: text })); }} />
            {!touched.current.has("category") && !!biz.category && (
              (site.kind === "own" || site.kind === "dealer" || site.kind === "reference") && peek.state === "found" && biz.category === peek.data?.category
                ? <span className="mt-1 block text-[11px] font-normal text-muted">{site.kind === "reference" ? T("Guessed from the website you like — change it if wrong.", "आपकी पसंद की website से अंदाज़ा — गलत हो तो बदलें।") : T("Guessed from your website — change it if wrong.", "website से अंदाज़ा — गलत हो तो बदलें।")}</span>
                : biz.category === guessedTrade.current
                ? <span className="mt-1 block text-[11px] font-normal text-muted">{T("Guessed from your name — change it if wrong.", "आपके नाम से अंदाज़ा — गलत हो तो बदलें।")}</span>
                : null
            )}
          </div>

          {/* 1b — the trade's own questions (classes and board for a school, cuisine for a restaurant …): the fields
              after the category follow the category (owner's call, 2 Oct 2026). Saved with the company facts. */}
          {!!biz.category && <TradeQuestions category={biz.category} facts={facts} setF={setF} hi={hi} />}

          {(() => { const r = ROLES.find((x) => x.k === biz.role) ?? ROLES[0]; return (
            <div className="-mt-2 rounded-xl bg-surface2 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-muted">{T("Card type", "Card का प्रकार")}: <b className="text-ink">{hi ? r.th : r.t}</b></span>
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

          {/* The card's link: business name or your name (owner's call, 25 Sep 2026). Shown when both give a link. */}
          {(() => {
            const nSlug = nameSlug(you.name); const bSlug = nameSlug(biz.name ?? "");
            if (!nSlug || !bSlug || nSlug === bSlug) return null;
            const pick = linkBy();
            const opt = (k: "business" | "name", slug: string, label: string) => (
              <button key={k} type="button" onClick={() => setBiz({ ...biz, linkBy: k })}
                className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left ${pick === k ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${pick === k ? "border-brand" : "border-border-strong"}`}>{pick === k && <span className="h-2 w-2 rounded-full bg-brand" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-normal text-muted">{label}</span>
                  <span className="block truncate text-sm font-semibold">{SITE_HOST}/c/{slug}</span>
                </span>
              </button>
            );
            return (
              <div className="text-sm font-semibold">{T("Your card link", "आपके card का link")}
                <div className="mt-1.5 space-y-2">
                  {opt("business", bSlug, T("Business name", "Business का नाम"))}
                  {opt("name", nSlug, T("Your name", "आपका नाम"))}
                </div>
                <p className="mt-1 text-[11px] font-normal text-muted">{T("If a link is already taken, a number is added. You can change it later.", "अगर ये link पहले से किसी का है तो आगे number जुड़ जाएगा। बाद में भी बदल सकते हैं।")}</p>
              </div>
            );
          })()}

          {/* 3 — city */}
          <label className="block text-sm font-semibold">{T(`${org.En} city`, `${place} का शहर`)} <span className="font-normal text-muted">({T(`where your ${org.en} is`, `जहाँ ${place} है`)})</span><input value={biz.city ?? ""} onChange={(e) => { touch("city"); setBiz({ ...biz, city: e.target.value }); }} placeholder="e.g. Delhi" className={field} /></label>

          {/* 4 — about (the AI writes it) */}
          <div className="block text-sm font-semibold">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="about">{T(`About your ${org.en}`, `आपके ${place} के बारे में`)} <span className="font-normal text-danger">*</span></label>
              <button type="button" onClick={() => writeAbout()} disabled={busy === "about"} className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60">
                {busy === "about" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {biz.about?.trim() ? T("Improve with AI", "AI से बेहतर करें") : T("Write with AI", "AI से लिखवाएँ")}
              </button>
            </div>
            <textarea id="about" value={biz.about ?? ""} onChange={(e) => { touch("about"); const v = e.target.value; setBiz({ ...biz, about: words(v) > ABOUT_MAX_WORDS ? v.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") : v }); }} rows={4}
              placeholder={T(`A few words is enough — e.g. “${copy.aboutEg}” — then tap Write with AI.`, `थोड़े शब्द काफ़ी हैं — जैसे “${copy.aboutEgHi}” — फिर AI से लिखवाएँ दबाएँ।`)} className={field} />
            <span className="mt-1 flex justify-between gap-2 text-xs font-normal text-muted">
              <span>{T("The AI uses this for your card, website and customer replies.", "AI इसी से आपका card, website और customers के जवाब लिखता है।")}</span>
              <span className={`shrink-0 tabular-nums ${words(biz.about ?? "") >= ABOUT_MAX_WORDS ? "text-amber" : ""}`}>{words(biz.about ?? "")}/{ABOUT_MAX_WORDS}</span>
            </span>
          </div>

          {(biz.role === "business" || !!(biz.name ?? "").trim()) && <Photo url={biz.logo} label={biz.role === "business" ? T("your logo", "अपना logo") : T("company / brand logo", "company / brand logo")}
            hint={site.kind === "dealer" ? T("upload your own logo if you have one — otherwise the brand's logo is used", "अपना logo हो तो upload करें — नहीं तो brand का logo लगेगा") : biz.role === "business" ? T("shown on your card, website and posters", "card, website और posters पर दिखेगा") : T("shown next to your name", "आपके नाम के साथ दिखेगा")} busy={busy === "logo"} onPick={(f) => choose(f, "logo")} />}
          {site.kind === "dealer" && !biz.logo && !!peek.data?.logo && <p className="-mt-2 text-xs text-muted">{T(`Using ${peek.data?.name || "the brand"}'s logo for now.`, `अभी ${peek.data?.name || "brand"} का logo लगेगा।`)}</p>}

          {/* Everything else is optional — one tap away, never in the way. */}
          <details className="group rounded-2xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>{T("More details", "और जानकारी")} <span className="font-normal text-muted">({T("optional — address, map, GST", "optional — पता, map, GST")})</span></span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-border p-4">
              {biz.role !== "personal" && (
                <div>
                  <p className="text-sm font-semibold">{T("Where do you serve customers?", "आप कहाँ तक service देते हैं?")}</p>
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
              <label className="block text-sm font-semibold">{T("Full address", "पूरा पता")}<input value={biz.address ?? ""} onChange={(e) => { touch("address"); setBiz({ ...biz, address: e.target.value }); }} placeholder={T("Shop no., street, area", "Shop no., गली, इलाका")} className={field} /></label>
              {biz.map ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm font-semibold text-good">
                  <CheckCircle2 className="h-4 w-4" /> <span>{T("Pinned on the map", "Map पर pin हो गया")}</span>
                  <a href={biz.map} target="_blank" rel="noreferrer" className="underline">{T("Open", "खोलें")}</a>
                  <button type="button" onClick={() => setBiz({ ...biz, map: "" })} className="underline text-muted">{T("Remove", "हटाएँ")}</button>
                </div>
              ) : (
                <button type="button" onClick={pinShop} disabled={busy === "pin"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-semibold disabled:opacity-60">
                  {busy === "pin" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-brand" />} {T("I am at my shop — pin it on the map", "मैं अपनी दुकान पर हूँ — map पर pin करें")}
                </button>
              )}
              {/* The website is asked on its own step; here it is only shown, with one way back to change it. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Globe className="h-4 w-4 shrink-0 text-muted" />
                <span className="font-semibold">Website:</span>
                {site.kind && site.kind !== "none" && site.url
                  ? <span className="min-w-0 truncate text-muted">{hostOf(site.url)} · {site.kind === "own" ? T("my own", "मेरी अपनी") : site.kind === "dealer" ? T("the brand's (dealer)", "brand की (dealer)") : T("for its look", "look के लिए")}</span>
                  : ownSiteUrl()
                  ? <span className="min-w-0 truncate text-muted">{hostOf(ownSiteUrl())} · {T("my own", "मेरी अपनी")}</span>
                  : <span className="text-muted">{T("none", "नहीं है")}</span>}
                <button type="button" onClick={() => { setSiteErr(""); setStep("site"); }} className="font-semibold text-brand-ink underline">{T("Change", "बदलें")}</button>
              </div>
              {(biz.role === "business" || biz.role === "agent") && <label className="block text-sm font-semibold">{T("GST number", "GST number")} <span className="font-normal text-muted">({T("if you have one", "अगर है तो")})</span><input value={biz.gstin ?? ""} onChange={(e) => setBiz({ ...biz, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15) })} inputMode="text" autoCapitalize="characters" spellCheck={false} placeholder="07ABCDE1234F1Z5" className={`${field} uppercase tracking-wide`} />
                <span className="mt-1 block text-xs font-normal text-muted">{(biz.gstin ?? "").length}/15</span></label>}
            </div>
          </details>

          {/* Step 2 of the profile (owner's flow, 2 Oct 2026): everything about the company lives here — banner and
              photos, since / experience / team, timings, home service, areas, payments (what the site shows; no bank
              details), qualification, social and the map link. Each answer makes the website fuller; none is required. */}
          {!editing && (
            <details open className="group rounded-2xl border border-border bg-surface2/40">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span>{T(`${org.En} details for the website`, `Website के लिए ${place} की जानकारी`)} <span className="font-normal text-muted">({T("optional — photos, timings, payments, social", "optional — photos, समय, payment, social")})</span></span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-border p-3">
                <FactsFields group="company" category={biz.category} facts={facts} setF={setF} hi={hi} professional={biz.role === "professional"} hasAbout={!!(biz.about ?? "").trim()} />
              </div>
            </details>
          )}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={save} disabled={busy === "save"} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
            {busy === "save" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Save and continue", "Save करके आगे बढ़ें")}
          </button>
        </section>
      )}
    </div>
  );
}

// The 3 Shubhora plans as products (same as "Shubhora seller card banao" on My products).
const SHUBHORA_PRODUCTS = [
  { name: "Shubhora AI Business Assistant — Growth", price: "2,999 / month", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-growth.jpg", photos: [{ url: "/api/stock/vcard/plan-growth.jpg", view: "front", role: "identity" }], offer: "Pre-launch: join free, book your city's top ID", benefits: ["Digital V-Card + full website on one link", "AI assistant answers customers on WhatsApp 24×7", "Daily poster + status video, auto-posted", "Leads saved in your CRM"] },
  { name: "Shubhora Custom Solutions — Software & Automation", price: "On request — contact us", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-pro.jpg", photos: [{ url: "/api/stock/vcard/plan-pro.jpg", view: "front", role: "identity" }], offer: "We make all kinds of software — tell us what you need", benefits: ["Dedicated account manager", "Custom software, apps and websites", "Automation of daily work", "Custom CRM / ERP and dashboards", "AI assistants trained on your business"] },
  { name: "Free Digital V-Card", price: "FREE for 1 year (worth ₹1,499)", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-free.jpg", photos: [{ url: "/api/stock/vcard/plan-free.jpg", view: "front", role: "identity" }], offer: "", benefits: ["Complete digital card on your own link", "Your own domain on the card", "Leads from the card in the CRM", "Share on WhatsApp, QR code, save-contact"] },
];

export default function OnboardPage() {
  return <Suspense><Onboard /></Suspense>;
}
