"use client";
// Reel — ONE page, four steps (owner, 27 Oct 2026: "profactional flow"): चुनो → देखो → बन रही है → तैयार.
//   1. Choose: kind, product, a note, language.
//   2. See the words BEFORE anything is made: every line can be tapped and changed, or rewritten; "और बदलें" holds
//      length, voice, music, own photos and each scene's picture. No second "Advanced" page and nothing asked twice.
//   3. Making: the worker's stages (voice → clips → join → ready); the screen may be closed.
//   4. Ready: the reel big, with WhatsApp / Download / Boost / caption copy / make another.
// "मेरी reels" is its own tab. ?edit=<jobId> opens a made reel's words at step 2 (Change & make again).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Download, Share2, Clapperboard, Trash2, Check, Copy, ChevronDown, Pencil, RotateCw, ImagePlus, Plus, ArrowRight, Play, Pause } from "lucide-react";
import { api, isLoggedIn, shareFile, downloadPoster, uploadImage, LANGS } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { AddCredits } from "@/components/poster/add-credits";
import { goBack } from "@/lib/nav-back";
import { useT } from "@/lib/poster-i18n";
import { REEL_KINDS as KINDS, type ReelKind } from "@/lib/reel-kinds";
import { ReelMaking } from "@/components/poster/reel-making";

type Scene = { text: string; caption_text: string; search: string; image: string; search_alt?: string; text_en?: string; ai_prompt?: string; source?: "auto" | "stock" | "ai" | "image" };
type Plan = { title: string; scenes: Scene[]; cta: string; caption: string };
type Job = { id: string; status: string; stage?: string | null; output_url: string | null; error: string | null; created_at: string; cost?: number; progress?: { text?: string } | null; input?: { tier?: string; product?: string; caption?: string; duration_sec?: number; topic?: string; scenes?: Scene[]; cta?: string; lang?: string; length?: number; voiceStyle?: string; music?: string } };
type MyProduct = { id: string; name: string; brand?: string | null; category?: string; photo_url?: string | null; photos?: { url: string; role?: string }[] };
type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
// A dropped mobile connection makes fetch() reject; without the catch the button would spin for ever.
const post = (body: unknown): Promise<Reply> =>
  fetch("/api/media/reel-maker", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }))
    .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));

const MAIN_LANGS = ["hi", "hinglish", "en"];
const MUSIC = ["", "calm-ambient", "upbeat-corporate", "inspiring-motivational", "energetic-promo", "indian-sitar", "festive-diwali"];
const MUSIC_NAMES: Record<string, [string, string]> = { "": ["कोई नहीं", "None"], "calm-ambient": ["शांत", "Calm"], "upbeat-corporate": ["खुशनुमा", "Lively"], "inspiring-motivational": ["जोश भरा", "Inspiring"], "energetic-promo": ["तेज़", "Energetic"], "indian-sitar": ["सितार", "Sitar"], "festive-diwali": ["त्योहार", "Festive"] };
// Every voice has a short sample at /voices/<key>.mp3 (public/voices); the first four are shown, the rest on "और".
const VOICES: [string, string, string][] = [["warmf", "महिला · मीठी", "Woman · warm"], ["youthful", "महिला · युवा", "Woman · young"], ["warm", "पुरुष · मीठी", "Man · warm"], ["clear", "पुरुष · साफ़", "Man · clear"],
  ["calm", "महिला · शांत", "Woman · calm"], ["soft", "महिला · कोमल", "Woman · soft"], ["lively", "महिला · जोशीली", "Woman · lively"], ["mature", "महिला · अनुभवी", "Woman · mature"], ["gentle", "महिला · धीमी", "Woman · gentle"],
  ["deep", "पुरुष · भारी", "Man · deep"], ["friendly", "पुरुष · दोस्ताना", "Man · friendly"], ["smooth", "पुरुष · मुलायम", "Man · smooth"], ["expert", "पुरुष · जानकार", "Man · expert"]];
// The stages bridge/stock-reel.mjs reports: queued → voice → clips → assemble → done.
const STEPS = [{ k: "voice", hi: "आवाज़", en: "Voice" }, { k: "clips", hi: "Clips", en: "Clips" }, { k: "assemble", hi: "जोड़ना", en: "Join" }, { k: "done", hi: "तैयार", en: "Ready" }];
const MONEY_BACK = "Your credits have been returned.";
function failLine(raw: string | null | undefined, hi: boolean): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return hi ? "आपने ये reel रोक दी। बचे credits वापस आ गए।" : "You stopped this reel. Any credits we did not use have been returned.";
  if (/tts|voice|speech|audio/.test(e)) return hi ? "आवाज़ record नहीं हो पाई। Credits वापस आ गए।" : `The voice could not be recorded. ${MONEY_BACK}`;
  if (/upload/.test(e)) return hi ? "Reel बन गई थी, पर save नहीं हो पाई। “बदलकर फिर बनाओ” से उन्हीं शब्दों से फिर बनाइए।" : "The reel was made but could not be saved. Use “Change & make again” to make it with the same words.";
  if (/clip|stock|image|photo|veo|kling|fal|pexels/.test(e)) return hi ? "एक scene की picture नहीं मिली। Credits वापस आ गए।" : `We could not get a picture for one scene. ${MONEY_BACK}`;
  return hi ? "Reel बन नहीं पाई। Credits वापस आ गए।" : `The reel could not be finished. ${MONEY_BACK}`;
}
const busyJob = (j: Job) => j.status === "queued" || j.status === "running";

