"use client";
// Reel — ADVANCED screen, the second page of /poster/reel (owner, 27 Oct 2026: "pehale page per select kiya to dobara
// selection kyo?"). The kind, product, note and language are chosen ONCE, on /poster/reel, and arrive here in the URL;
// this page writes the words at once and opens on the scenes: lines, pictures, own photos, voice, music, length.
// ?edit=<jobId> opens a finished reel's words to change and make again. The list of reels lives on /poster/reel only.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ImagePlus, Clapperboard, RotateCw, Pencil } from "lucide-react";
import { api, isLoggedIn, uploadImage, LANGS } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { REEL_KINDS } from "@/lib/reel-kinds";
import { compressToFile } from "@/lib/image-utils";
import { AddCredits } from "@/components/poster/add-credits";
import { CostLine } from "@/components/poster/video-steps";

type Scene = { text: string; caption_text: string; search: string; image: string; search_alt?: string; text_en?: string; ai_prompt?: string; source?: "auto" | "stock" | "ai" | "image" };
type Plan = { title: string; scenes: Scene[]; cta: string; caption: string };
type Job = { id: string; status: string; output_url: string | null; error: string | null; created_at: string; cost?: number; progress?: { text?: string } | null; input?: { tier?: string; product?: string; caption?: string; duration_sec?: number; topic?: string; scenes?: Scene[]; cta?: string; lang?: string; length?: number; voiceStyle?: string; music?: string } };
type MyProduct = { id: string; name: string; photo_url: string | null; category?: string; photos?: { url: string; role?: string }[] };
const MUSIC = ["", "calm-ambient", "upbeat-corporate", "inspiring-motivational", "energetic-promo", "indian-sitar", "festive-diwali"];
const MUSIC_NAMES: Record<string, [string, string]> = { "": ["कोई नहीं", "None"], "calm-ambient": ["शांत", "Calm"], "upbeat-corporate": ["खुशनुमा", "Lively"], "inspiring-motivational": ["जोश भरा", "Inspiring"], "energetic-promo": ["तेज़", "Energetic"], "indian-sitar": ["सितार", "Sitar"], "festive-diwali": ["त्योहार", "Festive"] };
const VOICES: [string, string, string][] = [["warmf", "महिला · मीठी", "Woman · warm"], ["youthful", "महिला · युवा", "Woman · young"], ["warm", "पुरुष · मीठी", "Man · warm"], ["clear", "पुरुष · साफ़", "Man · clear"]];
type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
// A dropped mobile connection makes fetch() REJECT. Without this catch the await below
// never returns, setBusy("") never runs, and the button spins for ever on the one screen
// where the owner may have just been charged and cannot tell whether the reel was queued.
const post = (body: unknown): Promise<Reply> =>
  fetch("/api/media/reel-maker", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }))
    .catch(() => ({ ok: false, status: 0, data: {} as Record<string, unknown> }));


