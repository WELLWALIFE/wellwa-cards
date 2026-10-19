import "server-only";
// "Apni screen kisi ko dikhayein" (owner, 19 Oct 2026): the owner of an account sends a link to anyone; whoever opens it sees the Shubhora screen
// of that person live, on their own phone, to guide them. See only: nothing a viewer does ever reaches the sender's app.
//
// How it is kept safe:
//   • Two different secrets. The link carries the VIEW token only. The SENDER's app alone holds the push secret (given once, at creation, to the
//     logged-in person); without it nothing can be written, ended or changed, so a viewer — or anyone who guessed a link — can only read.
//   • What is shared is only what the sender's Shubhora page draws (rrweb): never another app or tab, never a password (masked at the source),
//     never cookies, tokens or the address bar.
//   • It ends by itself: when the sender taps Stop, when the page is closed, when the app has not been heard from for 2 minutes, or after 3 hours.
//   • Nothing is stored on disk: it lives in this server's memory only, and is gone at the end (or at a restart).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type Ev = { type: number; data?: { width?: number; height?: number } & Record<string, unknown>; timestamp?: number } & Record<string, unknown>;
export type EndReason = "stopped" | "away" | "expired";
type Share = {
  token: string; secretHash: Buffer; uid: string; at: number; lastBeat: number;
  ended: EndReason | null; endedAt: number;
  events: { i: number; e: Ev }[]; nextI: number; epoch: number; meta: Ev | null; bytes: number;
  width: number; height: number;
  viewers: Map<string, number>; waiters: Set<() => void>;
};

export const AWAY_MS = 120_000;            // the sender's app not heard from this long: the link ends
export const MAX_MS = 3 * 60 * 60_000;     // longest a link lives
const KEEP_ENDED_MS = 10 * 60_000;         // an ended link still says "ended" for a while, then is forgotten
export const MAX_VIEWERS = 8;
const VIEWER_SEEN_MS = 40_000;
const MAX_BYTES = 6_000_000;               // a session whose picture grows past this is ended (a normal one is far smaller: it is re-based every few seconds)

const g = globalThis as unknown as { __liveShares?: Map<string, Share> };
const shares = (g.__liveShares ??= new Map<string, Share>());
const TOKEN = /^[a-f0-9]{32}$/;
const hash = (s: string) => createHash("sha256").update(s).digest();

function wake(s: Share) { for (const w of [...s.waiters]) w(); }
function finish(s: Share, why: EndReason) {
  if (s.ended) return;
  s.ended = why; s.endedAt = Date.now(); s.events = []; s.bytes = 0; s.meta = null;
  wake(s);
}
/** Ends what is stale, forgets what is old. Called on every request (no timers: nothing runs while nobody is using it). */
function sweep() {
  const now = Date.now();
  for (const [t, s] of shares) {
    if (!s.ended && now - s.lastBeat > AWAY_MS) finish(s, "away");
    else if (!s.ended && now - s.at > MAX_MS) finish(s, "expired");
    else if (s.ended && now - s.endedAt > KEEP_ENDED_MS) shares.delete(t);
  }
}

export function findShare(token: string): Share | null {
  sweep();
  return TOKEN.test(token) ? shares.get(token) ?? null : null;
}
/** The push secret, compared in constant time. */
export function secretOk(s: Share, secret: unknown): boolean {
  return typeof secret === "string" && secret.length > 10 && secret.length < 200 && timingSafeEqual(hash(secret), s.secretHash);
}

/** A new link for this account (an earlier running one of the same account ends: one at a time). */
export function createShare(uid: string): { token: string; secret: string } {
  sweep();
  for (const s of shares.values()) if (s.uid === uid && !s.ended) finish(s, "stopped");
  const token = randomBytes(16).toString("hex"), secret = randomBytes(24).toString("base64url");
  const now = Date.now();
  shares.set(token, { token, secretHash: hash(secret), uid, at: now, lastBeat: now, ended: null, endedAt: 0, events: [], nextI: 1, epoch: 1, meta: null, bytes: 0, width: 390, height: 844, viewers: new Map(), waiters: new Set() });
  return { token, secret };
}

export function viewerCount(s: Share): number {
  const now = Date.now();
  for (const [v, t] of s.viewers) if (now - t > VIEWER_SEEN_MS) s.viewers.delete(v);
  return s.viewers.size;
}

/** The sender's batch of screen events. Returns how many are watching, and whether the link has ended. */
export function pushEvents(s: Share, events: unknown[]): { viewers: number; ended: EndReason | null } {
  s.lastBeat = Date.now();
  if (s.ended) return { viewers: 0, ended: s.ended };
  for (const raw of events.slice(0, 1000)) {
    if (!raw || typeof raw !== "object" || typeof (raw as Ev).type !== "number") continue;
    const e = raw as Ev;
    if (e.type === 4) { s.meta = e; const w = Number(e.data?.width), h = Number(e.data?.height); if (w > 100 && w < 4000 && h > 100 && h < 8000) { s.width = w; s.height = h; } }
    if (e.type === 2) {   // a complete picture: everything before it is no longer needed, a viewer starts from here
      s.events = []; s.bytes = 0; s.epoch++;
      if (s.meta) { s.events.push({ i: s.nextI++, e: s.meta }); }
    }
    s.events.push({ i: s.nextI++, e });
    s.bytes += JSON.stringify(e).length;
  }
  if (s.bytes > MAX_BYTES) finish(s, "expired");
  wake(s);
  return { viewers: viewerCount(s), ended: s.ended };
}

export function endShare(s: Share, why: EndReason = "stopped") { finish(s, why); }

export type WatchResult = { status: "live" | "ended" | "full"; why?: EndReason; epoch: number; reset: boolean; events: Ev[]; next: number; width: number; height: number; viewers: number };
/** What a viewer has not seen yet. Waits (long poll) until there is something, the link ends, or `waitMs` runs out. */
export async function watch(s: Share, viewerId: string, after: number, epoch: number, waitMs: number): Promise<WatchResult> {
  if (!s.viewers.has(viewerId) && viewerCount(s) >= MAX_VIEWERS) return { status: "full", epoch: s.epoch, reset: false, events: [], next: after, width: s.width, height: s.height, viewers: viewerCount(s) };
  s.viewers.set(viewerId, Date.now());
  const snap = (): WatchResult => {
    s.viewers.set(viewerId, Date.now());
    if (s.ended) return { status: "ended", why: s.ended, epoch: s.epoch, reset: false, events: [], next: after, width: s.width, height: s.height, viewers: viewerCount(s) };
    const first = s.events[0]?.i ?? s.nextI;
    const reset = epoch !== s.epoch || after < first - 1;
    const list = (reset ? s.events : s.events.filter((x) => x.i > after)).map((x) => x.e);
    return { status: "live", epoch: s.epoch, reset, events: list, next: s.nextI - 1, width: s.width, height: s.height, viewers: viewerCount(s) };
  };
  let r = snap();
  if (r.status === "live" && !r.events.length && waitMs > 0) {
    await new Promise<void>((resolve) => {
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(t); s.waiters.delete(fin); resolve(); };
      const t = setTimeout(fin, waitMs);
      s.waiters.add(fin);
    });
    r = snap();
  }
  return r;
}
