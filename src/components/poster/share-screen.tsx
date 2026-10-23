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
import { Eye, LoaderCircle, ShieldCheck, X } from "lucide-react";
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
      const r = await fetch("/api/share/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: l.token, secret: l.secret, events, ...(extra ?? {}) }), keepalive: !!extra?.end, cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { viewers?: number; ended?: string; paused?: string };
      if (typeof j.viewers === "number") setViewers(j.viewers);
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
                    ? T("Your request has gone to the Shubhora admin. Keep this app open: they will join in a moment and see only your Shubhora screen.", "आपकी request Shubhora admin के पास पहुँच गई है। app खुला रखें: वो अभी जुड़ेंगे और सिर्फ़ आपकी Shubhora screen देखेंगे।")
                    : T("Your link is ready and runs 30 minutes at a time (it can reconnect on the same link). Send it to whoever should watch. Your screen is being shared now.", "आपका link तैयार है, एक बार में 30 मिनट चलेगा (रुकने पर उसी link से Reconnect हो जाएगा)। जिसे दिखाना है उसे भेजें। आपकी screen अब share हो रही है।")}
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
            <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2.5 text-sm font-semibold">
              {isAdmin
                ? T("Only your Shubhora screen is shown to the Shubhora admin. Nothing else.", "Shubhora admin को सिर्फ़ आपकी Shubhora screen दिखेगी। और कुछ नहीं।")
                : T("Only your Shubhora screen is shown to whoever gets the link. Nothing else.", "जिसे link मिलेगा उसे सिर्फ़ आपकी Shubhora screen दिखेगी। और कुछ नहीं।")}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("They can only look. Nothing can be tapped, changed or sent from their side.", "वो सिर्फ़ देख सकते हैं। उनकी तरफ़ से कुछ दबाया, बदला या भेजा नहीं जा सकता।")}</li>
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("No other app, no phone screen, no passwords. Fields that look like a PIN, OTP or card are hidden.", "कोई दूसरा app, phone की screen या password नहीं। PIN, OTP, card जैसे fields छिपे रहते हैं।")}</li>
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("It stops when you tap End, or by itself after 30 minutes. After that you do not need a new link: tap Reconnect (or they tap it on their side) and the same link runs again; you will be asked before your screen is shared again.", "ये तब रुकता है जब आप End दबाएँ, या 30 मिनट बाद अपने आप। उसके बाद नया link नहीं बनाना पड़ेगा: Reconnect दबाएँ (या सामने वाला अपनी तरफ़ दबाए) और वही link फिर चलेगा; screen दोबारा share होने से पहले आपसे पूछा जाएगा।")}</li>
            </ul>
            {err && <p className="text-xs text-danger">{err}</p>}
            {sameLink && (
              <button type="button" onClick={() => void resume(sameLink)} disabled={busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {runOut(sameLink) ? T("Reconnect on the same link (30 min)", "उसी link से Reconnect करें (30 मिनट)") : T(`Continue with the same link (${minsLeft(sameLink.expiresAt)} min left)`, `वही link जारी रखें (${minsLeft(sameLink.expiresAt)} मिनट बचे)`)}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAsk(null)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Not now", "अभी नहीं")}</button>
              <button type="button" onClick={() => void start(ask)} disabled={busy} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${sameLink ? "border border-border" : "grad-brand text-white"}`}>
                {busy && !sameLink && <LoaderCircle className="h-4 w-4 animate-spin" />} {isAdmin ? T("Send request", "request भेजें") : sameLink ? T("Make a new link", "नया link बनाएँ") : T("Make link", "link बनाएँ")}
              </button>
            </div>
            {!isAdmin && <p className="text-[11px] leading-snug text-muted">{T("Next you choose who gets the link, on WhatsApp.", "इसके बाद आप WhatsApp पर चुनेंगे कि link किसे भेजना है।")}</p>}
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
              {" "}{T("They will see only your Shubhora screen, and can only look.", "उन्हें सिर्फ़ आपकी Shubhora screen दिखेगी, और वो सिर्फ़ देख सकते हैं।")}
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
              <span className="block font-normal text-white/70">{T(`${minsLeft(live.expiresAt)} min left`, `${minsLeft(live.expiresAt)} मिनट बचे`)}</span>
            </span>
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
                ? T("No new link needed: tap Reconnect and the same link runs for another 30 min.", "नया link नहीं चाहिए: Reconnect दबाएँ, वही link 30 मिनट और चलेगा।")
                : T(`The same link still works for ${minsLeft(st.expiresAt)} more min. You will be asked before sharing again.`, `वही link ${minsLeft(st.expiresAt)} मिनट और चलेगा। दोबारा share करने से पहले आपसे पूछा जाएगा।`)}</span>}
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
