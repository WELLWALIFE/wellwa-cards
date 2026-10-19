"use client";
// The viewer's side: the sender's Shubhora screen, drawn live from the events the sender's app sends (rrweb's Replayer), on the viewer's own phone.
// It can only be looked at: the replay sits in a sandboxed frame with scripts off, takes no taps, and the viewer has no way to send anything back.
import { useEffect, useRef, useState } from "react";
import "rrweb/dist/style.css";

type Res = { status: "live" | "ended" | "full" | "notfound"; why?: string; epoch: number; reset: boolean; events: unknown[]; next: number; width: number; height: number; viewers: number };

export function WatchScreen({ token }: { token: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"connecting" | "live" | "ended" | "full" | "notfound">("connecting");
  const [why, setWhy] = useState("");
  const [size, setSize] = useState({ w: 390, h: 844 });
  const [scale, setScale] = useState(1);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let stop = false;
    type R = { addEvent: (e: unknown) => void; startLive: (t?: number) => void; destroy: () => void; on: (n: string, f: (d: { width: number; height: number }) => void) => void };
    const cur: { r: R | null } = { r: null };
    const vid = Math.random().toString(36).slice(2, 12);
    let after = 0, epoch = 0, first = true;

    async function make(events: unknown[]) {
      cur.r?.destroy(); cur.r = null;
      if (box.current) box.current.innerHTML = "";
      const { Replayer } = await import("rrweb");
      if (stop || !box.current) return;
      const r = new Replayer([], { root: box.current, liveMode: true, mouseTail: false, triggerFocus: false, UNSAFE_replayCanvas: false }) as unknown as R;
      r.on("resize", (d) => setSize({ w: d.width, h: d.height }));
      r.startLive();
      for (const e of events) r.addEvent(e);
      cur.r = r;
    }

    (async () => {
      let fails = 0;
      while (!stop) {
        try {
          const resp = await fetch(`/api/share/watch?token=${encodeURIComponent(token)}&after=${after}&epoch=${epoch}&v=${vid}`, { cache: "no-store" });
          if (resp.status === 404) { setState("notfound"); return; }
          const r = (await resp.json()) as Res;
          fails = 0;
          if (r.status === "ended") { setWhy(r.why ?? ""); setState("ended"); return; }
          if (r.status === "full") { setState("full"); return; }
          if (r.reset || first) { await make(r.events); first = false; epoch = r.epoch; }
          else for (const e of r.events) cur.r?.addEvent(e);
          after = r.next;
          if (r.width && r.height) setSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
          if (r.events.length) setSeen(true);
          setState("live");
        } catch {
          if (++fails > 6) { setState("ended"); return; }
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    })();
    return () => { stop = true; cur.r?.destroy(); };
  }, [token]);

  // Fit the sender's screen to this phone.
  useEffect(() => {
    const fit = () => { const w = box.current?.parentElement?.clientWidth ?? window.innerWidth; setScale(Math.min(1.25, (w - 8) / size.w)); };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size.w]);

  const msg = state === "ended"
    ? (why === "away" ? "Sharing paused: the other person left the app. Ask them to share again." : "Sharing has ended.")
    : state === "notfound" ? "This link is not valid, or sharing has already ended."
    : state === "full" ? "Too many people are watching this screen."
    : state === "connecting" || !seen ? "Connecting…" : "";
  return (
    <div className="min-h-screen bg-[#0b0e33] text-white">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-bold">Shubhora <span className="font-normal text-white/60">· live screen</span></span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${state === "live" && seen ? "bg-[#25d366]/20 text-[#7dffb0]" : "bg-white/10 text-white/70"}`}>{state === "live" && seen ? "● Live" : state === "connecting" ? "Connecting" : "Not live"}</span>
      </div>
      <p className="mx-auto max-w-md px-4 pb-2 text-center text-[11px] text-white/60">You can only watch. Nothing you do here reaches their phone. Hindi: आप सिर्फ़ देख सकते हैं।</p>
      <div className="mx-auto flex max-w-md justify-center overflow-hidden px-1 pb-8">
        <div style={{ width: size.w * scale, height: size.h * scale, pointerEvents: "none", userSelect: "none" }} className={`relative overflow-hidden rounded-2xl bg-white ${state === "ended" || state === "notfound" || state === "full" ? "opacity-30" : ""}`}>
          <div ref={box} style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        </div>
      </div>
      {msg && <p className="mx-auto max-w-md px-6 pb-10 text-center text-sm text-white/80">{msg}</p>}
    </div>
  );
}
