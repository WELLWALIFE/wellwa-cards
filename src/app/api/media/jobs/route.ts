// Studio: the signed-in user's balance + recent jobs (the page polls this).
// DELETE cancels a stuck queued/running job and refunds its credits — before
// this existed, a crashed worker left status="running" forever and the "one
// reel at a time" guard blocked every future reel with no way out. On a job
// that has already finished, DELETE removes the video and its files for good.

import { NextResponse } from "next/server";
import { requireUser, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  // ?id= → one pipeline-2 job with its storyboard scenes (RLS: own rows, judge internals are not selectable)
  const one = new URL(request.url).searchParams.get("id");
  if (one && /^[0-9a-f-]{36}$/i.test(one)) {
    // spent_credits travels with the job so the storyboard sheet can tell the owner
    // the truth about the money: a render we failed is refunded in full, a render
    // THEY stopped only gets back what we had not spent yet.
    const [{ data: first }, { data: scenes }, { data: credits }] = await Promise.all([
      session.supabase.from("media_jobs").select("id, kind, status, phase, stage, progress, output_url, cost, spent_credits, error, created_at, input, pipeline").eq("id", one).single(),
      session.supabase.from("media_job_scenes").select("i, status, preview_url, owner_summary, notes, redraws, line").eq("job_id", one).order("i"),
      session.supabase.rpc("my_credits"),
    ]);
    // Until migration 0051 is run the column is missing and the select above fails —
    // read the old shape rather than answering 404 for a job that exists.
    let job: unknown = first;
    if (!job) {
      const { data: legacy } = await session.supabase.from("media_jobs").select("id, kind, status, phase, stage, progress, output_url, cost, error, created_at, input, pipeline").eq("id", one).single();
      job = legacy;
    }
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json({ job, scenes: scenes ?? [], credits: credits ?? 0 });
  }

  // ?kind=explainer → only that kind. Twenty rows of ALL kinds is not twenty of the kind the page shows: a day of
  // ads and reels pushed the long video the owner had just started right off its own page.
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  let list = session.supabase.from("media_jobs")
    .select("id, kind, status, phase, stage, progress, pipeline, output_url, cost, error, created_at, input")
    .order("created_at", { ascending: false }).limit(20);
  if (/^[a-z-]{1,20}$/.test(kind)) list = list.eq("kind", kind);
  const [{ data: credits }, { data: jobs }] = await Promise.all([session.supabase.rpc("my_credits"), list]);
  return NextResponse.json({ credits: credits ?? 0, jobs: jobs ?? [] });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Job id is required." }, { status: 400 });

  let { data: job } = await admin.from("media_jobs")
    .select("id, owner_id, status, cost, spent_credits, kind, input").eq("id", id).single();
  let hasSpendColumn = !!job;
  if (!job) {
    // Deploy-window safety net: migration 0051 adds spent_credits, and until it is run the
    // select above fails on the missing column. Cancel is the owner's only way out of a stuck
    // render, so it must never be the thing that breaks — read the old shape instead. Without
    // the column the worker is not recording spend either, so a full refund is still correct.
    const { data: legacy, error: legacyErr } = await admin.from("media_jobs")
      .select("id, owner_id, status, cost, kind, input").eq("id", id).single();
    if (legacy) console.error("[jobs] media_jobs.spent_credits is missing — run migration 0051", id);
    else if (legacyErr) console.error("[jobs] cancel lookup failed", id, legacyErr.message);
    job = legacy ? { ...legacy, spent_credits: 0 } : null;
    hasSpendColumn = false;
  }
  if (!job || job.owner_id !== session.user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (job.status !== "queued" && job.status !== "running") {
    // A finished (or failed) job: DELETE removes it for good — the video files in the bucket first, then the row.
    // No refund: nothing is owed on a delivered video, and a failed one was refunded when it failed.
    const { data: full } = await admin.from("media_jobs").select("id, output_url, input").eq("id", id).single();
    const urls = new Set<string>();
    if (full?.output_url) urls.add(String(full.output_url));
    const outs = (full?.input as { outputs?: Record<string, string> } | null)?.outputs;
    if (outs && typeof outs === "object") for (const u of Object.values(outs)) if (typeof u === "string") urls.add(u);
    const keys = [...urls].map((u) => { const m = /\/storage\/v1\/object\/public\/media\/(.+)$/.exec(u); return m ? decodeURIComponent(m[1]) : ""; })
      .filter((k) => k && k.startsWith(`ai-media/${session.user.id}/`));   // only this owner's own files, ever
    // The kept work of a long video (pictures, voice clips, plan) lives under work/<job>; it goes with the video.
    const workPrefix = `ai-media/${session.user.id}/work/${id}`;
    const { data: work } = await admin.storage.from("media").list(workPrefix, { limit: 1000 });
    for (const f of work ?? []) if (f?.name) keys.push(`${workPrefix}/${f.name}`);
    if (keys.length) {
      const { error: rmErr } = await admin.storage.from("media").remove(keys);
      if (rmErr) console.error("[jobs] delete: storage remove failed", id, rmErr.message);
    }
    // A PAUSED video still holds its credits (it was going to continue). Deleting it hands them back.
    const { data: state } = await admin.from("media_jobs").select("error, cost").eq("id", id).single();
    if (state && /^PAUSED/.test(String(state.error ?? "")) && Number(state.cost) > 0) {
      const { error: refundErr } = await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: Number(state.cost), p_reason: "paused-delete-refund", p_ref: id });
      if (refundErr) console.error("[jobs] paused delete refund failed", id, refundErr);
    }
    await admin.from("media_job_scenes").delete().eq("job_id", id).then(() => {}, () => {});
    const { error: delErr } = await admin.from("media_jobs").delete().eq("id", id).eq("owner_id", session.user.id);
    if (delErr) return NextResponse.json({ error: "Could not delete this video." }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: true, files: keys.length });
  }

  // Stopping an EDIT of a finished long video is not stopping a video: the finished video comes back exactly as it
  // was (status done, its file untouched) and only the edit's unspent credits are returned. The engine sees the row
  // leave "running" and stops on its own.
  const editInput = (job as { kind?: string; input?: { edit?: { n?: number; credits?: number }; costOriginal?: number } }).input;
  const editN = (job as { kind?: string }).kind === "explainer" ? Number(editInput?.edit?.n) || 0 : 0;
  if (editN) {
    const { data: back } = await admin.from("media_jobs").update({
      status: "done", error: null, progress: { text: "Edit stopped — your video is unchanged." },
      input: { ...(editInput || {}), edit: null }, cost: Number(editInput?.costOriginal ?? job.cost) || 0, updated_at: new Date().toISOString(),
    }).eq("id", id).in("status", ["queued", "running"]).select(hasSpendColumn ? "id, spent_credits" : "id");
    if (!back?.length) return NextResponse.json({ error: "This edit has already finished." }, { status: 400 });
    const spentE = Number((back[0] as { spent_credits?: number | null }).spent_credits ?? 0) || 0;
    const owed = Math.max(0, (Number(editInput?.edit?.credits) || 0) - spentE);
    if (owed > 0) {
      const { error: refundErr } = await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: owed, p_reason: "explainer-edit-refund", p_ref: `${id}:edit:${editN}` });
      if (refundErr) console.error("[jobs] edit stop refund failed", id, owed, refundErr);
    }
    return NextResponse.json({ ok: true, refunded: owed, spent: spentE, edit: true });
  }

  // Status-guarded: only the request that actually flips the row refunds (double-tap / worker race → one refund).
  // The flip RETURNS the row, and those are the numbers we refund against. Reading spent_credits
  // from the SELECT above would refund against a value that is stale by exactly the window the
  // column exists to close: the worker's spend marker PATCHes spent_credits under the same
  // status=eq.running guard immediately before the fal/Veo/Kling/AI-image call, so a marker that
  // lands between our SELECT and our UPDATE would make us hand back the full price for clips we
  // have just bought.
  const { data: flipped } = await admin.from("media_jobs").update({
    status: "failed", error: "Cancelled by user", updated_at: new Date().toISOString(),
  }).eq("id", id).in("status", ["queued", "running"]).select(hasSpendColumn ? "id, cost, spent_credits" : "id, cost");
  if (!flipped?.length) return NextResponse.json({ error: "This job has already finished." }, { status: 400 });

  // Refund what we did not spend, not the whole price. The worker records spent_credits right
  // before it pays an outside service (Veo/Kling/fal clips, AI images), so a still-queued job
  // and a template ad get everything back, while a cancel after the paid clips were bought
  // returns only the unspent share — otherwise "queue, wait for the clips, cancel, repeat" is
  // unlimited outside spend at zero cost. Cancel stays open for a running job: a stuck render
  // must always have a way out.
  const row = flipped[0] as { cost?: number | null; spent_credits?: number | null };
  const spent = Number(row.spent_credits ?? job.spent_credits ?? 0) || 0;
  const back = Math.max(0, (Number(row.cost ?? job.cost) || 0) - spent);
  if (back > 0) {
    const { error: refundErr } = await admin.rpc("grant_credits", {
      p_user: session.user.id, p_amount: back, p_reason: "job-cancel-refund", p_ref: id,
    });
    if (refundErr) console.error("[jobs] cancel refund failed", id, session.user.id, back, refundErr);
  }

  return NextResponse.json({ ok: true, refunded: back, spent });
}