export default function Reel() {
  const router = useRouter();
  const { lang: ui } = useT(); const hi = ui !== "en";
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"make" | "mine">("make");
  const [stage, setStage] = useState<"choose" | "review" | "track">("choose");
  // step 1
  const [kind, setKind] = useState<ReelKind>("tip");
  const [business, setBusiness] = useState(""); const [category, setCategory] = useState(""); const [phone, setPhone] = useState(""); const [brandName, setBrandName] = useState("");
  // Who the reel says it is from (owner, 27 Oct 2026: "company Licure Technology, but I promote the brand AlkaFresh").
  const [firm, setFirm] = useState(""); const [logoUrl, setLogoUrl] = useState(""); const [useLogo, setUseLogo] = useState(true); const [ownName, setOwnName] = useState(false);
  const [productId, setProductId] = useState(""); const [products, setProducts] = useState<MyProduct[]>([]);
  const [note, setNote] = useState("");
  const [lang, setLang] = useState("hi"); const [moreLangs, setMoreLangs] = useState(false);
  // step 2
  const [plan, setPlan] = useState<Plan | null>(null);
  const [length, setLength] = useState(15); const [voiceStyle, setVoiceStyle] = useState("warmf"); const [music, setMusic] = useState("calm-ambient");
  const [gallery, setGallery] = useState<string[]>([]); const [more, setMore] = useState(false);
  // Hear before choosing (owner, 27 Oct 2026): one player for voice samples and music; tapping a chip picks it and plays it.
  const audio = useRef<HTMLAudioElement | null>(null); const [playing, setPlaying] = useState(""); const [allVoices, setAllVoices] = useState(false);
  const [subs, setSubs] = useState(true); /* the moving words (subtitles) under the picture */ const [editing, setEditing] = useState(false);
  // step 3 / 4
  const [trackId, setTrackId] = useState("");
  // shared
  const [busy, setBusy] = useState<"" | "plan" | "create" | "img">("");
  const [err, setErr] = useState(""); const [needCredits, setNeedCredits] = useState<number | null>(null); const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [left, setLeft] = useState<number | null>(null); const [daily, setDaily] = useState(3);
  const [acting, setActing] = useState(""); const [rowMsg, setRowMsg] = useState<Record<string, { t: string; ok: boolean }>>({});
  const [copied, setCopied] = useState("");
  const topRef = useRef<HTMLDivElement | null>(null);

  async function refresh() { const r = await fetch("/api/media/jobs?kind=ad", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.input?.tier === "stock")); if (typeof r.credits === "number") setCredits(r.credits); }
  async function quota() { const q = await post({ action: "quota" }); if (q.ok && typeof q.data.left_today === "number") { setLeft(q.data.left_today); setDaily(Number(q.data.daily) || 3); } }
  const toTop = () => setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/reel"); return; }
    const q = new URLSearchParams(window.location.search);
    const [, pr, pp] = await Promise.all([
      refresh(),
      api<{ products?: MyProduct[] }>("/api/poster/products").catch(() => null),
      api<{ profiles?: { name: string; tagline?: string; phone?: string; is_default?: boolean; category?: string; logo_url?: string | null }[] }>("/api/poster/profiles").catch(() => null),
    ]);
    setProducts(pr?.data.products ?? []);
    // The business name, phone and trade come from the profile — nothing to type on a normal day.
    const p = (pp?.data.profiles ?? []).find((x) => x.is_default) ?? pp?.data.profiles?.[0];
    if (p) { setBusiness(p.name); setFirm(p.name); setPhone(p.phone || ""); setCategory(p.category || ""); setLogoUrl(p.logo_url || ""); }
    // The last name / logo choice comes back; else the products' brand (the name customers know), else the firm.
    let saved: { name?: string; logo?: string; useLogo?: boolean } = {};
    try { saved = JSON.parse(localStorage.getItem("reel.identity") || "{}"); } catch { /* private window */ }
    const firstBrand = (pr?.data.products ?? []).map((x) => (x.brand ?? "").trim()).find(Boolean);
    setBrandName(saved.name || firstBrand || p?.name || "");
    if (saved.logo) setLogoUrl(saved.logo);
    if (typeof saved.useLogo === "boolean") setUseLogo(saved.useLogo);
    quota();
    // Change & make again: a made reel's words, straight at step 2.
    const editId = q.get("edit");
    if (editId) {
      const r = await fetch(`/api/media/jobs?id=${encodeURIComponent(editId)}`, { cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
      const inp = (r.job as Job | undefined)?.input;
      if (inp?.scenes?.length) {
        const scenes = inp.scenes.map((x) => ({ ...x, source: x.source ?? (x.image ? "image" : "auto") })) as Scene[];
        setPlan({ title: inp.product || "Reel", scenes, cta: inp.cta ?? "", caption: inp.caption ?? "" });
        if (inp.lang) setLang(inp.lang);
        if (inp.length) setLength(Number(inp.length));
        if (inp.voiceStyle) setVoiceStyle(inp.voiceStyle);
        if (inp.music !== undefined) setMusic(inp.music);
        if (inp.product) setBusiness(inp.product);
        setGallery([...new Set(scenes.map((s) => s.image).filter(Boolean))].slice(0, 8));
        setEditing(true); setStage("review");
      }
    }
    if (q.get("tab") === "mine") setTab("mine");
    setReady(true);
  })(); }, [router]);
  useEffect(() => { if (!jobs.some(busyJob)) return; const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [jobs]);

  const product = products.find((p) => p.id === productId);
  const making = jobs.some(busyJob);
  const over = left === 0;
  const remember = (x: { name?: string; logo?: string; useLogo?: boolean }) => { try { const o = JSON.parse(localStorage.getItem("reel.identity") || "{}"); localStorage.setItem("reel.identity", JSON.stringify({ ...o, ...x })); } catch { /* ignore */ } };
  const pickName = (n: string) => { setBrandName(n); remember({ name: n }); };
  async function addLogo(file: File | null) {
    if (!file) return; setBusy("img"); setErr("");
    try { const u = await uploadImage(await compressToFile(file, "logo.png", 800, 1, "png"), "logo"); if (u) { setLogoUrl(u); setUseLogo(true); remember({ logo: u, useLogo: true }); } else setErr(hi ? "Logo नहीं जुड़ा। फिर try करें।" : "Could not add the logo."); }
    catch { setErr(hi ? "Logo नहीं जुड़ा। फिर try करें।" : "Could not add the logo."); }
    finally { setBusy(""); }
  }
  const names = [...new Set([product?.brand ?? "", ...products.map((x) => x.brand ?? ""), firm, brandName].map((x) => x.trim()).filter(Boolean))].slice(0, 5);
  const form = (len = length) => ({ type: kind, logoUrl: useLogo ? logoUrl : "", business: product?.name || brandName || business, category: product?.category || category, topic: kind === "offer" ? "" : note, offer: kind === "offer" ? note : "", phone, brandName, lang, length: len, voiceStyle, music, captions: subs ? "words" : "off", product_id: productId });

  /** Step 1 → 2: the AI writes the words; nothing is made yet. */
  async function writeWords(len = length) {
    if ((product?.name || business).trim().length < 2) { setErr(hi ? "पहले अपने business का नाम लिखें।" : "Write your business name first."); return; }
    setErr(""); setNeedCredits(null); setBusy("plan");
    try {
      const r = await post({ action: "plan", ...form(len) });
      if (r.data.code === "daily_limit") { setLeft(0); return; }
      if (!r.ok) { setErr(r.status === 0 ? (hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.") : (hi ? "शब्द नहीं लिखे जा सके। फिर try करें।" : "Could not write the words. Please try again.")); return; }
      setPlan(r.data.plan as Plan); setEditing(false);
      if (stage !== "review") {
        setMusic(KINDS.find((x) => x.k === kind)!.music);
        // The product's own photos are ready to drop into a scene.
        setGallery(product ? [...new Set([...(product.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url), ...(product.photo_url ? [product.photo_url] : [])])].slice(0, 8) : []);
        setStage("review"); toTop();
      }
    } finally { setBusy(""); }
  }
  /** Step 2 → 3: the reel is queued. */
  async function make() {
    if (!plan) return;
    setErr(""); setNeedCredits(null); setBusy("create");
    try {
      const r = await post({ action: "create", ...form(), title: plan.title, scenes: plan.scenes, cta: plan.cta, caption: plan.caption });
      if (r.data.code === "daily_limit") { setLeft(0); return; }
      if (!r.ok) {
        setErr(r.status === 429 ? (hi ? "एक video पहले से बन रही है — उसके पूरा होने तक रुकिए।" : "A video is already being made — please wait for it to finish.")
          : r.status === 402 ? (hi ? "AI pictures के लिए credits कम हैं — credits जोड़ें, या scene को Clip पर करें।" : "Not enough credits for the AI pictures — add credits, or switch the scene to a clip.")
          : r.status === 0 ? (hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.") : (hi ? "शुरू नहीं हो पाई। फिर try करें।" : "Could not start. Please try again."));
        if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || 1));
        return;
      }
      if (typeof r.data.left_today === "number") setLeft(r.data.left_today);
      setTrackId(String(r.data.jobId ?? "")); setStage("track"); await refresh(); toTop();
    } finally { setBusy(""); }
  }
  function again() { setStage("choose"); setPlan(null); setTrackId(""); setNote(""); setErr(""); setEditing(false); setMore(false); toTop(); }
  function relength(n: number) { if (n === length || busy) return; setLength(n); writeWords(n); }
  const setScene = (i: number, p: Partial<Scene>) => plan && setPlan({ ...plan, scenes: plan.scenes.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  async function addImage(file: File | null) {
    if (!file) return; setBusy("img"); setErr("");
    try { const u = await uploadImage(await compressToFile(file, "reel.jpg"), "product"); if (u) setGallery((g) => [u, ...g].slice(0, 8)); else setErr(hi ? "Photo नहीं जुड़ी। फिर try करें।" : "Could not add the photo."); }
    catch { setErr(hi ? "Photo नहीं जुड़ी। फिर try करें।" : "Could not add the photo."); }
    finally { setBusy(""); }
  }
  async function stopOrDelete(j: Job) {
    const stop = busyJob(j);
    if (!window.confirm(stop ? (hi ? "ये reel रोक दें?" : "Stop this reel?") : (hi ? "ये reel delete कर दें? वापस नहीं आएगी।" : "Delete this reel? This cannot be undone."))) return;
    setActing(j.id + "x");
    try { const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" }); if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: { t: hi ? "नहीं हो पाया। फिर try करें।" : "Could not do that. Please try again.", ok: false } })); return; } if (stop) { refresh(); if (j.id === trackId) setStage("review"); } else setJobs((l) => l.filter((x) => x.id !== j.id)); }
    finally { setActing(""); }
  }
  async function share(j: Job) { setActing(j.id); const s = await shareFile(j.output_url!, j.input?.caption ?? "", `reel-${j.id.slice(0, 8)}.mp4`, "video/mp4"); setRowMsg((m) => ({ ...m, [j.id]: s === "failed" ? { t: hi ? "Share नहीं हुआ — Download करें।" : "Not shared — try Download.", ok: false } : { t: s === "shared" ? (hi ? "भेज दिया" : "Sent") : (hi ? "Phone में save हो गई" : "Saved to your phone"), ok: true } })); setActing(""); }
  async function download(j: Job) { setActing(j.id + "d"); const ok = await downloadPoster(j.output_url!, `reel-${j.id.slice(0, 8)}.mp4`); setRowMsg((m) => ({ ...m, [j.id]: ok ? { t: hi ? "Phone में save हो गई" : "Saved to your phone", ok: true } : { t: hi ? "Save नहीं हुई — फिर try करें" : "Could not save — try again", ok: false } })); setActing(""); }
  async function copyCaption(j: Job) { try { await navigator.clipboard.writeText(j.input?.caption ?? ""); setCopied(j.id); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ } }

  function hear(key: string, url: string) {
    if (!audio.current) { audio.current = new Audio(); audio.current.onended = () => setPlaying(""); }
    if (playing === key) { audio.current.pause(); setPlaying(""); return; }
    audio.current.src = url; audio.current.currentTime = 0;
    audio.current.play().then(() => setPlaying(key)).catch(() => setPlaying(""));
  }
  useEffect(() => () => { audio.current?.pause(); }, []);
  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-xl border border-border bg-surface px-3 py-3 text-[15px] outline-none focus:border-brand";
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3.5 py-2 text-sm ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const small = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const label = "mb-2 flex items-center gap-2 text-sm font-semibold";
  const num = (n: number) => <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{n}</span>;
  const langs = LANGS.filter((l) => moreLangs || MAIN_LANGS.includes(l.key) || l.key === lang);
  const k = KINDS.find((x) => x.k === kind)!;
  const langName = LANGS.find((l) => l.key === lang)?.label ?? lang;
  const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
  const nAi = plan ? plan.scenes.filter((x) => !x.image && x.source === "ai").length : 0;
  const nAuto = plan ? plan.scenes.filter((x) => !x.image && (x.source ?? "auto") === "auto").length : 0;
  const tracked = jobs.find((j) => j.id === trackId);
  const flow = stage === "choose" ? 0 : stage === "review" ? 1 : tracked?.status === "done" ? 3 : 2;
  const FLOW = hi ? ["चुनो", "देखो", "बन रही", "तैयार"] : ["Choose", "Check", "Making", "Ready"];

  const errBox = err ? <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p> : null;
  const overBox = over ? <div className="rounded-xl border border-amber/40 bg-amber-soft p-3 text-sm">
    <p className="font-semibold">{hi ? `आज की ${daily} free reels बन गईं` : `You have made today's ${daily} free reels`}</p>
    <p className="mt-0.5 text-xs text-muted">{hi ? "कल सुबह फिर मिलेंगी। अभी चाहिए तो Product video बनाएँ (credits से)।" : "More tomorrow morning. Need one now? Make a Product video (uses credits)."}</p>
    <Link href="/poster/video" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{hi ? "Product video बनाएँ →" : "Make a Product video →"}</Link>
  </div> : null;

  /** A made / making reel — step 3-4 (big) and the "मेरी reels" list. A plain function, not a component, so the
   *  playing video is not re-mounted on every poll. */
  const reelCard = (j: Job, big = false) => (
    <div key={j.id} className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm">{j.input?.product ?? "Reel"}</b><span className="text-[11px] text-muted">{when(j.created_at)}{j.input?.duration_sec ? ` · ${Math.round(j.input.duration_sec)} ${hi ? "सेकंड" : "s"}` : ""}</span></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${j.status === "done" ? "bg-good/10 text-good" : j.status === "failed" ? "bg-danger/10 text-danger" : "bg-brand-soft text-brand-ink"}`}>{j.status === "done" ? (hi ? "✓ तैयार" : "✓ ready") : j.status === "failed" ? (hi ? "नहीं बनी" : "not made") : (hi ? "बन रही है" : "Making")}</span></div>
      {busyJob(j) && (<>
        {big ? <ReelMaking stage={j.status === "running" ? j.stage : "queued"} startedAt={j.created_at} scenes={j.input?.scenes ?? []} title={j.input?.product ?? "Reel"} hi={hi} /> : <>
        <div className="grid grid-cols-4 gap-1.5">{STEPS.map((st, n) => { const at = Math.max(0, STEPS.findIndex((x) => x.k === j.stage)); const on = j.status === "running" && n <= at; return <div key={st.k} className="space-y-1"><div className={`h-1.5 rounded-full ${on ? (n === at ? "animate-pulse bg-brand" : "bg-brand") : "bg-surface2"}`} /><p className={`text-center text-[10px] ${on ? "font-semibold text-brand-ink" : "text-muted"}`}>{hi ? st.hi : st.en}</p></div>; })}</div>
        {!!j.input?.scenes?.length && <p className="rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.scenes.map((s) => s.text).join(" ")}</p>}
        <p className="text-xs text-muted">{hi ? "लगभग 2 मिनट। Screen बंद कर सकते हैं — reel “मेरी reels” में आ जाएगी।" : "About 2 minutes. You can close this screen — the reel will be in “My reels”."}</p>
        </>}
        <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="w-full rounded-lg border border-danger/60 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{hi ? "रोक दें" : "Stop"}</button>
      </>)}
      {j.status === "failed" && <p className="text-sm text-danger">{failLine(j.error, hi)}</p>}
      {j.status === "done" && j.output_url && (<>
        <video src={j.output_url} controls playsInline preload={big ? "auto" : "metadata"} className={`mx-auto aspect-[9/16] rounded-xl bg-black ${big ? "max-h-[70dvh]" : "max-h-[55dvh]"}`} />
        <div className="flex gap-2">
          <button type="button" onClick={() => share(j)} disabled={acting === j.id} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-3 text-sm font-bold text-white"><Share2 className="h-4 w-4" /> WhatsApp / Share</button>
          <button type="button" onClick={() => download(j)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button>
        </div>
        {/* Make → run (owner, 27 Oct 2026): this video straight into Ads Boost, already chosen. */}
        <Link href={`/poster/ads?job=${j.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-ai/30 bg-ai-soft/40 px-3 py-2.5 text-sm font-semibold text-ai">🚀 {hi ? "Boost करें — Facebook / Instagram पर ज़्यादा लोगों तक" : "Boost — show it to more people on Facebook / Instagram"}</Link>
        {j.input?.caption && <div className="rounded-lg bg-surface2 p-2">
          <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold text-muted">{hi ? "Post के साथ लिखने के लिए" : "Caption for your post"}</span><button type="button" onClick={() => copyCaption(j)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-ink">{copied === j.id ? <><Check className="h-3 w-3" /> {hi ? "Copy हो गया" : "Copied"}</> : <><Copy className="h-3 w-3" /> Copy</>}</button></div>
          <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted">{j.input.caption}</p>
        </div>}
      </>)}
      {rowMsg[j.id] && <p className={`text-xs font-semibold ${rowMsg[j.id].ok ? "text-good" : "text-danger"}`}>{rowMsg[j.id].t}</p>}
      {!busyJob(j) && !big && <div className="flex items-center justify-between">
        {!!j.input?.scenes?.length ? <a href={`/poster/reel?edit=${j.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Pencil className="h-3.5 w-3.5" /> {hi ? "बदलकर फिर बनाओ" : "Change & make again"}</a> : <span />}
        <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="inline-flex items-center gap-1 text-xs text-muted disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
      </div>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div ref={topRef} className="scroll-mt-20" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (tab === "make" && stage === "review" ? setStage("choose") : goBack(router, "/poster/videos"))} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> Reel</h1>
        {left !== null && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${over ? "bg-amber-soft text-amber" : "bg-good/10 text-good"}`}>{over ? (hi ? "आज की free reels खत्म" : "No free reels left today") : hi ? `आज ${left}/${daily} free` : `${left}/${daily} free today`}</span>}
      </div>

      {/* Two tabs: make one / the ones made. */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1 text-sm font-semibold">
        <button type="button" onClick={() => setTab("make")} className={`rounded-lg py-2 ${tab === "make" ? "bg-surface shadow-sm" : "text-muted"}`}>{hi ? "नई reel" : "New reel"}</button>
        <button type="button" onClick={() => setTab("mine")} className={`rounded-lg py-2 ${tab === "mine" ? "bg-surface shadow-sm" : "text-muted"}`}>{hi ? "मेरी reels" : "My reels"}{jobs.length ? ` (${jobs.length})` : ""}{making && <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-brand align-middle" />}</button>
      </div>

      {tab === "mine" && (jobs.length ? <div className="space-y-3">{jobs.map((j) => reelCard(j))}</div>
        : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">{hi ? "अभी कोई reel नहीं।" : "No reels yet."} <button type="button" onClick={() => setTab("make")} className="font-semibold text-brand-ink">{hi ? "पहली बनाएँ →" : "Make the first →"}</button></div>)}

      {tab === "make" && (<>
        {/* Where the owner is: चुनो → देखो → बन रही → तैयार */}
        <ol className="grid grid-cols-4 gap-1">{FLOW.map((l, i) => <li key={l} className="space-y-1"><div className={`h-1 rounded-full ${i <= flow ? "bg-brand" : "bg-surface2"}`} /><p className={`text-center text-[11px] ${i === flow ? "font-bold text-brand-ink" : i < flow ? "text-brand-ink" : "text-muted"}`}>{i < flow ? "✓ " : ""}{l}</p></li>)}</ol>

        {stage === "choose" && (
          <div className="space-y-5 rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">{hi ? "चुनिए, बाक़ी हम करेंगे — शब्द, video, आवाज़, music। बनाने से पहले शब्द आप देख लेंगे।" : "You choose, we do the rest — words, video, voice, music. You see the words before it is made."}</p>
            <div>
              <p className={label}>{num(1)} {hi ? "किस बारे में?" : "What is it about?"}</p>
              <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">{KINDS.map((x) => <button key={x.k} type="button" onClick={() => setKind(x.k)} className={`relative rounded-xl border-2 p-2.5 text-left transition ${kind === x.k ? "border-brand bg-brand-soft" : "border-border"}`}>{kind === x.k && <Check className="absolute right-2 top-2 h-4 w-4 text-brand" />}<span className="block text-xl">{x.e}</span><span className="mt-1 block text-sm font-semibold leading-tight">{hi ? x.hi : x.en}</span><span className="block text-[11px] text-muted">{hi ? x.dhi : x.den}</span></button>)}</div>
            </div>
            <div className="space-y-2">
              <p className={label}>{num(2)} {products.length > 0 ? (hi ? "किसके बारे में?" : "Which product?") : (hi ? "कुछ ख़ास?" : "Anything to add?")}</p>
              {products.length > 0 && <select value={productId} onChange={(e) => { setProductId(e.target.value); const b = products.find((x) => x.id === e.target.value)?.brand?.trim(); if (b) setBrandName(b); }} className={inp}><option value="">{hi ? "मेरा पूरा business" : "My business in general"}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
              {!business && !productId && <input className={inp} placeholder={hi ? "Business का नाम" : "Business name"} value={business} onChange={(e) => { setBusiness(e.target.value); setBrandName(e.target.value); setErr(""); }} />}
              <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "offer" ? (hi ? "Offer लिखें — जैसे: 20% छूट" : "Your offer — e.g. 20% off") : (hi ? "कुछ ख़ास कहना है? (ज़रूरी नहीं)" : "Anything to add? (optional)")} />
            </div>
            <div>
              <p className={label}>{num(3)} {hi ? "भाषा" : "Language"}</p>
              <div className="flex flex-wrap gap-1.5">{langs.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={chip(lang === l.key)}>{l.label}</button>)}{!moreLangs && <button type="button" onClick={() => setMoreLangs(true)} className="rounded-full border border-dashed border-border px-3.5 py-2 text-sm text-muted">{hi ? "और भाषाएँ…" : "more…"}</button>}</div>
            </div>
            <div>
              <p className={label}>{num(4)} {hi ? "Reel पर आपकी पहचान" : "Your name on the reel"}</p>
              <div className="flex items-start gap-3">
                {/* The logo: on every scene's corner and big on the closing card. Tap to switch it off or on. */}
                <div className="shrink-0 text-center">
                  {logoUrl ? <button type="button" onClick={() => { setUseLogo((x) => !x); remember({ useLogo: !useLogo }); }} aria-pressed={useLogo} className={`relative grid h-16 w-16 place-items-center overflow-hidden rounded-xl border-2 bg-white p-1 ${useLogo ? "border-brand" : "border-border opacity-50"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />{useLogo && <Check className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-brand p-0.5 text-white" />}</button>
                    : <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-surface2 text-[11px] text-muted">{busy === "img" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span><ImagePlus className="mx-auto h-4 w-4" />Logo</span>}<input type="file" accept="image/*" className="hidden" onChange={(e) => addLogo(e.target.files?.[0] ?? null)} /></label>}
                  {logoUrl && <label className="mt-1 block cursor-pointer text-[11px] font-semibold text-brand-ink">{busy === "img" ? "…" : hi ? "बदलें" : "Change"}<input type="file" accept="image/*" className="hidden" onChange={(e) => addLogo(e.target.files?.[0] ?? null)} /></label>}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[11px] text-muted">{hi ? "कौन-सा नाम बोला और दिखाया जाए?" : "Which name to say and show?"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {names.map((n) => <button key={n} type="button" onClick={() => { pickName(n); setOwnName(false); }} className={small(brandName === n && !ownName)}>{n}{n === firm && names.length > 1 ? <span className="font-normal text-muted"> · {hi ? "कंपनी" : "company"}</span> : ""}</button>)}
                    <button type="button" onClick={() => setOwnName(true)} className={`${small(ownName)} border-dashed`}>+ {hi ? "दूसरा" : "Other"}</button>
                  </div>
                  {ownName && <input autoFocus className={`${inp} py-2 text-sm`} maxLength={40} placeholder={hi ? "जैसे: AlkaFresh" : "e.g. AlkaFresh"} value={brandName} onChange={(e) => pickName(e.target.value)} />}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted">{useLogo && logoUrl ? (hi ? `हर scene के कोने में logo · आख़िर में logo + ${brandName || "नाम"}${phone ? " + 📞" : ""}` : `Logo in every scene's corner · at the end: logo + ${brandName || "name"}${phone ? " + 📞" : ""}`) : (hi ? `हर scene के कोने में “${brandName || "नाम"}” · आख़िर में नाम${phone ? " + 📞" : ""}` : `“${brandName || "name"}” in every scene's corner · name at the end${phone ? " + 📞" : ""}`)}</p>
            </div>
            {errBox}{overBox}
            {/* A reel already on its way: one tap opens its live screen (step 3), not a list. */}
            {(() => { const b = jobs.find(busyJob); if (!b) return null; const st = STEPS.find((x) => x.k === b.stage); return <button type="button" onClick={() => { setTrackId(b.id); setStage("track"); toTop(); }} className="flex w-full items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-left text-sm font-semibold text-brand-ink"><LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /><span className="flex-1">{hi ? `एक reel बन रही है${st && b.status === "running" ? ` · ${st.hi}` : ""}` : `A reel is being made${st && b.status === "running" ? ` · ${st.en}` : ""}`}</span><span>{hi ? "देखें →" : "See →"}</span></button>; })()}
            <button type="button" onClick={() => writeWords()} disabled={busy !== "" || over} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-bold text-white shadow-sm disabled:opacity-50">{busy === "plan" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {hi ? "शब्द लिख रहे हैं…" : "Writing the words…"}</> : over ? (hi ? "कल फिर बनाएँ" : "Come back tomorrow") : <>{hi ? "आगे — शब्द देखो" : "Next — see the words"} <ArrowRight className="h-5 w-5" /></>}</button>
          </div>
        )}

        {stage === "review" && plan && (
          <div className="space-y-4">
            {/* What was chosen — shown, never asked again. */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
              <span className="text-xl">{editing ? "✏️" : k.e}</span>
              <span className="min-w-0 flex-1"><b className="block truncate">{editing ? (hi ? "बदलकर फिर बनाओ" : "Change & make again") : hi ? k.hi : k.en}{(product?.name || (editing ? plan.title : "")) ? ` · ${product?.name || plan.title}` : ""}</b><span className="text-xs text-muted">{langName} · {length} {hi ? "सेकंड" : "sec"}</span></span>
              <button type="button" onClick={() => setStage("choose")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Pencil className="h-3 w-3" /> {hi ? "बदलें" : "Change"}</button>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{hi ? "Reel में यह बोला जाएगा" : "The reel will say"}</p><button type="button" onClick={() => writeWords()} disabled={busy !== ""} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink disabled:opacity-50"><RotateCw className={`h-3.5 w-3.5 ${busy === "plan" ? "animate-spin" : ""}`} /> {hi ? "नए शब्द" : "New words"}</button></div>
              <p className="-mt-2 text-[11px] text-muted">{hi ? "किसी भी line पर tap करके बदलें। नीचे की पट्टी screen पर लिखी दिखेगी।" : "Tap any line to change it. The strip below each line is shown on screen."}</p>
              <div className={`space-y-2 ${busy === "plan" ? "opacity-40" : ""}`}>
                {plan.scenes.map((s, i) => (
                  <div key={i} className="rounded-xl border border-border p-2.5 focus-within:border-brand">
                    <div className="mb-1 flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-brand-ink">Scene {i + 1}</span>{s.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image} alt="" className="h-6 w-6 rounded object-cover" /> : <span className="text-[10px] text-muted">{s.source === "ai" ? "✨ AI" : s.source === "stock" ? "🎞 Clip" : "⚡"}</span>}</div>
                    <textarea rows={2} value={s.text} onChange={(e) => setScene(i, { text: e.target.value })} className="w-full resize-none bg-transparent text-[15px] leading-snug outline-none" />
                    <input value={s.caption_text} onChange={(e) => setScene(i, { caption_text: e.target.value })} aria-label={hi ? "Screen पर" : "On screen"} className="mt-1 w-full rounded-md bg-surface2 px-2 py-1 text-xs font-semibold outline-none" />
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-border p-2.5 focus-within:border-brand"><span className="text-[11px] font-bold text-muted">{hi ? "आख़िरी line" : "Closing line"}</span><input value={plan.cta} onChange={(e) => setPlan({ ...plan, cta: e.target.value })} className="w-full bg-transparent text-[15px] outline-none" /></div>
              </div>
            </div>

            {/* Everything else, closed until wanted. */}
            <div className="rounded-2xl border border-border bg-surface">
              <button type="button" onClick={() => setMore((x) => !x)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"><span>{hi ? "और बदलें" : "More options"} <span className="font-normal text-muted">— {hi ? "लंबाई, आवाज़, music, photos" : "length, voice, music, photos"}</span></span><ChevronDown className={`h-4 w-4 shrink-0 transition ${more ? "rotate-180" : ""}`} /></button>
              {more && <div className="space-y-4 border-t border-border p-4">
                <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "लंबाई" : "Length"} <span className="font-normal">{hi ? "(बदलने पर शब्द फिर लिखे जाएँगे)" : "(rewrites the words)"}</span></p><div className="flex gap-1.5">{[10, 15, 20, 30].map((n) => <button key={n} type="button" onClick={() => relength(n)} className={small(length === n)}>{n} {hi ? "सेकंड" : "s"}</button>)}</div></div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "आवाज़ — tap करके सुनें" : "Voice — tap to hear"}</p>
                  <div className="flex flex-wrap gap-1.5">{(allVoices ? VOICES : VOICES.slice(0, 4).concat(VOICES.slice(4).filter(([v]) => v === voiceStyle))).map(([v, h, e]) => <button key={v} type="button" onClick={() => { setVoiceStyle(v); hear(`v-${v}`, `/voices/${v}.mp3`); }} className={`${small(voiceStyle === v)} inline-flex items-center gap-1.5`}>{playing === `v-${v}` ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{hi ? h : e}</button>)}{!allVoices && <button type="button" onClick={() => setAllVoices(true)} className="shrink-0 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted">{hi ? "और आवाज़ें…" : "more…"}</button>}</div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "Music — tap करके सुनें" : "Music — tap to hear"}</p>
                  <div className="flex flex-wrap gap-1.5">{MUSIC.map((m) => <button key={m || "none"} type="button" onClick={() => { setMusic(m); if (m) hear(`m-${m}`, `/api/media/music/${m}`); else { audio.current?.pause(); setPlaying(""); } }} className={`${small(music === m)} inline-flex items-center gap-1.5`}>{m ? (playing === `m-${m}` ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />) : null}{(MUSIC_NAMES[m] ?? [m, m])[hi ? 0 : 1]}</button>)}</div>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <span className="min-w-0"><span className="block text-sm font-semibold">{hi ? "चलते शब्द (subtitles)" : "Moving words (subtitles)"}</span><span className="block text-[11px] text-muted">{hi ? "जो बोला जा रहा है, वह नीचे लिखा आता है" : "What is said appears at the bottom"}</span></span>
                  <button type="button" role="switch" aria-checked={subs} onClick={() => setSubs((x) => !x)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${subs ? "bg-brand" : "bg-border-strong"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${subs ? "left-[22px]" : "left-0.5"}`} /></button>
                </label>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "अपनी photos — नीचे किसी scene में लगाएँ" : "Your photos — use one in a scene below"}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <label className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-surface2">{busy === "img" ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : <ImagePlus className="h-5 w-5 text-muted" />}<input type="file" accept="image/*" className="hidden" onChange={(e) => addImage(e.target.files?.[0] ?? null)} /></label>
                    {gallery.map((u) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={u} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover" />)}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted">{hi ? "हर scene की picture" : "Each scene's picture"}</p>
                  {plan.scenes.map((s, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5"><span className="w-14 shrink-0 text-[11px] font-bold text-brand-ink">Scene {i + 1}</span>
                        <button type="button" onClick={() => setScene(i, { image: "", source: "auto" })} className={small(!s.image && (s.source ?? "auto") === "auto")}>⚡ {hi ? "अपने-आप" : "Auto"}</button>
                        <button type="button" onClick={() => setScene(i, { image: "", source: "stock" })} className={small(!s.image && s.source === "stock")}>🎞 Clip</button>
                        <button type="button" onClick={() => setScene(i, { image: "", source: "ai" })} className={small(!s.image && s.source === "ai")}>✨ AI · 1 credit</button>
                        {gallery.map((u) => <button key={u} type="button" onClick={() => setScene(i, { image: u, source: "image" })} className={`h-8 w-8 shrink-0 overflow-hidden rounded-md border-2 ${s.image === u ? "border-brand" : "border-transparent"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" className="h-full w-full object-cover" /></button>)}
                      </div>
                      {!s.image && s.source === "ai" && <input className={`${inp} py-2 text-xs`} value={s.ai_prompt ?? ""} placeholder={hi ? "Picture कैसी हो (English में)" : "Describe the picture"} onChange={(e) => setScene(i, { ai_prompt: e.target.value })} />}
                      {!s.image && s.source === "stock" && <input className={`${inp} py-2 text-xs`} value={s.search} placeholder={hi ? "Clip ढूँढने के शब्द (English)" : "Words to find a clip"} onChange={(e) => setScene(i, { search: e.target.value })} />}
                    </div>
                  ))}
                  <p className="text-[11px] text-muted">{hi ? "⚡ अपने-आप: free clip मिले तो free, न मिले तो AI picture (1 credit)। बचे credits वापस।" : "⚡ Auto: a free clip when one fits, else an AI picture (1 credit). Unused credits come back."}</p>
                </div>
              </div>}
            </div>

            {errBox}{overBox}
            {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); refresh(); }} />}
            <button type="button" onClick={make} disabled={busy !== "" || over || making} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-bold text-white shadow-sm disabled:opacity-50">{busy === "create" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />} {busy === "create" ? (hi ? "शुरू कर रहे हैं…" : "Starting…") : making ? (hi ? "एक reel पहले से बन रही है" : "A reel is already being made") : `${hi ? "Reel बनाओ" : "Make my reel"} · ${nAi ? `${nAi}${nAuto ? `–${nAi + nAuto}` : ""} credits` : nAuto ? "free*" : "free"}`}</button>
            {!!nAuto && !nAi && <p className="-mt-2 text-center text-[11px] text-muted">{hi ? "* clip न मिले तो AI picture, 1 credit — बचे वापस" : "* an AI picture (1 credit) only if no clip fits"}</p>}
          </div>
        )}

        {stage === "track" && (<>
          {tracked ? reelCard(tracked, true) : <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
          {tracked && !busyJob(tracked) && <button type="button" onClick={again} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 py-3 text-base font-bold text-brand-ink"><Plus className="h-5 w-5" /> {hi ? "एक और reel बनाओ" : "Make another reel"}</button>}
          {tracked?.status === "failed" && plan && <button type="button" onClick={() => setStage("review")} className="w-full text-sm font-semibold text-brand-ink">{hi ? "उन्हीं शब्दों से फिर कोशिश करें →" : "Try again with the same words →"}</button>}
        </>)}
      </>)}
    </div>
  );
}
