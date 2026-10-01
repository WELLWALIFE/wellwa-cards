"use client";
// Help, on every screen — and live help when reading is not enough.
//
// Owner's call, 1 Oct 2026: however clever someone is, their first card and first website are new to them.
// This is the one Help button, always in the same corner. It opens what to do on THIS screen, and if that
// is not enough, it calls a person.
//
// Live help never starts by itself. Either the person asks here, or staff ask from /admin/support and the
// person says yes to the question on their phone. While it runs there is a banner they cannot miss, with
// the name of whoever is helping and a button to end it. Staff see which screen they are on and can send
// them to another one — they never see what the person types.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleQuestionMark, Headset, LoaderCircle, PlayCircle, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { helpFor, screenName } from "@/lib/help-screens";
import { useT } from "@/lib/poster-i18n";

type Session = {
  id: string;
  status: "requested" | "invited" | "live" | "ended";
  staffName: string | null;
  guidePath: string | null;
  guideAt: string | null;
  since: string;
};

/** How often the app checks in. Slow while nothing is happening; quick while someone is helping. */
const IDLE_MS = 25_000;
const LIVE_MS = 5_000;

export function HelpDock() {
  const path = usePathname() ?? "/poster";
  const router = useRouter();
  const { lang } = useT();
  const hi = lang !== "en";
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  // The guide push already acted on, so the app does not keep jumping to the same screen.
  const followed = useRef("");
  const pathRef = useRef(path);
  // Kept in an effect, not written during render: the check-in timer reads it, rendering does not.
  // Declared above the effects that call beat(), so it is already the new screen when they run.
  useEffect(() => { pathRef.current = path; }, [path]);

  const screen = helpFor(path);
  const live = session?.status === "live";

  useEffect(() => { isLoggedIn().then(setSignedIn).catch(() => setSignedIn(false)); }, []);
  useEffect(() => { setOpen(false); setQuestion(""); setAnswer(""); }, [path]);

  /** A question about this screen. The server is told which screen, so the answer is about what they see. */
  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy("ask"); setAnswer("");
    const r = await api<{ reply?: string; error?: string }>("/api/support/ask", {
      method: "POST", json: { question: q, path, lang },
    }).catch(() => null);
    setBusy("");
    setAnswer(r?.data.reply || r?.data.error || (hi ? "जवाब नहीं मिल पाया — फिर से कोशिश करें।" : "That didn't go through — please try again."));
  }

  /** One check-in: report the screen while live, and read back anything staff asked for. */
  const beat = useCallback(async () => {
    const r = await api<{ session: Session | null }>("/api/support/session", {
      method: "POST",
      json: { action: "ping", path: pathRef.current, state: { screen: screenName(pathRef.current) } },
    }).catch(() => null);
    if (r?.ok) setSession(r.data.session);
  }, []);

  // Check in on a timer: often enough to feel live, rarely enough not to cost anything when idle.
  useEffect(() => {
    if (!signedIn) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const r = await api<{ session: Session | null }>("/api/support/session").catch(() => null);
      if (!stop && r?.ok) setSession(r.data.session);
    };
    tick();
    const id = setInterval(() => { if (session?.status === "live") beat(); else tick(); }, session?.status === "live" ? LIVE_MS : IDLE_MS);
    return () => { stop = true; clearInterval(id); };
  }, [signedIn, session?.status, beat]);

  // Report straight away on a change of screen, so staff are never looking at the screen before.
  useEffect(() => { if (live) beat(); }, [path, live, beat]);

  // Staff sent them somewhere: go, once per push.
  useEffect(() => {
    if (!live || !session?.guidePath || !session.guideAt) return;
    if (followed.current === session.guideAt) return;
    followed.current = session.guideAt;
    if (session.guidePath !== path) router.push(session.guidePath);
  }, [live, session?.guidePath, session?.guideAt, path, router]);

  async function act(action: "request" | "accept" | "decline" | "end") {
    setBusy(action);
    const r = await api<{ session: Session | null }>("/api/support/session", {
      method: "POST", json: { action, path, ...(action === "request" ? { note: screenName(path) } : {}) },
    }).catch(() => null);
    setBusy("");
    if (r?.ok) setSession(r.data.session);
    if (action === "request") setOpen(false);
  }

  if (!signedIn) return null;

  return (
    <>
      {/* Staff asked to help — nothing is shown to them until this is answered. */}
      {session?.status === "invited" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 px-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <p className="flex items-center gap-2 text-base font-bold"><Headset className="h-5 w-5 text-brand" /> {hi ? "मदद चाहिए?" : "Need a hand?"}</p>
            <p className="text-sm text-muted">
              {hi
                ? `${session.staffName || "Shubhora support"} आपकी मदद करना चाहते हैं। हाँ करने पर वो देख पाएँगे कि आप app की किस screen पर हैं और आपका card कैसा बन रहा है — ताकि फ़ोन पर बता सकें कि आगे क्या करना है।`
                : `${session.staffName || "Shubhora support"} would like to help you. If you say yes they can see which screen of the app you are on and how your card is coming along, so they can talk you through the next step.`}
            </p>
            <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
              {hi ? "आप जो type करेंगे वो उन्हें नहीं दिखेगा। आप जब चाहें बंद कर सकते हैं।" : "They cannot see what you type. You can end it whenever you like."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => act("decline")} disabled={!!busy}
                className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold disabled:opacity-60">{hi ? "अभी नहीं" : "Not now"}</button>
              <button type="button" onClick={() => act("accept")} disabled={!!busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy === "accept" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} {hi ? "हाँ, मदद लें" : "Yes, help me"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* While someone is watching, they can see that someone is watching. */}
      {(live || session?.status === "requested") && (
        <div className="fixed left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-3" style={{ top: "calc(max(0.6rem, env(safe-area-inset-top)) + 3.2rem)" }}>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-card ${live ? "bg-good/15 text-ink border border-good/40" : "bg-surface2 text-muted border border-border"}`}>
            <Headset className={`h-4 w-4 shrink-0 ${live ? "text-good" : "text-muted"}`} />
            <span className="flex-1 leading-snug">
              {live
                ? (hi ? `${session?.staffName || "Shubhora support"} आपकी मदद कर रहे हैं — उन्हें दिख रहा है कि आप किस screen पर हैं।` : `${session?.staffName || "Shubhora support"} is helping you — they can see which screen you are on.`)
                : (hi ? "मदद माँगी गई है — कोई अभी जुड़ेगा।" : "Help requested — someone will join shortly.")}
            </span>
            <button type="button" onClick={() => act("end")} disabled={!!busy} className="shrink-0 underline disabled:opacity-60">{hi ? "बंद करें" : "End"}</button>
          </div>
        </div>
      )}

      {/* The Help button: same corner on every screen. */}
      <button type="button" onClick={() => setOpen(true)} aria-label={hi ? "मदद" : "Help"}
        className="fixed right-3 z-40 grid h-12 w-12 place-items-center rounded-full border border-border bg-surface text-brand shadow-xl"
        style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}>
        <CircleQuestionMark className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{screen ? (hi ? screen.title.hi : screen.title.en) : (hi ? "मदद" : "Help")}</p>
                {screen && <p className="mt-0.5 text-sm text-muted">{hi ? screen.what.hi : screen.what.en}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted"><X className="h-5 w-5" /></button>
            </div>

            {screen ? (
              <ol className="space-y-2">
                {screen.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 rounded-xl bg-surface2 px-3 py-2.5 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
                    <span className="leading-snug">{hi ? s.hi : s.en}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl bg-surface2 px-3 py-2.5 text-sm text-muted">
                {hi ? "इस screen के लिए अलग से कुछ लिखा नहीं है — नीचे से live help बुला लीजिए।" : "There is nothing written for this screen — call for live help below."}
              </p>
            )}

            {screen?.mistake && (
              <p className="mt-3 flex gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-sm">
                <TriangleAlert className="h-4 w-4 shrink-0 text-amber" />
                <span className="leading-snug"><b>{hi ? "ध्यान रखें: " : "Watch out: "}</b>{hi ? screen.mistake.hi : screen.mistake.en}</span>
              </p>
            )}

            {screen?.video && (
              <a href={screen.video} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">
                <PlayCircle className="h-5 w-5 text-brand" /> {hi ? "ये हिस्सा video में देखें (हिंदी)" : "Watch this part (Hindi)"}
              </a>
            )}

            {/* Between reading and calling someone: ask about this screen. */}
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-ai" /> {hi ? "इसी screen के बारे में पूछें" : "Ask about this screen"}</p>
              <div className="flex gap-2">
                <input value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
                  placeholder={hi ? "जैसे: Publish का button कहाँ है?" : "e.g. where is the Publish button?"}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm" />
                <button type="button" onClick={ask} disabled={!question.trim() || !!busy}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl grad-brand text-white disabled:opacity-60" aria-label={hi ? "पूछें" : "Ask"}>
                  {busy === "ask" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {answer && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface2 px-3 py-2.5 text-sm leading-snug">{answer}</p>}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              {live ? (
                <button type="button" onClick={() => act("end")} disabled={!!busy}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-60">
                  {hi ? `${session?.staffName || "Support"} मदद कर रहे हैं — बंद करें` : `${session?.staffName || "Support"} is helping — end it`}
                </button>
              ) : session?.status === "requested" ? (
                <p className="rounded-xl bg-surface2 px-3 py-2.5 text-center text-sm text-muted">{hi ? "मदद माँगी गई है — कोई अभी जुड़ेगा।" : "Help requested — someone will join shortly."}</p>
              ) : (
                <>
                  <p className="mb-2 text-sm font-semibold">{hi ? "फिर भी अटक गए?" : "Still stuck?"}</p>
                  <button type="button" onClick={() => act("request")} disabled={!!busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {busy === "request" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Headset className="h-4 w-4" />}
                    {hi ? "Live help बुलाएँ" : "Call for live help"}
                  </button>
                  <p className="mt-2 text-[11px] leading-snug text-muted">
                    {hi ? "Shubhora का कोई साथी आपकी screen देखकर बताएगा कि आगे क्या करना है। आप जो type करेंगे वो नहीं दिखेगा, और आप जब चाहें बंद कर सकते हैं।" : "Someone from Shubhora will look at your screen and talk you through it. They cannot see what you type, and you can end it whenever you like."}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
