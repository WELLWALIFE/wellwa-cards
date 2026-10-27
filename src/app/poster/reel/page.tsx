"use client";
// Reel — the one-tap screen (owner, 20 Oct 2026: "bahut complicated hai; jo koi bhi bana sake, bilkul simple").
// Pick what the reel is about, tap Make. The words, the clips, the voice, the captions and the music are all chosen
// for the owner; the finished reel appears below with Share and Download. Every choice the old screen offered
// (scenes, own photos, AI pictures, voice, music, length) lives on at /poster/reel/pro behind one small link.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Download, Share2, Clapperboard, Trash2, SlidersHorizontal } from "lucide-react";
import { api, isLoggedIn, shareFile, downloadPoster, LANGS } from "@/lib/poster-client";
import { AddCredits } from "@/components/poster/add-credits";
import { goBack } from "@/lib/nav-back";
import { useT } from "@/lib/poster-i18n";

type Scene = { text: string; caption_text: string; search: string; image: string; search_alt?: string; text_en?: string; ai_prompt?: string; source?: "auto" | "stock" | "ai" | "image" };
type Plan = { title: string; scenes: Scene[]; cta: string; caption: string };
type Job = { id: string; status: string; output_url: string | null; error: string | null; created_at: string; progress?: { text?: string } | null; input?: { tier?: string; product?: string; caption?: string; duration_sec?: number; scenes?: Scene[] } };
type MyProduct = { id: string; name: string; category?: string };
type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
// A dropped mobile connection makes fetch() reject; without the catch the button would spin for ever.
const post = (body: unknown): Promise<Reply> =>
  fetch("/api/media/reel-maker", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }))
    .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));

// Four kinds, each with its own music; the other two (customer story, everyday story) stay on the advanced screen.
const KINDS = [
  { k: "tip", e: "💡", hi: "काम की बात", en: "A useful tip", dhi: "एक tip जो लोग save करें", den: "A tip people save and share", music: "calm-ambient" },
  { k: "offer", e: "🎉", hi: "Offer", en: "Offer", dhi: "आज का offer, आज ही क्यों", den: "Your offer, and why today", music: "energetic-promo" },
  { k: "benefit", e: "⭐", hi: "हम क्यों", en: "Why us", dhi: "हमसे लेने की एक साफ़ वजह", den: "One clear reason to buy from you", music: "upbeat-corporate" },
  { k: "festival", e: "🪔", hi: "त्योहार", en: "Festival", dhi: "शुभकामनाएँ, आपके नाम से", den: "A festival wish from your business", music: "festive-diwali" },
] as const;
const MAIN_LANGS = ["hi", "hinglish", "en"];
const MONEY_BACK = "Your credits have been returned.";
function failLine(raw: string | null | undefined, hi: boolean): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return hi ? "आपने ये reel रोक दी। बचे credits वापस आ गए।" : "You stopped this reel. Any credits we did not use have been returned.";
  if (/tts|voice|speech|audio/.test(e)) return hi ? "आवाज़ record नहीं हो पाई। Credits वापस आ गए।" : `The voice could not be recorded. ${MONEY_BACK}`;
  if (/clip|stock|image|photo|veo|kling|fal|pexels/.test(e)) return hi ? "एक scene की picture नहीं मिली। Credits वापस आ गए।" : `We could not get a picture for one scene. ${MONEY_BACK}`;
  return hi ? "Reel बन नहीं पाई। Credits वापस आ गए।" : `The reel could not be finished. ${MONEY_BACK}`;
}

