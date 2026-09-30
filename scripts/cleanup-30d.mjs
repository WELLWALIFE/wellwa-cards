// Nightly: generated files older than 30 days are deleted — posters on disk (public/poster/out) and videos /
// reels in the Supabase "media" bucket. A poster is re-made on demand, a video the owner wants to keep they
// download or post within the month. Never touches what people uploaded (card photos, logos, products, KYC).
//     cd /opt/neuraledge/app && node scripts/cleanup-30d.mjs            (dry run: counts only)
//     cd /opt/neuraledge/app && node scripts/cleanup-30d.mjs --apply    (deletes)
// Cron (server): 30 20 * * * cd /opt/neuraledge/app && node scripts/cleanup-30d.mjs --apply >> /var/log/shubhora-cleanup.log 2>&1
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* env from the process */ }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");
const DAYS = Number(env.KEEP_GENERATED_DAYS || 30);
const cutoff = Date.now() - DAYS * 86400_000;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const fmt = (b) => `${(b / 1048576).toFixed(1)} MB`;

// 1. posters on disk
let files = 0, bytes = 0;
const OUT = path.join(APP, "public", "poster", "out");
if (fs.existsSync(OUT)) {
  for (const f of fs.readdirSync(OUT)) {
    const p = path.join(OUT, f);
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (!st.isFile() || st.mtimeMs > cutoff) continue;
    files++; bytes += st.size;
    if (APPLY) { try { fs.unlinkSync(p); } catch { /* next */ } }
  }
}
console.log(`[cleanup] posters older than ${DAYS}d: ${files} files, ${fmt(bytes)}${APPLY ? " — deleted" : ""}`);

// 2. videos in the media bucket (folders per owner; list recursively, oldest first)
async function listAll(prefix = "", acc = []) {
  let offset = 0;
  for (;;) {
    const r = await fetch(`${SUPA}/storage/v1/object/list/media`, { method: "POST", headers: H, body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } }) });
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const o of rows) {
      const full = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) await listAll(full, acc);            // a folder
      else acc.push({ key: full, at: new Date(o.updated_at || o.created_at).getTime(), size: Number(o.metadata?.size ?? 0) });
    }
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return acc;
}
if (SUPA && KEY) {
  const all = await listAll();
  const old = all.filter((o) => o.at && o.at < cutoff);
  const size = old.reduce((a, o) => a + o.size, 0);
  console.log(`[cleanup] media objects older than ${DAYS}d: ${old.length} of ${all.length}, ${fmt(size)}${APPLY ? " — deleting" : ""}`);
  if (APPLY) {
    for (let i = 0; i < old.length; i += 100) {
      const batch = old.slice(i, i + 100).map((o) => o.key);
      const r = await fetch(`${SUPA}/storage/v1/object/media`, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: batch }) });
      if (!r.ok) console.log("[cleanup] delete batch failed", r.status, await r.text().catch(() => ""));
    }
    // rows that pointed at them: the app shows a clear message instead of a broken player
    const iso = new Date(cutoff).toISOString();
    await fetch(`${SUPA}/rest/v1/media_jobs?status=eq.done&created_at=lt.${iso}&output_url=not.is.null`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", output_url: null, error: "Kept for 30 days — this video has been removed. Make it again whenever you like." }) }).catch(() => undefined);
  }
} else console.log("[cleanup] no Supabase env — bucket skipped");