export default function ReelMaker() {
  const router = useRouter();
  const { lang: ui } = useT(); const hi = ui !== "en";
  const OFFLINE = hi ? "Internet नहीं है — फिर try करें।" : "No internet — please try again.";
  const [ready, setReady] = useState(false);
  const [f, setF] = useState({ type: "tip", business: "", category: "", topic: "", offer: "", phone: "", brandName: "", lang: "hi", length: 15, voiceStyle: "warmf", music: "calm-ambient", product_id: "" });
  const [gallery, setGallery] = useState<string[]>([]);
  const [productName, setProductName] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState("");
  const [planErr, setPlanErr] = useState(""); const [imgErr, setImgErr] = useState(""); const [makeErr, setMakeErr] = useState("");
  const [needCredits, setNeedCredits] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [back, setBack] = useState("/poster/reel"); const [editing, setEditing] = useState(false);
  const started = useRef(false);

  async function writeWords(form: typeof f) {
    setBusy("plan"); setPlanErr("");
    try {
      const r = await post({ action: "plan", ...form });
      if (r.data.code === "daily_limit") { setPlanErr(hi ? "आज की free reels बन गईं। कल फिर बनाएँ।" : "Today's free reels are used up. Come back tomorrow."); return; }
      if (!r.ok) { setPlanErr(r.status === 0 ? OFFLINE : (hi ? "शब्द नहीं लिखे जा सके। फिर try करें।" : "Could not write the words. Please try again.")); return; }
      setMakeErr(""); setImgErr(""); setPlan(r.data.plan as Plan);
    } finally { setBusy(""); }
  }

  useEffect(() => { (async () => {
    if (started.current) return; started.current = true;
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/reel"); return; }
    const q = new URLSearchParams(window.location.search);
    const editId = q.get("edit") ?? "";
    // Nothing chosen and nothing to edit: the choices belong to the first page.
    if (!q.get("type") && !editId) { router.replace("/poster/reel"); return; }
    setBack(`/poster/reel?${q.toString()}`);
    setReady(true);
    const [pr, pp, jr] = await Promise.all([
      api<{ products?: MyProduct[] }>("/api/poster/products").catch(() => null),
      api<{ profiles?: { name: string; tagline?: string; phone?: string; is_default?: boolean; category?: string }[] }>("/api/poster/profiles").catch(() => null),
      fetch(editId ? `/api/media/jobs?id=${encodeURIComponent(editId)}` : "/api/media/jobs?kind=ad", { cache: "no-store" }).then((x) => x.json()).catch(() => ({})),
    ]);
    if (typeof jr.credits === "number") setCredits(jr.credits);
    const prof = (pp?.data.profiles ?? []).find((x) => x.is_default) ?? pp?.data.profiles?.[0];
    const prods = pr?.data.products ?? [];
    let form = { ...f, business: prof?.tagline || prof?.name || "", brandName: prof?.tagline || prof?.name || "", phone: prof?.phone || "", category: prof?.category || "" };
    if (editId) {
      const j = jr.job as Job | undefined; const inp = j?.input ?? {};
      const scenes = (inp.scenes ?? []).map((x) => ({ text: x.text ?? "", caption_text: x.caption_text ?? "", search: x.search ?? "", image: x.image ?? "", search_alt: x.search_alt, text_en: x.text_en, ai_prompt: x.ai_prompt, source: x.source ?? (x.image ? "image" : "auto") }));
      if (!scenes.length) { setPlanErr(hi ? "इस reel के शब्द save नहीं हैं। नई reel बनाइए।" : "This reel's words were not saved. Please make a new reel."); return; }
      form = { ...form, business: inp.product || form.business, topic: inp.topic ?? "", lang: inp.lang || form.lang, length: Number(inp.length) || form.length, voiceStyle: inp.voiceStyle || form.voiceStyle, music: inp.music ?? form.music };
      setF(form); setProductName(inp.product || ""); setEditing(true); setBack("/poster/reel");
      setGallery([...new Set(scenes.map((s) => s.image).filter(Boolean))].slice(0, 8));
      setPlan({ title: inp.product || "Reel", scenes, cta: inp.cta ?? "", caption: inp.caption ?? "" });
      return;
    }
    const type = REEL_KINDS.find((k) => k.k === q.get("type"))?.k ?? "tip";
    const note = q.get("note") ?? ""; const lang = LANGS.some((l) => l.key === q.get("lang")) ? q.get("lang")! : "hi";
    const prod = prods.find((x) => x.id === q.get("pid"));
    form = { ...form, type, lang, music: REEL_KINDS.find((k) => k.k === type)!.music, topic: type === "offer" ? "" : note, offer: type === "offer" ? note : "", product_id: prod?.id ?? "", business: prod?.name || form.business, category: prod?.category || form.category };
    if (prod) { setProductName(prod.name); setGallery([...new Set([...(prod.photos ?? []).filter((x) => x.role !== "context").map((x) => x.url), ...(prod.photo_url ? [prod.photo_url] : [])])].slice(0, 8)); }
    setF(form);
    if (form.business.trim().length < 2) { setPlanErr(hi ? "पहले profile में business का नाम लिखें।" : "Add your business name to your profile first."); return; }
    writeWords(form);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function addImage(file: File | null) {
    if (!file) return; setBusy("img"); setImgErr("");
    const bad = hi ? "Photo नहीं जुड़ी। फिर try करें।" : "Could not add the photo. Please try again.";
    try { const u = await uploadImage(await compressToFile(file, "reel.jpg"), "product"); if (u) setGallery((g) => [u, ...g].slice(0, 8)); else setImgErr(bad); }
    catch { setImgErr(bad); }
    finally { setBusy(""); }
  }
  const aiScenes = () => (plan?.scenes ?? []).filter((x) => !x.image && x.source === "ai").length || 1;
  async function create() {
    if (!plan) return;
    setBusy("create"); setMakeErr(""); setNeedCredits(null);
    try {
      const r = await post({ action: "create", ...f, title: plan.title, scenes: plan.scenes, cta: plan.cta, caption: plan.caption });
      if (r.data.code === "daily_limit") { setMakeErr(hi ? "आज की free reels बन गईं। कल फिर बनाएँ।" : "Today's free reels are used up. Come back tomorrow."); return; }
      if (!r.ok) {
        setMakeErr(r.status === 429 ? (hi ? "एक video पहले से बन रही है — उसके पूरा होने तक रुकिए।" : "A video is already being made — please wait for it to finish.") : r.status === 402 ? (hi ? "AI scenes के लिए credits कम हैं — credits जोड़ें या scene को Clip पर करें।" : String(r.data.error ?? "Not enough credits.")) : r.status === 0 ? OFFLINE : (hi ? "शुरू नहीं हो पाई। फिर try करें।" : "Could not start. Please try again."));
        if (r.status === 402) setNeedCredits(Math.max(1, Number(r.data.cost) || aiScenes()));
        return;
      }
      // The reel is made on the first page, where all reels are listed.
      router.push("/poster/reel?made=1");
    } finally { setBusy(""); }
  }
  const setScene = (i: number, p: Partial<Scene>) => plan && setPlan({ ...plan, scenes: plan.scenes.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  function relength(n: number) { if (n === f.length || busy) return; const form = { ...f, length: n }; setF(form); setPlan(null); writeWords(form); }

  if (!ready) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  const kind = REEL_KINDS.find((k) => k.k === f.type);
  const langName = LANGS.find((l) => l.key === f.lang)?.label ?? f.lang;
  const nAi = plan ? plan.scenes.filter((x) => !x.image && x.source === "ai").length : 0;
  const nAuto = plan ? plan.scenes.filter((x) => !x.image && (x.source ?? "auto") === "auto").length : 0;
  const range = nAi || nAuto ? `${nAi}${nAuto ? `–${nAi + nAuto}` : ""}` : "";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.push(back)} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex flex-1 items-center gap-1.5 text-lg font-bold"><Clapperboard className="h-5 w-5 text-brand" /> {hi ? "Reel — खुद बदलें" : "Reel — your way"}</h1>
        {credits !== null && <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{credits} credits</span>}
      </div>

      {/* What was chosen on the first page — shown, not asked again. */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
        <span className="text-xl">{editing ? "✏️" : kind?.e ?? "🎬"}</span>
        <span className="min-w-0 flex-1"><b className="block truncate">{editing ? `${hi ? "बदलकर फिर बनाओ" : "Change & make again"}${productName ? ` · ${productName}` : ""}` : `${kind ? (hi ? kind.hi : kind.en) : "Reel"}${productName ? ` · ${productName}` : ""}`}</b><span className="text-xs text-muted">{langName} · {f.length} {hi ? "सेकंड" : "sec"}</span></span>
        {!editing && <Link href={back} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Pencil className="h-3 w-3" /> {hi ? "बदलें" : "Change"}</Link>}
      </div>

      {!plan && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-center">
          {busy === "plan" ? <><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-brand" /><p className="text-sm font-semibold">{hi ? "शब्द लिख रहे हैं…" : "Writing the words…"}</p><p className="text-xs text-muted">{hi ? "कुछ सेकंड" : "A few seconds"}</p></>
            : planErr ? <><p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{planErr}</p><button type="button" onClick={() => writeWords(f)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"><RotateCw className="h-4 w-4" /> {hi ? "फिर कोशिश करें" : "Try again"}</button></>
            : null}
        </div>
      )}

      {plan && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">{hi ? "नाम" : "Title"}</span><input className={`${inp} font-semibold`} value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} /></label>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">{hi ? "लंबाई" : "Length"} <span className="font-normal">{hi ? "(बदलने पर शब्द फिर लिखे जाएँगे)" : "(changing it rewrites the words)"}</span></p>
            <div className="flex gap-1.5">{[10, 15, 20, 30].map((n) => <button key={n} type="button" onClick={() => relength(n)} className={chip(f.length === n)}>{n} {hi ? "सेकंड" : "s"}</button>)}</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">{hi ? "अपनी photos (चाहें तो) — किसी scene में लगाने के लिए" : "Your photos (optional) — to use in a scene"}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <label className="grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-surface2">{busy === "img" ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : <ImagePlus className="h-5 w-5 text-muted" />}<input type="file" accept="image/*" className="hidden" onChange={(e) => addImage(e.target.files?.[0] ?? null)} /></label>
              {gallery.map((u) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={u} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />)}
            </div>
            {imgErr && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{imgErr}</p>}
          </div>
          {plan.scenes.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-xs font-bold text-brand-ink">Scene {i + 1}</p>
              <label className="block"><span className="mb-0.5 block text-[11px] text-muted">{hi ? "बोलने वाली line" : "Spoken line"}</span><textarea className={inp} rows={2} value={s.text} onChange={(e) => setScene(i, { text: e.target.value })} /></label>
              <label className="block"><span className="mb-0.5 block text-[11px] text-muted">{hi ? "Screen पर (2-5 शब्द)" : "On screen (2-5 words)"}</span><input className={inp} value={s.caption_text} onChange={(e) => setScene(i, { caption_text: e.target.value })} /></label>
              <div>
                <span className="mb-1 block text-[11px] text-muted">{hi ? "Picture" : "Picture"}</span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button type="button" onClick={() => setScene(i, { image: "", source: "auto" })} className={chip(!s.image && (s.source ?? "auto") === "auto")}>⚡ {hi ? "अपने-आप" : "Auto"}</button>
                  <button type="button" onClick={() => setScene(i, { image: "", source: "stock" })} className={chip(!s.image && s.source === "stock")}>🎞 Clip · free</button>
                  <button type="button" onClick={() => setScene(i, { image: "", source: "ai" })} className={chip(!s.image && s.source === "ai")}>✨ AI · 1 credit</button>
                  {gallery.map((u) => <button key={u} type="button" onClick={() => setScene(i, { image: u, source: "image" })} className={`h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 ${s.image === u ? "border-brand" : "border-transparent"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" className="h-full w-full object-cover" /></button>)}
                </div>
              </div>
              {!s.image && s.source === "ai" && <textarea className={`${inp} text-xs`} rows={2} value={s.ai_prompt ?? ""} placeholder={hi ? "Picture कैसी हो (English में) — जैसे: an Indian mother giving water to her child" : "Describe the picture, e.g. an Indian mother giving water to her child"} onChange={(e) => setScene(i, { ai_prompt: e.target.value })} />}
              {!s.image && s.source === "stock" && <input className={`${inp} text-xs`} value={s.search} placeholder={hi ? "Clip ढूँढने के शब्द (English) — जैसे: woman drinking water" : "Words to find a clip, e.g. woman drinking water"} onChange={(e) => setScene(i, { search: e.target.value })} />}
            </div>
          ))}
          <p className="rounded-lg bg-surface2 p-2 text-[11px] text-muted">{hi ? "⚡ अपने-आप: free clip मिले तो free; न मिले तो AI picture (1 credit)। बचे credits वापस।" : "⚡ Auto: a free clip when one fits, else an AI picture (1 credit). Unused credits come back."}</p>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">{hi ? "आख़िरी line (call / WhatsApp)" : "Closing line (call / WhatsApp)"}</span><input className={inp} value={plan.cta} onChange={(e) => setPlan({ ...plan, cta: e.target.value })} /></label>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">{hi ? "आवाज़" : "Voice"}</p>
            <div className="flex flex-wrap gap-1.5">{VOICES.map(([k, h, e]) => <button key={k} type="button" onClick={() => setF({ ...f, voiceStyle: k })} className={chip(f.voiceStyle === k)}>{hi ? h : e}</button>)}</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">Music</p>
            <div className="flex flex-wrap gap-1.5">{MUSIC.map((m) => <button key={m || "none"} type="button" onClick={() => setF({ ...f, music: m })} className={chip(f.music === m)}>{(MUSIC_NAMES[m] ?? [m, m])[hi ? 0 : 1]}</button>)}</div>
          </div>
          {makeErr && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{makeErr}</p>}
          {needCredits !== null && <AddCredits need={needCredits} have={credits ?? 0} onDone={() => { setNeedCredits(null); setMakeErr(""); }} />}
          <CostLine hi={hi} cost={nAi} balance={credits} free={!range} range={range ? `${range} credits` : undefined} />
          <button type="button" onClick={create} disabled={busy !== ""} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-sm disabled:opacity-60">{busy === "create" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />} {hi ? "Reel बनाओ" : "Make my reel"}{range ? ` · ${range} credits` : hi ? " · free" : " · free"}</button>
        </div>
      )}
    </div>
  );
}
