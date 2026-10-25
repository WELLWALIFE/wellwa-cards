import "server-only";
// "Share Screen" (owner, 19 Oct 2026): the owner of an account sends a link to anyone (or asks the Shubhora admin); whoever opens it sees the Shubhora
// screen of that person live, on their own phone, to guide them. See only: nothing a viewer does ever reaches the sender's app.
//
// How it is kept safe:
//   • Two different secrets. The link carries the VIEW token only. The SENDER's app alone holds the push secret (given at creation and again, to the
//     logged-in owner of the link only, when sharing is resumed); without it nothing can be written, ended or changed, so a viewer — or anyone who
//     guessed a link — can only read.
//   • What is shared is only what the sender's Shubhora page draws (rrweb): never another app or tab, never a password (masked at the source),
//     never cookies, tokens or the address bar.
//   • One sharing turn lasts 30 minutes (owner, 23 Oct 2026: was 15), then sharing stops by itself. The link is NOT thrown away: for a day after,
//     the SAME link can "Reconnect" — the viewer taps Reconnect (or the sender taps it), the sender is asked on their phone, and on yes the same link
//     gets another 30 minutes. Inside a turn the same link can be sharing, paused (the sender tapped Stop, or left the app) and sharing again; the
//     sender is always asked before it starts again.
//   • Help by tapping (owner, 25 Oct 2026: "franchise aur admin ko edit ke rights — user ke haath mein option"): only when the SENDER switches
//     it on (on by default in the dialog, one tap turns it off, any time). Then a viewer may send taps, typed words, a scroll or Back; they wait
//     here and the sender's app takes them with its next push and does them itself — never in a password / OTP / PIN / bank field, never on the
//     sharing controls. Switched off, nothing is queued and anything waiting is dropped.
//   • Nothing is stored on disk: it lives in this server's memory only, and is gone at the end (or at a restart).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type Ev = { type: number; data?: { width?: number; height?: number } & Record<string, unknown>; timestamp?: number } & Record<string, unknown>;
/** "stopped": the sender tapped Stop (or closed the page). "away": the app has not been heard from for a while. "expired": the 30 minutes of this turn
 * are over. All can be resumed (reconnected) on the same link; "expired" for up to a day. */
export type PauseReason = "stopped" | "away" | "expired";
export type EndReason = "expired" | "closed";
export type ShareKind = "link" | "admin";
type Share = {
  token: string; secretHash: Buffer; uid: string; kind: ShareKind; who: { name: string; phone: string } | null;
  at: number; expiresAt: number; lastBeat: number;
  paused: PauseReason | null; ended: EndReason | null; endedAt: number;
  knockAt: number;
  events: { i: number; e: Ev }[]; nextI: number; epoch: number; meta: Ev | null; bytes: number;
  width: number; height: number;
  viewers: Map<string, number>; waiters: Set<() => void>;
  control: boolean; cmds: Cmd[];
};
/** One thing a helper does on the sender's screen (rrweb node ids from the replay; lib/share-control on the phone does it). */
export type Cmd = { t: "click"; id: number } | { t: "input"; id: number; value: string } | { t: "scroll"; dy: number } | { t: "back" };
const MAX_CMDS = 40;

export const LINK_MS = 30 * 60_000;        // how long one sharing turn lives (from creation, and again from each reconnect after it ran out)
const RECONNECT_MS = 24 * 60 * 60_000;     // after a turn ran out, the same link can still reconnect for this long, then it is over
export const AWAY_MS = 120_000;            // the sender's app not heard from this long: sharing is paused (it can start again on the same link)
const KEEP_ENDED_MS = 10 * 60_000;         // an ended link still says "ended" for a while, then is forgotten
export const MAX_VIEWERS = 8;
const VIEWER_SEEN_MS = 40_000;
const KNOCK_GAP_MS = 20_000;               // a viewer can ask "share again" at most this often
const MAX_BYTES = 6_000_000;               // a session whose picture grows past this is paused (a normal one is far smaller: it is re-based every few seconds)

const g = globalThis as unknown as { __liveShares?: Map<string, Share> };
const shares = (g.__liveShares ??= new Map<string, Share>());
const TOKEN = /^[a-f0-9]{32}$/;
const hash = (s: string) => createHash("sha256").update(s).digest();

