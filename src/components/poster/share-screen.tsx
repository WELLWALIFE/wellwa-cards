"use client";
// "Share Screen" — the sender's side (owner, 19 Oct 2026). One tap makes a link (or sends a request to the Shubhora admin); whoever opens it sees THIS
// Shubhora screen live, and can only look. Opened from the Help panel (a window event), so it works on every screen of the app.
//
// What the person is told, before anything starts, is exactly what happens: only this app's screen, only to whoever gets the link, nothing can be
// done from the other side, a password is never shown, and it ends when they tap Stop, or by itself after 30 minutes. The SAME link keeps working:
// if sharing stopped (by mistake, or because the 30 minutes ran out), whoever opens it again — or taps Reconnect on it — makes this app ask "share your
// screen?" and the person decides; on yes the same link carries on (another 30 minutes when the time had run out). No new link is needed for a day.
// lib/live-share.ts is the server.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, Hand, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

export const SHARE_SCREEN_EVENT = "shubhora:share-screen";
export type ShareKind = "link" | "admin";
const FLUSH_MS = 400;
const BEAT_MS = 10_000;
const STATUS_MS = 4_000;
/** Inputs that must never leave the phone even though what is typed elsewhere is shown (the owner's call, 1 Oct 2026): codes, PINs, cards, banks, IDs. */
const SECRET_FIELD = /otp|one-time|passcode|password|\bpin\b|cvv|cvc|card|aadhaar|aadhar|\bpan\b|account|ifsc|upi|bank/i;

type Live = { token: string; secret: string; url: string; expiresAt: number; kind: ShareKind };
type Status = { token: string; kind: ShareKind; state: "live" | "paused" | "ended"; why?: string | null; expiresAt: number; viewers: number; knockAt: number; waiting: boolean; url: string };

