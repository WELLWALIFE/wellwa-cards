// Rebuilds one trade's card photo pool with the current judge (v4) and writes a contact sheet to look at. Run on the VPS:
//   node scripts/rebuild-card-pool.mjs kirana "Kirana / general store"
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
import { ensureCardMedia } from "../bridge/stock-art.mjs";
const [category, label] = [process.argv[2] || "kirana", process.argv[3] || "Kirana / general store"];
const t0 = Date.now();
let pool = await ensureCardMedia({ category, label, soon: 99, waitMs: 900_000 });
// A v3 pool is handed back at once while v4 fills in the background: wait for the v4 file to be complete.
const cat = category.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
const metaV4 = path.resolve("public/poster/base/stock/card", `${cat}-v4.json`);
for (let i = 0; i < 180; i++) { try { const m = JSON.parse(fs.readFileSync(metaV4, "utf8")); if (!m.partial) { pool = m; break; } } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 5000)); }
console.log(`${category}: ${pool.photos.length} photos in ${Math.round((Date.now() - t0) / 1000)}s`, pool.partial ? "(partial)" : "");
const dir = path.resolve("public/poster/base/stock/card");
const tiles = [];
for (const p of pool.photos) {
  const f = path.join(dir, path.basename(p.url));
  if (!fs.existsSync(f)) continue;
  tiles.push(await sharp(f).resize(400, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer());
}
const cols = 4, rows = Math.ceil(tiles.length / cols);
const sheet = sharp({ create: { width: cols * 400, height: Math.max(1, rows) * 300, channels: 3, background: "#fff" } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 400, top: Math.floor(i / cols) * 300 })));
await sheet.jpeg({ quality: 82 }).toFile(`/tmp/pool-${category}.jpg`);
console.log("sheet:", `/tmp/pool-${category}.jpg`, pool.photos.map((p) => path.basename(p.url)).join(" "));
process.exit(0);
