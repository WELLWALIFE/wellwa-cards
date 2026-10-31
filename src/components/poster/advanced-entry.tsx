"use client";
// The doors into the ADVANCED website (the Rs 5,999 segment, owner 15-16 Oct 2026): the "Make advanced website" card on the
// congratulations page and on Card & Website, the state line once one exists, and the small "switch back to my basic website"
// link. The page itself is /poster/site/advanced; the engine is /api/card/advanced (GET state, POST { toggle } to switch).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LoaderCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

export type AdvState = { has: boolean; on: boolean; archetype: string | null; at: string | null; round: number };
type StateResponse = { current?: AdvState | null; error?: string };

/** What the advanced website is on this card right now; null while unknown (offline, logged out). */
export async function fetchAdvancedState(cardId?: string): Promise<AdvState | null> {
  try {
    const r = await api<StateResponse>(`/api/card/advanced${cardId ? `?cardId=${encodeURIComponent(cardId)}` : ""}`);
    return r.ok ? r.data.current ?? null : null;
  } catch { return null; }
}

export const ADVANCED_HREF = "/poster/site/advanced";

/** "Switch back to my basic website" (and, once switched, "Turn the advanced one back on"). Both designs stay stored, so this is
 *  reversible; the failure of a tap is written directly under the link that was tapped. */
export function AdvancedSwitch({ cardId, on, onChanged, className = "" }: { cardId?: string; on: boolean; onChanged: (s: AdvState | null) => void; className?: string }) {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function flip() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ ok?: boolean; error?: string; current?: AdvState }>("/api/card/advanced", { method: "POST", json: { toggle: !on, ...(cardId ? { cardId } : {}) } });
      if (!r.ok) { setErr(r.data?.error || T("Could not switch your website. Please try again.", "Website बदली नहीं जा सकी। दोबारा try करें।")); return; }
      onChanged(r.data.current ?? null);
    } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    finally { setBusy(false); }
  }
  return (
    <div className={className}>
      <button type="button" onClick={flip} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink underline underline-offset-2 disabled:opacity-60">
        {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
        {on ? T("Switch back to my basic website", "मेरी basic website वापस लगाएँ") : T("Turn my Premium website back on", "मेरी Premium website फिर चालू करें")}
      </button>
      {err && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">{err}</p>}
    </div>
  );
}

/** The entry card. `cardId`: the card Card & Website is showing (the page takes it as ?card=). With `fetchState` the card reads
 *  whether an advanced website exists (the hub); without it (the congratulations page, a brand-new site) it is the plain offer. */
export function AdvancedEntry({ cardId, fetchState = false, className = "" }: { cardId?: string; fetchState?: boolean; className?: string }) {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [st, setSt] = useState<AdvState | null>(null);
  /** Premium is paid on this account (the Premium page's own rule): with no design yet, the card is the next step, not an offer. */
  const [paid, setPaid] = useState(false);
  const load = useCallback(() => {
    void fetchAdvancedState(cardId).then(setSt);
    void api<{ allowed?: boolean }>("/api/poster/pay/advanced").then((r) => { if (r.ok && r.data.allowed === true) setPaid(true); }).catch(() => undefined);
  }, [cardId]);
  useEffect(() => { if (fetchState) load(); }, [fetchState, load]);

  const href = `${ADVANCED_HREF}${cardId ? `?card=${encodeURIComponent(cardId)}` : ""}`;
  const has = !!st?.has;
  // Paid, nothing made yet (owner, 31 Oct 2026: a Premium customer should go straight on to the Premium design): the loud version.
  const waiting = paid && !has;
  return (
    <section className={`space-y-2 ${className}`}>
      <Link href={href} className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3.5 text-left shadow-sm transition active:scale-[.99] ${waiting ? "grad-brand text-white shadow-card" : "border-2 border-ai/40 bg-surface"}`}>
        <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${waiting ? "bg-white/15" : "bg-ai/10"}`} />
        <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl ${waiting ? "bg-white/20 text-white" : "bg-ai-soft text-ai"}`}><Sparkles className="h-5 w-5" /></span>
        <span className="relative min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold leading-tight">
              {waiting ? T("Make my Premium website now", "अब मेरी Premium website बनाएँ") : has ? T("Your Premium website", "आपकी Premium website") : T("Make a Premium website", "Premium website बनवाएँ")}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${waiting ? "bg-white/25 text-white" : "bg-ai-soft text-ai"}`}>{T("Premium", "Premium")}</span>
          </span>
          <span className={`mt-0.5 block text-xs leading-snug ${waiting ? "text-white/90" : "text-muted"}`}>
            {waiting
              ? T("Included in your plan · AI designs it in 1–2 minutes · see it, then put it live", "आपके plan में शामिल · AI 1–2 मिनट में design करेगा · देखें, फिर live करें")
              : has
              ? (st?.on
                ? T("It is live on your link. Tap to design it again.", "ये आपके link पर live है। दोबारा design करने के लिए दबाएँ।")
                : T("Saved, but your basic website is showing. Tap to see it.", "Save है, पर अभी आपकी basic website दिख रही है। देखने के लिए दबाएँ।"))
              : T("A new look made only for your business", "सिर्फ़ आपके business के लिए नया look")}
          </span>
        </span>
        <ChevronRight className={`relative h-5 w-5 shrink-0 ${waiting ? "text-white/90" : "text-muted"}`} />
      </Link>
      {has && <AdvancedSwitch cardId={cardId} on={!!st?.on} onChanged={(s) => { if (s) setSt(s); else load(); }} className="px-1" />}
    </section>
  );
}
