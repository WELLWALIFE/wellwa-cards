// Shubhora multi-tenant WhatsApp bridge manager.
// One isolated Baileys worker (one node process) is created per authenticated Supabase user.
// The manager is localhost-only; the Next.js proxy supplies the verified user
// id and current plan expiry on every request.
//
// Memory safety (owner's review, 28 Sep 2026 — the whole box has ~3.6 GB, and a worker takes ~70–150 MB):
// - A worker starts only for a number that is LINKED, or while its owner is on the WhatsApp page linking it
//   (/qr, /pair, /config, GET /status?link=1). The setup bar, notifications, CRM and other background calls for a
//   number that was never linked are answered without starting a process.
// - An unlinked worker that nobody is linking stops after 10 minutes. Boot restores linked numbers only, paid first,
//   one per second.
// - Free numbers (no AI) are capped at WA_MAX_FREE_WORKERS (default 10); paid numbers always start.
// - Each worker's heap is capped; a worker above WA_WORKER_MAX_MB (default 700) RSS twice in a row is restarted.
// - A worker that keeps crashing backs off (2.5 s → 5 min) and is parked for 10 minutes after 5 crashes in 10 minutes.
// - Ports come from a pool and are reused (they used to grow by one on every start).

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WA_MANAGER_PORT || 8787);
const TENANTS_DIR = path.join(__dirname, "tenants");
const WORKER_FILE = path.join(__dirname, "index.mjs");
const USER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PORT_START = Number(process.env.WA_WORKER_PORT_START || 8800);
const PORT_COUNT = 200;
const MAX_FREE = Number(process.env.WA_MAX_FREE_WORKERS || 10);
const WORKER_HEAP_MB = Number(process.env.WA_WORKER_HEAP_MB || 512);
const WORKER_MAX_MB = Number(process.env.WA_WORKER_MAX_MB || 700);
const IDLE_UNLINKED_MS = Number(process.env.WA_IDLE_UNLINKED_MS || 10 * 60_000);
const SWEEP_MS = Number(process.env.WA_SWEEP_MS || 60_000);
const CRASH_WINDOW_MS = 10 * 60_000;
mkdirSync(TENANTS_DIR, { recursive: true });

const workers = new Map();      // userId -> { proc, port, expiresAt, aiUntil, intentional, startedAt, over }
const starting = new Map();     // userId -> Promise<entry>
const usedPorts = new Set();
const portCooldown = new Map(); // port -> ms until it may be used again (a crashed worker may have left it odd)
const linkSeen = new Map();     // userId -> last time the WhatsApp page asked (link actions)
const crashes = new Map();      // userId -> [crash times]
const parkedUntil = new Map();  // userId -> ms

function activeExpiry(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) && time > Date.now();
}
/** Same moment, however it was written ("…+00:00" and "….000Z" are one time — a string compare restarted workers). */
const sameTime = (a, b) => a === b || (Number.isFinite(Date.parse(a ?? "")) && Date.parse(a ?? "") === Date.parse(b ?? ""));
/** aiUntil is "none" (free: linked, no AI) or a date. */
const sameAi = (a, b) => a === b || (a !== "none" && b !== "none" && sameTime(a, b));

function tenantDir(userId) {
  return path.join(TENANTS_DIR, userId);
}

function metaPath(userId) {
  return path.join(tenantDir(userId), "meta.json");
}

function readMeta(userId) {
  try { return JSON.parse(readFileSync(metaPath(userId), "utf8")); } catch { return null; }
}

function saveMeta(userId, expiresAt, aiUntil) {
  mkdirSync(tenantDir(userId), { recursive: true });
  const file = metaPath(userId);
  // Written to a side file first and then renamed: a crash never leaves a half-written meta.json.
  writeFileSync(`${file}.tmp`, JSON.stringify({ userId, expiresAt, ...(aiUntil !== undefined ? { aiUntil } : {}), updatedAt: new Date().toISOString() }, null, 2));
  renameSync(`${file}.tmp`, file);
}

/** Is a WhatsApp account linked for this number? Baileys writes `me` and `account` into creds.json when linking
 *  succeeds (QR or code); a link that was started and never finished has no `account`. */
