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
import { getBrowserSupabase } from "@/lib/supabase/browser";
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
  const bannerRef = useRef<HTMLDivElement>(null);
  // The guide push already acted on, so the app does not keep jumping to the same screen.
  const followed = useRef("");
  const pathRef = useRef(path);
  // Kept in an effect, not written during render: the check-in timer reads it, rendering does not.
  // Declared above the effects that call beat(), so it is already the new screen when they run.
  useEffect(() => { pathRef.current = path; }, [path]);

  const screen = helpFor(path);
  const live = session?.status === "live";

  // Checked again on every screen and whenever the session changes (owner, 4 Oct 2026: the button had vanished):
  // one check at mount could run before the session was there — right after a login, or the demo reset — and
  // then the button never came.
  useEffect(() => {
    let on = true;
    const check = () => { isLoggedIn().then((v) => { if (on) setSignedIn(v); }).catch(() => { if (on) setSignedIn(false); }); };
    check();
    const sb = getBrowserSupabase();
    const { data: sub } = sb?.auth.onAuthStateChange(() => check()) ?? { data: { subscription: null } };
    const t = setTimeout(check, 1500);
    return () => { on = false; clearTimeout(t); sub.subscription?.unsubscribe(); };
  }, [path]);
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

  // A browser slows the timers of a tab that is not in front — Chrome down to about once a minute — and a
  // sleeping phone stops them altogether. So the heartbeat alone leaves staff looking at an old screen for
  // up to a minute whenever the person glances at WhatsApp. Report the moment the app is in front again
  // (and read back anything staff asked for while it was away).
  useEffect(() => {
    if (!signedIn) return;
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      if (session?.status === "live") beat();
      else api<{ session: Session | null }>("/api/support/session").then((r) => { if (r.ok) setSession(r.data.session); }).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => { document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [signedIn, session?.status, beat]);

  // Report straight away on a change of screen, so staff are never looking at the screen before.
  useEffect(() => { if (live) beat(); }, [path, live, beat]);

  // While a session is live the app records its own page and posts it every couple of seconds, so staff see
  // the screen itself — the half-filled form, the button they cannot find — instead of only its name.
  // Recording starts when the session goes live and stops the moment it ends; nothing is recorded before
  // the person has agreed. What they type is included (owner's call, 1 Oct 2026) EXCEPT password fields,
  // which are never sent. rrweb is loaded only now, so nobody pays for it just by opening the app.
  useEffect(() => {
    if (!live) return;
    let gone = false;
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let buffer: unknown[] = [];
    let hasSnapshot = false;
    let seq = 0;

    (async () => {
      const { record } = await import("rrweb");
      if (gone) return;
      stop = record({
        emit(event: { type?: number }) {
          if (event.type === 2) hasSnapshot = true;       // a complete picture of the page
          buffer.push(event);
        },
        maskAllInputs: false,
        maskInputOptions: { password: true },
        // A fresh complete picture now and then, so a staff member joining mid-session has something to
        // start the replay from instead of needing every event since the beginning.
        checkoutEveryNms: 20_000,
        // Enough to follow along without sending a message per pixel of mouse movement.
        sampling: { mousemove: 150, scroll: 200, input: "last" },
      }) as (() => void) | undefined;

      const flush = async () => {
        if (gone || !buffer.length) return;
        const events = buffer;
        const snapshot = hasSnapshot;
        buffer = [];
        hasSnapshot = false;
        await api("/api/support/events", { method: "POST", json: { seq: seq++, snapshot, events } }).catch(() => undefined);
      };
      timer = setInterval(flush, 2_000);
    })();

    return () => { gone = true; if (timer) clearInterval(timer); stop?.(); };
  }, [live]);

  // The banner sits over the page, so the page has to start lower while it is there — otherwise it covers
  // whatever is at the top of the screen (it was landing on the poster's style buttons). Measured rather
  // than guessed, because it wraps to two lines on a narrow phone.
  const showBanner = live || session?.status === "requested";
  useEffect(() => {
    const root = document.documentElement;
    if (!showBanner) { root.style.removeProperty("--help-banner"); return; }
    const set = () => root.style.setProperty("--help-banner", `${(bannerRef.current?.offsetHeight ?? 44) + 8}px`);
    set();
    const ro = new ResizeObserver(set);
    if (bannerRef.current) ro.observe(bannerRef.current);
    return () => { ro.disconnect(); root.style.removeProperty("--help-banner"); };
  }, [showBanner]);

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
                ? `${session.staffName || "Shubhora support"} आपकी मदद करना चाहते हैं। हाँ करने पर वो आपकी app की screen देख पाएँगे — जो आप देख रहे हैं वही, चलते-चलते — ताकि फ़ोन पर बता सकें कि आगे क्या करना है।`
                : `${session.staffName || "Shubhora support"} would like to help you. If you say yes they can see your app screen as you use it, so they can talk you through the next step.`}
            </p>
            <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
              {hi
                ? "वो सिर्फ़ Shubhora app देखेंगे — आपका कोई दूसरा app या tab नहीं। Form में आप जो भरेंगे वो उन्हें दिखेगा; password कभी नहीं जाता। आप जब चाहें बंद कर सकते हैं।"
                : "They see only the Shubhora app — none of your other apps or tabs. What you fill into a form is visible to them; a password never is. You can end it whenever you like."}
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
      {showBanner && (
        <div ref={bannerRef} className="fixed left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-3" style={{ top: "calc(max(0.6rem, env(safe-area-inset-top)) + 3.2rem)" }}>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-card ${live ? "bg-good/15 text-ink border border-good/40" : "bg-surface2 text-muted border border-border"}`}>
            <Headset className={`h-4 w-4 shrink-0 ${live ? "text-good" : "text-muted"}`} />
            <span className="flex-1 leading-snug">
              {live
                ? (hi ? `${session?.staffName || "Shubhora support"} आपकी मदद कर रहे हैं — उन्हें आपकी screen दिख रही है।` : `${session?.staffName || "Shubhora support"} is helping you — they can see your screen.`)
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
                    {hi ? "Shubhora का कोई साथी आपकी app की screen देखकर बताएगा कि आगे क्या करना है। सिर्फ़ ये app दिखेगा, आपका कोई दूसरा app नहीं; password कभी नहीं जाता। जब चाहें बंद कर सकते हैं।" : "Someone from Shubhora will watch your app screen and talk you through it. Only this app, none of your others; a password is never sent. You can end it whenever you like."}
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
