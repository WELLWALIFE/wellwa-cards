"use client";
// Reel Maker — royalty-free stock clips + your own images + AI voice, captions and music.
// Free when every scene finds a stock clip; AI scenes cost 1 credit each, so the badge says "Free with stock clips".
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Sparkles, Download, Share2, ImagePlus, Clapperboard, Pencil, Trash2 } from "lucide-react";
import { api, isLoggedIn, uploadImage, shareFile, downloadPoster, LANGS } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";
import { AddCredits } from "@/components/poster/add-credits";
import { VideoSteps, CostLine } from "@/components/poster/video-steps";

type Scene = { text: string; caption_text: string; search: string; image: string; search_alt?: string; text_en?: string; ai_prompt?: string; source?: "auto" | "stock" | "ai" | "image" };
type Plan = { title: string; scenes: Scene[]; cta: string; caption: string };
type Job = { id: string; status: string; output_url: string | null; error: string | null; created_at: string; cost?: number; progress?: { text?: string } | null; input?: { tier?: string; product?: string; caption?: string; duration_sec?: number; topic?: string; scenes?: Scene[]; cta?: string; lang?: string; length?: number; voiceStyle?: string; music?: string } };
// Same plain sentences as the Video ad screen — a shopkeeper must never read "TTS failed: 400" — and always the money.
// A failed render is refunded in full; a reel the owner stopped may have spent part of it, so that case promises less.
const MONEY_BACK = "Your credits have been returned.";
function failLine(raw: string | null | undefined): string {
  const e = String(raw ?? "").toLowerCase();
  if (e.includes("cancel")) return "You stopped this reel. Any credits we did not use have been returned.";
  if (/tts|voice|speech|audio/.test(e)) return `The voice could not be recorded. ${MONEY_BACK}`;
  if (/clip|stock|image|photo|veo|kling|fal|pexels/.test(e)) return `We could not get a picture for one scene. ${MONEY_BACK}`;
  if (/upload|ffmpeg|timeout|timed out|render|encode|finished/.test(e)) return `The reel could not be finished. ${MONEY_BACK}`;
  return `Something went wrong. ${MONEY_BACK}`;
}
type MyProduct = { id: string; name: string; photo_url: string | null; category?: string; photos?: { url: string; role?: string }[] };
const TYPES = [["tip", "Tip / fact", "Useful tip people save and share"], ["benefit", "Benefit", "One clear benefit of what you sell"], ["offer", "Offer", "Your offer, with urgency"], ["review", "Customer story", "A happy-customer story"], ["festival", "Festival", "Greeting that connects to your business"], ["story", "Story", "A short relatable story"]] as const;
const MUSIC = ["", "calm-ambient", "upbeat-corporate", "inspiring-motivational", "energetic-promo", "indian-sitar", "festive-diwali"];
type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
// A dropped mobile connection makes fetch() REJECT. Without this catch the await below
// never returns, setBusy("") never runs, and the button spins for ever on the one screen
// where the owner may have just been charged and cannot tell whether the reel was queued.
const post = (body: unknown): Promise<Reply> =>
  fetch("/api/media/reel-maker", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }))
    .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));
const OFFLINE = "No internet — please try again.";