function isLinked(userId) {
  try {
    const creds = JSON.parse(readFileSync(path.join(tenantDir(userId), "auth", "creds.json"), "utf8"));
    return Boolean(creds?.me?.id && creds?.account);
  } catch {
    return false;
  }
}

function takePort() {
  const now = Date.now();
  for (let p = PORT_START; p < PORT_START + PORT_COUNT; p += 1) {
    if (!usedPorts.has(p) && (portCooldown.get(p) ?? 0) <= now) { usedPorts.add(p); return p; }
  }
  throw new Error("No free port for a WhatsApp worker.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitReady(port, userId, proc) {
  for (let i = 0; i < 60; i += 1) {
    // Died while starting (a crash, or killed): fail now instead of waiting out the 15 s.
    if (proc.exitCode !== null || proc.signalCode !== null) throw new Error("WhatsApp worker exited while starting.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(750) });
      if (response.ok) {
        const s = await response.json().catch(() => ({}));
        // Only this number's worker counts — never another process that happens to sit on the port.
        if (!s.tenantId || s.tenantId === userId) return;
      }
    } catch { /* worker is still starting */ }
    await sleep(250);
  }
  throw new Error("WhatsApp worker did not become ready.");
}

/** Resolves when the process has exited; kills it hard if it takes longer than `ms`. */
function waitExit(proc, ms) {
  if (proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* gone */ } resolve(); }, ms);
    proc.once("exit", () => { clearTimeout(t); resolve(); });
  });
}

const freeRunning = () => [...workers.values()].filter((w) => w.aiUntil === "none").length;

/** aiUntil: until when the AI auto-reply may run ("none" = free plan: the number is linked, no AI). Undefined = the
 *  caller did not say (background jobs) — the running worker keeps what it has. */
