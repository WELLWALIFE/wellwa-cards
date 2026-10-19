"use client";
// "Apni screen kisi ko dikhayein" — the sender's side (owner, 19 Oct 2026). One tap makes a link; whoever opens it sees THIS Shubhora screen live, and
// can only look. Opened from the Help panel (a window event), so it works on every screen of the app.
//
// What the person is told, before anything starts, is exactly what happens: only this app's screen, only to whoever gets the link, nothing can be
// done from the other side, a password is never shown, and it ends when they tap Stop, close the app, or after a while. lib/live-share.ts is the server.

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

export const SHARE_SCREEN_EVENT = "shubhora:share-screen";
const FLUSH_MS = 400;
const BEAT_MS = 10_000;
/** Inputs that must never leave the phone even though what is typed elsewhere is shown (the owner's call, 1 Oct 2026): codes, PINs, cards, banks, IDs. */
const SECRET_FIELD = /otp|one-time|passcode|password|\bpin\b|cvv|cvc|card|aadhaar|aadhar|\bpan\b|account|ifsc|upi|bank/i;

type Live = { token: string; secret: string; url: string };

export function ShareScreen() {
  const { lang } = useT();
  const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [viewers, setViewers] = useState(0);
  const [copied, setCopied] = useState(false);
  const liveRef = useRef<Live | null>(null);
  const stopRec = useRef<(() => void) | undefined>(undefined);
  const buffer = useRef<unknown[]>([]);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    const open = () => { setErr(""); setAsk(true); };
    window.addEventListener(SHARE_SCREEN_EVENT, open);
    return () => window.removeEventListener(SHARE_SCREEN_EVENT, open);
  }, []);

  const push = useCallback(async (extra?: { end?: boolean }) => {
    const l = liveRef.current;
    if (!l) return;
    const events = buffer.current; buffer.current = [];
    try {
      // keepalive is only for the tiny "end" message: a keepalive request may not carry more than 64 KB, and the first picture of a screen is several times that.
      const r = await fetch("/api/share/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: l.token, secret: l.secret, events, ...(extra ?? {}) }), keepalive: !!extra?.end, cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { viewers?: number; ended?: string };
      if (typeof j.viewers === "number") setViewers(j.viewers);
      if (j.ended || r.status === 403) halt(false);
    } catch {
      // offline for a moment (or a slow send): what was not sent goes back in front, so the next push carries it (and the first picture is never lost)
      if (!extra?.end && liveRef.current) buffer.current = [...events, ...buffer.current].slice(-4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ends the link on the server with a small message that always goes (a beacon: no size limit trouble, it survives the page closing). */
  function endNow(l: Live) {
    const body = JSON.stringify({ token: l.token, secret: l.secret, end: true });
    let sent = false;
    try { sent = navigator.sendBeacon("/api/share/push", new Blob([body], { type: "application/json" })); } catch { /* below */ }
    if (!sent) void fetch("/api/share/push", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, cache: "no-store" }).catch(() => undefined);
  }

  /** Stops recording and, when asked, tells the server (the link ends at once; otherwise it ends by itself within 2 minutes). */
  function halt(tell: boolean) {
    stopRec.current?.(); stopRec.current = undefined;
    for (const t of timers.current) clearInterval(t); timers.current = [];
    if (tell && liveRef.current) endNow(liveRef.current);
    liveRef.current = null; buffer.current = [];
    setLive(null); setViewers(0);
  }

  async function start() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api<Live & { error?: string }>("/api/share", { method: "POST", json: {} });
      if (!r.ok || !r.data.token) throw new Error(r.data.error || T("Could not make the link. Please try again.", "link नहीं बन पाया। दोबारा कोशिश करें।"));
      const l: Live = { token: r.data.token, secret: r.data.secret, url: r.data.url };
      liveRef.current = l; setLive(l);
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
    } catch (e) {
      halt(false);
      setErr(e instanceof Error ? e.message : T("Could not make the link. Please try again.", "link नहीं बन पाया। दोबारा कोशिश करें।"));
    } finally { setBusy(false); }
  }

  // Closing the page ends the link at once (a phone that only switches app is covered by the server: 2 minutes without a sign of life).
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

  const shareText = live ? `${T("I am sharing my Shubhora screen with you so you can guide me. Open this link to watch (you can only watch):", "मैं अपनी Shubhora की screen आपको दिखा रहा/रही हूँ ताकि आप मुझे बता सकें। देखने के लिए ये link खोलें (आप सिर्फ़ देख सकते हैं):")}\n${live.url}` : "";
  async function copy() {
    if (!live) return;
    try { await navigator.clipboard.writeText(live.url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }

  return (
    <>
      {ask && (
        <div data-share-block className="fixed inset-0 z-[70] grid place-items-center bg-black/55 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-base font-bold"><ShieldCheck className="h-5 w-5 text-good" /> {T("Show your screen to someone", "अपनी screen किसी को दिखाएँ")}</p>
              <button type="button" onClick={() => setAsk(false)} aria-label={T("Close", "बंद करें")} className="text-muted"><X className="h-5 w-5" /></button>
            </div>
            {live ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-good/10 px-3 py-2.5 text-sm font-medium">{T("Your link is ready. Send it to whoever should watch. Your screen is being shared now.", "आपका link तैयार है। जिसे दिखाना है उसे भेजें। आपकी screen अब share हो रही है।")}</p>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" onClick={() => setAsk(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-sm font-bold text-white">{T("Send on WhatsApp", "WhatsApp पर भेजें")}</a>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void copy()} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{copied ? T("Copied", "copy हुआ") : T("Copy link", "link copy करें")}</button>
                  <button type="button" onClick={() => setAsk(false)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Done", "हो गया")}</button>
                </div>
                <button type="button" onClick={() => { halt(true); setAsk(false); }} className="w-full rounded-xl px-3 py-2 text-xs font-semibold text-danger">{T("Stop sharing", "share बंद करें")}</button>
              </div>
            ) : (<>
            <ul className="space-y-2 text-sm">
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("Whoever gets the link sees only your Shubhora app screen, as you use it.", "जिसे link मिलेगा वो सिर्फ़ आपकी Shubhora app की screen देख पाएगा, जैसे आप चलाते हैं।")}</li>
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("He or she can only look. Nothing can be tapped, changed or sent from their side.", "वो सिर्फ़ देख सकता/सकती है। उनकी तरफ़ से कुछ दबाया, बदला या भेजा नहीं जा सकता।")}</li>
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("Nothing else is shared: no other app, no phone screen, no passwords. Fields that look like a PIN, OTP or card are hidden.", "और कुछ नहीं दिखता: कोई दूसरा app, phone की screen, या password नहीं। PIN, OTP, card जैसे fields छिपे रहते हैं।")}</li>
              <li className="rounded-xl bg-surface2 px-3 py-2.5">{T("It stops when you tap Stop, when you close the app, or by itself after a while.", "ये तब बंद हो जाता है जब आप 'रोकें' दबाएँ, app बंद करें, या कुछ देर बाद अपने आप।")}</li>
            </ul>
            {err && !live && <p className="text-xs text-danger">{err}</p>}
            {!live && <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAsk(false)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold">{T("Not now", "अभी नहीं")}</button>
              <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Make link", "link बनाएँ")}
              </button>
            </div>}
            <p className="text-[11px] leading-snug text-muted">{T("Next you choose who gets the link, on WhatsApp.", "इसके बाद आप WhatsApp पर चुनेंगे कि link किसे भेजना है।")}</p>
            </>)}
          </div>
        </div>
      )}

      {/* While it runs, the sender always sees that it runs, how many are watching, and a way to stop it. */}
      {live && (
        <div data-share-block className="fixed left-1/2 z-[65] w-full max-w-md -translate-x-1/2 px-3" style={{ top: "calc(max(0.6rem, env(safe-area-inset-top)) + 0.4rem)" }}>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-[#12144a] px-3 py-2 text-xs font-semibold text-white shadow-card">
            <Eye className="h-4 w-4 shrink-0 text-[#ffd54a]" />
            <span className="min-w-0 flex-1 leading-snug">{viewers > 0 ? T(`${viewers} watching your screen`, `${viewers} लोग आपकी screen देख रहे हैं`) : T("Screen sharing is on. Nobody has opened the link yet.", "screen share चालू है। अभी किसी ने link नहीं खोला।")}</span>
            <button type="button" onClick={() => void copy()} className="shrink-0 underline">{copied ? T("Copied", "copy हुआ") : T("Copy link", "link copy")}</button>
            <button type="button" onClick={() => halt(true)} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[#12144a]">{T("Stop", "रोकें")}</button>
          </div>
        </div>
      )}
    </>
  );
}
