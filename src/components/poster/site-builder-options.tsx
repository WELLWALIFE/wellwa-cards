"use client";

// Two ways to improve the website: change the look with a ready-made design (free, colours and layout only) or
// let the AI rewrite the words (credits, charged again every time). The price is shown before anything is spent.
// Neither one replaces the owner's pages, products, prices or photos.
import { useEffect, useState } from "react";
import { Check, Coins, LayoutTemplate, LoaderCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/poster-client";
import { UnlockDialog, useAiAccess } from "@/lib/ai-access";
import { SITE_MAX_PHOTOS, SITE_PHOTO_CREDITS, SITE_TEXT_CREDITS, siteAiCost } from "@/lib/site-pricing";

/** Only two AI photos are used now: the top banner and the About section. */
const MAX_PHOTOS = Math.min(SITE_MAX_PHOTOS, 2);
const PHOTO_LABELS = ["Top banner", "About section"];

type Tpl = { key: string; name: string; category: string; emoji: string; description: string; color: string; pages: number };

export function SiteBuilderOptions({ cardId, templateKey, generatedAt, knowledge, onDone }: { cardId: string; templateKey?: string; generatedAt?: string; knowledge?: string; onDone: (msg: string) => void }) {
  const [tab, setTab] = useState<"template" | "ai">("template");
  const access = useAiAccess();
  const [unlock, setUnlock] = useState(false);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [spent, setSpent] = useState(0);
  const balance: number | null = access.loading ? null : access.balance - spent;
  const [photos, setPhotos] = useState(MAX_PHOTOS);
  const [reference, setReference] = useState("");
  const [details, setDetails] = useState(knowledge ?? "");
  useEffect(() => { setDetails(knowledge ?? ""); }, [knowledge]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const cost = siteAiCost(photos);

  useEffect(() => {
    api<{ templates: Tpl[] }>("/api/site/template").then((r) => { if (r.ok) setTemplates(r.data.templates); }).catch(() => undefined);
  }, []);

  async function applyTemplate(t: Tpl) {
    if (!confirm(`Use the "${t.name}" look? Only colours and layout change — your V-Card text, products and photos stay.`)) return;
    setBusy(t.key); setErr("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/site/template", { method: "POST", json: { card_id: cardId, key: t.key } });
      if (!r.ok) { setErr(r.data.error ?? "Could not change the look. Please try again."); return; }
      onDone(`✅ "${t.name}" look applied. Your text, products and photos are unchanged.`);
    } catch {
      setErr("No internet — please try again.");
    } finally {
      setBusy("");
    }
  }

  async function improveWithAi() {
    if (balance !== null && balance < cost) { setUnlock(true); return; }
    if (!confirm(`The AI rewrites the words of your V-Card and website and adds an About page. Your products, prices, photos, timings and address stay. Uses ${cost} credits.`)) return;
    setBusy("ai"); setErr("");
    try {
      const r = await api<{ ok?: boolean; error?: string; charged?: number; photos?: number }>("/api/site/generate", { method: "POST", json: { card_id: cardId, photos, reference: reference.trim() || undefined, details: details.trim() || undefined } });
      if (!r.ok) { setErr(r.data.error ?? "The AI could not write it now. Please try again."); return; }
      setSpent((x) => x + (r.data.charged ?? cost));
      onDone(`✅ New words added to your website (${r.data.charged ?? cost} credits used${photos ? `, ${r.data.photos ?? 0} AI photos` : ""}). Tap Preview to see it.`);
    } catch {
      setErr("No internet — please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-xl border border-brand/40 bg-brand-soft/30 p-3 space-y-3">
      <p className="text-sm font-semibold">Improve your website</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setTab("template")} className={`rounded-xl border-2 p-3 text-left ${tab === "template" ? "border-brand bg-surface" : "border-border bg-surface/60"}`}>
          <span className="flex items-center gap-1.5 text-sm font-semibold"><LayoutTemplate className="h-4 w-4 text-brand" /> Change the look</span>
          <span className="mt-0.5 block text-[11px] text-good font-semibold">Free</span>
        </button>
        <button type="button" onClick={() => (access.active ? setTab("ai") : setUnlock(true))} className={`rounded-xl border-2 p-3 text-left ${tab === "ai" ? "border-brand bg-surface" : "border-border bg-surface/60"}`}>
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand" /> Improve with AI</span>
          <span className="mt-0.5 block text-[11px] text-muted">{access.active ? `From ${SITE_TEXT_CREDITS} credits` : "AI writes better words"}</span>
        </button>
      </div>

      {tab === "template" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">Only colours and layout change — your text, products and photos stay.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {templates.map((t) => (
              <button key={t.key} type="button" onClick={() => applyTemplate(t)} disabled={!!busy}
                className={`relative rounded-xl border bg-surface p-3 text-left hover:border-brand disabled:opacity-60 ${templateKey === t.key ? "border-brand" : "border-border"}`}>
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl" style={{ background: t.color }} />
                <span className="flex items-center gap-2 text-sm font-semibold">{t.emoji} {t.name}{templateKey === t.key && <Check className="h-4 w-4 text-good" />}</span>
                <span className="block text-[11px] text-muted mt-0.5">{t.category}</span>
                <span className="mt-1 block text-[11px] text-muted line-clamp-2">{t.description}</span>
                {busy === t.key && <LoaderCircle className="absolute right-3 top-3 h-4 w-4 animate-spin text-brand" />}
              </button>
            ))}
          </div>
          <a href="/templates" target="_blank" rel="noreferrer" className="inline-block text-[11px] font-semibold text-brand-ink">Preview all designs →</a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-muted">The AI rewrites the words of your V-Card and website and adds an About page. Your products, prices, photos, timings and address stay.</p>
          <label className="block">
            <span className="text-xs font-semibold text-muted">About your business</span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={5}
              placeholder="What you sell or do, main products/services and prices, timings, since when, what makes you different, any current offer…"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
            <span className="block text-[11px] text-muted mt-1">The AI writes only from this, your profile, products and reviews — it never invents prices or claims. Your WhatsApp assistant will use it too.</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Reference website (optional)</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. www.a-website-you-like.com" inputMode="url"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
            <span className="block text-[11px] text-muted mt-1">Your website gets its look — colours, fonts, layout — and the AI follows its tone and kind of sections. It never copies its text; your facts stay yours.</span>
          </label>
          <div>
            <span className="text-xs font-semibold text-muted">AI photos</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Array.from({ length: MAX_PHOTOS + 1 }, (_, n) => (
                <button key={n} type="button" onClick={() => setPhotos(n)} className={`h-9 min-w-9 rounded-lg border px-2.5 text-sm font-semibold ${photos === n ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{n}</button>
              ))}
            </div>
            <span className="block text-[11px] text-muted mt-1">{photos === 0 ? "No AI photos: your own photos and logo are used." : `${PHOTO_LABELS.slice(0, photos).join(" and ")}. Photos that fail are refunded.`}</span>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3 text-sm space-y-1">
            <p className="flex justify-between"><span className="text-muted">AI writes the words</span><span>{SITE_TEXT_CREDITS} credits</span></p>
            <p className="flex justify-between"><span className="text-muted">{photos} AI photo{photos === 1 ? "" : "s"} × {SITE_PHOTO_CREDITS}</span><span>{photos * SITE_PHOTO_CREDITS} credits</span></p>
            <p className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total this time</span><span>{cost} credits</span></p>
            {balance !== null && <p className="flex items-center gap-1 text-[11px] text-muted"><Coins className="h-3.5 w-3.5" /> You have {balance} credits. Every time uses credits again.</p>}
          </div>
          <button type="button" onClick={improveWithAi} disabled={busy === "ai"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy === "ai" ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Working… ({photos ? "1–2 min" : "~40 s"})</> : <><Sparkles className="h-5 w-5" /> {generatedAt ? "Improve again" : "Improve"} with AI · {cost} credits</>}
          </button>
        </div>
      )}
      {err && <p className="text-xs text-danger">{err}</p>}
      {unlock && <UnlockDialog reason="Let the AI write better words for your V-Card and website." onClose={() => { setUnlock(false); access.refresh(); }} />}
    </section>
  );
}