async function startWorker(userId, expiresAt, aiUntil) {
  const current = workers.get(userId);
  if (current && !current.proc.killed && sameTime(current.expiresAt, expiresAt) && (aiUntil === undefined || sameAi(current.aiUntil, aiUntil))) return current;
  // One start at a time per number (a second caller used to kill the first caller's new process).
  if (starting.has(userId)) return starting.get(userId);
  if (aiUntil === undefined) aiUntil = current?.aiUntil;
  // Not running yet and the caller did not say: what this number was last started with (a free number stays free).
  if (aiUntil === undefined) aiUntil = readMeta(userId)?.aiUntil;
  if ((parkedUntil.get(userId) ?? 0) > Date.now()) throw Object.assign(new Error("parked after repeated crashes"), { code: "parked" });
  if (!current && aiUntil === "none" && freeRunning() >= MAX_FREE) {
    console.error(`[manager] free WhatsApp limit reached (${MAX_FREE}) — not starting ${userId.slice(0, 8)}`);
    throw Object.assign(new Error("free worker limit"), { code: "busy" });
  }

  const task = (async () => {
    if (current) {
      // A plan change: the old process must be gone before the new one opens the same login files.
      current.intentional = true;
      current.proc.kill("SIGTERM");
      await waitExit(current.proc, 5000);
      if (workers.get(userId) === current) workers.delete(userId);
    }
    saveMeta(userId, expiresAt, aiUntil);
    const port = takePort();
    const proc = spawn(process.execPath, [`--max-old-space-size=${WORKER_HEAP_MB}`, WORKER_FILE], {
      cwd: __dirname,
      env: {
        ...process.env,
        WA_PORT: String(port),
        WA_TENANT_ID: userId,
        WA_DATA_DIR: tenantDir(userId),
        WA_PLAN_EXPIRES_AT: expiresAt,
        ...(aiUntil !== undefined ? { WA_AI_UNTIL: aiUntil } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const entry = { proc, port, expiresAt, aiUntil, intentional: false, startedAt: Date.now(), over: 0 };
    workers.set(userId, entry);
    proc.on("error", (error) => console.error(`[manager] tenant ${userId.slice(0, 8)} spawn error`, error?.message ?? error));
    proc.stdout.on("data", (chunk) => process.stdout.write(`[tenant:${userId.slice(0, 8)}] ${chunk}`));
    proc.stderr.on("data", (chunk) => process.stderr.write(`[tenant:${userId.slice(0, 8)}] ${chunk}`));
    proc.on("exit", (code, signal) => onExit(userId, entry, code, signal));
    try {
      await waitReady(port, userId, proc);
    } catch (error) {
      entry.intentional = true;
      proc.kill("SIGTERM");
      // Never leave a dead entry behind (a spawn that failed outright may not even report an exit).
      if (workers.get(userId) === entry) workers.delete(userId);
      usedPorts.delete(port);
      throw error;
    }
    return entry;
  })().finally(() => starting.delete(userId));

  starting.set(userId, task);
  return task;
}

function onExit(userId, entry, code, signal) {
  usedPorts.delete(entry.port);
  portCooldown.set(entry.port, Date.now() + 60_000);
  if (workers.get(userId) === entry) workers.delete(userId);
  if (entry.intentional) return;
  const now = Date.now();
  console.error(`[manager] tenant ${userId.slice(0, 8)} worker exited (code ${code}, signal ${signal})`);
  // It ran fine for a while: this crash starts a fresh count.
  let list = now - entry.startedAt > CRASH_WINDOW_MS ? [] : (crashes.get(userId) ?? []).filter((t) => now - t < CRASH_WINDOW_MS);
  list.push(now);
  crashes.set(userId, list);
  const parked = list.length >= 5;
  if (parked) {
    parkedUntil.set(userId, now + CRASH_WINDOW_MS);
    crashes.delete(userId);
    console.error(`[manager] tenant ${userId.slice(0, 8)} crashed 5 times in 10 minutes — parked for 10 minutes`);
  }
  // Only a linked number is brought back by itself; an unlinked one starts again when its owner opens the WhatsApp page.
  if (!activeExpiry(entry.expiresAt) || !isLinked(userId)) return;
  // Backing off 2.5 s → 5 min; a parked number gets one more try when its 10 minutes are over.
  const delay = parked ? CRASH_WINDOW_MS + 1000 : Math.min(2500 * 2 ** (list.length - 1), 5 * 60_000);
  const retry = () => {
    if (workers.has(userId) || (parkedUntil.get(userId) ?? 0) > Date.now()) return;
    // A start still in flight (e.g. the one this crash interrupted): wait for it to settle, then look again.
    const pending = starting.get(userId);
    if (pending) { pending.then(() => {}, () => setTimeout(retry, 1000)); return; }
    startWorker(userId, entry.expiresAt, entry.aiUntil).catch((error) => console.error("[manager] restart", error?.message ?? error));
  };
  setTimeout(retry, delay);
}

function stopWorker(userId) {
  const entry = workers.get(userId);
  if (!entry) return;
  entry.intentional = true;
  entry.proc.kill("SIGTERM");
  workers.delete(userId);
}

/** Resident memory of a process in MB (Linux); 0 when it cannot be read. */
function rssMb(pid) {
  try {
    const m = readFileSync(`/proc/${pid}/status`, "utf8").match(/VmRSS:\s+(\d+)\s+kB/);
    return m ? Math.round(Number(m[1]) / 1024) : 0;
  } catch {
    return 0;
  }
}

// Every minute: stop unlinked workers nobody is linking, and restart a worker that has grown too big.
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of workers) {
    if (!isLinked(userId) && now - Math.max(linkSeen.get(userId) ?? 0, entry.startedAt) > IDLE_UNLINKED_MS) {
      console.log(`[manager] tenant ${userId.slice(0, 8)} not linked and idle for 10 minutes — stopped`);
      stopWorker(userId);
      continue;
    }
    const mb = rssMb(entry.proc.pid);
    entry.over = mb > WORKER_MAX_MB ? entry.over + 1 : 0;
    if (entry.over >= 2) {
      console.error(`[manager] tenant ${userId.slice(0, 8)} uses ${mb} MB (limit ${WORKER_MAX_MB}) — restarting it`);
      entry.proc.kill("SIGTERM"); // not intentional: onExit brings a linked number back
    }
  }
}, SWEEP_MS).unref();

async function proxy(req, res, worker) {
  const target = `http://127.0.0.1:${worker.port}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const response = await fetch(target, {
    method: req.method,
    headers: body ? { "content-type": req.headers["content-type"] || "application/json" } : undefined,
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, { "content-type": response.headers.get("content-type") || "application/json" });
  res.end(payload);
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  if (req.url === "/manager-status") {
    const parked = [...parkedUntil.values()].filter((t) => t > Date.now()).length;
    const list = [...workers].map(([id, w]) => ({ id: id.slice(0, 8), pid: w.proc.pid, port: w.port, free: w.aiUntil === "none", mb: rssMb(w.proc.pid), upMin: Math.round((Date.now() - w.startedAt) / 60_000) }));
    return send(res, 200, { ok: true, activeWorkers: workers.size, freeWorkers: freeRunning(), freeLimit: MAX_FREE, parked, workers: list });
  }

  // The app was renamed: the Next.js proxy and the CRM send X-Shubhora-*; the old X-NeuralEdge-* names
  // still work. (Reading only the old names answered every request with 401 "verified_user_required",
  // which the WhatsApp page showed as "Please sign in again" — nobody could scan the QR.)
  const userId = String(req.headers["x-shubhora-user"] || req.headers["x-neuraledge-user"] || "").trim();
  const expiresAt = String(req.headers["x-shubhora-plan-expires"] || req.headers["x-neuraledge-plan-expires"] || "").trim();
  const aiHeader = req.headers["x-shubhora-ai-until"];
  const aiUntil = aiHeader === undefined ? undefined : String(aiHeader).trim() || "none";
  if (!USER_RE.test(userId)) return send(res, 401, { error: "verified_user_required" });
  if (!activeExpiry(expiresAt)) {
    // A job for a paid feature (broadcast, a cron's status post) on an account without the plan: refused. The number
    // stays linked — a free account keeps its WhatsApp for Status and leads (owner's call, 27 Sep 2026).
    return send(res, 402, { error: "plan_expired" });
  }

  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  // The owner is on the WhatsApp page, linking or setting up this number: these may start a worker.
  const linking = route === "/qr" || route === "/pair" || route === "/config"
    || (route === "/status" && req.method === "GET" && url.searchParams.get("link") === "1");
  if (linking) linkSeen.set(userId, Date.now());
  if (!workers.has(userId) && !starting.has(userId) && !linking && !isLinked(userId)) {
    // Never linked (or unlinked since): answer without starting a WhatsApp process. The app's setup bar asks for the
    // status on every screen, for every account.
    if (req.method === "GET" && route === "/status") return send(res, 200, { state: "disconnected", me: null, linked: false });
    if (route === "/logout") return send(res, 200, { ok: true });
    return send(res, 409, { error: "not connected" });
  }

  try {
    const worker = await startWorker(userId, expiresAt, aiUntil);
    await proxy(req, res, worker);
  } catch (error) {
    if (error?.code === "busy") return send(res, 503, { error: "busy", message: "WhatsApp is busy right now. Please try again in a few minutes." });
    if (error?.code === "parked") return send(res, 503, { error: "restarting", message: "WhatsApp is restarting. Please try again in a few minutes." });
    console.error("[manager] request", error?.message ?? error);
    if (!res.headersSent) send(res, 503, { error: "bridge_offline", message: "Your WhatsApp session could not start." });
  }
});
server.on("error", (error) => { console.error("[manager] server error", error); process.exit(1); });

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[manager] multi-tenant WhatsApp bridge on http://127.0.0.1:${PORT}`);
  // Linked numbers only, paid ones first, one per second (all at once used to pin both cores for a minute).
  const restore = readdirSync(TENANTS_DIR, { withFileTypes: true })
    .filter((item) => item.isDirectory() && USER_RE.test(item.name))
    .map((item) => ({ id: item.name, meta: readMeta(item.name) }))
    .filter((t) => t.meta && activeExpiry(t.meta.expiresAt) && isLinked(t.id))
    .sort((a, b) => Number(a.meta.aiUntil === "none") - Number(b.meta.aiUntil === "none"));
  restore.forEach((t, i) => setTimeout(() => {
    startWorker(t.id, t.meta.expiresAt, t.meta.aiUntil).catch((error) => console.error("[manager] restore", t.id.slice(0, 8), error?.message ?? error));
  }, i * 1000));
  console.log(`[manager] restoring ${restore.length} linked number(s)`);
});

function shutdown() {
  for (const [userId] of workers) stopWorker(userId);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
