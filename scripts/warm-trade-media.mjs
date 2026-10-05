// Fills every trade's website photos (twelve) and clip ahead of time, so no customer waits for their trade's first
// build (owner's call, 5 Oct 2026: "pehli site 3 minute leti hai"). A trade already cached is skipped in a moment.
//
// Run on the VPS, from the app folder (stock-art.mjs reads .env.local there: Pexels, Gemini, ffmpeg):
//   nohup node scripts/warm-trade-media.mjs > /var/log/shubhora-warm.log 2>&1 &
// Options: --only kirana,medical   just these trades
//          --gap 240               seconds between trades (Pexels allows ~200 searches an hour; a trade uses ~12)
//          --dry                   list what would be filled
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const only = new Set((arg("--only") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const gap = Math.max(0, Number(arg("--gap") ?? 240)) * 1000;
const dry = process.argv.includes("--dry");

// The trade list is TypeScript; its rows are one call each: c("key", "hi", "en", …).
const src = fs.readFileSync(path.join(APP, "src", "lib", "poster-categories.ts"), "utf8");
const trades = [...src.matchAll(/^\s*c\("([^"]+)",\s*"[^"]*",\s*"([^"]+)"/gm)].map((m) => ({ key: m[1], en: m[2] }))
  .filter((t) => !only.size || only.has(t.key));
if (!trades.length) { console.log("no trades matched"); process.exit(1); }

const { ensureCardMedia } = await import(path.join(APP, "bridge", "stock-art.mjs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(`${trades.length} trades${dry ? " (dry run)" : ""}`);
let filled = 0;
for (const [i, t] of trades.entries()) {
  if (dry) { console.log(`${i + 1}. ${t.key} — ${t.en}`); continue; }
  const t0 = Date.now();
  // soon 99: wait for the whole pool (twelve photos and the clip), as a Premium build would.
  const pool = await ensureCardMedia({ category: t.key, label: t.en, soon: 99, waitMs: 15 * 60_000 }).catch((e) => { console.log(`${t.key}: failed — ${e?.message ?? e}`); return null; });
  const ms = Date.now() - t0;
  const cached = ms < 3000 && (pool?.photos?.length ?? 0) > 0;
  console.log(`${i + 1}/${trades.length} ${t.key}: ${pool?.photos?.length ?? 0} photos${pool?.clip ? " + clip" : ""} ${cached ? "(already cached)" : `(${Math.round(ms / 1000)} s)`}`);
  if (!cached) { filled++; if (i < trades.length - 1) await sleep(gap); }
}
console.log(`done: ${filled} trade(s) filled`);
process.exit(0);
