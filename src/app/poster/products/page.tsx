"use client";
// "My products": the one place a product is saved. Photo, name and ₹ price are all most shops need — everything
// else sits under "More details". The same rows feed the V-Card, the website and the daily posters.
// Owner's call (26 Sep 2026): two prices — the offer price and an optional MRP. When the MRP is higher, the card
// shows it struck out next to the offer price, with "% OFF" and "You save ₹…" (card-compose / card-view).
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Trash2, Camera, Images, ChevronLeft, RefreshCw } from "lucide-react";
import { api, authHeaders, isLoggedIn, uploadImage } from "@/lib/poster-client";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { dropStaleLocal } from "@/lib/local-reset";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { syncProductsToCard } from "@/lib/card-personalize";
import { compressToFile } from "@/lib/image-utils";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { ProductCheckSheet } from "@/components/poster/product-check-sheet";
import { ProfileSteps } from "@/components/poster/profile-steps";
import { PHOTO_VIEWS, type ProductPhoto, type PhotoView } from "@/lib/media/product-facts";
import { isThinCard, normalizeFacts, type CardFacts, type FactsResponse } from "@/lib/card-facts";
import { PRODUCT_FACT_KEYS, pickFacts, type FactsPatch } from "@/components/poster/facts-fields";
import { catalogCopyFor, tradeNeeds } from "@/lib/catalog-copy";
import { Help } from "@/components/poster/field-help";
import { SETUP_SCREENS, screenNo } from "@/lib/setup-steps";


type Product = { id: string; name: string; brand_id?: string | null; photo_url: string | null; benefits: string[]; offer: string; active: boolean; category?: string; price?: string; mrp?: string | null; brand?: string; photos?: ProductPhoto[]; facts_confirmed_at?: string | null };
type Draft = { id?: string; name: string; photo_url: string | null; benefits: string; offer: string; category: string; price: string; mrp?: string; brand: string; photos: ProductPhoto[] };

const EMPTY: Draft = { name: "", photo_url: null, benefits: "", offer: "", category: "", price: "", mrp: "", brand: "", photos: [] };

/** The first number in a price ("1,200/kg" → 1200), or NaN — the same reading as card-compose. */
const amount = (v: string | null | undefined) => { const m = /\d[\d,]*(?:\.\d+)?/.exec(v ?? ""); return m ? Number(m[0].replace(/,/g, "")) : NaN; };
/** ₹ only before a number ("₹On request" / "₹FREE" read wrong). */
const rs = (v: string) => (/^\s*[\d,.]/.test(v) ? `₹${v.trim()}` : v.trim());
/** The MRP is shown (struck out) only when it is more than the offer price — exactly when the card shows it. */
const mrpShown = (price: string | null | undefined, mrp: string | null | undefined) => !!(price?.trim() && mrp?.trim()) && amount(mrp) > amount(price);

/* Owner's call (5 Oct 2026): the "a little more" answers were saved only by Continue — typing, then the back arrow
   or a step pill, lost them. Now the build form's autosave: 1.2 s after an edit → PATCH the product keys, a backup
   on this phone first (vcard-products:<uid>, like vcard-form) so a reload keeps them, and one last keepalive PATCH
   when the page is left. Storage is never trusted (private mode / a full disk throw). The backup also keeps `base`,
   the server's values the edits were typed over (and `sent`, the last slice a PATCH carried): on a later load a key
   is restored only where the server still holds one of those — an answer changed since on the build form is never
   written over by an old backup. */
type FactsBackup = { facts: Partial<CardFacts>; base?: Partial<CardFacts>; sent?: Partial<CardFacts>; dirty: boolean; savedAt: number };
const backupKey = (uid: string) => `vcard-products:${uid}`;
const DAY = 24 * 60 * 60 * 1000;
function readJson<T>(key: string): T | null { try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; } }
function writeJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
const blank = (v: unknown) => v == null || v === "" || (Array.isArray(v) && !v.length);

