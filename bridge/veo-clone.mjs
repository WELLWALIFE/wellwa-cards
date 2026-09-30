// One-off comparison: clone a finished pipeline-2 job and re-animate it with Veo clips (same stills, prompts, voice, captions).
// node bridge/veo-clone.mjs <jobId> <lite|fast>
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url"; import sharp from "sharp";
import { buildKlingPrompt } from "./prompt-builders.mjs";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {}; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY; const h = { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json", Prefer: "return=representation" };
const [src, tier] = process.argv.slice(2); const model = tier === "fast" ? "veo-3.1-fast-generate-preview" : "veo-3.1-lite-generate-preview";
const job = (await (await fetch(`${U}/rest/v1/media_jobs?id=eq.${src}&select=*`, { headers: h })).json())[0];
const scenes = await (await fetch(`${U}/rest/v1/media_job_scenes?job_id=eq.${src}&order=i&select=*`, { headers: h })).json();
const id = crypto.randomUUID(); const G = "https://generativelanguage.googleapis.com/v1beta"; const gh = { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" };
async function veo(i) {
  const still = Buffer.from(await (await fetch(`${U}/storage/v1/object/ad-work/${scenes[i].original_key}`, { headers: h })).arrayBuffer());
  const img = await sharp(still).resize({ width: 1080 }).jpeg({ quality: 92 }).toBuffer();
  const shot = job.input.script.scenes[i].shot; const prompt = buildKlingPrompt(job.input.facts, shot, { visible_objects: scenes[i].visible_objects ?? [] });
  for (let t = 0; t < 2; t++) {
    const st = await (await fetch(`${G}/models/${model}:predictLongRunning`, { method: "POST", headers: gh, body: JSON.stringify({ instances: [{ prompt, image: { bytesBase64Encoded: img.toString("base64"), mimeType: "image/jpeg" } }], parameters: { aspectRatio: "9:16", durationSeconds: 6, resolution: "720p", personGeneration: "allow_adult" } }) })).json();
    if (!st.name) { console.log(i, "start failed", JSON.stringify(st).slice(0, 200)); continue; }
    for (let k = 0; k < 40; k++) { await new Promise((r) => setTimeout(r, 12000)); const op = await (await fetch(`${G}/${st.name}`, { headers: gh })).json(); if (!op.done) continue; const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri; if (!uri) { console.log(i, "no video", JSON.stringify(op.error ?? op.response).slice(0, 200)); break; } const buf = Buffer.from(await (await fetch(uri, { headers: gh })).arrayBuffer()); const key = `${job.owner_id}/${id}/clip-${i}.mp4`; const up = await fetch(`${U}/storage/v1/object/ad-work/${key}`, { method: "POST", headers: { apikey: K, Authorization: "Bearer " + K, "Content-Type": "video/mp4", "x-upsert": "true" }, body: buf }); console.log(i, model, "clip ok", up.status); return key; }
  }
  throw new Error(`scene ${i} failed`);
}
const keys = await Promise.all(scenes.map((_, i) => veo(i)));
const input = { ...job.input, outputs: undefined, product: `${job.input.product} (Veo ${tier})` };
let r = await fetch(`${U}/rest/v1/media_jobs`, { method: "POST", headers: h, body: JSON.stringify({ id, owner_id: job.owner_id, kind: "ad", status: "failed", error: "preparing", pipeline: 2, phase: "animate", cost: 0, input, assets: job.assets }) }); console.log("job", r.status);
r = await fetch(`${U}/rest/v1/media_job_scenes`, { method: "POST", headers: h, body: JSON.stringify(scenes.map((s, i) => ({ job_id: id, i: s.i, status: s.status, preview_url: s.preview_url, original_key: s.original_key, owner_summary: s.owner_summary, notes: s.notes, visible_objects: s.visible_objects, line: s.line, clip: { key: keys[i], endpoint: model } }))) }); console.log("scenes", r.status);
r = await fetch(`${U}/rest/v1/media_jobs?id=eq.${id}`, { method: "PATCH", headers: h, body: JSON.stringify({ status: "queued", error: null }) }); console.log("queued", r.status, id);
