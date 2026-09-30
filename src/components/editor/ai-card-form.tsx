"use client";

// "Create with AI" on the new-card screen: the owner describes the business in their own words, the AI writes the
// whole card. Credits every time (shown before anything is spent); the result opens in the editor to check and publish.
import { useState } from "react";
import { Coins, LoaderCircle, Sparkles } from "lucide-react";
import { UnlockDialog, useAiAccess } from "@/lib/ai-access";
import { CARD_TEXT_CREDITS, cardAiCost } from "@/lib/site-pricing";
import type { CardTemplateDef, TemplateCard } from "@/lib/templates";

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm";

export function AiCardForm({ onReady }: { onReady: (t: CardTemplateDef) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ business: "", person: "", category: "", city: "", phone: "", email: "", details: "", reference: "", lang: "en" });
  const access = useAiAccess();
  const [unlock, setUnlock] = useState(false);
  const balance: number | null = access.loading ? null : access.balance;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Photos come free from the trade photo library (no AI pictures any more — owner, 27 Sep 2026): only the words cost.
  const cost = cardAiCost(0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });


  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (balance !== null && balance < cost) { setUnlock(true); return; }
    if (!confirm(`Create your card with AI for ${cost} credits? Every new AI card uses credits again.`)) return;
    setBusy(true);
    const r = await fetch("/api/card/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !j.card) { setErr(j.error || "The AI could not create the card."); return; }
    onReady({ key: "ai", name: "AI card", category: f.category, description: "", emoji: "✨", data: j.card as TemplateCard });
  }

  if (!open) {
    return (
      <>
      <button type="button" onClick={() => (access.active ? setOpen(true) : setUnlock(true))} className="w-full rounded-2xl border-2 border-brand/40 bg-brand-soft p-5 text-left hover:border-brand">
        <span className="flex items-center gap-2 font-semibold text-ink"><Sparkles className="h-5 w-5 text-brand" /> Create with AI</span>
        <span className="mt-1 block text-sm text-muted">Tell us about your business in your own words. The AI writes the whole card.{access.active ? ` From ${CARD_TEXT_CREDITS} credits.` : ""}</span>
      </button>
      {unlock && <UnlockDialog reason="Tell the AI about your business and it writes your whole card." onClose={() => { setUnlock(false); access.refresh(); }} />}
      </>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-brand/40 bg-surface p-5 space-y-3 text-left">
      <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-brand" /> Create your card with AI</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-muted">Business name *<input required value={f.business} onChange={set("business")} placeholder="e.g. Sharma Sweets" className={input} /></label>
        <label className="block text-xs font-semibold text-muted">What you do *<input required value={f.category} onChange={set("category")} placeholder="e.g. Sweet shop, Dentist, Interior designer" className={input} /></label>
        <label className="block text-xs font-semibold text-muted">Your name (optional)<input value={f.person} onChange={set("person")} placeholder="Shown on the card" className={input} /></label>
        <label className="block text-xs font-semibold text-muted">City<input value={f.city} onChange={set("city")} placeholder="e.g. Delhi" className={input} /></label>
        <label className="block text-xs font-semibold text-muted">WhatsApp / phone<input value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="10-digit mobile" className={input} /></label>
        <label className="block text-xs font-semibold text-muted">Email (optional)<input value={f.email} onChange={set("email")} type="email" className={input} /></label>
      </div>
      <label className="block text-xs font-semibold text-muted">About your business * <span className="font-normal">— the AI uses only what you write here</span>
        <textarea required minLength={30} rows={5} value={f.details} onChange={set("details")} className={input}
          placeholder="What you sell or do, your main products/services and prices, timings, how long you have been in business, what makes you different, any current offer…" />
      </label>
      <label className="block text-xs font-semibold text-muted">Reference website (optional)
        <input value={f.reference} onChange={set("reference")} inputMode="url" placeholder="A website whose style you like" className={input} />
        <span className="block font-normal mt-1">The AI follows its style, never copies its text.</span>
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-xs font-semibold text-muted">Language
          <select value={f.lang} onChange={set("lang")} className={input}><option value="en">English</option><option value="hinglish">Hinglish</option><option value="hi">हिन्दी</option></select>
        </label>
        <p className="text-[11px] text-muted pb-2">Photos: real photos of your trade, added free.</p>
      </div>
      <div className="rounded-lg border border-border bg-surface2 p-3 text-sm space-y-1">
        <p className="flex justify-between"><span className="text-muted">AI writes the card</span><span>{CARD_TEXT_CREDITS} credits</span></p>
        <p className="flex justify-between"><span className="text-muted">Photos of your trade</span><span>free</span></p>
        <p className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{cost} credits</span></p>
        {balance !== null && <p className="flex items-center gap-1 text-[11px] text-muted"><Coins className="h-3.5 w-3.5" /> You have {balance} credits. Each AI card uses credits again.</p>}
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> The AI is writing your card…</> : <><Sparkles className="h-4 w-4" /> Create with AI · {cost} credits</>}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 text-sm">Cancel</button>
      </div>
      {unlock && <UnlockDialog reason={`This card needs ${cost} credits and you have ${balance ?? 0}.`} onClose={() => { setUnlock(false); access.refresh(); }} />}
    </form>
  );
}
