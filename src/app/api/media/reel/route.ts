// Studio: queue a reel job. The heavy work happens in the media worker
// (bridge/media-worker.mjs on the VPS) — this route only validates, prices,
// debits and enqueues.

import { NextResponse } from "next/server";
import { requireUser, sameOrigin, workerAlive, WORKER_DOWN } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { CREDIT_PRICES, type ReelTier } from "@/lib/media/banner";
import { VOICE_KEYS } from "@/lib/media/voices";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const b = await request.json().catch(() => ({}));

  // Remix: replace chosen scenes of an existing reel, reuse everything else.
  if (b.remixOf) {
    const { data: orig } = await admin.from("media_jobs")
      .select("owner_id, kind, status, input")
      .eq("id", String(b.remixOf)).single();
    const scenes: { i: number; url: string }[] = orig?.input?.scenes ?? [];
    if (!orig || orig.owner_id !== session.user.id || orig.kind !== "reel" || orig.status !== "done" || !scenes.length) {
      return NextResponse.json({ error: "This reel cannot be edited." }, { status: 400 });
    }
    const changes: Record<string, string> = {};
    if (b.changes && typeof b.changes === "object") {
      for (const [k, v] of Object.entries(b.changes as Record<string, unknown>)) {
        if (/^\d+$/.test(k)) changes[k] = String(v ?? "").slice(0, 200);
      }
    }
    if (!Object.keys(changes).length) {
      return NextResponse.json({ error: "Choose at least one scene." }, { status: 400 });
    }
    const { count: act } = await admin.from("media_jobs")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", session.user.id).eq("kind", "reel").in("status", ["queued", "running"]);
    if ((act ?? 0) > 0) return NextResponse.json({ error: "A reel is already being made." }, { status: 429 });

    // Video tiers re-render a real generated clip, so their edit costs more
    // than swapping a still.
    const origTier = String(orig.input?.tier ?? "");
    const remixCost = origTier === "veo" ? CREDIT_PRICES.reel_remix_veo
      : origTier === "kling" ? CREDIT_PRICES.reel_remix_kling
      : CREDIT_PRICES.reel_remix;
    // Nobody to render it = nobody to charge for it.
    if (!(await workerAlive(admin))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });

    // The job id exists before the charge so the spend, the job and any refund share one ref.
    const remixId = crypto.randomUUID();
    const { error: remixSpendErr } = await admin.rpc("spend_credits", {
      p_user: session.user.id, p_amount: remixCost, p_reason: "reel-remix", p_ref: remixId,
    });
    if (remixSpendErr) {
      return NextResponse.json({ error: remixSpendErr.message.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${remixCost} needed).` : "Could not charge credits.", cost: remixCost }, { status: 402 });
    }
    const input = { ...orig.input, reuseScenes: scenes.map((sc) => ({ i: sc.i, url: sc.url })), changes };
    delete (input as { scenes?: unknown }).scenes;
    const { data: rj, error: rerr } = await admin.from("media_jobs")
      .insert({ id: remixId, owner_id: session.user.id, kind: "reel", status: "queued", input, cost: remixCost })
      .select("id").single();
    if (rerr) {
      await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: remixCost, p_reason: "reel-remix-refund", p_ref: remixId }).then(() => {}, (e) => console.error("[reel] remix refund failed", session.user.id, remixCost, e));
      return NextResponse.json({ error: "Could not queue the job." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, jobId: rj.id, cost: remixCost });
  }

  const script = String(b.script ?? "").trim().slice(0, 600);
  if (script.length < 10) return NextResponse.json({ error: "Script likhein (10+ letters)." }, { status: 400 });

  const tier: ReelTier = ["basic", "photos", "stock", "avatar", "kling", "veo"].includes(b.tier) ? b.tier : "photos";
  if (tier === "kling" && !process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: "Kling is not configured yet." }, { status: 400 });
  }
  if (tier === "stock" && !process.env.PEXELS_API_KEY) {
    return NextResponse.json({ error: "The stock tier is not configured yet." }, { status: 400 });
  }
  if (tier === "avatar" && !process.env.FAL_KEY) {
    return NextResponse.json({ error: "The avatar option is coming soon — use AI Photos or Stock for now." }, { status: 400 });
  }
  if ((tier === "veo" || tier === "photos") && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "This tier is not configured yet." }, { status: 400 });
  }
  const cost = tier === "veo" ? CREDIT_PRICES.reel_veo
    : tier === "kling" ? CREDIT_PRICES.reel_kling
    : tier === "photos" ? CREDIT_PRICES.reel_photos
    : tier === "stock" ? CREDIT_PRICES.reel_stock
    : tier === "avatar" ? CREDIT_PRICES.reel_avatar
    : CREDIT_PRICES.reel_basic;

  // One reel at a time per user — a queue pile-up burns money fast.
  const { count } = await admin.from("media_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", session.user.id).eq("kind", "reel").in("status", ["queued", "running"]);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "A reel is already being made — please wait for it to finish." }, { status: 429 });

  // Charge only when the render can actually happen — a dead worker used to take the money
  // and leave the reel queued forever.
  if (!(await workerAlive(admin))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });

  // The job id exists before the charge, so the spend row carries the same ref the worker's
  // refund uses (bridge/media-worker.mjs refunds with p_ref: job.id). With p_ref null the two
  // ledger rows could not be matched to each other or to the job.
  const id = crypto.randomUUID();
  const { error: spendErr } = await admin.rpc("spend_credits", {
    p_user: session.user.id, p_amount: cost, p_reason: `reel-${tier}`, p_ref: id,
  });
  if (spendErr) {
    const msg = spendErr.message.includes("INSUFFICIENT_CREDITS")
      ? `Not enough credits (${cost} needed). Renew your plan or buy a credit pack.`
      : "Could not charge credits.";
    return NextResponse.json({ error: msg, cost }, { status: 402 });
  }

  // The worker must never fall back to our own SaaS name on a customer's paid
  // video — if they left the field blank, use their own card's business name.
  let brandName = String(b.brandName ?? "").trim().slice(0, 40);
  if (!brandName) {
    const { data: ownCard } = await admin.from("cards")
      .select("data").eq("owner_id", session.user.id)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const d = ownCard?.data as { company?: string; name?: string } | undefined;
    brandName = String(d?.company || d?.name || "").trim().slice(0, 40);
  }

  const input = {
    script, tier,
    voiceStyle: VOICE_KEYS.includes(b.voiceStyle) ? b.voiceStyle : "warm",
    voice: b.voice !== false,                       // Hindi voiceover by default
    headline: String(b.headline ?? "").trim().slice(0, 60),
    brandName,
    website: String(b.website ?? "").trim().slice(0, 60),
    photoUrl: String(b.photoUrl ?? "").trim().slice(0, 300),
    // Owner's own face / real product shots — Gemini keeps the same subject
    // across every generated scene. The worker only trusts our own storage.
    refImages: (Array.isArray(b.refImages) ? b.refImages : [])
      .map((u: unknown) => String(u ?? "").trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 4),
    // Free-text direction from the owner — folded into every scene prompt.
    guidance: String(b.guidance ?? "").trim().slice(0, 400),
    // Shot list the owner reviewed and approved in the planner. When present the
    // worker renders exactly these instead of inventing its own prompts.
    scenePlan: (Array.isArray(b.scenePlan) ? b.scenePlan : [])
      .map((s: { beat?: unknown; visual?: unknown }) => ({
        beat: String(s?.beat ?? "").slice(0, 300),
        visual: String(s?.visual ?? "").slice(0, 600),
      }))
      .filter((s: { visual: string }) => s.visual)
      .slice(0, 5),
  };
  const { data, error } = await admin.from("media_jobs")
    .insert({ id, owner_id: session.user.id, kind: "reel", status: "queued", input, cost })
    .select("id").single();
  if (error) {
    await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: cost, p_reason: `reel-${tier}-refund`, p_ref: id }).then(() => {}, (e) => console.error("[reel] queue-insert refund failed", session.user.id, cost, e));
    return NextResponse.json({ error: "Could not queue the job." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, jobId: data.id, cost });
}
