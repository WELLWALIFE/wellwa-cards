// One-off A/B: clone a finished pipeline-2 job, keep its clips, re-record the voice with another TTS model. node bridge/tts-clone.mjs <jobId> <ttsModel>
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const env = {}; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY, h = { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json" };
const [src, model] = process.argv.slice(2); const id = crypto.randomUUID();
const job = (await (await fetch(`${U}/rest/v1/media_jobs?id=eq.${src}&select=*`, { headers: h })).json())[0];
const scenes = await (await fetch(`${U}/rest/v1/media_job_scenes?job_id=eq.${src}&order=i&select=*`, { headers: h })).json();
const input = { ...job.input, outputs: undefined, reassemble: true, product: `${job.input.product} (${model})`, options: { ...job.input.options, ttsModel: model } };
await fetch(`${U}/rest/v1/media_jobs`, { method: "POST", headers: h, body: JSON.stringify({ id, owner_id: job.owner_id, kind: "ad", status: "failed", error: "preparing", pipeline: 2, phase: "storyboard", cost: 0, input, assets: {} }) });
await fetch(`${U}/rest/v1/media_job_scenes`, { method: "POST", headers: h, body: JSON.stringify(scenes.map((s) => ({ job_id: id, i: s.i, status: s.status, preview_url: s.preview_url, original_key: s.original_key, owner_summary: s.owner_summary, notes: s.notes, visible_objects: s.visible_objects, clip: s.clip }))) });
const r = await fetch(`${U}/rest/v1/media_jobs?id=eq.${id}`, { method: "PATCH", headers: h, body: JSON.stringify({ status: "queued", error: null }) }); console.log("queued", r.status, id);
