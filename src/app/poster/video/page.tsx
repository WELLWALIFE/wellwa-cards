"use client";
// Video ad — the one-tap screen (owner, 20 Oct 2026: "bilkul simple, jo koi bhi bana sake"). Pick the product, tap Make.
// The AI writes the words; the ad is 10 seconds, Reel size, template look, warm voice, the product's own photo — nothing
// to choose. ONE price is shown before the tap, charged once (idem) and refunded on failure. Every choice the old
// screen offered (length, style, voice, music, realistic AI scenes, presenter, testimonial) lives on at /poster/video/pro.
import { AiPageGate } from "@/lib/ai-access";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Download, Share2, Clapperboard, Trash2, SlidersHorizontal, Coins } from "lucide-react";
import { api, isLoggedIn, shareFile, downloadPoster, LANGS } from "@/lib/poster-client";
import { AddCredits } from "@/components/poster/add-credits";
import { goBack } from "@/lib/nav-back";
import { useT } from "@/lib/poster-i18n";
import { adCredits } from "@/lib/media/ad-pricing";

type Scene = { text: string; caption_text: string; visual: string; motion: string };
type Plan = { headline: string; scenes: Scene[]; cta: string; caption: string; features: string[]; voice?: string; music?: string; template?: string };
type Job = { id: string; kind: string; status: string; output_url: string | null; error: string | null; created_at: string; cost?: number; progress?: { text?: string } | null; input?: { tier?: string; product?: string; caption?: string; outputs?: Record<string, string>; script?: string[] } };
type MyProduct = { id: string; name: string; photo_url: string | null; category?: string; offer?: string };
type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
const LENGTH = 10;
const MAIN_LANGS = ["hi", "hinglish", "en"];
const TEMPLATES = ["bold", "clean", "festive", "offer", "trust", "fresh"];
// A dropped mobile connection makes fetch() reject; without the catch the button would spin for ever.
const post = (url: string, body: unknown): Promise<Reply> =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }))
    .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));

function failLine(raw: string | null | undefined, hi: boolean): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return hi ? "आपने ये video रोक दी। जो credits इस्तेमाल नहीं हुए, वापस आ गए।" : "You stopped this video. Any credits we did not use have been returned.";
  const back = hi ? "Credits वापस आ गए।" : "Your credits have been returned.";
  if (/tts|voice|speech|audio/.test(e)) return `${hi ? "आवाज़ record नहीं हो पाई।" : "The voice could not be recorded."} ${back}`;
  if (/clip|stock|image|photo|veo|kling|fal|pexels|storyboard/.test(e)) return `${hi ? "एक scene की picture नहीं मिली।" : "We could not get a picture for one scene."} ${back}`;
  return `${hi ? "Video बन नहीं पाई।" : "The video could not be finished."} ${back}`;
}

