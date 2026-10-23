"use client";
// A live Shubhora screen, drawn on the watcher's own phone from the events the sender's app sends (rrweb's Replayer). Used by the share link page
// (/watch/<link>) and by the admin console, which both read the same relay (lib/live-share.ts), so both are equally quick.
// It can only be looked at: the replay takes no taps, and nothing here can send anything to the sender's phone except the polite "share again?" nudge.
import { useEffect, useRef, useState } from "react";
import "rrweb/dist/style.css";

export type FeedRes = {
  status: "live" | "paused" | "ended" | "full" | "notfound"; why?: string; epoch: number; reset: boolean; events: unknown[]; next: number;
  width: number; height: number; viewers: number; expiresAt?: number;
};
export type Loader = (p: { after: number; epoch: number; vid: string; ask?: boolean }) => Promise<Response>;

export function ScreenFeed({ load, name = "the other person", maxWidth = 1.25 }: { load: Loader; name?: string; maxWidth?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  const askVid = useRef("");
  const [state, setState] = useState<"connecting" | "live" | "paused" | "ended" | "full" | "notfound">("connecting");
  const [why, setWhy] = useState("");
  const [size, setSize] = useState({ w: 390, h: 844 });
  const [scale, setScale] = useState(1);
  const [seen, setSeen] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);

  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    let stop = false;
    type R = { addEvent: (e: unknown) => void; startLive: (t?: number) => void; destroy: () => void; on: (n: string, f: (d: { width: number; height: number }) => void) => void };
    const cur: { r: R | null } = { r: null };
    const vid = Math.random().toString(36).slice(2, 12);
    askVid.current = vid;
    let after = 0, epoch = 0, first = true;
    // The sender's own clock is never trusted: rrweb plays a live event when its time comes, so every event is stamped here, on ARRIVAL, a moment after
    // the replayer's start. (A phone whose clock is minutes off would otherwise be shown minutes late; a batch arrives and plays at once, in order.)
    let base = 0, t0 = 0;
    const stamp = (e: unknown) => ({ ...(e as Record<string, unknown>), timestamp: base + Math.round(performance.now() - t0) + 1 });

    async function make(events: unknown[]) {
      cur.r?.destroy(); cur.r = null;
      if (box.current) box.current.innerHTML = "";
      const { Replayer } = await import("rrweb");
      if (stop || !box.current) return;
      const r = new Replayer([], { root: box.current, liveMode: true, mouseTail: false, triggerFocus: false, UNSAFE_replayCanvas: false }) as unknown as R;
      r.on("resize", (d) => setSize({ w: d.width, h: d.height }));
      base = Date.now(); t0 = performance.now();
      r.startLive(base);
      for (const e of events) r.addEvent(stamp(e));
      cur.r = r;
    }

    (async () => {
      let fails = 0;
      while (!stop) {
        try {
          const resp = await loadRef.current({ after, epoch, vid });
          if (resp.status === 404) { setState("notfound"); return; }
          const r = (await resp.json()) as FeedRes;
          fails = 0;
          if (typeof r.expiresAt === "number") setExpiresAt(r.expiresAt);
          if (r.status === "ended") { setWhy(r.why ?? ""); setState("ended"); return; }
          if (r.status === "full") { setState("full"); return; }
          if (r.reset || first) {
            if (r.events.length || first) { await make(r.events); first = false; }
            epoch = r.epoch;
          } else for (const e of r.events) cur.r?.addEvent(stamp(e));
          after = r.next;
          if (r.width && r.height) setSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
          if (r.events.length) setSeen(true);
          if (r.status === "paused") { setWhy(r.why ?? ""); setState("paused"); }
          else { setWhy(""); setAsked(false); setState("live"); }
        } catch {
          // a hiccup in the network: try again; many in a row means the connection is gone
          if (++fails > 6) { setState("paused"); setWhy("offline"); fails = 3; }
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    })();
    return () => { stop = true; cur.r?.destroy(); };
  }, []);

  // Fit the sender's screen to this phone.
  useEffect(() => {
    const fit = () => { const w = box.current?.parentElement?.parentElement?.clientWidth ?? window.innerWidth; setScale(Math.min(maxWidth, (w - 8) / size.w)); };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size.w, maxWidth]);

  // How long the link still lives.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 60_000)));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  async function askAgain() {
    setAsked(true);
    try { await loadRef.current({ after: 0, epoch: 0, vid: askVid.current, ask: true }); } catch { /* the next poll tells the truth */ }
  }

  const msg = state === "ended"
    ? (why === "expired" ? "This link is over. Ask for a new link." : "This link was closed. Ask for a new link.")
    : state === "notfound" ? "This link is not valid, or it is already over."
    : state === "full" ? "Too many people are watching this screen."
    : state === "paused"
      ? (why === "expired" ? `The 30 minutes are over. Tap Reconnect: ${name} will be asked on their phone, and this same link carries on (no new link needed).`
        : why === "stopped" ? `${name} stopped sharing. If they share again it continues here by itself, you do not need a new link.`
        : why === "offline" ? "Your connection dropped. Trying again…"
        : `Paused: ${name} has left the app for a moment. It continues here by itself when they are back.`)
    : state === "connecting" || !seen ? "Connecting…" : "";
  const dim = state === "paused" || state === "ended" || state === "notfound" || state === "full";
  return (
    <>
      <div className="mx-auto flex max-w-md justify-end px-4 pb-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${state === "live" && seen ? "bg-[#25d366]/20 text-[#7dffb0]" : "bg-white/10 text-white/70"}`}>{state === "live" && seen ? "● Live" : state === "connecting" ? "Connecting" : "Not live"}</span>
      </div>
      <div className="mx-auto flex max-w-md justify-center overflow-hidden px-1 pb-4">
        <div style={{ width: size.w * scale, height: size.h * scale, pointerEvents: "none", userSelect: "none" }} className={`relative overflow-hidden rounded-2xl bg-white ${dim ? "opacity-30" : ""}`}>
          <div ref={box} style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        </div>
      </div>
      {msg && <p className="mx-auto max-w-md px-6 pb-3 text-center text-sm text-white/80">{msg}</p>}
      {state === "paused" && why !== "offline" && (
        <div className="mx-auto max-w-md px-6 pb-3 text-center">
          <button type="button" onClick={() => void askAgain()} disabled={asked} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#12144a] disabled:opacity-60">
            {asked ? "Asked. They will see a question on their phone." : why === "expired" ? "Reconnect" : "Ask them to share again"}
          </button>
        </div>
      )}
      {left !== null && state !== "ended" && state !== "notfound" && why !== "expired" && (
        <p className="mx-auto max-w-md px-6 pb-8 text-center text-[11px] text-white/50">This link works for {left} more minute{left === 1 ? "" : "s"}.</p>
      )}
    </>
  );
}
