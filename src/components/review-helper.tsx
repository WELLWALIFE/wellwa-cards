"use client";
// The customer's side of the review ask: stars → what they liked → a draft they can change → copied, and Google's review box opens.
// 1–3 stars: no draft; they can tell the shop on WhatsApp first, and Google stays open to them all the same (Google's rules).
import { useState } from "react";
import { Star, Check, MessageCircle, ExternalLink, RefreshCw } from "lucide-react";
import { LIKES, draftReview } from "@/lib/review-ask";

export function ReviewHelper({ biz, url, wa, hindi: hi0, site }: { biz: string; url: string; wa: string; hindi: boolean; site: string }) {
  const [hi, setHi] = useState(hi0);
  const [stars, setStars] = useState(0);
  const [likes, setLikes] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [own, setOwn] = useState(false);       // the customer typed: never overwrite their words
  const [copied, setCopied] = useState(false);
  const T = (en: string, h: string) => (hi ? h : en);
  const remake = (s: number, l: string[], h = hi) => { if (!own) setText(draftReview(s, l, biz, h)); };

  function rate(s: number) { setStars(s); remake(s, likes); }
  function tick(k: string) { const l = likes.includes(k) ? likes.filter((x) => x !== k) : [...likes, k]; setLikes(l); remake(stars, l); }

  async function go() {
    const t = text.trim();
    if (t) {
      try { await navigator.clipboard.writeText(t); setCopied(true); }
      catch {
        const ta = document.getElementById("rv-text") as HTMLTextAreaElement | null;
        if (ta) { ta.select(); try { setCopied(document.execCommand("copy")); } catch { /* the customer can copy by hand */ } }
      }
    }
    // A moment to read "copied", then Google's own review box (opens the Maps app on a phone).
    setTimeout(() => { window.location.href = url; }, t ? 900 : 0);
  }

  const talk = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(hi ? `नमस्ते, ${biz} के बारे में कुछ बताना है:` : `Hi, about my visit to ${biz}:`)}` : "";

  return (
    <main className="min-h-dvh bg-surface2/40 px-4 py-8">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{T("Your review", "आपका review")}</p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-ink">{biz}</h1>
          </div>
          <button type="button" onClick={() => { const h = !hi; setHi(h); remake(stars, likes, h); }} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">{hi ? "English" : "हिंदी"}</button>
        </div>

        {!url ? (
          <div className="mt-5 space-y-3 text-sm text-ink">
            <p>{T("This business has not added its Google page yet.", "इस business ने अभी अपना Google page नहीं जोड़ा है।")}</p>
            {talk && <a href={talk} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 font-semibold text-white"><MessageCircle className="h-4 w-4" />{T("Tell them on WhatsApp", "WhatsApp पर बताएँ")}</a>}
            <p><a href={site} className="text-brand-ink underline">{T("Open their page", "उनका page खोलें")}</a></p>
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm font-semibold text-ink">{T("How was it?", "कैसा लगा?")}</p>
            <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label={T("Stars", "Star")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n}`} onClick={() => rate(n)} className="rounded-lg p-1">
                  <Star className={`h-10 w-10 ${n <= stars ? "fill-[#FBBC05] text-[#FBBC05]" : "text-border"}`} />
                </button>
              ))}
            </div>

            {stars >= 4 && (
              <>
                <p className="mt-5 text-sm font-semibold text-ink">{T("What did you like? (tap any)", "क्या अच्छा लगा? (जो भी हो, tap करें)")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {LIKES.map((l) => { const on = likes.includes(l.key); return (
                    <button key={l.key} type="button" onClick={() => tick(l.key)} aria-pressed={on} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-ink"}`}>
                      {on && <Check className="h-3.5 w-3.5" />}{hi ? l.hi : l.en}
                    </button>
                  ); })}
                </div>
              </>
            )}

            {stars > 0 && (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{stars >= 4 ? T("Your review (change anything)", "आपका review (जो चाहें बदलें)") : T("What went wrong? (optional)", "क्या कमी लगी? (चाहें तो लिखें)")}</p>
                  {stars >= 4 && <button type="button" onClick={() => { setOwn(false); setText(draftReview(stars, likes, biz, hi)); }} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><RefreshCw className="h-3.5 w-3.5" />{T("Other words", "दूसरे शब्द")}</button>}
                </div>
                <textarea id="rv-text" value={text} onChange={(e) => { setText(e.target.value); setOwn(true); }} rows={4} placeholder={stars >= 4 ? "" : T("Tell us what to improve…", "हमें बताइए क्या सुधारें…")} className="mt-2 w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-base outline-none focus:border-brand" />

                {stars <= 3 && talk && (
                  <a href={talk} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-base font-semibold text-white"><MessageCircle className="h-5 w-5" />{T("Tell the shop first on WhatsApp", "पहले दुकान को WhatsApp पर बताएँ")}</a>
                )}

                <button type="button" onClick={go} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold ${stars >= 4 || !talk ? "grad-brand text-white" : "border border-border text-ink"}`}>
                  {text.trim() ? T("Copy & open Google", "Copy करें और Google खोलें") : T("Open Google", "Google खोलें")} <ExternalLink className="h-4 w-4" />
                </button>
                {copied && <p className="mt-2 rounded-lg bg-good/10 px-3 py-2 text-sm font-semibold text-good">{T("Copied. On Google: tap the stars, then long-press the box and Paste.", "Copy हो गया। Google पर star दबाएँ, फिर box में देर तक दबाकर Paste करें।")}</p>}
                <p className="mt-3 text-xs text-muted">{T(`On Google, tap ${stars} star${stars > 1 ? "s" : ""} again — Google asks for them there.`, `Google पर फिर से ${stars} star दबाएँ — Google वहाँ दोबारा पूछता है।`)}</p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
