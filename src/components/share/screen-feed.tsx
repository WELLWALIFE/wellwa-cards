"use client";
// A live Shubhora screen, drawn on the watcher's own phone from the events the sender's app sends (rrweb's Replayer). Used by the share link page
// (/watch/<link>) and by the admin console, which both read the same relay (lib/live-share.ts), so both are equally quick.
// It is only looked at — unless the SENDER has switched on help by tapping (owner, 25 Oct 2026): then a tap on the picture is sent as a tap on that
// part of their screen, a tap on a box opens a line to type into it, and Up / Down / Back move their page. Their app does it (and refuses secret fields).
import { useEffect, useRef, useState } from "react";
import "rrweb/dist/style.css";

export type FeedRes = {
  status: "live" | "paused" | "ended" | "full" | "notfound"; why?: string; epoch: number; reset: boolean; events: unknown[]; next: number;
  width: number; height: number; viewers: number; expiresAt?: number; control?: boolean;
};
/** Sends a helper's taps to the sender (only works while they allow it). */
export type Controller = (cmds: unknown[]) => Promise<boolean>;
export type Loader = (p: { after: number; epoch: number; vid: string; ask?: boolean }) => Promise<Response>;

/** `fitHeight`: pixels of the window kept for things around the feed; when set, the whole screen fits the window's height too
 *  (the admin console on a computer: owner, 24 Oct 2026 "screen puri nahi dikh rahi"). */