export default function ReelMaker() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [f, setF] = useState({ type: "tip", business: "", category: "", topic: "", offer: "", phone: "", brandName: "", lang: "hinglish", length: 15, voiceStyle: "warmf", music: "calm-ambient", product_id: "" });
  const [gallery, setGallery] = useState<string[]>([]);
  const [products, setProducts] = useState<MyProduct[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [acting, setActing] = useState("");
  const [stopping, setStopping] = useState("");
  const [deleting, setDeleting] = useState("");
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  async function refresh() { const r = await fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})); setJobs(((r.jobs ?? []) as Job[]).filter((j) => j.input?.tier === "stock")); if (typeof r.credits === "number") setCredits(r.credits); }
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/reel"); return; }
    setReady(true); refresh();
    api<{ products?: MyProduct[] }>("/api/poster/products").then((r) => setProducts(r.data.products ?? [])).catch(() => {});
    api<{ profiles?: { name: string; tagline?: string; phone?: string; is_default?: boolean; category?: string }[] }>("/api/poster/profiles").then((r) => { const p = (r.data.profiles ?? []).find((x) => x.is_default) ?? r.data.profiles?.[0]; if (p) setF((x) => ({ ...x, business: x.business || p.tagline || p.name, brandName: x.brandName || p.tagline || p.name, phone: x.phone || p.phone || "", category: x.category || p.category || "" })); }).catch(() => {});
  })(); }, [router]);
  useEffect(() => { if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return; const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [jobs]);

  function pickProduct(id: string) { const p = products.find((x) => x.id === id); setF((x) => ({ ...x, product_id: id, business: p?.name ?? x.business, category: p?.category || x.category })); if (p) setGallery((g) => [...new Set([...(p.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url), ...(p.photo_url ? [p.photo_url] : []), ...g])].slice(0, 8)); }
  async function addImage(file: File | null) { if (!file) return; setBusy("img"); const u = await uploadImage(await compressToFile(file, "reel.jpg"), "product"); setBusy(""); if (u) setGallery((g) => [u, ...g].slice(0, 8)); else setErr("Upload failed."); }
  /** Scenes that will certainly be AI-generated (1 credit each) — the floor of what a create costs. */
  const aiScenes = () => (plan?.scenes ?? []).filter((x) => !x.image && x.source === "ai").length || 1;
  async function makePlan() {
    setBusy("plan"); setErr("");
    try {
      const r = await post({ action: "plan", ...f });
      if (!r.ok) { setErr(String(r.data.error ?? "") || (r.status === 0 ? OFFLINE : "Could not write the script.")); return; }
      setPlan(r.data.plan as Plan);
    } finally { setBusy(""); }
  }
  async function create() {
    if (!plan) return;
    setBusy("create"); setErr(""); setNeedCredits(null);
    try {
      const r = await post({ action: "create", ...f, title: plan.title, scenes: plan.scenes, cta: plan.cta, caption: plan.caption });
      if (!r.ok) {
        setErr(String(r.data.error ?? "") || (r.status === 0 ? OFFLINE : "Could not start."));
        // 402 must never be a dead end: show the packs right here, like the Video ad screen.
        if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || aiScenes()));
        return;
      }
      setPlan(null); refresh(); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } finally { setBusy(""); }
  }
  const setScene = (i: number, p: Partial<Scene>) => plan && setPlan({ ...plan, scenes: plan.scenes.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  /** A finished (or failed) reel, opened again as a script to change: every line, picture choice, voice and music
   *  come back exactly as they were, so the owner fixes one word instead of starting over. A stock reel costs
   *  nothing to make again; AI scenes are charged as usual. */
  function editJob(j: Job) {
    const inp = j.input ?? {};
    const scenes = (inp.scenes ?? []).map((x) => ({ text: x.text ?? "", caption_text: x.caption_text ?? "", search: x.search ?? "", image: x.image ?? "", search_alt: x.search_alt, text_en: x.text_en, ai_prompt: x.ai_prompt, source: x.source ?? (x.image ? "image" : "auto") }));
    if (!scenes.length) { setRowMsg((m) => ({ ...m, [j.id]: "This reel's script is not on file — write a new one above." })); return; }
    setF((x) => ({ ...x, business: inp.product || x.business, topic: inp.topic ?? x.topic, lang: inp.lang || x.lang, length: Number(inp.length) || x.length, voiceStyle: inp.voiceStyle || x.voiceStyle, music: inp.music ?? x.music }));
    setGallery((g) => [...new Set([...scenes.map((s) => s.image).filter(Boolean), ...g])].slice(0, 8));
    setPlan({ title: inp.product || "Reel", scenes, cta: inp.cta ?? "", caption: inp.caption ?? "" });
    setErr(""); setNeedCredits(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /** Gone for good — the file and the row. Confirmed, because there is no undo. */
  async function deleteJob(j: Job) {
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;
    setDeleting(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: d.error || "Could not delete it. Please try again." })); return; }
      setJobs((list) => list.filter((x) => x.id !== j.id));
    } catch { setRowMsg((m) => ({ ...m, [j.id]: OFFLINE })); }
    finally { setDeleting(""); }
  }
  // A way out on the phone: /api/media/jobs DELETE already exists — until now only the desktop Studio called it.
  async function stopJob(j: Job) {
    const cost = Number(j.cost ?? 0);
    if (!window.confirm("Stop this reel? The credits we have not used yet come back to you.")) return;
    setStopping(j.id);
    try {
      const r = await fetch(`/api/media/jobs?id=${j.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setRowMsg((m) => ({ ...m, [j.id]: d.error || "Could not stop it. Please try again." })); return; }
      // Only the server knows the real numbers; before it sends them, promise nothing exact.
      const refunded = typeof d.refunded === "number" ? d.refunded : null;
      const spent = typeof d.spent === "number" ? d.spent : refunded === null ? null : Math.max(0, cost - refunded);
      setRowMsg((m) => ({ ...m, [j.id]:
        refunded === null ? "Stopped. Any credits we did not use have been returned."
        : refunded > 0 && spent && spent > 0 ? `Stopped — ${refunded} credits returned (${spent} were already used making the reel).`
        : refunded > 0 ? "Stopped — your credits are back."
        : cost > 0 ? `Stopped — no credits came back (${spent ?? cost} were already used making the reel).`
        : "Stopped." }));
      refresh();
    } catch { setRowMsg((m) => ({ ...m, [j.id]: "Could not stop it. Please try again." })); }
    finally { setStopping(""); }
  }

  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Link href="/poster/videos" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link><h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> Reel Maker</h1>{credits !== null && <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{credits} credits</span>}<span className="rounded-full bg-good/10 px-2.5 py-1 text-xs font-semibold text-good">Free with stock clips</span></div>
      <VideoSteps step={plan ? 3 : 2} hi={false} note={plan ? "scenes, pictures, voice & music — then Make" : "what the reel is about"} />
      <p className="text-xs text-muted">Real stock video clips, your own photos, or AI-made scenes with Indian people (1 credit each) + AI voice, captions and music. Perfect for daily Reels and Stories. Want your product shown in AI-made scenes? Use <Link href="/poster/video" className="underline">Video ad</Link>.</p>

      {!plan && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div><p className="mb-1 text-xs font-semibold text-muted">What kind of reel?</p><div className="grid grid-cols-2 gap-2">{TYPES.map(([k, l, d]) => <button key={k} type="button" aria-label={l} onClick={() => setF({ ...f, type: k })} className={`rounded-xl border-2 p-2 text-left ${f.type === k ? "border-brand bg-brand-soft" : "border-border"}`}><span className="block text-sm font-semibold">{l}</span><span className="block text-[11px] leading-tight text-muted">{d}</span></button>)}</div></div>
          {products.length > 0 && <select value={f.product_id} onChange={(e) => pickProduct(e.target.value)} className={inp}><option value="">About my business in general</option>{products.map((p) => <option key={p.id} value={p.id}>About: {p.name}</option>)}</select>}
          <input className={inp} placeholder="Business or product name" value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} />
          <textarea className={inp} rows={2} placeholder="Topic (optional) — e.g. 5 signs you are not drinking enough water" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
          {f.type === "offer" && <input className={inp} placeholder="Your offer, exactly as it should be said" value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} />}
          <div><p className="mb-1 text-xs font-semibold text-muted">Language</p><div className="flex flex-wrap gap-1.5">{LANGS.map((l) => <button key={l.key} type="button" onClick={() => setF({ ...f, lang: l.key })} className={chip(f.lang === l.key)}>{l.label}</button>)}</div></div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-semibold text-muted">Length</span>{[10, 15, 20, 30].map((s) => <button key={s} type="button" onClick={() => setF({ ...f, length: s })} className={chip(f.length === s)}>{s} s</button>)}</div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="button" onClick={makePlan} disabled={busy === "plan" || f.business.trim().length < 2} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50">{busy === "plan" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Write my reel (free)</button>
        </div>
      )}

      {plan && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <input className={`${inp} font-semibold`} value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
          <div>
            <p className="mb-2 rounded-lg bg-surface2 p-2 text-[11px] text-muted"><b>Auto</b> looks for a fitting royalty-free clip for every scene. If all scenes get one, the reel is free. If not, all open scenes become AI scenes (1 credit each) so the reel keeps one look. Unused credits are returned.</p>
            <p className="mb-1 text-xs font-semibold text-muted">Your images (optional) — tap one under a scene to use it instead of a stock clip</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <label className="grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-surface2">{busy === "img" ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : <ImagePlus className="h-5 w-5 text-muted" />}<input type="file" accept="image/*" className="hidden" onChange={(e) => addImage(e.target.files?.[0] ?? null)} /></label>
              {gallery.map((u) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={u} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />)}
            </div>
          </div>
          {plan.scenes.map((s, i) => (
            <div key={i} className="space-y-1.5 rounded-xl border border-border p-2.5">
              <p className="text-xs font-semibold text-muted">Scene {i + 1}</p>
              <textarea className={inp} rows={2} value={s.text} onChange={(e) => setScene(i, { text: e.target.value })} />
              <input className={inp} value={s.caption_text} placeholder="On-screen keyword (2-5 words)" onChange={(e) => setScene(i, { caption_text: e.target.value })} />
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button type="button" onClick={() => setScene(i, { image: "", source: "auto" })} className={chip(!s.image && (s.source ?? "auto") === "auto")}>⚡ Auto (best)</button>
                <button type="button" onClick={() => setScene(i, { image: "", source: "stock" })} className={chip(!s.image && s.source === "stock")}>🎞 Stock clip</button>
                <button type="button" onClick={() => setScene(i, { image: "", source: "ai" })} className={chip(!s.image && s.source === "ai")}>✨ AI scene · 1 credit</button>
                {gallery.map((u) => <button key={u} type="button" onClick={() => setScene(i, { image: u, source: "image" })} className={`h-10 w-10 shrink-0 overflow-hidden rounded-md border-2 ${s.image === u ? "border-brand" : "border-transparent"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" className="h-full w-full object-cover" /></button>)}
              </div>
              {!s.image && s.source === "ai" && <textarea className={`${inp} text-xs`} rows={2} value={s.ai_prompt ?? ""} placeholder="Describe the picture in English, e.g. an Indian mother giving her daughter a glass of water at the breakfast table" onChange={(e) => setScene(i, { ai_prompt: e.target.value })} />}
              {!s.image && s.source !== "ai" && <input className={`${inp} text-xs`} value={s.search} placeholder="Stock video search (English), e.g. woman drinking water" onChange={(e) => setScene(i, { search: e.target.value })} />}
            </div>
          ))}
          <label className="block"><span className="text-xs font-semibold text-muted">Closing line</span><input className={inp} value={plan.cta} onChange={(e) => setPlan({ ...plan, cta: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-xs font-semibold text-muted">Voice</span><select className={inp} value={f.voiceStyle} onChange={(e) => setF({ ...f, voiceStyle: e.target.value })}><option value="warmf">Female · warm</option><option value="warm">Male · warm</option><option value="clear">Male · clear</option><option value="youthful">Female · youthful</option></select></label>
            <label className="block"><span className="text-xs font-semibold text-muted">Music</span><select className={inp} value={f.music} onChange={(e) => setF({ ...f, music: e.target.value })}>{MUSIC.map((m) => <option key={m} value={m}>{m ? m.replace(/-/g, " ") : "No music"}</option>)}</select></label>
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setErr(""); refresh(); }} />}
          {(() => { const n = plan.scenes.filter((x) => !x.image && x.source === "ai").length; const a = plan.scenes.filter((x) => !x.image && (x.source ?? "auto") === "auto").length; return <CostLine hi={false} cost={n} balance={credits} free={!n && !a} range={n || a ? `${n}${a ? `–${n + a}` : ""} credits (AI scenes only — stock clips are free)` : undefined} />; })()}
          <div className="flex gap-2"><button type="button" onClick={() => setPlan(null)} className="rounded-xl border border-border px-4 py-3 text-sm">Back</button><button type="button" onClick={create} disabled={busy === "create"} className="grad-brand inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-base font-semibold text-white disabled:opacity-60">{busy === "create" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />} {(() => { const n = plan.scenes.filter((x) => !x.image && x.source === "ai").length; const a = plan.scenes.filter((x) => !x.image && (x.source ?? "auto") === "auto").length; return n || a ? `Make my reel · ${n}${a ? `–${n + a}` : ""} credits` : "Make my reel (free)"; })()}</button></div>
        </div>
      )}

      {jobs.length > 0 && <h2 className="pt-2 text-sm font-bold">Your reels</h2>}
      <div className="space-y-3">{jobs.map((j, jobIdx) => (
        <div key={j.id} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-2 text-sm"><b className="truncate">{j.input?.product ?? "Reel"}</b><span className={`text-xs text-right shrink-0 max-w-[55%] ${j.status === "done" ? "text-good" : j.status === "failed" ? "text-danger" : "text-brand-ink"}`}>{j.status === "done" ? `✓ ready${j.input?.duration_sec ? ` · ${j.input.duration_sec} s` : ""}` : j.status === "failed" ? "not made" : j.progress?.text || "Making your reel…"}</span></div>
          {j.status === "failed" && (
            <div className="space-y-2">
              <p className="text-sm text-danger">{failLine(j.error)}</p>
              {j.error && <details className="text-[11px] text-faint"><summary>Details</summary><span className="break-words">{j.error}</span></details>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => editJob(j)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand bg-brand-soft py-2 text-sm font-semibold text-brand-ink"><Pencil className="h-4 w-4" /> Edit &amp; make again</button>
                <button type="button" onClick={() => deleteJob(j)} disabled={deleting === j.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold text-danger disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deleting === j.id ? "…" : "Delete"}</button>
              </div>
            </div>
          )}
          {(j.status === "queued" || j.status === "running") && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">You can close this screen — the reel will appear in Your reels.</p>
              <button type="button" onClick={() => stopJob(j)} disabled={stopping === j.id} className="w-full rounded-lg border border-danger/60 px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{stopping === j.id ? "Stopping…" : "Stop this reel"}</button>
            </div>
          )}
          {rowMsg[j.id] && <p className="text-xs font-semibold">{rowMsg[j.id]}</p>}
          {j.status === "done" && j.output_url && (<>
            <video src={j.output_url} controls playsInline preload={jobIdx === 0 ? "auto" : "metadata"} className="mx-auto max-h-[60dvh] rounded-lg bg-black" />
            <div className="flex gap-2"><button type="button" onClick={async () => { setActing(j.id); const s = await shareFile(j.output_url!, j.input?.caption ?? "", `reel-${j.id.slice(0, 8)}.mp4`, "video/mp4"); setRowMsg((m) => ({ ...m, [j.id]: s === "shared" ? "Sent" : s === "downloaded" ? "Saved to your phone" : "Could not share — tap Download" })); setActing(""); }} disabled={acting === j.id} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> Share</button><button type="button" onClick={async () => { setActing(j.id + "d"); const ok = await downloadPoster(j.output_url!, `reel-${j.id.slice(0, 8)}.mp4`); setRowMsg((m) => ({ ...m, [j.id]: ok ? "Saved to your phone" : "Could not save — try again" })); setActing(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" /> Download</button></div>
            {j.input?.caption && <p className="whitespace-pre-wrap rounded-lg bg-surface2 p-2 text-xs text-muted">{j.input.caption}</p>}
            {/* Change a line, a picture, the voice — and make it again; a stock reel costs nothing the second time either. */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => editJob(j)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand bg-brand-soft py-2 text-sm font-semibold text-brand-ink"><Pencil className="h-4 w-4" /> Edit &amp; make again</button>
              <button type="button" onClick={() => deleteJob(j)} disabled={deleting === j.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold text-danger disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deleting === j.id ? "…" : "Delete"}</button>
            </div>
          </>)}
        </div>))}</div>
    </div>
  );
}