// POST { id } → put a failed video back in the queue, WITHOUT charging again.
// The worker keeps each long video's recordings and slides on disk, so a retry carries on from the paragraph it
// stopped on instead of starting the script over. The credits for this job were already returned when it failed,
// so they are taken again here — the owner pays once for one video, however many attempts it takes us.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Job id is required." }, { status: 400 });

  const { data: job } = await admin.from("media_jobs").select("id, owner_id, kind, status, cost, error").eq("id", id).single();
  if (!job || job.owner_id !== session.user.id) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (job.status !== "failed") return NextResponse.json({ error: "Only a failed video can be tried again." }, { status: 400 });
  // A video the owner stopped themselves is finished business; trying it again would charge them for a second one.
  if (/cancel/i.test(String(job.error ?? ""))) return NextResponse.json({ error: "You stopped this video. Please make a new one." }, { status: 400 });

  // One at a time, same as making a new one.
  const { count } = await admin.from("media_jobs").select("id", { count: "exact", head: true })
    .eq("owner_id", session.user.id).eq("kind", job.kind).in("status", ["queued", "running"]);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "A video is already being made — please wait for it to finish." }, { status: 429 });

  // A PAUSED video was never refunded — its credits are still on the job — so continuing it costs nothing.
  const paused = /^PAUSED/.test(String(job.error ?? ""));
  const cost = paused ? 0 : Number(job.cost) || 0;
  if (cost > 0) {
    const { error: spendErr } = await admin.rpc("spend_credits", { p_user: session.user.id, p_amount: cost, p_reason: `${job.kind}-retry`, p_ref: `${id}:retry:${Date.now()}` });
    if (spendErr) {
      const short = spendErr.message.includes("INSUFFICIENT_CREDITS");
      return NextResponse.json({ error: short ? `You need ${cost} credits to try this video again.` : "Could not charge credits.", cost }, { status: 402 });
    }
  }
  // Status-guarded so a double tap cannot queue it twice; attempts goes back to 0 so the worker's own retry is fresh.
  const { data: back } = await admin.from("media_jobs")
    .update({ status: "queued", error: null, attempts: 0, progress: { text: "Waiting to start…" }, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "failed").select("id");
  if (!back?.length) {
    if (cost > 0) await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: cost, p_reason: `${job.kind}-retry-refund`, p_ref: `${id}:retry` })
      .then(() => {}, (e) => console.error("[jobs] retry requeue refund failed", id, cost, e));
    return NextResponse.json({ error: "This video has already been tried again." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id, cost });
}
