// Ad Builder: validate, charge 20 credits, enqueue an "ad" job for the media worker.
import { NextResponse } from "next/server";
import { requireUser, sameOrigin, workerAlive, WORKER_DOWN } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adCredits, AD_LENGTHS, REALISTIC_MAX_LENGTH } from "@/lib/media/ad-pricing";
import { VOICE_KEYS } from "@/lib/media/voices";
import { scriptFromPlan, identityPhotos } from "@/lib/media/ad-v2";
import { sanitizeShot } from "@/lib/media/ad-planner";
import { runGates } from "@/lib/media/ad-rules";
import { blockingFields, type ProductFacts, type ProductPhoto } from "@/lib/media/product-facts";

const AD_LANGS = ["hi", "hinglish", "en", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or"];
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const b = await request.json().catch(() => ({}));

  const product = S(b.product, 60), offer = S(b.offer, 80), phone = S(b.phone, 20);
  // One tap = one charge. The phone sends the same idem string on a retry (bad network, double tap,
  // a back-then-forward through the wizard); if we already made that job in the last 5 minutes we
  // hand back the same job instead of charging a second time.
  const idem = S(b.idem, 40);
  const okUrl = (u: unknown) => typeof u === "string" && /^https:\/\//.test(u) && u.length < 400;
  const tier = ["realistic", "presenter", "testimonial"].includes(b.tier) ? b.tier : "template";
  if ((tier === "realistic" || tier === "presenter") && !process.env.FAL_KEY) return NextResponse.json({ error: "This video type is not set up yet (fal.ai key missing)." }, { status: 503 });
  const testimonial = tier === "testimonial" && b.testimonial && typeof b.testimonial === "object"
    ? { text: S((b.testimonial as Record<string, unknown>).text, 320), customer_name: S((b.testimonial as Record<string, unknown>).customer_name, 60), city: S((b.testimonial as Record<string, unknown>).city, 40), rating: Math.max(1, Math.min(5, Number((b.testimonial as Record<string, unknown>).rating) || 5)) }
    : null;
  if (tier === "testimonial" && !testimonial?.text) return NextResponse.json({ error: "Testimonial text is required." }, { status: 400 });
  if (tier === "presenter" && !okUrl(b.presenterPhoto)) return NextResponse.json({ error: "A presenter photo is required." }, { status: 400 });
  if (tier !== "testimonial" && !product) return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  const input = {
    tier,
    product, offer, phone,
    testimonial: testimonial ?? undefined,
    presenterPhoto: tier === "presenter" && okUrl(b.presenterPhoto) ? b.presenterPhoto : undefined,
    headline: S(b.headline, 60),
    features: (Array.isArray(b.features) ? b.features : []).map((f: unknown) => S(f, 60)).filter(Boolean).slice(0, 4),
    lang: AD_LANGS.includes(String(b.lang)) ? String(b.lang) : "hinglish",
    cta: S(b.cta, 200), category: S(b.category, 40), goal: S(b.goal, 30), audience: S(b.audience, 160), tone: S(b.tone, 30), notes: S(b.notes, 400),
    template: ["bold", "clean", "festive", "offer", "trust", "fresh"].includes(b.template) ? b.template : "bold",
    music: /^[a-z0-9-]{0,40}$/i.test(String(b.music ?? "")) ? String(b.music ?? "") : "",
    formats: (Array.isArray(b.formats) ? b.formats : ["reel"]).filter((f: unknown) => ["reel", "square", "wide"].includes(String(f))).slice(0, 3),
    photos: (Array.isArray(b.photos) ? b.photos : []).filter(okUrl).slice(0, 5),
    length: (AD_LENGTHS as readonly number[]).includes(Number(b.length)) ? Number(b.length) : 10,
    logoUrl: okUrl(b.logoUrl) ? b.logoUrl : "",
    brandName: S(b.brandName, 40),
    website: S(b.website, 60),
    voice: b.voice !== false,
    voiceStyle: VOICE_KEYS.includes(b.voiceStyle) ? b.voiceStyle : "warm",
    script: Array.isArray(b.script) ? b.script.map((l: unknown) => S(l, 200)).filter(Boolean).slice(0, 7) : undefined,
    scenes: Array.isArray(b.scenes) ? b.scenes.slice(0, 6).map((sc: Record<string, unknown>) => ({ text: S(sc?.text, 200), caption_text: S(sc?.caption_text, 80), visual: S(sc?.visual, 600), motion: S(sc?.motion, 300) })).filter((sc: { text: string }) => sc.text) : undefined,
    caption: S(b.caption, 600),
    captions: b.captions === "off" ? "off" : "words",
    variants: Number(b.variants) === 3 && (b.tier === "template" || b.tier === "realistic") ? 3 : 1,
  };
  // Never sell what we do not render: the realistic pipeline always makes exactly one video
  // (options.videos is hard-coded to 1 below and the approve route charges 1x), so it must
  // never be priced at the 3-variation rate. With variants forced to 1 every price agrees.
  if (input.tier === "realistic") input.variants = 1;
  if (!input.formats.length) input.formats = ["reel"];
  // All tiers may request several ratios: realistic/presenter generate once and are reframed (no extra AI cost).
  // Realistic clips are billed per 5s by fal — longer than 30s loses money (see ad-pricing.ts).
  if (input.tier === "realistic" && input.length > REALISTIC_MAX_LENGTH) input.length = REALISTIC_MAX_LENGTH;

  // ---- Pipeline 2: realistic ads go storyboard-first. Nothing is charged here; credits are spent at "Animate". ----
  const UUID = /^[0-9a-f-]{36}$/i;
  if (input.tier === "realistic" && process.env.AD_PIPELINE_V2 === "1" && typeof b.product_id === "string" && UUID.test(b.product_id)) {
    const uid = session.user.id;
    const { data: prod } = await admin.from("poster_products").select("id, name, photos, facts, facts_version, facts_confirmed_at").eq("id", b.product_id).eq("user_id", uid).single();
    if (!prod) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const facts = prod.facts as ProductFacts; const refs = identityPhotos((prod.photos ?? []) as ProductPhoto[]);
    if (facts?.v !== 1 || !prod.facts_confirmed_at || blockingFields(facts).length) return NextResponse.json({ error: "Confirm the Product check first.", need: "product_check" }, { status: 409 });
    if (facts.size_class === "service") return NextResponse.json({ error: "Realistic scenes for services are coming soon. Template and Presenter work today." }, { status: 409 });
    if (refs.length < 2) return NextResponse.json({ error: "Add at least 2 product photos (front and one more angle).", need: "photos" }, { status: 409 });
    if (!input.scenes?.length) return NextResponse.json({ error: "Write the script first." }, { status: 400 });
    if (!(await workerAlive(admin, true))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });
    const { count: active } = await admin.from("media_jobs").select("id", { count: "exact", head: true }).eq("owner_id", uid).in("status", ["queued", "running"]);
    if ((active ?? 0) > 0) return NextResponse.json({ error: "A video is already being made — please wait for it to finish." }, { status: 429 });
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { count: today } = await admin.from("media_jobs").select("id", { count: "exact", head: true }).eq("owner_id", uid).eq("pipeline", 2).gte("created_at", dayStart.toISOString());
    if ((today ?? 0) >= 6) return NextResponse.json({ error: "You have made 6 free storyboards today. Finish one of them, or come back tomorrow." }, { status: 429 });
    const animate_cost = Math.ceil(adCredits(input.length) * (input.variants === 3 ? 1.5 : 1));
    const { data: bal } = await session.supabase.rpc("my_credits");
    if ((Number(bal) || 0) < animate_cost) return NextResponse.json({ error: `The storyboard is free, but you need ${animate_cost} credits to animate it. Add credits first.`, cost: animate_cost }, { status: 402 });
    // Preferred: the planner's own script (structured shots). The owner's edited lines/captions are merged in; shots are re-clamped server-side.
    const sv = b.script_v2 && typeof b.script_v2 === "object" && Array.isArray(b.script_v2.scenes) && b.script_v2.scenes.length === input.scenes.length ? (b.script_v2 as { scenes: { role?: string; shot?: unknown }[]; promise?: string; why?: string; angle?: string; first_visual?: string }) : null;
    const mapped = scriptFromPlan(input.scenes, input.cta || (input.script?.[input.script.length - 1] ?? ""), facts, { headline: input.headline, features: input.features, post_caption: input.caption });
    const script = sv ? { ...mapped, angle: S(sv.angle, 30), first_visual: S(sv.first_visual, 30), promise: S(sv.promise, 120), why: S(sv.why, 220), scenes: mapped.scenes.map((m, i) => ({ ...m, shot: sanitizeShot(sv.scenes[i]?.shot, m.role, facts, true) ?? m.shot })) } : mapped;
    const brief = { tier: "realistic", length: input.length, lang: input.lang, goal: input.goal, audience: input.audience, tone: input.tone, offer: input.offer, phone: input.phone, brandName: input.brandName, website: input.website, logoUrl: input.logoUrl, notes: input.notes, category: input.category };
    const gates = runGates(script, { tier: "realistic", length: input.length, lang: input.lang, facts, brief: { offer: input.offer, phone: input.phone, brand: input.brandName }, speak_number: /\d{7,}/.test(script.cta.text.replace(/[\s-]/g, "")) });
    const hard = gates.errors.filter((e) => (sv ? !["G3", "G9"].includes(e.gate) : ["G5", "G6", "G7"].includes(e.gate))); // planner scripts: everything but caption style / brand position blocks
    if (hard.length) return NextResponse.json({ error: hard[0].msg, gate_errors: hard }, { status: 400 });
    const id = crypto.randomUUID();
    const v2 = { v: 2, product_id: prod.id, facts_version: prod.facts_version, facts, refs, brief, script, variant_hooks: [], options: { voiceStyle: input.voiceStyle, voice: input.voice, music: input.music, template: input.template, formats: input.formats, captions: input.captions, videos: 1, speak_number: false }, scorecard: { verdict: "ready", reason: "", stale: false }, product: prod.name, tier: "realistic", formats: input.formats };
    const { error: insErr } = await admin.from("media_jobs").insert({ id, owner_id: uid, kind: "ad", status: "queued", pipeline: 2, phase: "storyboard", stage: "queued", cost: 0, input: v2 });
    // Never show a shopkeeper a Postgres string. The engine's words go to the log.
    if (insErr) { console.error("[ad] storyboard insert failed", id, insErr); return NextResponse.json({ error: "The storyboard could not be started. Nothing was charged — please try again." }, { status: 500 }); }
    await admin.from("media_job_scenes").insert(script.scenes.map((_, i) => ({ job_id: id, i })));
    return NextResponse.json({ ok: true, jobId: id, pipeline: 2, animate_cost, cost: 0 });
  }

  // A realistic ad with no picture plan cannot be rendered at all: the engine now refuses to
  // invent footage for a scene that has no `visual` of its own (bridge/realistic-engine.mjs:93
  // — it used to show the same water-ionizer stock to every business). The planner branch of
  // /api/media/ad-plan deliberately returns empty visuals because those briefs belong to the
  // storyboard pipeline, which is off unless AD_PIPELINE_V2 is set. Say so here, for free,
  // instead of charging, queueing, failing twenty minutes later and refunding.
  if (input.tier === "realistic" && !(input.scenes?.length && input.scenes.every((sc: { visual: string }) => sc.visual))) {
    return NextResponse.json({ error: "We could not plan the pictures for this video. Please choose the Template video for now." }, { status: 400 });
  }

  // Retry of a request we already paid for? Answer with that job — before the "one at a time"
  // guard, so a double tap gets its own video back instead of "A video is already being made".
  // This read is only the fast path; it cannot stop two overlapping requests on its own (both
  // would find nothing), so the insert below settles the race for real — see `duplicate` there.
  const priorJob = async () => {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: prev } = await admin.from("media_jobs")
      .select("id, cost").eq("owner_id", session.user.id).eq("input->>idem", idem).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    return prev ?? null;
  };
  if (idem) {
    const prev = await priorJob();
    if (prev) return NextResponse.json({ ok: true, jobId: prev.id, cost: prev.cost ?? 0, duplicate: true });
  }

  // Charge only when the render can actually happen: a dead worker used to take the money and
  // leave the job queued forever. This sits above both the count and the spend below.
  if (!(await workerAlive(admin))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });

  const { count } = await admin.from("media_jobs").select("id", { count: "exact", head: true }).eq("owner_id", session.user.id).in("status", ["queued", "running"]);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "A video is already being made — please wait for it to finish." }, { status: 429 });

  const cost = Math.ceil(adCredits(input.length) * (input.variants === 3 ? 1.5 : 1)); // 3 variations = +50%
  // The job id exists before the charge so every ledger row carries it (idempotent refunds, per-job accounting).
  const id = crypto.randomUUID();
  const { error: spendErr } = await admin.rpc("spend_credits", { p_user: session.user.id, p_amount: cost, p_reason: "ad-builder", p_ref: id });
  // `cost` travels with the 402 so the phone can show the right credit pack instead of a dead end.
  if (spendErr) return NextResponse.json({ error: spendErr.message.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${cost} needed).` : "Could not charge credits.", cost }, { status: 402 });
  const { data: job, error } = await admin.from("media_jobs").insert({ id, owner_id: session.user.id, kind: "ad", status: "queued", input: idem ? { ...input, idem } : input, cost }).select("id").single();
  if (error || !job) {
    await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: cost, p_reason: "ad-refund", p_ref: id });
    // A unique violation here is the duplicate the idem guard is for: migration 0053 makes the
    // database the arbiter, so the request that loses the race is refunded (just above) and
    // handed the winner's job instead of a second paid render.
    if (idem && error?.code === "23505") {
      const prev = await priorJob();
      if (prev) return NextResponse.json({ ok: true, jobId: prev.id, cost: prev.cost ?? 0, duplicate: true });
    }
    console.error("[ad] queue insert failed", id, error);
    return NextResponse.json({ error: "The video could not be started. Your credits have been returned." }, { status: 500 });
  }
  // Belt and braces for a database that does not have migration 0053 yet: look again now that
  // our row exists. Two overlapping requests both see both rows and agree on the same winner
  // (oldest, ties broken by id), so exactly one of them refunds itself and steps aside.
  if (idem) {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: rows } = await admin.from("media_jobs")
      .select("id, cost").eq("owner_id", session.user.id).eq("input->>idem", idem).gte("created_at", since)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(2);
    const winner = rows?.[0];
    if (winner && winner.id !== id) {
      const { data: gone } = await admin.from("media_jobs").delete().eq("id", id).eq("status", "queued").select("id");
      if (gone?.length) {
        await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: cost, p_reason: "ad-refund", p_ref: id });
        return NextResponse.json({ ok: true, jobId: winner.id, cost: winner.cost ?? 0, duplicate: true });
      }
      // The worker claimed our row in that split second. Answer with OUR job — the owner must
      // be able to watch (and stop) the render they are paying for.
      console.error("[ad] duplicate idem, but our job had already started", id, "winner", winner.id);
    }
  }
  return NextResponse.json({ ok: true, jobId: job.id, cost });
}