export default function Reel() {
  const router = useRouter();
  const { lang: ui } = useT(); const hi = ui !== "en";
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["k"]>("tip");
  const [business, setBusiness] = useState(""); const [category, setCategory] = useState(""); const [phone, setPhone] = useState(""); const [brandName, setBrandName] = useState("");
  const [productId, setProductId] = useState(""); const [products, setProducts] = useState<MyProduct[]>([]);
  const [note, setNote] = useState("");
  const [lang, setLang] = useState("hi"); const [moreLangs, setMoreLangs] = useState(false);
  const [busy, setBusy] = useState<"" | "plan" | "create">("");
  const [err, setErr] = useState(""); const [needCredits, setNeedCredits] = useState<number | null>(null); const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [acting, setActing] = useState(""); const [rowMsg, setRowMsg] = useState<Record<string, { t: string; ok: boolean }>>({});
  const nameRef = useRef<HTMLInputElement | null>(null);

  async function refresh() { const r = await fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.input?.tier === "stock")); if (typeof r.credits === "number") setCredits(r.credits); }
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/reel"); return; }
    setReady(true); refresh();
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => setProducts(r.data.products ?? [])).catch(() => {});
    // The business name, phone and trade come from the profile — nothing to type on a normal day.
    api<{ profiles?: { name: string; tagline?: string; phone?: string; is_default?: boolean; category?: string }[] }>("/api/poster/profiles").then((r) => { const p = (r.data.profiles ?? []).find((x) => x.is_default) ?? r.data.profiles?.[0]; if (p) { setBusiness((x) => x || p.name); setBrandName((x) => x || p.name); setPhone((x) => x || p.phone || ""); setCategory((x) => x || p.category || ""); } }).catch(() => {});
  })(); }, [router]);
  useEffect(() => { if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return; const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [jobs]);

  const making = jobs.some((j) => j.status === "queued" || j.status === "running");
  /** One tap: the words are written, then the reel is queued — all scenes "auto" (a free clip when one fits, else an AI picture). */
  async function make() {
    const name = products.find((p) => p.id === productId)?.name || business;
    if (name.trim().length < 2) { setErr(hi ? "पहले अपने business का नाम लिखें।" : "Write your business name first."); nameRef.current?.focus(); return; }
    setErr(""); setNeedCredits(null);
    const k = KINDS.find((x) => x.k === kind)!;
    const base = { type: kind, business: name, category: products.find((p) => p.id === productId)?.category || category, topic: kind === "offer" ? "" : note, offer: kind === "offer" ? note : "", phone, brandName, lang, length: 15, voiceStyle: "warmf", music: k.music, product_id: productId };
    try {
      setBusy("plan");
      const p = await post({ action: "plan", ...base });
      if (!p.ok) { setErr(String(p.data.error ?? "") || (p.status === 0 ? (hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.") : (hi ? "शब्द नहीं लिखे जा सके। फिर try करें।" : "Could not write the words. Please try again."))); return; }
      const plan = p.data.plan as Plan;
      setBusy("create");
      const r = await post({ action: "create", ...base, title: plan.title, scenes: plan.scenes, cta: plan.cta, caption: plan.caption });
      if (!r.ok) {
        setErr(String(r.data.error ?? "") || (r.status === 0 ? (hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.") : (hi ? "शुरू नहीं हो पाई। फिर try करें।" : "Could not start. Please try again.")));
        if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || 1));
        return;
      }
      setNote(""); refresh();
    } finally { setBusy(""); }
  }
  async function stopOrDelete(j: Job) {
    const stop = j.status === "queued" || j.status === "running";
    if (!window.confirm(stop ? (hi ? "ये reel रोक दें?" : "Stop this reel?") : (hi ? "ये reel delete कर दें? वापस नहीं आएगी।" : "Delete this reel? This cannot be undone."))) return;
    setActing(j.id + "x");
    try { const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" }); if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: { t: hi ? "नहीं हो पाया। फिर try करें।" : "Could not do that. Please try again.", ok: false } })); return; } if (stop) refresh(); else setJobs((l) => l.filter((x) => x.id !== j.id)); }
    finally { setActing(""); }
  }

  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-xl border border-border bg-surface px-3 py-3 text-[15px] outline-none focus:border-brand";
  const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const langs = LANGS.filter((l) => moreLangs || MAIN_LANGS.includes(l.key) || l.key === lang);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><button type="button" onClick={() => goBack(router, "/poster/videos")} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button><h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> {hi ? "Reel बनाएँ" : "Make a Reel"}</h1><span className="rounded-full bg-good/10 px-2.5 py-1 text-xs font-semibold text-good">FREE</span></div>
      <p className="text-sm text-muted">{hi ? "बस बताइए किस बारे में — शब्द, video, आवाज़ और music हम लगा देंगे। 15 सेकंड की reel, 2 मिनट में।" : "Just say what it is about — we write the words and add the video, voice and music. A 15-second reel in about 2 minutes."}</p>

      <div className="space-y-4 rounded-2xl border border-border p-3">
        <div>
          <p className="mb-2 text-sm font-semibold">{hi ? "1. किस बारे में?" : "1. What is it about?"}</p>
          <div className="grid grid-cols-2 gap-2">{KINDS.map((k) => <button key={k.k} type="button" onClick={() => setKind(k.k)} className={`rounded-xl border-2 p-3 text-left ${kind === k.k ? "border-brand bg-brand-soft" : "border-border"}`}><span className="block text-2xl">{k.e}</span><span className="mt-1 block text-[15px] font-semibold">{hi ? k.hi : k.en}</span><span className="block text-xs text-muted">{hi ? k.dhi : k.den}</span></button>)}</div>
        </div>
        {products.length > 0 && <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inp}><option value="">{hi ? "मेरा पूरा business" : "My business in general"}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        {!business && !productId && <input ref={nameRef} className={inp} placeholder={hi ? "Business का नाम" : "Business name"} value={business} onChange={(e) => { setBusiness(e.target.value); setBrandName(e.target.value); setErr(""); }} />}
        <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "offer" ? (hi ? "Offer लिखें — जैसे: इस हफ़्ते 20% छूट" : "Your offer — e.g. 20% off this week") : (hi ? "कुछ ख़ास कहना हो तो लिखें (ज़रूरी नहीं)" : "Anything special to say? (optional)")} />
        <div>
          <p className="mb-1.5 text-sm font-semibold">{hi ? "2. भाषा" : "2. Language"}</p>
          <div className="flex flex-wrap gap-1.5">{langs.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={chip(lang === l.key)}>{l.label}</button>)}{!moreLangs && <button type="button" onClick={() => setMoreLangs(true)} className="rounded-full border border-dashed border-border px-3.5 py-2 text-sm text-muted">{hi ? "और भाषाएँ…" : "more…"}</button>}</div>
        </div>
        {err && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
        {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); refresh(); }} />}
        {/* Above the Make button, where it is seen (owner, 27 Oct 2026: it was hidden at the foot of the page). */}
        <Link href="/poster/reel/pro" className="flex items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/40 p-3 text-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-brand"><SlidersHorizontal className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{hi ? "खुद चुनना है?" : "Want to choose yourself?"}</span><span className="block text-xs text-muted">{hi ? "Scenes, अपनी photos, आवाज़, music — Advanced" : "Scenes, your photos, voice, music — Advanced"}</span></span>
          <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-muted" />
        </Link>
        <button type="button" onClick={make} disabled={busy !== "" || making} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />} {busy === "plan" ? (hi ? "शब्द लिख रहे हैं…" : "Writing the words…") : busy === "create" ? (hi ? "शुरू कर रहे हैं…" : "Starting…") : making ? (hi ? "एक reel बन रही है…" : "A reel is being made…") : (hi ? "Reel बनाओ" : "Make my reel")}</button>
        <p className="text-center text-[11px] text-muted">{hi ? "Ready clips के साथ free · रोज़ 3 reel" : "Free with ready-made clips · 3 reels a day"}</p>
      </div>

      {jobs.length > 0 && <h2 className="pt-1 text-sm font-bold">{hi ? "आपकी reels" : "Your reels"}</h2>}
      <div className="space-y-3">{jobs.map((j, i) => (
        <div key={j.id} className="space-y-2 rounded-2xl border border-border p-3">
          <div className="flex items-start justify-between gap-2 text-sm"><b className="truncate">{j.input?.product ?? "Reel"}</b><span className={`shrink-0 text-right text-xs ${j.status === "done" ? "text-good" : j.status === "failed" ? "text-danger" : "text-brand-ink"}`}>{j.status === "done" ? (hi ? "✓ तैयार" : "✓ ready") : j.status === "failed" ? (hi ? "नहीं बनी" : "not made") : j.progress?.text || (hi ? "बन रही है…" : "Making…")}</span></div>
          {(j.status === "queued" || j.status === "running") && (<>
            {/* The lines being spoken, so the owner knows what the reel will say while it is made. */}
            {!!j.input?.scenes?.length && <p className="rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.scenes.map((s) => s.text).join(" ")}</p>}
            <p className="text-xs text-muted">{hi ? "आप ये screen बंद कर सकते हैं — reel यहीं आ जाएगी।" : "You can close this screen — the reel will appear here."}</p>
            <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="w-full rounded-lg border border-danger/60 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{hi ? "रोक दें" : "Stop"}</button>
          </>)}
          {j.status === "failed" && <p className="text-sm text-danger">{failLine(j.error, hi)}</p>}
          {j.status === "done" && j.output_url && (<>
            <video src={j.output_url} controls playsInline preload={i === 0 ? "auto" : "metadata"} className="mx-auto max-h-[60dvh] rounded-lg bg-black" />
            <div className="flex gap-2">
              <button type="button" onClick={async () => { setActing(j.id); const s = await shareFile(j.output_url!, j.input?.caption ?? "", `reel-${j.id.slice(0, 8)}.mp4`, "video/mp4"); setRowMsg((m) => ({ ...m, [j.id]: s === "failed" ? { t: hi ? "Share नहीं हुआ — Download try करें।" : "Not shared — try Download.", ok: false } : { t: s === "shared" ? (hi ? "भेज दिया" : "Sent") : (hi ? "Phone में save हो गई" : "Saved to your phone"), ok: true } })); setActing(""); }} disabled={acting === j.id} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> Share</button>
              <button type="button" onClick={async () => { setActing(j.id + "d"); const ok = await downloadPoster(j.output_url!, `reel-${j.id.slice(0, 8)}.mp4`); setRowMsg((m) => ({ ...m, [j.id]: ok ? { t: hi ? "Phone में save हो गई" : "Saved to your phone", ok: true } : { t: hi ? "Save नहीं हुई — फिर try करें" : "Could not save — try again", ok: false } })); setActing(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button>
            </div>
            {/* Make → run (owner, 27 Oct 2026): this video straight into Ads Boost, already chosen. */}
            <Link href={`/poster/ads?job=${j.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-ai/30 bg-ai-soft/40 px-3 py-2.5 text-sm font-semibold text-ai">🚀 {hi ? "Boost करें — Facebook / Instagram पर ज़्यादा लोगों तक" : "Boost — show it to more people on Facebook / Instagram"}</Link>
            {j.input?.caption && <p className="whitespace-pre-wrap rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.caption}</p>}
          </>)}
          {rowMsg[j.id] && <p className={`text-xs font-semibold ${rowMsg[j.id].ok ? "text-good" : "text-danger"}`}>{rowMsg[j.id].t}</p>}
          {j.status !== "queued" && j.status !== "running" && <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="inline-flex items-center gap-1 text-xs text-muted disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" /> {hi ? "Delete" : "Delete"}</button>}
        </div>))}</div>

    </div>
  );
}
