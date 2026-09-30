// Kling image-to-video via the fal queue, resume-safe: the request URLs are returned right after submit so the
// caller can persist them BEFORE polling — a restarted worker polls the stored URLs and never pays twice.
const FAL = "https://queue.fal.run";
export const KLING_ENDPOINT = process.env.KLING_ENDPOINT || "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";

export async function submitClip({ falKey, imageBuf, prompt, negative, cfg = 0.5, duration = "5" }) {
  const headers = { Authorization: `Key ${falKey}`, "Content-Type": "application/json" };
  const r = await fetch(`${FAL}/${KLING_ENDPOINT}`, { method: "POST", headers, body: JSON.stringify({ image_url: `data:image/jpeg;base64,${imageBuf.toString("base64")}`, prompt, negative_prompt: negative, duration, cfg_scale: cfg }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.request_id) throw new Error("fal submit: " + JSON.stringify(j).slice(0, 200));
  return { request_id: j.request_id, status_url: j.status_url || `${FAL}/${KLING_ENDPOINT}/requests/${j.request_id}/status`, response_url: j.response_url || `${FAL}/${KLING_ENDPOINT}/requests/${j.request_id}`, submitted_at: new Date().toISOString(), endpoint: KLING_ENDPOINT };
}
/** Polls stored URLs only. Returns the mp4 URL. Throws "fal timeout" / "fal failed: …". */
export async function pollClip(pending, { falKey, log = () => {}, maxMs = 12 * 60_000, onTick = () => {} }) {
  const headers = { Authorization: `Key ${falKey}` };
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await fetch(pending.status_url, { headers }).then((r) => r.json()).catch(() => ({}));
    log(`kling ${String(pending.request_id).slice(0, 8)} ${st.status ?? "?"}`); await onTick();
    if (st.status === "COMPLETED") { const res = await fetch(pending.response_url, { headers }).then((r) => r.json()); const url = res.video?.url; if (!url) throw new Error("fal: no video"); return url; }
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error("fal failed: " + JSON.stringify(st).slice(0, 200));
  }
  throw new Error("fal timeout");
}