function wake(s: Share) { for (const w of [...s.waiters]) w(); }
function clearPicture(s: Share) { s.events = []; s.bytes = 0; s.meta = null; }
function pause(s: Share, why: PauseReason) {
  if (s.ended || s.paused) return;
  s.paused = why;
  if (why === "stopped") clearPicture(s);   // a stopped screen is not kept for whoever opens the link next; a merely-away one is the last thing already shown
  wake(s);
}
function finish(s: Share, why: EndReason) {
  if (s.ended) return;
  s.ended = why; s.endedAt = Date.now(); clearPicture(s);
  wake(s);
}
/** Ends what is stale, forgets what is old. Called on every request (no timers: nothing runs while nobody is using it). */
function sweep() {
  const now = Date.now();
  for (const [t, s] of shares) {
    if (!s.ended && now >= s.expiresAt + RECONNECT_MS) finish(s, "expired");
    else if (!s.ended && now >= s.expiresAt && s.paused !== "expired") { s.paused = "expired"; clearPicture(s); wake(s); }   // the turn is over; the link waits for a reconnect
    else if (!s.ended && !s.paused && now - s.lastBeat > AWAY_MS) pause(s, "away");
    else if (s.ended && now - s.endedAt > KEEP_ENDED_MS) shares.delete(t);
  }
}

export function findShare(token: string): Share | null {
  sweep();
  return TOKEN.test(token) ? shares.get(token) ?? null : null;
}
/** The newest link of this account that is still open (sharing, paused, or waiting for a reconnect), if any. */
export function shareOf(uid: string): Share | null {
  sweep();
  let best: Share | null = null;
  for (const s of shares.values()) if (s.uid === uid && !s.ended && (!best || s.at > best.at)) best = s;
  return best;
}
/** Links made to ask the admin for help that are still inside their 30 minutes, newest first (a run-out one is no longer a live request). */
export function adminShares(): Share[] {
  sweep();
  return [...shares.values()].filter((s) => s.kind === "admin" && !s.ended && s.paused !== "expired").sort((a, b) => b.at - a.at);
}
/** The push secret, compared in constant time. */
export function secretOk(s: Share, secret: unknown): boolean {
  return typeof secret === "string" && secret.length > 10 && secret.length < 200 && timingSafeEqual(hash(secret), s.secretHash);
}

/** A new link for this account (an earlier running one of the same account is closed: one at a time). */
export function createShare(uid: string, kind: ShareKind = "link", who: { name: string; phone: string } | null = null): { token: string; secret: string; expiresAt: number } {
  sweep();
  for (const s of shares.values()) if (s.uid === uid && !s.ended) finish(s, "closed");
  const token = randomBytes(16).toString("hex"), secret = randomBytes(24).toString("base64url");
  const now = Date.now();
  shares.set(token, {
    token, secretHash: hash(secret), uid, kind, who, at: now, expiresAt: now + LINK_MS, lastBeat: now, paused: null, ended: null, endedAt: 0, knockAt: 0,
    events: [], nextI: 1, epoch: 1, meta: null, bytes: 0, width: 390, height: 844, viewers: new Map(), waiters: new Set(),
    control: false, cmds: [],
  });
  return { token, secret, expiresAt: now + LINK_MS };
}

/** The owner of the link starts sharing again on the SAME link: a new push secret (the old one stops working), the picture starts afresh. A link whose
 *  30 minutes ran out gets another 30 (Reconnect): the viewers keep the link they already have. */
export function resumeShare(s: Share): { secret: string } | null {
  if (s.ended) return null;
  const secret = randomBytes(24).toString("base64url");
  const now = Date.now();
  if (s.paused === "expired" || now >= s.expiresAt) s.expiresAt = now + LINK_MS;
  s.secretHash = hash(secret); s.paused = null; s.lastBeat = now;
  clearPicture(s); s.epoch++; s.knockAt = 0;
  wake(s);
  return { secret };
}

export function viewerCount(s: Share): number {
  const now = Date.now();
  for (const [v, t] of s.viewers) if (now - t > VIEWER_SEEN_MS) s.viewers.delete(v);
  return s.viewers.size;
}

/** A viewer asks the sender to share again (a new viewer arriving on a paused link does this by itself). */
export function knock(s: Share): boolean {
  const now = Date.now();
  if (s.ended || !s.paused || now - s.knockAt < KNOCK_GAP_MS) return false;
  s.knockAt = now;
  return true;
}

/** What the sender's own app is told about its link: whether somebody is waiting for it to start sharing again. */
export function senderView(s: Share) {
  const viewers = viewerCount(s);
  return { token: s.token, kind: s.kind, state: s.ended ? "ended" : s.paused ? "paused" : "live", why: s.ended ?? s.paused ?? null, expiresAt: s.expiresAt, viewers, knockAt: s.knockAt, waiting: !!s.paused && !s.ended && viewers > 0, control: s.control };
}

