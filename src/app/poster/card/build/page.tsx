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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Camera, Check, CheckCircle2, ChevronLeft, CircleDashed, Globe, LoaderCircle, Pencil, Plus, RefreshCw, Smartphone, Sparkles, X } from "lucide-react";
import { FactsFields, Sec, type FactsPatch } from "@/components/poster/facts-fields";
import { TradeQuestions } from "@/components/poster/trade-questions";
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { checkUsername, cleanUsername, fetchMyCardsStrict, publishCard, suggestUsername, OFFLINE, type UsernameCheck } from "@/lib/cloud";
import { SHUBHORA_PAGE_SLUG, hasShubhoraPage, withShubhoraPage } from "@/lib/shubhora-page";
import { CardView } from "@/components/card-view";
import { applyLook, fiveLooks, type LookKey } from "@/lib/site-looks";
import { SITE_HOST, SITE_URL } from "@/lib/site-url";
import type { Card, CardBlock } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import { SEED_KEY } from "@/lib/card-personalize";
import { getLinkPref, linkOptions, setLinkPref } from "@/lib/link-pref";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { CreditPrice, UnlockDialog, useAiAccess } from "@/lib/ai-access";
import {
  isThinCard, mergeBuiltCard, normalizeFacts, vcardDraftKey, vcardFormKey,
  type BuildRequest, type BuildResponse, type BuildRow, type CardFacts, type FactsResponse,
  type Missing, type MissingKey, type SetupInfo, type WebCheck,
} from "@/lib/card-facts";
import { SITE_CARDS, cleanSiteUrl, looksLikeSite, socialDetour } from "@/lib/site-role";
import { useT } from "@/lib/poster-i18n";
import { ProfileSteps } from "@/components/poster/profile-steps";
import { LookPicker } from "@/components/poster/look-picker";

const box = "rounded-xl border border-border bg-surface px-3.5 py-3 text-[15px]";
const field = `mt-1 w-full ${box}`;
const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 6;

type Row = { id?: string; name: string; brand: string; price: string; photo: string; studio?: boolean; original?: string; busy?: boolean; note?: string };
/** A finished preview kept on this phone. `built` is the card the server wrote (before it was merged into the
 *  live card) and `liveSig` says which live card it was merged into, so a preview is never published on top of
 *  a card that has changed since. */
type Draft = { card: Card; built: TemplateCard | null; liveSig: string; checks: WebCheck[]; missing: Missing[]; off: string[]; savedAt: number };
type FormBackup = { facts: CardFacts; rows: Row[]; dirty: boolean; savedAt: number };
const emptyRow = (): Row => ({ name: "", brand: "", price: "", photo: "" });

// Shared with the set-up, which drops both when the website or its role changes there.
const draftKey = vcardDraftKey;
const formKey = vcardFormKey;
const PREVIEW_KEY = "vcard-preview";

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