function VideoAdInner() {
  const router = useRouter();
  const { lang: ui } = useT(); const hi = ui !== "en";
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<MyProduct[]>([]); const [productId, setProductId] = useState("");
  const [product, setProduct] = useState(""); const [category, setCategory] = useState(""); const [phone, setPhone] = useState(""); const [brandName, setBrandName] = useState(""); const [logoUrl, setLogoUrl] = useState("");
  const [offer, setOffer] = useState("");
  const [lang, setLang] = useState("hi"); const [moreLangs, setMoreLangs] = useState(false);
  const [busy, setBusy] = useState<"" | "plan" | "create">("");
  const [err, setErr] = useState(""); const [needCredits, setNeedCredits] = useState<number | null>(null); const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [acting, setActing] = useState(""); const [rowMsg, setRowMsg] = useState<Record<string, { t: string; ok: boolean }>>({});
  const nameRef = useRef<HTMLInputElement | null>(null);
  const idem = useRef(""); // the same tap retried (bad network, double tap) must never become a second paid render
  const cost = adCredits(LENGTH);

  async function refresh() { const r = await fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.kind === "ad" && j.input?.tier !== "stock")); if (typeof r.credits === "number") setCredits(r.credits); }
  useEffect(() => { (async () => {
    // Links that mean the full screen (buy credits, a video from a review, photos sent from the photoshoot) keep working there.
    let seeded = false; try { seeded = !!sessionStorage.getItem("akp-ad-seed"); } catch {}
    const search = new URLSearchParams(window.location.search);
    if (search.get("credits") || search.get("testimonial") || seeded) { const q = search.toString(); router.replace(`/poster/video/pro${q ? `?${q}` : ""}`); return; }
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/video"); return; }
    setReady(true); refresh();
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => { const l = r.data.products ?? []; setProducts(l); if (l.length === 1) setProductId(l[0].id); }).catch(() => {});
    // The business name, phone and logo come from the profile — nothing to type on a normal day.
    api<{ profiles?: { name: string; tagline?: string; phone?: string; logo_url?: string; is_default?: boolean; category?: string }[] }>("/api/poster/profiles").then((r) => { const p = (r.data.profiles ?? []).find((x) => x.is_default) ?? r.data.profiles?.[0]; if (p) { setBrandName((x) => x || p.name); setPhone((x) => x || p.phone || ""); setLogoUrl((x) => x || p.logo_url || ""); setCategory((x) => x || p.category || ""); } }).catch(() => {});
  })(); }, [router]);
  useEffect(() => { if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return; const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [jobs]);

  const making = jobs.some((j) => j.status === "queued" || j.status === "running");
  const chosen = products.find((p) => p.id === productId);
  const name = (chosen?.name || product).trim();

  /** One tap: the words are written, then the ad is queued. 10 s, Reel size, template look, the product's own photo. */
  async function make() {
    if (name.length < 2) { setErr(hi ? "पहले product का नाम लिखें।" : "Write the product name first."); nameRef.current?.focus(); return; }
    if (!window.confirm(hi ? `ये product video बनाएँ? ${LENGTH} सेकंड · ${cost} credits.` : `Make this video ad? ${LENGTH} seconds · ${cost} credits.`)) return;
    setErr(""); setNeedCredits(null);
    const base = { product: name, category: chosen?.category || category, goal: "leads", audience: "", lang, length: LENGTH, tone: "warm", offer: offer || chosen?.offer || "", phone, brandName, website: "", notes: "", tier: "template", formats: ["reel"], product_id: productId || undefined };
    try {
      setBusy("plan");
      const p = await post("/api/media/ad-plan", { ...base, features: [] });
      if (!p.ok) { setErr(String(p.data.error ?? "") || (p.status === 0 ? (hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.") : (hi ? "शब्द नहीं लिखे जा सके। फिर try करें।" : "Could not write the words. Please try again."))); return; }
      const plan = p.data.plan as Plan;
      if (!idem.current) { try { idem.current = crypto.randomUUID(); } catch { idem.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`; } }
      setBusy("create");
      const r = await post("/api/media/ad", { ...base, idem: idem.current, photos: chosen?.photo_url ? [chosen.photo_url] : [], logoUrl, headline: plan.headline, features: (plan.features ?? []).slice(0, 4), script: [...plan.scenes.map((s) => s.text), plan.cta], scenes: plan.scenes, cta: plan.cta, caption: plan.caption, voice: true, voiceStyle: plan.voice === "female" ? "warmf" : "warm", template: plan.template && TEMPLATES.includes(plan.template) ? plan.template : "bold", music: plan.music || "", captions: "words", variants: 1 });
      if (!r.ok) {
        setErr(String(r.data.error ?? "") || (r.status === 0 ? (hi ? "Server तक नहीं पहुँचे। Internet देखकर दोबारा दबाएँ — दो बार पैसे नहीं कटेंगे।" : "We could not reach the server. Check your internet and tap again — you will not be charged twice.") : (hi ? "Video शुरू नहीं हो पाई। फिर try करें।" : "Could not start the video. Please try again.")));
        if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || cost));
        return;
      }
      idem.current = ""; setOffer(""); refresh();
    } finally { setBusy(""); }
  }
  async function stopOrDelete(j: Job) {
    const stop = j.status === "queued" || j.status === "running";
    if (!window.confirm(stop ? (hi ? "ये video रोक दें? जो credits इस्तेमाल नहीं हुए, वापस आ जाएँगे।" : "Stop this video? Unused credits come back.") : (hi ? "ये video delete कर दें? वापस नहीं आएगी।" : "Delete this video? This cannot be undone."))) return;
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
      <div className="flex items-center gap-2"><button type="button" onClick={() => goBack(router, "/poster/videos")} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button><h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> {hi ? "Product video बनाएँ" : "Make a Product video"}</h1>{credits !== null && <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold"><Coins className="h-3.5 w-3.5 text-brand" /> {credits}</span>}</div>
      <p className="text-sm text-muted">{hi ? `बस product चुनें — शब्द, आवाज़, music और आपके product की photo के साथ ${LENGTH} सेकंड का video हम बना देंगे।` : `Just pick the product — we write the words and make a ${LENGTH}-second ad with voice, music and your product photo.`}</p>

      <div className="space-y-4 rounded-2xl border border-border p-3">
        <div>
          <p className="mb-2 text-sm font-semibold">{hi ? "1. किस product का video?" : "1. Which product?"}</p>
          {products.length > 0 ? (
            <div className="space-y-2">
              <select value={productId} onChange={(e) => { setProductId(e.target.value); setErr(""); }} className={inp}><option value="">{hi ? "Product चुनें…" : "Choose a product…"}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              {chosen?.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chosen.photo_url} alt={chosen.name} className="h-24 w-24 rounded-xl border border-border object-cover" />
              )}
              {!productId && <input ref={nameRef} className={inp} placeholder={hi ? "…या नाम लिखें" : "…or type a name"} value={product} onChange={(e) => { setProduct(e.target.value); setErr(""); }} />}
            </div>
          ) : (
            <input ref={nameRef} className={inp} placeholder={hi ? "Product या service का नाम" : "Product or service name"} value={product} onChange={(e) => { setProduct(e.target.value); setErr(""); }} />
          )}
          {products.length === 0 && <p className="mt-1.5 text-xs text-muted">{hi ? <>Video में product की photo चाहिए? पहले <Link href="/poster/products" className="underline">Products</Link> में product जोड़ें।</> : <>Want your photo in the ad? Add the product under <Link href="/poster/products" className="underline">Products</Link> first.</>}</p>}
        </div>
        <input className={inp} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={hi ? "Offer हो तो लिखें — जैसे: इस हफ़्ते 20% छूट (ज़रूरी नहीं)" : "An offer, if any — e.g. 20% off this week (optional)"} />
        <div>
          <p className="mb-1.5 text-sm font-semibold">{hi ? "2. भाषा" : "2. Language"}</p>
          <div className="flex flex-wrap gap-1.5">{langs.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={chip(lang === l.key)}>{l.label}</button>)}{!moreLangs && <button type="button" onClick={() => setMoreLangs(true)} className="rounded-full border border-dashed border-border px-3.5 py-2 text-sm text-muted">{hi ? "और भाषाएँ…" : "more…"}</button>}</div>
        </div>
        {err && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
        {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); refresh(); }} />}
        {/* Above the Make button, where it is seen (owner, 27 Oct 2026: it was hidden at the foot of the page). */}
        <Link href="/poster/video/pro" className="flex items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/40 p-3 text-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-brand"><SlidersHorizontal className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{hi ? "खुद चुनना है?" : "Want to choose yourself?"}</span><span className="block text-xs text-muted">{hi ? "लंबाई, style, आवाज़, music, असली जैसे AI scenes, presenter — Advanced" : "Length, style, voice, music, realistic AI scenes, presenter — Advanced"}</span></span>
          <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-muted" />
        </Link>
        <button type="button" onClick={make} disabled={busy !== "" || making} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />} {busy === "plan" ? (hi ? "शब्द लिख रहे हैं…" : "Writing the words…") : busy === "create" ? (hi ? "शुरू कर रहे हैं…" : "Starting…") : making ? (hi ? "एक video बन रही है…" : "A video is being made…") : (hi ? `Product video बनाओ · ${cost} credits` : `Make my ad · ${cost} credits`)}</button>
        <p className="text-center text-[11px] text-muted">{hi ? `${LENGTH} सेकंड · Reel size · 2–5 मिनट · न बने तो पूरे credits वापस` : `${LENGTH} seconds · Reel size · 2–5 minutes · a failure is refunded in full`}</p>
      </div>

      {jobs.length > 0 && <h2 className="pt-1 text-sm font-bold">{hi ? "आपकी videos" : "Your videos"}</h2>}
      <div className="space-y-3">{jobs.map((j, i) => { const url = j.input?.outputs?.reel ?? j.output_url ?? ""; return (
        <div key={j.id} className="space-y-2 rounded-2xl border border-border p-3">
          <div className="flex items-start justify-between gap-2 text-sm"><b className="truncate">{j.input?.product ?? "Product video"}</b><span className={`shrink-0 text-right text-xs ${j.status === "done" ? "text-good" : j.status === "failed" ? "text-danger" : "text-brand-ink"}`}>{j.status === "done" ? (hi ? "✓ तैयार" : "✓ ready") : j.status === "failed" ? (hi ? "नहीं बनी" : "not made") : j.progress?.text || (hi ? "बन रही है…" : "Making…")}</span></div>
          {(j.status === "queued" || j.status === "running") && (<>
            {!!j.input?.script?.length && <p className="rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.script.join(" ")}</p>}
            <p className="text-xs text-muted">{hi ? "आप ये screen बंद कर सकते हैं — video यहीं आ जाएगी।" : "You can close this screen — the video will appear here."}</p>
            <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="w-full rounded-lg border border-danger/60 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{hi ? "रोक दें" : "Stop"}</button>
          </>)}
          {j.status === "failed" && <p className="text-sm text-danger">{failLine(j.error, hi)}</p>}
          {j.status === "done" && url && (<>
            <video src={url} controls playsInline preload={i === 0 ? "auto" : "metadata"} className="mx-auto max-h-[60dvh] rounded-lg bg-black" />
            <div className="flex gap-2">
              <button type="button" onClick={async () => { setActing(j.id); const s = await shareFile(url, j.input?.caption ?? "", `ad-${j.id.slice(0, 8)}.mp4`, "video/mp4"); setRowMsg((m) => ({ ...m, [j.id]: s === "failed" ? { t: hi ? "Share नहीं हुआ — Download try करें।" : "Not shared — try Download.", ok: false } : { t: s === "shared" ? (hi ? "भेज दिया" : "Sent") : (hi ? "Phone में save हो गई" : "Saved to your phone"), ok: true } })); setActing(""); }} disabled={acting === j.id} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> Share</button>
              <button type="button" onClick={async () => { setActing(j.id + "d"); const ok = await downloadPoster(url, `ad-${j.id.slice(0, 8)}.mp4`); setRowMsg((m) => ({ ...m, [j.id]: ok ? { t: hi ? "Phone में save हो गई" : "Saved to your phone", ok: true } : { t: hi ? "Save नहीं हुई — फिर try करें" : "Could not save — try again", ok: false } })); setActing(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button>
            </div>
            {/* Make → run (owner, 27 Oct 2026): this video straight into Ads Boost, already chosen. */}
            <Link href={`/poster/ads?job=${j.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-ai/30 bg-ai-soft/40 px-3 py-2.5 text-sm font-semibold text-ai">🚀 {hi ? "Boost करें — Facebook / Instagram पर ज़्यादा लोगों तक" : "Boost — show it to more people on Facebook / Instagram"}</Link>
            {j.input?.caption && <p className="whitespace-pre-wrap rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.caption}</p>}
          </>)}
          {rowMsg[j.id] && <p className={`text-xs font-semibold ${rowMsg[j.id].ok ? "text-good" : "text-danger"}`}>{rowMsg[j.id].t}</p>}
          {j.status !== "queued" && j.status !== "running" && <button type="button" onClick={() => stopOrDelete(j)} disabled={acting === j.id + "x"} className="inline-flex items-center gap-1 text-xs text-muted disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
        </div>); })}</div>

    </div>
  );
}

export default function VideoAd() {
  return <AiPageGate title="Product video" reason="Turn your product into a ready video ad with AI voice and music."><VideoAdInner /></AiPageGate>;
}
