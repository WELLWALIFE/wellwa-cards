// Runs the still judge over bridge/qc-fixtures/*.jpg and prints verdicts (+ precision/recall when labels.json exists).
// node bridge/qc-calibrate.mjs            labels.json: { "<file>": { "usage_correct": bool, "in_use": bool, "ignore": ["no_text"] } }
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { judgeStill } from "./qc-judge.mjs";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "qc-fixtures");
const APP = path.resolve(DIR, "../..");
const env = { ...process.env }; try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* none */ }
const facts = JSON.parse(fs.readFileSync(path.join(DIR, "facts.json"), "utf8"));
const labels = fs.existsSync(path.join(DIR, "labels.json")) ? JSON.parse(fs.readFileSync(path.join(DIR, "labels.json"), "utf8")) : {};
const refs = fs.readdirSync(DIR).filter((f) => /^ref-.*\.(jpg|png)$/i.test(f)).map((f) => fs.readFileSync(path.join(DIR, f)));
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), e = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [((c - e) / d).toFixed(2), ((c + e) / d).toFixed(2)]; };
let tp = 0, fp = 0, fn = 0, tn = 0;
for (const f of fs.readdirSync(DIR).filter((x) => /\.(jpg|png)$/i.test(x) && !x.startsWith("ref-"))) {
  const lab = labels[f] ?? {};
  const shot = { people: { faces: lab.faces ?? 0 }, product: { visible: true, in_use: lab.in_use ?? false, frame_share: 0.35 } };
  const v = await judgeStill({ key: env.GEMINI_API_KEY, image: fs.readFileSync(path.join(DIR, f)), refs, facts, shot, ignore: lab.ignore ?? [] });
  console.log(`\n${f}  (${v.ms} ms)\n  critical_ok=${v.critical_ok} tap_visible=${v.tap_visible} checks=${JSON.stringify(v.checks)}\n  stream_origin="${v.stream_origin}"\n  fix="${v.fix_instruction}"\n  summary="${v.owner_summary}" notes=${JSON.stringify(v.cosmetic_notes)}`);
  if (typeof lab.usage_correct === "boolean") { const flagged = v.checks?.usage_correct === false || v.tap_visible; const bad = !lab.usage_correct; if (bad && flagged) tp++; else if (!bad && flagged) fp++; else if (bad && !flagged) fn++; else tn++; }
}
if (tp + fp + fn + tn) console.log(`\nwrong-usage detection: TP ${tp} FP ${fp} FN ${fn} TN ${tn} · precision ${tp + fp ? (tp / (tp + fp)).toFixed(2) : "-"} ${JSON.stringify(wilson(tp, tp + fp))} · recall ${tp + fn ? (tp / (tp + fn)).toFixed(2) : "-"} ${JSON.stringify(wilson(tp, tp + fn))}`);
