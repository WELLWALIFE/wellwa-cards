"use client";
// Looks — the owner's OWN card, rendered live in all twelve looks. Tap one to apply it; nothing else on the card
// changes (text, photos, pages, colour stay). Opened from the Card tab ("See your card in 12 looks").
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, LoaderCircle, Palette, ExternalLink } from "lucide-react";
import { CardView } from "@/components/card-view";
import { LOOKS, type LookDef } from "@/lib/looks";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { api, isLoggedIn } from "@/lib/poster-client";
import type { Card } from "@/lib/types";
import type { FactsResponse } from "@/lib/card-facts";
import { useT } from "@/lib/poster-i18n";
import { SITE_URL } from "@/lib/site-url";
import { CardLink } from "@/components/poster/card-sheet";

const SWATCHES = ["#2f5bf5", "#0e9e90", "#6d5cf5", "#d24b4b", "#e5673b", "#f2a33c", "#1e3a8a", "#b86a3a", "#0d9488", "#111827"];

export default function LooksGallery() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [card, setCard] = useState<Card | null>(null);
  const [qr, setQr] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [color, setColor] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/card/looks"); return; }
    const cards = await fetchMyCardsStrict().catch(() => [] as Card[]);
    let primaryId = "";
    if (cards.length > 1) { const fr = await api<Partial<FactsResponse>>("/api/card/facts").catch(() => null); primaryId = fr?.ok ? fr.data.facts?.primaryCardId ?? "" : ""; }
    const mine = cards.find((c) => c.id === primaryId) ?? cards[0];
    if (!mine) { router.replace("/poster/card/build"); return; }
    setCard(mine); setColor(mine.themeColor);
  }, [router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (card) QRCode.toDataURL(`${SITE_URL}/c/${card.username}`, { width: 240, margin: 1 }).then(setQr).catch(() => setQr("")); }, [card]);

  // Previews never count as visits and never open the chat or the welcome popup.
  const preview = useMemo(() => card ? { ...card, username: "__looks", popup: undefined } as Card : null, [card]);

  async function apply(look: LookDef) {
    if (!card || busy) return;
    setBusy(true); setMsg("");
    const r = await publishCard({ ...card, template: look.key, themeColor: color || card.themeColor, avatarColor: color || card.avatarColor });
    setBusy(false);
    if (!r.ok) { setMsg(r.error || (hi ? "Save nahi hua" : "Could not save")); return; }
    setCard({ ...card, template: look.key, themeColor: color || card.themeColor, avatarColor: color || card.avatarColor });
    setMsg(hi ? `${look.name} look lag gaya — aapka card ab aisa dikhega.` : `${look.name} applied — your card looks like this now.`);
  }

  if (!card || !preview) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const sel = LOOKS.find((l) => l.key === (pick ?? card.template)) ?? LOOKS[0];
  const shown = { ...preview, template: sel.key, themeColor: color || preview.themeColor, avatarColor: color || preview.avatarColor };
  const isOn = card.template === sel.key && (color || card.themeColor) === card.themeColor;

  // Looks and colours on top, the card right below (owner's call, 28 Sep 2026): tap look after look, or a colour, and
  // watch the card change — then one button applies it. No separate preview page any more.
  return (
    <div className="space-y-3 pb-24">
      <div>
        <h1 className="text-lg font-bold flex items-center gap-2"><Palette className="h-5 w-5 text-brand" /> {hi ? "आपका card, 12 looks में" : "Your card in 12 looks"}</h1>
        <p className="text-sm text-muted">{hi ? "ऊपर look और रंग tap करें — नीचे card तुरंत बदल जाता है। पसंद आए तो “यही look लगाएँ” दबाएँ।" : "Tap a look and a colour above — the card below changes at once. Like it? Tap “Use this look”."}</p>
      </div>
      {msg && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm text-ink">{msg}</p>}

      <div className="sticky top-0 z-30 -mx-4 space-y-2 bg-bg/95 px-4 pb-2 pt-1 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {LOOKS.map((l) => {
            const on = sel.key === l.key;
            return (
              <button key={l.key} type="button" onClick={() => setPick(l.key)} className={`shrink-0 w-[4.6rem] overflow-hidden rounded-xl border text-left ${on ? "border-brand ring-2 ring-brand" : "border-border bg-surface"}`}>
                <div className="h-8" style={{ background: l.cover(color || card.themeColor) }} />
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <span className="truncate text-[11px] font-semibold">{l.name}</span>
                  {card.template === l.key && <Check className="ml-auto h-3 w-3 shrink-0 text-brand" />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="shrink-0 text-xs text-muted">{hi ? "रंग" : "Colour"}</span>
          {Array.from(new Set([card.themeColor, ...SWATCHES])).map((s) => (
            <button key={s} type="button" onClick={() => setColor(s)} aria-label={s}
              className={`h-7 w-7 shrink-0 rounded-full transition-transform ${(color || card.themeColor) === s ? "ring-2 ring-offset-2 ring-offset-bg scale-110" : ""}`} style={{ background: s, boxShadow: (color || card.themeColor) === s ? `0 0 0 2px ${s}` : "none" }} />
          ))}
          <label className="shrink-0 inline-flex items-center gap-1 text-xs text-muted">
            <input type="color" value={color || card.themeColor} onChange={(e) => setColor(e.target.value)} className="h-7 w-7 rounded-full border border-border bg-transparent p-0" aria-label="Custom colour" />
          </label>
        </div>
        <p className="text-xs"><b>{sel.name}</b>{hi && sel.hi ? ` · ${sel.hi}` : ""} <span className="text-muted">— {sel.blurb}</span></p>
      </div>

      <div className="-mx-4 overflow-hidden rounded-none border-y border-border sm:mx-0 sm:rounded-2xl sm:border">
        <CardView key={`${sel.key}-${color}`} card={shown} qr={qr} expired />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md px-4">
        <button type="button" disabled={busy || isOn} onClick={() => apply(sel)} className="w-full rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-float disabled:opacity-70">
          {busy ? (hi ? "लग रहा है…" : "Applying…") : isOn ? (hi ? "यही look लगा है ✓" : "This look is on ✓") : (hi ? `यही look लगाएँ — ${sel.name}` : `Use this look — ${sel.name}`)}
        </button>
      </div>
      <CardLink href={`${SITE_URL}/c/${card.username}`} title={hi ? "मेरा कार्ड" : "My card"} className="inline-flex items-center gap-1.5 text-sm text-brand-ink"><ExternalLink className="h-4 w-4" /> {hi ? "Live card खोलें" : "Open the live card"}</CardLink>
    </div>
  );
}
