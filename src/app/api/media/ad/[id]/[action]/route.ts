// Pipeline-2 job actions (spec §8.3). All status-guarded: only the request that flips the row spends or refunds.
//   approve        review(await) → charge → queued/animate
//   redraw         review → queued/storyboard for one scene (first per scene free, then 1 credit)
//   discard        review → failed (refund if credits are held after a render failure)
//   retry-render   review(render_failed) → queued/animate, free (cached clips are reused)
import { NextResponse } from "next/server";
import { requireUser, sameOrigin, workerAlive, WORKER_DOWN } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adCredits } from "@/lib/media/ad-pricing";
import { runGates } from "@/lib/media/ad-rules";
import { VOICE_KEYS } from "@/lib/media/voices";

const UUID = /^[0-9a-f-]{36}$/i;
const OK = ["pass", "pass_with_notes", "safe_shot"];
type Brief = { length?: number }; type Opts = { videos?: number };

export async function POST(request: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser(); if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase(); if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const { id, action } = await ctx.params; if (!UUID.test(id)) return NextResponse.json({ error: "Bad job id." }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const uid = session.user.id;
  const { data: job } = await admin.from("media_jobs").select("id, owner_id, status, phase, stage, cost, pipeline, input, output_url").eq("id", id).single();
  if (!job || job.owner_id !== uid || job.pipeline !== 2) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  // Every action except "discard" hands work to the render worker, and three of them
  // (approve, redo-scene, redraw) take credits for it. Never charge — and never queue —
  // when nothing is there to pick the job up; "discard" stays open because it is the
  // owner's way out. Same gate and same sentence as /api/media/ad.
  if (action !== "discard" && !(await workerAlive(admin, true))) {
    return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });
  }
  const now = new Date().toISOString();
  const input = (job.input ?? {}) as { brief?: Brief & { lang?: string; offer?: string; phone?: string }; options?: Opts & Record<string, unknown>; facts?: unknown; script?: { scenes: { text: string; caption: string }[]; cta: { text: string; caption: string } }; reassembles?: number; outputs?: Record<string, string>; delivered?: boolean };
  // Has this job ever handed the owner a finished video? "Change music" and "Redo one
  // scene" send a DONE job back through the renderer with its cost untouched, so if that
  // rebuild fails the row sits at render_failed holding the ORIGINAL full price — while
  // the first video is still on the row and still theirs. Refunding it would turn a paid
  // ad into a free one.
  const delivered = input.delivered === true || !!job.output_url || !!input.outputs;

  // ---- after the first render: change things without paying for Kling again ----
  if (action === "reassemble" || action === "redo-scene") {
    if (job.status !== "done") return NextResponse.json({ error: "This works on a finished video." }, { status: 409 });
    if ((input.reassembles ?? 0) >= 8) return NextResponse.json({ error: "This video has been changed 8 times — please start a new one." }, { status: 409 });
    const options = { ...(input.options ?? {}) };
    let charged = 0; let scene = -1;
    if (action === "reassemble") { // music / voice / captions → free; clips and stills are reused
      if (typeof b.music === "string" && /^[a-z0-9-]{0,40}$/i.test(b.music)) options.music = b.music;
      if (VOICE_KEYS.includes(b.voiceStyle)) options.voiceStyle = b.voiceStyle;
      if (b.captions === "off" || b.captions === "words") options.captions = b.captions;
    } else { // one scene redrawn + re-animated: pays that scene's share
      const n = input.script?.scenes.length ?? 0; scene = Math.trunc(Number(b.scene));
      if (!(scene >= 0 && scene < n)) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
      charged = Math.max(1, Math.ceil((Number(job.cost) || adCredits(Number(input.brief?.length) || 10)) / n));
      const { error } = await admin.rpc("spend_credits", { p_user: uid, p_amount: charged, p_reason: "ad-scene-redo", p_ref: `${id}:redo:${scene}:${input.reassembles ?? 0}` });
      if (error) return NextResponse.json({ error: `Not enough credits (${charged} needed).`, cost: charged }, { status: 402 });
      await admin.from("media_job_scenes").update({ redraw_requested: true, redraw_mode: String(b.note ?? "").trim() ? "change" : "redraw", redraw_note: String(b.note ?? "").slice(0, 200) || null, clip: null, clip_pending: null, updated_at: now }).eq("job_id", id).eq("i", scene);
    }
    // `delivered` is remembered on the row: after this rebuild the job may end at
    // render_failed, and Discard (and the 72 h sweep) must know the owner already has a video.
    const next = { ...input, options, delivered: true, reassemble: action === "reassemble", reassembles: (input.reassembles ?? 0) + 1 };
    const { data: flipped } = await admin.from("media_jobs").update({ status: "queued", phase: "storyboard", stage: "queued", input: next, error: null, updated_at: now }).eq("id", id).eq("status", "done").select("id");
    if (!flipped?.length) {
      // The refund ref must be as unique as the charge (`${id}:redo:${scene}:${n}`): two
      // redo-scene taps for DIFFERENT scenes both lose this flip, and under a shared ref
      // credit_ledger_ad_reason_ref_uidx swallowed the second refund in silence.
      if (charged) {
        const { error: backErr } = await admin.rpc("grant_credits", { p_user: uid, p_amount: charged, p_reason: "ad-refund", p_ref: `${id}:redo-refund:${scene}:${input.reassembles ?? 0}` });
        if (backErr) console.error("[ad-action] redo rollback refund FAILED", id, uid, scene, charged, backErr);
      }
      return NextResponse.json({ error: "Already started." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, charged });
  }

  if (job.status !== "review") return NextResponse.json({ error: "This video is not waiting for you right now." }, { status: 409 });

  if (action === "line") { // edit one spoken line / caption on the storyboard → only the voice is re-recorded
    if (job.stage === "render_failed" || !input.script) return NextResponse.json({ error: "Not possible right now." }, { status: 409 });
    const scene = b.scene === "cta" ? "cta" : Math.trunc(Number(b.scene)); const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!text) return NextResponse.json({ error: "Write the line first." }, { status: 400 });
    const script = { ...input.script, scenes: input.script.scenes.map((x) => ({ ...x })), cta: { ...input.script.cta } };
    if (scene === "cta") script.cta.text = text; else if (script.scenes[scene]) { script.scenes[scene].text = text; if (typeof b.caption === "string" && b.caption.trim()) script.scenes[scene].caption = b.caption.trim().slice(0, 40); } else return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    const g = runGates(script, { tier: "realistic", length: Number(input.brief?.length) || 10, lang: input.brief?.lang || "hinglish", facts: input.facts, brief: { offer: input.brief?.offer, phone: input.brief?.phone } });
    const mine = g.errors.filter((e) => e.scene === scene && ["G2", "G4", "G5", "G6", "G7", "G8"].includes(e.gate));
    if (mine.length) return NextResponse.json({ error: mine[0].msg, gate_errors: mine }, { status: 400 });
    const { data: flipped } = await admin.from("media_jobs").update({ status: "queued", phase: "storyboard", stage: "queued", input: { ...input, script }, updated_at: now }).eq("id", id).eq("status", "review").select("id");
    return flipped?.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Already started." }, { status: 409 });
  }

  if (action === "approve") {
    if (job.stage === "render_failed") return NextResponse.json({ error: "Use “Retry render”." }, { status: 409 });
    const { data: scenes } = await admin.from("media_job_scenes").select("i, status, redraw_requested").eq("job_id", id);
    const bad = (scenes ?? []).filter((s) => !OK.includes(s.status) || s.redraw_requested);
    if (!scenes?.length || bad.length) return NextResponse.json({ error: "Some scenes still need your attention.", scenes: bad.map((s) => s.i) }, { status: 409 });
    const safeInUse = (scenes ?? []).some((s) => s.status === "safe_shot");
    if (safeInUse && b.ack_no_in_use !== true) return NextResponse.json({ error: "Please confirm: one scene will show the product standing, not working.", need_ack: true }, { status: 409 });
    const alreadyPaid = (Number(job.cost) || 0) > 0;
    const cost = alreadyPaid ? Number(job.cost) : Math.ceil(adCredits(Number(input.brief?.length) || 10) * (input.options?.videos === 3 ? 1.5 : 1));
    // flip first (guarded) so a double tap cannot charge twice; roll back if the charge fails
    const { data: flipped } = await admin.from("media_jobs").update({ status: "queued", phase: "animate", stage: "queued", cost, error: null, updated_at: now }).eq("id", id).eq("status", "review").select("id");
    if (!flipped?.length) return NextResponse.json({ error: "Already started." }, { status: 409 });
    const { error: spendErr } = alreadyPaid ? { error: null } : await admin.rpc("spend_credits", { p_user: uid, p_amount: cost, p_reason: "ad-animate", p_ref: id });
    if (spendErr) {
      await admin.from("media_jobs").update({ status: "review", phase: "storyboard", stage: "await", cost: 0, updated_at: now }).eq("id", id);
      return NextResponse.json({ error: spendErr.message.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${cost} needed).` : "Could not charge credits.", cost }, { status: 402 });
    }
    return NextResponse.json({ ok: true, cost: alreadyPaid ? 0 : cost });
  }

  if (action === "redraw") {
    if (job.stage === "render_failed") return NextResponse.json({ error: "Retry or discard the render first." }, { status: 409 });
    const scene = Math.trunc(Number(b.scene)); const mode = ["redraw", "change", "safe", "own_photo"].includes(b.mode) ? b.mode : "redraw";
    const ownUrl = mode === "own_photo" && typeof b.photo_url === "string" && b.photo_url.includes(`/media/`) && b.photo_url.includes(uid) ? b.photo_url.slice(0, 500) : null;
    if (mode === "own_photo" && !ownUrl) return NextResponse.json({ error: "Upload the photo first." }, { status: 400 });
    const { data: row } = await admin.from("media_job_scenes").select("i, redraws").eq("job_id", id).eq("i", scene).single();
    if (!row) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    if (row.redraws >= 6) return NextResponse.json({ error: "This scene has been redrawn 6 times — edit the script or use the safe product shot." }, { status: 409 });
    const paid = row.redraws >= 1 && mode !== "own_photo" && mode !== "safe"; // your own photo and the safe shot are always free
    if (paid) { const { error } = await admin.rpc("spend_credits", { p_user: uid, p_amount: 1, p_reason: "ad-redraw", p_ref: `${id}:${scene}:${row.redraws}` }); if (error) return NextResponse.json({ error: "Not enough credits (1 needed)." }, { status: 402 }); }
    await admin.from("media_job_scenes").update({ own_photo_url: ownUrl, redraw_requested: true, redraw_mode: mode, redraw_note: String(b.note ?? "").slice(0, 200) || null, redraws: row.redraws + 1, updated_at: now }).eq("job_id", id).eq("i", scene);
    const { data: flipped } = await admin.from("media_jobs").update({ status: "queued", phase: "storyboard", stage: "queued", updated_at: now }).eq("id", id).eq("status", "review").select("id");
    if (!flipped?.length && paid) await admin.rpc("grant_credits", { p_user: uid, p_amount: 1, p_reason: "ad-redraw-refund", p_ref: `${id}:${scene}:${row.redraws}` });
    return NextResponse.json({ ok: true, charged: paid ? 1 : 0 });
  }

  if (action === "retry-render") {
    if (job.stage !== "render_failed") return NextResponse.json({ error: "Nothing to retry." }, { status: 409 });
    const { data: flipped } = await admin.from("media_jobs").update({ status: "queued", phase: "animate", stage: "queued", error: null, updated_at: now }).eq("id", id).eq("status", "review").select("id");
    return flipped?.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Already started." }, { status: 409 });
  }

  if (action === "discard") {
    const { data: flipped } = await admin.from("media_jobs").update({ status: "failed", error: "Discarded", stage: "discarded", updated_at: now }).eq("id", id).eq("status", "review").select("id, cost");
    if (!flipped?.length) return NextResponse.json({ error: "Already handled." }, { status: 409 });
    // Refund only a video that was never delivered — the platform's own failure. A job that
    // already gave the owner a video and then failed a free rebuild keeps its price: they
    // still have the file, and "Discard" must not buy it back for them.
    const held = delivered ? 0 : Number(job.cost) || 0;
    if (held > 0) {
      const { error: backErr } = await admin.rpc("grant_credits", { p_user: uid, p_amount: held, p_reason: "ad-refund", p_ref: id });
      if (backErr) console.error("[ad-action] discard refund FAILED", id, uid, held, backErr);
    }
    return NextResponse.json({ ok: true, refunded: held, delivered });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 404 });
}