/** The sender's batch of screen events. Returns how many are watching, and whether the link has ended or been paused. */
export function pushEvents(s: Share, events: unknown[]): { viewers: number; ended: EndReason | null; paused: PauseReason | null; expiresAt: number } {
  if (s.ended) return { viewers: 0, ended: s.ended, paused: s.paused, expiresAt: s.expiresAt };
  // A sender that was only "away" and is heard again carries on by itself; one that was stopped (or ran out of time) does not (it needs a resume, which the owner confirms).
  if (s.paused === "stopped" || s.paused === "expired") return { viewers: viewerCount(s), ended: null, paused: s.paused, expiresAt: s.expiresAt };
  s.lastBeat = Date.now();
  if (s.paused === "away") { s.paused = null; wake(s); }
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
  if (s.bytes > MAX_BYTES) pause(s, "away");
  wake(s);
  return { viewers: viewerCount(s), ended: s.ended, paused: s.paused, expiresAt: s.expiresAt };
}

/** The sender allows (or stops) help by tapping. Off drops whatever was waiting. */
export function setControl(s: Share, on: boolean) {
  if (s.control === on) return;
  s.control = on; if (!on) s.cmds = [];
  wake(s);
}
/** A helper's taps / words, kept for the sender's next push. Only while the sender allows it and the screen is being shared. */
export function addCmds(s: Share, list: unknown[]): number {
  if (!s.control || s.ended || s.paused) return 0;
  let n = 0;
  for (const raw of list.slice(0, 10)) {
    const c = raw as Record<string, unknown>;
    const id = Number(c?.id);
    let cmd: Cmd | null = null;
    if (c?.t === "click" && Number.isInteger(id) && id > 0) cmd = { t: "click", id };
    else if (c?.t === "input" && Number.isInteger(id) && id > 0 && typeof c.value === "string") cmd = { t: "input", id, value: c.value.slice(0, 1000) };
    else if (c?.t === "scroll" && Number.isFinite(Number(c.dy))) cmd = { t: "scroll", dy: Math.max(-3000, Math.min(3000, Math.round(Number(c.dy)))) };
    else if (c?.t === "back") cmd = { t: "back" };
    if (cmd && s.cmds.length < MAX_CMDS) { s.cmds.push(cmd); n++; }
  }
  return n;
}
/** What the sender's app is to do now (and forgets them here). */
export function takeCmds(s: Share): Cmd[] { const c = s.cmds; s.cmds = []; return s.control ? c : []; }

/** The sender tapped Stop: sharing stops now. The link stays so it can be started again. */
export function stopShare(s: Share) { pause(s, "stopped"); }
/** Gives the link up altogether. */
export function closeShare(s: Share) { finish(s, "closed"); }

export type WatchResult = { status: "live" | "paused" | "ended" | "full"; why?: PauseReason | EndReason; epoch: number; reset: boolean; events: Ev[]; next: number; width: number; height: number; viewers: number; expiresAt: number; control: boolean };
/** What a viewer has not seen yet. Waits (long poll) until there is something, the link changes, or `waitMs` runs out. */
export async function watch(s: Share, viewerId: string, after: number, epoch: number, waitMs: number, ask = false): Promise<WatchResult> {
  const base = () => ({ epoch: s.epoch, reset: false, events: [] as Ev[], next: after, width: s.width, height: s.height, viewers: viewerCount(s), expiresAt: s.expiresAt, control: s.control });
  if (!s.viewers.has(viewerId) && viewerCount(s) >= MAX_VIEWERS) return { status: "full", ...base() };
  const isNew = !s.viewers.has(viewerId);
  s.viewers.set(viewerId, Date.now());
  // Somebody arrives (or asks again) while nothing is being shared: the sender's app is told, and asks its owner whether to start.
  if (s.paused && !s.ended && (isNew || ask)) knock(s);
  const snap = (): WatchResult => {
    s.viewers.set(viewerId, Date.now());
    if (s.ended) return { status: "ended", why: s.ended, ...base() };
    const first = s.events[0]?.i ?? s.nextI;
    const reset = epoch !== s.epoch || after < first - 1;
    const list = (reset ? s.events : s.events.filter((x) => x.i > after)).map((x) => x.e);
    return { status: s.paused ? "paused" : "live", ...(s.paused ? { why: s.paused } : {}), epoch: s.epoch, reset, events: list, next: s.nextI - 1, width: s.width, height: s.height, viewers: viewerCount(s), expiresAt: s.expiresAt, control: s.control };
  };
  let r = snap();
  if (r.status !== "ended" && !r.events.length && !r.reset && waitMs > 0) {
    // Not a spin: a paused link waits here until it is resumed (or ends), a live one until the sender sends something.
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
