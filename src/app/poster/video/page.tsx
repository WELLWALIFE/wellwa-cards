"use client";
// Video ad (was "Ad Builder"): Brief → AI script (review & edit) → Style → Voice & music →
// Generate. ONE price is shown, charged and refunded; one tap makes exactly one paid render;
// every queued job has a Stop button; every failure says what happened and what happened to the money.
import { AiPageGate } from "@/lib/ai-access";
import { Storyboard } from "@/components/poster/storyboard";
import { ProductCheckSheet } from "@/components/poster/product-check-sheet";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Camera, Images, ChevronLeft, ChevronRight, Play, Pause, Download, Share2, Check, Sparkles, RefreshCw, Pencil, AlertTriangle } from "lucide-react";
import { compressImageFile } from "@/lib/image-utils";
import { isLoggedIn, shareFile, downloadPoster, api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { VOICE_OPTIONS } from "@/lib/media/voices";
import { adCredits, AD_LENGTHS, REALISTIC_MAX_LENGTH } from "@/lib/media/ad-pricing";
import { AddCredits } from "@/components/poster/add-credits";
import { Guide } from "@/components/poster/guide";
import { VideoSteps } from "@/components/poster/video-steps";

type Job = { id: string; kind: string; status: string; output_url: string | null; error: string | null; created_at: string; cost?: number; pipeline?: number; progress?: { text?: string } | null; input?: Record<string, unknown> & { outputs?: Record<string, string>; product?: string; formats?: string[]; tier?: string } };
// One plain sentence per engine failure — a shopkeeper must never read "TTS failed: 400" — and always the money.
// A render that failed is refunded in full by the worker; a job the owner stopped may have spent part of it,
// so that one case says only what we can honestly promise.
const MONEY_BACK_EN = "Your credits have been returned.";
function failLine(raw: string | null | undefined, hi: boolean): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return hi ? "आपने यह video रोक दी थी। जो credits इस्तेमाल नहीं हुए, वे वापस कर दिए गए हैं।" : "You stopped this video. Any credits we did not use have been returned.";
  const back = hi ? "आपके credits वापस कर दिए गए हैं।" : MONEY_BACK_EN;
  // The realistic engine refuses to invent footage when a scene has no picture plan of its own
  // ("no storyboard: …"). It used to quietly render water-ionizer stock for every business.
  if (e.includes("no storyboard")) return `${hi ? "इस video के scenes plan नहीं हो पाए।" : "We could not plan the scenes for this video."} ${back}`;
  if (/tts|voice|speech|audio/.test(e)) return `${hi ? "आवाज़ record नहीं हो पाई।" : "The voice could not be recorded."} ${back}`;
  if (/clip|stock|image|photo|veo|kling|fal|pexels/.test(e)) return `${hi ? "एक scene की तस्वीर नहीं मिल पाई।" : "We could not get a picture for one scene."} ${back}`;
  if (/upload|ffmpeg|timeout|timed out|render|encode|finished/.test(e)) return `${hi ? "Video पूरी नहीं हो पाई।" : "The video could not be finished."} ${back}`;
  return `${hi ? "कुछ गड़बड़ हो गई।" : "Something went wrong."} ${back}`;
}
const VIDEO_DRAFT_KEY = "akp-video-draft"; // NOT saveDraft's "akp-draft" — that one belongs to the card editor
const isHttp = (u: string) => /^https?:\/\//.test(u);
type Scene = { text: string; caption_text: string; visual: string; motion: string };
type V2Script = { angle?: string; first_visual?: string; promise?: string; headline?: string; why?: string; scenes: { role?: string; text: string; caption: string; shot?: unknown }[]; cta: { text: string; caption: string }; features?: string[]; post_caption?: string; voice?: string; music?: string; template?: string };
type Option = { script: V2Script; verdict: "ready" | "needs_fix"; reason: string; gates: { ok: boolean; errors: { gate: string; scene: number | "cta" | null; msg: string }[]; est: { per_scene_sec: number[]; total_sec: number } } };
type Plan = { headline: string; scenes: Scene[]; cta: string; caption: string; features: string[]; voice?: string; music?: string; template?: string; questions?: string[] };
const TPL = [
  { k: "bold", bg: "linear-gradient(135deg,#0f172a,#1e3a8a)", ac: "#fbbf24" }, { k: "clean", bg: "linear-gradient(135deg,#fff,#e0f2fe)", ac: "#0e9e90" },
  { k: "festive", bg: "linear-gradient(135deg,#7c2d12,#b45309)", ac: "#fde68a" }, { k: "offer", bg: "linear-gradient(135deg,#b91c1c,#f59e0b)", ac: "#fff" },
  { k: "trust", bg: "linear-gradient(135deg,#082f49,#0e7490)", ac: "#67e8f9" }, { k: "fresh", bg: "linear-gradient(135deg,#064e3b,#0e9e90)", ac: "#a7f3d0" },
];
const FMT = [
  { k: "reel", l: "Reel / Status", ratio: "9:16", w: 9, h: 16 },
  { k: "square", l: "Facebook / Insta Post", ratio: "1:1", w: 1, h: 1 },
  { k: "wide", l: "YouTube", ratio: "16:9", w: 16, h: 9 },
] as const;
const emptyForm = () => ({ product: "", category: "", goal: "leads", audience: "", lang: "hinglish", length: 10 as number, tone: "warm", offer: "", phone: "", brandName: "", website: "", notes: "", features: "", voiceStyle: "warm", voice: true, template: "bold", music: "", formats: ["reel"] as string[], tier: "template" as "template" | "realistic" | "presenter" | "testimonial", logoUrl: "", presenterPhoto: "", captions: "words" as "words" | "off", variants: 1 as 1 | 3 });
type MyProduct = { id: string; name: string; photo_url: string | null; benefits: string[]; offer: string; category?: string; photos?: { url: string; view: string; role: string }[]; facts_confirmed_at?: string | null };
type TestimonialData = { text: string; customer_name: string; city: string; rating: number };
const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function VideoTabInner() {
  const router = useRouter();
  const { lang: ui } = useT(); const hi = ui !== "en";
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]); // data URLs (new picks) or https URLs (kept from a job being edited)
  const [f, setF] = useState(emptyForm());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [chosen, setChosen] = useState<V2Script | null>(null);
  const [tracks, setTracks] = useState<{ key: string; name: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState("");
  const [busyAction, setBusyAction] = useState<string>("");

  const [products, setProducts] = useState<MyProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [checking, setChecking] = useState(false);
  const [board, setBoard] = useState<{ id: string; cost: number } | null>(null);
  const loadProducts = () => api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => setProducts(r.data.products ?? [])).catch(() => {});
  const [testimonialData, setTestimonialData] = useState<TestimonialData | null>(null);
  // ---- one tap = one paid render ----
  const [submitted, setSubmitted] = useState(false);
  const idem = useRef("");
  function newIdem() { try { idem.current = crypto.randomUUID(); } catch { idem.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`; } }
  // ---- credits: packs are always one tap away, and a 402 says exactly how many are needed ----
  const [showPacks, setShowPacks] = useState(false);
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  // ---- "Make my storyboard (free)" is only true when the server really runs pipeline 2 ----
  const [storyboardFree, setStoryboardFree] = useState(false);
  // ---- per-job / per-file feedback ----
  const [stopping, setStopping] = useState("");
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  const [fileMsg, setFileMsg] = useState<Record<string, string>>({});
  // ---- draft ----
  const [draftOffer, setDraftOffer] = useState<{ f: typeof f; plan: Plan | null; photos: string[]; step: number; dropped: number } | null>(null);
  const [draftOn, setDraftOn] = useState(true);
  async function refresh() { const r = await fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); setJobs((r.jobs ?? []).filter((j: Job) => j.kind === "ad" && j.input?.tier !== "stock")); if (typeof r.credits === "number") setCredits(r.credits); }
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/video"); return; }
    setReady(true); refresh(); newIdem();
    const params = new URLSearchParams(window.location.search);
    if (params.get("credits") === "1") setShowPacks(true); // /poster/plan sends people here to buy
    let seeded = false;
    try { const seed = JSON.parse(sessionStorage.getItem("akp-ad-seed") || "null"); if (seed?.photos?.length) { seeded = true; sessionStorage.removeItem("akp-ad-seed"); setPhotos(seed.photos.slice(0, 5)); setF((x) => ({ ...x, product: seed.product || x.product, category: seed.category || x.category })); } } catch { /* ignore */ }
    // Unfinished work from last time — offered, never restored behind the owner's back.
    if (!seeded && !params.get("testimonial")) {
      try {
        const d = JSON.parse(localStorage.getItem(VIDEO_DRAFT_KEY) || "null");
        if (d?.f?.product && Number(d.step) < 5) setDraftOffer({ f: { ...emptyForm(), ...d.f }, plan: d.plan ?? null, photos: Array.isArray(d.photos) ? d.photos : [], step: Math.max(0, Math.min(4, Number(d.step) || 0)), dropped: Number(d.dropped) || 0 });
      } catch { /* ignore */ }
    }
    fetch("/api/media/music").then((r) => r.json()).then((j) => setTracks(j.tracks ?? [])).catch(() => {});
    // /api/poster/* routes are bearer-token only (no cookie fallback) — must go through api().
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => setProducts(r.data.products ?? [])).catch(() => {});
    // Convenience: pull brand name, phone and logo from the default profile once, so nobody retypes what's already in Shubhora.
    // On a poster profile `tagline` is the "Firm / company name" field and `name` is the owner's own name — the brand is the firm.
    api<{ profiles?: Array<{ is_default?: boolean; tagline?: string; name?: string; phone?: string; logo_url?: string }> }>("/api/poster/profiles").then((r) => {
      const list = r.data.profiles ?? []; const p = list.find((x) => x.is_default) ?? list[0];
      if (p) setF((x) => ({ ...x, brandName: x.brandName || p.tagline || p.name || "", phone: x.phone || p.phone || "", logoUrl: x.logoUrl || p.logo_url || "" }));
    }).catch(() => {});
    // Arrived from Testimonials "make a video" — skip Brief/Script, jump straight to Style.
    const tId = params.get("testimonial");
    if (tId) {
      const r = await api<{ testimonials?: Array<{ id: string; text: string; customer_name: string; city?: string; rating?: number }> }>("/api/poster/testimonials");
      const t = (r.data.testimonials ?? []).find((x) => x.id === tId);
      if (t) {
        const tm: TestimonialData = { text: t.text, customer_name: t.customer_name, city: t.city ?? "", rating: t.rating ?? 5 };
        setTestimonialData(tm);
        setF((x) => ({ ...x, tier: "testimonial", product: t.customer_name, lang: "hinglish" }));
        setPlan({ headline: t.customer_name, scenes: [{ text: tm.text, caption_text: tm.text, visual: "", motion: "" }], cta: "", caption: `${tm.text} — ${tm.customer_name}${tm.city ? ", " + tm.city : ""}`, features: [] });
        setStep(2);
      }
    }
  })(); }, [router]);
  function fillFromProduct(id: string) {
    const pr = products.find((x) => x.id === id); if (!pr) return;
    const en = pr.benefits.filter((b) => /^[A-Za-z0-9 %+\-&'.]+$/.test(b) && b.trim().split(/\s+/).length <= 3);
    setF((x) => ({ ...x, product: pr.name, offer: x.offer || pr.offer || "", features: (en.length ? en : pr.benefits).slice(0, 6).join("\n") }));
    if (pr.photo_url) setPhotos((p) => p.includes(pr.photo_url!) ? p : [pr.photo_url!, ...p].slice(0, 5));
  }
  useEffect(() => { if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return; const t = setInterval(refresh, 6000); return () => clearInterval(t); }, [jobs]);
  // Realistic is capped at 30s and renders one video — keep the form honest whichever order the steps are tapped in,
  // otherwise the screen prices 60s while the server clamps to 30s and charges for 60s.
  useEffect(() => {
    setF((x) => {
      const length = x.tier === "realistic" && x.length > REALISTIC_MAX_LENGTH ? REALISTIC_MAX_LENGTH : x.length;
      const variants = x.tier === "template" ? x.variants : (1 as 1 | 3);
      return length === x.length && variants === x.variants ? x : { ...x, length, variants };
    });
  }, [f.tier]);
  // Keep the unfinished video on the phone: a closed tab or a dropped call must not cost the shopkeeper all that typing.
  useEffect(() => {
    if (!ready || !draftOn) return;
    // They ignored the "continue?" banner and started typing — that IS the answer, so stop holding the draft back.
    if (draftOffer) { if (f.product.trim()) setDraftOffer(null); return; }
    // Only https photos are kept: a freshly picked phone photo is a ~600 KB data URL and five of them fill localStorage.
    // f.presenterPhoto is the same thing (compressImageFile → a 1600 px JPEG data URL) and was slipping
    // through this filter inside `f`: ~1 MB rewritten to disk on every keystroke, a real QuotaExceededError
    // on a cheap Android, and a photo of someone's face left on a shared phone for ever.
    const t = setTimeout(() => {
      const kept = photos.filter(isHttp);
      const keepPresenter = isHttp(f.presenterPhoto);
      const dropped = photos.length - kept.length + (f.presenterPhoto && !keepPresenter ? 1 : 0);
      try { localStorage.setItem(VIDEO_DRAFT_KEY, JSON.stringify({ f: { ...f, presenterPhoto: keepPresenter ? f.presenterPhoto : "" }, plan, photos: kept, dropped, step, at: Date.now() })); }
      catch { /* full, private mode or blocked — the draft is a convenience, never a requirement */ }
    }, 500);
    return () => clearTimeout(t);
  }, [ready, draftOffer, draftOn, f, plan, photos, step]);
  const clearVideoDraft = () => { try { localStorage.removeItem(VIDEO_DRAFT_KEY); } catch { /* ignore */ } };
  // THE price. Shown in the summary, used by the "not enough credits" box and by the Generate button —
  // exactly the formula src/app/api/media/ad/route.ts charges, so the screen can never quote a different number.
  // Only a TEMPLATE ad can be sold as 3 variations: the server forces variants = 1 for
  // realistic (ad/route.ts:65) because that pipeline renders exactly one video, so pricing
  // realistic at 1.5x here would quote 60 credits for a 40-credit charge.
  const total = Math.ceil(adCredits(f.length) * (f.variants === 3 && f.tier === "template" ? 1.5 : 1));
  // Can this brief be a Realistic video at all? The planner writes visual: "" for every scene of a
  // confirmed-facts product (those briefs belong to the storyboard pipeline), and /api/media/ad
  // refuses a realistic order whose scenes have no visual. With the storyboard pipeline off that
  // is EVERY realistic order from those owners — so say it here, at the tier card, instead of
  // letting them price it, confirm the Product check and be refused at the last tap.
  const realisticOff = !!plan && plan.scenes.length > 0 && plan.scenes.some((sc) => !sc.visual) && !(storyboardFree && !!productId);
  const REALISTIC_OFF_LINE = hi ? "Realistic (film जैसी) video saved products के लिए अभी बंद है — Template या Presenter चुनें, दोनों इस product के साथ चलते हैं।" : "Realistic (film-like) video is switched off for saved products right now — Template and Presenter both work with this product.";

  const [compressing, setCompressing] = useState(false);
  async function pick(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, 5 - photos.length);
    setCompressing(true);
    for (const file of list) {
      const url = await compressImageFile(file); // shrink before it ever sits in state — a raw phone photo is several MB
      setPhotos((p) => p.length < 5 ? [...p, url] : p);
    }
    setCompressing(false);
  }
  const [presenterUploading, setPresenterUploading] = useState(false);
  async function pickPresenter(file: File | null) {
    if (!file) return;
    setPresenterUploading(true);
    const url = await compressImageFile(file);
    setF((x) => ({ ...x, presenterPhoto: url }));
    setPresenterUploading(false);
  }
  const [hookOptions, setHookOptions] = useState<string[]>([]);
  const [hookBusy, setHookBusy] = useState(false);
  async function tryHooks() {
    if (!plan) return; setHookBusy(true); setHookOptions([]);
    const r = await fetch("/api/media/ad-hook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: f.product, category: f.category, tone: f.tone, lang: f.lang, currentHook: plan.scenes[0]?.text || "" }) });
    const j = await r.json(); setHookBusy(false);
    if (r.ok) setHookOptions(j.hooks ?? []);
  }
  function pickHook(h: string) {
    if (!plan) return;
    const sc = [...plan.scenes]; sc[0] = { ...sc[0], text: h };
    setPlan({ ...plan, scenes: sc }); setHookOptions([]);
  }
  function playSample(url: string, key: string) {
    if (playing === key) { audio.current?.pause(); setPlaying(""); return; }
    if (!audio.current) audio.current = new Audio();
    audio.current.src = url; audio.current.play().catch(() => {}); setPlaying(key);
    audio.current.onended = () => setPlaying("");
  }

  async function makePlan() {
    setPlanBusy(true); setErr("");
    const r = await fetch("/api/media/ad-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, product_id: productId || undefined, features: f.features.split("\n").map((x) => x.trim()).filter(Boolean) }) });
    const j = await r.json(); setPlanBusy(false);
    if (!r.ok) { setErr(j.error || "AI plan failed"); return; }
    // Only the server knows whether the free storyboard pipeline is switched on (AD_PIPELINE_V2 + a worker that can run it).
    // Until it says so we must not promise a free storyboard — the other branch charges the full price immediately.
    setStoryboardFree(j.storyboard === true);
    const opts = Array.isArray(j.scripts) ? (j.scripts as Option[]) : []; setOptions(opts); setChosen(opts[0]?.script ?? null);
    const p = j.plan as Plan; setPlan(p);
    setF((x) => ({ ...x, template: p.template && TPL.some((t) => t.k === p.template) ? p.template : x.template, music: p.music && tracks.some((t) => t.key === p.music) ? p.music : x.music, voiceStyle: p.voice === "female" ? "warmf" : x.voiceStyle }));
    setStep(1);
  }

  async function generate() {
    if (!plan || busy || submitted) return;
    const free = storyboardFree && f.tier === "realistic" && !!productId;
    if (!window.confirm(free ? "Make your storyboard? It is free — credits are charged only when you tap Animate." : `Make this video? ${f.length} seconds · ${total} credits.`)) return;
    setBusy(true); setErr(""); setNeedCredits(null);
    if (!idem.current) newIdem();
    try {
      const urls: string[] = [];
      const { uploadStudioRef } = await import("@/lib/cloud");
      for (let i = 0; i < photos.length; i++) {
        if (/^https?:\/\//.test(photos[i])) { urls.push(photos[i]); continue; }
        const u = await uploadStudioRef(photos[i], (Date.now() + i) % 1000); if (u) urls.push(u);
      }
      let presenterPhotoUrl = "";
      if (f.tier === "presenter" && f.presenterPhoto) {
        presenterPhotoUrl = /^https?:\/\//.test(f.presenterPhoto) ? f.presenterPhoto : (await uploadStudioRef(f.presenterPhoto, 9999)) || "";
      }
      // idem: the same tap retried (flaky network, double tap) must never become a second paid render.
      const body = { ...f, idem: idem.current, script_v2: chosen && plan && chosen.scenes.length === plan.scenes.length ? chosen : undefined, product_id: f.tier === "realistic" && productId ? productId : undefined, photos: urls, headline: plan.headline, features: (plan.features ?? []).slice(0, 4), script: [...plan.scenes.map((s) => s.text), plan.cta], scenes: plan.scenes, cta: plan.cta, caption: plan.caption, presenterPhoto: presenterPhotoUrl || undefined, testimonial: f.tier === "testimonial" ? testimonialData : undefined };
      const r = await fetch("/api/media/ad", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Failed");
        if (r.status === 402) setNeedCredits(Math.max(1, Number(j.cost) || total)); // always give them a way to buy
        if (j.need === "product_check") setChecking(true);
        return;
      }
      audio.current?.pause(); setPlaying("");
      clearVideoDraft(); setDraftOn(false);
      if (j.pipeline === 2) { setBoard({ id: j.jobId, cost: j.animate_cost }); refresh(); return; }
      setSubmitted(true); // paid: this exact order is now spent, and the steps lock until "Edit & regenerate"
      setStep(5); refresh();
    } catch {
      // fetch() rejects on a dropped mobile connection, and r.json() throws on a 502 HTML page
      // from the proxy. Without this the spinner just stopped and nothing was said — on the one
      // screen where the owner cannot tell whether they have been charged.
      setErr(hi ? "Server तक नहीं पहुँच पाए। Internet देखकर दोबारा दबाएँ — दो बार पैसे नहीं कटेंगे।" : "We could not reach the server. Check your internet and tap again — you will not be charged twice.");
    } finally { setBusy(false); }
  }

  function startFresh() { setOptions([]); setChosen(null); setPhotos([]); setF(emptyForm()); setPlan(null); setErr(""); setTestimonialData(null); setHookOptions([]); setStep(0); setSubmitted(false); setNeedCredits(null); setStoryboardFree(false); setDraftOn(true); newIdem(); clearVideoDraft(); }
  function editJob(j: Job) {
    const inp = j.input ?? {};
    setF({ ...emptyForm(), ...(inp as Record<string, unknown>) } as typeof f);
    setPhotos(Array.isArray(inp.photos) ? (inp.photos as string[]) : []);
    const scenes = Array.isArray(inp.scenes) ? (inp.scenes as Scene[]) : [];
    setPlan({ headline: String(inp.headline ?? ""), scenes: scenes.length ? scenes : [{ text: "", caption_text: "", visual: "", motion: "" }], cta: String(inp.cta ?? ""), caption: String(inp.caption ?? ""), features: Array.isArray(inp.features) ? (inp.features as string[]) : [], template: String(inp.template ?? "bold"), music: String(inp.music ?? "") });
    setErr(""); setStep(1); setSubmitted(false); setNeedCredits(null); setDraftOn(true); newIdem();
  }
  async function share(url: string, name: string) {
    setBusyAction(url);
    const r = await shareFile(url, plan?.caption ?? f.product, name, "video/mp4");
    setFileMsg((m) => ({ ...m, [url]: r === "shared" ? (hi ? "भेज दी" : "Sent") : r === "downloaded" ? (hi ? "फ़ोन में save हो गई" : "Saved to your phone") : (hi ? "Share नहीं हुआ — Download दबाएँ" : "Could not share — tap Download") }));
    setBusyAction("");
  }
  async function download(url: string, name: string) {
    setBusyAction(url + "dl");
    const ok = await downloadPoster(url, name);
    setFileMsg((m) => ({ ...m, [url]: ok ? (hi ? "फ़ोन में save हो गई" : "Saved to your phone") : (hi ? "Save नहीं हुई — फिर कोशिश करें" : "Could not save — try again") }));
    setBusyAction("");
  }
  // The only way out on a phone. /api/media/jobs DELETE already exists; until now nothing in this shell called it.
  async function stopJob(j: Job) {
    const cost = Number(j.cost ?? 0);
    if (!window.confirm(hi ? "यह video रोक दें? जो credits इस्तेमाल नहीं हुए, वे वापस मिल जाएँगे।" : "Stop this video? The credits we have not used yet come back to you.")) return;
    setStopping(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: d.error || (hi ? "रोक नहीं पाए। फिर कोशिश करें." : "Could not stop it. Please try again.") })); return; }
      // The server is the only honest source for the numbers. Before it sends them, promise nothing exact.
      const refunded = typeof d.refunded === "number" ? d.refunded : null;
      const spent = typeof d.spent === "number" ? d.spent : refunded === null ? null : Math.max(0, cost - refunded);
      const msg = refunded === null
        ? (hi ? "रोक दी गई। जो credits इस्तेमाल नहीं हुए, वे वापस कर दिए गए हैं।" : "Stopped. Any credits we did not use have been returned.")
        : refunded > 0 && spent && spent > 0
        ? (hi ? `रोक दी गई — ${refunded} credits वापस (${spent} video बनाने में लग चुके थे)।` : `Stopped — ${refunded} credits returned (${spent} were already used making the video).`)
        : refunded > 0
        ? (hi ? "रोक दी गई — आपके credits वापस आ गए।" : "Stopped — your credits are back.")
        : cost > 0
        ? (hi ? `रोक दी गई — कोई credit वापस नहीं आया (${spent ?? cost} video बनाने में लग चुके थे)।` : `Stopped — no credits came back (${spent ?? cost} were already used making the video).`)
        : (hi ? "रोक दी गई।" : "Stopped.");
      setRowMsg((m) => ({ ...m, [j.id]: msg }));
      refresh();
    } catch { setRowMsg((m) => ({ ...m, [j.id]: hi ? "रोक नहीं पाए। फिर कोशिश करें." : "Could not stop it. Please try again." })); }
    finally { setStopping(""); }
  }

  if (!ready) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const titles = hi ? ["Brief (AI को सब बताएँ)", "Script — देखें और बदलें", "Style", "आवाज़ और music", "Format और generate", "आपकी videos"] : ["Brief (tell the AI everything)", "Script — review & edit", "Style", "Voice & music", "Formats & generate", "Your videos"];
  const targetWords = Math.round(f.length * 2.3);
  const scriptWords = plan ? wordsOf(plan.scenes.map((s) => s.text).join(" ")) + wordsOf(plan.cta) : 0;
  const overBy = plan ? scriptWords - Math.round(targetWords * 1.15) : 0;
  const estSec = plan ? Math.round(scriptWords / 2.3) : f.length;

  if (board) return (
    <div className="space-y-4">
      <Storyboard jobId={board.id} animateCost={board.cost} onClose={() => { setBoard(null); setStep(5); refresh(); }} />
      {credits !== null && credits < board.cost && <AddCredits need={board.cost} have={credits} onDone={refresh} />}
    </div>
  );
  return (
    <div className="space-y-4">
      {checking && productId && <ProductCheckSheet productId={productId} productName={products.find((x) => x.id === productId)?.name ?? "product"} langs={[f.lang]} onClose={() => { setChecking(false); loadProducts(); }} />}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold flex items-center gap-1.5"><Sparkles className="h-5 w-5 text-brand" /> Video ad</h1>
        <div className="flex items-center gap-1.5 shrink-0">
          {credits !== null && <span className="text-xs rounded-full bg-surface2 px-2.5 py-1 font-semibold">{credits} credits</span>}
          <button type="button" onClick={() => setShowPacks((v) => !v)} className="rounded-full border border-brand px-2.5 py-1 text-xs font-semibold text-brand-ink">{showPacks ? (hi ? "बंद करें" : "Close") : "+ Credits"}</button>
        </div>
      </div>
      {showPacks && <AddCredits onDone={refresh} />}
      {draftOffer && (
        <div className="rounded-xl border border-brand bg-brand-soft/40 p-3 space-y-2">
          <p className="text-sm font-semibold">{hi ? "पिछली video पूरी करें?" : "Continue your last video?"}</p>
          <p className="text-xs text-muted">{draftOffer.f.product}{draftOffer.dropped > 0 ? (hi ? " · फ़ोन से चुनी फ़ोटो दोबारा लगानी होंगी" : " · add your phone photos again") : ""}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { const d = draftOffer; setF(d.f); setPlan(d.plan); setPhotos(d.photos); setStep(d.step); setDraftOffer(null); }} className="flex-1 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white">{hi ? "हाँ, वहीं से" : "Yes, continue"}</button>
            <button type="button" onClick={() => { setDraftOffer(null); clearVideoDraft(); }} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{hi ? "नई शुरू करें" : "Start fresh"}</button>
          </div>
        </div>
      )}
      {/* The Studio's one flow (Type → Words → Look & voice → Make) over this page's own six stops: brief and script
          are the words, style and voice the look, generate and done the making. Back / Next move between them. */}
      <VideoSteps step={step <= 1 ? 2 : step <= 3 ? 3 : 4} hi={hi} note={titles[step]} />
      <div className="flex flex-wrap gap-1 text-[11px]">{titles.map((t, i) => {
        const can = i === 5 ? true : submitted ? false : i === 0 || !!plan;
        return <button key={t} type="button" disabled={!can} onClick={() => can && setStep(i)} aria-current={i === step ? "step" : undefined} className={`rounded-full px-2.5 py-1 font-semibold disabled:opacity-40 ${i === step ? "bg-brand-soft text-brand-ink" : "bg-surface2 text-muted"}`}>{t}</button>;
      })}</div>
      {submitted && <p className="rounded-lg bg-surface2 p-2.5 text-xs">{hi ? "बन चुकी है — दूसरी बनाने के लिए 'बदलकर दोबारा बनाओ' दबाएँ।" : "Already made — tap “Edit & regenerate” to make another."}</p>}
      {step === 0 && <Guide hi="जितना बताएँगे, video उतनी सही बनेगी। Product की असली फ़ोटो ज़रूर लगाएँ — वही video में दिखेगी। लंबाई के आगे credits दिखेंगे।" en="The more you tell, the better the video. Add the real product photo — that exact product appears in the video. Credits for each length are shown below." />}
      {step === 1 && <Guide hi="AI ने script लिख दी है। हर line पर tap करके अपने हिसाब से बदल सकते हैं, या 'दूसरा plan' से AI से फिर लिखवाएँ।" en="AI wrote the script. Tap any line to edit it yourself, or tap 'Re-plan' to have the AI write it again." />}
      {step === 2 && <Guide hi="Template = तेज़ और सस्ता (photo + text)। Realistic = असली film जैसे scenes। Presenter = कोई (आप या team member) सीधे camera पर बोलता हुआ — भरोसा बनाने के लिए सबसे अच्छा।" en="Template = fast and cheap (photo + text). Realistic = film-like scenes. Presenter = someone (you or a team member) talking directly to camera — best for building trust." />}
      {step === 3 && <Guide hi="▶ दबाकर हर आवाज़ का sample सुनें, फिर पसंद वाली चुनें।" en="Tap ▶ to hear a sample of each voice, then pick the one you like." />}

      {step === 0 && (
        <div className="space-y-3">
          {products.length > 0 && (
            <div className="rounded-xl border border-brand/40 bg-brand-soft/40 p-2.5">
              <label className="text-xs font-semibold text-brand-ink block mb-1">{hi ? "⚡ मेरे किसी product से भरें (नाम, फ़ोटो, खूबियाँ अपने-आप)" : "⚡ Fill from one of my products (name, photo, benefits auto-filled)"}</label>
              <select onChange={(e) => { setProductId(e.target.value); if (e.target.value) fillFromProduct(e.target.value); }} value={productId} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <option value="">{hi ? "-- चुनें --" : "-- choose --"}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{hi ? "प्रोडक्ट की असली फ़ोटो (3–5 अलग-अलग angle)" : "Real product photos (3–5 different angles)"}</p>
            <p className="text-xs text-muted mb-2">{hi ? "जितनी ज़्यादा फ़ोटो, video में product उतना सही और हर scene अलग।" : "More photos = more accurate product and varied scenes."}</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => <span key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-xs">×</button></span>)}
              {photos.length < 5 && !compressing && (
                <>
                  <label className="h-20 w-20 rounded-xl bg-surface2 border border-dashed border-border grid place-items-center cursor-pointer gap-0.5">
                    <Camera className="h-5 w-5 text-muted" /><span className="text-[9px] text-muted">{hi ? "कैमरा" : "Camera"}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files)} />
                  </label>
                  <label className="h-20 w-20 rounded-xl bg-surface2 border border-dashed border-border grid place-items-center cursor-pointer gap-0.5">
                    <Images className="h-5 w-5 text-muted" /><span className="text-[9px] text-muted">{hi ? "Gallery" : "Gallery"}</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
                  </label>
                </>
              )}
              {compressing && <span className="h-20 w-20 rounded-xl bg-surface2 border border-dashed border-border grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></span>}
            </div>
          </div>
          <input className={inp} placeholder={hi ? "प्रोडक्ट का नाम *" : "Product name *"} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} />
          <input className={inp} placeholder={hi ? "Category (जैसे water ionizer, saree, coaching)" : "Category (e.g. water ionizer, saree, coaching)"} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <input className={inp} placeholder={hi ? "Brand / दुकान का नाम" : "Brand / shop name"} value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} />
          <div><p className="text-xs font-semibold text-muted mb-1">{hi ? "Video का मक़सद" : "Goal"}</p><div className="flex flex-wrap gap-2">{[["leads", hi ? "WhatsApp leads" : "WhatsApp leads"], ["offer", hi ? "ऑफ़र बेचना" : "Push an offer"], ["awareness", hi ? "पहचान बनाना" : "Awareness"], ["festival", hi ? "त्योहार + product" : "Festival + product"], ["transformation", hi ? "पहले → बाद (बदलाव)" : "Before → After"]].map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, goal: k })} className={chip(f.goal === k)}>{l}</button>)}</div></div>
          <div><p className="text-xs font-semibold text-muted mb-1">{hi ? "भाषा" : "Language"}</p><div className="flex flex-wrap gap-2">{[["hi", "हिंदी"], ["hinglish", "Hinglish"], ["en", "English"], ["mr", "मराठी"], ["gu", "ગુજરાતી"], ["pa", "ਪੰਜਾਬੀ"], ["bn", "বাংলা"], ["ta", "தமிழ்"], ["te", "తెలుగు"], ["kn", "ಕನ್ನಡ"], ["ml", "മലയാളം"], ["or", "ଓଡ଼ିଆ"]].map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, lang: k })} className={chip(f.lang === k)}>{l}</button>)}</div></div>
          <div>
            <p className="text-xs font-semibold text-muted mb-1">{hi ? "लंबाई" : "Length"}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {AD_LENGTHS.map((n) => {
                const off = f.tier === "realistic" && n > REALISTIC_MAX_LENGTH; // the server clamps these — never price a length it will not make
                return (
                  <button key={n} type="button" disabled={off} onClick={() => setF({ ...f, length: f.tier === "realistic" && n > REALISTIC_MAX_LENGTH ? REALISTIC_MAX_LENGTH : n })} className={`rounded-xl border px-1 py-2 text-center disabled:opacity-40 ${f.length === n && !off ? "border-brand bg-brand-soft" : "border-border"}`}>
                    <span className="block text-sm font-bold">{n}s</span>
                    <span className="block text-[10px] text-brand-ink font-semibold">{adCredits(n)} cr</span>
                  </button>
                );
              })}
            </div>
            {f.tier === "realistic"
              ? <p className="text-[11px] text-lead mt-1">{hi ? `Realistic video ${REALISTIC_MAX_LENGTH} second तक ही बनती है।` : `Realistic videos are up to ${REALISTIC_MAX_LENGTH} seconds.`}</p>
              : <p className="text-[11px] text-muted mt-1">{hi ? `45–60 sec Template और Presenter video में (Realistic max ${REALISTIC_MAX_LENGTH} sec)।` : `45–60s for Template and Presenter videos (Realistic max ${REALISTIC_MAX_LENGTH}s).`}</p>}
          </div>
          <div><p className="text-xs font-semibold text-muted mb-1">{hi ? "अंदाज़" : "Tone"}</p><div className="flex flex-wrap gap-2">{[["warm", hi ? "अपनापन" : "Warm"], ["premium", "Premium"], ["energetic", hi ? "जोश" : "Energetic"], ["trust", hi ? "भरोसा" : "Trust"], ["funny", hi ? "हल्का-फुल्का" : "Light & fun"]].map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, tone: k })} className={chip(f.tone === k)}>{l}</button>)}</div></div>
          <input className={inp} placeholder={hi ? "किसके लिए? (जैसे: 30-50 साल के परिवार, गुड़गाँव)" : "Audience (e.g. families 30-50, Gurgaon)"} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} />
          <textarea className={inp} rows={3} placeholder={hi ? "खूबियाँ — हर line में एक (optional)" : "Features — one per line (optional)"} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />
          <input className={inp} placeholder={hi ? "ऑफ़र (optional, जैसे: ₹5000 छूट + free installation)" : "Offer (optional)"} value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} />
          <input className={inp} type="tel" placeholder={hi ? "Call / WhatsApp नंबर (optional)" : "Call / WhatsApp number (optional)"} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <textarea className={inp} rows={2} placeholder={hi ? "कुछ और जो AI को पता होना चाहिए (optional)" : "Anything else the AI should know (optional)"} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={makePlan} disabled={planBusy || f.product.trim().length < 2} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50">{planBusy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} {hi ? "AI से script बनवाओ (free)" : "Let AI write the script (free)"}</button>
        </div>
      )}

      {step === 1 && plan && (
        <div className="space-y-3">
          {plan.questions && plan.questions.length > 0 && <div className="rounded-xl border border-brand bg-brand-soft p-3 text-sm"><b>{hi ? "AI पूछता है:" : "AI asks:"}</b><ul className="list-disc pl-5 mt-1">{plan.questions.map((q) => <li key={q}>{q}</li>)}</ul><p className="text-xs text-muted mt-1">{hi ? "जवाब Brief के 'कुछ और' box में लिखकर दोबारा plan बनवाएँ, या ऐसे ही आगे बढ़ें।" : "Answer in the Brief's notes box and re-plan, or continue as is."}</p></div>}
          {options.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">Pick a script — each one opens differently. You can edit the lines below.</p>
              {options.map((o, k) => { const on = chosen === o.script; return (
                <button key={k} type="button" onClick={() => { setChosen(o.script); setPlan({ headline: o.script.headline ?? "", scenes: o.script.scenes.map((x) => ({ text: x.text, caption_text: x.caption, visual: "", motion: "" })), cta: o.script.cta.text, caption: o.script.post_caption ?? "", features: o.script.features ?? [], template: o.script.template, music: o.script.music }); }} className={`w-full rounded-xl border-2 p-3 text-left ${on ? "border-brand bg-brand-soft/40" : "border-border"}`}>
                  <div className="flex items-center gap-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${o.verdict === "ready" ? "bg-good/10 text-good" : "bg-surface2 text-muted"}`}>{o.verdict === "ready" ? "✓ Ready" : `Option ${k + 1}`}</span><span className="font-semibold uppercase tracking-wide text-muted">{String(o.script.first_visual ?? "").replace("_", " ")} · {String(o.script.angle ?? "").replace("_", " ")}</span><span className="ml-auto text-muted">≈ {Math.round(o.gates.est.total_sec)} s</span></div>
                  {o.script.promise && <p className="mt-1 text-sm font-semibold">{o.script.promise}</p>}
                  <ol className="mt-1 space-y-0.5 text-xs">{o.script.scenes.map((x, i) => <li key={i}>{i + 1}. “{x.text}” <span className="text-muted">· {x.caption} · {o.gates.est.per_scene_sec[i]?.toFixed(1)} s</span></li>)}<li>CTA “{o.script.cta.text}”</li></ol>
                  {o.script.why && <p className="mt-1 text-[11px] text-muted"><b>Why this works:</b> {o.script.why}</p>}
                  {o.verdict !== "ready" && o.reason && <p className="mt-1 text-[11px] text-muted">💡 {hi ? "Tip" : "Tip"}: {o.reason}</p>}
                </button>); })}
            </div>
          )}
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "Headline" : "Headline"}</span><input className={inp} value={plan.headline} onChange={(e) => setPlan({ ...plan, headline: e.target.value })} /></label>
          {plan.scenes.map((s, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-brand-ink">Scene {i + 1}</p><span className="text-[10px] text-muted">{wordsOf(s.text)} {hi ? "शब्द" : "words"}</span></div>
              <textarea className={inp} rows={2} value={s.text} onChange={(e) => { const sc = [...plan.scenes]; sc[i] = { ...s, text: e.target.value }; setPlan({ ...plan, scenes: sc }); }} />
              <input className={inp} value={s.caption_text} placeholder={hi ? "screen पर दिखने वाला caption" : "on-screen caption"} onChange={(e) => { const sc = [...plan.scenes]; sc[i] = { ...s, caption_text: e.target.value }; setPlan({ ...plan, scenes: sc }); }} />
              <p className="text-[11px] text-muted">🎬 {s.visual}</p>
            </div>
          ))}
          <label className="block"><span className="text-xs font-semibold text-muted">{hi ? "अंत में (CTA)" : "Closing line (CTA)"}</span><input className={inp} value={plan.cta} onChange={(e) => setPlan({ ...plan, cta: e.target.value })} /></label>
          <div className={`rounded-lg p-2.5 text-xs flex items-start gap-2 ${overBy > 5 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-surface2 text-muted"}`}>
            {overBy > 5 && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>
              {hi ? `कुल ${scriptWords} शब्द (चुनी गई लंबाई ${f.length} sec के लिए ~${targetWords} शब्द ठीक हैं)।` : `${scriptWords} words total (about ${targetWords} words suits your ${f.length}s length).`}
              {overBy > 5 && (hi ? ` शब्द ज़्यादा हैं — video लगभग ${estSec} sec की लगेगी, ${f.length} sec की नहीं। छोटा करें या लंबाई बदलें (पीछे जाकर)।` : ` That's too many — the video will run ~${estSec}s, not ${f.length}s. Shorten it, or go back and pick a longer length.`)}
            </span>
          </div>
          {plan.caption && <p className="text-[11px] text-muted">{hi ? "Post caption:" : "Post caption:"} {plan.caption}</p>}
          <div className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">{hi ? "पहली line पसंद नहीं? अलग angle try करें" : "Don't like the opening line? Try a different angle"}</p>
              <button type="button" onClick={tryHooks} disabled={hookBusy} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold shrink-0">{hookBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "🎯"} {hi ? "3 hooks" : "3 hooks"}</button>
            </div>
            {hookOptions.length > 0 && (
              <div className="space-y-1.5">
                {hookOptions.map((h) => <button key={h} type="button" onClick={() => pickHook(h)} className="w-full text-left rounded-lg border border-border px-3 py-2 text-sm hover:border-brand">{h}</button>)}
              </div>
            )}
          </div>
          {/* Back and Next live in the one nav row at the bottom of every step — only "Re-plan" is special to this step. */}
          <button type="button" onClick={makePlan} disabled={planBusy} className="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold min-h-[44px]">{planBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {hi ? "दूसरा plan" : "Re-plan"}</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {f.tier === "testimonial" ? (
            <div className="rounded-xl border-2 border-brand bg-brand-soft p-3 text-sm font-semibold">💬 {hi ? "Testimonial video — ग्राहक की review से" : "Testimonial video — from your customer's review"}</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {/* One meaning of time only: how long you wait. The video's length was already chosen in step 1. */}
              {([["template", "Template", hi ? "तेज़" : "fast", hi ? "Photo + text · लगभग 2 मिनट में तैयार" : "Photo + text · ready in about 2 minutes"], ["realistic", "Realistic AI", hi ? "वही credits" : "same credits", hi ? "Film जैसे scenes · लगभग 8 मिनट में तैयार" : "Film-like scenes · ready in about 8 minutes"], ["presenter", "Presenter", hi ? "वही credits" : "same credits", hi ? "कोई camera पर बोलता है · लगभग 5 मिनट में तैयार" : "Someone talks to camera · ready in about 5 minutes"]] as const).map(([k, l, c, d]) => (
                <button key={k} type="button" disabled={k === "realistic" && realisticOff} onClick={() => setF({ ...f, tier: k, formats: f.formats.length ? f.formats : ["reel"], length: k === "realistic" && f.length > REALISTIC_MAX_LENGTH ? REALISTIC_MAX_LENGTH : f.length })} className={`rounded-xl border-2 p-2.5 text-left ${f.tier === k ? "border-brand bg-brand-soft" : "border-border"} disabled:opacity-40`}><span className="block text-xs font-semibold">{l}</span><span className="block text-[10px] text-brand-ink font-semibold">{c}</span><span className="block text-[10px] text-muted mt-1 leading-tight">{d}</span></button>
              ))}
            </div>
          )}
          {realisticOff && f.tier !== "testimonial" && <p className="text-[11px] text-lead">{REALISTIC_OFF_LINE}</p>}
          {f.tier === "presenter" && (
            <div className="rounded-xl border border-brand/40 bg-brand-soft/40 p-3 space-y-2">
              <p className="text-sm font-semibold">{hi ? "कौन बोलेगा?" : "Who will present?"}</p>
              <ActorGrid selected={f.presenterPhoto} onPick={(a) => setF({ ...f, presenterPhoto: a.url, voiceStyle: a.voice })} />
              <p className="text-sm font-semibold pt-1">{hi ? "…या अपनी फ़ोटो (जो बोलेगा)" : "…or your own photo (who will talk)"}</p>
              <p className="text-xs text-muted">{hi ? "Straight-on फ़ोटो, अच्छी रोशनी, सिर्फ़ एक चेहरा — script इसी photo को \"बोलता हुआ\" बना देगा।" : "A front-facing photo, good light, one face only — the script will make this photo \"talk\"."}</p>
              <div className="flex items-center gap-2">
                {f.presenterPhoto && <span className="relative h-20 w-20 rounded-xl overflow-hidden border border-border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={f.presenterPhoto} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => setF({ ...f, presenterPhoto: "" })} className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-xs">×</button></span>}
                {!f.presenterPhoto && !presenterUploading && (
                  <>
                    <label className="h-20 w-20 rounded-xl bg-surface border border-dashed border-border grid place-items-center cursor-pointer gap-0.5">
                      <Camera className="h-5 w-5 text-muted" /><span className="text-[9px] text-muted">{hi ? "कैमरा" : "Camera"}</span>
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pickPresenter(e.target.files?.[0] ?? null)} />
                    </label>
                    <label className="h-20 w-20 rounded-xl bg-surface border border-dashed border-border grid place-items-center cursor-pointer gap-0.5">
                      <Images className="h-5 w-5 text-muted" /><span className="text-[9px] text-muted">Gallery</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPresenter(e.target.files?.[0] ?? null)} />
                    </label>
                  </>
                )}
                {presenterUploading && <span className="h-20 w-20 rounded-xl bg-surface border border-dashed border-border grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></span>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">{TPL.map((t) => (
            <button key={t.k} type="button" onClick={() => setF({ ...f, template: t.k })} className={`rounded-xl border-2 p-1 ${f.template === t.k ? "border-brand" : "border-transparent"}`}>
              <div className="aspect-[9/16] rounded-lg flex flex-col items-center justify-center gap-1 p-2" style={{ background: t.bg }}><div className="w-3/4 h-2 rounded" style={{ background: t.ac }} /><div className="w-1/2 h-2 rounded opacity-60" style={{ background: t.ac }} /><div className="w-10 h-10 rounded-full mt-2 bg-white/80" /><div className="w-2/3 h-5 rounded-full mt-2" style={{ background: t.ac }} /></div>
              <p className="text-xs font-semibold mt-1 capitalize">{t.k}</p>
            </button>))}</div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.voice} onChange={(e) => setF({ ...f, voice: e.target.checked })} /> {hi ? "Voice-over (AI आवाज़)" : "AI voice-over"}</label>
          {f.voice && (
            <div className="space-y-3">
              {([["male", hi ? "पुरुष आवाज़" : "Male voices", VOICE_OPTIONS.male], ["female", hi ? "महिला आवाज़" : "Female voices", VOICE_OPTIONS.female]] as const).map(([gk, gl, list]) => (
                <div key={gk}>
                  <p className="text-xs font-semibold text-muted mb-1.5">{gl}</p>
                  <div className="space-y-1.5">
                    {list.map((v) => (
                      <div key={v.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${f.voiceStyle === v.key ? "border-brand bg-brand-soft" : "border-border"}`}>
                        <button type="button" onClick={() => playSample(`/voices/${v.key}.mp3`, v.key)} className="h-8 w-8 rounded-full grad-brand text-white grid place-items-center shrink-0">{playing === v.key ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
                        <button type="button" onClick={() => setF({ ...f, voiceStyle: v.key })} className="flex-1 text-left min-w-0"><span className="block text-sm font-semibold">{v.label}</span><span className="block text-[11px] text-muted truncate">{v.note}</span></button>
                        {f.voiceStyle === v.key && <Check className="h-4 w-4 text-good shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs font-semibold text-muted">Music</p>
          <button type="button" onClick={() => setF({ ...f, music: "" })} className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm ${!f.music ? "border-brand bg-brand-soft" : "border-border"}`}>{hi ? "बिना music" : "No music"}</button>
          {tracks.map((t) => (
            <div key={t.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${f.music === t.key ? "border-brand bg-brand-soft" : "border-border"}`}>
              <button type="button" onClick={() => playSample(t.url, t.key)} className="h-8 w-8 rounded-full grad-brand text-white grid place-items-center">{playing === t.key ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
              <button type="button" onClick={() => setF({ ...f, music: t.key })} className="flex-1 text-left text-sm font-medium">{t.name}</button>
              {f.music === t.key && <Check className="h-4 w-4 text-good" />}
            </div>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3 space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.captions === "words"} onChange={(e) => setF({ ...f, captions: e.target.checked ? "words" : "off" })} /> <span><b>{hi ? "Word-by-word captions" : "Word-by-word captions"}</b> <span className="text-muted">— {hi ? "बोले हुए शब्द highlight होते हुए (reels में 2× engagement)" : "spoken words highlighted as they play (2× engagement on reels)"}</span></span></label>
            {/* Realistic renders one video whatever is asked for (ad/route.ts forces options.videos = 1), so it is not offered a choice it cannot keep. */}
            {f.tier === "template" && (
              <div className="flex items-center gap-2">
                <span className="text-muted">{hi ? "कितनी videos?" : "How many?"}</span>
                {([[1, hi ? "1 video" : "1 video", ""], [3, hi ? "3 variations" : "3 variations", "+50%"]] as const).map(([n, l, c]) => <button key={n} type="button" onClick={() => setF({ ...f, variants: n })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${f.variants === n ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>{l}{c ? <span className="ml-1 text-[10px] text-lead">{c}</span> : null}</button>)}
                <span className="text-[11px] text-faint">{hi ? "अलग hook, look और music — test करके देखो कौन सी चलती है" : "different hook, look and music — test which converts"}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">{hi ? "साइज़ / ratio" : "Size / aspect ratio"}</p>
            <p className="text-xs text-muted mb-2">
              {hi ? "एक साथ कई ratio चुनें — Reel, Square, Wide — बिना extra credits।" : "Pick as many ratios as you need — Reel, Square, Wide — no extra credits."}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {FMT.map((x) => {
                const on = f.formats.includes(x.k);
                function toggle() {
                  setF({ ...f, formats: on ? f.formats.filter((k) => k !== x.k) : [...f.formats, x.k] });
                }
                return (
                  <button key={x.k} type="button" onClick={toggle} className={`rounded-xl border-2 p-2 flex flex-col items-center gap-1.5 ${on ? "border-brand bg-brand-soft" : "border-border"}`}>
                    <span className="grid place-items-center" style={{ width: 44, height: 44 }}>
                      <span className="rounded bg-brand/70 block" style={{ width: x.w >= x.h ? 40 : Math.round(40 * (x.w / x.h)), height: x.h >= x.w ? 40 : Math.round(40 * (x.h / x.w)) }} />
                    </span>
                    <span className="text-[11px] font-bold">{x.ratio}</span>
                    <span className="text-[10px] text-muted text-center leading-tight">{x.l}</span>
                    {on && <Check className="h-3 w-3 text-good" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl bg-surface2 p-3 text-sm space-y-1"><p><b>{f.product}</b> · {plan?.headline}</p><p className="text-muted">{f.lang} · {f.length}s · {f.tier} · {f.template} · {f.music || (hi ? "बिना music" : "no music")} · {f.formats.map((k) => FMT.find((x) => x.k === k)?.ratio).join(", ")}</p><p className="text-brand-ink font-semibold">{hi ? "खर्च" : "Cost"}: {total} credits ({f.length} sec{f.variants === 3 ? ", 3 variations" : ""}{f.formats.length > 1 ? `, ${f.formats.length} ratios` : ""})</p></div>
          {credits !== null && credits < total && <AddCredits need={total} have={credits} onDone={refresh} />}
          {f.tier === "presenter" && !f.presenterPhoto && <p className="text-sm text-danger">{hi ? "पीछे जाकर presenter की photo लगाएँ।" : "Go back and add the presenter's photo."}</p>}
          {f.tier === "realistic" && (() => { const p = products.find((x) => x.id === productId); return (
            <div className="rounded-xl border border-brand/40 bg-brand-soft/30 p-3 text-sm space-y-1.5">
              {storyboardFree && <><p className="font-semibold">Storyboard first — free</p><p className="text-xs text-muted">We draw every scene, check it against your Product check, and show it to you. Credits are charged only when you tap Animate.</p></>}
              {realisticOff && <p className="text-xs font-semibold text-danger">{REALISTIC_OFF_LINE}</p>}
              {!storyboardFree && !realisticOff && <p className="text-xs text-muted">{hi ? `Video बनाते ही ${total} credits कट जाएँगे।` : `Your ${total} credits are charged as soon as the video starts.`}</p>}
              {!p ? <p className="text-xs text-danger">Choose one of your products in step 1 (or add it under Products) to use Realistic AI.</p>
                : !p.facts_confirmed_at ? <button type="button" onClick={() => setChecking(true)} className="rounded-lg border border-lead/60 bg-lead/10 px-3 py-1.5 text-xs font-semibold text-lead">Answer 3 quick questions about “{p.name}” first →</button>
                : <p className="text-xs text-good">✓ Product check confirmed for “{p.name}” · <button type="button" onClick={() => setChecking(true)} className="underline">view / edit</button></p>}
            </div>); })()}
          {err && <p className="text-sm text-danger">{err}</p>}
          {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); refresh(); }} />}
          <button type="button" onClick={generate} disabled={busy || submitted || !f.formats.length || !plan || (f.tier === "realistic" && realisticOff) || (f.tier === "presenter" && !f.presenterPhoto) || (credits !== null && credits < total && !(storyboardFree && f.tier === "realistic" && !!productId))} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} {storyboardFree && f.tier === "realistic" && productId ? "Make my storyboard (free)" : submitted ? (hi ? "बन चुकी है" : "Already made") : hi ? `Video बनाओ · ${total} credits` : `Make my video · ${total} credits`}</button>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          {jobs.length === 0 && <p className="text-sm text-muted">{hi ? "अभी कोई video नहीं।" : "No videos yet."}</p>}
          {jobs.map((j, jobIdx) => (
            <div key={j.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2 text-sm"><b className="truncate">{j.input?.product ?? "Ad"} {j.input?.tier === "realistic" ? "· 🎬" : j.input?.tier === "presenter" ? "· 🗣️" : j.input?.tier === "testimonial" ? "· 💬" : ""}</b><span className={`text-xs text-right shrink-0 max-w-[55%] ${j.status === "done" ? "text-good" : j.status === "failed" ? "text-danger" : "text-brand-ink"}`}>{j.status === "done" ? "✓ ready" : j.status === "failed" ? (hi ? "नहीं बनी" : "not made") : j.status === "review" ? "storyboard ready" : (j.progress?.text || (hi ? "आपकी video बन रही है…" : "Making your video…"))}</span></div>
              {(j.status === "review" || ((j as Job & { pipeline?: number }).pipeline === 2 && (j.status === "queued" || j.status === "running"))) && <button type="button" onClick={() => setBoard({ id: j.id, cost: adCredits(Number((j.input as { brief?: { length?: number } })?.brief?.length) || 10) })} className="rounded-lg border border-brand bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink">{j.status === "review" ? "Open storyboard — waiting for you" : "Open"}</button>}
              {j.status === "done" && (j as Job & { pipeline?: number }).pipeline === 2 && <button type="button" onClick={() => setBoard({ id: j.id, cost: adCredits(Number((j.input as { brief?: { length?: number } })?.brief?.length) || 10) })} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Change music / redo a scene</button>}
              {j.status === "failed" && (
                <div className="space-y-1">
                  <p className="text-sm text-danger">{failLine(j.error, hi)}</p>
                  {j.error && <details className="text-[11px] text-faint"><summary>Details</summary><span className="break-words">{j.error}</span></details>}
                </div>
              )}
              {(j.status === "queued" || j.status === "running") && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted">{hi ? "इस screen को बंद कर सकते हैं — video 'आपकी videos' में आ जाएगी।" : "You can close this screen — the video will appear in Your videos."}</p>
                  <button type="button" onClick={() => stopJob(j)} disabled={stopping === j.id} className="w-full rounded-lg border border-danger/60 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{stopping === j.id ? (hi ? "रोक रहे हैं…" : "Stopping…") : (hi ? "यह video रोकें" : "Stop this video")}</button>
                </div>
              )}
              {rowMsg[j.id] && <p className="text-xs font-semibold">{rowMsg[j.id]}</p>}
              {j.status === "done" && j.input?.outputs && (
                <div className="space-y-2">
                  <video src={j.input.outputs.reel ?? j.output_url ?? ""} controls playsInline preload={jobIdx === 0 ? "auto" : "metadata"} className="w-full rounded-lg bg-black max-h-80" />
                  {Object.entries(j.input.outputs).map(([k, u]) => (
                    <div key={k} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{FMT.find((x) => x.k === k.split("-v")[0])?.l ?? k}{k.includes("-v") ? ` · variation ${k.split("-v")[1]}` : ""}</span>
                        <button type="button" onClick={() => share(u, `shubhora-${k}.mp4`)} disabled={busyAction === u} className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busyAction === u ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} {hi ? "Share" : "Share"}</button>
                        <button type="button" onClick={() => download(u, `shubhora-${k}.mp4`)} disabled={busyAction === u + "dl"} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60">{busyAction === u + "dl" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</button>
                      </div>
                      {fileMsg[u] && <p className="text-[11px] text-good">{fileMsg[u]}</p>}
                    </div>
                  ))}
                  <button type="button" onClick={() => editJob(j)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" /> {hi ? "बदलकर दोबारा बनाओ (credits फिर लगेंगे)" : "Edit & regenerate (credits apply again)"}</button>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={startFresh} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold">{hi ? "नई video बनाएँ" : "Make another"}</button>
        </div>
      )}

      {/* Every step has a Back and a Next — step 0's Back leaves the screen, and Next needs a script first. */}
      {step <= 3 && !submitted && (
        <div className="flex gap-2">
          <button type="button" onClick={() => (step === 0 ? router.push("/poster/videos") : setStep(step - 1))} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold min-h-[44px]"><ChevronLeft className="h-4 w-4" /> {hi ? "पीछे" : "Back"}</button>
          <button type="button" disabled={step === 0 && !plan} onClick={() => setStep(step + 1)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white min-h-[44px] disabled:opacity-40">{hi ? "आगे" : "Next"} <ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
      {step === 4 && !submitted && <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold min-h-[44px]"><ChevronLeft className="h-4 w-4" /> {hi ? "पीछे" : "Back"}</button>}
      {step !== 5 && jobs.length > 0 && <button type="button" onClick={() => setStep(5)} className="text-sm text-brand-ink">{hi ? "मेरी videos देखें →" : "See my videos →"}</button>}
    </div>
  );
}

/* ---- stock AI presenters (public/studio/actors/actors.json, made by bridge/make-actors.mjs) ---- */
type Actor = { key: string; name: string; gender: string; voice: string; url: string; thumb: string };
function ActorGrid({ selected, onPick }: { selected: string; onPick: (a: Actor & { url: string }) => void }) {
  const [actors, setActors] = useState<Actor[] | null>(null);
  useEffect(() => { fetch("/studio/actors/actors.json", { cache: "force-cache" }).then((r) => (r.ok ? r.json() : [])).then(setActors).catch(() => setActors([])); }, []);
  if (!actors) return null;
  if (!actors.length) return <p className="text-xs text-faint">AI presenters are being prepared — use your own photo below.</p>;
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {actors.map((a) => { const full = `${origin}${a.url}`; const on = selected === full; return (
        <button key={a.key} type="button" onClick={() => onPick({ ...a, url: full })} className={`w-[72px] shrink-0 text-center ${on ? "" : "opacity-90"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.thumb} alt={a.name} className={`h-[96px] w-[72px] rounded-xl object-cover border-2 ${on ? "border-brand" : "border-transparent"}`} loading="lazy" />
          <span className="block truncate text-[11px] mt-0.5">{a.name}</span>
        </button>); })}
    </div>
  );
}

export default function VideoTab() {
  return <AiPageGate title="Video ad" reason="Turn your product into a ready video ad with AI voice and music."><VideoTabInner /></AiPageGate>;
}
