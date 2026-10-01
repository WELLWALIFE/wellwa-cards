"use client";
// Live help — the card holder's screen, replayed in the console as they use it.
//
// Their app records its own page (src/components/poster/help-dock.tsx) and posts it every couple of
// seconds; this asks for whatever is new and plays it. It is a replay of their page, not a video and not
// a remote control: nothing here can click anything on their phone. To move them, use "Send them to a
// screen", which their app follows with the banner still showing.
//
// Only the Shubhora app is ever recorded — never another app or tab of theirs — and password fields are
// never sent.

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MonitorSmartphone, TriangleAlert } from "lucide-react";
import { adminHeaders } from "@/lib/admin-client";

/** How often the console asks for what is new. Their app posts every 2s, so this keeps up without racing. */
const POLL_MS = 1_500;

type Ev = { type?: number; timestamp?: number; data?: { width?: number; height?: number } };
type Feed = { events: Ev[]; last: number; fresh: boolean; error?: string };
// Only the bits of rrweb's Replayer this uses.
type Player = { addEvent: (e: Ev) => void; startLive: (t?: number) => void; pause: () => void; destroy?: () => void };

export function LiveScreen({ sessionId, live }: { sessionId: string; live: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const last = useRef<number | null>(null);
  const [state, setState] = useState<"starting" | "playing" | "waiting" | "error">("starting");
  // The size of the phone screen being replayed, so it can be scaled to fit this panel.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);

  const pull = useCallback(async (): Promise<Feed | null> => {
    try {
      const q = last.current === null ? "" : `&after=${last.current}`;
      const r = await fetch(`/api/admin/support/events?id=${encodeURIComponent(sessionId)}${q}`, {
        headers: await adminHeaders(), cache: "no-store",
      });
      const j = (await r.json()) as Feed;
      return r.ok ? j : null;
    } catch { return null; }
  }, [sessionId]);

  // A new session means a new replay: throw the old one away.
  useEffect(() => {
    last.current = null;
    setSize(null);
    setState("starting");
    try { player.current?.pause(); } catch { /* already gone */ }
    player.current = null;
    if (host.current) host.current.innerHTML = "";
  }, [sessionId]);

  useEffect(() => {
    if (!live) return;
    let gone = false;

    const step = async () => {
      if (gone) return;
      const feed = await pull();
      if (gone || !feed) return;

      if (!player.current) {
        // Nothing to build on yet — their app has not sent a complete picture of the page.
        if (!feed.events.length) { setState("waiting"); return; }
        const { Replayer } = (await import("rrweb")) as unknown as { Replayer: new (e: Ev[], o: Record<string, unknown>) => Player };
        if (gone || !host.current) return;
        const meta = feed.events.find((e) => e.type === 4);
        if (meta?.data?.width && meta.data.height) setSize({ w: meta.data.width, h: meta.data.height });
        host.current.innerHTML = "";
        const p = new Replayer(feed.events, {
          root: host.current,
          liveMode: true,
          mouseTail: false,
          // The replay must never reach back out to their session or ours.
          UNSAFE_replayCanvas: false,
        });
        p.startLive(feed.events[0]?.timestamp);
        player.current = p;
        last.current = feed.last;
        setState("playing");
        return;
      }

      for (const e of feed.events) {
        if (e.type === 4 && e.data?.width && e.data.height) setSize({ w: e.data.width, h: e.data.height });
        player.current.addEvent(e);
      }
      last.current = feed.last;
      if (feed.events.length) setState("playing");
    };

    step();
    const timer = setInterval(step, POLL_MS);
    return () => { gone = true; clearInterval(timer); };
  }, [live, sessionId, pull]);

  // A phone screen is taller and narrower than this panel: shrink it to fit, never stretch it.
  useEffect(() => {
    const fit = () => {
      if (!box.current || !size) return;
      setScale(Math.min(1, box.current.clientWidth / size.w));
    };
    fit();
    if (!box.current) return;
    const ro = new ResizeObserver(fit);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [size]);

  if (!live) {
    return (
      <p className="rounded-xl bg-surface2 px-3 py-6 text-center text-sm text-muted">
        Their screen appears here once the session is live.
      </p>
    );
  }

  return (
    <div ref={box} className="overflow-hidden rounded-xl border border-border bg-bg">
      {state !== "playing" && (
        <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted">
          {state === "error"
            ? <><TriangleAlert className="h-4 w-4 text-amber" /> Could not load their screen.</>
            : <><LoaderCircle className="h-4 w-4 animate-spin" /> Waiting for their screen… they may have the app in the background.</>}
        </p>
      )}
      {/* The replay is drawn at the size their phone actually is, then scaled down to fit this panel. */}
      <div style={size ? { height: size.h * scale, overflow: "hidden" } : undefined}>
        <div ref={host} style={size ? { width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: "top left" } : undefined} />
      </div>
      {state === "playing" && (
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11px] text-muted">
          <MonitorSmartphone className="h-3.5 w-3.5" /> Their screen, live. You are watching — nothing you do here touches their phone.
        </p>
      )}
    </div>
  );
}
