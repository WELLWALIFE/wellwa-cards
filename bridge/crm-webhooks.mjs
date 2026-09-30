// Outgoing webhooks: deliver crm_outbox rows (queued by DB triggers) to each
// owner's webhook URL with an HMAC signature. Runs every minute from pm2:
//   pm2 start bridge/crm-webhooks.mjs --name neuraledge-webhooks --cron "* * * * *" --no-autorestart
// Retries with backoff (attempts 1..8); after that the row is left with last_error.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function rest(q, init) { const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } }); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }
async function restList(q) { const j = await rest(q); if (Array.isArray(j)) return j; if (j?.message) console.error(`[webhooks] ${q.split("?")[0]}: ${j.message}`); return []; }
// No per-attempt timestamp: retry once the row is old enough for its attempt count (0,1,5,15,60,180,720 min).
const backoffOk = (row) => Date.now() - new Date(row.created_at).getTime() >= [0, 1, 5, 15, 60, 180, 720, 1440][Math.min(row.attempts, 7)] * 60000;

async function main() {
  if (!SUPA || !KEY) throw new Error("env missing");
  const rows = await restList("crm_outbox?delivered_at=is.null&attempts=lt.8&select=id,owner_id,event,payload,created_at,attempts&order=created_at&limit=300");
  if (!rows.length) return;
  const cfg = new Map();
  for (const owner of new Set(rows.map((r) => r.owner_id))) {
    const c = (await restList(`crm_integrations?owner_id=eq.${owner}&active=is.true&select=outbound_url,outbound_secret,outbound_events`))[0];
    if (c?.outbound_url) cfg.set(owner, c);
  }
  let ok = 0, fail = 0;
  for (const row of rows) {
    const c = cfg.get(row.owner_id);
    if (!c || !c.outbound_events.includes(row.event)) { await rest(`crm_outbox?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivered_at: new Date().toISOString(), last_error: "skipped (integration off)" }) }); continue; }
    if (!backoffOk(row)) continue;
    const body = JSON.stringify({ event: row.event, id: row.id, created_at: row.created_at, data: row.payload });
    const sig = c.outbound_secret ? crypto.createHmac("sha256", c.outbound_secret).update(body).digest("hex") : "";
    let err = "";
    try {
      const r = await fetch(c.outbound_url, { method: "POST", headers: { "Content-Type": "application/json", "X-Shubhora-Event": row.event, "X-Shubhora-Signature": sig, "User-Agent": "Shubhora-Webhooks/1.0" }, body, redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (!r.ok) err = `HTTP ${r.status}`;
    } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
    await rest(`crm_outbox?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(err ? { attempts: row.attempts + 1, last_error: err } : { delivered_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: "" }) });
    if (err) fail += 1; else ok += 1;
  }
  console.log(`[webhooks] delivered=${ok} failed=${fail}`);
}
main().catch((e) => { console.error("[webhooks] fatal", e); process.exit(1); });
