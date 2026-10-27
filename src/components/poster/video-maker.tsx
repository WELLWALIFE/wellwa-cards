"use client";
// Product video maker — two tiers on the same one page (owner, 27 Oct 2026):
//   tier "template" (/poster/video): the product photo cut out and stood in an AI-made room, zoom + transitions. ~₹6-8.
//   tier "realistic" (/poster/video/real, "Pro video"): AI films every scene — a real-looking 5-second clip per line,
//   made from the owner's own product photos (Gemini still → Kling video). ~₹45 a clip. "real profactional video".
// Product video — the same one page, four steps as the Reel (owner, 27 Oct 2026: "ad video ke liye bhi reel wala easy
// same pattern … ek ko samjhne ke baad dusra easy lage"): चुनो → देखो → बन रही है → तैयार.
//   1. Choose: the product (its photo is used), an offer, the language, the logo and name.
//   2. See the words before paying: headline, every line and the closing line can be changed or rewritten; "और बदलें"
//      holds length (and so the price), look, voice and music (both playable), subtitles. Realistic AI scenes and the
//      presenter stay on /poster/video/pro, one small link inside "और बदलें".
//   3. Making: the moving screen. 4. Ready: the video big — WhatsApp / Download / Boost / caption / Edit / another.
// "मेरी videos" is its own tab. ONE price on the Make button, charged once (idem) and refunded on failure.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Download, Share2, Clapperboard, Trash2, Check, Copy, ChevronDown, Pencil, RotateCw, Plus, ArrowRight, Play, Pause, Coins, SlidersHorizontal } from "lucide-react";
import { api, isLoggedIn, shareFile, downloadPoster, LANGS } from "@/lib/poster-client";
import { AddCredits } from "@/components/poster/add-credits";
import { goBack } from "@/lib/nav-back";
import { useT } from "@/lib/poster-i18n";
import { adCredits, proCredits } from "@/lib/media/ad-pricing";
import { ReelMaking } from "@/components/poster/reel-making";
import { BrandPick, type BrandChoice } from "@/components/poster/brand-pick";

type Scene = { text: string; caption_text: string; visual: string; motion: string; still?: string };
type Plan = { headline: string; scenes: Scene[]; cta: string; caption: string; features: string[]; voice?: string; music?: string; template?: string };
type Job = { id: string; kind: string; status: string; stage?: string | null; output_url: string | null; error: string | null; created_at: string; cost?: number; progress?: { text?: string } | null;
  input?: { tier?: string; product?: string; offer?: string; caption?: string; outputs?: Record<string, string>; script?: string[]; headline?: string; features?: string[]; scenes?: Scene[]; cta?: string; lang?: string; length?: number; voiceStyle?: string; music?: string; template?: string; captions?: string; photos?: string[] } };
type MyProduct = { id: string; name: string; photo_url: string | null; category?: string; offer?: string; brand?: string | null; photos?: { url: string; role?: string }[] };
type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
const LENGTHS = [10, 20, 30];
const MAIN_LANGS = ["hi", "hinglish", "en"];
const LOOKS: [string, string, string][] = [["bold", "दमदार", "Bold"], ["clean", "साफ़", "Clean"], ["fresh", "ताज़ा", "Fresh"], ["trust", "भरोसा", "Trust"], ["offer", "Offer", "Offer"], ["festive", "त्योहार", "Festive"]];
const MUSIC = ["", "calm-ambient", "upbeat-corporate", "inspiring-motivational", "energetic-promo", "indian-sitar", "festive-diwali"];
const MUSIC_NAMES: Record<string, [string, string]> = { "": ["कोई नहीं", "None"], "calm-ambient": ["शांत", "Calm"], "upbeat-corporate": ["खुशनुमा", "Lively"], "inspiring-motivational": ["जोश भरा", "Inspiring"], "energetic-promo": ["तेज़", "Energetic"], "indian-sitar": ["सितार", "Sitar"], "festive-diwali": ["त्योहार", "Festive"] };
const VOICES: [string, string, string][] = [["warmf", "महिला · मीठी", "Woman · warm"], ["youthful", "महिला · युवा", "Woman · young"], ["warm", "पुरुष · मीठी", "Man · warm"], ["clear", "पुरुष · साफ़", "Man · clear"],
  ["calm", "महिला · शांत", "Woman · calm"], ["soft", "महिला · कोमल", "Woman · soft"], ["lively", "महिला · जोशीली", "Woman · lively"], ["mature", "महिला · अनुभवी", "Woman · mature"], ["gentle", "महिला · धीमी", "Woman · gentle"],
  ["deep", "पुरुष · भारी", "Man · deep"], ["friendly", "पुरुष · दोस्ताना", "Man · friendly"], ["smooth", "पुरुष · मुलायम", "Man · smooth"], ["expert", "पुरुष · जानकार", "Man · expert"]];
// A dropped mobile connection makes fetch() reject; without the catch the button would spin for ever.
const post = (url: string, body: unknown): Promise<Reply> =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }))
    .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));
