"use client";
// "Make advanced website" (the Rs 5,999 segment, owner 15-16 Oct 2026): the AI reviews the live website, designs a layout made only
// for this business and writes the words in a more premium voice - the basic website is kept and can be switched back to.
//   1 · what changes, said honestly          2 · access: the pay button (Razorpay) or "Make my advanced website"
//   3 · the job, followed like the banner's  4 · the critique + a preview, then Use / Try another layout / Keep my basic site
//   5 · done, with the way back to the basic site.
// Engine: /api/card/advanced (GET state + job, POST { mode: "preview" } to start, { accept: <job> } to save, { claim: <job> } to let go).
// Payment: /api/poster/pay/advanced (GET { allowed, reason, price }, POST order, POST { orderId, paymentId, signature } verify).
// Every message sits right under the control that caused it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronLeft, CircleDashed, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { payPrefill } from "@/lib/pay-prefill";
import { SITE_HOST } from "@/lib/site-url";
import { AdvancedSwitch, type AdvState } from "@/components/poster/advanced-entry";
import type { AdvancedSpec } from "@/lib/site-advanced";
import type { Card, CardBlock } from "@/lib/types";

// advanced-access.ts carries ADVANCED_PRICE_RUPEES but is server-only, so this client page cannot import it: the price shown is the
// one the payment route sends back, and this is only what shows if that route does not answer.
const PRICE_FALLBACK = 5999;
/** "3 layouts per payment" (owner's rule): the server may say how many are left; this counts them on the phone when it does not. */
const TRY_LIMIT = 3;
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
type EngineGet = Partial<JobView> & { job?: string | null; access?: { allowed: boolean; reason?: string }; current?: AdvState | null; error?: string };
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
  const base = { ...(card.site ?? { enabled: true }), advanced: res.spec, advancedOn: true } as NonNullable<Card["site"]>;
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
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptErr, setAcceptErr] = useState("");
  const [againErr, setAgainErr] = useState("");
  const [keepBusy, setKeepBusy] = useState(false);
  const [keepErr, setKeepErr] = useState("");
  const [doneUser, setDoneUser] = useState("");
  const [frameW, setFrameW] = useState(360);
  const frameBox = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; run.current += 1; dropKey(PREVIEW_KEY); }; }, []);
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
    if (pay?.ok) { setSelling(pay.data.selling !== false); setPrice(rupees(pay.data.price)); setServerLeft(typeof pay.data.triesLeft === "number" ? pay.data.triesLeft : null); }
    if (engine?.current !== undefined) setCur(engine.current);
  }, []);

  /** A finished job → the preview (the tries count it once), or the reason it failed back on the first step. */
  const finish = useCallback((v: JobView, mine: Card) => {
    const res = (v.result ?? {}) as Result;
    const good = v.state === "done" && (v.status ?? 500) < 400 && res.mode === "preview" && !!res.spec && res.cardId === mine.id;
    if (!good) {
      void api("/api/card/advanced", { method: "POST", json: { claim: v.job } }).catch(() => undefined);
      setStartErr(srv(res.error, T("The advanced design could not be made now. Please try again.", "Advanced design अभी नहीं बन पाया। दोबारा try करें।")));
      setStep("intro"); return;
    }
    const t = readTries(mine.id);
    if (!t.jobs.includes(v.job)) { t.n += 1; t.jobs.push(v.job); writeTries(mine.id, t); }
    setUsed(t.n); setJobId(v.job); setResult(res); setAcceptErr(""); setAgainErr(""); setKeepErr("");
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
        else if (r.ok) { setStartErr(T("The advanced design could not be made. Please try again.", "Advanced design नहीं बन पाया। दोबारा try करें।")); setStep("intro"); return; }
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
      // A design left running (or finished while this screen was closed) is picked up where it is.
      if (eg.job) {
        const v = eg as JobView;
        if (v.state === "running") { void follow(v, mine); return; }
        if (!v.claimed) { finish(v, mine); return; }
      }
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
      if (r.status === 402 || r.status === 403) { setAllowed(false); void refreshAccess(); setErr(srv(r.data.error, T("The advanced website is not open for your account yet.", "Advanced website अभी आपके account के लिए खुली नहीं है।"))); return; }
      if (r.status === 429) {
        if (r.data.reason === "tries") { setServerLeft(0); setErr(T(`You have used all ${TRY_LIMIT} layouts of your payment.`, `आपके payment के सारे ${TRY_LIMIT} layouts इस्तेमाल हो चुके हैं।`)); }
        else setErr(T("You have made the advanced design 8 times in the last hour. Please try again later.", "पिछले एक घंटे में आप 8 बार advanced design बना चुके हैं। थोड़ी देर बाद try करें।"));
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
      const o = await api<{ orderId?: string; amount?: number; currency?: string; keyId?: string; message?: string; error?: string }>("/api/poster/pay/advanced", { method: "POST", json: card ? { cardId: card.id } : {} });
      if (o.status === 503 && o.data.error === "advanced_closed") { setSelling(false); fail(T("The advanced website is not open for payment yet. Nothing was charged.", "Advanced website के लिए payment अभी खुला नहीं है। कुछ नहीं कटा।")); return; }
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
      const r = await api<{ ok?: boolean; error?: string; current?: AdvState; username?: string }>("/api/card/advanced", { method: "POST", json: { cardId: card.id, accept: jobId } });
      if (!r.ok) { setAcceptErr(r.status === 400 ? T("That preview is no longer there. Please make it again.", "वो preview अब नहीं है। दोबारा बनाएँ।") : srv(r.data.error, T("Could not save your advanced website. Please try again.", "आपकी advanced website save नहीं हुई। दोबारा try करें।"))); return; }
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
  const liveLink = `${SITE_HOST}/c/${doneUser || card?.username || ""}`;
  const box = "rounded-2xl border border-border bg-surface p-4";
  const errBox = "rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger";

  const header = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => goBack(router, "/poster/site")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
      <h1 className="flex-1 text-lg font-bold">{T("Advanced website", "Advanced website")}</h1>
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
        <p className="text-sm text-muted">{T("Make your website first. The advanced design is made from it.", "पहले अपनी website बनाएँ। Advanced design उसी से बनता है।")}</p>
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
          <p className="text-lg font-bold">{T("Your advanced website is being made", "आपकी advanced website बन रही है")}</p>
          <p className="text-xs text-muted">{T("Usually 1–2 minutes. Sometimes up to 3.", "आम तौर पर 1–2 मिनट। कभी-कभी 3 मिनट तक।")} · {clock}{used ? ` · ${T(`design ${used + 1} of ${TRY_LIMIT}`, `design ${used + 1} / ${TRY_LIMIT}`)}` : ""}</p>
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
        <p className="rounded-xl bg-surface2 px-3 py-2.5 text-sm">{T("You can close this screen. The design keeps being made on our server, and we tell you when it is ready. Nothing goes live until you say so.", "आप ये screen बंद कर सकते हैं। Design हमारे server पर बनता रहेगा, और तैयार होते ही हम बता देंगे। आपके कहे बिना कुछ live नहीं होगा।")}</p>
        {lost && <p className="rounded-xl border border-amber/50 bg-amber/10 px-3 py-2.5 text-sm">{T("No internet right now — your design is still being made on our server and shows here once you are back online.", "अभी internet नहीं है — आपका design हमारे server पर बन रहा है, internet आते ही यहाँ दिख जाएगा।")}</p>}
      </div>
    );
  }

  /* ---- 4 · the critique and the preview ---- */
  if (step === "preview" && result && card) {
    const items = result.critique?.items ?? [];
    const summary = result.critique?.summary;
    const changes = (result.diff?.text ?? []).filter((d) => d.before !== d.after).slice(0, 4);
    return (
      <div className="space-y-4 py-2">
        {header}
        <section className="space-y-1">
          <p className="flex items-center gap-1.5 text-base font-bold"><Sparkles className="h-4 w-4 text-ai" /> {T("Your advanced website is ready to see", "आपकी advanced website देखने के लिए तैयार है")}</p>
          <p className="text-xs text-muted">{T(`Design ${Math.min(used, TRY_LIMIT)} of ${TRY_LIMIT}. Nothing is live yet — your website stays as it is until you tap “Use this advanced website”.`, `Design ${Math.min(used, TRY_LIMIT)} / ${TRY_LIMIT}। अभी कुछ live नहीं है — “Use this advanced website” दबाने तक आपकी website वैसी ही रहेगी।`)}</p>
        </section>

        <section className={`${box} space-y-2.5`}>
          <p className="text-sm font-bold">{T("What the AI found on your present site", "AI को आपकी मौजूदा site में क्या मिला")}</p>
          {summary && (hi ? summary.hi || summary.en : summary.en) && <p className="text-sm text-ink">{hi ? summary.hi || summary.en : summary.en}</p>}
          {items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded-full bg-ai-soft px-2 py-0.5 text-[11px] font-semibold text-ai">{(AREA[it.area] ?? AREA.design)[hi ? 1 : 0]}</span>
                  <span className="min-w-0">{hi ? it.hi || it.en : it.en}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted">{T("No big problems were found; the new design is about a more premium look.", "कोई बड़ी कमी नहीं मिली; नया design ज़्यादा premium look के लिए है।")}</p>}
        </section>

        <section className="space-y-2">
          <div ref={frameBox} className="overflow-hidden rounded-xl border border-border bg-white" style={{ height: 1600 * scale }}>
            <iframe key={jobId} ref={frame} title={T("Advanced website preview", "Advanced website का preview")} src={`/preview/site?k=${PREVIEW_KEY}&shot=1`}
              onLoad={() => { try { frame.current?.contentWindow?.postMessage(`preview:${PREVIEW_KEY}`, window.location.origin); } catch { /* ignore */ } }}
              style={{ width: 1280, height: 1600, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
          </div>
          <a href={`/preview/site?k=${PREVIEW_KEY}&shot=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink underline underline-offset-2"><ExternalLink className="h-3.5 w-3.5" /> {T("Open it full size", "पूरे size में खोलें")}</a>
          <p className="text-[11px] text-muted">{T("This is the computer view. On a phone your link still opens your card.", "ये computer वाला view है। Phone पर आपका link अब भी आपका card खोलता है।")}</p>
        </section>

        {(result.diff?.layout || changes.length > 0) && (
          <section className={`${box} space-y-2`}>
            <p className="text-sm font-bold">{T("What changes", "क्या बदलेगा")}</p>
            {result.diff?.layout && <p className="text-sm"><b>{T("Layout", "Layout")}:</b> <span className="text-muted">{result.diff.layout.before}</span> → {result.diff.layout.after}</p>}
            {changes.map((d) => (
              <div key={d.key} className="space-y-0.5 text-sm">
                <p className="text-xs font-semibold text-muted">{hi ? d.label.hi || d.label.en : d.label.en}</p>
                {d.before && <p className="text-xs text-muted line-through">{d.before}</p>}
                <p>{d.after}</p>
              </div>
            ))}
          </section>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <button type="button" onClick={accept} disabled={acceptBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {acceptBusy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Use this advanced website", "यही advanced website लगाएँ")}
            </button>
            {acceptErr && <p className={errBox}>{acceptErr}</p>}
          </div>
          <div className="space-y-1.5">
            {remaining > 0 ? (
              <>
                <button type="button" onClick={() => start("again")} disabled={!!startBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 text-sm font-semibold disabled:opacity-60">
                  {startBusy === "again" && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Try another layout", "दूसरा layout आज़माएँ")} <span className="text-xs font-normal text-muted">({T(`${remaining} left`, `${remaining} बचे`)})</span>
                </button>
                <p className="text-[11px] text-muted">{T("A new layout takes about 1–2 minutes and replaces this one.", "नया layout बनने में करीब 1–2 मिनट लगते हैं और ये वाला हट जाता है।")}</p>
              </>
            ) : <p className="rounded-xl bg-surface2 px-3 py-2.5 text-xs">{T(`You have seen all ${TRY_LIMIT} layouts of this payment. Use this one, or keep your basic website.`, `इस payment के सारे ${TRY_LIMIT} layouts आप देख चुके हैं। यही लगाएँ, या अपनी basic website रखें।`)}</p>}
            {againErr && <p className={errBox}>{againErr}</p>}
          </div>
          <div className="space-y-1.5">
            <button type="button" onClick={keepBasic} disabled={keepBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted disabled:opacity-60">
              {keepBusy && <LoaderCircle className="h-4 w-4 animate-spin" />} {cur?.has && cur.on ? T("Keep my current website", "मेरी मौजूदा website ही रखें") : T("Keep my basic site", "मेरी basic site ही रखें")}
            </button>
            {keepErr && <p className={errBox}>{keepErr}</p>}
          </div>
        </div>
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
          <h2 className="text-2xl font-extrabold tracking-tight">{on ? T("Your advanced website is live", "आपकी advanced website live है") : T("Your basic website is back", "आपकी basic website वापस आ गई")}</h2>
          <p className="text-sm text-white/90">{on ? T("People on a computer now see the new design. On a phone they still get your card.", "Computer पर लोग अब नया design देखेंगे। Phone पर उन्हें अब भी आपका card मिलेगा।") : T("Your advanced design is saved — you can turn it on again any time.", "आपका advanced design save है — जब चाहें फिर चालू करें।")}</p>
          <a href={`https://${liveLink}?view=site`} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm"><span className="truncate">{liveLink}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" /></a>
        </section>
        <div className={`${box} space-y-2`}>
          <AdvancedSwitch cardId={card?.id} on={on} onChanged={(s) => { if (s) setCur(s); }} />
          <p className="text-[11px] text-muted">{T("Both designs stay saved, so you can go back and forth.", "दोनों designs save रहते हैं, तो आप आगे-पीछे जा सकते हैं।")}</p>
        </div>
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
          <p className="text-base font-bold">{live ? T("Your website stays as it is", "आपकी website वैसी ही रहेगी") : T("Your basic website stays as it is", "आपकी basic website वैसी ही रहेगी")}</p>
          <p className="text-sm text-muted">{live ? T("The new design was not used. Your advanced website is still live.", "नया design इस्तेमाल नहीं हुआ। आपकी advanced website अब भी live है।") : T("Nothing was changed. You can make the advanced one any time from Card & Website.", "कुछ नहीं बदला। Advanced वाली आप कभी भी Card & Website से बनवा सकते हैं।")}</p>
          <button type="button" onClick={() => goBack(router, "/poster/site")} className="inline-flex w-full items-center justify-center rounded-xl grad-brand py-3 text-sm font-semibold text-white">{T("Done", "हो गया")}</button>
        </section>
      </div>
    );
  }

  /* ---- 1 + 2 · what changes, and how to get it ---- */
  const bullets: [string, string, string, string][] = [
    ["A layout made only for your business", "सिर्फ़ आपके business के लिए बना layout", "Built from your trade and your details, and checked against other websites of the same trade so yours is not a copy of theirs.", "आपके काम और आपकी जानकारी से बना, और उसी काम की दूसरी websites से मिलाकर देखा जाता है ताकि आपकी किसी की नक़ल न हो।"],
    ["AI reviews your present site first", "पहले AI आपकी मौजूदा site जाँचता है", "It lists what is weak — a flat top, plain titles, little proof — and the new design fixes those.", "कमज़ोर बातों की list बनती है — फीका ऊपरी हिस्सा, सादे titles, कम भरोसा — और नया design उन्हें ठीक करता है।"],
    ["A more premium look and words", "ज़्यादा premium look और शब्द", "New composition, spacing, colours and fonts; a sharper top line, About text and section titles.", "नई बनावट, spacing, रंग और fonts; ऊपर की बात, About और section titles ज़्यादा असरदार।"],
    ["Your basic website is kept", "आपकी basic website बची रहती है", "You see the new site before it goes live, and you can switch back whenever you want.", "Live होने से पहले आप नई site देखते हैं, और जब चाहें वापस basic पर जा सकते हैं।"],
  ];
  return (
    <div className="space-y-4 py-2">
      {header}
      <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-float grad-brand">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative space-y-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"><Sparkles className="h-3 w-3" /> Premium</span>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{T("A website that looks made for you alone", "ऐसी website जो सिर्फ़ आपके लिए बनी दिखे")}</h2>
          <p className="text-sm text-white/90">{T("AI reviews your site and gives it a premium new look — a layout made only for your business.", "AI आपकी site को जाँचकर उसे premium नया look देता है — ऐसा layout जो सिर्फ़ आपके business के लिए बने।")}</p>
        </div>
      </section>

      <section className={`${box} space-y-3`}>
        <p className="text-sm font-bold">{T("What changes", "क्या बदलता है")}</p>
        <ul className="space-y-3">
          {bullets.map(([te, th, de, dh]) => (
            <li key={te} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ai" />
              <span className="min-w-0"><span className="block text-sm font-semibold">{T(te, th)}</span><span className="block text-xs text-muted">{T(de, dh)}</span></span>
            </li>
          ))}
        </ul>
        <p className="rounded-xl bg-surface2 px-3 py-2.5 text-xs text-muted">{T("What it does not do: it does not make new photos or change your prices, phone number or address. It uses the photos and facts already on your website.", "ये क्या नहीं करता: नई photos नहीं बनाता, और आपके दाम, फ़ोन number या पता नहीं बदलता। आपकी website की मौजूदा photos और जानकारी ही इस्तेमाल होती हैं।")}</p>
      </section>

      <section className={`${box} space-y-3`}>
        {cur?.has && (
          <div className="space-y-1.5 rounded-xl border border-ai/30 bg-ai-soft/50 px-3 py-2.5">
            <p className="text-sm font-semibold">{cur.on ? T("You already have an advanced website — it is live.", "आपके पास advanced website पहले से है — वो live है।") : T("You have an advanced website saved, but your basic one is showing.", "आपकी advanced website save है, पर अभी basic दिख रही है।")}</p>
            <AdvancedSwitch cardId={card?.id} on={!!cur.on} onChanged={(s) => { if (s) setCur(s); }} />
          </div>
        )}
        {allowed ? (
          <div className="space-y-1.5">
            {paidNote && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {T("Payment received. Thank you!", "Payment मिल गया। धन्यवाद!")}</p>}
            <button type="button" onClick={() => start("make")} disabled={!!startBusy || remaining <= 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
              {startBusy === "make" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} {cur?.has ? T("Design it again", "दोबारा design बनाएँ") : T("Make my advanced website", "मेरी advanced website बनाएँ")}
            </button>
            {remaining <= 0
              ? <p className="text-xs text-muted">{T(`You have used all ${TRY_LIMIT} layouts of this payment.`, `इस payment के सारे ${TRY_LIMIT} layouts इस्तेमाल हो चुके हैं।`)}</p>
              : <p className="text-xs text-muted">{T(`About 1–2 minutes. You see it first, and you can try up to ${TRY_LIMIT} layouts.`, `करीब 1–2 मिनट। पहले आप देखते हैं, और ${TRY_LIMIT} layouts तक आज़मा सकते हैं।`)}</p>}
            {startErr && <p className={errBox}>{startErr}</p>}
          </div>
        ) : !pending && (!selling || closedReason === "flag" || closedReason === "closed" || closedReason === "off") ? (
          <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-sm">{T("The advanced website is opening soon. Nothing to pay yet — we will tell you when it is ready.", "Advanced website जल्द शुरू हो रही है। अभी कुछ देना नहीं है — तैयार होते ही हम बता देंगे।")}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm font-bold">{T("Upgrade to the advanced website", "Advanced website में upgrade करें")}</p>
              <p className="text-2xl font-extrabold">{priceText}</p>
            </div>
            <p className="text-xs text-muted">{T("Free and ₹2,999 plans upgrade here. Anyone on the ₹5,999 plan already has this.", "Free और ₹2,999 वाले यहाँ से upgrade करें। ₹5,999 वाले के पास यह पहले से है।")}</p>
            <p className="text-xs text-muted">{T(`One payment. You can look at up to ${TRY_LIMIT} layouts and keep the one you like — or keep your basic site.`, `एक बार का payment। ${TRY_LIMIT} layouts तक देखकर जो पसंद आए रखें — या अपनी basic site रखें।`)}</p>
            {pending ? (
              <>
                <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs">{T("Your payment went through, but we have not confirmed it yet. Please do not pay again.", "आपका payment हो चुका है, पर हमने अभी confirm नहीं किया। कृपया दोबारा payment न करें।")}</p>
                <button type="button" onClick={() => confirmPay(pending)} disabled={payBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
                  {payBusy && <LoaderCircle className="h-5 w-5 animate-spin" />} {T("Confirm my payment", "मेरा payment confirm करें")}
                </button>
              </>
            ) : (
              <button type="button" onClick={pay} disabled={payBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
                {payBusy && <LoaderCircle className="h-5 w-5 animate-spin" />} {T(`Upgrade — ${priceText}`, `Upgrade करें — ${priceText}`)}
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
