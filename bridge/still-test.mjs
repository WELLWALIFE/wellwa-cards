// One-off live check: new still prompt → image model → judge. node bridge/still-test.mjs [in_use|idle]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import sharp from "sharp";
import { buildStillPrompt, pickRefs } from "./prompt-builders.mjs"; import { judgeStill } from "./qc-judge.mjs";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "qc-fixtures"); const APP = path.resolve(DIR, "../..");
const env = { ...process.env }; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const IMG_MODEL = env.IMG_MODEL || "gemini-2.5-flash-image";
const facts = JSON.parse(fs.readFileSync(path.join(DIR, "facts.json"), "utf8"));
const mode = process.argv[2] || "in_use";
const shot = mode === "in_use"
  ? { setting: "kitchen", setting_desc: "bright modern Indian kitchen, white counter, plain light tiled wall, window light from the left", people: { faces: 0 }, hands_visible: true, framing: "close_up", lens: "50mm", lighting: "soft morning daylight", product: { visible: true, in_use: true, placement: "at the centre of the counter", frame_share: 0.5 }, hero_motion: "", camera: "static" }
  : { setting: "kitchen", setting_desc: "bright modern Indian kitchen, white counter, plain light tiled wall", people: { faces: 1, desc: "a woman about 35 in a cotton kurta standing beside it, smiling at the camera with a full glass of water" }, hands_visible: true, framing: "medium", lens: "35mm", lighting: "soft morning daylight", product: { visible: true, in_use: false, placement: "beside her on the counter", frame_share: 0.35 }, hero_motion: "she lifts the glass slightly", camera: "slow_push_in" };
const photos = [{ file: "ref-935.jpg", view: "front", role: "identity" }, { file: "ref-756.jpg", view: "three_quarter", role: "identity" }];
const refs = pickRefs(photos, shot);
const prompt = buildStillPrompt(facts, shot, { ratio: "9:16", refs });
console.log(prompt, "\n---");
const parts = []; for (const r of refs) parts.push({ inlineData: { mimeType: "image/jpeg", data: (await sharp(fs.readFileSync(path.join(DIR, r.file))).resize({ width: 1024, height: 1024, fit: "inside" }).jpeg().toBuffer()).toString("base64") } });
const t0 = Date.now();
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [...parts, { text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } } }) });
const j = await r.json(); const p = (j.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
if (!p) { console.log("no image:", JSON.stringify(j).slice(0, 300)); process.exit(1); }
const buf = Buffer.from(p.inlineData.data, "base64"); const out = `/tmp/still-${mode}.jpg`; await sharp(buf).jpeg({ quality: 90 }).toFile(out);
console.log("image", IMG_MODEL, Date.now() - t0, "ms →", out);
const v = await judgeStill({ key: env.GEMINI_API_KEY, image: buf, refs: refs.map((x) => fs.readFileSync(path.join(DIR, x.file))), facts, shot });
console.log(JSON.stringify({ critical_ok: v.critical_ok, tap_visible: v.tap_visible, checks: v.checks, stream_origin: v.stream_origin, fix: v.fix_instruction, summary: v.owner_summary, notes: v.cosmetic_notes, emitters: v.A?.emitters, added: v.A2?.parts_added }, null, 1));