export function ShareScreen() {
  const { lang } = useT();
  const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [ask, setAsk] = useState<ShareKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [viewers, setViewers] = useState(0);
  const [copied, setCopied] = useState(false);
  const [st, setSt] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const liveRef = useRef<Live | null>(null);
  const stopRec = useRef<(() => void) | undefined>(undefined);
  const buffer = useRef<unknown[]>([]);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const dismissed = useRef(0);
  // Help by tapping (owner, 25 Oct 2026): the person decides — on by default in the dialog, one tap turns it off (or on) while sharing.
  const [allow, setAllow] = useState(true);
  const allowRef = useRef(true);
  useEffect(() => { allowRef.current = allow; }, [allow]);
  const [acted, setActed] = useState(0);
  const flash = () => { setActed(Date.now()); setTimeout(() => setActed(0), 3500); };
  const mirror = useRef<{ getNode: (id: number) => Node | null } | null>(null);

  /** Does what the helper asked, here, on this screen — never in a secret field, never on the sharing controls. */
  function run(cmds: unknown[]) {
    if (!allowRef.current || !Array.isArray(cmds)) return;
    for (const raw of cmds.slice(0, 20)) {
      const c = raw as { t?: string; id?: number; value?: string; dy?: number };
      try {
        if (c.t === "scroll") { window.scrollBy({ top: Number(c.dy) || 0, behavior: "smooth" }); flash(); continue; }
        if (c.t === "back") { window.history.back(); flash(); continue; }
        const node = typeof c.id === "number" ? mirror.current?.getNode(c.id) : null;
        const el = (node && node.nodeType === 1 ? node : node?.parentElement) as HTMLElement | null;
        if (!el || el.closest("[data-share-block]")) continue;
        const desc = `${el.getAttribute("name") ?? ""} ${el.id ?? ""} ${el.getAttribute("autocomplete") ?? ""} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("aria-label") ?? ""}`;
        const secret = (el as HTMLInputElement).type === "password" || SECRET_FIELD.test(desc);
        if (c.t === "click") {
          if (secret) continue;
          el.focus?.({ preventScroll: true });
          el.click();
          flash();
        } else if (c.t === "input" && typeof c.value === "string") {
          if (secret || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
          // React keeps its own copy of the value: set it the way a keyboard would, then tell React.
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, c.value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          flash();
        }
      } catch { /* one that cannot be done is skipped */ }
    }
  }

  useEffect(() => {
    const open = (e: Event) => { setErr(""); setAsk((e as CustomEvent<{ kind?: ShareKind }>).detail?.kind === "admin" ? "admin" : "link"); };
    window.addEventListener(SHARE_SCREEN_EVENT, open);
    return () => window.removeEventListener(SHARE_SCREEN_EVENT, open);
  }, []);

  /** This account's own link, if it is still open (and whether somebody is waiting for sharing to start again). */
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ link?: Status | null }>("/api/share/status");
      if (r.ok) setSt(r.data.link ?? null);
    } catch { /* offline: the next check tells the truth */ }
  }, []);

  const push = useCallback(async (extra?: { end?: boolean }) => {
    const l = liveRef.current;
    if (!l) return;
    const events = buffer.current; buffer.current = [];
    try {
      // keepalive is only for the tiny "end" message: a keepalive request may not carry more than 64 KB, and the first picture of a screen is several times that.
      const r = await fetch("/api/share/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: l.token, secret: l.secret, events, control: allowRef.current, ...(extra ?? {}) }), keepalive: !!extra?.end, cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { viewers?: number; ended?: string; paused?: string; cmds?: unknown[] };
      if (typeof j.viewers === "number") setViewers(j.viewers);
      if (j.cmds?.length) run(j.cmds);
      if (j.ended) { halt(false); setNote(j.ended === "expired" ? T("This link is over. Please make a new one.", "ये link खत्म हो गया। नया link बनाएँ।") : T("Sharing has ended.", "sharing बंद हो गई।")); }
      else if (j.paused === "expired") { halt(false); setNote(T("The 30 minutes are over, so sharing stopped.", "30 मिनट पूरे हो गए, इसलिए sharing रुक गई।")); void refresh(); }
      else if (j.paused === "stopped" || r.status === 403) { halt(false); void refresh(); }
    } catch {
      // offline for a moment (or a slow send): what was not sent goes back in front, so the next push carries it (and the first picture is never lost)
      if (!extra?.end && liveRef.current) buffer.current = [...events, ...buffer.current].slice(-4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Tells the server sharing has stopped, with a small message that always goes (a beacon: no size limit trouble, it survives the page closing). */
  function endNow(l: Live) {
    const body = JSON.stringify({ token: l.token, secret: l.secret, end: true });
    let sent = false;
    try { sent = navigator.sendBeacon("/api/share/push", new Blob([body], { type: "application/json" })); } catch { /* below */ }
    if (!sent) void fetch("/api/share/push", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, cache: "no-store" }).catch(() => undefined);
  }

  /** Stops recording and, when asked, tells the server (sharing stops at once; the link itself stays, so it can reconnect). */
  function halt(tell: boolean) {
    stopRec.current?.(); stopRec.current = undefined;
    for (const t of timers.current) clearInterval(t); timers.current = [];
    if (tell && liveRef.current) { endNow(liveRef.current); setTimeout(() => void refresh(), 700); }
    liveRef.current = null; buffer.current = [];
    setLive(null); setViewers(0);
  }

  /** Starts drawing this screen to the server on the given link (new or resumed). The first full picture is sent before returning. */
  async function begin(l: Live) {
    liveRef.current = l; setLive(l); setNote(""); setSt(null);
    const { record } = await import("rrweb");
    mirror.current = record.mirror;
    let gotPicture: () => void = () => undefined;
    const picture = new Promise<void>((res) => { gotPicture = res; });
    stopRec.current = record({
      emit(e) { buffer.current.push(e); if ((e as { type?: number }).type === 2) gotPicture(); },
      // What is typed is shown (a form is the whole point); passwords and secret-looking fields never are.
      maskInputOptions: { password: true },
      maskInputFn: (text, el) => (SECRET_FIELD.test(`${el?.getAttribute?.("name") ?? ""} ${el?.id ?? ""} ${el?.getAttribute?.("autocomplete") ?? ""} ${el?.getAttribute?.("placeholder") ?? ""} ${el?.getAttribute?.("aria-label") ?? ""}`) ? "•".repeat(text.length) : text),
      blockSelector: "[data-share-block]",
      checkoutEveryNms: 15_000,
      sampling: { mousemove: 150, scroll: 150, input: "last" },
    }) as (() => void) | undefined;
    timers.current.push(setInterval(() => { if (buffer.current.length) void push(); }, FLUSH_MS));
    timers.current.push(setInterval(() => { void push(); }, BEAT_MS));
    // While help by tapping is on, ask for the helper's taps every second (even when nothing on the screen moved).
    timers.current.push(setInterval(() => { if (allowRef.current && !buffer.current.length) void push(); }, 1000));
    // The first complete picture of the screen is sent BEFORE the link is handed out, so whoever opens it sees the screen at once (when the app goes to
    // WhatsApp the page is in the background and cannot draw a picture until the person is back).
    await Promise.race([picture, new Promise((res) => setTimeout(res, 4000))]);
    await push();
  }

  const failText = T("Could not make the link. Please try again.", "link नहीं बन पाया। दोबारा कोशिश करें।");
  async function start(kind: ShareKind) {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api<{ token: string; secret: string; url: string; expiresAt: number; error?: string }>("/api/share", { method: "POST", json: { kind } });
      if (!r.ok || !r.data.token) throw new Error(r.data.error || failText);
      await begin({ token: r.data.token, secret: r.data.secret, url: r.data.url, expiresAt: r.data.expiresAt, kind });
    } catch (e) {
      halt(false);
      setErr(e instanceof Error ? e.message : failText);
    } finally { setBusy(false); }
  }
  /** Sharing again on the SAME link (the person said yes to the question, or chose to continue from the Help panel). */
  async function resume(l: Status) {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api<{ token: string; secret: string; url: string; expiresAt: number; error?: string }>("/api/share/resume", { method: "POST", json: { token: l.token } });
      if (!r.ok || !r.data.secret) throw new Error(r.data.error || T("This link is over. Please make a new one.", "ये link खत्म हो गया। नया बनाएँ।"));
      await begin({ token: r.data.token, secret: r.data.secret, url: r.data.url, expiresAt: r.data.expiresAt, kind: l.kind });
    } catch (e) {
      halt(false);
      setErr(e instanceof Error ? e.message : failText);
      void refresh();
    } finally { setBusy(false); }
  }

  // Closing the page stops sharing at once (the link stays, and can reconnect). A phone that only switches app is covered by the server: after 2 minutes
  // without a sign of life it shows the viewer "paused", and carries on by itself when the app is back.
  useEffect(() => {
    const bye = (e: PageTransitionEvent) => {
      const l = liveRef.current;
      if (!l || e.persisted) return;
      endNow(l);
    };
    window.addEventListener("pagehide", bye);
    return () => { window.removeEventListener("pagehide", bye); halt(true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Is there a link of mine that is still open? On opening the app and on coming back to it; then every few seconds while one is waiting to be resumed,
  // so the question "share your screen?" appears within moments of somebody opening the link. With no link nothing keeps asking.
  useEffect(() => {
    void refresh();
    const vis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [refresh]);
  const watching = !!st && !live && st.state === "paused";
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, STATUS_MS);
    return () => clearInterval(t);
  }, [watching, refresh]);
  useEffect(() => {
    if (!live && !st) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [live, st]);

  // Somebody opened the link (or asked again) while nothing is being shared: ask, never start by itself.
  const knock = !!st && !live && st.waiting && st.state === "paused" && st.knockAt > dismissed.current && !ask;

  const minsLeft = (at: number) => Math.max(0, Math.round((at - now) / 60_000));
  const isAdmin = (live?.kind ?? ask) === "admin";
  const shareText = live ? `${T("I am sharing my Shubhora screen with you so you can guide me. Open this link to watch (you can only watch; it runs 30 minutes at a time, and if it stops just tap Reconnect on the same link):", "मैं अपनी Shubhora की screen आपको दिखा रहा/रही हूँ ताकि आप मुझे बता सकें। देखने के लिए ये link खोलें (आप सिर्फ़ देख सकते हैं; एक बार में 30 मिनट चलेगा, रुक जाए तो उसी link पर Reconnect दबाएँ):")}\n${live.url}` : "";
  async function copy() {
    const url = live?.url ?? st?.url;
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }
  const sameLink = !live && st && st.state === "paused" && st.kind === (ask ?? "link") ? st : null;
  /** The 30 minutes of this turn ran out: Reconnect gives the same link another 30. */
  const runOut = (x: Status) => x.why === "expired" || x.expiresAt <= now;

  return (
    <>
      {ask && (
        <div data-share-block className="fixed inset-0 z-[70] grid place-items-center bg-black/55 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-base font-bold"><ShieldCheck className="h-5 w-5 text-good" /> {T("Share Screen", "Share Screen")}</p>
              <button type="button" onClick={() => setAsk(null)} aria-label={T("Close", "बंद करें")} className="text-muted"><X className="h-5 w-5" /></button>
            </div>
            {live ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-good/10 px-3 py-2.5 text-sm font-medium">
                  {isAdmin
                    ? T("Request sent. Keep the app open, admin will join soon.", "Request भेज दी। App खुला रखें, admin अभी जुड़ेंगे।")
                    : T("Link ready. Send it on WhatsApp.", "Link तैयार है। WhatsApp पर भेजें।")}
                </p>
                {!isAdmin && <>
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" onClick={() => setAsk(null)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-sm font-bold text-white">{T("Send on WhatsApp", "WhatsApp पर भेजें")}</a>
                  <button type="button" onClick={() => void copy()} className="w-full rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{copied ? T("Copied", "copy हुआ") : T("Copy link", "link copy करें")}</button>
                </>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAsk(null)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Done", "हो गया")}</button>
                  <button type="button" onClick={() => { halt(true); setAsk(null); setNote(T("Sharing stopped.", "sharing बंद हो गई।")); }} className="rounded-xl border border-danger/40 px-3 py-2.5 text-sm font-semibold text-danger">{T("End", "बंद करें")}</button>
                </div>
              </div>
            ) : (<>
            {/* Short and simple (owner, 24 Oct 2026: "customer badi mahabharat nahi padhta"). */}
            <ul className="space-y-1.5 text-sm">
              {[
                isAdmin ? T("Admin sees only your Shubhora screen", "Admin को सिर्फ़ Shubhora screen दिखेगी") : T("They see only your Shubhora screen", "सामने वाले को सिर्फ़ Shubhora screen दिखेगी"),
                allow ? T("They can tap and type for you (you can stop it any time)", "वो आपकी जगह दबा और लिख सकते हैं (आप कभी भी बंद कर सकते हैं)") : T("They can only watch, not tap", "वो सिर्फ़ देख सकते हैं, कुछ दबा नहीं सकते"),
                T("Passwords, OTP and PIN stay hidden", "Password, OTP, PIN छुपे रहेंगे"),
                T("30 min · stopped? tap Reconnect", "30 मिनट · रुक जाए तो Reconnect दबाएँ"),
              ].map((x) => <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-good" /> {x}</li>)}
            </ul>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold"><Hand className="h-4 w-4 text-brand" /> {T("Let them tap & type for me", "उन्हें मेरी जगह दबाने और लिखने दें")}</span>
              <input type="checkbox" className="h-5 w-5" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
            </label>
            {err && <p className="text-xs text-danger">{err}</p>}
            {sameLink && (
              <button type="button" onClick={() => void resume(sameLink)} disabled={busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {runOut(sameLink) ? T("Reconnect", "Reconnect करें") : T(`Continue same link (${minsLeft(sameLink.expiresAt)} min)`, `वही link चालू करें (${minsLeft(sameLink.expiresAt)} मिनट)`)}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAsk(null)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Not now", "अभी नहीं")}</button>
              <button type="button" onClick={() => void start(ask)} disabled={busy} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${sameLink ? "border border-border" : "grad-brand text-white"}`}>
                {busy && !sameLink && <LoaderCircle className="h-4 w-4 animate-spin" />} {isAdmin ? T("Send request", "request भेजें") : sameLink ? T("Make a new link", "नया link बनाएँ") : T("Make link", "link बनाएँ")}
              </button>
            </div>
            </>)}
          </div>
        </div>
      )}

      {/* Somebody opened the link while nothing is shared: the person decides. */}
      {knock && st && (
        <div data-share-block className="fixed inset-0 z-[75] grid place-items-center bg-black/55 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <p className="flex items-center gap-2 text-base font-bold"><Eye className="h-5 w-5 text-brand" /> {T("Share your screen?", "अपनी screen share करें?")}</p>
            <p className="text-sm text-muted">
              {st.kind === "admin"
                ? T("The Shubhora admin is waiting to see your screen.", "Shubhora admin आपकी screen देखने के लिए इंतज़ार कर रहे हैं।")
                : T("Somebody has opened your link and is waiting to see your screen.", "किसी ने आपका link खोला है और आपकी screen देखने का इंतज़ार कर रहे हैं।")}
              {" "}{allow ? T("They will see only your Shubhora screen, and can tap and type for you (stop it any time).", "उन्हें सिर्फ़ आपकी Shubhora screen दिखेगी, और वो आपकी जगह दबा-लिख सकेंगे (कभी भी बंद कर सकते हैं)।") : T("They will see only your Shubhora screen, and can only look.", "उन्हें सिर्फ़ आपकी Shubhora screen दिखेगी, और वो सिर्फ़ देख सकते हैं।")}
            </p>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { dismissed.current = st.knockAt; setSt({ ...st }); }} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Not now", "अभी नहीं")}</button>
              <button type="button" onClick={() => void resume(st)} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {runOut(st) ? T("Reconnect", "Reconnect करें") : T("Share screen", "Screen share करें")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* While it runs, the sender always sees that it runs, how many are watching, the time left, and a way to end it. */}
      {live && (
        <div data-share-block className="fixed left-1/2 z-[65] w-full max-w-md -translate-x-1/2 px-3" style={{ top: "calc(max(0.6rem, env(safe-area-inset-top)) + 0.4rem)" }}>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-[#12144a] px-3 py-2 text-xs font-semibold text-white shadow-card">
            <Eye className="h-4 w-4 shrink-0 text-[#ffd54a]" />
            <span className="min-w-0 flex-1 leading-snug">
              {viewers > 0 ? (live.kind === "admin" ? T("Shubhora admin is watching your screen", "Shubhora admin आपकी screen देख रहे हैं") : T(`${viewers} watching your screen`, `${viewers} लोग आपकी screen देख रहे हैं`)) : (live.kind === "admin" ? T("Request sent. Waiting for the admin.", "request भेज दी। admin का इंतज़ार।") : T("Screen sharing is on. Nobody has opened the link yet.", "screen share चालू है। अभी किसी ने link नहीं खोला।"))}
              <span className="block font-normal text-white/70">{acted ? T("They just tapped for you", "उन्होंने अभी आपकी screen पर दबाया") : T(`${minsLeft(live.expiresAt)} min left`, `${minsLeft(live.expiresAt)} मिनट बचे`)}</span>
            </span>
            <button type="button" onClick={() => { setAllow((a) => !a); setTimeout(() => void push(), 50); }} className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 ${allow ? "bg-[#ffd54a] text-[#12144a]" : "bg-white/15 text-white"}`}>
              <Hand className="h-3.5 w-3.5" /> {allow ? T("Tap: ON", "Control ON") : T("Tap: OFF", "Control OFF")}
            </button>
            {live.kind === "link" && <button type="button" onClick={() => void copy()} className="shrink-0 underline">{copied ? T("Copied", "copy हुआ") : T("Copy link", "link copy")}</button>}
            <button type="button" onClick={() => { halt(true); setNote(T("Sharing stopped.", "sharing बंद हो गई।")); }} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[#12144a]">{T("End", "बंद करें")}</button>
          </div>
        </div>
      )}

      {/* A short notice after it ended, saying what still works. */}
      {!live && note && (
        <div data-share-block className="fixed left-1/2 z-[65] w-full max-w-md -translate-x-1/2 px-3" style={{ top: "calc(max(0.6rem, env(safe-area-inset-top)) + 0.4rem)" }}>
          <div className="flex items-start gap-2 rounded-xl border border-border bg-[#12144a] px-3 py-2 text-xs font-semibold text-white shadow-card">
            <span className="min-w-0 flex-1 leading-snug">
              {note}
              {st && st.state === "paused" && <span className="block font-normal text-white/70">{runOut(st)
                ? T("Tap Reconnect to share again.", "फिर share करने के लिए Reconnect दबाएँ।")
                : T(`Same link works ${minsLeft(st.expiresAt)} more min.`, `वही link ${minsLeft(st.expiresAt)} मिनट और चलेगा।`)}</span>}
              {st && st.state === "paused" && (
                <button type="button" onClick={() => void resume(st)} disabled={busy} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[#12144a] disabled:opacity-60">
                  {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} {T("Reconnect", "Reconnect करें")}
                </button>
              )}
            </span>
            <button type="button" onClick={() => setNote("")} aria-label={T("Close", "बंद करें")} className="shrink-0"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