export function ScreenFeed({ load, maxWidth = 1.25, fitHeight, control }: { load: Loader; name?: string; maxWidth?: number; fitHeight?: number; control?: Controller }) {
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
  const [canCtl, setCanCtl] = useState(false);
  const [typing, setTyping] = useState<{ id: number; value: string; label: string } | null>(null);
  const [ctlMsg, setCtlMsg] = useState("");
  type Rp = { iframe: HTMLIFrameElement; getMirror: () => { getId: (n: Node) => number } };
  const rp = useRef<Rp | null>(null);

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
      rp.current = r as unknown as Rp;
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
          setCanCtl(!!r.control);
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
    const fit = () => {
      const w = box.current?.parentElement?.parentElement?.clientWidth ?? window.innerWidth;
      const byH = fitHeight !== undefined ? Math.max(200, window.innerHeight - fitHeight) / size.h : Infinity;
      setScale(Math.min(maxWidth, (w - 8) / size.w, byH));
    };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size.w, size.h, maxWidth, fitHeight]);

  // How long the link still lives.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 60_000)));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  /** The sender's screen element under a tap on the picture, with its id in their app. */
  function hit(e: React.MouseEvent<HTMLDivElement>): { el: Element; id: number } | null {
    const r = rp.current, rect = e.currentTarget.getBoundingClientRect();
    const doc = r?.iframe?.contentDocument;
    if (!r || !doc) return null;
    const x = (e.clientX - rect.left) / scale, y = (e.clientY - rect.top) / scale;
    let el: Element | null = doc.elementFromPoint(x, y);
    // The replay keeps its boxes and buttons from being pressed (pointer-events off), so a hit test misses them: the smallest one under the tap wins.
    let best: Element | null = null, area = Infinity;
    for (const c of Array.from(doc.querySelectorAll("input, textarea, select, button, a, [role=button], label"))) {
      const b = c.getBoundingClientRect();
      if (b.width && b.height && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom && b.width * b.height < area) { best = c; area = b.width * b.height; }
    }
    if (best) el = best;
    const m = r.getMirror();
    while (el && !(m.getId(el) > 0)) el = el.parentElement;
    return el ? { el, id: m.getId(el) } : null;
  }
  async function send(cmds: unknown[], ok: string) {
    if (!control) return;
    const done = await control(cmds).catch(() => false);
    setCtlMsg(done ? ok : "Could not send. They may have switched help off.");
    setTimeout(() => setCtlMsg(""), 2500);
  }
  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    const h = hit(e);
    if (!h) return;
    const tag = h.el.tagName.toLowerCase(), type = (h.el.getAttribute("type") ?? "").toLowerCase();
    if ((tag === "input" && !["checkbox", "radio", "button", "submit", "file", "color", "range"].includes(type)) || tag === "textarea") {
      if (type === "password") { setCtlMsg("Passwords are typed by them only."); return; }
      const label = h.el.getAttribute("placeholder") || h.el.getAttribute("aria-label") || "";
      setTyping({ id: h.id, value: (h.el as HTMLInputElement).value ?? "", label });
      void send([{ t: "click", id: h.id }], "Tapped the box - type below");
      return;
    }
    void send([{ t: "click", id: h.id }], "Tapped");
  }

  async function askAgain() {
    setAsked(true);
    try { await loadRef.current({ after: 0, epoch: 0, vid: askVid.current, ask: true }); } catch { /* the next poll tells the truth */ }
  }

  const msg = state === "ended"
    ? (why === "expired" ? "This link is over. Ask for a new link." : "This link was closed. Ask for a new link.")
    : state === "notfound" ? "This link is over. Ask for a new one."
    : state === "full" ? "Too many people are watching this screen."
    : state === "paused"
      ? (why === "expired" ? "30 minutes are over. Tap Reconnect."
        : why === "stopped" ? "Sharing stopped. It starts here again by itself."
        : why === "offline" ? "Your connection dropped. Trying again…"
        : "Paused for a moment. It starts again by itself.")
    : state === "connecting" || !seen ? "Connecting…" : "";
  const dim = state === "paused" || state === "ended" || state === "notfound" || state === "full";
  const ctl = !!control && canCtl && state === "live" && seen;
  return (
    <>
      <div className="mx-auto flex max-w-md justify-end px-4 pb-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${state === "live" && seen ? "bg-[#25d366]/20 text-[#7dffb0]" : "bg-white/10 text-white/70"}`}>{state === "live" && seen ? "● Live" : state === "connecting" ? "Connecting" : "Not live"}</span>
      </div>
      <div className="mx-auto flex max-w-md justify-center overflow-hidden px-1 pb-4">
        <div style={{ width: size.w * scale, height: size.h * scale, userSelect: "none" }} className={`relative overflow-hidden rounded-2xl bg-white ${dim ? "opacity-30" : ""} ${ctl ? "ring-2 ring-[#ffd54a]" : ""}`}>
          <div ref={box} style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }} />
          {ctl && <div className="absolute inset-0 cursor-pointer" onClick={onTap} onWheel={(e) => { if (Math.abs(e.deltaY) > 30) void send([{ t: "scroll", dy: Math.round(e.deltaY / scale) }], "Scrolled"); }} />}
        </div>
      </div>
      {ctl && (
        <div className="mx-auto max-w-md space-y-2 px-4 pb-3">
          <p className="text-center text-[11px] font-semibold text-[#ffd54a]">They allowed you to tap. Tap on their screen above to press it.</p>
          {typing && (
            <form onSubmit={(e) => { e.preventDefault(); void send([{ t: "input", id: typing.id, value: typing.value }], "Typed"); setTyping(null); }} className="flex gap-2">
              <input autoFocus value={typing.value} onChange={(e) => setTyping({ ...typing, value: e.target.value })} placeholder={typing.label || "Type here"} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none" />
              <button type="submit" className="rounded-xl bg-[#ffd54a] px-3 py-2 text-sm font-bold text-[#12144a]">Send</button>
              <button type="button" onClick={() => setTyping(null)} className="rounded-xl bg-white/10 px-3 py-2 text-sm">x</button>
            </form>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => void send([{ t: "back" }], "Back")} className="rounded-xl bg-white/10 py-2 text-sm font-semibold">Back</button>
            <button type="button" onClick={() => void send([{ t: "scroll", dy: -Math.round(size.h * 0.6) }], "Scrolled up")} className="rounded-xl bg-white/10 py-2 text-sm font-semibold">Up</button>
            <button type="button" onClick={() => void send([{ t: "scroll", dy: Math.round(size.h * 0.6) }], "Scrolled down")} className="rounded-xl bg-white/10 py-2 text-sm font-semibold">Down</button>
          </div>
          {ctlMsg && <p className="text-center text-[11px] text-white/70">{ctlMsg}</p>}
        </div>
      )}
      {msg && <p className="mx-auto max-w-md px-6 pb-3 text-center text-sm text-white/80">{msg}</p>}
      {state === "paused" && why !== "offline" && (
        <div className="mx-auto max-w-md px-6 pb-3 text-center">
          <button type="button" onClick={() => void askAgain()} disabled={asked} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#12144a] disabled:opacity-60">
            {asked ? "Asked. Please wait." : why === "expired" ? "Reconnect" : "Ask them to share again"}
          </button>
        </div>
      )}
      {left !== null && state !== "ended" && state !== "notfound" && why !== "expired" && (
        <p className="mx-auto max-w-md px-6 pb-8 text-center text-[11px] text-white/50">This link works for {left} more minute{left === 1 ? "" : "s"}.</p>
      )}
    </>
  );
}
