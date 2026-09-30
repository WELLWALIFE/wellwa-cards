"use client";

// The first two steps of the setup journey, one simple screen each:
//   1. About you      — name, mobile, photo (saved the moment "Next" is tapped)
//   2. Your business  — kind, name, category, logo, city, address, map pin, GST (optional), a few lines about it
// Saved once, used everywhere: the poster profile (posters, card, website) and the account (the AI reads "about").
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, CheckCircle2, ChevronDown, Layers, LoaderCircle, MapPin, Sparkles, Store } from "lucide-react";
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
import type { Business } from "@/lib/journey";
import { ClaimUsername } from "@/components/poster/claim-username";
import { useT } from "@/lib/poster-i18n";
import { usernameOk, INTRODUCER_KEY, INTRODUCER_LEG_KEY } from "@/lib/username";

const field = "mt-1 w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base font-normal";
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ABOUT_MAX_WORDS = 150;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** Mobile sign-ups get a made-up address like 919812345678@phone.shubhora.com — they have no real email. */
const IS_PHONE_EMAIL = /@phone\./i;
const LOCATION_OFF = "Location is off. Turn it on, or paste your Google Maps link later.";

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
  const [step, setStep] = useState<"you" | "promote" | "business">(params.get("step") === "business" ? "business" : "you");
  const wanted = params.get("step");
  // ?next=/poster/card/build — the card (or another tool) needs these details first: no skip, and "Save" returns there.
  const next = (params.get("next") ?? "").startsWith("/") ? params.get("next")! : "";
  // ?skip=1 — the plan page's Skip: create the minimal profile and open the app without showing the form.
  const autoSkip = params.get("skip") === "1";
  // ?back=/poster/more — an EDIT of name / mobile / photo (Me → "Edit name / mobile"): only "About you", a Save
  // button, and straight back there afterwards (owner's call, 26 Sep 2026).
  const back = (params.get("back") ?? "").startsWith("/") ? params.get("back")! : "";
  const editing = !!back;
  useEffect(() => { if (wanted === "you" || wanted === "business" || wanted === "promote") setStep(wanted); }, [wanted]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [you, setYou] = useState({ name: "", phone: "", photo: "" as string | null });
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
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [crop, setCrop] = useState<{ kind: "photo" | "logo"; src: string } | null>(null);
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (en: string, hiText: string) => (hi ? hiText : en);
  // "Your card leads with…" is worked out from "What do you do?"; the four choices open only on "Change".
  const [showRole, setShowRole] = useState(false);
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
      const [{ data }, prof] = await Promise.all([sb.auth.getUser(), api<{ profiles?: Profile[] }>("/api/poster/profiles")]);
      const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; phone?: string; photo_url?: string; contact_email?: string; business?: Business };
      const p = prof.data.profiles?.find((x) => x.is_default) ?? prof.data.profiles?.[0] ?? null;
      setProfile(p);
      setYou({
        name: meta.display_name || meta.full_name || (p?.persona !== "business" ? p?.name : "") || "",
        phone: (p?.phone || meta.phone || "").replace(/^\+91/, ""),
        photo: p?.photo_url ?? meta.photo_url ?? null,
      });
      setBiz({ kind: p && p.persona !== "business" && !meta.business?.name ? "person" : "business", role: (meta.business?.role as Role) || (p && p.persona !== "business" && !meta.business?.name ? "professional" : "business"), ...meta.business, name: meta.business?.name || (p?.persona === "business" ? p.name : ""), category: meta.business?.category || p?.category || "", city: meta.business?.city || p?.city || "", logo: p?.logo_url ?? null });
      const mail = data.user?.email ?? "";
      setNeedEmail(IS_PHONE_EMAIL.test(mail));
      setEmail(meta.contact_email || (IS_PHONE_EMAIL.test(mail) ? "" : mail));
      setLoading(false);
    } catch {
      setLoadErr("No internet — tap to try again");
      setLoading(false);
    }
  }, [router]);
  useEffect(() => { load(); }, [load]);

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
      if (kind === "photo") setYou((y) => ({ ...y, photo: url })); else setBiz((b) => ({ ...b, logo: url }));
    } catch {
      setErr("Could not upload the photo. Please try again.");
    } finally {
      setBusy("");
    }
  }

  /** The AI writes "About your business" from the name, the type and any notes already typed. */
  async function writeAbout() {
    setErr("");
    if (!biz.name?.trim() && !biz.category) { setErr("Add the business name and what you do first — the AI writes from those."); return; }
    setBusy("about");
    try {
      const r = await fetch("/api/ai/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        task: "about-business", input: `${biz.about ?? ""}${biz.city ? `\nCity: ${biz.city}` : ""}`.trim(),
        company: biz.name ?? you.name, role: categoryOf(biz.category ?? "")?.en ?? "",
      }) }).then((x) => x.json()).catch(() => ({ error: "The AI is busy. Please try again." }));
      // Never overwrite what the owner typed with canned text: no text means an honest error.
      if (!r.text) { setErr(r.error ?? "The AI could not write it. Please type a few lines yourself."); return; }
      setBiz((b) => ({ ...b, about: String(r.text).trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") }));
    } catch {
      setErr("The AI could not write it. Please type a few lines yourself.");
    } finally {
      setBusy("");
    }
  }

  /** Step 1 is saved to the account the moment "Next" is tapped, so closing the app loses nothing.
   *  Once the setup has been done (a poster profile exists) this is an EDIT, and it goes everywhere at once: the
   *  login (the new number signs in), the posters, the V-Card and the partner ID — /api/account/details does the
   *  server side, then the setup's own card sync re-publishes the card picture / number. Before, "Next" only
   *  changed the login, and the card and posters kept the old details until the whole setup was saved again. */
  async function nextFromYou() {
    setErr("");
    const digits = you.phone.replace(/\D/g, "");
    if (you.name.trim().length < 2 || digits.length < 10) { setErr("Write your name and 10-digit mobile number."); return; }
    if (profile || editing) {
      const phone = digits.slice(-10);
      let partnerMissed = false;
      setBusy("you");
      try {
        const r = await api<{ ok?: boolean; error?: string; note?: string }>("/api/account/details", { method: "POST", json: { name: you.name.trim(), phone, photo: you.photo || "" } });
        if (!r.ok) { setErr(r.data.error ?? "Could not save. Please try again."); return; }
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
      setStep("business");
    } catch {
      setErr("No internet — please try again.");
    } finally { setBusy(""); }
  }

  /** 📍 Uses the phone's GPS where the owner is standing — an exact map pin, no typing. */
  function pinShop() {
    setErr("");
    if (typeof navigator === "undefined" || !navigator.geolocation) { setErr(LOCATION_OFF); return; }
    setBusy("pin");
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(""); setBiz((b) => ({ ...b, map: `https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}` })); },
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
        ...(biz.category || bizName || city ? { business: { name: bizName, role: biz.role, reach: biz.reach ?? "local", category: biz.category || "", city, address: (biz.address ?? "").trim(), about: (biz.about ?? "").trim(), website: (biz.website ?? "").trim(), map: (biz.map ?? "").trim(), gstin: (biz.gstin ?? "").trim().toUpperCase(), linkBy: bizName ? linkBy() : "name" } } : {}),
        setup_skipped_at: new Date().toISOString(),
      } }).catch(() => undefined);
      if (!profile) {
        const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: {
          is_default: true, persona: biz.role === "business" ? (cat?.persona ?? "business") : biz.role === "personal" ? "personal" : biz.role === "agent" ? "business" : "professional",
          name: biz.role === "business" && bizName ? bizName : name, tagline: cat?.en ?? "", phone: digits.length === 10 ? digits : "", city, lang: "hi",
          photo_url: you.photo || null, logo_url: biz.logo || null, category: biz.category || "", style: cat?.style ?? "classic", mode: "greeting", layout: {},
        } });
        if (r.ok && r.data.profile) setCurrentProfileId(r.data.profile.id);
      }
      router.push("/poster");
    } catch {
      router.push("/poster");
    } finally { setBusy(""); }
  }

  // "About you" asks again what the sign-up form just asked (owner's call, 25 Sep 2026: too many steps). When the
  // name, the mobile and the username are already there, setup opens on the next step; "1. About you" stays tappable
  // for the photo.
  const skippedYou = useRef(false);
  useEffect(() => {
    if (skippedYou.current || loading || wanted || autoSkip || username === undefined) return;
    skippedYou.current = true;
    if (step === "you" && username && you.name.trim().length >= 2 && you.phone.replace(/\D/g, "").length >= 10) setStep("promote");
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
    try {
      const r = await api<{ products?: unknown[] }>("/api/poster/products");
      return r.ok && (r.data.products?.length ?? 0) > 0 ? "/poster/card" : "/poster/products?setup=1";
    } catch {
      return "/poster/products?setup=1";
    }
  }

  /** One save for both steps: the poster profile + the account details. */
  async function save() {
    setErr("");
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
    const gst = (biz.gstin ?? "").trim().toUpperCase();
    if (gst && !GSTIN.test(gst)) { setErr("The GST number does not look right (15 characters, e.g. 07ABCDE1234F1Z5). Leave it empty if you don't have one."); return; }
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
          name: bizName, role: biz.role, reach: biz.role === "personal" ? "local" : (biz.reach ?? "local"), category: biz.category || "", gstin: gst, address: (biz.address ?? "").trim(),
          city, about: (biz.about ?? "").trim(), website: (biz.website ?? "").trim(), map: (biz.map ?? "").trim(),
          linkBy: bizName ? linkBy() : "name",
        },
      } });
      if (!sb || up?.error) { setErr("Could not save your business details. Please try again."); return; }
      // Keep the published V-Card in step with the setup (name, business, photo, logo, number).
      await syncCardFromSetup({
        name: you.name.trim(), business: bizName, photo: you.photo || null, logo: biz.logo || null, phone,
        oldPhoto: before?.photo_url ?? null, oldLogo: before?.logo_url ?? null,
      }).catch(() => undefined);
      router.push(next || await nextStep());
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
      <div className="flex items-center gap-2 text-xs font-semibold">
        {(["you", "promote", "business"] as const).map((k, i) => (
          <button key={k} type="button" onClick={() => setStep(k)} className={`flex-1 rounded-full py-1.5 ${step === k ? "bg-brand text-white" : "bg-surface2 text-muted"}`}>{i + 1}. {k === "you" ? T("About you", "आपके बारे में") : k === "promote" ? T("Your card", "Card किसलिए") : T("Business", "Business")}</button>
        ))}
      </div>
      </>}

      {step === "promote" ? (
        <section className="space-y-4">
          {/* Owner's call, 25 Sep 2026: a referral link does not make someone a networker — many take Shubhora for their
              own shop. So everyone gets this choice, answerable in one look: their own business first (most people),
              selling Shubhora second, and "not sure" answered below. */}
          <div>
            <h1 className="text-2xl font-bold">{T("What is your card for?", "आपका card किस काम के लिए है?")}</h1>
            <p className="text-sm text-muted">{T("Pick one — you can change it later.", "एक चुनें — बाद में कभी भी बदल सकते हैं।")}</p>
          </div>

          <button type="button" onClick={() => setStep("business")} disabled={!!busy}
            className="w-full rounded-2xl border-2 border-brand bg-brand-soft/60 p-4 text-left disabled:opacity-60">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface text-brand shadow-card"><Store className="h-6 w-6" /></span>
              <div className="flex-1">
                <p className="text-base font-bold">{T("My own business or work", "मेरा अपना business / काम")}</p>
                <p className="mt-0.5 text-sm text-muted">{T("Shop, clinic, office, service or profession. Your business, products and number go on the card, and customers reach you.", "दुकान, clinic, office, service या profession। Card पर आपका business, products और number होगा — customers सीधे आपसे जुड़ेंगे।")}</p>
                <p className="mt-1.5 text-xs text-muted">{T("For example", "जैसे")}: Sharma Sweets · Dr. Mehta Clinic · Raj Electricals · LIC agent</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full grad-brand px-3 py-1.5 text-xs font-semibold text-white">{T("Continue", "आगे बढ़ें")} →</p>
              </div>
            </div>
          </button>

          <button type="button" onClick={promoteShubhora} disabled={!!busy}
            className="w-full rounded-2xl border-2 border-border bg-surface p-4 text-left disabled:opacity-60">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/art/brand/shubhora-logo.png" alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1 shadow-card" />
              <div className="flex-1">
                <p className="text-base font-bold">{T("Sell Shubhora as a partner", "Shubhora partner बनकर Shubhora बेचना")}</p>
                <p className="mt-0.5 text-sm text-muted">{T("Help other businesses get Shubhora and earn partner income. A ready Shubhora card (plans, demo video, business plan) is made with your name, photo and number.", "दूसरे businesses को Shubhora दिलाएँ और partner income कमाएँ। Shubhora का तैयार card (plans, demo video, business plan) आपके नाम, photo और number के साथ बन जाएगा।")}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#2f5bf5] px-3 py-1.5 text-xs font-semibold text-[#2f5bf5]">{busy === "shubhora" ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {T("Making your card…", "Card बन रहा है…")}</> : <><Sparkles className="h-3.5 w-3.5" /> {T("Make my Shubhora card", "मेरा Shubhora card बनाएँ")}</>}</p>
              </div>
            </div>
          </button>

          {/* The third choice (owner's call): plenty of partners run their own shop AND sell Shubhora. It used to
              be one or the other, because turning the Shubhora card on overwrote their own pages. Now both fit in
              one account — two links that never show each other. */}
          <button type="button" onClick={bothFlow} disabled={!!busy}
            className="w-full rounded-2xl border-2 border-border bg-surface p-4 text-left disabled:opacity-60">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface2 text-brand shadow-card"><Layers className="h-6 w-6" /></span>
              <div className="flex-1">
                <p className="text-base font-bold">{T("Both — my business and Shubhora", "दोनों — मेरा business और Shubhora")}</p>
                <p className="mt-0.5 text-sm text-muted">{T("You get two separate links from one login: your own card, and a Shubhora page of its own. Your customers never see Shubhora, and the Shubhora link never shows your business.", "एक ही login से दो अलग link मिलेंगे — अपना card, और Shubhora का अलग page। आपके customer को Shubhora नहीं दिखेगा, और Shubhora वाले link पर आपका business नहीं।")}</p>
                <p className="mt-1.5 text-xs text-muted">{T("Your daily posters stay your own business's.", "रोज़ के poster आपके अपने business के ही बनेंगे।")}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full grad-brand px-3 py-1.5 text-xs font-semibold text-white">{busy === "both" ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {T("Saving…", "Save हो रहा है…")}</> : <>{T("Set up both", "दोनों सेट करें")} →</>}</p>
              </div>
            </div>
          </button>

          <div className="rounded-xl bg-surface2 px-3 py-2.5 text-xs text-muted">
            <b className="text-ink">{T("Not sure?", "पक्का नहीं पता?")}</b> {T("Choose “My own business” — you can add the Shubhora page later from My V-Card, and take it off again any time.", "“मेरा अपना business” चुनें — Shubhora page बाद में My V-Card से जोड़ सकते हैं, और जब चाहें हटा भी सकते हैं।")}
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
        </section>
      ) : step === "you" ? (
        <section className="space-y-4">
          {editing
            ? <div><h1 className="text-2xl font-bold">{T("Your name and mobile", "आपका नाम और मोबाइल")}</h1><p className="text-sm text-muted">{T("One save changes them everywhere — your V-Card, your posters, your login and your partner ID. Your username stays the same.", "एक बार Save करने से हर जगह बदल जाएगा — V-Card, poster, login और partner ID। Username वही रहेगा।")}</p></div>
            : <div><h1 className="text-2xl font-bold">About you</h1><p className="text-sm text-muted">Takes 30 seconds.</p></div>}
          <label className="block text-sm font-semibold">Your name<input value={you.name} onChange={(e) => setYou({ ...you, name: e.target.value })} placeholder="e.g. Rajesh Sharma" className={field} /></label>
          <label className="block text-sm font-semibold">Mobile / WhatsApp number<input value={you.phone} onChange={(e) => setYou({ ...you, phone: e.target.value })} inputMode="tel" placeholder="10-digit mobile" className={field} /></label>
          <Photo url={you.photo} label="your photo" hint="a clear photo of your face — shown on your card and daily posters" round busy={busy === "photo"} onPick={(f) => choose(f, "photo")} />
          {username === null && <ClaimUsername onDone={loadUsername} />}
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={nextFromYou} disabled={busy === "you"}
            className="w-full rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-70">
            {busy === "you" ? T("Saving…", "Save हो रहा है…") : editing ? T("Save", "Save करें") : "Next"}
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          <div><h1 className="text-2xl font-bold">{T("Your business", "आपका business")}</h1><p className="text-sm text-muted">{T("Four things, about a minute. Your card, website and posters are made from them.", "बस चार बातें, लगभग एक मिनट। इन्हीं से आपका card, website और posters बनेंगे।")}</p></div>

          {/* 1 — what you do (decides the card, the website and the posters) */}
          <div className="block text-sm font-semibold">{T("What do you do?", "आप क्या काम करते हैं?")}
            <CategoryPicker value={biz.category ?? ""} onChange={(k) => setBiz((b) => { const role = b.roleTouched ? b.role : roleOf(k); return { ...b, category: k, role, kind: role === "business" ? "business" : "person", reach: b.reachTouched ? b.reach : reachOf(role, k) }; })} placeholder={T("Choose your type of business", "अपना काम चुनें")} />
          </div>

          {/* 2 — the name; "leads with" is worked out from 1 and changed only when wanted */}
          <label className="block text-sm font-semibold">
            {biz.role === "business" ? T("Business name", "Business का नाम") : biz.role === "agent" ? T("Company / brand you represent", "आप किस company / brand के लिए काम करते हैं") : T("Company / brand you promote", "Company / brand")}
            {biz.role !== "business" && biz.role !== "agent" && <span className="font-normal text-muted"> ({T("optional", "optional")})</span>}
            <input value={biz.name ?? ""} onChange={(e) => setBiz({ ...biz, name: e.target.value })}
              placeholder={biz.role === "business" ? "e.g. Sharma Sweets" : biz.role === "agent" ? "e.g. LIC of India, Shubhora" : T("e.g. Apollo Clinic — or leave empty", "जैसे Apollo Clinic — या खाली छोड़ें")} className={field} /></label>
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
          <label className="block text-sm font-semibold">{T("Your city", "आपका शहर")} <span className="font-normal text-muted">({T("where you are based", "जहाँ आप हैं")})</span><input value={biz.city ?? ""} onChange={(e) => setBiz({ ...biz, city: e.target.value })} placeholder="e.g. Delhi" className={field} /></label>

          {/* 4 — about (the AI writes it) */}
          <div className="block text-sm font-semibold">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="about">{T("About your business", "आपके business के बारे में")}</label>
              <button type="button" onClick={writeAbout} disabled={busy === "about"} className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:opacity-60">
                {busy === "about" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {biz.about?.trim() ? T("Improve with AI", "AI से बेहतर करें") : T("Write with AI", "AI से लिखवाएँ")}
              </button>
            </div>
            <textarea id="about" value={biz.about ?? ""} onChange={(e) => { const v = e.target.value; setBiz({ ...biz, about: words(v) > ABOUT_MAX_WORDS ? v.trim().split(/\s+/).slice(0, ABOUT_MAX_WORDS).join(" ") : v }); }} rows={4}
              placeholder={T("A few words is enough — e.g. “sweets and namkeen, home delivery” — then tap Write with AI.", "थोड़े शब्द काफ़ी हैं — जैसे “मिठाई और नमकीन, home delivery” — फिर AI से लिखवाएँ दबाएँ।")} className={field} />
            <span className="mt-1 flex justify-between gap-2 text-xs font-normal text-muted">
              <span>{T("The AI uses this for your card, website and customer replies.", "AI इसी से आपका card, website और customers के जवाब लिखता है।")}</span>
              <span className={`shrink-0 tabular-nums ${words(biz.about ?? "") >= ABOUT_MAX_WORDS ? "text-amber" : ""}`}>{words(biz.about ?? "")}/{ABOUT_MAX_WORDS}</span>
            </span>
          </div>

          {(biz.role === "business" || !!(biz.name ?? "").trim()) && <Photo url={biz.logo} label={biz.role === "business" ? T("business logo", "business logo") : T("company / brand logo", "company / brand logo")} hint={biz.role === "business" ? T("shown on your card, website and posters", "card, website और posters पर दिखेगा") : T("shown next to your name", "आपके नाम के साथ दिखेगा")} busy={busy === "logo"} onPick={(f) => choose(f, "logo")} />}

          {/* Everything else is optional — one tap away, never in the way. */}
          <details className="group rounded-2xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>{T("More details", "और जानकारी")} <span className="font-normal text-muted">({T("optional — address, map, website, GST", "optional — पता, map, website, GST")})</span></span>
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
              <label className="block text-sm font-semibold">{T("Full address", "पूरा पता")}<input value={biz.address ?? ""} onChange={(e) => setBiz({ ...biz, address: e.target.value })} placeholder={T("Shop no., street, area", "Shop no., गली, इलाका")} className={field} /></label>
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
              <label className="block text-sm font-semibold">{T("Website", "Website")} <span className="font-normal text-muted">({T("only if you have one", "अगर है तो")})</span>
                <input value={biz.website ?? ""} onChange={(e) => setBiz({ ...biz, website: e.target.value.trim() })} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="e.g. sharmasweets.com" className={field} />
                <span className="mt-1 block text-xs font-normal text-muted">{T("The AI reads it and fills your card for you.", "AI इसे पढ़कर आपका card भर देता है।")}</span>
              </label>
              {needEmail && (
                <label className="block text-sm font-semibold">Email
                  <input value={email} onChange={(e) => setEmail(e.target.value.trim())} inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="e.g. sharma@gmail.com" className={field} />
                  <span className="mt-1 block text-xs font-normal text-muted">{T("Customers can email you from your card.", "Customers card से आपको email कर सकेंगे।")}</span>
                </label>
              )}
              {(biz.role === "business" || biz.role === "agent") && <label className="block text-sm font-semibold">{T("GST number", "GST number")} <span className="font-normal text-muted">({T("if you have one", "अगर है तो")})</span><input value={biz.gstin ?? ""} onChange={(e) => setBiz({ ...biz, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15) })} inputMode="text" autoCapitalize="characters" spellCheck={false} placeholder="07ABCDE1234F1Z5" className={`${field} uppercase tracking-wide`} />
                <span className="mt-1 block text-xs font-normal text-muted">{(biz.gstin ?? "").length}/15</span></label>}
            </div>
          </details>
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