function failLine(raw: string | null | undefined, hi: boolean): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return hi ? "आपने ये video रोक दी। जो credits इस्तेमाल नहीं हुए, वापस आ गए।" : "You stopped this video. Any credits we did not use have been returned.";
  const back = hi ? "Credits वापस आ गए।" : "Your credits have been returned.";
  if (/upload/.test(e)) return `${hi ? "Video बन गई थी, पर save नहीं हो पाई।" : "The video was made but could not be saved."} ${back}`;
  if (/tts|voice|speech|audio/.test(e)) return `${hi ? "आवाज़ record नहीं हो पाई।" : "The voice could not be recorded."} ${back}`;
  if (/clip|stock|image|photo|veo|kling|fal|pexels|storyboard/.test(e)) return `${hi ? "एक scene की picture नहीं बन पाई।" : "We could not make a picture for one scene."} ${back}`;
  return `${hi ? "Video बन नहीं पाई।" : "The video could not be finished."} ${back}`;
}
const busyJob = (j: Job) => j.status === "queued" || j.status === "running";
const urlOf = (j: Job) => j.input?.outputs?.reel ?? j.output_url ?? "";

export function VideoMaker({ tier = "template" }: { tier?: "template" | "realistic" }) {
  const real = tier === "realistic";
  const router = useRouter();
  const { lang: ui } = useT(); const hi = ui !== "en";
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"make" | "mine">("make");
  const [stage, setStage] = useState<"choose" | "review" | "track">("choose");
  // step 1
  const [products, setProducts] = useState<MyProduct[]>([]); const [productId, setProductId] = useState(""); const [product, setProduct] = useState("");
  const [category, setCategory] = useState(""); const [phone, setPhone] = useState(""); const [firm, setFirm] = useState("");
  const [brand, setBrand] = useState<BrandChoice>({ name: "", logo: "" });
  const [offer, setOffer] = useState("");
  // Pro video: how the product is really operated (owner, 27 Oct 2026: "display se nahi chalta, button se chalta hai").
  // The AI never guesses this; it is remembered per product on this phone.
  const [usage, setUsage] = useState("");
  const [lang, setLang] = useState("hi"); const [moreLangs, setMoreLangs] = useState(false);
  // step 2
  const [plan, setPlan] = useState<Plan | null>(null);
  const [length, setLength] = useState(10); const [look, setLook] = useState("bold"); const [voiceStyle, setVoiceStyle] = useState("warmf"); const [music, setMusic] = useState("upbeat-corporate"); const [subs, setSubs] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [stillBusy, setStillBusy] = useState<Record<number, boolean>>({}); const [stillErr, setStillErr] = useState<Record<number, string>>({}); const [allVoices, setAllVoices] = useState(false); const [editing, setEditing] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null); const [playing, setPlaying] = useState("");
  // step 3 / 4 and shared
  const [trackId, setTrackId] = useState("");
  const [busy, setBusy] = useState<"" | "plan" | "create">("");
  const [err, setErr] = useState(""); const [needCredits, setNeedCredits] = useState<number | null>(null); const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [acting, setActing] = useState(""); const [rowMsg, setRowMsg] = useState<Record<string, { t: string; ok: boolean }>>({}); const [copied, setCopied] = useState("");
  const idem = useRef(""); // the same tap retried (bad network, double tap) must never become a second paid render
  const topRef = useRef<HTMLDivElement | null>(null);
  const onBrand = useCallback((c: BrandChoice) => setBrand(c), []);

  async function refresh() { const r = await fetch("/api/media/jobs?kind=ad", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.kind === "ad" && (real ? j.input?.tier === "realistic" : j.input?.tier !== "stock" && j.input?.tier !== "realistic"))); if (typeof r.credits === "number") setCredits(r.credits); }
  const toTop = () => setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  useEffect(() => { (async () => {
    // Links that mean the full screen (buy credits, a video from a review, photos sent from the photoshoot) keep working there.
    let seeded = false; try { seeded = !!sessionStorage.getItem("akp-ad-seed"); } catch { /* private window */ }
    const search = new URLSearchParams(window.location.search);
    if (search.get("credits") || search.get("testimonial") || seeded) { const q = search.toString(); router.replace(`/poster/video/pro${q ? `?${q}` : ""}`); return; }
    if (!(await isLoggedIn())) { router.replace(`/login?next=/poster/video${real ? "/real" : ""}`); return; }
    const [, pr, pp] = await Promise.all([
      refresh(),
      api<{ products?: MyProduct[] }>("/api/poster/products").catch(() => null),
      api<{ profiles?: { name: string; phone?: string; is_default?: boolean; category?: string }[] }>("/api/poster/profiles").catch(() => null),
    ]);
    const l = pr?.data.products ?? []; setProducts(l); if (l.length === 1) { setProductId(l[0].id); try { setUsage(localStorage.getItem(`pro.usage.${l[0].id}`) ?? ""); } catch { /* private window */ } }
    const p = (pp?.data.profiles ?? []).find((x) => x.is_default) ?? pp?.data.profiles?.[0];
    if (p) { setFirm(p.name); setPhone(p.phone || ""); setCategory(p.category || ""); }
    setReady(true);
  })(); }, [router]);
  useEffect(() => { if (!jobs.some(busyJob)) return; const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [jobs]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  const chosen = products.find((p) => p.id === productId);
  const name = (chosen?.name || product).trim();
  const making = jobs.some(busyJob);
  const price = (n: number) => (real ? proCredits(n) : adCredits(n));
  const cost = price(length);
  const brands = [...new Set(products.map((p) => (p.brand ?? "").trim()).filter(Boolean))];
  const base = (len = length) => ({ product: name, category: chosen?.category || category, goal: "leads", audience: "", lang, length: len, tone: "warm", offer: offer || chosen?.offer || "", phone, brandName: brand.name || firm, website: "", notes: "", tier, formats: ["reel"], ...(real ? {} : { product_id: productId || undefined }) });

  /** Step 1 → 2: the AI writes the words; nothing is charged yet. */
  async function writeWords(len = length) {
    if (name.length < 2) { setErr(hi ? "पहले product चुनें या उसका नाम लिखें।" : "Choose a product or type its name first."); return; }
    // AI films the product from its own photos — without one it would invent a different machine.
    if (real && !chosen?.photo_url) { setErr(hi ? "Pro video में AI आपका असली product दिखाता है — इसके लिए product की photo चाहिए। Products में photo जोड़कर उसे चुनें।" : "The Pro video shows your real product — it needs the product's photo. Add a photo under Products and choose it."); return; }
    setErr(""); setNeedCredits(null); setBusy("plan");
    try {
      const p = await post("/api/media/ad-plan", { ...base(len), features: [], photo: chosen?.photo_url || undefined, ...(real && usage.trim() ? { usage: usage.trim() } : {}) });
      if (!p.ok) { setErr(p.status === 0 ? (hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.") : (hi ? "शब्द नहीं लिखे जा सके। फिर try करें।" : "Could not write the words. Please try again.")); return; }
      const pl = p.data.plan as Plan; setPlan(pl); setEditing(false);
      const ph = chosen ? [...new Set([...(chosen.photo_url ? [chosen.photo_url] : []), ...(real ? (chosen.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url) : [])])].slice(0, real ? 5 : 1) : [];
      // Pro video: the storyboard — one picture per shot, made now, seen and changed before anything is paid.
      if (real) void storyboard(pl.scenes, ph);
      if (stage !== "review") {
        // The AI's own suggestions for look, voice and music, changeable under "और बदलें".
        if (pl.template && LOOKS.some(([k]) => k === pl.template)) setLook(pl.template);
        setVoiceStyle(pl.voice === "male" ? "warm" : "warmf");
        if (pl.music !== undefined && MUSIC.includes(pl.music)) setMusic(pl.music);
        // Pro video: every product photo helps the AI keep the machine exactly as it is (up to 5).
        setPhotos(chosen ? [...new Set([...(chosen.photo_url ? [chosen.photo_url] : []), ...(real ? (chosen.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url) : [])])].slice(0, real ? 5 : 1) : []);
        setStage("review"); toTop();
      }
    } finally { setBusy(""); }
  }
  /** Step 2 → 3: charged once, then queued. */
  async function make() {
    if (!plan) return;
    if (!window.confirm(hi ? `ये video बनाएँ? ${length} सेकंड · ${cost} credits।` : `Make this video? ${length} seconds · ${cost} credits.`)) return;
    if (!idem.current) { try { idem.current = crypto.randomUUID(); } catch { idem.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`; } }
    setErr(""); setNeedCredits(null); setBusy("create");
    try {
      const r = await post("/api/media/ad", { ...base(), idem: idem.current, photos, logoUrl: brand.logo, headline: plan.headline, features: (plan.features ?? []).slice(0, 4), script: [...plan.scenes.map((s) => s.text), plan.cta], scenes: plan.scenes, cta: plan.cta, caption: plan.caption, voice: true, voiceStyle, template: look, music, captions: subs ? "words" : "off", variants: 1 });
      if (!r.ok) {
        setErr(String(r.data.error ?? "") || (r.status === 0 ? (hi ? "Server तक नहीं पहुँचे। Internet देखकर दोबारा दबाएँ — दो बार पैसे नहीं कटेंगे।" : "We could not reach the server. Check your internet and tap again — you will not be charged twice.") : (hi ? "Video शुरू नहीं हो पाई। फिर try करें।" : "Could not start the video. Please try again.")));
        if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || cost));
        return;
      }
      idem.current = "";
      setTrackId(String(r.data.jobId ?? r.data.id ?? "")); setStage("track"); await refresh(); toTop();
    } finally { setBusy(""); }
  }
  /** Edit after it is made: the words, look, voice, music and subtitles come back at step 2, in place. */
  function openEdit(j: Job) {
    const inp = j.input;
    if (!inp?.scenes?.length) { setRowMsg((m) => ({ ...m, [j.id]: { t: hi ? "इस video के शब्द save नहीं हैं — नई video बनाइए।" : "This video's words were not saved — please make a new one.", ok: false } })); return; }
    setPlan({ headline: inp.headline ?? "", scenes: inp.scenes, cta: inp.cta ?? "", caption: inp.caption ?? "", features: inp.features ?? [] });
    if (inp.product) { const m = products.find((p) => p.name === inp.product); if (m) setProductId(m.id); else { setProductId(""); setProduct(inp.product); } }
    if (inp.offer !== undefined) setOffer(inp.offer);
    if (inp.lang) setLang(inp.lang);
    if (inp.length && LENGTHS.includes(Number(inp.length))) setLength(Number(inp.length));
    if (inp.voiceStyle) setVoiceStyle(inp.voiceStyle);
    if (inp.music !== undefined) setMusic(inp.music);
    if (inp.template) setLook(inp.template);
    setSubs(inp.captions !== "off"); setPhotos(inp.photos ?? []);
    setEditing(true); setErr(""); setTab("make"); setStage("review"); toTop();
  }
  function again() { setStage("choose"); setPlan(null); setTrackId(""); setOffer(""); setErr(""); setEditing(false); setMore(false); toTop(); }
  async function makeStill(i: number, visual: string, ph: string[]) {
    setStillBusy((m) => ({ ...m, [i]: true }));
    try {
      const r = await post("/api/media/ad-stills", { visual, photos: ph });
      if (r.ok && typeof r.data.url === "string") setPlan((p) => (p ? { ...p, scenes: p.scenes.map((x, k) => (k === i ? { ...x, still: String(r.data.url) } : x)) } : p));
      else setStillErr((m) => ({ ...m, [i]: String(r.data.error ?? "") || (hi ? "तस्वीर नहीं बनी — फिर दबाएँ।" : "Could not make the picture — tap again.") }));
    } finally { setStillBusy((m) => ({ ...m, [i]: false })); }
  }
  async function storyboard(scenes: Scene[], ph: string[]) {
    setStillErr({});
    const queue = scenes.map((x, i) => ({ i, v: x.visual })).filter((x) => x.v);
    await Promise.all([0, 1].map(async () => { while (queue.length) { const q = queue.shift()!; await makeStill(q.i, q.v, ph); } }));
  }
  function relength(n: number) { if (n === length || busy) return; setLength(n); writeWords(n); }
  const setScene = (i: number, p: Partial<Scene>) => plan && setPlan({ ...plan, scenes: plan.scenes.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  function hear(key: string, url: string) {
    if (!audio.current) { audio.current = new Audio(); audio.current.onended = () => setPlaying(""); }
    if (playing === key) { audio.current.pause(); setPlaying(""); return; }
    audio.current.src = url; audio.current.currentTime = 0;
    audio.current.play().then(() => setPlaying(key)).catch(() => setPlaying(""));
  }
  async function stopOrDelete(j: Job) {
    const stop = busyJob(j);
    if (!window.confirm(stop ? (hi ? "ये video रोक दें? जो credits इस्तेमाल नहीं हुए, वापस आ जाएँगे।" : "Stop this video? Unused credits come back.") : (hi ? "ये video delete कर दें? वापस नहीं आएगी।" : "Delete this video? This cannot be undone."))) return;
    setActing(j.id + "x");
    try { const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" }); if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: { t: hi ? "नहीं हो पाया। फिर try करें।" : "Could not do that. Please try again.", ok: false } })); return; } if (stop) { refresh(); if (j.id === trackId) setStage("review"); } else setJobs((l) => l.filter((x) => x.id !== j.id)); }
    finally { setActing(""); }
  }
  async function share(j: Job) { setActing(j.id); const s = await shareFile(urlOf(j), j.input?.caption ?? "", `video-${j.id.slice(0, 8)}.mp4`, "video/mp4"); setRowMsg((m) => ({ ...m, [j.id]: s === "failed" ? { t: hi ? "Share नहीं हुआ — Download करें।" : "Not shared — try Download.", ok: false } : { t: s === "shared" ? (hi ? "भेज दिया" : "Sent") : (hi ? "Phone में save हो गई" : "Saved to your phone"), ok: true } })); setActing(""); }
  async function download(j: Job) { setActing(j.id + "d"); const ok = await downloadPoster(urlOf(j), `video-${j.id.slice(0, 8)}.mp4`); setRowMsg((m) => ({ ...m, [j.id]: ok ? { t: hi ? "Phone में save हो गई" : "Saved to your phone", ok: true } : { t: hi ? "Save नहीं हुई — फिर try करें" : "Could not save — try again", ok: false } })); setActing(""); }
  async function copyCaption(j: Job) { try { await navigator.clipboard.writeText(j.input?.caption ?? ""); setCopied(j.id); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ } }

  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-xl border border-border bg-surface px-3 py-3 text-[15px] outline-none focus:border-brand";
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3.5 py-2 text-sm ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const small = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const label = "mb-2 flex items-center gap-2 text-sm font-semibold";
  const num = (n: number) => <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{n}</span>;
  const langs = LANGS.filter((l) => moreLangs || MAIN_LANGS.includes(l.key) || l.key === lang);
  const langName = LANGS.find((l) => l.key === lang)?.label ?? lang;
  const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
  const tracked = jobs.find((j) => j.id === trackId);
  const flow = stage === "choose" ? 0 : stage === "review" ? 1 : tracked?.status === "done" ? 3 : 2;
  const FLOW = hi ? ["चुनो", "देखो", "बन रही", "तैयार"] : ["Choose", "Check", "Making", "Ready"];
  const errBox = err ? <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p> : null;

  /** A made / making video — step 3-4 (big) and the "मेरी videos" list. A plain function so a playing video is not re-mounted on a poll. */
  const videoCard = (j: Job, big = false) => (
    <div key={j.id} className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm">{j.input?.product ?? "Product video"}</b><span className="text-[11px] text-muted">{when(j.created_at)}{j.input?.length ? ` · ${j.input.length} ${hi ? "सेकंड" : "s"}` : ""}</span></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${j.status === "done" ? "bg-good/10 text-good" : j.status === "failed" ? "bg-danger/10 text-danger" : "bg-brand-soft text-brand-ink"}`}>{j.status === "done" ? (hi ? "✓ तैयार" : "✓ ready") : j.status === "failed" ? (hi ? "नहीं बनी" : "not made") : (hi ? "बन रही है" : "Making")}</span></div>
      {busyJob(j) && (<>
        {big ? <ReelMaking kind={real ? "real" : "video"} stage={j.status === "running" ? j.stage : "queued"} startedAt={j.created_at} scenes={(j.input?.scenes ?? []).map((s) => ({ text: s.text }))} title={j.input?.headline || j.input?.product || "Video"} hi={hi} />
          : <><p className="text-xs text-brand-ink">{j.progress?.text || (hi ? "बन रही है…" : "Making…")}</p>{!!j.input?.script?.length && <p className="rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.script.join(" ")}</p>}</>}
        <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="w-full rounded-lg border border-danger/60 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{hi ? "रोक दें" : "Stop"}</button>
      </>)}
      {j.status === "failed" && <p className="text-sm text-danger">{failLine(j.error, hi)}</p>}
      {j.status === "done" && urlOf(j) && (<>
        <video src={urlOf(j)} controls playsInline preload={big ? "auto" : "metadata"} className={`mx-auto aspect-[9/16] rounded-xl bg-black ${big ? "max-h-[70dvh]" : "max-h-[55dvh]"}`} />
        <div className="flex gap-2">
          <button type="button" onClick={() => share(j)} disabled={acting === j.id} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-3 text-sm font-bold text-white"><Share2 className="h-4 w-4" /> WhatsApp / Share</button>
          <button type="button" onClick={() => download(j)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button>
        </div>
        <Link href={`/poster/ads?job=${j.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-ai/30 bg-ai-soft/40 px-3 py-2.5 text-sm font-semibold text-ai">🚀 {hi ? "Boost करें — Facebook / Instagram पर ज़्यादा लोगों तक" : "Boost — show it to more people on Facebook / Instagram"}</Link>
        {j.input?.caption && <div className="rounded-lg bg-surface2 p-2">
          <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold text-muted">{hi ? "Post के साथ लिखने के लिए" : "Caption for your post"}</span><button type="button" onClick={() => copyCaption(j)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-ink">{copied === j.id ? <><Check className="h-3 w-3" /> {hi ? "Copy हो गया" : "Copied"}</> : <><Copy className="h-3 w-3" /> Copy</>}</button></div>
          <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted">{j.input.caption}</p>
        </div>}
      </>)}
      {rowMsg[j.id] && <p className={`text-xs font-semibold ${rowMsg[j.id].ok ? "text-good" : "text-danger"}`}>{rowMsg[j.id].t}</p>}
      {!busyJob(j) && !big && <div className="flex items-center justify-between">
        {!!j.input?.scenes?.length ? <button type="button" onClick={() => openEdit(j)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Pencil className="h-3.5 w-3.5" /> {hi ? "Edit — बदलकर फिर बनाओ" : "Edit — change & make again"}</button> : <span />}
        <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="inline-flex items-center gap-1 text-xs text-muted disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
      </div>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div ref={topRef} className="scroll-mt-20" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (tab === "make" && stage === "review" ? setStage("choose") : goBack(router, "/poster/videos"))} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> {real ? "Pro video" : "Product video"}{real && <span className="ml-1 rounded-full bg-ai-soft px-2 py-0.5 text-[11px] font-semibold text-ai">{hi ? "असली video" : "Real video"}</span>}</h1>
        {credits !== null && <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold"><Coins className="h-3.5 w-3.5 text-brand" /> {credits}</span>}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1 text-sm font-semibold">
        <button type="button" onClick={() => setTab("make")} className={`rounded-lg py-2 ${tab === "make" ? "bg-surface shadow-sm" : "text-muted"}`}>{hi ? "नई video" : "New video"}</button>
        <button type="button" onClick={() => setTab("mine")} className={`rounded-lg py-2 ${tab === "mine" ? "bg-surface shadow-sm" : "text-muted"}`}>{hi ? "मेरी videos" : "My videos"}{jobs.length ? ` (${jobs.length})` : ""}{making && <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-brand align-middle" />}</button>
      </div>

      {tab === "mine" && (jobs.length ? <div className="space-y-3">{jobs.map((j) => videoCard(j))}</div>
        : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">{hi ? "अभी कोई video नहीं।" : "No videos yet."} <button type="button" onClick={() => setTab("make")} className="font-semibold text-brand-ink">{hi ? "पहली बनाएँ →" : "Make the first →"}</button></div>)}

      {tab === "make" && (<>
        <ol className="grid grid-cols-4 gap-1">{FLOW.map((l, i) => <li key={l} className="space-y-1"><div className={`h-1 rounded-full ${i <= flow ? "bg-brand" : "bg-surface2"}`} /><p className={`text-center text-[11px] ${i === flow ? "font-bold text-brand-ink" : i < flow ? "text-brand-ink" : "text-muted"}`}>{i < flow ? "✓ " : ""}{l}</p></li>)}</ol>

        {stage === "choose" && (
          <div className="space-y-5 rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">{real ? (hi ? "AI हर scene की असली जैसी video बनाता है — लोग, घर और आपका product, हिलते हुए। आपकी product photos से, ताकि machine वही दिखे। पैसे कटने से पहले शब्द और दृश्य आप देख लेंगे।" : "AI films every scene as a real-looking video — people, a home and your product, moving. Made from your product photos so it stays your product. You see the words and scenes before you pay.") : (hi ? "Product चुनिए, बाक़ी हम करेंगे — शब्द, आवाज़, music और आपके product की photo। पैसे कटने से पहले शब्द आप देख लेंगे।" : "Choose the product, we do the rest — words, voice, music and your product photo. You see the words before you pay.")}</p>
            <div className="space-y-2">
              <p className={label}>{num(1)} {hi ? "किस product का video?" : "Which product?"}</p>
              {products.length > 0 ? (<>
                <select value={productId} onChange={(e) => { setProductId(e.target.value); setErr(""); try { setUsage(localStorage.getItem(`pro.usage.${e.target.value}`) ?? ""); } catch { /* private window */ } }} className={inp}><option value="">{hi ? "Product चुनें…" : "Choose a product…"}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                {chosen?.photo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={chosen.photo_url} alt={chosen.name} className="h-20 w-20 rounded-xl border border-border bg-white object-contain" />}
                {!productId && <input className={inp} placeholder={hi ? "…या नाम लिखें" : "…or type a name"} value={product} onChange={(e) => { setProduct(e.target.value); setErr(""); }} />}
              </>) : (<>
                <input className={inp} placeholder={hi ? "Product या service का नाम" : "Product or service name"} value={product} onChange={(e) => { setProduct(e.target.value); setErr(""); }} />
                <p className="text-xs text-muted">{hi ? <>Video में product की photo चाहिए? पहले <Link href="/poster/products" className="underline">Products</Link> में product जोड़ें।</> : <>Want your photo in the video? Add the product under <Link href="/poster/products" className="underline">Products</Link> first.</>}</p>
              </>)}
            </div>
            {real && <div>
              <p className={label}><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">i</span> {hi ? "यह कैसे चलता है?" : "How is it used?"} <span className="font-normal text-muted">{hi ? "(ज़रूरी नहीं)" : "(optional)"}</span></p>
              <input className={inp} value={usage} maxLength={200} onChange={(e) => { setUsage(e.target.value); try { if (productId) localStorage.setItem(`pro.usage.${productId}`, e.target.value); } catch { /* private window */ } }} placeholder={hi ? "जैसे: सामने का button दबाने पर pipe से पानी आता है" : "e.g. press the front button and water comes from the pipe"} />
              <p className="mt-1 text-[11px] text-muted">{hi ? "AI video में product वैसे ही चलाएगा। खाली छोड़ें तो कोई button या screen नहीं दबाएगा — सिर्फ़ नतीजा दिखाएगा (जैसे पानी भरना)।" : "The AI will use it exactly this way. Left empty, nobody presses anything — it shows the result (like water filling a glass)."}</p>
            </div>}
            <div>
              <p className={label}>{num(2)} {hi ? "कोई offer?" : "Any offer?"}</p>
              <input className={inp} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={hi ? "जैसे: इस हफ़्ते 20% छूट (ज़रूरी नहीं)" : "e.g. 20% off this week (optional)"} />
            </div>
            <div>
              <p className={label}>{num(3)} {hi ? "भाषा" : "Language"}</p>
              <div className="flex flex-wrap gap-1.5">{langs.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={chip(lang === l.key)}>{l.label}</button>)}{!moreLangs && <button type="button" onClick={() => setMoreLangs(true)} className="rounded-full border border-dashed border-border px-3.5 py-2 text-sm text-muted">{hi ? "और भाषाएँ…" : "more…"}</button>}</div>
            </div>
            <div>
              <p className={label}>{num(4)} {hi ? "Video पर आपकी पहचान" : "Your name on the video"}</p>
              <BrandPick hi={hi} firm={firm} brands={[...(chosen?.brand ? [chosen.brand] : []), ...brands]} phone={phone} onChange={onBrand} corner={false} />
            </div>
            {errBox}
            {(() => { const b = jobs.find(busyJob); if (!b) return null; return <button type="button" onClick={() => { setTrackId(b.id); setStage("track"); toTop(); }} className="flex w-full items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-left text-sm font-semibold text-brand-ink"><LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /><span className="flex-1">{hi ? "एक video बन रही है" : "A video is being made"}</span><span>{hi ? "देखें →" : "See →"}</span></button>; })()}
            <button type="button" onClick={() => writeWords()} disabled={busy !== ""} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-bold text-white shadow-sm disabled:opacity-50">{busy === "plan" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> {hi ? "शब्द लिख रहे हैं…" : "Writing the words…"}</> : <>{hi ? "आगे — शब्द देखो" : "Next — see the words"} <ArrowRight className="h-5 w-5" /></>}</button>
            <p className="-mt-2 text-center text-[11px] text-muted">{hi ? `शब्द देखना free · video ${cost} credits से (${length} सेकंड) · न बने तो पूरे credits वापस` : `Seeing the words is free · the video from ${cost} credits (${length} s) · refunded in full if it fails`}</p>
          </div>
        )}

        {stage === "review" && plan && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
              {chosen?.photo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={chosen.photo_url} alt="" className="h-9 w-9 rounded-lg border border-border bg-white object-contain" /> : <span className="text-xl">{editing ? "✏️" : "🎬"}</span>}
              <span className="min-w-0 flex-1"><b className="block truncate">{editing ? (hi ? "बदलकर फिर बनाओ · " : "Change & make again · ") : ""}{name || "Product"}</b><span className="text-xs text-muted">{langName} · {length} {hi ? "सेकंड" : "sec"}{offer ? ` · ${offer}` : ""}</span></span>
              <button type="button" onClick={() => setStage("choose")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Pencil className="h-3 w-3" /> {hi ? "बदलें" : "Change"}</button>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{hi ? "Video में यह बोला जाएगा" : "The video will say"}</p><button type="button" onClick={() => writeWords()} disabled={busy !== ""} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink disabled:opacity-50"><RotateCw className={`h-3.5 w-3.5 ${busy === "plan" ? "animate-spin" : ""}`} /> {hi ? "नए शब्द" : "New words"}</button></div>
              <p className="-mt-2 text-[11px] text-muted">{hi ? "किसी भी line पर tap करके बदलें।" : "Tap any line to change it."}</p>
              <div className={`space-y-2 ${busy === "plan" ? "opacity-40" : ""}`}>
                <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-2.5 focus-within:border-brand"><span className="text-[11px] font-bold text-brand-ink">{hi ? "मुख्य line (screen पर बड़ी)" : "Headline (big on screen)"}</span><input value={plan.headline} onChange={(e) => setPlan({ ...plan, headline: e.target.value })} className="w-full bg-transparent text-[15px] font-semibold outline-none" /></div>
                {plan.scenes.map((s, i) => (
                  <div key={i} className="rounded-xl border border-border p-2.5 focus-within:border-brand">
                    <span className="text-[11px] font-bold text-brand-ink">Scene {i + 1}</span>
                    <div className="flex gap-2.5">
                      {/* The storyboard picture — the first frame the AI films from. */}
                      {real && <div className="w-20 shrink-0 space-y-1 text-center">
                        <div className="relative grid aspect-[9/16] w-20 place-items-center overflow-hidden rounded-lg border border-border bg-surface2">
                          {s.still ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.still} alt="" className={`h-full w-full object-cover ${stillBusy[i] ? "opacity-40" : ""}`} /> : null}
                          {stillBusy[i] ? <LoaderCircle className="absolute h-5 w-5 animate-spin text-brand" /> : !s.still ? <span className="px-1 text-[10px] text-muted">{hi ? "तस्वीर" : "Picture"}</span> : null}
                        </div>
                        <button type="button" disabled={!!stillBusy[i]} onClick={() => makeStill(i, s.visual, photos)} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand-ink disabled:opacity-50"><RotateCw className="h-3 w-3" /> {s.still ? (hi ? "नई" : "Redo") : (hi ? "बनाओ" : "Make")}</button>
                      </div>}
                      <textarea rows={real ? 4 : 2} value={s.text} onChange={(e) => setScene(i, { text: e.target.value })} className="min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-snug outline-none" />
                    </div>
                    {real && stillErr[i] && <p className="mt-1 text-[11px] font-semibold text-danger">{stillErr[i]}</p>}
                    {real && <label className="mt-1 block rounded-md bg-surface2 px-2 py-1.5"><span className="block text-[10px] font-semibold text-muted">🎥 {hi ? "क्या दिखेगा (English में, AI के लिए) — बदलकर “नई” दबाएँ" : "What we see (for the AI) — change it, then tap Redo"}</span><textarea rows={2} value={s.visual} onChange={(e) => setScene(i, { visual: e.target.value })} className="w-full resize-none bg-transparent text-xs leading-snug outline-none" /></label>}
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-border p-2.5 focus-within:border-brand"><span className="text-[11px] font-bold text-muted">{hi ? "आख़िरी line" : "Closing line"}</span><input value={plan.cta} onChange={(e) => setPlan({ ...plan, cta: e.target.value })} className="w-full bg-transparent text-[15px] outline-none" /></div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface">
              <button type="button" onClick={() => setMore((x) => !x)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"><span>{hi ? "और बदलें" : "More options"} <span className="font-normal text-muted">— {hi ? "लंबाई, look, आवाज़, music" : "length, look, voice, music"}</span></span><ChevronDown className={`h-4 w-4 shrink-0 transition ${more ? "rotate-180" : ""}`} /></button>
              {more && <div className="space-y-4 border-t border-border p-4">
                <div><p className="mb-1.5 text-xs font-semibold text-muted">{hi ? "लंबाई" : "Length"} <span className="font-normal">{hi ? "(बदलने पर शब्द फिर लिखे जाएँगे)" : "(rewrites the words)"}</span></p><div className="flex gap-1.5">{LENGTHS.map((n) => <button key={n} type="button" onClick={() => relength(n)} className={small(length === n)}>{n} {hi ? "सेकंड" : "s"} · {price(n)}</button>)}</div></div>
                <div><p className="mb-1.5 text-xs font-semibold text-muted">Look</p><div className="flex flex-wrap gap-1.5">{LOOKS.map(([k, h, e]) => <button key={k} type="button" onClick={() => setLook(k)} className={small(look === k)}>{hi ? h : e}</button>)}</div></div>
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
                <Link href="/poster/video/pro" className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm">
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{real ? (hi ? "Presenter, ग्राहक review" : "Presenter, customer review") : (hi ? "Presenter, ग्राहक review, और choices" : "Presenter, customer review, more choices")}</span><span className="block text-[11px] text-muted">{hi ? "Pro screen — ज़्यादा choices" : "Pro screen — more choices"}</span></span>
                  <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-muted" />
                </Link>
              </div>}
            </div>

            {errBox}
            {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); refresh(); }} />}
            {real && Object.values(stillBusy).some(Boolean) && <p className="text-center text-xs font-semibold text-brand-ink">{hi ? "Storyboard की तस्वीरें बन रही हैं… पसंद न आए तो “नई” दबाएँ — पैसे अभी नहीं कटे।" : "Making the storyboard pictures… tap Redo on any you do not like — nothing is charged yet."}</p>}
            <button type="button" onClick={make} disabled={busy !== "" || making || (real && Object.values(stillBusy).some(Boolean))} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-bold text-white shadow-sm disabled:opacity-50">{busy === "create" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />} {busy === "create" ? (hi ? "शुरू कर रहे हैं…" : "Starting…") : making ? (hi ? "एक video पहले से बन रही है" : "A video is already being made") : `${hi ? "Video बनाओ" : "Make my video"} · ${cost} credits`}</button>
            <p className="-mt-2 text-center text-[11px] text-muted">{hi ? `${length} सेकंड · Reel size · ${real ? "5–12" : "2–5"} मिनट · न बने तो पूरे credits वापस` : `${length} seconds · Reel size · ${real ? "5–12" : "2–5"} minutes · refunded in full if it fails`}{credits !== null ? ` · ${hi ? "आपके पास" : "you have"} ${credits}` : ""}</p>
          </div>
        )}

        {stage === "track" && (<>
          {tracked ? videoCard(tracked, true) : <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
          {tracked && !busyJob(tracked) && !!tracked.input?.scenes?.length && <button type="button" onClick={() => openEdit(tracked)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-base font-semibold"><Pencil className="h-5 w-5" /> {hi ? "Edit करें — शब्द, आवाज़, music बदलकर फिर बनाओ" : "Edit — change words, voice, music and make again"}</button>}
          {tracked && !busyJob(tracked) && <button type="button" onClick={again} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 py-3 text-base font-bold text-brand-ink"><Plus className="h-5 w-5" /> {hi ? "एक और video बनाओ" : "Make another video"}</button>}
        </>)}
      </>)}
    </div>
  );
}
