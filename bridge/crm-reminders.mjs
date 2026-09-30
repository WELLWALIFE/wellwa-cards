// CRM follow-up reminders: every 15 min (pm2 cron) find leads whose
// next_follow_up has arrived and nudge the owner — a note in their own
// WhatsApp chat (via their bridge worker) and an FCM push to the Shubhora app
// when the device is registered. Each follow-up is reminded once (reminded_at).
//   pm2 start bridge/crm-reminders.mjs --name neuraledge-crm --cron "*/15 * * * *" --no-autorestart
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
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, SA_PATH = env.FCM_SERVICE_ACCOUNT_JSON;
const BRIDGE = "http://127.0.0.1:8787";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const IST = "Asia/Kolkata";

async function rest(q, init) { const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } }); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }
async function restList(q) { const j = await rest(q); if (Array.isArray(j)) return j; if (j?.message) console.error(`[crm] ${q.split("?")[0]}: ${j.message}`); return []; }

// ---- FCM (same as push-daily.mjs) ------------------------------------------
let fcm = null; // { projectId, bearer }
async function fcmInit() {
  if (!SA_PATH || !fs.existsSync(SA_PATH)) return null;
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf8"));
  const b64url = (s) => Buffer.from(s).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: sa.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), sa.private_key).toString("base64url");
  const r = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${sig}` }) });
  const j = await r.json().catch(() => ({}));
  return j.access_token ? { projectId: sa.project_id, bearer: j.access_token } : null;
}
async function push(userId, title, body) {
  if (!fcm) return 0;
  const devices = await restList(`poster_devices?user_id=eq.${userId}&select=token`);
  let n = 0;
  for (const d of devices) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${fcm.bearer}`, "content-type": "application/json" },
      body: JSON.stringify({ message: { token: d.token, notification: { title, body }, data: { url: "/poster/leads" }, android: { priority: "high", notification: { channel_id: "daily", default_sound: true } } } }), signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (r?.ok) n += 1;
  }
  return n;
}

// ---- WhatsApp self-note through the owner's worker ---------------------------
async function selfNote(userId, expiresAt, text) {
  try {
    const r = await fetch(`${BRIDGE}/self-note`, { method: "POST", headers: { "X-NeuralEdge-User": userId, "X-NeuralEdge-Plan-Expires": expiresAt, "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(20000) });
    return r.ok;
  } catch { return false; }
}

// Super Admin notification switches (Notifications page). Unknown → allow, so reminders never silently stop
// because the app was restarting.
const APP_URL = env.INTERNAL_APP_URL || "http://127.0.0.1:3001";
let switches = null;
const allowed = (ch) => !switches || (switches.enabled && switches[ch] && switches.types?.followup_due?.[ch]);
async function webPush(owner, title, body, ref) {
  try {
    const r = await fetch(`${APP_URL}/api/notify/internal`, { method: "POST", headers: { "content-type": "application/json", "x-cron-key": env.CRON_KEY || "" },
      body: JSON.stringify({ userId: owner, type: "followup_due", title, body, path: "/leads", ref, channels: ["push"] }) });
    const j = await r.json().catch(() => ({}));
    return !!j?.result?.push?.ok;
  } catch { return false; }
}

async function main() {
  if (!SUPA || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  switches = await fetch(`${APP_URL}/api/notify/internal`, { headers: { "x-cron-key": env.CRON_KEY || "" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (switches && !switches.enabled) { console.log("[crm] notifications are switched off by the admin"); return; }
  fcm = await fcmInit().catch((e) => { console.log("[crm] fcm off:", e?.message); return null; });
  const now = new Date().toISOString();
  const due = await restList(`leads?next_follow_up=lte.${now}&reminded_at=is.null&status=not.in.(converted,lost,won)&select=id,owner_id,name,phone,message,ai_next,next_follow_up&order=next_follow_up&limit=200`);
  if (!due.length) { console.log("[crm] nothing due"); return; }
  const byOwner = new Map();
  for (const l of due) { if (!byOwner.has(l.owner_id)) byOwner.set(l.owner_id, []); byOwner.get(l.owner_id).push(l); }
  for (const [owner, leads] of byOwner) {
    const prof = (await restList(`profiles?id=eq.${owner}&select=plan,plan_expires_at`))[0];
    const expiresAt = prof?.plan_expires_at || "2999-12-31T23:59:59.000Z";
    const lines = leads.slice(0, 10).map((l) => `• *${l.name || l.phone}* ${l.phone?.startsWith("+") ? `(${l.phone})` : ""}\n  ${l.ai_next || l.message?.slice(0, 80) || ""}`.trimEnd());
    const text = `⏰ *Follow-up reminder*\n${leads.length} customer${leads.length > 1 ? "s" : ""} to contact now:\n\n${lines.join("\n")}${leads.length > 10 ? `\n…and ${leads.length - 10} more` : ""}\n\nOpen Shubhora → CRM to reply or call.`;
    const title = `⏰ ${leads.length} follow-up${leads.length > 1 ? "s" : ""} due`;
    const names = leads.map((l) => l.name || l.phone).slice(0, 3).join(", ");
    const wa = allowed("whatsapp") && ["pro", "team"].includes(prof?.plan) ? await selfNote(owner, expiresAt, text) : false;
    const appPush = allowed("push") ? await push(owner, title, names) : 0;
    const browserPush = allowed("push") ? await webPush(owner, title, names, `followup-${leads.map((l) => l.id).join(",").slice(0, 120)}`) : false;
    const pushed = appPush || browserPush;
    if (!wa && !pushed) { console.log(`[crm] ${owner.slice(0, 8)}: could not deliver (whatsapp off, no device) — will retry next run`); continue; }
    await rest(`leads?id=in.(${leads.map((l) => l.id).join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reminded_at: now }) });
    await rest("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(leads.map((l) => ({ owner_id: owner, lead_id: l.id, kind: "followup", text: `Reminder sent (${new Date(l.next_follow_up).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })})` }))) });
    console.log(`[crm] ${owner.slice(0, 8)}: ${leads.length} due, whatsapp=${wa}, push=${pushed}`);
  }
}
main().catch((e) => { console.error("[crm] fatal", e); process.exit(1); });
