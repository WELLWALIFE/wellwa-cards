// Click-to-call recordings (docs/crm-pro.md 3.7): Exotel keeps a recording behind the account's basic auth and not for
// ever, so every hour the new ones are copied into our own storage (media/calls/<owner>/<call>.mp3) and the row points
// there; the customer screen plays it from the timeline. Kept 90 days (cleanup is scripts/cleanup-30d.mjs's job later).
//   pm2 cron: cron("neuraledge-recordings", "call-recordings.mjs", "20 * * * *")
import fs from "node:fs";
import path from "node:path";
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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function main() {
  if (!SUPA || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  if (!env.EXOTEL_API_KEY || !env.EXOTEL_API_TOKEN) { console.log("[rec] exotel not configured"); return; }
  const ours = `${SUPA}/storage/v1/object/public/media/`;
  const r = await fetch(`${SUPA}/rest/v1/crm_calls?channel=eq.exotel&status=eq.done&recording_url=not.is.null&recording_url=not.like.${encodeURIComponent(ours + "%")}&select=id,owner_id,recording_url&order=started_at.desc&limit=50`, { headers: H });
  const rows = (await r.json().catch(() => [])) || [];
  if (!Array.isArray(rows) || !rows.length) { console.log("[rec] nothing new"); return; }
  const auth = `Basic ${Buffer.from(`${env.EXOTEL_API_KEY}:${env.EXOTEL_API_TOKEN}`).toString("base64")}`;
  let n = 0;
  for (const row of rows) {
    try {
      const src = await fetch(row.recording_url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(60000) });
      if (!src.ok) { console.log(`[rec] ${row.id.slice(0, 8)}: exotel ${src.status}`); continue; }
      const buf = Buffer.from(await src.arrayBuffer());
      if (buf.length < 1000) continue;
      const key = `calls/${row.owner_id}/${row.id}.mp3`;
      const up = await fetch(`${SUPA}/storage/v1/object/media/${key}`, { method: "POST", headers: { ...H, "content-type": src.headers.get("content-type") || "audio/mpeg", "x-upsert": "true" }, body: buf });
      if (!up.ok) { console.log(`[rec] ${row.id.slice(0, 8)}: upload ${up.status}`); continue; }
      await fetch(`${SUPA}/rest/v1/crm_calls?id=eq.${row.id}`, { method: "PATCH", headers: { ...H, "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ recording_url: ours + key }) });
      n += 1;
    } catch (e) { console.log(`[rec] ${row.id.slice(0, 8)}: ${e?.message}`); }
  }
  console.log(`[rec] copied ${n}/${rows.length}`);
}
main().catch((e) => { console.error("[rec] fatal", e); process.exit(1); });