export default function ProductsPage() {
  const router = useRouter();
  const { t, lang } = useT();
  const en = lang === "en";
  const [list, setList] = useState<Product[] | null>(null);
  // ?setup=1 — reached from the setup journey: show the way on to the card (with or without products).
  const [setupMode, setSetupMode] = useState(false);
  // (The set-up's last Save already wrote setup_pos "products"; writing it here again on every open moved the account's
  // version under a set-up screen still being typed on and dropped its draft.)
  /** ?back=… — opened from Card & Website → Edit: the arrow returns there. */
  const [backTo, setBackTo] = useState("");
  /** A live card exists: products added here reach the website only through Write again (the AI lays them out). */
  const [hasLive, setHasLive] = useState(false);
  useEffect(() => { try { const q = new URLSearchParams(window.location.search); setSetupMode(q.get("setup") === "1"); const b = q.get("back") ?? ""; if (b.startsWith("/")) setBackTo(b); } catch { /* ignore */ } }, []);
  const [brandAdmin, setBrandAdmin] = useState<string | null>(null);
  const [forBrand, setForBrand] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checking, setChecking] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Step 3 of the profile (owner's flow, 2 Oct 2026): with the products, what makes you special, who buys, the
  // offer and your work in your words — saved to the card facts on "Continue".
  const [facts, setFacts] = useState<CardFacts | null>(null);
  const [hasAbout, setHasAbout] = useState(false);
  // The trade decides what this step is called and asks (owner's call, 2 Oct 2026: a school lists classes and
  // fees, not "products"; each trade is asked only what its website needs).
  const [category, setCategory] = useState<string>("");
  const copy = catalogCopyFor(category);
  const needs = tradeNeeds(category);
  const C = (e: string, h: string) => (en ? e : h);
  const factsDirty = useRef(false);
  const [edits, setEdits] = useState(0);
  const uid = useRef("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  /** The product keys not yet on the server, and the headers a leaving-page PATCH can still send without awaiting. */
  const pending = useRef<Record<string, unknown> | null>(null);
  const authRef = useRef<Record<string, string> | null>(null);
  /** The server's product slice the current edits started from (what a restored backup must still find there). */
  const base = useRef<Record<string, unknown> | null>(null);
  /** The slice the latest PATCH carried — the server may hold it when the next one never landed (tab closed). */
  const sent = useRef<Record<string, unknown> | null>(null);
  const saveSeq = useRef(0);
  /** PATCHes go one after the other (the route has no version check: two in flight could land in either order and the
   *  older slice would win), and a response marks the backup clean only when no newer edit has happened since. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const inflight = useRef(0);
  const setF = (p: FactsPatch) => { factsDirty.current = true; setEdits((n) => n + 1); setFacts((f) => ({ ...(f ?? normalizeFacts({})), ...p, social: { ...(f ?? normalizeFacts({})).social, ...(p.social ?? {}) } })); };
  const [going, setGoing] = useState(false);
  const send = useCallback((body: Record<string, unknown>, seq: number, keepalive: boolean): Promise<boolean> => {
    const go = () => fetch("/api/card/facts", { method: "PATCH", headers: authRef.current ?? { "content-type": "application/json" }, body: JSON.stringify({ facts: body }), ...(keepalive ? { keepalive: true } : {}) })
      .then((r) => {
        if (!r.ok || seq !== saveSeq.current) return r.ok; // typed again meanwhile: that run owns the backup
        pending.current = null; factsDirty.current = false; base.current = body;
        if (uid.current) writeJson(backupKey(uid.current), { facts: body, base: body, dirty: false, savedAt: Date.now() });
        return true;
      }, () => false);
    sent.current = body;
    const p = inflight.current > 0 ? chain.current.then(go, go) : go();
    inflight.current++;
    const done = p.finally(() => { inflight.current--; });
    chain.current = done;
    return done;
  }, []);
  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      const who = await sb?.auth.getUser().catch(() => null);
      // getUser() asks the auth server; when that call fails but the facts still load, the local session names the
      // account — the autosave must not stop because one auth call hiccupped.
      const me = who?.data.user?.id || (await sb?.auth.getSession().catch(() => null))?.data.session?.user.id || "";
      const cleared = dropStaleLocal(who?.data.user);
      uid.current = me;
      authRef.current = await authHeaders();
      const r = await api<FactsResponse>("/api/card/facts");
      if (!r.ok || !r.data.facts) return;
      let f = r.data.facts;
      const server = pickFacts(f, PRODUCT_FACT_KEYS);
      base.current = server;
      // A backup whose PATCH never landed (offline, page killed): its changed keys go over the server's copy and are
      // saved now — but only where the server still holds what they were typed over, or the slice of the PATCH
      // before (an older backup without a base: only where the server has nothing). A key changed since elsewhere
      // stands; a backup with nothing left to restore is finished with.
      const b = me && !cleared ? readJson<FactsBackup>(backupKey(me)) : null;
      if (b?.dirty && Date.now() - (b.savedAt ?? 0) < 7 * DAY) {
        const restored: Partial<CardFacts> = {};
        for (const k of PRODUCT_FACT_KEYS) {
          if (!(k in (b.facts ?? {})) || same(b.facts[k], server[k])) continue;
          const untouched = b.base ? same(server[k], b.base[k]) || (!!b.sent && same(server[k], b.sent[k])) : blank(server[k]);
          if (untouched) (restored as Record<string, unknown>)[k] = b.facts[k];
        }
        if (Object.keys(restored).length) { f = { ...f, ...restored }; factsDirty.current = true; setEdits((n) => n + 1); }
        else writeJson(backupKey(me), { ...b, dirty: false });
      }
      setFacts(f); setHasAbout(!!r.data.setup?.about?.trim()); setCategory(r.data.setup?.category ?? "");
    })().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!edits || !facts) return;
    const slice = pickFacts(facts, PRODUCT_FACT_KEYS);
    pending.current = slice;
    const seq = ++saveSeq.current;
    if (uid.current) writeJson(backupKey(uid.current), { facts: slice, base: base.current ?? {}, ...(sent.current ? { sent: sent.current } : {}), dirty: true, savedAt: Date.now() });
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        authRef.current = await authHeaders();
        const ok = await send(slice, seq, false);
        if (seq !== saveSeq.current) return; // typed again meanwhile: that run reports
        setSaveState(ok ? "saved" : "failed"); /* failed / offline: the backup keeps the answers */
      } catch { if (seq === saveSeq.current) setSaveState("failed"); }
    }, 1200);
    return () => clearTimeout(t);
  }, [edits, facts, send]);
  // Left before the 1.2 s (back arrow, a step pill, the tab closed): send what is pending at once, after any PATCH
  // still in flight. sendBeacon cannot carry the Bearer header /api/card/facts needs, so a keepalive fetch does the
  // same job.
  useEffect(() => {
    const flush = () => {
      const body = pending.current;
      if (!body || !authRef.current) return;
      pending.current = null;
      try { send(body, saveSeq.current, true).catch(() => undefined); } catch { /* the backup on this phone keeps them */ }
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [send]);
  async function continueToSite() {
    setGoing(true);
    try { if (facts && factsDirty.current) await send(pickFacts(facts, PRODUCT_FACT_KEYS), saveSeq.current, false); } catch { /* the build form shows them again */ }
    await getBrowserSupabase()?.auth.updateUser({ data: { setup_pos: "make" } }).catch(() => undefined);
    router.push("/poster/card/build?make=1");
  }

  // A 401/500/503 is NOT an empty shop: api() resolves on any status, so the status is checked before the
  // list is replaced — otherwise a returning owner is told "No products yet" and adds everything again.
  async function load() {
    setErr("");
    try {
      const r = await api<{ products?: Product[]; brand_admin_of?: string | null; error?: string }>("/api/poster/products");
      if (!r.ok) { setErr(r.data?.error || t.error); return; }
      setList(r.data.products ?? []); setBrandAdmin(r.data.brand_admin_of ?? null);
      fetchMyCardsStrict().then((cs) => setHasLive(cs.some((c) => c.active !== false && !isThinCard(c)))).catch(() => undefined);
    } catch {
      setErr(t.error);
    }
  }
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/products"); return; } load(); })(); }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!draft) return;
    if (draft.mrp?.trim() && !draft.price.trim()) { setErr(en ? "Write the offer price too — the MRP is shown struck out next to it." : "ऑफ़र दाम भी लिखें — MRP उसके साथ कटा हुआ दिखता है।"); return; }
    setBusy(true); setErr("");
    try {
      const r = await api<{ product?: Product; error?: string }>("/api/poster/products", { method: "POST", json: {
        ...draft, benefits: draft.benefits.split("\n"), ...(brandAdmin ? { for_brand: forBrand } : {}),
      } });
      if (!r.ok) { setErr(r.data.error || t.saveFail); return; }
      setDraft(null); await load();
      void liveSync();
    } catch {
      setErr(t.saveFail);
    } finally {
      setBusy(false);
    }
  }
  async function pick(file: File | null) {
    if (!file || !draft) return; if (draft.photos.length >= 6) { setErr("Up to 6 photos."); return; }
    setBusy(true); setErr("");
    try {
      const small = await compressToFile(file, "product.jpg");
      const u = await uploadImage(small, "product");
      if (!u) { setErr("Could not upload the photo. Please try again."); return; }
      const view: PhotoView = draft.photos.length === 0 ? "front" : "other";
      setDraft({ ...draft, photo_url: draft.photo_url ?? u, photos: [...draft.photos, { url: u, view, role: "identity" }] });
    } catch {
      setErr("Could not upload the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function fillWithAi() {
    if (!draft) return; setBusy(true); setErr("");
    try {
      const r = await api<{ name?: string; benefits?: string[]; offer?: string; error?: string }>("/api/poster/products/ai", { method: "POST", json: { name: draft.name, photo_url: draft.photo_url, lang: en ? "en" : "hi" } });
      if (!r.ok) { setErr(r.data.error || t.error); return; }
      setDraft({ ...draft, name: draft.name || r.data.name || "", benefits: (r.data.benefits ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 6).join("\n"), offer: draft.offer || r.data.offer || "" });
    } catch {
      setErr(t.error);
    } finally {
      setBusy(false);
    }
  }
  // No products of their own? Anyone can sell Shubhora itself — the same three plans as the V-Card seller template,
  // with the curated plan pictures (served by /api/stock, accepted by the products API as same-site paths).
  const SHUBHORA: Draft[] = [
    { name: "Shubhora AI Business Assistant — Growth", price: "2,999 / month", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-growth.jpg", photos: [{ url: "/api/stock/vcard/plan-growth.jpg", view: "front", role: "identity" }],
      offer: "Pre-launch: join free, book your city's top ID", benefits: ["Website + digital card on one link, built by AI in 5 minutes", "No Shubhora tag, website on Google, your own domain", "AI banner and AI edits — just say what to change", "Daily poster + status video with voice, auto-posted", "WhatsApp AI answers customers 24×7, leads in your CRM"].join("\n") },
    { name: "Shubhora Custom Solutions — Software & Automation", price: "On request — contact us", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-pro.jpg", photos: [{ url: "/api/stock/vcard/plan-pro.jpg", view: "front", role: "identity" }],
      offer: "We make all kinds of software — tell us what you need", benefits: ["Dedicated account manager", "Custom software, apps and websites", "Automation of daily work", "Custom CRM / ERP and dashboards", "AI assistants trained on your business"].join("\n") },
    { name: "Free Website + Digital Card", price: "FREE for 1 year (worth ₹1,499)", brand: "Shubhora", category: "Shubhora", photo_url: "/api/stock/vcard/plan-free.jpg", photos: [{ url: "/api/stock/vcard/plan-free.jpg", view: "front", role: "identity" }],
      offer: "", benefits: ["Website + digital card on one link", "Built by AI in 5 minutes, three designs", "A poster every morning", "Leads in the CRM; share on WhatsApp, QR, save-contact"].join("\n") },
  ];
  const hasShubhora = (list ?? []).some((p) => /shubhora/i.test(p.name) || /shubhora/i.test(p.brand ?? ""));
  const offCount = (list ?? []).filter((p) => p.active === false).length;
  const isShubhoraPlan = (p: Product) => /shubhora/i.test(p.name) || /shubhora/i.test(p.brand ?? "") || /shubhora/i.test(p.category ?? "");
  const mixedWithShubhora = (list ?? []).some((p) => p.active !== false && isShubhoraPlan(p)) && (list ?? []).some((p) => p.active !== false && !isShubhoraPlan(p));
  async function hideShubhora() {
    for (const p of (list ?? []).filter((x) => x.active !== false && isShubhoraPlan(x))) {
      await api("/api/poster/products", { method: "POST", json: { id: p.id, active: false } });
    }
    load();
  }
  /** Keep the row, keep it off the card: the build only takes active products. */
  async function toggle(p: Product) {
    setList((cur) => (cur ?? []).map((x) => (x.id === p.id ? { ...x, active: p.active === false } : x)));
    const r = await api<{ error?: string }>("/api/poster/products", { method: "POST", json: { id: p.id, active: p.active === false } });
    if (!r.ok) { setErr(r.data.error || t.saveFail); load(); } else void liveSync();
  }
  /** What was just saved here goes onto the live website too (audit, 7 Oct 2026) — a changed price, a new photo,
   *  a product switched off — without "Write again". Best effort, after the save. */
  async function liveSync() {
    if (!hasLive) return;
    try {
      const r = await api<{ products?: Product[] }>("/api/poster/products");
      const rows = r.ok ? (r.data.products ?? []) : [];
      if (rows.length) await syncProductsToCard(rows);
    } catch { /* the Products page saved; the website follows next time */ }
  }
  /** "Make my Shubhora seller card" asks first (owner's call, 7 Oct 2026: a tap used to build it at once, which was
   *  wrong): the sheet says what will happen, and only "Yes, make it" runs it. */
  const [askShubhora, setAskShubhora] = useState(false);
  async function promoteShubhora() {
    setAskShubhora(false);
    setBusy(true); setErr("");
    try {
      for (const d of SHUBHORA) {
        const r = await api<{ error?: string }>("/api/poster/products", { method: "POST", json: { ...d, benefits: d.benefits.split("\n") } });
        if (!r.ok) { setErr(r.data.error || t.saveFail); return; }
      }
      // …then the ready-made Shubhora seller card (banner, logo, plans, demo videos, business plan) in the editor — as a
      // card of its own when the owner already has a real card of their business, which stays exactly as it is.
      const cards = await fetchMyCardsStrict().catch(() => []);
      const own = cards.find((c) => c.active !== false && !isThinCard(c));
      router.push(own || !cards[0] ? "/poster/d/editor?id=new&template=vcard-reseller" : `/poster/d/editor?id=${cards[0].id}&template=vcard-reseller`);
    } catch { setErr(t.saveFail); setBusy(false); }
  }
  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await api(`/api/poster/products?id=${p.id}`, { method: "DELETE" }); } catch { setErr(t.error); return; }
    load();
    // Deleted → off the website: sync with the row marked off (it is no longer in the list).
    if (hasLive) void syncProductsToCard([{ name: p.name, active: false }]);
  }

  if (list === null) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{err}</p>
      <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> {en ? "Try again" : "फिर कोशिश करें"}
      </button>
    </div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-4">
      {setupMode && <ProfileSteps current="products" category={category} screen="products" onBack={() => router.push("/poster/onboard?step=extras")} />}
      {setupMode ? (
        /* The set-up step, plain (owner's call, 7 Oct 2026: "step 10 of 11 page bada confusing hai"): the bar above counts
           the step and holds Back; here the title, one line on what to do, one big Add button, the way on at the bottom. */
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{C(copy.title, copy.titleHi)}<Help k="product" className="translate-y-0" /></h1>
            <p className="mt-1 text-sm text-muted">{C(`Add what you sell or do, with a photo and price. Or skip and add ${copy.short.toLowerCase()} later.`, `जो बेचते या करते हैं वो जोड़ें, photo और दाम के साथ। या अभी छोड़ें, ${copy.shortHi} बाद में जोड़ें।`)}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link href={backTo || "/poster/setup"} className="text-muted" aria-label="Back"><ChevronLeft className="h-5 w-5" /></Link>
          <h1 className="text-lg font-bold flex-1">{C(copy.title, copy.titleHi)}</h1>
          {!draft && <button type="button" onClick={() => { setForBrand(false); setDraft({ ...EMPTY }); }} className="inline-flex items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {C(copy.add, copy.addHi)}</button>}
        </div>
      )}
      {!setupMode && <Guide hi={copy.guideHi} en={copy.guide} />}
      {err && !draft && <p className="text-sm text-danger">{err}</p>}
      {/* The truth about the live website (audit, 7 Oct 2026): the AI laid the products out at build time, so a product
          added here reaches the website through Write again — said here, with the button, instead of silently not. */}
      {!setupMode && hasLive && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1">{C("Changes here go on your card and posters at once. For the website, run Write again once you are done.", "यहाँ के बदलाव card और poster पर तुरंत आते हैं। Website के लिए, काम पूरा होने पर एक बार Write again चलाएँ।")}</span>
          <Link href="/poster/card/build?improve=1&ask=1" className="shrink-0 rounded-lg grad-brand px-2.5 py-1.5 font-semibold text-white">{C("Update website", "Website update करें")}</Link>
        </div>
      )}
      {setupMode && !draft && (
        <button type="button" onClick={() => { setForBrand(false); setDraft({ ...EMPTY }); }} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft/40 py-4 text-base font-semibold text-brand-ink">
          <Plus className="h-5 w-5" /> {C(copy.add, copy.addHi)}
        </button>
      )}
      {/* What a website of THIS trade must say — the step's checklist, from the trade data (a school: classes, board,
          campus, admission; a sweet shop: freshness, bulk orders). Folded away: help for the few who want it. */}
      {setupMode && needs && !draft && (
        <details className="rounded-xl border border-border bg-surface2/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">{C(`What should I add?`, `क्या-क्या जोड़ूँ?`)}</summary>
          <ul className="mt-1.5 space-y-1 text-xs text-muted">
            {needs.items.map((x) => <li key={x} className="flex gap-1.5"><span className="text-brand">•</span><span>{x}</span></li>)}
          </ul>
        </details>
      )}
      {draft && (
        <div className="rounded-xl border border-brand bg-brand-soft/40 p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-20 w-20 rounded-xl bg-surface border border-border grid place-items-center overflow-hidden shrink-0">
              {draft.photo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={draft.photo_url} alt="" className="h-full w-full object-contain" /> : busy ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : <Camera className="h-6 w-6 text-muted" />}
            </span>
            <div className="flex-1 space-y-1.5">
              <span className="text-sm font-semibold block">{C("Photo", "फ़ोटो")}<Help k="productPhoto" /></span>
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                  <Camera className="h-3.5 w-3.5" /> {en ? "Camera" : "कैमरा"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
                <label className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium cursor-pointer">
                  <Images className="h-3.5 w-3.5" /> {en ? "Gallery" : "Gallery"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
          </div>
          <input className={inp} placeholder={C(copy.name, copy.nameHi)} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {/* Two prices: the offer price (what the customer pays) and, if there is a discount, the MRP. */}
          <div className={`grid gap-2 ${copy.mrp ? "grid-cols-2" : "grid-cols-1"}`}>
            <label className="block space-y-1">
              <span className="block text-xs font-semibold">{C(copy.price, copy.priceHi)}<Help k="price" /></span>
              <input className={inp} inputMode="decimal" placeholder={C(copy.priceEg, copy.priceEgHi)} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </label>
            {copy.mrp && (
              <label className="block space-y-1">
                <span className="block text-xs font-semibold">MRP ₹ <span className="font-normal text-muted">(optional)</span></span>
                <input className={inp} inputMode="decimal" placeholder={en ? "e.g. 1,100" : "जैसे 1,100"} value={draft.mrp ?? ""} onChange={(e) => setDraft({ ...draft, mrp: e.target.value })} />
              </label>
            )}
          </div>
          {mrpShown(draft.price, draft.mrp) && (() => {
            const off = Math.round(((amount(draft.mrp) - amount(draft.price)) / amount(draft.mrp)) * 100);
            return (
              <p className="text-xs text-muted">
                {en ? "On your card:" : "Card पर:"} <b className="text-ink">{rs(draft.price)}</b> <s>{rs(draft.mrp ?? "")}</s>
                {off > 0 && <span className="ml-1.5 rounded bg-good/10 px-1 py-0.5 text-[11px] font-semibold text-good">{off}% OFF</span>}
              </p>
            );
          })()}
          {!!draft.mrp?.trim() && !!draft.price.trim() && !mrpShown(draft.price, draft.mrp) && (
            <p className="text-xs text-muted">{en ? "The MRP shows on the card only when it is more than the offer price." : "MRP card पर तभी दिखेगा जब वह ऑफ़र दाम से ज़्यादा हो।"}</p>
          )}
          {copy.brand && <input className={inp} placeholder={en ? "Brand (optional) — only if you sell a company's product" : "Brand (optional) — सिर्फ़ किसी कंपनी का product बेचते हों तो"} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />}

          <details className="rounded-lg border border-border bg-surface/70">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">{en ? "More details (optional)" : "और जानकारी (optional)"}</summary>
            <div className="space-y-3 border-t border-border p-3">
              {draft.photos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted">Photos for AI videos ({draft.photos.length}/6) — tell us what each one shows. Most useful: a photo of the product <b>working / in use</b>.</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {draft.photos.map((ph, i) => (
                      <div key={ph.url} className="w-24 shrink-0 space-y-1">
                        <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.url} alt="" className="h-full w-full object-contain" />
                          {!ph.generated_crop && <button type="button" onClick={() => { const photos = draft.photos.filter((_, k) => k !== i); setDraft({ ...draft, photos, photo_url: photos[0]?.url ?? null }); }} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove photo"><Trash2 className="h-3 w-3" /></button>}
                        </div>
                        <select value={ph.view} disabled={!!ph.generated_crop} onChange={(e) => setDraft({ ...draft, photos: draft.photos.map((x, k) => (k === i ? { ...x, view: e.target.value as PhotoView } : x)) })} className="w-full rounded-md border border-border bg-surface px-1 py-1 text-[11px]">
                          {PHOTO_VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" disabled={busy || (!draft.name && !draft.photo_url)} onClick={fillWithAi}
                className="w-full rounded-lg border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50">✨ {en ? "Fill benefits/offer with AI (from the photo)" : "AI से खूबियाँ/ऑफ़र भरो (photo देखकर)"}</button>
              <textarea className={`${inp} w-full leading-relaxed`} rows={5} placeholder={C(copy.lines, copy.linesHi)} value={draft.benefits} onChange={(e) => setDraft({ ...draft, benefits: e.target.value })} />
              <input className={inp} placeholder={t.offerLabel} value={draft.offer} onChange={(e) => setDraft({ ...draft, offer: e.target.value })} />
              <input className={inp} list="product-cats" placeholder={en ? "Category (optional) e.g. Sweets, Namkeen, Gifts" : "Category (optional) जैसे Sweets, Namkeen, Gifts"} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              <datalist id="product-cats">{[...new Set((list ?? []).map((p) => p.category).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
              {brandAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forBrand} onChange={(e) => setForBrand(e.target.checked)} /> {en ? "For the whole team (company product)" : "पूरी team / सभी members के लिए (company product)"}</label>}
            </div>
          </details>

          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">✕</button>
            <button type="button" onClick={save} disabled={busy || !draft.name.trim()} className="flex-1 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{t.save}</button>
          </div>
        </div>
      )}
      {/* A seller who later adds their own range ends up with both on one card. One tap keeps the plans off it. */}
      {mixedWithShubhora && (
        <div className="rounded-xl border border-amber/50 bg-amber/10 p-3">
          <p className="text-sm font-semibold">{en ? "Shubhora's plans are on your card next to your own products." : "आपके अपने products के साथ Shubhora के plan भी card पर हैं।"}</p>
          <p className="mt-0.5 text-xs text-muted">{en ? "Selling Shubhora too? Leave them. Otherwise hide them — they stay here for later." : "Shubhora भी बेचते हैं? रहने दें। वरना छिपा दें — यहीं रखे रहेंगे।"}</p>
          <button type="button" onClick={hideShubhora} className="mt-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold">{en ? "Hide the Shubhora plans" : "Shubhora के plan छिपाएँ"}</button>
        </div>
      )}
      {offCount > 0 && (
        <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{en
          ? `${offCount} product${offCount > 1 ? "s" : ""} hidden — they stay here but do not go on your card, website or posters.`
          : `${offCount} product छिपे हैं — यहाँ रहेंगे, पर card, website और poster पर नहीं जाएँगे।`}</p>
      )}
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${p.active === false ? "border-border bg-surface2 opacity-70" : "border-border"}`}>
            <div className="h-14 w-14 rounded-lg bg-surface2 overflow-hidden grid place-items-center shrink-0">{p.photo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo_url} alt="" className="h-full w-full object-contain" /> : "📦"}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              {/* ₹ only before a number ("₹On request" / "₹FREE" read wrong); no internal counts like "0 lines". */}
              <p className="text-xs text-muted truncate">{p.price ? <b className="text-ink">{rs(p.price)}</b> : null}{mrpShown(p.price, p.mrp) ? <> <s>{rs(p.mrp ?? "")}</s></> : null}{p.price && (p.brand || p.category) ? " · " : ""}{[p.brand, p.category].filter(Boolean).join(" · ")}</p>
            </div>
            {!setupMode && <button type="button" onClick={() => setChecking(p)} className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${p.facts_confirmed_at ? "border-good/40 bg-good/10 text-good" : "border-lead/50 bg-lead/10 text-lead"}`}>{p.facts_confirmed_at ? "✓ Product check" : "Product check"}</button>}
            <button type="button" onClick={() => { setForBrand(!!brandAdmin && p.brand_id === brandAdmin); setDraft({ id: p.id, name: p.name, photo_url: p.photo_url, benefits: (p.benefits ?? []).join("\n"), offer: p.offer ?? "", category: p.category ?? "", price: p.price ?? "", mrp: p.mrp ?? "", brand: p.brand ?? "", photos: p.photos?.length ? p.photos : p.photo_url ? [{ url: p.photo_url, view: "front", role: "identity" }] : [] }); }} className="p-2 text-muted text-xs">Edit</button>
            {/* One tap decides whether this product is on the card at all — the Shubhora plans and an old
                range do not have to be deleted to be kept off it. */}
            <button type="button" onClick={() => toggle(p)} title={p.active === false ? (en ? "Show on my card" : "Card पर दिखाओ") : (en ? "Hide from my card" : "Card से हटाओ")}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${p.active === false ? "border-border text-muted" : "border-good/40 bg-good/10 text-good"}`}>
              {p.active === false ? (en ? "Hidden" : "छिपा है") : (en ? "On card" : "Card पर")}
            </button>
            <button type="button" onClick={() => remove(p)} className="p-2 text-muted"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {/* Setup journey: the person just chose "my own business" — selling Shubhora is not offered here. */}
        {!draft && !hasShubhora && !setupMode && (
          <div className={`rounded-xl border p-3 ${list.length === 0 ? "border-brand bg-brand-soft/40" : "border-border"}`}>
            <p className="text-sm font-semibold">{en ? "No products of your own? Sell the V-Card itself." : "Apna koi product nahi? V-Card hi sell karo."}</p>
            <p className="mt-0.5 text-xs text-muted">{en ? "Adds the 3 Shubhora plans (Free, Growth ₹2,999, Custom Solutions) as your products for posters, and opens the ready-made Shubhora seller card — banner, logo, plans, demo videos and the business plan. Put your name and number on it and publish." : "Shubhora ke 3 plan (Free, Growth ₹2,999, Custom Solutions) poster ke liye product ban jaayenge, aur Shubhora ka bana-banaya seller card khulega — banner, logo, plans, demo video, business plan. Apna naam-number daal ke publish kar do."}</p>
            <button type="button" onClick={() => setAskShubhora(true)} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {en ? "Make my Shubhora seller card" : "Shubhora seller card banao"}
            </button>
            {err && <p className="mt-2 text-sm text-danger">{err}</p>}
          </div>
        )}
        {askShubhora && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setAskShubhora(false)}>
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-4 shadow-float">
              <p className="text-lg font-bold">{en ? "Make a Shubhora seller card?" : "Shubhora seller card बनाएँ?"}</p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex gap-2"><span className="text-brand">•</span><span>{en ? "Shubhora's 3 plans (Free, Growth ₹2,999, Custom Solutions) are added to your products." : "Shubhora के 3 plan (Free, Growth ₹2,999, Custom Solutions) आपके products में जुड़ेंगे।"}</span></li>
                <li className="flex gap-2"><span className="text-brand">•</span><span>{en ? "The ready-made Shubhora card opens in the editor — put your name and number on it and publish." : "बना-बनाया Shubhora card editor में खुलेगा — अपना नाम-number डालकर publish करें।"}</span></li>
                <li className="flex gap-2"><span className="text-brand">•</span><span>{en ? "Your own business card and website stay exactly as they are; this is a second card on its own link." : "आपका अपना business card और website वैसे ही रहेंगे; ये अपने अलग link पर दूसरा card है।"}</span></li>
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAskShubhora(false)} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold">{en ? "Cancel" : "रहने दें"}</button>
                <button type="button" onClick={promoteShubhora} className="flex-1 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">{en ? "Yes, make it" : "हाँ, बनाओ"}</button>
              </div>
            </div>
          </div>
        )}
        {list.length === 0 && !draft && <p className="text-sm text-muted">{C(copy.empty, copy.emptyHi)}</p>}
      </div>
      {/* Setup journey (?setup=1): a product is not required to make the card — one clear way on, with or without. */}
      {setupMode && !draft && (
        <div className="sticky bottom-20 z-20 rounded-2xl border border-border bg-surface p-3 shadow-float">
          <button type="button" onClick={continueToSite} disabled={going} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {going ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {list.length > 0 ? C("Next → make my website", "आगे → मेरी website बनाएँ") : C(`Skip for now → make my website`, `अभी छोड़ें → website बनाएँ`)}
          </button>
          {list.length === 0 && <p className="mt-1.5 text-center text-[11px] text-muted">{C(`Add ${copy.short.toLowerCase()} any time later.`, `${copy.shortHi} बाद में कभी भी जोड़ें।`)}</p>}
        </div>
      )}
      {checking && <ProductCheckSheet productId={checking.id} productName={checking.name} onClose={() => { setChecking(null); load(); }} />}
    </div>
  );
}
