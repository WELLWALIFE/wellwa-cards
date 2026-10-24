"use client";
// "Make advanced website" (the Rs 5,999 segment, owner 15-16 Oct 2026): the AI reviews the live website, designs a layout made only
// for this business and writes the words in a more premium voice - the basic website is kept and can be switched back to.
//   1 · what changes, said honestly          2 · access: the pay button (Razorpay) or "Make my advanced website"
//   3 · the job, followed like the banner's  4 · the critique + a preview, then Use / Try another layout / Keep my basic site
//   5 · done, with the way back to the basic site.
// Engine: /api/card/advanced (GET state + job, POST { mode: "preview" } to start, { accept: <job> } to save, { claim: <job> } to let go).
// Payment: /api/poster/pay/advanced (GET { allowed, reason, price }, POST order, POST { orderId, paymentId, signature } verify).
// Every message sits right under the control that caused it.
import { SiteLink, openPage } from "@/components/poster/card-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, ChevronLeft, CircleDashed, ExternalLink, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { payPrefill } from "@/lib/pay-prefill";
import { cardHomeShown } from "@/lib/site-url";
import { AdvancedSwitch, type AdvState } from "@/components/poster/advanced-entry";
import type { AdvancedSpec } from "@/lib/site-advanced";
import type { Card, CardBlock } from "@/lib/types";

// advanced-access.ts carries ADVANCED_PRICE_RUPEES but is server-only, so this client page cannot import it: the price shown is the
// one the payment route sends back, and this is only what shows if that route does not answer.
const PRICE_FALLBACK = 5999;
/** "3 layouts per payment" (owner's rule): the server may say how many are left; this counts them on the phone when it does not. */
const TRY_LIMIT = 3;

/** "Ready for Premium?" (owner, 24 Oct 2026: products etc. first, then Premium): what the AI will have to design from, read off the
 *  live card. Never a lock — the owner may make it anyway; each missing row opens the screen that adds it and comes back here. */
type ReadyRow = { k: string; ok: boolean; en: string; hi: string; href: string };
const STOCK_PIC = /^\/(art|wellwa)\/|^\/api\/stock\//;
function readiness(card: Card): ReadyRow[] {
  const blocks = (card.pages ?? []).flatMap((pg) => pg.blocks ?? []) as CardBlock[];
  const items = <K extends CardBlock["kind"]>(k: K) => blocks.filter((b): b is Extract<CardBlock, { kind: K }> => b.kind === k);
  const products = items("product").flatMap((b) => b.items ?? []).filter((x) => (x.name ?? "").trim());
  const services = items("services").flatMap((b) => b.items ?? []).filter((x) => (x.name ?? "").trim());
  const offer = products.length + services.length;
  const withPhoto = products.filter((x) => x.imageUrl || (x.images ?? []).length).length;
  const gallery = items("gallery").reduce((n, b) => n + (b.images ?? []).filter((i) => i.url).length, 0);
  const reviews = items("testimonials").reduce((n, b) => n + (b.items ?? []).filter((x) => (x.text ?? "").trim()).length, 0);
  const banner = !!card.coverUrl && !STOCK_PIC.test(card.coverUrl);
  const back = encodeURIComponent("/poster/site/advanced");
  return [
    { k: "offer", ok: offer >= 3, en: `Products / services: ${offer}${products.length ? ` (${withPhoto} with photo)` : ""}`, hi: `Products / services: ${offer}${products.length ? ` (${withPhoto} photo के साथ)` : ""}`, href: `/poster/products?back=${back}` },
    { k: "banner", ok: banner, en: banner ? "Your own banner" : "No banner of your own", hi: banner ? "अपना banner है" : "अपना banner नहीं है", href: `/poster/onboard?step=extras&part=photos&back=${back}` },
    { k: "photos", ok: gallery >= 3, en: `Photos of your shop / work: ${gallery}`, hi: `दुकान / काम की photos: ${gallery}`, href: `/poster/onboard?step=extras&part=photos&back=${back}` },
    { k: "reviews", ok: reviews >= 2, en: `Customer reviews: ${reviews}`, hi: `ग्राहकों की राय: ${reviews}`, href: "/poster/testimonials" },
  ];
}
const PREVIEW_KEY = "vcard-adv-preview";
/** A payment Razorpay took whose confirmation did not reach our server (offline at that second): kept so the next visit can confirm it
 *  instead of offering "Pay" again, which would charge twice. */
const PAY_KEY = "adv-pay-pending";
type PendingPay = { orderId: string; paymentId: string; signature: string };

type Stage = "details" | "website" | "pictures" | "writing" | "checking";
type Bi = { en: string; hi: string };
type Copy = { hero?: { headline?: string; sub?: string }; about?: { id: string; title?: string; body?: string }; titles?: Record<string, string> };
type Result = {
  ok?: boolean; mode?: string; cardId?: string; username?: string; error?: string; round?: number;
  spec?: AdvancedSpec; copy?: Copy;
  critique?: { summary: Bi; items: { area: string; en: string; hi: string }[] };
  diff?: { layout?: { before: string; after: string }; text?: { key: string; label: Bi; before: string; after: string }[]; changed?: number };
};
type JobView = { job: string; state: "running" | "done" | "failed"; stage: Stage; elapsed: number; claimed: boolean; status?: number; result?: unknown };
type EngineGet = Partial<JobView> & { job?: string | null; access?: { allowed: boolean; reason?: string }; current?: AdvState | null; error?: string; /** Every design already made for this card, kept on the server. */ designs?: Result[] };
/** One design's handle: its job, or (a kept design) its seed. */
const seedKey = (r: Result) => `seed:${r.spec?.seed ?? ""}`;
type PayStatus = { allowed?: boolean; reason?: string | null; price?: number; triesLeft?: number; selling?: boolean; error?: string };
type Step = "load" | "none" | "intro" | "running" | "preview" | "done" | "kept";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
/** The route may send rupees or paise: nothing that costs ₹5,999 is a six-figure rupee amount. */
const rupees = (p: unknown) => { const n = Number(p); return Number.isFinite(n) && n > 0 ? (n >= 100000 ? Math.round(n / 100) : Math.round(n)) : PRICE_FALLBACK; };
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* The tries of this payment, counted per card on the phone (a job id is counted once, so reopening the page never double counts). */
const triesKey = (cardId: string) => `adv-tries:${cardId}`;
function readTries(cardId: string): { n: number; jobs: string[] } {
  try { const j = JSON.parse(localStorage.getItem(triesKey(cardId)) ?? "null") as { n?: number; jobs?: string[] } | null; return { n: Math.max(0, Number(j?.n) || 0), jobs: Array.isArray(j?.jobs) ? j.jobs.slice(-10) : [] }; } catch { return { n: 0, jobs: [] }; }
}
function writeTries(cardId: string, v: { n: number; jobs: string[] }) { try { localStorage.setItem(triesKey(cardId), JSON.stringify(v)); } catch { /* private mode: the count then lives for this visit only */ } }

function writeJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }
function dropKey(key: string) { try { localStorage.removeItem(key); } catch { /* private mode */ } }
function readPending(): PendingPay | null {
  try { const j = JSON.parse(localStorage.getItem(PAY_KEY) ?? "null") as Partial<PendingPay> | null; return j && j.orderId && j.paymentId && j.signature ? { orderId: j.orderId, paymentId: j.paymentId, signature: j.signature } : null; } catch { return null; }
}

/** The live card wearing the previewed design and words: what the server will save on "Use this" (the same words rules as the engine's
 *  applyCopy, which is server-only), so the frame shows exactly that. */
function withAdvanced(card: Card, res: Result): Card {
  // The design's sliding top banners (owner, 23 Oct 2026), unless the owner already made their own.
  const own = (card.site?.hero?.slides ?? []).length >= 2;
  const site0 = card.site ?? { enabled: true };
  const slides = !own && Array.isArray((res as { slides?: unknown }).slides) ? (res as { slides: NonNullable<NonNullable<NonNullable<Card["site"]>["hero"]>["slides"]> }).slides : null;
  const base = { ...site0, ...(slides ? { hero: { headline: card.company || card.name, sub: "", ...(site0.hero ?? {}), slides } } : {}), advanced: res.spec, advancedOn: true } as NonNullable<Card["site"]>;
  let next: Card = { ...card, site: base };
  const c = res.copy;
  if (c?.hero && (c.hero.headline !== undefined || c.hero.sub !== undefined)) {
    const cur = base.hero ?? { headline: card.company || card.name, sub: "" };
    next = { ...next, site: { ...base, hero: { ...cur, ...(c.hero.headline !== undefined ? { headline: c.hero.headline } : {}), ...(c.hero.sub !== undefined ? { sub: c.hero.sub } : {}) } } };
  }
  if (c?.about || c?.titles) {
    next = {
      ...next,
      pages: next.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => {
          if (c.about && b.id === c.about.id && b.kind === "about") return { ...b, ...(c.about.title !== undefined ? { title: c.about.title } : {}), ...(c.about.body !== undefined ? { body: c.about.body } : {}) };
          const t = c.titles?.[b.id];
          return t !== undefined ? ({ ...b, title: t } as CardBlock) : b;
        }),
      })),
    };
  }
  return next;
}

const AREA: Record<string, [string, string]> = {
  hero: ["Top of the page", "पेज का ऊपरी हिस्सा"], copy: ["Words", "शब्द"], photos: ["Photos", "Photos"],
  proof: ["Trust", "भरोसा"], structure: ["Structure", "बनावट"], design: ["Design", "Design"],
};

/** What the owner can add for one of the AI's findings (owner, 24 Oct 2026: "jo kami mili wo add ka option de clearly" — fix the data,
 *  keep the same design, do not make a new one each time). null = the new design already takes care of it. */
type Fix = { k: string; en: string; hi: string; href: string };
function fixFor(it: { area: string; en: string }): Fix | null {
  const back = encodeURIComponent("/poster/site/advanced");
  const photos = `/poster/onboard?step=extras&part=photos&back=${back}`;
  const t = it.en.toLowerCase();
  if (it.area === "proof" || /review|testimonial/.test(t)) return { k: "reviews", en: "Add reviews", hi: "राय जोड़ें", href: "/poster/testimonials" };
  if (/banner|first screen/.test(t)) return { k: "banner", en: "Add banner", hi: "Banner जोड़ें", href: photos };
  if (/product|catalogue|catalog/.test(t)) return { k: "products", en: "Add photos", hi: "Photos जोड़ें", href: `/poster/products?back=${back}` };
  if (it.area === "photos" || /photo|picture|gallery/.test(t)) return { k: "photos", en: "Add photos", hi: "Photos जोड़ें", href: photos };
  if (/about/.test(t)) return { k: "about", en: "Write more", hi: "और लिखें", href: `/poster/onboard?step=about&back=${back}` };
  return null;
}

async function loadRazorpay(): Promise<boolean> {
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return true;
  if (!document.querySelector('script[src*="checkout.razorpay.com"]')) {
    await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(); s.onerror = () => rej(new Error("load")); document.body.appendChild(s); }).catch(() => undefined);
  }
  return !!(window as unknown as { Razorpay?: unknown }).Razorpay;
}

