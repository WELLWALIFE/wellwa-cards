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
import { api, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { compressToFile, dataUrlToFile } from "@/lib/image-utils";
import { checkUsername, cleanUsername, fetchMyCardsStrict, publishCard, suggestUsername, OFFLINE, type UsernameCheck } from "@/lib/cloud";
import { SHUBHORA_PAGE_SLUG, hasShubhoraPage, withShubhoraPage } from "@/lib/shubhora-page";
import { CardView } from "@/components/card-view";
import { ImageCropper } from "@/components/editor/image-cropper";
import { SITE_HOST, SITE_URL } from "@/lib/site-url";
import type { Card, CardBlock } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import { SEED_KEY } from "@/lib/card-personalize";
import { getLinkPref, linkOptions, setLinkPref } from "@/lib/link-pref";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { CreditPrice, UnlockDialog, useAiAccess } from "@/lib/ai-access";
import {
  UPI_RE, isThinCard, mergeBuiltCard, normalizeFacts,
  type BuildRequest, type BuildResponse, type BuildRow, type CardFacts, type FactsResponse,
  type Missing, type MissingKey, type SetupInfo, type WebCheck,
} from "@/lib/card-facts";

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
/** A change to some of the answers; `social` may carry only the one link that changed. */
type FactsPatch = Partial<Omit<CardFacts, "social">> & { social?: Partial<CardFacts["social"]> };
const emptyRow = (): Row => ({ name: "", brand: "", price: "", photo: "" });

const draftKey = (uid: string) => `vcard-draft:${uid}`;
const formKey = (uid: string) => `vcard-form:${uid}`;
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

/** One question box — big and simple. The id is what a "Make it better" chip scrolls to. */
function Sec({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-2 rounded-2xl border border-border bg-surface p-4">
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </section>
  );
}

// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; alt?: string; className?: string }) => <img src={p.src} alt={p.alt ?? ""} className={p.className} />;

export default function BuildCard() {
  const router = useRouter();
  const access = useAiAccess();

  const [state, setState] = useState<"loading" | "error" | "form" | "building" | "preview">("loading");
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
  const [crop, setCrop] = useState("");
  const [unlock, setUnlock] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // First V-Card (owner's call, 25 Sep 2026): it goes live by itself the moment the AI finishes — no "is it live or
  // not?" moment. `liveUser` is the link it went live on; a changed link afterwards needs one more save.
  const [liveUser, setLiveUser] = useState("");
  // The two ready links for this card — your name / business name — for one-tap switching on the preview.
  const [linkOpts, setLinkOpts] = useState<{ name: string | null; business: string | null }>({ name: null, business: null });

  const moreRef = useRef<HTMLDetailsElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
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
      try {
        const u = new URL(window.location.href);
        again = u.searchParams.get("again") === "1";
        if (again) { u.searchParams.delete("again"); window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`); }
      } catch { /* ignore */ }

      const [cards, fr] = await Promise.all([fetchMyCardsStrict(), api<FactsResponse>("/api/card/facts")]);
      if (!fr.ok) throw new Error("facts");
      const server = fr.data;
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
        setState("preview");
        return;
      }
      // The owner's rule: reaching the V-Card with nothing real yet makes the card at once. The form
      // below stays as the "Make it better" path; the draft it saves stops any second build.
      // An owner who has already started answering (a saved form backup) is left alone with their
      // answers — otherwise a reload would take a half-filled form away from them.
      setState("form");
      if ((again || ((!live || isThinCard(live)) && !backup)) && !autoRef.current) {
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
    if (v.length < 3) { setLinkCheck({ state: "bad", reason: "At least 3 characters." }); return; }
    setLinkCheck({ state: "checking" });
    const t = setTimeout(async () => {
      try { setLinkCheck(await checkUsername(v, existing?.id)); } catch { setLinkCheck({ state: "idle" }); }
    }, 400);
    return () => clearTimeout(t);
  }, [linkVal, editLink, existing?.id]);

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
      if (!url) { patchRow(i, { busy: false, note: "Could not upload the photo. Please try again." }); return; }
      patchRow(i, { photo: url, original: url, studio: false, busy: false });
    } catch {
      patchRow(i, { busy: false, note: OFFLINE });
    }
  }

  async function studio(i: number) {
    const row = rows[i];
    if (!row?.photo) return;
    if (!access.active || access.balance < 5) { setUnlock(true); return; }
    patchRow(i, { busy: true, note: "Making it look professional… (about 20 seconds)" });
    try {
      const r = await api<{ url?: string; error?: string }>("/api/card/product-photo", {
        method: "POST",
        json: { photo_url: row.photo, product: row.name, brand: row.brand, allowPaid: true, product_id: row.id },
      });
      if (r.ok && r.data.url) patchRow(i, { original: row.photo, photo: r.data.url, studio: true, busy: false, note: "✨ Studio photo ready" });
      else { patchRow(i, { busy: false, note: r.data.error ?? "Your photo is kept as it is." }); if (r.status === 402) setUnlock(true); }
    } catch {
      patchRow(i, { busy: false, note: OFFLINE });
    } finally {
      access.refresh();
    }
  }

  async function banner(dataUrl: string) {
    setCrop(""); setErr("");
    setBusy("banner");
    try {
      const url = await uploadImage(dataUrlToFile(dataUrl, "banner.jpg"), "wide");
      if (url) setF({ bannerUrl: url }); else setErr("Could not upload the photo. Please try again.");
    } catch { setErr(OFFLINE); } finally { setBusy(""); }
  }

  async function addPhoto(f: File) {
    if (facts.photos.length >= 5) return;
    setBusy("photo"); setErr("");
    try {
      const url = await uploadImage(await compressToFile(f, "photo.jpg", 1600, 0.85), "wide");
      if (url) setF({ photos: [...facts.photos, url].slice(0, 5) }); else setErr("Could not upload the photo. Please try again.");
    } catch { setErr(OFFLINE); } finally { setBusy(""); }
  }

  function pickFile(f: File) {
    const r = new FileReader();
    r.onload = () => setCrop(String(r.result || ""));
    r.onerror = () => setErr("Could not open that photo.");
    r.readAsDataURL(f);
  }

  /* ---------------- build ---------------- */

  /** The whole build. The load pass hands in what it just read, because this function was made before
   *  that state existed; every other caller uses what is on screen. */
  async function build(over?: { facts?: CardFacts; rows?: Row[]; existing?: Card | null; uid?: string; back?: "form" | "preview" }) {
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
      const body: BuildRequest = { facts: { ...f, primaryCardId: undefined }, products };
      const r = await api<Partial<BuildResponse> & { error?: string }>("/api/card/build", { method: "POST", json: body, signal: job.ctrl.signal });
      const built = r.data?.card;
      if (!r.ok || !built) { setErr(r.data?.error || "Could not make your V-Card. Please try again."); setState(back); return; }

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
      setCard(full); setBuilt(built); setLiveSig(sig); setChecks(nextChecks); setMissing(nextMissing); setOff([]); setTab("phone");
      if (me) writeJson(draftKey(me), { card: full, built, liveSig: sig, checks: nextChecks, missing: nextMissing, off: [], savedAt: Date.now() } satisfies Draft);
      // Three different things, which used to be one vague line:
      //   • the site could not be opened at all;
      //   • it opened and gave us nothing, because it is built in JavaScript — the page is empty until a
      //     browser runs its scripts, so there is nothing for us (or anything else that does not run them)
      //     to read. Saying "could not open it" there was simply wrong;
      //   • it opened and gave us products and pictures, which is the normal case and needs no notice.
      const found = r.data.siteFound;
      if (r.data.siteRead === false) {
        setNotice(facts.websiteRole === "reference" && facts.website
          ? "We could not open that website, so your card got our own look — you can change it any time under My website → Edit website."
          : "We could not open your website, so your V-Card was made from your other details.");
      } else if (r.data.aiPhotos) {
        setNotice(`Your card was built in that website's look, and ${r.data.aiPhotos === 1 ? "a picture was" : `${r.data.aiPhotos} pictures were`} made for your trade to fill it — we never copy another site's photos. Swap them for your own any time: Edit card → the photo you want to change.`);
      } else if (facts.websiteRole === "reference" && facts.website) {
        setNotice("Your card was built in that website's look, with photos of your trade — we never copy another site's pictures. Put your own photos in any time: Edit card → the photo you want to change.");
      } else if (found && !found.products && !found.photos && facts.websiteRole !== "reference") {
        setNotice("We opened your website but it had nothing we could read — its pages are drawn by JavaScript, so they are empty until a browser runs them. Your card was made from your other details. Add your products below (or on the Products screen) and they will appear with photos and prices.");
      }
      setState("preview");
      try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
      // The very first card, with nothing to double-check: live straight away. Anything else waits for the button.
      if (!live && nextChecks.length === 0) void goLive(full, me);
    } catch {
      setErr(job.cancelled ? "" : OFFLINE); setState(back);
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
      const r = await publishCard(full);
      if (!r.ok) return;
      if (me) { dropKey(draftKey(me)); dropKey(formKey(me)); }
      setCard((c) => (c ? { ...c, username: r.username || c.username } : c));
      setLiveUser(r.username || full.username);
      try {
        const cards = await fetchMyCardsStrict();
        const row = cards.find((c) => c.username === (r.username || full.username));
        if (row) {
          setExisting(row); setLiveSig(cardSig(row));
          await api("/api/card/facts", { method: "PATCH", json: { facts: { primaryCardId: row.id } } });
        }
      } catch { /* the card is live; the primary mark can wait */ }
    } catch { /* offline: the button stays */ } finally { setBusy(""); }
  }

  async function publish() {
    if (!shown || !card) return;
    if (existing && existing.active && !isThinCard(existing) && !liveUser && !confirm("Update your live V-Card? Your link, QR code, verified badge and settings stay the same.")) return;
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
        } catch { setErr(OFFLINE); return; }
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
      router.push("/poster/website?published=1");
    } catch {
      setErr(OFFLINE);
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
      : "q-products";
    setState("form");
    setTimeout(() => {
      if (key === "map" && moreRef.current) moreRef.current.open = true;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  /* ---------------- screens ---------------- */

  if (state === "loading") return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  if (state === "error") return (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">No internet — tap to try again</p>
      <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> Try again
      </button>
    </div>
  );

  if (state === "building") {
    const looking = rows.some((r) => r.name.trim() && r.brand.trim()) || !!(facts.website || setup?.website);
    const stage = elapsed < 6 ? "Reading your details…" : looking && elapsed < 18 ? "Finding product details…" : "Writing your V-Card…";
    return (
      <div className="py-24 grid place-items-center gap-3 text-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-brand" />
        <p className="font-semibold">{stage}</p>
        <p className="text-sm text-muted">Usually 20-60 seconds</p>
        <button type="button" onClick={() => { const j = jobRef.current; if (j) { j.cancelled = true; j.ctrl.abort(); } }} className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Take me back</button>
      </div>
    );
  }

  if (state === "preview" && shown) return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setState("form")} className="text-muted" aria-label="Back to the questions"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold">{liveUser ? "Your website is live" : busy === "publish" ? "Making your website live…" : existing ? "Your new website is ready" : "Your website is ready"}</h1>
      </div>
      {/* One clear line: live or not. */}
      {liveUser ? (
        <div className="flex items-center gap-3 rounded-xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm"><CheckCircle2 className="h-6 w-6 shrink-0 text-good" /><p><b className="text-good">Your card is live</b><span className="block text-xs text-muted">Send it on WhatsApp. Want to change something? Tap Edit.</span></p></div>
      ) : busy !== "publish" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber/50 bg-amber/10 px-3 py-2.5 text-sm"><CircleDashed className="h-6 w-6 shrink-0 text-amber" /><p><b>Not published yet</b><span className="block text-xs text-muted">{existing ? "Your current card stays as it is until you tap Save." : "Tap Save to make your card live."}</span></p></div>
      )}
      {notice && <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">{notice}</p>}

      <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm"><span className="text-muted">Your link: </span><b className="break-all">{SITE_HOST}/c/{username}</b></p>
          {!editLink && <button type="button" onClick={() => { setLinkVal(username); setLinkCheck({ state: "idle" }); setEditLink(true); }} className="shrink-0 text-sm font-semibold text-brand-ink underline">Change</button>}
        </div>
        {/* One tap: the link from the business name or from your name (owner's call, 25 Sep 2026). */}
        {!editLink && linkOpts.name && linkOpts.business && (
          <div className="grid grid-cols-2 gap-2">
            {([["business", linkOpts.business!, "Business name"], ["name", linkOpts.name!, "Your name"]] as const).map(([k, slug, label]) => {
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
            {linkCheck.state === "checking" && <p className="text-xs text-muted">Checking…</p>}
            {linkCheck.state === "ok" && <p className="text-xs font-semibold text-good">✓ {SITE_HOST}/c/{cleanUsername(linkVal)} is free</p>}
            {linkCheck.state === "bad" && <p className="text-xs font-semibold text-danger">{linkCheck.reason}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={linkBad} onClick={() => { setCard((c) => (c ? { ...c, username: cleanUsername(linkVal) } : c)); setEditLink(false); }} className="rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Save link</button>
              <button type="button" onClick={() => setEditLink(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {checks.length > 0 && (
        <div className="space-y-2 rounded-2xl border-2 border-amber/40 bg-amber/10 p-4">
          <p className="text-[15px] font-semibold">Please check</p>
          <p className="text-xs text-muted">These details came from the maker&apos;s website. Keep only what is right.</p>
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
          <p className="text-[15px] font-semibold">Make it better</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => <button key={m.key} type="button" onClick={() => goto(m.key)} className="rounded-full border-2 border-border bg-surface px-3.5 py-2 text-sm font-medium">{m.label}</button>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface2 p-1">
        {([["phone", "Phone", Smartphone], ["site", "Website", Globe]] as const).map(([k, l, I]) => (
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
          <p className="mt-1.5 text-center text-xs text-muted">This is how your link opens on a computer.</p>
        </div>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="sticky bottom-20 z-20 space-y-2 rounded-2xl border border-border bg-surface p-2.5 shadow-float">
        {liveUser && username === liveUser ? (
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here is my digital visiting card — contact, products and more in one tap: ${SITE_URL}/c/${username}`)}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-base font-semibold text-white">Share on WhatsApp</a>
            <button type="button" onClick={() => router.push("/poster/website?published=1")} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3 text-base font-semibold text-white"><Check className="h-5 w-5" /> Done</button>
          </div>
        ) : (
          <button type="button" onClick={publish} disabled={!!busy || (editLink && linkBad)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy === "publish" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {liveUser ? "Save the new link" : "Save"}
          </button>
        )}
        {/* Second-row actions as quiet links: the bar used to cover a quarter of the card preview. */}
        <div className="flex items-center justify-center gap-5 pt-0.5 text-sm font-semibold">
          <button type="button" onClick={editFirst} disabled={!!busy} className="inline-flex items-center gap-1.5 text-brand-ink disabled:opacity-60"><Pencil className="h-4 w-4" /> {liveUser ? "Edit card" : "Edit first"}</button>
          <span className="h-4 w-px bg-border" />
          <button type="button" onClick={() => build()} disabled={!!busy} className="inline-flex items-center gap-1.5 text-muted disabled:opacity-60"><Sparkles className="h-4 w-4" /> Write again</button>
        </div>
      </div>
      {unlock && <UnlockDialog reason="A studio photo uses 5 credits. Add credits or activate your plan — your own photo is kept meanwhile." onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );

  /* ---------------- the form ---------------- */

  const chip = (on: boolean) => `rounded-full border-2 px-3.5 py-2 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`;
  const toggle = (key: "customers" | "special" | "payments", v: string) => {
    const list = facts[key];
    setF({ [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] } as FactsPatch);
  };
  const upiOn = facts.payments.some((p) => /upi/i.test(p));

  const makeBtn = (
    <button type="button" onClick={() => build()} disabled={!!busy} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white disabled:opacity-60">
      <Sparkles className="h-5 w-5" /> Build my website
    </button>
  );

  return (
    <div className="space-y-4 py-2">
      {crop && <ImageCropper src={crop} aspect={3} outWidth={1500} format="jpeg" onApply={banner} onCancel={() => setCrop("")} />}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.push("/poster/setup")} className="text-muted" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 text-xl font-bold">Build your website</h1>
      </div>
      {/* A "Make it better" chip brings the owner here from a finished V-Card: this takes them back to it
          without paying for another build. */}
      {card && (
        <button type="button" onClick={() => setState("preview")} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold">
          <ChevronLeft className="h-4 w-4" /> Back to my V-Card
        </button>
      )}

      <div className="space-y-2.5 rounded-2xl border-2 border-amber/40 bg-amber/10 p-3.5">
        <p className="text-sm"><b>Everything below is optional.</b> <span className="text-muted">Tap now, or add details for a richer V-Card.</span></p>
        {makeBtn}
      </div>

      <Sec id="q-products" title="Your products or services" hint="Add a photo, the price and the brand. Brand and price are optional.">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="space-y-1.5 rounded-xl bg-surface2/60 p-2">
            <div className="flex items-start gap-2">
              {r.photo && <Img src={r.photo} className="h-14 w-14 shrink-0 rounded-lg border border-border bg-white object-contain" />}
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold">
                  {r.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {r.photo ? "Change photo" : "📷 Add photo"}
                  <input type="file" accept="image/*" className="hidden" disabled={r.busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) productPhoto(i, f); }} />
                </label>
                {r.photo && !r.studio && !r.busy && (
                  <button type="button" onClick={() => studio(i)} className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-ink">✨ Studio photo<CreditPrice credits={5} /></button>
                )}
              </div>
              <button type="button" onClick={() => {
                if (r.id) { if (r.name.trim()) setF({ hidden: [...facts.hidden, r.name.trim().toLowerCase()] }); setRemoved("Removed from your V-Card (still on your Products page)"); }
                setRows(rows.filter((_, k) => k !== i)); setEdits((n) => n + 1);
              }} className="shrink-0 rounded-lg border border-border p-2 text-muted" aria-label="Remove this product"><X className="h-4 w-4" /></button>
            </div>
            {r.note && (
              <p className="text-xs text-muted">
                {r.note}
                {r.studio && r.original && r.original !== r.photo && (
                  <button type="button" onClick={() => patchRow(i, { photo: r.original ?? "", studio: false, note: "" })} className="ml-1.5 font-semibold text-brand-ink underline">Use original</button>
                )}
              </p>
            )}
            <input value={r.name} onChange={(e) => patchRow(i, { name: e.target.value })} placeholder={["e.g. Kaju katli / Water purifier / Hair cut", "Product or service 2", "Product or service 3"][i] ?? "Product or service"} className={`${box} w-full`} />
            <div className="flex gap-1.5">
              <input value={r.price} onChange={(e) => patchRow(i, { price: e.target.value.replace(/[^\d.,/ a-zA-Z₹-]/g, "") })} placeholder="₹ price" className={`${box} w-28 shrink-0 py-2.5 text-sm`} />
              <input value={r.brand} onChange={(e) => patchRow(i, { brand: e.target.value })} placeholder="Brand (optional)" className={`${box} min-w-0 flex-1 py-2.5 text-sm`} />
            </div>
          </div>
        ))}
        {removed && <p className="text-xs text-muted">{removed}</p>}
        {brandProducts && <p className="text-xs text-muted">✓ Your company&apos;s products are shown on your V-Card.</p>}
        {rows.length < MAX_ROWS && (
          <button type="button" onClick={() => { setRows([...rows, emptyRow()]); setEdits((n) => n + 1); }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" /> Add one more</button>
        )}
      </Sec>

      <Sec id="q-photos" title="Photos of your shop or work">
        <p className="text-sm font-semibold">Shop front / banner photo</p>
        {facts.bannerUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border" style={{ aspectRatio: "3 / 1" }}>
            <Img src={facts.bannerUrl} className="h-full w-full object-cover" />
            <button type="button" onClick={() => setF({ bannerUrl: "" })} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white" aria-label="Remove the banner photo"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <label className="grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface2 py-6 text-sm text-muted">
            {busy === "banner" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-6 w-6" />} Add your shop photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickFile(f); }} />
          </label>
        )}
        <p className="pt-1 text-sm font-semibold">More photos (up to 5)</p>
        <div className="flex flex-wrap gap-2">
          {facts.photos.map((u, i) => (
            <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
              <Img src={u} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setF({ photos: facts.photos.filter((_, k) => k !== i) })} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove photo"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {facts.photos.length < 5 && (
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-surface2 text-muted">
              {busy === "photo" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-6 w-6" />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addPhoto(f); }} />
            </label>
          )}
        </div>
      </Sec>

      <Sec id="q-hours" title="Your timings">
        <div className="flex flex-wrap gap-2">
          {["Mon–Sat 10 AM – 8 PM", "All days 9 AM – 9 PM", "Mon–Fri 10 AM – 6 PM"].map((c) => <button key={c} type="button" onClick={() => setF({ hours: c })} className={chip(facts.hours === c)}>{c}</button>)}
        </div>
        <input value={facts.hours} onChange={(e) => setF({ hours: e.target.value })} placeholder="Or type your own, e.g. Sunday closed" className={field} />
      </Sec>

      <Sec id="q-delivery" title="Do you deliver or visit homes?">
        <div className="grid grid-cols-2 gap-2">
          {([["yes", "✅ Yes"], ["no", "❌ No"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF({ homeService: k })} className={`rounded-xl border-2 py-3 font-semibold ${facts.homeService === k ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>{l}</button>
          ))}
        </div>
      </Sec>

      <Sec id="q-pay" title="How can customers pay?">
        <div className="flex flex-wrap gap-2">
          {["💵 Cash", "📱 UPI", "💳 Card", "🧾 EMI"].map((c) => <button key={c} type="button" onClick={() => toggle("payments", c)} className={chip(facts.payments.includes(c))}>{c}</button>)}
        </div>
        {upiOn && (
          <label className="block text-sm font-semibold">Your UPI ID
            <input value={facts.upi} onChange={(e) => setF({ upi: e.target.value.trim() })} autoCapitalize="none" spellCheck={false} placeholder="e.g. sharmasweets@okhdfc" className={field} />
            {!!facts.upi && !UPI_RE.test(facts.upi) && <span className="mt-1 block text-xs font-semibold text-danger">This does not look like a UPI ID. It looks like name@bank.</span>}
          </label>
        )}
      </Sec>

      <Sec id="q-since" title="Since which year?">
        <input value={facts.since} onChange={(e) => setF({ since: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="e.g. 2015" className={field} />
      </Sec>

      <Sec id="q-offer" title="Any offer right now?">
        <input value={facts.offer} onChange={(e) => setF({ offer: e.target.value })} placeholder="e.g. Free delivery above ₹500" className={field} />
      </Sec>

      <Sec id="q-areas" title="Which areas do you serve?">
        <input value={facts.areas} onChange={(e) => setF({ areas: e.target.value })} placeholder="e.g. Karol Bagh, Rajouri Garden, Janakpuri" className={field} />
      </Sec>

      <Sec id="q-special" title="What makes you special?" hint="Tap all that are true.">
        <div className="flex flex-wrap gap-2">
          {["💰 Fair prices", "⭐ Best quality", "🚚 Fast delivery", "🧑‍🔧 Expert team", "✂️ Custom orders", "🤝 Trusted by many customers"].map((c) => <button key={c} type="button" onClick={() => toggle("special", c)} className={chip(facts.special.includes(c))}>{c}</button>)}
        </div>
        <input value={facts.specialText} onChange={(e) => setF({ specialText: e.target.value })} placeholder="Anything else? e.g. pure desi ghee only" className={field} />
      </Sec>

      {!setup?.about && (
        <Sec id="q-work" title="What do you sell, or what work do you do?" hint="In your own words — 2 or 3 lines is enough.">
          <textarea value={facts.work} onChange={(e) => setF({ work: e.target.value })} rows={3} placeholder="e.g. We make fresh sweets and namkeen every day, and take orders for weddings and parties." className={field} />
        </Sec>
      )}

      {setup?.persona === "professional" && (
        <Sec id="q-qual" title="Your degree / registration (optional)">
          <input value={facts.qualification} onChange={(e) => setF({ qualification: e.target.value })} placeholder="e.g. MBBS, MD · Reg. no. 12345" className={field} />
        </Sec>
      )}

      {/* Out in the open (owner's call, 1 Oct 2026): this was buried inside "More details", and the three
          choices only appeared once a link had been typed — so hardly anyone ever found the reference-site
          option. It is one of the most useful answers on the form: a site we can read fills the whole card,
          and a site they merely like gives theirs that look. */}
      <Sec id="q-site" title="Your website — or a website you like (optional)">
        <input value={facts.website} onChange={(e) => setF({ website: e.target.value.trim() })} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={setup?.website || "e.g. sharmasweets.com"} className={field} />
        <p className="mt-1 text-xs text-muted">No website of your own? Put in one you like the look of — we build yours in that style. Leave it empty if you would rather not.</p>
        <div className="mt-3">
          <p className="text-sm font-semibold">This website is…</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {([["own", "🏪 My own website"], ["dealer", "🤝 The brand's website — I am its dealer / distributor"], ["reference", "🎨 A website I like — make mine look like it"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setF({ websiteRole: k })} className={chip(facts.websiteRole === k)}>{l}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{facts.websiteRole === "dealer"
            ? "We take only the products — names, photos and specifications. Your card keeps your own name, number and address."
            : facts.websiteRole === "reference"
            ? "We copy only the look — colours, fonts, layout and tone. Nothing else is taken from it: your details, prices and photos stay yours, and it is never shown as your website."
            : "We take everything useful: your logo, shop photos, details and products."}</p>
        </div>
      </Sec>

      <details id="q-more" ref={moreRef} className="rounded-2xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-[15px] font-semibold">More details <span className="font-normal text-muted">(optional)</span></summary>
        <div className="mt-3 space-y-3">
          {([["instagram", "Instagram", "instagram.com/yourshop"], ["facebook", "Facebook", "facebook.com/yourshop"], ["youtube", "YouTube", "youtube.com/@yourshop"]] as const).map(([k, l, ph]) => (
            <label key={k} className="block text-sm font-semibold">{l}
              <input value={facts.social[k]} onChange={(e) => setF({ social: { [k]: e.target.value.trim() } })} placeholder={ph} inputMode="url" autoCapitalize="none" className={field} />
            </label>
          ))}
          <label id="q-map" className="block scroll-mt-4 text-sm font-semibold">Google Maps link
            <input value={facts.social.google} onChange={(e) => setF({ social: { google: e.target.value.trim() } })} placeholder="maps.app.goo.gl/…" inputMode="url" autoCapitalize="none" className={field} />
            <span className="mt-1 block text-xs font-normal text-muted">Google Maps → your shop → Share → Copy link</span>
          </label>
          <div>
            <p className="text-sm font-semibold">Who buys from you?</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {["👪 Families", "🏪 Shops", "🏢 Offices", "🎓 Students", "👵 Senior citizens", "🙋 Everyone"].map((c) => <button key={c} type="button" onClick={() => toggle("customers", c)} className={chip(facts.customers.includes(c))}>{c}</button>)}
            </div>
          </div>
          <label className="block text-sm font-semibold">Language of your V-Card
            <select value={facts.lang} onChange={(e) => setF({ lang: e.target.value as CardFacts["lang"] })} className={field}>
              <option value="en">English</option><option value="hinglish">Hinglish</option><option value="hi">हिन्दी</option>
            </select>
          </label>
        </div>
      </details>

      {err && <p className="text-sm text-danger">{err}</p>}
      {makeBtn}
      <p className="text-center text-xs text-muted">Free. The AI writes only from your details — no made-up prices or claims.</p>
      {unlock && <UnlockDialog reason="A studio photo uses 5 credits. Add credits or activate your plan — your own photo is kept meanwhile." onClose={() => { setUnlock(false); access.refresh(); }} />}
    </div>
  );
}
