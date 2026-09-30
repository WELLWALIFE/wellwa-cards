"use client";

// Studio — banner & reel maker with credits.
// Banners render instantly; reels queue to the media worker and this page
// polls until they're done.

import { AiPageGate } from "@/lib/ai-access";
import { useCallback, useEffect, useState } from "react";
import { Check, Clapperboard, Coins, Download, Image as ImageIcon, Loader2, Pencil, Play, Plus, Sparkles, Video, Volume2, Wand2, X } from "lucide-react";
import { VOICE_OPTIONS } from "@/lib/media/voices";

type Job = { id: string; kind: string; status: string; output_url: string | null; cost: number; error: string | null; created_at: string; input?: { script?: string; tier?: string; voiceStyle?: string; brandName?: string; website?: string; scenes?: Scene[] } };
type ScriptOption = { style: string; hook: string; script: string; headline: string; caption: string };
type PlanScene = { beat: string; visual: string };
type ReelPlan = { script: string; headline: string; caption: string; voice: string; scenes: PlanScene[] };
type Scene = { i: number; kind: string; url: string; line: string };

const STYLE_LABEL: Record<string, string> = {
  problem: "Start with the problem",
  story: "Story style",
  offer: "Offer first",
};

const STYLES = [
  { key: "emerald", label: "Emerald", sw: "linear-gradient(135deg,#052a2e,#0e9e90)" },
  { key: "aqua", label: "Aqua", sw: "linear-gradient(135deg,#042c3e,#18a89e)" },
  { key: "sunrise", label: "Sunrise", sw: "linear-gradient(135deg,#1c1642,#f7b858)" },
  { key: "festive", label: "Festive", sw: "linear-gradient(135deg,#1a0a30,#963c28)" },
  { key: "midnight", label: "Midnight", sw: "linear-gradient(135deg,#0a0c22,#5a326e)" },
];

const PURPOSE_OPTIONS = [
  { key: "product", label: "Sell a product" },
  { key: "intro", label: "Introduce me or my brand" },
  { key: "offer", label: "Offer or free demo" },
  { key: "educate", label: "Teach or explain something" },
  { key: "story", label: "A short story" },
  { key: "business", label: "Business opportunity" },
];

const TIERS = [
  { key: "photos", label: "Simple — AI Photos ⭐", cost: 60, desc: "An AI photo with motion for every line" },
  { key: "stock", label: "Stock Video", cost: 30, desc: "Real HD video clips with voiceover" },
  { key: "veo", label: "Veo — Real AI Video 🎬", cost: 400, desc: "Two real AI video scenes made with Google Veo, our most premium option" },
  { key: "avatar", label: "Avatar", cost: 150, desc: "Your photo speaks in the video (coming soon)" },
];

