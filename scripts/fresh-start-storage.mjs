// FRESH START, part 2 — storage and server files. Run on the server BEFORE the Supabase SQL (the SQL removes the
// object rows; the files behind them can only be found while the rows exist):
//     cd /opt/neuraledge/app && node scripts/fresh-start-storage.mjs            # dry run: shows what would go
//     cd /opt/neuraledge/app && node scripts/fresh-start-storage.mjs --apply    # deletes
// Keeps every object whose path contains the id of a kept owner (the owners of the kept cards, looked up live).
// Also empties public/poster/out (generated posters) — the kept owners' posters are re-made on demand.
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* process env */ }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) { console.error("Supabase env missing"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const APPLY = process.argv.includes("--apply");
const KEEP_CARDS = ["niteen-rajput", "joginder-yadav"];

// kept owners = owners of the kept cards
const cards = await fetch(`${SUPA}/rest/v1/cards?select=username,owner_id&username=in.(${KEEP_CARDS.join(",")})`, { headers: H }).then((r) => r.json());
if (!Array.isArray(cards) || cards.length !== KEEP_CARDS.length) { console.error("kept cards not found:", cards); process.exit(1); }
const keep = new Set(cards.map((c) => c.owner_id));
console.log(`keeping owners of: ${cards.map((c) => c.username).join(", ")} → ${[...keep].join(", ")}`);

async function listAll(bucket, prefix = "", acc = []) {
  let offset = 0;
  for (;;) {
    const r = await fetch(`${SUPA}/storage/v1/object/list/${bucket}`, { method: "POST", headers: H, body: JSON.stringify({ prefix, limit: 1000, offset }) });
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const o of rows) { const full = prefix ? `${prefix}/${o.name}` : o.name; if (o.id === null) await listAll(bucket, full, acc); else acc.push(full); }
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return acc;
}
const buckets = await fetch(`${SUPA}/storage/v1/bucket`, { headers: H }).then((r) => r.json());
let total = 0;
for (const b of Array.isArray(buckets) ? buckets : []) {
  const all = await listAll(b.name);
  const doomed = all.filter((k) => ![...keep].some((id) => k.includes(id)));
  console.log(`[${b.name}] ${all.length} objects, ${doomed.length} to delete, ${all.length - doomed.length} kept`);
  total += doomed.length;
  if (APPLY) {
    for (let i = 0; i < doomed.length; i += 100) {
      const r = await fetch(`${SUPA}/storage/v1/object/${b.name}`, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: doomed.slice(i, i + 100) }) });
      if (!r.ok) console.log("  delete failed", r.status, (await r.text()).slice(0, 120));
    }
  }
}
// generated posters on disk
const OUT = path.join(APP, "public", "poster", "out");
const files = fs.existsSync(OUT) ? fs.readdirSync(OUT) : [];
console.log(`[disk] public/poster/out: ${files.length} files`);
if (APPLY) for (const f of files) { try { fs.unlinkSync(path.join(OUT, f)); } catch { /* ignore */ } }
console.log(APPLY ? `deleted ${total} storage objects + ${files.length} poster files` : `dry run — add --apply to delete ${total} objects + ${files.length} files`);
