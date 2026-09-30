// The film's WORK, kept where a restart cannot lose it.
//
// Everything expensive a long video makes on the way — recorded paragraphs, the transcript, the plan, every
// picture that passed — used to live only in /tmp/explain-<job>. A retry found it there and carried on; a server
// restart, a full disk or the 24-hour sweep found nothing and paid for all of it again, in rupees and in the
// owner's patience. Now each of those files is copied to the media bucket the moment it exists
// (ai-media/<owner>/work/<job>/<name>) and, when a retry starts with an empty folder, copied back first.
//
// Shots and the final encode are not kept: they are CPU, not money, and re-made in minutes.
// The work stays after the video is done — the Scene Editor (edits without re-making everything) needs it.
import fs from "node:fs";
import path from "node:path";

/** What is worth keeping: the paid-for and the slow. */
export const KEEP = /^(vo-\d+\.wav|secs\.json|[\w.-]+\.words\.json|plan-[a-z]+\.json|img-[a-z]+-\d+(-e\d+)?\.jpg|own-\d+\.jpg|scenes-[a-z]+\.json|edits\.json)$/;

const prefix = (job) => `ai-media/${job.owner_id}/work/${job.id}`;
const headers = (H, extra = {}) => ({ apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}`, ...extra });

/** Copy one file of the job's folder to the bucket. Never throws: a failed copy costs a retry, not the film. */
export async function saveWork(H, job, file, { log = () => {} } = {}) {
  const name = path.basename(file);
  if (!H?.SUPA_URL || !H?.SUPA_KEY || !KEEP.test(name)) return false;
  try {
    const bytes = fs.readFileSync(file);
    const type = name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".wav") ? "audio/wav" : "application/json";
    const r = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${prefix(job)}/${name}`, {
      method: "POST", headers: headers(H, { "Content-Type": type, "x-upsert": "true" }), body: bytes, signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) log(`[work] could not keep ${name}: ${r.status}`);
    return r.ok;
  } catch (e) { log(`[work] could not keep ${name}: ${e?.message ?? e}`); return false; }
}

/** Bring the job's kept files back into an empty folder. Returns how many came back. */
export async function restoreWork(H, job, dir, { log = () => {} } = {}) {
  if (!H?.SUPA_URL || !H?.SUPA_KEY) return 0;
  let names = [];
  try {
    const r = await fetch(`${H.SUPA_URL}/storage/v1/object/list/media`, {
      method: "POST", headers: headers(H, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix: prefix(job), limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return 0;
    names = ((await r.json().catch(() => [])) || []).map((o) => o?.name).filter((n) => n && KEEP.test(n));
  } catch (e) { log(`[work] could not list kept files: ${e?.message ?? e}`); return 0; }
  let back = 0;
  for (const name of names) {
    const dest = path.join(dir, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    try {
      const r = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${prefix(job)}/${name}`, { headers: headers(H), signal: AbortSignal.timeout(120_000) });
      if (!r.ok) continue;
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      back++;
    } catch (e) { log(`[work] could not restore ${name}: ${e?.message ?? e}`); }
  }
  if (back) log(`[work] ${back} file(s) restored from the bucket — carrying on from there`);
  return back;
}

/** Fetch ONE kept file afresh, overwriting the local copy — for edits.json, which the app rewrites for every edit
 *  and which a folder left over from the last build would otherwise shadow with the previous edit's list. */
export async function fetchWork(H, job, name, dir, { log = () => {} } = {}) {
  if (!H?.SUPA_URL || !H?.SUPA_KEY || !KEEP.test(name)) return false;
  try {
    const r = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${prefix(job)}/${name}`, { headers: headers(H), signal: AbortSignal.timeout(60_000) });
    if (!r.ok) { log(`[work] ${name} is not in the bucket (${r.status})`); return false; }
    fs.writeFileSync(path.join(dir, name), Buffer.from(await r.arrayBuffer()));
    return true;
  } catch (e) { log(`[work] could not fetch ${name}: ${e?.message ?? e}`); return false; }
}

/** Remove the job's kept files (a deleted video, or a job the owner cancelled). */
export async function dropWork(H, job, { log = () => {} } = {}) {
  if (!H?.SUPA_URL || !H?.SUPA_KEY) return;
  try {
    const r = await fetch(`${H.SUPA_URL}/storage/v1/object/list/media`, {
      method: "POST", headers: headers(H, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix: prefix(job), limit: 1000, offset: 0 }), signal: AbortSignal.timeout(30_000),
    });
    const names = r.ok ? ((await r.json().catch(() => [])) || []).map((o) => o?.name).filter(Boolean) : [];
    if (!names.length) return;
    await fetch(`${H.SUPA_URL}/storage/v1/object/media`, {
      method: "DELETE", headers: headers(H, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: names.map((n) => `${prefix(job)}/${n}`) }), signal: AbortSignal.timeout(60_000),
    });
  } catch (e) { log(`[work] could not drop kept files: ${e?.message ?? e}`); }
}