function StudioPageInner() {
  const [tab, setTab] = useState<"banner" | "reel">("banner");
  const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");   // a plain outcome line (e.g. what a Stop actually refunded) — not an error
  const [bannerUrl, setBannerUrl] = useState("");

  // banner form
  const [headline, setHeadline] = useState("");
  const [subline, setSubline] = useState("");
  const [badge, setBadge] = useState("");
  const [style, setStyle] = useState("emerald");
  const [aiBg, setAiBg] = useState(true);
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");

  // reel form
  const [script, setScript] = useState("");
  const [tier, setTier] = useState("photos");
  const [voice, setVoice] = useState(true);
  const [idea, setIdea] = useState("");
  const [options, setOptions] = useState<ScriptOption[]>([]);
  const [writing, setWriting] = useState(false);
  const [picked, setPicked] = useState(-1);
  const [caption, setCaption] = useState("");
  const [voiceStyle, setVoiceStyle] = useState("warm");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("male");
  const [playing, setPlaying] = useState("");
  const [remixJob, setRemixJob] = useState<Job | null>(null);
  const [remixSel, setRemixSel] = useState<Record<number, string>>({});
  const [magicText, setMagicText] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [refs, setRefs] = useState<string[]>([]);   // data URLs, uploaded on submit
  const [refBusy, setRefBusy] = useState(false);
  const [guidance, setGuidance] = useState("");     // owner's direction for the AI
  // AI Director: plan first, spend credits only after the owner approves it
  const [purpose, setPurpose] = useState("product");
  const [audience, setAudience] = useState("");
  const [planSite, setPlanSite] = useState("");
  const [plan, setPlan] = useState<ReelPlan | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState("");

  // Editing a video-tier reel re-renders a real generated clip, so it costs
  // more than swapping a still.
  const remixCost = remixJob?.input?.tier === "veo" ? 220
    : remixJob?.input?.tier === "kling" ? 70
    : 15;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/media/jobs");
      if (!r.ok) return;
      const d = await r.json();
      setCredits(d.credits);
      setJobs(d.jobs);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [hasActive, refresh]);

  async function makeBanner() {
    setBusy(true); setErr(""); setBannerUrl("");
    try {
      const r = await fetch("/api/media/banner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, subline, badge, style, brandName, website, aiBg }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setBannerUrl(d.url);
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }

  async function makePlan() {
    setWriting(true); setErr("");
    try {
      const r = await fetch("/api/media/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, purpose, audience, website: planSite, answers, sceneCount: 4 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setQuestions(d.questions ?? []);
      if (d.scenes?.length) {
        setPlan({ script: d.script, headline: d.headline, caption: d.caption, voice: d.voice, scenes: d.scenes });
        // Prefill the render form so "Banao" is the only step left.
        setScript(d.script || "");
        setCaption(d.caption || "");
        // Suggest the owner's own business name — never leave this blank, or
        // the render falls back to our SaaS name on THEIR paid video.
        if (d.brandName && !brandName) setBrandName(d.brandName);
        if (d.voice) {
          const g = VOICE_OPTIONS.female.some((v) => v.key === d.voice) ? "female" : "male";
          setVoiceGender(g); setVoiceStyle(d.voice);
        }
        setAnswers("");
      } else {
        setPlan(null);   // AI needs answers before it can plan properly
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setWriting(false);
  }

  function useOption(o: ScriptOption, i: number) {
    setScript(o.script);
    setCaption(o.caption ?? "");
    setPicked(i);
  }

  function playVoice(k: string) {
    try {
      const w = window as unknown as { __voiceEl?: HTMLAudioElement };
      w.__voiceEl?.pause();
      const a = new Audio(`/voices/${k}.mp3`);
      w.__voiceEl = a;
      setPlaying(k);
      a.onended = () => setPlaying("");
      a.play().catch(() => setPlaying(""));
    } catch { /* no audio */ }
  }

  // Same promise as the phone's Stop button: a render that has already bought its clips
  // refunds only the unspent share, so this must not say "your credits will be returned".
  async function cancelJob(id: string) {
    if (!confirm("Stop this job? The credits we have not used yet come back to you.")) return;
    setNote("");
    try {
      const r = await fetch(`/api/media/jobs?id=${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "failed");
      const refunded = typeof d.refunded === "number" ? d.refunded : null;
      const spent = typeof d.spent === "number" ? d.spent : null;
      setNote(
        refunded === null ? "Stopped. Any credits we did not use have been returned."
        : refunded > 0 && spent ? `Stopped — ${refunded} credits returned (${spent} were already used making it).`
        : refunded > 0 ? "Stopped — your credits are back."
        : spent ? `Stopped — no credits came back (${spent} were already used making it).`
        : "Stopped.",
      );
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not stop it. Please try again."); }
  }

  function editJob(j: Job) {
    setRemixJob(j.input?.scenes?.length ? j : null);
    setRemixSel({});
    setMagicText("");
    const i = j.input ?? {};
    if (i.script) setScript(i.script);
    if (i.tier) setTier(i.tier);
    if (i.voiceStyle) setVoiceStyle(i.voiceStyle);
    if (i.brandName) setBrandName(i.brandName);
    if (i.website) setWebsite(i.website);
    setTab("reel");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendMagicEdit() {
    if (!remixJob || magicText.trim().length < 3) return;
    setMagicBusy(true); setErr("");
    try {
      const r = await fetch("/api/media/magic-edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: remixJob.id, request: magicText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setRemixSel((m) => ({ ...m, ...d.changes }));
      setMagicText("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not understand that. Please try again."); }
    setMagicBusy(false);
  }

  async function sendRemix() {
    if (!remixJob) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/media/reel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remixOf: remixJob.id, changes: remixSel }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setRemixJob(null); setRemixSel({});
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }

  async function makeReel() {
    setBusy(true); setErr("");
    try {
      // Reference photos live as data URLs until submit — the worker can only
      // fetch from our own storage, so host them first.
      let refImages: string[] = [];
      if (refs.length) {
        const { uploadStudioRef } = await import("@/lib/cloud");
        const up = await Promise.all(refs.map((d, i) => uploadStudioRef(d, i)));
        refImages = up.filter((u): u is string => Boolean(u));
        if (refs.length && !refImages.length) throw new Error("The reference photo could not be uploaded.");
      }
      const r = await fetch("/api/media/reel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script, tier, voice, voiceStyle, brandName, website, refImages, guidance,
          headline: plan?.headline || "",
          scenePlan: plan?.scenes ?? [],   // owner-approved shot list, rendered as-is
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }

  const tierInfo = TIERS.find((t) => t.key === tier)!;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Clapperboard className="h-6 w-6 text-ai" /> Studio
          </h1>
          <p className="text-muted mt-1">Banners and reels for WhatsApp, Instagram and ads — made in minutes.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 font-semibold">
          <Coins className="h-4 w-4 text-amber-500" /> {credits ?? "…"} credits
        </span>
      </div>

      <div className="flex gap-2">
        {([["banner", "Banner", ImageIcon], ["reel", "Reel", Video]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border ${tab === k ? "grad-brand text-white border-transparent" : "border-border bg-surface hover:bg-surface2"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "banner" && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Headline *</span>
              <input className="ed-input mt-1 w-full" maxLength={80} value={headline} placeholder="Free consultation" onChange={(e) => setHeadline(e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Subline</span>
              <input className="ed-input mt-1 w-full" maxLength={110} value={subline} placeholder="Free home demo this week" onChange={(e) => setSubline(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Badge (small tag)</span>
              <input className="ed-input mt-1 w-full" maxLength={24} value={badge} placeholder="FREE DEMO" onChange={(e) => setBadge(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Brand name</span>
              <input className="ed-input mt-1 w-full" maxLength={40} value={brandName} placeholder="Your brand" onChange={(e) => setBrandName(e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Website line</span>
              <input className="ed-input mt-1 w-full" maxLength={60} value={website} placeholder="yourbusiness.com" onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          <div>
            <span className="text-sm font-medium">Style</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s.key} onClick={() => setStyle(s.key)}
                  className={`h-10 w-16 rounded-lg border-2 ${style === s.key ? "border-brand" : "border-transparent"}`}
                  style={{ background: s.sw }} title={s.label} />
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2.5 rounded-xl border border-ai/30 bg-ai/5 p-3 cursor-pointer">
            <input type="checkbox" checked={aiBg} onChange={(e) => setAiBg(e.target.checked)} className="h-4 w-4 mt-0.5" />
            <span>
              <span className="text-sm font-semibold flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5 text-ai" /> AI photo background</span>
              <span className="block text-xs text-muted mt-0.5">A realistic photo made from your headline, instead of a plain gradient</span>
            </span>
          </label>
          <button onClick={makeBanner} disabled={busy || headline.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create banner — {aiBg ? 12 : 5} credits
          </button>
          {bannerUrl && (
            <div className="rounded-xl border border-border bg-bg p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerUrl} alt="banner" className="w-full max-w-sm rounded-lg mx-auto" />
              <a href={bannerUrl} download target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink"><Download className="h-4 w-4" /> Download</a>
            </div>
          )}
        </section>
      )}

      {tab === "reel" && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
          <div className="rounded-xl border border-ai/30 bg-ai/5 p-4">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Wand2 className="h-4 w-4 text-ai" /> AI Director — pehle plan, phir video</p>
            <p className="text-xs text-muted mt-1">AI reads the real products and prices on your card and writes a shot-by-shot plan. Change anything you like; credits are used only when you press &quot;Create&quot;. Planning is free.</p>

            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-muted">What the video is for</span>
                <select className="ed-input mt-1 w-full !text-[13px]" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  {PURPOSE_OPTIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">Kiske liye? (optional)</span>
                <input className="ed-input mt-1 w-full !text-[13px]" maxLength={200} value={audience}
                  placeholder="For example: parents aged 30 to 50 in my city"
                  onChange={(e) => setAudience(e.target.value)} />
              </label>
            </div>

            <label className="block mt-2">
              <span className="text-xs font-medium text-muted">Website (optional) — AI khud padh lega</span>
              <input className="ed-input mt-1 w-full !text-[13px]" maxLength={120} value={planSite}
                placeholder="yourbusiness.com" onChange={(e) => setPlanSite(e.target.value)} />
            </label>

            <textarea className="ed-input mt-2 w-full min-h-16 resize-y" maxLength={600} value={idea}
              placeholder="Your idea, for example: sell our water purifier, we give a free home demo"
              onChange={(e) => setIdea(e.target.value)} />

            <button onClick={makePlan} disabled={writing || (idea.trim().length < 3 && !answers.trim())}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-ai px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {plan ? "Make a new plan" : "Make a plan (free)"}
            </button>

            {/* The AI asks back only when guessing would spoil the film */}
            {questions.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold">The AI needs to know:</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted list-disc pl-4">
                  {questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
                <textarea className="ed-input mt-2 w-full min-h-14 resize-y !text-[13px]" maxLength={800} value={answers}
                  placeholder="Write your answers here…" onChange={(e) => setAnswers(e.target.value)} />
                <button onClick={makePlan} disabled={writing || answers.trim().length < 2}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Make the plan with these answers
                </button>
              </div>
            )}

            {plan && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-brand-ink" /> Plan ready. You can change any scene.
                </p>
                {plan.scenes.map((s, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-[11px] mono uppercase tracking-wide text-faint">Scene {i + 1}</p>
                    <p className="mt-0.5 text-sm">&ldquo;{s.beat}&rdquo;</p>
                    <textarea className="ed-input mt-1.5 w-full min-h-14 resize-y !text-[12px]" maxLength={600} value={s.visual}
                      onChange={(e) => {
                        const scenes = plan.scenes.slice();
                        scenes[i] = { ...scenes[i], visual: e.target.value };
                        setPlan({ ...plan, scenes });
                      }} />
                  </div>
                ))}
                <p className="text-[11px] text-faint">The script and voice below are filled in for you. Edit anything you want.</p>
              </div>
            )}
          </div>

          {remixJob && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold">🎬 Change scenes (from an earlier reel)</p>
              <p className="text-xs text-muted mt-1">Pick the scenes you do not like and say what you want instead; the other scenes stay as they are. Only {remixCost} credits.</p>
              <div className="mt-3 flex gap-2">
                <input className="ed-input flex-1 !text-[12px]" maxLength={300}
                  placeholder="Or just write: 'in scene 2 show coffee instead of tea'"
                  value={magicText} onChange={(e) => setMagicText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMagicEdit(); }} />
                <button onClick={sendMagicEdit} disabled={magicBusy || magicText.trim().length < 3}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                  {magicBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Samjho
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(remixJob.input?.scenes ?? []).map((sc) => {
                  const on = remixSel[sc.i] !== undefined;
                  return (
                    <div key={sc.i} className={`rounded-lg border overflow-hidden ${on ? "border-amber-500 ring-1 ring-amber-500" : "border-border"}`}>
                      {sc.kind === "clip"
                        ? <video src={sc.url} muted playsInline className="w-full aspect-[9/16] object-cover" />
                        /* eslint-disable-next-line @next/next/no-img-element */
                        : <img src={sc.url} alt={`scene ${sc.i + 1}`} className="w-full aspect-[9/16] object-cover" />}
                      <div className="p-1.5">
                        <p className="text-[10px] text-faint line-clamp-1">{sc.line || `Scene ${sc.i + 1}`}</p>
                        <button onClick={() => setRemixSel((m) => { const n = { ...m }; if (on) delete n[sc.i]; else n[sc.i] = ""; return n; })}
                          className={`mt-1 w-full rounded px-1.5 py-1 text-[11px] font-semibold ${on ? "bg-amber-500 text-white" : "bg-surface2"}`}>
                          {on ? "Will change ✓" : "Change"}
                        </button>
                        {on && (
                          <input className="ed-input mt-1 w-full !text-[11px] !py-1" maxLength={200} placeholder="What should it show? (blank = automatic)"
                            value={remixSel[sc.i]} onChange={(e) => setRemixSel((m) => ({ ...m, [sc.i]: e.target.value }))} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={sendRemix} disabled={busy || !Object.keys(remixSel).length}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Remake with changed scenes — {remixCost} credits
                </button>
                <button onClick={() => { setRemixJob(null); setRemixSel({}); }} className="rounded-lg border border-border px-3 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium">Script * (Hindi or Hinglish; the voiceover is made from this)</span>
            <textarea className="ed-input mt-1 w-full min-h-28 resize-y" maxLength={600} value={script}
              placeholder="There are two kinds of people in the world..." onChange={(e) => setScript(e.target.value)} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Brand name</span>
              <input className="ed-input mt-1 w-full" maxLength={40} value={brandName} placeholder="Your brand" onChange={(e) => setBrandName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Website line</span>
              <input className="ed-input mt-1 w-full" maxLength={60} value={website} placeholder="yourbusiness.com" onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          <div>
            <span className="text-sm font-medium">Quality</span>
            <div className="mt-2 grid sm:grid-cols-3 gap-2">
              {TIERS.map((t) => (
                <button key={t.key} onClick={() => setTier(t.key)}
                  className={`rounded-xl border p-3 text-left ${tier === t.key ? "border-brand ring-1 ring-brand bg-brand-soft/40" : "border-border bg-bg"}`}>
                  <p className="text-sm font-semibold">{t.label} · {t.cost} cr</p>
                  <p className="text-xs text-muted mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {(tier === "photos" || tier === "veo") && (
            <div>
              <span className="text-sm font-medium">Apni photos (optional)</span>
              <p className="text-xs text-muted mt-0.5">Add a photo of yourself or your real product; it appears in every scene instead of a generic one. {tier === "veo" ? "Up to 3 for Veo." : "Up to 4."}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {refs.map((src, i) => (
                  <span key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    <button onClick={() => setRefs(refs.filter((_, x) => x !== i))}
                      aria-label="Remove photo"
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-surface border border-border grid place-items-center text-muted">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {refs.length < 4 && (
                  <label className="h-16 w-16 rounded-lg border border-dashed border-border grid place-items-center cursor-pointer hover:bg-surface2">
                    {refBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 text-muted" />}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setRefBusy(true);
                        try {
                          const { fileToDataUrl } = await import("@/lib/upload");
                          const dataUrl = await fileToDataUrl(file, 1024, 0.85);
                          setRefs((r) => [...r, dataUrl].slice(0, 4));
                        } catch { setErr("The photo could not be read."); }
                        setRefBusy(false);
                      }} />
                  </label>
                )}
              </div>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium">Notes for the AI (optional)</span>
            <p className="text-xs text-muted mt-0.5 mb-1">What to show and what not to, for example &quot;a real Indian kitchen, no cartoons&quot; or &quot;include a close-up of the product&quot;.</p>
            <textarea className="ed-input w-full min-h-16 resize-y !text-[13px]" maxLength={400} value={guidance}
              placeholder="For example: warm family feel, morning light, product clearly on the kitchen counter…"
              onChange={(e) => setGuidance(e.target.value)} />
          </label>
          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="h-4 w-4" />
              Hindi voiceover (recommended)
            </label>
            {voice && (
              <div className="mt-2 space-y-2">
                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                  {(["male", "female"] as const).map((g) => (
                    <button key={g} onClick={() => { setVoiceGender(g); setVoiceStyle(VOICE_OPTIONS[g][0].key); }}
                      className={`px-3 py-1.5 text-xs font-semibold ${voiceGender === g ? "bg-ai/10 text-ai" : "bg-bg hover:bg-surface2"}`}>
                      {g === "male" ? "Male" : "Female"}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {VOICE_OPTIONS[voiceGender].map(({ key, label, note, preview }) => (
                    <button key={key} onClick={() => { setVoiceStyle(key); if (preview) playVoice(key); }} title={note}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${voiceStyle === key ? "border-ai bg-ai/10 text-ai" : "border-border bg-bg hover:bg-surface2"}`}>
                      {preview
                        ? (playing === key ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3 w-3" />)
                        : <Volume2 className="h-3 w-3 opacity-40" />}
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-faint">Tap ▶ to hear a voice.</p>
              </div>
            )}
          </div>

          {caption && (
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="text-xs font-semibold text-muted">Social caption (copy it into your post)</p>
              <p className="mt-1 text-sm leading-relaxed">{caption}</p>
              <button onClick={() => navigator.clipboard?.writeText(caption)}
                className="mt-2 text-xs font-semibold text-brand-ink">Copy caption</button>
            </div>
          )}
          <div>
            <button onClick={makeReel} disabled={busy || script.trim().length < 10 || hasActive}
              className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Create reel — {tierInfo.cost} credits
            </button>
            {hasActive && <p className="text-xs text-muted mt-2">A reel is being made. It takes 2 to 5 minutes; this page updates by itself.</p>}
          </div>
        </section>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}
      {note && <p className="text-sm text-muted">{note}</p>}

      {jobs.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="font-semibold">Recent</h2>
          <div className="mt-3 space-y-2">
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg p-3 text-sm">
                {j.kind === "reel" ? <Video className="h-4 w-4 text-ai shrink-0" /> : <ImageIcon className="h-4 w-4 text-brand shrink-0" />}
                <span className="capitalize font-medium">{j.kind}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  j.status === "done" ? "bg-brand-soft text-brand-ink"
                  : j.status === "failed" ? "bg-danger/10 text-danger"
                  : "bg-amber-500/10 text-amber-600"}`}>
                  {j.status === "queued" || j.status === "running" ? "being made…" : j.status}
                </span>
                <span className="text-xs text-faint">{j.cost} cr</span>
                <span className="flex-1" />
                {j.status === "failed" && <span className="text-xs text-danger truncate max-w-[180px]" title={j.error ?? ""}>{j.error === "Cancelled by user" ? "stopped" : "credits returned"}</span>}
                {(j.status === "queued" || j.status === "running") && (
                  <button onClick={() => cancelJob(j.id)}
                    className="text-xs font-semibold text-danger hover:underline">Cancel</button>
                )}
                {j.output_url && j.kind === "reel" && (
                  <button onClick={() => editJob(j)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                )}
                {j.output_url && (
                  <a href={j.output_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Download className="h-3.5 w-3.5" /> Open</a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function StudioPage() {
  return <AiPageGate title="AI Studio" reason="Make banners and reels for WhatsApp, Instagram and ads in minutes."><StudioPageInner /></AiPageGate>;
}