export default function BuildCard() {
  const router = useRouter();
  const access = useAiAccess();
  const { lang } = useT();
  const hi = lang !== "en";
  const T = useCallback((en: string, hiText: string) => (hi ? hiText : en), [hi]);

  const [state, setState] = useState<"loading" | "error" | "form" | "make" | "building" | "preview">("loading");
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
  const [tab, setTab] = useState<"phone" | "site">("phone");
  const [scale, setScale] = useState(0.28);

  const [editLink, setEditLink] = useState(false);
  const [linkVal, setLinkVal] = useState("");
  const [linkCheck, setLinkCheck] = useState<UsernameCheck>({ state: "idle" });

  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState("");
  const [unlock, setUnlock] = useState(false);
  const [premiumUnlock, setPremiumUnlock] = useState(false);
  const [designNote, setDesignNote] = useState("");
  // Five looks for the website on screen (site-looks.ts): the designer's, then four more; a tap swaps the style on
  // the spot, and the first brings the designer's back.
  const [lookKey, setLookKey] = useState<LookKey>("designer");
  const looks = useMemo(() => (built?.site ? fiveLooks(built, built.site.style) : []), [built]);
  function pickLook(k: LookKey) {
    const look = looks.find((l) => l.key === k);
    if (!look) return;
    setLookKey(k);
    setCard((c) => (c ? applyLook(c, look) : c));
  }
  const [elapsed, setElapsed] = useState(0);
  // First V-Card (owner's call, 25 Sep 2026): it goes live by itself the moment the AI finishes — no "is it live or
  // not?" moment. `liveUser` is the link it went live on; a changed link afterwards needs one more save.
  const [liveUser, setLiveUser] = useState("");
  // The two ready links for this card — your name / business name — for one-tap switching on the preview.
  const [linkOpts, setLinkOpts] = useState<{ name: string | null; business: string | null }>({ name: null, business: null });

  /** "Check your details" — the company / product answers, folded; a "Make it better" chip opens it. */
  const reviewRef = useRef<HTMLDetailsElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** The preview tabs: the finished flow scrolls here when moving from the website to the card. */
  const previewRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef(false);
  /** The running build, so "Take me back" (and the 160 s guard) can stop a request that never answers. */
  const jobRef = useRef<{ ctrl: AbortController; cancelled: boolean } | null>(null);

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
    setState("loading"); setErr("");
    try {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/card/build"); return; }
      const who = await getBrowserSupabase()?.auth.getUser();
      const me = who?.data.user?.id ?? "";
      setUid(me);
      setAlsoShubhora(!!who?.data.user?.user_metadata?.also_shubhora);
      // "Make my V-Card again with AI" asks for a NEW card, so any saved preview is thrown away first.
      let again = false;
      // ?flow=1 — step 4 of the profile: the form opens, nothing is built until step 5. ?make=1 — straight to step 5.
      let flow = false, makeNow = false;
      try {
        const u = new URL(window.location.href);
        again = u.searchParams.get("again") === "1";
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
      if (!live && (!nameOk || !s?.phone || !s?.category)) { router.replace("/poster/onboard?next=/poster/card/build"); return; }
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
      const backupRows = backup && Array.isArray(backup.rows) ? backup.rows.slice(0, MAX_ROWS).map((r) => ({ ...r, busy: false })) : null;
      const startRows = backupRows?.length ? backupRows : fromSaved.length ? fromSaved : [emptyRow(), emptyRow(), emptyRow()];
      setRows(startRows);

      if (draft) {
        setCard(draft.card); setBuilt(draft.built ?? null); setLiveSig(draft.liveSig);
        setChecks(draft.checks ?? []); setMissing(draft.missing ?? []); setOff(draft.off ?? []);
        setState(makeNow ? "make" : "preview");
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
    writeJson(draftKey(uid), { card, built, liveSig, checks, missing, off, savedAt: Date.now() } satisfies Draft);
  }, [state, card, built, liveSig, checks, missing, off, uid]);

  const username = card?.username ?? "";
  // Your-name / business-name links for the preview's one-tap switch (each checked free for THIS card).
  useEffect(() => {
    if (state !== "preview" || !card?.id || !built) return;
    let alive = true;
    linkOptions(built.name || "", built.company || "", card.id).then((o) => { if (alive) setLinkOpts(o); }).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, card?.id, built?.name, built?.company]);
  useEffect(() => {
    if (!username) return;
    QRCode.toDataURL(`${SITE_URL}/c/${username}`, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [username]);

  /* staged wording while the server works */
  useEffect(() => {
    if (state !== "building") return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  /* the link the owner is typing */
  useEffect(() => {
    if (!editLink) return;
    const v = cleanUsername(linkVal);
    if (v.length < 3) { setLinkCheck({ state: "bad", reason: T("At least 3 characters.", "कम से कम 3 अक्षर।") }); return; }
    setLinkCheck({ state: "checking" });
    const t = setTimeout(async () => {
      try { setLinkCheck(await checkUsername(v, existing?.id)); } catch { setLinkCheck({ state: "idle" }); }
    }, 400);
    return () => clearTimeout(t);
  }, [linkVal, editLink, existing?.id, T]);

  const shown = useMemo(() => (card ? applyChecks(card, checks, off) : null), [card, checks, off]);
  /** A link that is taken or too short: it can neither be saved nor published (offline = "idle", where
   *  publishing itself is the judge). */
  const linkBad = linkCheck.state === "bad" || linkCheck.state === "checking";

  /* the website preview: the real desktop renderer in an iframe, scaled down to the phone's width */
  useEffect(() => {
    if (state !== "preview" || tab !== "site" || !shown) return;
    writeJson(PREVIEW_KEY, { ...shown, username: "__preview" });
  }, [state, tab, shown]);

  useEffect(() => {
    if (state !== "preview" || tab !== "site") return;
    const el = frameRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth || 360) / 1280));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state, tab]);

  /* ---------------- photos ---------------- */

  async function productPhoto(i: number, f: File) {
    patchRow(i, { busy: true, note: "" });
    try {
      const url = await uploadImage(await compressToFile(f, "product.jpg", 1600, 0.88), "product");
      if (!url) { patchRow(i, { busy: false, note: T("Could not upload the photo. Please try again.", "Photo upload नहीं हो पाई। दोबारा try करें।") }); return; }
      patchRow(i, { photo: url, original: url, studio: false, busy: false });
    } catch {
      patchRow(i, { busy: false, note: T(OFFLINE, "internet नहीं है — दोबारा try करें।") });
    }
  }

  async function studio(i: number) {
    const row = rows[i];
    if (!row?.photo) return;
    if (!access.active || access.balance < 5) { setUnlock(true); return; }
    patchRow(i, { busy: true, note: T("Making it look professional… (about 20 seconds)", "Photo professional बनाई जा रही है… (करीब 20 second)") });
    try {
      const r = await api<{ url?: string; error?: string }>("/api/card/product-photo", {
        method: "POST",
        json: { photo_url: row.photo, product: row.name, brand: row.brand, allowPaid: true, product_id: row.id },
      });
      if (r.ok && r.data.url) patchRow(i, { original: row.photo, photo: r.data.url, studio: true, busy: false, note: T("✨ Studio photo ready", "✨ Studio photo तैयार") });
      else { patchRow(i, { busy: false, note: r.data.error ?? T("Your photo is kept as it is.", "आपकी photo वैसी ही रहेगी।") }); if (r.status === 402) setUnlock(true); }
    } catch {
      patchRow(i, { busy: false, note: T(OFFLINE, "internet नहीं है — दोबारा try करें।") });
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
  async function build(over?: { facts?: CardFacts; rows?: Row[]; existing?: Card | null; uid?: string; back?: "form" | "preview"; fresh?: boolean }) {
    const f = over?.facts ?? facts;
    const rs = over?.rows ?? rows;
    const live = over && "existing" in over ? over.existing ?? null : existing;
    const me = over?.uid ?? uid;
    const back = over?.back ?? (state === "preview" ? "preview" : "form");
    setErr(""); setNotice(""); setState("building");
    // A phone that changes from Wi-Fi to mobile data can leave a fetch hanging for ever, and this is the
    // longest request in the app: it is given 160 s, and "Take me back" stops it at any time.
    const job = { ctrl: new AbortController(), cancelled: false };
    jobRef.current = job;
    const guard = setTimeout(() => job.ctrl.abort(), 160_000);
    try {
      const products: BuildRow[] = rs
        .filter((r) => r.name.trim())
        .map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), brand: r.brand.trim(), price: r.price.trim(), photo: r.photo, studio: !!r.studio }));
      // The site is "new" when the set-up said so, or when the website typed on this form differs from the one
      // the server had when the form opened.
      const siteChanged = siteNew.current || (!!f.website && f.website !== serverSite.current);
      // "Write again": the look on screen goes along as the one to avoid (owner's call, 4 Oct 2026).
      const leaving = over?.fresh ? (shown ?? card) : null;
      const fresh = over?.fresh ? { style: leaving?.site?.style ?? {}, round: ++freshRound.current } : null;
      const body: BuildRequest = { facts: { ...f, primaryCardId: undefined }, products, ...(siteChanged ? { siteChanged: true } : {}), ...(fresh ? { fresh } : {}) };
      siteNew.current = false;
      const r = await api<Partial<BuildResponse> & { error?: string }>("/api/card/build", { method: "POST", json: body, signal: job.ctrl.signal });
      const built = r.data?.card;
      if (!r.ok || !built) { setErr(r.data?.error || T("Could not make your V-Card. Please try again.", "आपका V-Card नहीं बन पाया। दोबारा try करें।")); setState(back); return; }

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
      const full = mergeBuiltCard(live, built, { id: live?.id ?? crypto.randomUUID(), username: name });
      const nextChecks = r.data.checks ?? [];
      const nextMissing = r.data.missing ?? [];
      const sig = cardSig(live);
      setCard(full); setBuilt(built); setLiveSig(sig); setChecks(nextChecks); setMissing(nextMissing); setOff([]); setTab("phone"); setLookKey("designer");
      if (me) writeJson(draftKey(me), { card: full, built, liveSig: sig, checks: nextChecks, missing: nextMissing, off: [], savedAt: Date.now() } satisfies Draft);
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
        setNotice(facts.websiteRole === "reference" && facts.website
          ? T("We could not open that website, so your card got our own look — you can change it any time under My website → Edit website.", "वो website खुल नहीं पाई, इसलिए आपके card को हमारा look मिला — My website → Edit website से जब चाहें बदल सकते हैं।")
          : T("We could not open your website, so your V-Card was made from your other details.", "आपकी website खुल नहीं पाई, इसलिए V-Card आपकी बाकी जानकारी से बना है।"));
      } else if (r.data.aiPhotos && !(facts.websiteRole === "reference" && facts.website)) {
        setNotice(hi
          ? `आपके काम की ${r.data.aiPhotos} pictures बनाई गईं ताकि website खाली न लगे। अपनी असली photos लगाते ही ये हट जाएँगी: My website → "photos needed"।`
          : `${r.data.aiPhotos} pictures were made for your trade so the website is not empty. Your real photos replace them the moment you add some: My website → "photos needed".`);
      } else if (r.data.aiPhotos) {
        setNotice(hi
          ? `आपका card उस website के look में बना है, और उसे भरने के लिए आपके काम की ${r.data.aiPhotos === 1 ? "1 picture" : `${r.data.aiPhotos} pictures`} बनाई गई — किसी और site की photo हम कभी copy नहीं करते। अपनी photo जब चाहें लगा लें: Edit card → जो photo बदलनी है।`
          : `Your card was built in that website's look, and ${r.data.aiPhotos === 1 ? "a picture was" : `${r.data.aiPhotos} pictures were`} made for your trade to fill it — we never copy another site's photos. Swap them for your own any time: Edit card → the photo you want to change.`);
      } else if (facts.websiteRole === "reference" && facts.website) {
        setNotice(T("Your card was built in that website's look, with photos of your trade — we never copy another site's pictures. Put your own photos in any time: Edit card → the photo you want to change.", "आपका card उस website के look में बना है, photos आपके काम की हैं — किसी और site की photo हम कभी copy नहीं करते। अपनी photos जब चाहें डाल लें: Edit card → जो photo बदलनी है।"));
      } else if (found && !found.products && !found.photos && facts.websiteRole !== "reference") {
        setNotice(T("We opened your website but it had nothing we could read — its pages are drawn by JavaScript, so they are empty until a browser runs them. Your card was made from your other details. Add your products below (or on the Products screen) and they will appear with photos and prices.", "आपकी website खुली, पर पढ़ने के लिए कुछ नहीं मिला — उसके page JavaScript से बनते हैं, इसलिए browser चलाए बिना खाली रहते हैं। आपका card बाकी जानकारी से बना है। नीचे (या Products screen पर) अपने products डाल दें — photo और price के साथ दिख जाएँगे।"));
      } else if (r.data.standIns?.length) {
        // What the build had to stand in for (card-audit.ts): said plainly, so the owner knows what to replace.
        const si = r.data.standIns;
        const parts: string[] = [];
        if (si.includes("stock-photos")) parts.push(T("the photos are stock pictures of your trade — swap in your own from Edit card", "photos आपके काम की stock pictures हैं — Edit card से अपनी photos लगा लें"));
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
      // The very first card, with nothing to double-check: live straight away. Anything else waits for the button.
      if (!live && nextChecks.length === 0) void goLive(full, me);
    } catch {
      setErr(job.cancelled ? "" : T(OFFLINE, "internet नहीं है — दोबारा try करें।")); setState(back);
    } finally {
      clearTimeout(guard);
      if (jobRef.current === job) jobRef.current = null;
    }
  }

  /* ---------------- publish ---------------- */

  /** The first card goes live on its own. A failure just leaves the "Make it live" button, nothing is lost. */
  async function goLive(full: Card, me: string) {
    setBusy("publish");
    try {
      // "Both — my business and Shubhora": the first card goes live from here without ever reaching publish(),
      // so the hidden Shubhora page is added here too — otherwise the choice made at set-up was simply lost.
      let out = full;
      const addShubhora = alsoShubhora && !hasShubhoraPage(out);
      if (addShubhora) out = withShubhoraPage(out, { visible: false });
      const r = await publishCard(out);
      if (!r.ok) return;
      if (addShubhora) {
        setAlsoShubhora(false);
        await getBrowserSupabase()?.auth.updateUser({ data: { also_shubhora: null } }).catch(() => undefined);
      }
      if (me) { dropKey(draftKey(me)); dropKey(formKey(me)); }
      setCard((c) => (c ? { ...out, username: r.username || c.username } : c));
      setLiveUser(r.username || out.username);
      // The finished flow (owner's call, 2 Oct 2026): the website first, then the card, then OK → home.
      setTab("site");
      try {
        const cards = await fetchMyCardsStrict();
        const row = cards.find((c) => c.username === (r.username || out.username));
        if (row) {
          setExisting(row); setLiveSig(cardSig(row));
          await api("/api/card/facts", { method: "PATCH", json: { facts: { primaryCardId: row.id } } });
        }
      } catch { /* the card is live; the primary mark can wait */ }
    } catch { /* offline: the button stays */ } finally { setBusy(""); }
  }

  async function publish() {
    if (!shown || !card) return;
    if (existing && existing.active && !isThinCard(existing) && !liveUser && !confirm(T("Update your live V-Card? Your link, QR code, verified badge and settings stay the same.", "अपना live V-Card update करें? आपका link, QR code, verified badge और settings वैसे ही रहेंगे।"))) return;
    setBusy("publish"); setErr("");
    try {
      // The live card is read again and the new words are merged into THAT, not into the copy this preview was
      // made from. Anything the owner changed in the editor meanwhile (popup, pixels, a new page, the design)
      // therefore stays, instead of being overwritten by an older preview.
      let out = shown;
      // mergeBuiltCard replaces the card's pages with the newly built ones, so a Shubhora page that is
      // already live would be thrown away by a rebuild. Remember it (and whether its tab was switched on)
      // and put it back below.
      let keepShubhora = hasShubhoraPage(shown);
      let shubhoraVisible = !shown.pages.find((p) => p.slug === SHUBHORA_PAGE_SLUG)?.hidden;
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
        out = applyChecks(mergeBuiltCard(live, built, { id: live?.id ?? card.id, username: card.username }), checks, off);
      }
      // "Both — my business and Shubhora": the Shubhora page rides along on the first publish, so the choice
      // made at set-up is not lost on the way to the finished card. It is appended last and marked hidden, so
      // the card still opens on the owner's own home page and their customers never see it. A page that was
      // already live is put back the same way, with its tab left however the owner had it.
      const addShubhora = (alsoShubhora || keepShubhora) && !hasShubhoraPage(out);
      if (addShubhora) out = withShubhoraPage(out, { visible: keepShubhora && shubhoraVisible });
      const r = await publishCard(out);
      if (!r.ok) { setErr(r.error); return; }
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
        if (row) await api("/api/card/facts", { method: "PATCH", json: { facts: { primaryCardId: row.id } } });
      } catch { /* the card is live; the primary mark can wait */ }
      // The same finished flow as an automatic build: website first, then the card, then OK → home.
      setCard((c) => (c ? { ...out, username: r.username || c.username } : c));
      setLiveUser(r.username || out.username);
      setTab("site");
      try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
    } catch {
      setErr(T(OFFLINE, "internet नहीं है — दोबारा try करें।"));
    } finally {
      setBusy("");
    }
  }

  function editFirst() {
    if (!shown) return;
    // Already live from this screen: the editor opens the live card itself (no stale copy on top of it).
    if (liveUser && existing) { router.push(`/poster/d/editor?id=${existing.id}`); return; }
    try { sessionStorage.setItem(SEED_KEY, JSON.stringify(shown)); } catch { /* private mode */ }
    // The editor takes over from here: this saved preview must never come back later and undo what is done there.
    if (uid) { dropKey(draftKey(uid)); dropKey(formKey(uid)); }
    router.push(existing ? `/poster/d/editor?id=${existing.id}&seed=1` : "/poster/d/editor?seed=1");
  }

  /** A "Make it better" chip: back to the form, at the exact question. */
  function goto(key: MissingKey) {
    if (key === "reviews") { router.push("/poster/testimonials"); return; }
    const id = key === "banner" ? "q-photos"
      : key === "hours" ? "q-hours"
      : key === "upi" ? "q-pay"
      : key === "map" ? "q-map"
      : key === "qualification" ? "q-qual"
      : key === "ownPhotos" ? "q-photos"
      : "q-products";
    setState("form");
    setTimeout(() => {
      if (reviewRef.current) reviewRef.current.open = true;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  /* ---------------- screens ---------------- */

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
    const looking = rows.some((r) => r.name.trim() && r.brand.trim()) || !!(facts.website || setup?.website);
    // A website of their own (or their brand's) is read page by page — a JavaScript-built one in a real
    // browser — and that is the slow part: say so, rather than promising a minute and taking two.
    const readingSite = !!(facts.website && facts.websiteRole !== "reference") || (!facts.website && !!setup?.website);
    const stage = elapsed < 6 ? T("Reading your details…", "आपकी जानकारी पढ़ी जा रही है…")
      : readingSite && elapsed < 90 ? T("Reading your website — logo, photos, products…", "आपकी website पढ़ी जा रही है — logo, photos, products…")
      : looking && elapsed < 18 ? T("Finding product details…", "Product की जानकारी ढूँढी जा रही है…")
      : T("Writing your V-Card…", "आपका V-Card लिखा जा रहा है…");
    return (
      <div className="py-24 grid place-items-center gap-3 text-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-brand" />
        <p className="font-semibold">{stage}</p>
        <p className="text-sm text-muted">{readingSite ? T("Reading your website too — up to 2 minutes. Please keep this screen open.", "आपकी website भी पढ़ी जा रही है — 2 मिनट तक लग सकते हैं। ये screen खुली रखें।") : T("Usually 20-60 seconds", "आम तौर पर 20-60 second")}</p>
        {readingSite && !hi && <p className="text-xs text-muted">आपकी website पढ़ी जा रही है — 1-2 मिनट लग सकते हैं, screen बंद न करें</p>}
        {/* No way back while it builds (owner, 4 Oct 2026): a build left half-way cost money and showed nothing. */}
        <p className="text-xs text-muted">{T("About a minute — the pictures, the words and the design are all made for you.", "करीब एक मिनट — pictures, शब्द और design सब आपके लिए बन रहे हैं।")}</p>
      </div>
    );
  }

  if (state === "preview" && shown) return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setState("form")} className="text-muted" aria-label={T("Back to the questions", "सवालों पर वापस")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold">{liveUser ? T("Your website and card are live", "आपकी website और card live हैं") : busy === "publish" ? T("Making your website live…", "आपकी website live की जा रही है…") : existing ? T("Your new website is ready", "आपकी नई website तैयार है") : T("Your website is ready", "आपकी website तैयार है")}</h1>
      </div>
      {designNote && <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">🎨 {T("Designer", "Designer")}: {designNote}</p>}
      {/* One clear line: live or not. */}
      {liveUser ? (
        <div className="flex items-center gap-3 rounded-xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm"><CheckCircle2 className="h-6 w-6 shrink-0 text-good" /><p><b className="text-good">{T("Website live · Card live", "Website live · Card live")}</b><span className="block text-xs text-muted">{T("One link does both: it opens as your website on a computer and as your card on a phone. See the website first, then the card, then tap OK.", "एक ही link दोनों काम करता है: computer पर website खुलती है, phone पर card। पहले website देखें, फिर card, फिर OK दबाएँ।")}</span></p></div>
      ) : busy !== "publish" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber/50 bg-amber/10 px-3 py-2.5 text-sm"><CircleDashed className="h-6 w-6 shrink-0 text-amber" /><p><b>{T("Not published yet", "अभी publish नहीं हुआ")}</b><span className="block text-xs text-muted">{existing ? T("Your current card stays as it is until you tap Save.", "Save दबाने तक आपका पुराना card वैसा ही रहेगा।") : T("Tap Save to make your card live.", "Save दबाएँ, card live हो जाएगा।")}</span></p></div>
      )}
      {notice && <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">{notice}</p>}

      <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm"><span className="text-muted">{T("Your link: ", "आपका link: ")}</span><b className="break-all">{SITE_HOST}/c/{username}</b></p>
          {!editLink && <button type="button" onClick={() => { setLinkVal(username); setLinkCheck({ state: "idle" }); setEditLink(true); }} className="shrink-0 text-sm font-semibold text-brand-ink underline">{T("Change", "बदलें")}</button>}
        </div>
        {/* One tap: the link from the business name or from your name (owner's call, 25 Sep 2026). */}
        {!editLink && linkOpts.name && linkOpts.business && (
          <div className="grid grid-cols-2 gap-2">
            {([["business", linkOpts.business!, T("Business name", "Business का नाम")], ["name", linkOpts.name!, T("Your name", "आपका नाम")]] as const).map(([k, slug, label]) => {
              const on = username === slug;
              return (
                <button key={k} type="button" onClick={() => { setCard((c) => (c ? { ...c, username: slug } : c)); void setLinkPref(k); }}
                  className={`rounded-xl border-2 px-2.5 py-2 text-left ${on ? "border-brand bg-brand-soft" : "border-border"}`}>
                  <span className="flex items-center gap-1 text-[11px] text-muted">{on && <Check className="h-3 w-3 text-brand" />}{label}</span>
                  <span className="block truncate text-xs font-semibold">/c/{slug}</span>
                </button>
              );
            })}
          </div>
        )}
        {editLink && (
          <div className="space-y-2">
            <input value={linkVal} onChange={(e) => setLinkVal(e.target.value)} autoCapitalize="none" spellCheck={false} placeholder="your-name" className={`${box} w-full`} />
            {linkCheck.state === "checking" && <p className="text-xs text-muted">{T("Checking…", "देख रहे हैं…")}</p>}
            {linkCheck.state === "ok" && <p className="text-xs font-semibold text-good">✓ {SITE_HOST}/c/{cleanUsername(linkVal)} {T("is free", "खाली है")}</p>}
            {linkCheck.state === "bad" && <p className="text-xs font-semibold text-danger">{linkCheck.reason}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={linkBad} onClick={() => { setCard((c) => (c ? { ...c, username: cleanUsername(linkVal) } : c)); setEditLink(false); }} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{T("Save link", "link save करें")}</button>
              <button type="button" onClick={() => setEditLink(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">{T("Cancel", "रहने दें")}</button>
            </div>
          </div>
        )}
      </div>

      {checks.length > 0 && (
        <div className="space-y-2 rounded-2xl border-2 border-amber/40 bg-amber/10 p-4">
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

      {missing.length > 0 && (
        <div className="space-y-2">
          <p className="text-[15px] font-semibold">{T("Make it better", "और अच्छा बनाएँ")}</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => <button key={m.key} type="button" onClick={() => goto(m.key)} className="rounded-full border-2 border-border bg-surface px-3.5 py-2 text-sm font-medium">{m.label}</button>)}
          </div>
        </div>
      )}

      {/* Five looks (owner's call, 4 Oct 2026): the designer's first, four more opinions; back to the first any time. */}
      {looks.length > 0 && shown.site && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">{T("Look", "Look")} <span className="font-normal">— {T("tap to try another; the words and pictures stay", "दूसरा देखें; शब्द और photos वही रहेंगे")}</span></p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {looks.map((l, i) => {
              const on = lookKey === l.key;
              return (
                <button key={l.key} type="button" onClick={() => pickLook(l.key)} aria-pressed={on}
                  className={`shrink-0 rounded-xl border-2 px-3 py-2 text-left ${on ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
                  <span className="block text-sm font-semibold">{i + 1}. {hi ? l.hi : l.name}</span>
                  <span className="block text-[11px] text-muted">{hi ? l.blurbHi : l.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div ref={previewRef} className="grid scroll-mt-20 grid-cols-2 gap-2 rounded-xl bg-surface2 p-1">
        {(liveUser
          ? ([["site", T("1. Website", "1. Website"), Globe], ["phone", T("2. Card", "2. Card"), Smartphone]] as const)
          : ([["phone", T("Phone", "Phone"), Smartphone], ["site", T("Website", "Website"), Globe]] as const)
        ).map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-surface shadow-sm" : "text-muted"}`}>
            <I className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>

      {tab === "phone" ? (
        <div className="-mx-4 rounded-none border-y border-border bg-surface2/40 py-4">
          <CardView card={{ ...shown, username: "__preview" }} qr={qr} shareUrl={`${SITE_URL}/c/${username}`} />
        </div>
      ) : (
        <div>
          <div ref={frameRef} className="overflow-hidden rounded-xl border border-border bg-white" style={{ height: 1600 * scale }}>
            <iframe title="Website preview" src="/preview/site" style={{ width: 1280, height: 1600, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
          </div>
          <p className="mt-1.5 text-center text-xs text-muted">{T("This is how your link opens on a computer.", "आपका link computer पर ऐसे खुलता है।")}{liveUser && <> <a href={`${SITE_URL}/c/${username}?view=site`} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink underline">{T("Open the live website", "Live website खोलें")}</a></>}</p>
        </div>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="sticky bottom-20 z-20 space-y-2 rounded-2xl border border-border bg-surface p-2.5 shadow-float">
        {liveUser && username === liveUser ? (
          tab === "site" ? (
            /* Step 1 of the finished flow: the website is on screen; next comes the card. */
            <div className="grid grid-cols-2 gap-2">
              <a href={`${SITE_URL}/c/${username}?view=site`} target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-base font-semibold"><Globe className="h-5 w-5" /> {T("Open website", "Website खोलें")}</a>
              <button type="button" onClick={() => { setTab("phone"); try { previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* ignore */ } }} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white">{T("Next: your card →", "आगे: आपका card →")}</button>
            </div>
          ) : (
            /* Step 2: the card is on screen; share it, or OK → home. */
            <div className="grid grid-cols-2 gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital visiting card है — contact, products और बाकी सब एक tap में: ${SITE_URL}/c/${username}` : `Hi! Here is my digital visiting card — contact, products and more in one tap: ${SITE_URL}/c/${username}`)}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-base font-semibold text-white">{T("Share on WhatsApp", "WhatsApp पर share करें")}</a>
              <button type="button" onClick={() => router.push("/poster")} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white"><Check className="h-5 w-5" /> {T("OK", "OK")}</button>
            </div>
          )
        ) : (
          <button type="button" onClick={publish} disabled={!!busy || (editLink && linkBad)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy === "publish" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {liveUser ? T("Save the new link", "नया link save करें") : T("Save", "Save करें")}
          </button>
        )}
        {/* Second-row actions as quiet links: the bar used to cover a quarter of the card preview. */}
        <div className="flex items-center justify-center gap-5 pt-0.5 text-sm font-semibold">
          <button type="button" onClick={editFirst} disabled={!!busy} className="inline-flex items-center gap-1.5 text-brand-ink disabled:opacity-60"><Pencil className="h-4 w-4" /> {liveUser ? T("Edit card", "Card edit करें") : T("Edit first", "पहले edit करें")}</button>
          <span className="h-4 w-px bg-border" />
          <button type="button" onClick={() => build({ fresh: true })} disabled={!!busy} className="inline-flex items-center gap-1.5 text-muted disabled:opacity-60"><Sparkles className="h-4 w-4" /> {T("Write again", "दोबारा लिखवाएँ")}</button>
        </div>
      </div>
      {unlock && <UnlockDialog reason={T("A studio photo uses 5 credits. Add credits or activate your plan — your own photo is kept meanwhile.", "Studio photo में 5 credit लगते हैं। Credit डालें या अपना plan चालू करें — तब तक आपकी photo वैसी ही रहेगी।")} onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );

  /* ---------------- the form ---------------- */

  const chip = (on: boolean) => `rounded-full border-2 px-3.5 py-2 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`;


  if (state === "make") {
    const li = (text: string) => <li className="flex items-start gap-2 text-sm"><span className="text-good">✓</span><span>{text}</span></li>;
    return (
      <div className="space-y-4 py-2">
        <ProfileSteps current="make" category={setup?.category} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push("/poster/products?setup=1")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="min-w-0 flex-1 text-xl font-bold">{T("Make my website & card", "मेरी website और card बनाएँ")}</h1>
        </div>
        <p className="text-sm text-muted">{T("Your profile is saved. One tap makes your website and digital card from it.", "आपकी profile save हो गई। एक tap में उससे आपकी website और digital card बन जाएँगे।")}</p>
        {/* Free: one button, no wall (owner's call, 3 Oct 2026: "make step easy, warna wo bana hi nahi payega"). */}
        <div className="space-y-3 rounded-2xl border-2 border-brand/40 bg-brand-soft/30 p-4">
          <div className="flex items-center justify-between"><p className="text-base font-bold">{T("Free", "Free")}</p><span className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-bold text-good">₹0</span></div>
          <ul className="space-y-1">
            {li(T("Website + digital card on one link, phone and computer", "Website + digital card एक link पर, phone और computer"))}
            {li(T("Your trade's own look and pages", "आपके काम का अपना look और pages"))}
            {li(T("Daily poster, leads in your CRM", "रोज़ का poster, leads आपके CRM में"))}
          </ul>
          <button type="button" onClick={() => { setPlan("standard"); void build(); }} disabled={!!busy} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
            <Sparkles className="h-5 w-5" /> {T("Make my free website", "मेरी free website बनाओ")}
          </button>
          <p className="text-center text-[11px] text-muted">{T("Carries a small FREE Shubhora tag. Premium removes it — any time, one tap.", "छोटा FREE Shubhora tag रहेगा। Premium में हट जाता है — कभी भी, एक tap।")}</p>
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between"><p className="text-base font-bold">Premium</p><span className="rounded-full bg-[#12144a] px-2 py-0.5 text-[11px] font-bold text-[#ffd54a]">{access.subscribed ? T("Your plan is on", "आपका plan चालू है") : T("₹2,999 / month", "₹2,999 / महीना")}</span></div>
          <ul className="space-y-1">
            {li(T("No Shubhora tag, website on Google", "Shubhora का tag नहीं, website Google पर"))}
            {li(T("AI edits — say what to change; your photos, AI pictures when needed", "AI से बदलाव — बस बोल दो; आपकी photos, ज़रूरत हो तो AI pictures"))}
            {li(T("WhatsApp AI 24×7, auto-post, your own domain", "WhatsApp AI 24×7, auto-post, अपना domain"))}
          </ul>
          {access.subscribed ? (
            <button type="button" onClick={() => { setPlan("premium"); void build(); }} disabled={!!busy || access.loading} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#12144a] py-4 text-base font-semibold text-white disabled:opacity-60">
              <Sparkles className="h-5 w-5 text-[#ffd54a]" /> {T("Make with Premium", "Premium से बनाओ")}
            </button>
          ) : (
            <button type="button" onClick={() => setPremiumUnlock(true)} disabled={access.loading} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#12144a] py-4 text-base font-semibold text-white disabled:opacity-60">
              <Sparkles className="h-5 w-5 text-[#ffd54a]" /> {T("Go Premium, then make", "Premium लें, फिर बनाओ")}
            </button>
          )}
        </div>
        <button type="button" onClick={() => { setState("form"); window.scrollTo({ top: 0 }); }} className="w-full text-center text-sm font-semibold text-brand-ink underline">{T("Advanced (optional): a website you like, the look, check your details →", "Advanced (optional): पसंद की website, look, details check →")}</button>
        {err && <p className="text-sm text-danger">{err}</p>}
        <p className="text-center text-xs text-muted">{T("The AI writes only from your details — no made-up prices or claims.", "AI सिर्फ़ आपकी जानकारी से लिखता है — price या दावे अपने से नहीं बनाता।")}</p>
        {premiumUnlock && <UnlockDialog subscriptionOnly title={T("Premium needs the Growth plan", "Premium के लिए Growth plan चाहिए")} reason={T("The website goes live on computers, the AI assistant answers customers and a video is made for you. Activate the plan, then tap Make again.", "Website computer पर live होती है, AI assistant ग्राहकों को जवाब देता है और आपके लिए video बनता है। Plan चालू करें, फिर Make दबाएँ।")} onClose={() => { setPremiumUnlock(false); access.refresh(); }} />}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <ProfileSteps current="make" category={setup?.category} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.push("/poster/products?setup=1")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 text-xl font-bold">{T("How should your website look?", "Website की पसंद")}</h1>
      </div>
      {/* A "Make it better" chip brings the owner here from a finished V-Card: this takes them back to it
          without paying for another build. */}
      {card && (
        <button type="button" onClick={() => setState("preview")} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold">
          <ChevronLeft className="h-4 w-4" /> {T("Back to my V-Card", "मेरे V-Card पर वापस")}
        </button>
      )}
      <p className="text-sm text-muted">{T("Step 4: a website you like and the look. Everything is optional — the AI writes the rest from your profile.", "Step 4: कोई website जो पसंद हो और look। सब optional है — बाकी AI आपकी profile से लिखता है।")}</p>

      {/* Out in the open (owner's call, 1 Oct 2026): this was buried inside "More details", and the three
          choices only appeared once a link had been typed — so hardly anyone ever found the reference-site
          option. It is one of the most useful answers on the form: a site we can read fills the whole card,
          and a site they merely like gives theirs that look. */}
      <Sec id="q-site" title={T("Your website — or a website you like (optional)", "आपकी website — या कोई website जो पसंद है (ज़रूरी नहीं)")}>
        <input value={facts.website} onChange={(e) => { setF({ website: e.target.value.trim() }); setFound(null); }} onBlur={() => void resolveSite()} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={setup?.website || T("e.g. yourbusiness.com, or just the name", "जैसे yourbusiness.com, या सिर्फ़ नाम")} className={field} />
        {finding && <p className="mt-1 text-xs text-muted">{T(`Searching the web for “${finding}”…`, `“${finding}” की website खोजी जा रही है…`)}</p>}
        {!finding && found && found.url && facts.website === found.url && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs"><span className="font-semibold text-good">✓ {T("Found", "मिली")}: {found.name}</span><span className="text-muted">{found.url.replace(/^https?:\/\//, "")}</span><button type="button" onClick={() => { setF({ website: "" }); setFound(null); }} className="font-semibold text-brand-ink underline">{T("Not this one", "ये नहीं")}</button></p>
        )}
        {!finding && found && !found.url && facts.website === found.q && (
          <p className="mt-1 text-xs text-amber">{T(`No website found for “${found.q}” — paste its link, or leave the box empty.`, `“${found.q}” की website नहीं मिली — उसका link डालें, या box खाली छोड़ दें।`)}</p>
        )}
        <p className="mt-1 text-xs text-muted">{T("Type a link, or just the name — we find the website. No website of your own? Put in one you like the look of — or a competitor’s — and we build yours in that style. Leave it empty if you would rather not.", "link लिखें, या सिर्फ़ नाम — website हम ढूँढ लेंगे। अपनी website नहीं है? कोई website डाल दें जिसका look पसंद है — या किसी competitor की — हम आपकी website उसी style में बना देंगे। न डालना हो तो खाली छोड़ दें।")}</p>
        <div className="mt-3">
          <p className="text-sm font-semibold">{T("This website is…", "ये website है…")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SITE_CARDS.filter((c) => c.k !== "none").map((c) => (
              <button key={c.k} type="button" onClick={() => setF({ websiteRole: c.k === "none" ? "own" : c.k })} className={chip(facts.websiteRole === c.k)}>{c.e} {hi ? c.th : c.t}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{hi ? SITE_CARDS.find((c) => c.k === facts.websiteRole)?.takesHi : SITE_CARDS.find((c) => c.k === facts.websiteRole)?.takes}</p>
          {facts.websiteRole === "dealer" && !!facts.website && (
            facts.dealerAssertedAt
              ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-good"><CheckCircle2 className="h-3.5 w-3.5" /> {T("Confirmed: you are this brand’s authorised dealer / distributor.", "Confirm हो गया: आप इस brand के authorised dealer / distributor हैं।")}</p>
              : <label className="mt-2 flex items-start gap-2.5 rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={false} onChange={() => setF({ dealerAssertedAt: new Date().toISOString() })} className="mt-0.5 h-4 w-4" />
                  <span>I am this brand’s authorised dealer / distributor and may show its product photos on my card. <span className="block text-xs text-muted">मैं इस brand का authorised dealer / distributor हूँ और इसके product photos अपने card पर दिखा सकता हूँ।</span></span>
                </label>
          )}
        </div>
      </Sec>

      <Sec id="q-look" title={T("How should your website look?", "आपकी website कैसी दिखे?")} hint={T("Auto: our designer AI picks the look from your trade and details when the website is made — a jeweller gets gold and serif, a clinic calm blue, a school warm and clear. Change anything here and your choice wins.", "Auto: website बनते समय हमारा designer AI आपके काम और details से look चुनता है — jeweller को gold और serif, clinic को शांत नीला, school को warm और साफ़। यहाँ कुछ भी बदलें, आपकी पसंद ऊपर रहेगी।")}>
        <LookPicker value={facts.style ?? {}} onChange={(style) => setF({ style })} categoryKey={setup?.category ?? ""} hi={hi} business={setup?.business || setup?.person || ""} />
      </Sec>

      {/* Steps 2 and 3 again, folded (owner's flow, 2 Oct 2026): the company and product answers were given on
          their own screens; here they are checked, and a "Make it better" chip lands on the exact question. */}
      <details id="q-review" ref={reviewRef} className="group rounded-2xl border border-border bg-surface2/40">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          <span>{T("Check your details", "अपनी जानकारी देखें")} <span className="text-sm font-normal text-muted">({T("products, photos, timings, payments…", "products, photos, समय, payment…")})</span></span>
          <span className="text-xs font-semibold text-brand-ink">{T("Open", "खोलें")}</span>
        </summary>
        <div className="space-y-3 border-t border-border p-3">
      <Sec id="q-products" title={T("Your products or services", "आपके products या services")} hint={T("Add a photo, the price and the brand. Brand and price are optional.", "photo, price और brand डालें। Brand और price optional हैं।")}>
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
                if (r.id) { if (r.name.trim()) setF({ hidden: [...facts.hidden, r.name.trim().toLowerCase()] }); setRemoved(T("Removed from your V-Card (still on your Products page)", "V-Card से हटा दिया (आपके Products page पर रहेगा)")); }
                setRows(rows.filter((_, k) => k !== i)); setEdits((n) => n + 1);
              }} className="shrink-0 rounded-lg border border-border p-2 text-muted" aria-label={T("Remove this product", "ये product हटाएँ")}><X className="h-4 w-4" /></button>
            </div>
            {r.note && (
              <p className="text-xs text-muted">
                {r.note}
                {r.studio && r.original && r.original !== r.photo && (
                  <button type="button" onClick={() => patchRow(i, { photo: r.original ?? "", studio: false, note: "" })} className="ml-1.5 font-semibold text-brand-ink underline">{T("Use original", "पुरानी photo रखें")}</button>
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
        {removed && <p className="text-xs text-muted">{removed}</p>}
        {brandProducts && <p className="text-xs text-muted">{T("✓ Your company’s products are shown on your V-Card.", "✓ आपकी company के products आपके V-Card पर दिख रहे हैं।")}</p>}
        {rows.length < MAX_ROWS && (
          <button type="button" onClick={() => { setRows([...rows, emptyRow()]); setEdits((n) => n + 1); }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" /> {T("Add one more", "एक और जोड़ें")}</button>
        )}
      </Sec>

          {!!setup?.category && <TradeQuestions category={setup.category} facts={facts} setF={setF} hi={hi} />}
          <FactsFields group="company" facts={facts} setF={setF} hi={hi} professional={setup?.persona === "professional"} hasAbout={!!setup?.about} />
          <FactsFields group="products" facts={facts} setF={setF} hi={hi} hasAbout={!!setup?.about} category={setup?.category} />
        </div>
      </details>


      {err && <p className="text-sm text-danger">{err}</p>}
      <button type="button" id="make" onClick={async () => { await resolveSite(); setPlan(access.subscribed ? "premium" : "standard"); setState("make"); window.scrollTo({ top: 0 }); }} disabled={!!busy || !!finding} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
        <Check className="h-5 w-5" /> {T("Save and continue →", "Save करके आगे बढ़ें →")}
      </button>
      <p className="text-center text-xs text-muted">{T("Next: choose Standard (free) or Premium, then make it.", "आगे: Standard (free) या Premium चुनें, फिर बनाएँ।")}</p>
      {unlock && <UnlockDialog reason={T("A studio photo uses 5 credits. Add credits or activate your plan — your own photo is kept meanwhile.", "Studio photo में 5 credit लगते हैं। Credit डालें या अपना plan चालू करें — तब तक आपकी photo वैसी ही रहेगी।")} onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );
}
