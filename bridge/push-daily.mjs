// Daily push: "आज का पोस्टर तैयार है" to every registered Shubhora device.
// Runs from pm2 cron at 02:00 UTC (= 07:30 IST):
//   pm2 start bridge/push-daily.mjs --name neuraledge-push-daily --cron "0 2 * * *" --no-autorestart
//
// FCM HTTP v1, no SDK: the service-account JSON (path in FCM_SERVICE_ACCOUNT_JSON)
// signs an RS256 JWT with node:crypto, which is swapped for an OAuth2 access
// token. Dead tokens (UNREGISTERED / NOT_FOUND / INVALID_ARGUMENT) are removed
// from poster_devices so the list stays clean.
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
const SA_PATH = env.FCM_SERVICE_ACCOUNT_JSON;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CONCURRENCY = 20;

async function rest(q, init) {
  const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
}

// ---- Google OAuth2 via signed JWT (service account) -------------------------
function b64url(input) { return Buffer.from(input).toString("base64url"); }
async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), sa.private_key).toString("base64url");
  const jwt = `${header}.${claims}.${sig}`;
  const r = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`oauth failed: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.access_token;
}

// ---- Copy -------------------------------------------------------------------
function copyFor(lang) {
  if (lang === "en") return { title: "Your poster is ready 🎉", body: "Open and share on WhatsApp" };
  if (lang === "hinglish") return { title: "Aaj ka poster taiyaar hai 🎉", body: "Dekhein aur WhatsApp par bhejein" };
  return { title: "आज का पोस्टर तैयार है 🎉", body: "देखें और WhatsApp पर भेजें" };
}

// Returns "ok" | "dead" | "error".
async function send(projectId, bearer, device) {
  const { title, body } = copyFor(device.lang);
  const message = {
    token: device.token,
    notification: { title, body },
    data: { url: "/poster" },
    android: {
      priority: "high",
      ttl: "43200s", // 12h — a stale "today's poster" after that is noise
      collapse_key: "daily-poster",
      notification: { channel_id: "daily", tag: "daily-poster", default_sound: true },
    },
  };
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.ok) return "ok";
  const j = await r.json().catch(() => ({}));
  const status = j.error?.status ?? "";
  const fcmCode = (j.error?.details ?? []).find((d) => d.errorCode)?.errorCode ?? "";
  const dead = r.status === 404 || fcmCode === "UNREGISTERED" || status === "NOT_FOUND" ||
    (r.status === 400 && /not a valid FCM registration token|Invalid registration/i.test(j.error?.message ?? ""));
  if (!dead) console.log(`  FAIL ${device.token.slice(0, 12)}… ${r.status} ${status} ${fcmCode} ${String(j.error?.message ?? "").slice(0, 120)}`);
  return dead ? "dead" : "error";
}

// Browsers that allowed notifications get the same "poster ready" message through the app (web push).
const APP_URL = env.INTERNAL_APP_URL || "http://127.0.0.1:3001";
async function browserPush() {
  const subs = await rest("push_subscriptions?select=user_id");
  const ids = [...new Set((Array.isArray(subs) ? subs : []).map((x) => x.user_id))];
  if (!ids.length) return 0;
  const withPoster = await rest(`poster_profiles?is_default=eq.true&user_id=in.(${ids.join(",")})&select=user_id`);
  const date = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  let sent = 0;
  for (const { user_id } of Array.isArray(withPoster) ? withPoster : []) {
    const r = await fetch(`${APP_URL}/api/notify/internal`, { method: "POST", headers: { "content-type": "application/json", "x-cron-key": env.CRON_KEY || "" },
      body: JSON.stringify({ userId: user_id, type: "poster_ready", title: "Today's poster is ready", body: "Open Shubhora to share it on WhatsApp.", path: "/poster", ref: date, channels: ["push"] }) })
      .then((x) => x.json()).catch(() => null);
    if (r?.result?.push?.ok) sent++;
  }
  return sent;
}

async function main() {
  if (!SUPA || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  // Super Admin switches: all off, push off or "Today's poster ready" off → send nothing.
  const sw = await fetch(`${APP_URL}/api/notify/internal`, { headers: { "x-cron-key": env.CRON_KEY || "" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (sw && !(sw.enabled && sw.push && sw.types?.poster_ready?.push)) { console.log("[push] poster notifications are switched off by the admin"); return; }
  console.log(`[push] browsers notified: ${await browserPush()}`);
  if (!SA_PATH) throw new Error("FCM_SERVICE_ACCOUNT_JSON (path to the Firebase service-account json) is not set");
  const sa = JSON.parse(fs.readFileSync(path.resolve(APP, SA_PATH), "utf8"));
  if (!sa.project_id || !sa.private_key || !sa.client_email) throw new Error("service-account json is missing project_id / private_key / client_email");

  const devices = await rest(`poster_devices?select=token,lang,platform&order=created_at`);
  if (!Array.isArray(devices)) { console.log("[push] device query failed", JSON.stringify(devices)); return; }
  console.log(`[push] ${new Date().toISOString()} ${devices.length} device(s)`);
  if (!devices.length) return;

  const bearer = await accessToken(sa);
  const counts = { ok: 0, dead: 0, error: 0 };
  const dead = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, devices.length) }, async () => {
    while (i < devices.length) {
      const d = devices[i++];
      let res;
      try { res = await send(sa.project_id, bearer, d); } catch (e) { console.log(`  FAIL ${d.token.slice(0, 12)}… ${e.message}`); res = "error"; }
      counts[res]++;
      if (res === "dead") dead.push(d.token);
    }
  }));
  for (const t of dead) await rest(`poster_devices?token=eq.${encodeURIComponent(t)}`, { method: "DELETE" });
  console.log(`[push] sent=${counts.ok} removed=${counts.dead} failed=${counts.error}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("[push]", e.message); process.exit(1); });
