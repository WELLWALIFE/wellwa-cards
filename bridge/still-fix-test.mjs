// attempt-2 (edit mode) check: refs + the failed still + code-written correction → image → judge
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import sharp from "sharp";
import { buildStillPrompt, pickRefs } from "./prompt-builders.mjs"; import { judgeStill } from "./qc-judge.mjs";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "qc-fixtures"); const APP = path.resolve(DIR, "../..");
const env = { ...process.env }; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const facts = JSON.parse(fs.readFileSync(path.join(DIR, "facts.json"), "utf8"));
const shot = { setting: "kitchen", setting_desc: "bright modern Indian kitchen, white counter, plain light tiled wall, window light from the left", people: { faces: 0 }, hands_visible: true, framing: "close_up", lens: "50mm", lighting: "soft morning daylight", product: { visible: true, in_use: true, placement: "at the centre of the counter", frame_share: 0.5 }, hero_motion: "", camera: "static" };
const photos = [{ file: "ref-935.jpg", view: "front", role: "identity" }, { file: "ref-756.jpg", view: "three_quarter", role: "identity" }];
const refs = pickRefs(photos, shot); const failed = fs.readFileSync(process.argv[2]);
const fix = process.argv[3];
const prompt = buildStillPrompt(facts, shot, { ratio: "9:16", refs, fix_instruction: fix });
const inl = async (b, px = 1024) => ({ inlineData: { mimeType: "image/jpeg", data: (await sharp(b).resize({ width: px, height: px, fit: "inside" }).jpeg().toBuffer()).toString("base64") } });
const parts = []; for (const [k, r] of refs.entries()) parts.push({ text: `Image ${k + 1}: ${r.view}` }, await inl(fs.readFileSync(path.join(DIR, r.file))));
parts.push({ text: `Image ${refs.length + 1}: the last image to correct` }, await inl(failed, 1280), { text: prompt });
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`, { method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } } }) });
const j = await r.json(); const p = (j.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data); if (!p) { console.log("no image", JSON.stringify(j).slice(0, 200)); process.exit(1); }
const buf = Buffer.from(p.inlineData.data, "base64"); await sharp(buf).jpeg({ quality: 90 }).toFile("/tmp/still-fixed.jpg");
const v = await judgeStill({ key: env.GEMINI_API_KEY, image: buf, refs: refs.map((x) => fs.readFileSync(path.join(DIR, x.file))), facts, shot });
console.log(JSON.stringify({ critical_ok: v.critical_ok, same_product: v.checks.same_product, usage: v.checks.usage_correct, hoses: [v.A2?.hoses_in_refs, v.A2?.hoses_in_crop], added: v.A2?.parts_added, fix: v.fix_instruction, summary: v.owner_summary }));
