"use client";
// "Website पूरी करें" — one step at a time (owner, 24 Oct 2026: "jab ek step complete hota hai to next step jiski jarurat hai wo hi
// aaye"). The screen shows only the next step still to do, with one button; that step's page comes back here after Save, the step
// shows ✓ and the next one is up. "बाद में" moves it to the end. When every step is done (or left for later), the good news.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Pencil, RotateCcw } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { SITE_HOST } from "@/lib/site-url";
import { clearSkips, skipStep } from "@/lib/site-finish";
import { FINISH_ICON, useFinish } from "@/components/poster/site-finish";
import { SiteLink } from "@/components/poster/card-sheet";
import { AdvancedEntry } from "@/components/poster/advanced-entry";

const OPENED = "site-finish-opened";

export default function SiteNextPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const { card, steps, skipped, setSkipped, done, total, next, failed, reload } = useFinish();
  const [justDone, setJustDone] = useState("");

  // The step opened from here came back finished: say so, once.
  useEffect(() => {
    if (!steps) return;
    let k = ""; try { k = sessionStorage.getItem(OPENED) ?? ""; } catch { /* ignore */ }
    const s = steps.find((x) => x.key === k);
    if (s?.done) { setJustDone(hi ? s.hi : s.en); try { sessionStorage.removeItem(OPENED); } catch { /* ignore */ } const t = setTimeout(() => setJustDone(""), 4000); return () => clearTimeout(t); }
  }, [steps, hi]);

  function open(key: string, href: string) {
    try { sessionStorage.setItem(OPENED, key); } catch { /* ignore */ }
    router.push(href);
  }

  if (!steps) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        {failed
          ? <button type="button" onClick={() => void reload()} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">{T("No internet — tap to try again", "Internet नहीं है — दोबारा try करें")}</button>
          : <LoaderCircle className="h-6 w-6 animate-spin text-muted" />}
      </div>
    );
  }
  if (!card) return <NoCard go={() => router.replace("/poster/card/build?make=1")} />;

  const no = next ? steps.findIndex((s) => s.key === next.key) + 1 : 0;
  const all = done === total;
  const link = `${SITE_HOST}/c/${card.username}`;

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => goBack(router, "/poster/site?edit=1")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 text-xl font-bold">{T("Complete your website", "Website पूरी करें")}</h1>
        <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-bold text-good">{done}/{total}</span>
      </div>
      <div className="flex gap-1">
        {steps.map((s) => <span key={s.key} className={`h-2 flex-1 rounded-full transition-colors ${s.done ? "bg-good" : next?.key === s.key ? "bg-brand" : "bg-surface2"}`} />)}
      </div>

      {justDone && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm font-semibold text-good">
          <Check className="h-4 w-4" strokeWidth={3} /> {justDone} — {T("done", "हो गया")}
        </p>
      )}

      {next ? (() => {
        const I = FINISH_ICON[next.icon];
        return (
          <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#2f5bf5] to-[#7b5cff] px-5 py-6 text-white">
              <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
              <p className="relative text-[11px] font-bold uppercase tracking-wider text-white/80">{T("Step", "Step")} {no} / {total}</p>
              <div className="relative mt-2 flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20"><I className="h-7 w-7" /></span>
                <div className="min-w-0"><p className="text-xl font-extrabold leading-tight">{hi ? next.hi : next.en}</p><p className="text-sm text-white/90">{hi ? next.subHi : next.sub}</p></div>
              </div>
            </div>
            <div className="space-y-2 p-4">
              <button type="button" onClick={() => open(next.key, next.href)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-card">
                {T("Start", "शुरू करें")} <ChevronRight className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => { skipStep(card.id, next.key); setSkipped([...skipped, next.key]); }} className="block w-full py-1.5 text-center text-sm font-semibold text-muted">
                {T("Later", "बाद में")}
              </button>
            </div>
          </section>
        );
      })() : (
        <section className="relative overflow-hidden rounded-3xl px-5 py-6 text-center text-white shadow-float bg-gradient-to-br from-[#1fb956] to-[#14a37f]">
          <div className="relative space-y-2">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20 text-2xl" aria-hidden="true">{all ? "🎉" : "👍"}</span>
            <p className="text-2xl font-extrabold">{all ? T("Your website is complete!", "आपकी website पूरी है!") : T("All set for now", "अभी के लिए सब हो गया")}</p>
            <p className="text-sm text-white/90">{all ? T("Share it with your customers.", "ग्राहकों को share करें।") : T("The rest can be done later.", "बाकी बाद में कर सकते हैं।")}</p>
            <SiteLink href={`https://${link}`} title={T("Website", "Website")} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink"><span className="truncate">{link}</span> <ExternalLink className="h-4 w-4 shrink-0" /></SiteLink>
          </div>
        </section>
      )}

      {/* Every step, small: ✓ done, the one up now, the ones left for later (a tap opens any of them). */}
      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <ul className="divide-y divide-border">
          {steps.map((s, i) => {
            const I = FINISH_ICON[s.icon];
            const now = next?.key === s.key;
            const later = !s.done && skipped.includes(s.key);
            return (
              <li key={s.key}>
                <button type="button" onClick={() => open(s.key, s.href)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${now ? "bg-brand-soft/40" : ""}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? "bg-good text-white" : now ? "bg-brand text-white" : "bg-surface2 text-muted"}`}>
                    {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <I className={`h-4 w-4 shrink-0 ${s.done ? "text-good" : "text-muted"}`} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${s.done ? "text-muted" : "font-semibold"}`}>{hi ? s.hi : s.en}</span>
                  {s.done ? <Pencil className="h-3.5 w-3.5 shrink-0 text-muted" /> : later ? <span className="shrink-0 text-[11px] text-muted">{T("later", "बाद में")}</span> : now ? <ChevronRight className="h-4 w-4 shrink-0 text-brand" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {skipped.length > 0 && !all && (
          <button type="button" onClick={() => { clearSkips(card.id); setSkipped([]); }} className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-semibold text-brand-ink">
            <RotateCcw className="h-3.5 w-3.5" /> {T("Do the skipped ones now", "छोड़े हुए अभी करें")}
          </button>
        )}
      </section>

      {!next && <AdvancedEntry cardId={card.id} fetchState />}
      {!next && (
        <button type="button" onClick={() => router.push("/poster")} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white">{T("Done", "हो गया")} <ChevronRight className="h-5 w-5" /></button>
      )}
    </div>
  );
}

/** No website yet: off to make one (after the paint, not during it). */
function NoCard({ go }: { go: () => void }) {
  useEffect(() => { go(); }, [go]);
  return null;
}
