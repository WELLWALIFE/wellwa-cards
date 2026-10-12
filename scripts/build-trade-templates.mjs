// Gathers the trade templates' DATA into the repo: the sample content written per trade (products with prices,
// services, reviews, FAQ, hours…), the five designs per trade, and which photos exist under public/art/tpl/<trade>/.
// src/lib/template-gen.ts turns this into 5 finished templates per trade at import time (server only).
//
//   node scripts/build-trade-templates.mjs [--samples DIR] [--designs DIR]
// Default dirs: the research scratchpad of 12 Oct 2026; the output is src/lib/trade-templates/data.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = "/private/tmp/claude-501/-Users-jsrao-Desktop-Wellwa-Life-wellwa-cards/fcb53094-425f-4876-bd1f-c2c297620b41/scratchpad";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const samplesDir = arg("--samples", path.join(SP, "samples")), designsDir = arg("--designs", path.join(SP, "designs"));
const read = (dir) => fs.existsSync(dir) ? Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => { try { return [f.replace(".json", ""), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]; } catch { return [f, null]; } }).filter(([, v]) => v)) : {};
const samples = read(samplesDir), designs = read(designsDir);
const photos = {};
const root = path.join(APP, "public", "art", "tpl");
if (fs.existsSync(root)) for (const t of fs.readdirSync(root)) { const d = path.join(root, t); if (fs.statSync(d).isDirectory()) photos[t] = fs.readdirSync(d).filter((f) => f.endsWith(".jpg") && f !== "sheet.jpg").map((f) => f.replace(".jpg", "")).sort(); }
const out = { builtAt: new Date().toISOString().slice(0, 16), samples, designs, photos };
fs.writeFileSync(path.join(APP, "src", "lib", "trade-templates", "data.json"), JSON.stringify(out));
const bytes = fs.statSync(path.join(APP, "src", "lib", "trade-templates", "data.json")).size;
console.log(`samples ${Object.keys(samples).length}, designs ${Object.keys(designs).length}, photo sets ${Object.keys(photos).length}, ${Math.round(bytes / 1024)} KB`);
