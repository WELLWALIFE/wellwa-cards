import "server-only";
// The website build as a job (owner's call, 5 Oct 2026: "screen band kar de to kya hoga? dobara dabaye to?").
//
// A build takes one to three minutes. It used to live inside the phone's request: a closed screen lost the finished
// website (the money spent on it stayed spent), and a second tap started a second paid build. Now the build runs
// on the server by itself and its result is kept here until the phone takes it:
//   • one build per account at a time — a second tap joins the one already running;
//   • the result is written to disk (.card-jobs/<uid>.json), so a phone that comes back later, or after a server
//     restart, still finds its finished website;
//   • a phone that is not watching when it finishes is told by push / WhatsApp.
// The app runs as ONE Node process (ecosystem.config.cjs), so the running builds are held in memory; the map sits
// on globalThis because every route is bundled with its own copy of this module.
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const STAGES = ["details", "website", "pictures", "writing", "checking"] as const;
export type BuildStage = (typeof STAGES)[number];
export type CardJob = {
  id: string;
  uid: string;
  state: "running" | "done" | "failed";
  stage: BuildStage;
  /** Write again (Premium): the phone's finishing step differs a little. */
  fresh: boolean;
  startedAt: number;
  endedAt?: number;
  /** Last time a phone asked about this build: a phone that stopped asking is told when it finishes. */
  seenAt: number;
  /** The build's own answer, exactly what the old one-request build returned. */
  status?: number;
  result?: unknown;
  /** The phone has taken the result (made it its preview / put it live): it is not offered again. */
  claimed?: boolean;
  /** Which server process ran it: a "running" job from an earlier process was cut off by a restart. */
  boot: string;
};

const DIR = path.join(process.cwd(), ".card-jobs");
/** A finished website waits this long for its owner to come back for it. */
const KEEP_MS = 7 * 24 * 60 * 60_000;
/** No build runs this long; one that has is treated as lost. */
const STUCK_MS = 8 * 60_000;

type Live = { job: CardJob; done: Promise<CardJob> };
const g = globalThis as unknown as { __cardJobs?: { boot: string; live: Map<string, Live> } };
const reg = (g.__cardJobs ??= { boot: randomUUID(), live: new Map() });

const fileOf = (uid: string) => path.join(DIR, `${uid.replace(/[^a-zA-Z0-9-]/g, "")}.json`);

async function save(job: CardJob) {
  try {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = `${fileOf(job.uid)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(job));
    await fs.rename(tmp, fileOf(job.uid));
  } catch (e) { console.log("[card-job] save failed:", e instanceof Error ? e.message : e); }
}

/** This account's latest build, as the phone should see it (null: none worth showing). */
export async function currentJob(uid: string): Promise<CardJob | null> {
  const live = reg.live.get(uid);
  if (live) return live.job;
  let job: CardJob | null = null;
  try { job = JSON.parse(await fs.readFile(fileOf(uid), "utf8")) as CardJob; } catch { return null; }
  if (!job || job.uid !== uid) return null;
  if (job.state === "running" && (job.boot !== reg.boot || Date.now() - job.startedAt > STUCK_MS)) {
    // Cut off by a server restart: said once, so the owner knows to make it again rather than wait for ever.
    job = { ...job, state: "failed", endedAt: Date.now(), status: 503, result: { error: "The server restarted while your website was being made. Please make it again." } };
    await save(job);
  }
  if (job.endedAt && Date.now() - job.endedAt > KEEP_MS) return null;
  return job;
}

/** The phone asked: it is watching (so no push is needed when it finishes). */
export function touch(uid: string) {
  const live = reg.live.get(uid);
  if (live) live.job.seenAt = Date.now();
}

export async function claim(uid: string, id: string): Promise<boolean> {
  const job = await currentJob(uid);
  if (!job || job.id !== id || job.state === "running") return false;
  if (!job.claimed) await save({ ...job, claimed: true });
  return true;
}

/** The running build of this account, or a new one started with `run`. `joined` says the tap found one running. */
export async function startJob(
  uid: string,
  opts: { fresh: boolean },
  run: (step: (s: BuildStage) => void) => Promise<{ status: number; body: unknown }>,
  onEnd: (job: CardJob) => Promise<void>,
): Promise<{ job: CardJob; done: Promise<CardJob>; joined: boolean }> {
  const running = reg.live.get(uid);
  if (running) return { ...running, joined: true };

  const job: CardJob = { id: randomUUID(), uid, state: "running", stage: "details", fresh: opts.fresh, startedAt: Date.now(), seenAt: Date.now(), boot: reg.boot };
  // Writes go one after another: a stage write finishing late must never put "running" back over "done".
  let chain = Promise.resolve();
  const persist = () => (chain = chain.then(() => save({ ...job })));
  // Stages only move forward: work that runs side by side never makes the phone's list go back a step.
  const step = (s: BuildStage) => { if (STAGES.indexOf(s) > STAGES.indexOf(job.stage)) { job.stage = s; void persist(); } };
  const done = (async () => {
    try {
      const out = await run(step);
      Object.assign(job, { state: out.status < 400 ? "done" : "failed", status: out.status, result: out.body });
    } catch (e) {
      console.log("[card-job] build crashed:", e instanceof Error ? e.stack ?? e.message : e);
      Object.assign(job, { state: "failed", status: 500, result: { error: "Could not make your website. Please try again." } });
    }
    job.endedAt = Date.now();
    await persist();
    reg.live.delete(uid);
    await onEnd(job).catch(() => undefined);
    return job;
  })();
  reg.live.set(uid, { job, done });
  await persist();
  return { job, done, joined: false };
}

/** What the phone is sent about a build. */
export function jobView(job: CardJob) {
  return {
    job: job.id,
    state: job.state,
    stage: job.stage,
    fresh: job.fresh,
    startedAt: job.startedAt,
    elapsed: Math.round(((job.endedAt ?? Date.now()) - job.startedAt) / 1000),
    claimed: !!job.claimed,
    ...(job.state !== "running" ? { status: job.status, result: job.result } : {}),
  };
}