export default function AdvancedSitePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  /** The server writes its errors in English only: in Hindi the screen's own sentence is shown, never the English one. */
  const srv = (e: string | undefined, fallback: string) => (hi ? fallback : e || fallback);
  const mounted = useRef(true);
  const run = useRef(0);

  const [step, setStep] = useState<Step>("load");
  const [card, setCard] = useState<Card | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [cur, setCur] = useState<AdvState | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [price, setPrice] = useState(PRICE_FALLBACK);
  /** The server's switch for taking the payment (ADVANCED_SITE_SELL): off while the feature is under review, nobody is asked to pay. */
  const [selling, setSelling] = useState(true);
  /** On a running Growth plan the price is only the difference (Rs 5,999 - Rs 2,999). */
  const [growth, setGrowth] = useState(false);
  const [serverLeft, setServerLeft] = useState<number | null>(null);
  const [used, setUsed] = useState(0);

  const [startBusy, setStartBusy] = useState<"make" | "again" | null>(null);
  const [startErr, setStartErr] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [paidNote, setPaidNote] = useState(false);
  const [pending, setPending] = useState<PendingPay | null>(null);

  const [prog, setProg] = useState<{ stage: Stage; base: number; at: number }>({ stage: "details", base: 0, at: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [lost, setLost] = useState(false);

  const [jobId, setJobId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  /** Every design of this round, in the order they were made (owner, 20 Oct 2026: after seeing 2 and 3, design 1 must still be there to pick). */
  const [designs, setDesigns] = useState<{ job: string; res: Result }[]>([]);
  const [openFound, setOpenFound] = useState(false);
  const [openChanges, setOpenChanges] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptErr, setAcceptErr] = useState("");
  const [againErr, setAgainErr] = useState("");
  const [keepBusy, setKeepBusy] = useState(false);
  const [keepErr, setKeepErr] = useState("");
  const [doneUser, setDoneUser] = useState("");
  const [frameW, setFrameW] = useState(360);
  /** The preview page's own height (it posts it): the frame is exactly that tall, so nothing is blank under the footer. */
  const [frameH, setFrameH] = useState(1600);
  useEffect(() => {
    const on = (e: MessageEvent) => { const d = e.data as { type?: string; key?: string; h?: number }; if (e.origin === window.location.origin && d?.type === "preview-height" && d.key === PREVIEW_KEY && typeof d.h === "number" && d.h > 200) setFrameH(Math.min(20000, Math.round(d.h))); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const frameBox = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; run.current += 1; dropKey(PREVIEW_KEY); for (let i = 1; i <= TRY_LIMIT; i++) dropKey(`${PREVIEW_KEY}-${i}`); }; }, []);
  useEffect(() => { if (step !== "running") return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [step]);

  // A payment that is already on the account needs no confirming any more.
  useEffect(() => { if (allowed && pending) { dropKey(PAY_KEY); setPending(null); } }, [allowed, pending]);

  const cardIdFromUrl = () => { try { return new URLSearchParams(window.location.search).get("card") ?? ""; } catch { return ""; } };

  /** Who may use it (payment route first, the engine's own answer when that one does not reply) and the price. */
  const refreshAccess = useCallback(async (eg?: EngineGet) => {
    const [pay, eng] = await Promise.all([
      api<PayStatus>("/api/poster/pay/advanced").catch(() => null),
      eg ? Promise.resolve(null) : api<EngineGet>("/api/card/advanced").catch(() => null),
    ]);
    if (!mounted.current) return;
    const engine = eg ?? (eng?.ok ? eng.data : undefined);
    const known = pay?.ok && typeof pay.data.allowed === "boolean" ? pay.data.allowed : engine?.access?.allowed;
    const reason = (pay?.ok ? pay.data.reason : undefined) ?? engine?.access?.reason ?? null;
    // Neither route answered (offline): keep what the screen knew. Guessing "not allowed" would put the Pay button in front of someone who has paid.
    if (typeof known === "boolean") { setAllowed(known); setClosedReason(known ? null : reason); }
    if (pay?.ok) { setSelling(pay.data.selling !== false); setPrice(rupees(pay.data.price)); setGrowth(!!(pay.data as { growth?: boolean }).growth); setServerLeft(typeof pay.data.triesLeft === "number" ? pay.data.triesLeft : null); }
    if (engine?.current !== undefined) setCur(engine.current);
  }, []);

  /** A finished job → the preview (the tries count it once), or the reason it failed back on the first step. */
  const finish = useCallback((v: JobView, mine: Card) => {
    const res = (v.result ?? {}) as Result;
    const good = v.state === "done" && (v.status ?? 500) < 400 && res.mode === "preview" && !!res.spec && res.cardId === mine.id;
    if (!good) {
      void api("/api/card/advanced", { method: "POST", json: { claim: v.job } }).catch(() => undefined);
      setStartErr(srv(res.error, T("The Premium design could not be made now. Please try again.", "Premium design अभी नहीं बन पाया। दोबारा try करें।")));
      setStep("intro"); return;
    }
    const t = readTries(mine.id);
    if (!t.jobs.includes(v.job)) { t.n += 1; t.jobs.push(v.job); writeTries(mine.id, t); }
    setUsed(t.n); setJobId(v.job); setResult(res); setAcceptErr(""); setAgainErr(""); setKeepErr("");
    setDesigns((d) => (d.some((x) => x.job === v.job || (!!res.spec?.seed && x.res.spec?.seed === res.spec.seed)) ? d.map((x) => (x.res.spec?.seed === res.spec?.seed ? { job: v.job, res } : x)) : [...d, { job: v.job, res }].slice(-TRY_LIMIT)));
    setOpenFound(false); setOpenChanges(false);
    setStep("preview");
    try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
    void refreshAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAccess]);

  /** Follows the server's job (a second tap joins the running one; closing this screen loses nothing). */
  const follow = useCallback(async (first: JobView, mine: Card) => {
    const my = ++run.current;
    const alive = () => mounted.current && run.current === my;
    setStep("running"); setLost(false);
    let v = first;
    while (v.state === "running") {
      if (!alive()) return;
      setProg({ stage: v.stage, base: v.elapsed, at: Date.now() }); setNow(Date.now());
      await sleep(3000);
      if (!alive()) return;
      try {
        const r = await api<EngineGet>(`/api/card/advanced?cardId=${encodeURIComponent(mine.id)}`);
        if (r.ok && r.data.job) { v = r.data as JobView; setLost(false); }
        else if (r.ok) { setStartErr(T("The Premium design could not be made. Please try again.", "Premium design नहीं बन पाया। दोबारा try करें।")); setStep("intro"); return; }
        else if (r.status === 401) { setStartErr(T("You were logged out. Please log in again.", "आप logout हो गए। दोबारा login करें।")); setStep("intro"); return; }
        else setLost(true);
      } catch { setLost(true); }
    }
    if (alive()) finish(v, mine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  useEffect(() => {
    (async () => {
      // Replace, not push: Back from the login page must not land here again and bounce straight back to it.
      if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/site/advanced${window.location.search}`)}`); return; }
      let mine: Card | undefined;
      try {
        const cs = await fetchMyCardsStrict();
        const want = cardIdFromUrl();
        mine = cs.find((c) => c.id === want) ?? cs[0];              // one account = one website and one card
      } catch { setLoadErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); return; }
      if (!mine || !mine.site) { setStep("none"); return; }
      setCard(mine); setUsed(readTries(mine.id).n); setPending(readPending());
      const r = await api<EngineGet>(`/api/card/advanced?cardId=${encodeURIComponent(mine.id)}`).catch(() => null);
      if (!mounted.current) return;
      if (!r?.ok) { setLoadErr(!r ? T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।") : r.status === 401 ? T("You were logged out. Please log in again.", "आप logout हो गए। दोबारा login करें।") : T("Could not open this now. Please try again.", "अभी ये खुल नहीं पाया। दोबारा try करें।")); return; }
      const eg = r.data;
      await refreshAccess(eg);
      if (!mounted.current) return;
      setCur(eg.current ?? null);
      // The designs made before (kept on the server, owner 24 Oct 2026): shown again, never made again.
      const kept = (eg.designs ?? []).filter((r) => r.spec && r.cardId === mine.id);
      if (kept.length) setDesigns(kept.map((r) => ({ job: seedKey(r), res: r })));
      // A design left running (or finished while this screen was closed) is picked up where it is.
      if (eg.job) {
        const v = eg as JobView;
        if (v.state === "running") { void follow(v, mine); return; }
        if (!v.claimed) { finish(v, mine); return; }
      }
      // Made before but not live yet: straight to them.
      if (kept.length && !eg.current?.on) { const last = kept[kept.length - 1]; setJobId(seedKey(last)); setResult(last); setStep("preview"); return; }
      setStep("intro");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const remaining = serverLeft ?? Math.max(0, TRY_LIMIT - used);

  async function start(from: "make" | "again") {
    if (!card || startBusy) return;
    const setErr = from === "make" ? setStartErr : setAgainErr;
    setErr(""); setStartBusy(from);
    try {
      // seedBump / wish: the next try is asked to be a different composition from the last one.
      const r = await api<JobView & { error?: string; reason?: string }>("/api/card/advanced", {
        method: "POST",
        json: { cardId: card.id, mode: "preview", seedBump: used, ...(used ? { wish: `Make a clearly different layout from the earlier ones. This is design number ${used + 1}.` } : {}) },
      });
      if (r.status === 402 || r.status === 403) { setAllowed(false); void refreshAccess(); setErr(srv(r.data.error, T("The Premium website is not open for your account yet.", "Premium website अभी आपके account के लिए खुली नहीं है।"))); return; }
      if (r.status === 429) {
        if (r.data.reason === "tries") { setServerLeft(0); setErr(T(`You have used all ${TRY_LIMIT} layouts of your payment.`, `आपके payment के सारे ${TRY_LIMIT} layouts इस्तेमाल हो चुके हैं।`)); }
        else setErr(T("You have made the Premium design 8 times in the last hour. Please try again later.", "पिछले एक घंटे में आप 8 बार Premium design बना चुके हैं। थोड़ी देर बाद try करें।"));
        return;
      }
      if (!r.ok || !r.data.job) { setErr(srv(r.data.error, T("Could not start. Please try again.", "शुरू नहीं हो पाया। दोबारा try करें।"))); return; }
      void follow(r.data, card);
    } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    finally { setStartBusy(null); }
  }

  /** Tells our server that Razorpay took the money. Until it answers "ok" the payment stays in `pending` (and in storage), the Pay
   *  button is replaced by a Confirm button, and a second order cannot be opened: the first one may already have been charged. */
  async function confirmPay(rec: PendingPay) {
    setPayBusy(true); setPayErr("");
    try {
      const v = await api<{ ok?: boolean; error?: string }>("/api/poster/pay/advanced", { method: "POST", json: rec });
      if (!v.ok || v.data.ok === false) {
        if (v.status === 400) { dropKey(PAY_KEY); setPending(null); }      // the server refused this payment for good (signature / order): nothing to retry
        setPayErr(v.status === 400
          ? T("We could not match this payment to your account. If money was taken, please tell support.", "ये payment आपके account से मिल नहीं पाया। पैसे कटे हों तो support को बताएँ।")
          : T("We could not confirm the payment yet. Do not pay again: tap Confirm my payment in a moment. If money was taken, it is safe.", "Payment अभी confirm नहीं हुआ। दोबारा payment न करें: थोड़ी देर बाद “मेरा payment confirm करें” दबाएँ। पैसे कटे हों तो सुरक्षित हैं।"));
        return;
      }
      dropKey(PAY_KEY); setPending(null);
      if (card) { writeTries(card.id, { n: 0, jobs: [] }); setUsed(0); }       // a new payment starts the three tries again
      setAllowed(true); setClosedReason(null); setPaidNote(true);
      await refreshAccess();
    } catch { setPayErr(T("No internet while confirming the payment. Do not pay again: tap Confirm my payment when you are back online.", "Payment confirm करते समय internet नहीं था। दोबारा payment न करें: internet आने पर “मेरा payment confirm करें” दबाएँ।")); }
    finally { if (mounted.current) setPayBusy(false); }
  }

  async function pay() {
    if (payBusy || pending) return;
    setPayBusy(true); setPayErr("");
    const fail = (m: string) => { setPayErr(m); setPayBusy(false); };
    try {
      if (!growth) {
        // Premium is a subscription (first month 5,999, then 2,999 a month): the mandate is opened here and the first debit opens the advanced website.
        const sub = await api<{ subscriptionId?: string; keyId?: string; already?: boolean; error?: string }>("/api/billing/autopay", { method: "POST", json: { premium: true } });
        if (sub.data.already) { fail(T("You already have a running plan. Refreshing…", "आपका plan पहले से चल रहा है। Refresh हो रहा है…")); await refreshAccess(); setPayBusy(false); return; }
        if (!sub.ok || !sub.data.subscriptionId) { fail(srv(sub.data.error, T("Payment is not working right now. Please try again.", "अभी payment नहीं हो पा रहा। फिर से कोशिश करें।"))); return; }
        if (!(await loadRazorpay())) { fail(T("Could not open the payment page. Check the internet and try again.", "Payment page नहीं खुला। Internet देखकर दोबारा try करें।")); return; }
        const RZs = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
        new RZs({
          key: sub.data.keyId, subscription_id: sub.data.subscriptionId, prefill: payPrefill(), name: "Shubhora", description: "Premium — ₹5,999 first month, then ₹2,999 a month", theme: { color: "#0e9e90" },
          handler: async (r: Record<string, string>) => {
            const v = await api<{ ok?: boolean }>("/api/billing/autopay/verify", { method: "POST", json: r }).catch(() => null);
            if (v?.ok && v.data.ok) { await refreshAccess(); setPayBusy(false); } else fail(T("We could not confirm your payment. If money was taken, please tell support.", "Payment confirm नहीं हो पाया। पैसे कटे हों तो support को बताएँ।"));
          },
          modal: { ondismiss: () => setPayBusy(false) },
        }).open();
        return;
      }
      const o = await api<{ orderId?: string; amount?: number; currency?: string; keyId?: string; message?: string; error?: string }>("/api/poster/pay/advanced", { method: "POST", json: card ? { cardId: card.id } : {} });
      if (o.status === 503 && o.data.error === "advanced_closed") { setSelling(false); fail(T("The Premium website is not open for payment yet. Nothing was charged.", "Premium website के लिए payment अभी खुला नहीं है। कुछ नहीं कटा।")); return; }
      if (o.status === 409) { fail(T("This account has already paid. Refreshing…", "इस account का payment हो चुका है। Refresh हो रहा है…")); await refreshAccess(); setPayBusy(false); return; }
      if (!o.ok || !o.data.orderId) { fail(srv(o.data.message || o.data.error, T("Payment is not working right now. Please try again.", "अभी payment नहीं हो पा रहा। फिर से कोशिश करें।"))); return; }
      if (!(await loadRazorpay())) { fail(T("Could not open the payment page. Check the internet and try again.", "Payment page नहीं खुला। Internet देखकर दोबारा try करें।")); return; }
      const RZ = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      new RZ({
        key: o.data.keyId, amount: o.data.amount, currency: o.data.currency, prefill: payPrefill(), name: "Shubhora", description: "Advanced website", order_id: o.data.orderId, theme: { color: "#0e9e90" },
        handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const rec: PendingPay = { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature };
          writeJson(PAY_KEY, rec); setPending(rec);       // kept before the confirmation is sent, so a lost answer can be retried
          void confirmPay(rec);
        },
        modal: { ondismiss: () => setPayBusy(false) },
      }).open();
    } catch { fail(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
  }

  async function accept() {
    if (!card || !jobId || acceptBusy) return;
    setAcceptBusy(true); setAcceptErr("");
    try {
      // The design on screen: the current job, or an earlier one of this round (by its seed).
      const r = await api<{ ok?: boolean; error?: string; current?: AdvState; username?: string }>("/api/card/advanced", { method: "POST", json: { cardId: card.id, accept: jobId, acceptSeed: result?.spec?.seed } });
      if (!r.ok) { setAcceptErr(r.status === 400 ? T("That preview is no longer there. Please make it again.", "वो preview अब नहीं है। दोबारा बनाएँ।") : srv(r.data.error, T("Could not save your Premium website. Please try again.", "आपकी Premium website save नहीं हुई। दोबारा try करें।"))); return; }
      if (r.data.current) setCur(r.data.current);
      setDoneUser(r.data.username || card.username); dropKey(PREVIEW_KEY); setStep("done");
      try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
    } catch { setAcceptErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    finally { setAcceptBusy(false); }
  }

  async function keepBasic() {
    if (!card || keepBusy) return;
    setKeepBusy(true); setKeepErr("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/card/advanced", { method: "POST", json: { claim: jobId } });
      if (!r.ok) { setKeepErr(srv(r.data.error, T("Could not close this. Please try again.", "ये बंद नहीं हो पाया। दोबारा try करें।"))); return; }
      dropKey(PREVIEW_KEY); setStep("kept");
    } catch { setKeepErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    finally { setKeepBusy(false); }
  }

  /* ---- the preview frame: the real desktop renderer, scaled to the phone's width ---- */
  const previewCard = useMemo(() => (card && result?.spec ? withAdvanced(card, result) : null), [card, result]);
  useEffect(() => {
    if (step !== "preview" || !previewCard) return;
    writeJson(PREVIEW_KEY, { ...previewCard, username: "__preview" });
    try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ }
  }, [step, previewCard]);
  useEffect(() => {
    const el = frameBox.current;
    if (step !== "preview" || !el) return;
    const fit = () => setFrameW(el.clientWidth || 360);
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [step]);
  const scale = Math.min(1, frameW / 1280);

  const secs = Math.max(0, Math.round(prog.base + (now - prog.at) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const priceText = money(price);
  const liveLink = cardHomeShown(doneUser || card?.username || "", card?.customDomain);
  const box = "rounded-2xl border border-border bg-surface p-4";
  const errBox = "rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger";

  const header = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => goBack(router, "/poster/site")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
      <h1 className="flex-1 text-lg font-bold">{T("Premium website", "Premium website")}</h1>
    </div>
  );

  if (step === "load") return (
    <div className="space-y-4 py-2">
      {header}
      {loadErr ? <p className="text-sm font-semibold text-danger">{loadErr}</p> : <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
    </div>
  );

  if (step === "none") return (
    <div className="space-y-4 py-2">
      {header}
      <section className="space-y-3 rounded-xl border border-border p-4 text-center">
        <p className="text-sm text-muted">{T("Make your website first. The Premium design is made from it.", "पहले अपनी website बनाएँ। Premium design उसी से बनता है।")}</p>
        <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Make my website →", "मेरी website बनाएँ →")}</Link>
      </section>
    </div>
  );

  /* ---- 3 · the job ---- */
  if (step === "running") {
    const ORDER: Stage[] = ["details", "website", "writing", "checking"];
    const at = Math.max(0, ORDER.indexOf(prog.stage === "pictures" ? "website" : prog.stage));
    const steps: [Stage, string][] = [
      ["details", T("Reviewing your site…", "आपकी site जाँची जा रही है…")],
      ["website", T("Designing a new layout…", "नया layout design हो रहा है…")],
      ["writing", T("Writing premium copy…", "Premium शब्द लिखे जा रहे हैं…")],
      ["checking", T("Checking the design…", "Design जाँचा जा रहा है…")],
    ];
    return (
      <div className="mx-auto max-w-sm space-y-5 py-10">
        <div className="grid place-items-center gap-2 text-center">
          <LoaderCircle className="h-7 w-7 animate-spin text-ai" />
          <p className="text-lg font-bold">{T("Your Premium website is being made", "आपकी Premium website बन रही है")}</p>
          <p className="text-xs text-muted">{T("About 2 minutes", "लगभग 2 मिनट")} · {clock}{used ? ` · ${T(`design ${used + 1} of ${TRY_LIMIT}`, `design ${used + 1} / ${TRY_LIMIT}`)}` : ""}</p>
        </div>
        <ul className="space-y-2.5 rounded-2xl border border-border bg-surface p-4 text-sm">
          {steps.map(([k, label]) => {
            const i = ORDER.indexOf(k);
            return (
              <li key={k} className={`flex items-center gap-2.5 ${i > at ? "text-muted" : ""}`}>
                {i < at ? <CheckCircle2 className="h-5 w-5 shrink-0 text-good" /> : i === at ? <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-ai" /> : <CircleDashed className="h-5 w-5 shrink-0" />}
                <span className={i === at ? "font-semibold" : ""}>{label}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-xs text-muted">✓ {T("You can close this screen.", "Screen बंद कर सकते हैं।")}</p>
        {lost && <p className="rounded-xl border border-amber/50 bg-amber/10 px-3 py-2 text-center text-xs">{T("No internet. It is still being made.", "Internet नहीं है। Website बन रही है।")}</p>}
      </div>
    );
  }

  /* ---- 4 · the preview: the design first, the AI's notes and the changes folded away, the three designs side by side ---- */
  if (step === "preview" && result && card) {
    const items = result.critique?.items ?? [];
    const changes = (result.diff?.text ?? []).filter((d) => d.before !== d.after).slice(0, 4);
    const which = Math.max(0, designs.findIndex((d) => d.job === jobId));
    const fold = "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold";
    return (
      <div className="space-y-3 py-2">
        {header}
        {/* Redesigned 23 Oct 2026 (owner: every design button opens that website; a simpler page): pick a design, see it, use it. */}
        <p className="text-xs text-muted">{T("Nothing is live yet. Pick a design, open it, then use it.", "अभी कुछ live नहीं है। Design चुनें, खोलकर देखें, फिर लगाएँ।")}</p>

        {/* The three designs: tap to see it below; ↗ opens it full size in a new tab; an empty one can be made from here. */}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: TRY_LIMIT }, (_, i) => designs[i]).map((d, i) => {
            const on = !!d && i === which;
            if (!d) return (
              <button key={i} type="button" disabled={!!startBusy || remaining <= 0 || i !== designs.length} onClick={() => start("again")}
                className="flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-border px-1 py-2.5 text-xs font-semibold text-muted disabled:opacity-50">
                {startBusy === "again" && i === designs.length ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {T(`Design ${i + 1}`, `Design ${i + 1}`)}
                <span className="text-[10px] font-normal">{i === designs.length && remaining > 0 ? T("make it", "बनाएँ") : T("not made", "नहीं बना")}</span>
              </button>
            );
            const pc = card ? withAdvanced(card, d.res) : null;
            return (
              <div key={i} className={`overflow-hidden rounded-xl border-2 ${on ? "border-brand bg-brand-soft/60" : "border-border bg-surface"}`}>
                <button type="button" onClick={() => { setJobId(d.job); setResult(d.res); setAcceptErr(""); }} className={`block w-full px-1 pt-2 pb-1 text-xs font-bold ${on ? "text-brand-ink" : ""}`}>
                  {on && <Check className="mr-0.5 inline h-3.5 w-3.5" />}{T(`Design ${i + 1}`, `Design ${i + 1}`)}
                </button>
                {/* Its own key per design (owner, 20 Oct 2026): three tabs, three designs. */}
                <button type="button" onClick={() => { if (pc) writeJson(`${PREVIEW_KEY}-${i + 1}`, { ...pc, username: "__preview" }); openPage(`/preview/site?k=${PREVIEW_KEY}-${i + 1}&shot=1`, T(`Design ${i + 1}`, `Design ${i + 1}`)); }}
                  className="flex w-full items-center justify-center gap-1 border-t border-border/70 py-1.5 text-[11px] font-semibold text-brand-ink">
                  <ExternalLink className="h-3.5 w-3.5" /> {T("Open", "खोलें")}
                </button>
              </div>
            );
          })}
        </div>
        {/* All three slots hold kept designs but a new payment gave more tries: a new one can still be made. */}
        {designs.length >= TRY_LIMIT && remaining > 0 && (
          <button type="button" onClick={() => start("again")} disabled={!!startBusy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-xs font-semibold text-muted disabled:opacity-50">
            {startBusy === "again" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {T("Make a new design", "नया design बनाएँ")}
          </button>
        )}
        {againErr && <p className={errBox}>{againErr}</p>}

        <div ref={frameBox} className="overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-white" style={{ height: Math.min(frameH * scale, 400) }}>
          <div style={{ width: "100%", height: frameH * scale, overflow: "hidden" }}>
            <iframe key={jobId} ref={frame} title={T("Premium website preview", "Premium website का preview")} src={`/preview/site?k=${PREVIEW_KEY}&shot=1`} scrolling="no"
              onLoad={() => { try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ } }}
              style={{ width: 1280, height: frameH, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
          </div>
        </div>

        {/* What the AI found: the things only the owner can add come first, each with its own button; the rest the new design already
            handles. Adding them keeps THIS design — it shows the new photos / products / reviews by itself, no new design needed. */}
        {(() => {
          const withFix = items.map((it) => ({ it, fix: fixFor(it) }));
          const todo = withFix.filter((x) => x.fix).filter((x, i, arr) => arr.findIndex((y) => y.fix!.k === x.fix!.k) === i);
          const handled = withFix.filter((x) => !x.fix);
          return (
            <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
              <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#8b3dff] to-[#c04ee8] px-4 py-3 text-white">
                <p className="text-base font-bold leading-tight">{T("What the AI found", "AI को क्या कमी मिली")}</p>
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">{todo.length ? T(`${todo.length} to add`, `${todo.length} जोड़ना है`) : T("All good", "सब ठीक")}</span>
              </div>
              {todo.length > 0 ? (
                <>
                  <ul className="divide-y divide-border">
                    {todo.map(({ it, fix }) => (
                      <li key={fix!.k} className="flex items-center gap-3 px-4 py-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber/15 text-xs font-bold text-amber">!</span>
                        <span className="min-w-0 flex-1 text-sm leading-snug">{hi ? it.hi || it.en : it.en}</span>
                        <Link href={fix!.href} className="inline-flex shrink-0 items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> {T(fix!.en, fix!.hi)}</Link>
                      </li>
                    ))}
                  </ul>
                  <p className="flex items-start gap-1.5 bg-good/10 px-4 py-2.5 text-xs font-semibold text-good"><CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" /> {T("Add them and come back: this same design shows them. No need to make a new one.", "जोड़कर यहीं वापस आएँ: यही design उन्हें दिखाएगा। नया design बनाने की ज़रूरत नहीं।")}</p>
                </>
              ) : <p className="px-4 py-3 text-sm text-muted">{T("Nothing to add. The new design is ready.", "कुछ जोड़ना नहीं है। नया design तैयार है।")}</p>}
              {handled.length > 0 && (
                <div className="border-t border-border">
                  <button type="button" onClick={() => setOpenFound((v) => !v)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-muted" aria-expanded={openFound}>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-good" /> <span className="flex-1">{T(`${handled.length} more fixed by the new design`, `${handled.length} बातें नए design ने ठीक कर दीं`)}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition ${openFound ? "rotate-180" : ""}`} />
                  </button>
                  {openFound && (
                    <ul className="space-y-1.5 px-4 pb-3">
                      {handled.map(({ it }, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted">
                          <span className="mt-px shrink-0 rounded-full bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold text-ai">{(AREA[it.area] ?? AREA.design)[hi ? 1 : 0]}</span>
                          <span className="min-w-0">{hi ? it.hi || it.en : it.en}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        <div className="space-y-2">
          <button type="button" onClick={accept} disabled={acceptBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {acceptBusy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T(`Use design ${which + 1}`, `Design ${which + 1} लगाएँ`)}
          </button>
          {acceptErr && <p className={errBox}>{acceptErr}</p>}
          <button type="button" onClick={keepBasic} disabled={keepBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted disabled:opacity-60">
            {keepBusy && <LoaderCircle className="h-4 w-4 animate-spin" />} {cur?.has && cur.on ? T("Keep my current website", "मौजूदा website ही रखें") : T("Keep my old website", "पुरानी website ही रखें")}
          </button>
          {keepErr && <p className={errBox}>{keepErr}</p>}
        </div>

        {(result.diff?.layout || changes.length > 0) && (
          <section className="rounded-2xl border border-border bg-surface">
            <button type="button" onClick={() => setOpenChanges((v) => !v)} className={fold} aria-expanded={openChanges}>
              <span>{T("What changes", "क्या बदलेगा")}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${openChanges ? "rotate-180" : ""}`} />
            </button>
            {openChanges && (
              <div className="space-y-2 border-t border-border px-4 py-3">
                {result.diff?.layout && <p className="text-sm"><b>{T("Layout", "Layout")}:</b> <span className="text-muted">{result.diff.layout.before}</span> → {result.diff.layout.after}</p>}
                {changes.map((d) => (
                  <div key={d.key} className="space-y-0.5 text-sm">
                    <p className="text-xs font-semibold text-muted">{hi ? d.label.hi || d.label.en : d.label.en}</p>
                    {d.before && <p className="text-xs text-muted line-through">{d.before}</p>}
                    <p>{d.after}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    );
  }

  /* ---- 5 · done ---- */
  if (step === "done") {
    const on = cur?.on !== false;
    return (
      <div className="space-y-4 py-2">
        {header}
        <section className="space-y-3 rounded-3xl p-6 text-center text-white shadow-float grad-brand">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20" aria-hidden="true"><Sparkles className="h-7 w-7" /></span>
          <h2 className="text-2xl font-extrabold tracking-tight">{on ? T("Your Premium website is live", "आपकी Premium website live है") : T("Your old website is back", "आपकी पुरानी website वापस आ गई")}</h2>
          <p className="text-sm text-white/90">{on ? T("Live on phone and computer.", "Phone और computer, दोनों पर live।") : T("The Premium design stays saved.", "Premium design save रहेगा।")}</p>
          <SiteLink href={`https://${liveLink}?view=site`} title="Website" className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm"><span className="truncate">{liveLink}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" /></SiteLink>
        </section>
        <div className={`${box} space-y-2`}>
          <AdvancedSwitch cardId={card?.id} on={on} onChanged={(s) => { if (s) setCur(s); }} />
          <p className="text-[11px] text-muted">{T("Both stay saved. Switch any time.", "दोनों save हैं। कभी भी बदलें।")}</p>
        </div>
        {on && <Link href="/poster/seo" className={`${box} flex items-center justify-between gap-3 text-sm font-semibold`}><span>{T("Google SEO checklist: see what is ready", "Google SEO checklist: क्या तैयार है देखें")}</span><span className="text-brand-ink">→</span></Link>}
        {/* Back = the screen before this one (lib/nav-back): a fixed link to Card & Website would stack a second copy of it on top of the first. */}
        <button type="button" onClick={() => goBack(router, "/poster/site")} className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-surface py-3 text-sm font-semibold">{T("Done", "हो गया")}</button>
      </div>
    );
  }

  if (step === "kept") {
    // "Keep my basic site" after an advanced one is already live must not say the basic site is showing: the live one is unchanged.
    const live = !!cur?.has && cur.on;
    return (
      <div className="space-y-4 py-2">
        {header}
        <section className={`${box} space-y-3 text-center`}>
          <p className="text-base font-bold">{live ? T("Your website stays as it is", "आपकी website वैसी ही रहेगी") : T("Your old website stays", "आपकी पुरानी website ही रहेगी")}</p>
          <p className="text-sm text-muted">{live ? T("Your Premium website is still live.", "आपकी Premium website अब भी live है।") : T("Nothing changed. Your designs stay saved.", "कुछ नहीं बदला। आपके designs save हैं।")}</p>
          <button type="button" onClick={() => goBack(router, "/poster/site")} className="inline-flex w-full items-center justify-center rounded-xl grad-brand py-3 text-sm font-semibold text-white">{T("Done", "हो गया")}</button>
        </section>
      </div>
    );
  }

  /* ---- 1 + 2 · what changes, and how to get it ---- */
  // Kept short (owner, 23 Oct 2026: "jo zaroori hai wahi likhna hai, simple"): one line on top, the button, three short points.
  const bullets: [string, string][] = [
    ["A design made only for your business", "सिर्फ़ आपके business के लिए नया design"],
    ["See it first, then put it live", "पहले देखें, फिर live करें"],
    ["Your basic website stays saved", "पुरानी website भी save रहती है"],
  ];
  return (
    <div className="space-y-3 py-2">
      {header}
      <section className="space-y-3 rounded-3xl p-5 text-white shadow-float grad-brand">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"><Sparkles className="h-3 w-3" /> Premium</span>
        <h2 className="text-xl font-extrabold leading-tight">{T("AI gives your website a premium new look", "AI आपकी website को premium नया look देगा")}</h2>
        <ul className="space-y-1.5">
          {bullets.map(([te, th]) => <li key={te} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0" /> {T(te, th)}</li>)}
        </ul>
      </section>

      {card && !cur?.has && (() => {
        const rows = readiness(card);
        const done = rows.filter((r) => r.ok).length;
        return (
          <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-bold">{T("Get ready first", "पहले ये तैयार करें")}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${done === rows.length ? "bg-good/15 text-good" : "bg-amber/15 text-amber"}`}>{done}/{rows.length} {T("ready", "तैयार")}</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.k} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${r.ok ? "bg-good/15 text-good" : "bg-amber/15 text-amber"}`}>{r.ok ? "✓" : "!"}</span>
                  <span className="min-w-0 flex-1">{T(r.en, r.hi)}</span>
                  {!r.ok && <Link href={r.href} className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">{T("Add", "जोड़ें")}</Link>}
                </li>
              ))}
            </ul>
            {done < rows.length && <p className="bg-surface2 px-4 py-2 text-[11px] text-muted">{T("More details = a better Premium website.", "जितनी ज़्यादा जानकारी, उतनी अच्छी Premium website।")}</p>}
          </section>
        );
      })()}

      <section className={`${box} space-y-2.5`}>
        {cur?.has && (
          <div className="space-y-1 rounded-xl border border-ai/30 bg-ai-soft/50 px-3 py-2">
            <p className="text-sm font-semibold">{cur.on ? T("Your Premium website is live.", "आपकी Premium website live है।") : T("Your Premium design is saved; the basic one is showing.", "Premium design save है; अभी पुरानी website दिख रही है।")}</p>
            {/* The way to the live Premium website, and to change it (owner, 24 Oct 2026: "premium site wale page per kaise jaaun?"). */}
            {cur.on && (
              <div className="grid grid-cols-2 gap-2 py-1">
                <SiteLink href={`https://${liveLink}?view=site`} title="Website" className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white">
                  <ExternalLink className="h-4 w-4" /> {T("See my website", "मेरी website देखें")}
                </SiteLink>
                <Link href="/poster/site?edit=site" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold">
                  {T("Change it", "बदलें")}
                </Link>
              </div>
            )}
            <AdvancedSwitch cardId={card?.id} on={!!cur.on} onChanged={(s) => { if (s) setCur(s); }} />
          </div>
        )}
        {allowed ? (
          <div className="space-y-1.5">
            {paidNote && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {T("Payment received.", "Payment मिल गया।")}</p>}
            {/* Designs made before: open them, never make a new one from here (a new one is the empty slot on the designs screen). */}
            {designs.length > 0 && (
              <button type="button" onClick={() => { const last = designs[designs.length - 1]; setJobId(last.job); setResult(last.res); setAcceptErr(""); setStep("preview"); try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white">
                <Sparkles className="h-5 w-5" /> {T(`See my designs (${designs.length})`, `मेरे बने designs देखें (${designs.length})`)}
              </button>
            )}
            {designs.length === 0 && <button type="button" onClick={() => start("make")} disabled={!!startBusy || remaining <= 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {startBusy === "make" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} {cur?.has ? T("Make a new design", "नया design बनाएँ") : T("Make my Premium website", "मेरी Premium website बनाएँ")}
            </button>}
            <p className="text-center text-xs text-muted">{remaining <= 0 ? T(`All ${TRY_LIMIT} designs used.`, `सारे ${TRY_LIMIT} design इस्तेमाल हो गए।`) : T(`1–2 minutes · ${remaining} of ${TRY_LIMIT} designs left`, `1–2 मिनट · ${TRY_LIMIT} में से ${remaining} design बाकी`)}</p>
            {startErr && <p className={errBox}>{startErr}</p>}
          </div>
        ) : !pending && (!selling || closedReason === "flag" || closedReason === "closed" || closedReason === "off") ? (
          <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-sm">{T("Coming soon. Nothing to pay yet.", "जल्द आ रहा है। अभी कुछ देना नहीं है।")}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm font-bold">{growth ? T("Upgrade to Premium", "Premium में upgrade करें") : T("Get Premium", "Premium लें")}</p>
              <p className="text-2xl font-extrabold">{priceText}</p>
            </div>
            <p className="text-xs text-muted">{growth ? T("You pay only the difference from Standard.", "Standard से सिर्फ़ फ़र्क़ देना है।") : T("₹5,999 first month, then ₹2,999 a month.", "पहला महीना ₹5,999, फिर ₹2,999 महीना।")}</p>
            {pending ? (
              <>
                <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs">{T("Payment done but not confirmed yet. Do not pay again.", "Payment हो गया, confirm बाकी है। दोबारा payment न करें।")}</p>
                <button type="button" onClick={() => confirmPay(pending)} disabled={payBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
                  {payBusy && <LoaderCircle className="h-5 w-5 animate-spin" />} {T("Confirm my payment", "मेरा payment confirm करें")}
                </button>
              </>
            ) : (
              <button type="button" onClick={pay} disabled={payBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
                {payBusy && <LoaderCircle className="h-5 w-5 animate-spin" />} {growth ? T(`Upgrade — ${priceText}`, `Upgrade करें — ${priceText}`) : T("Get Premium — ₹5,999", "Premium लें — ₹5,999")}
              </button>
            )}
            {payErr && <p className={errBox}>{payErr}</p>}
            {startErr && <p className={errBox}>{startErr}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
