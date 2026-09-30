// Long explainer video: the owner's own text → a 2 to 10 minute video (slides + their photos + AI voice + music).
// This route only validates, prices, checks somebody can actually render it, debits and queues; bridge/explainer-
// engine.mjs does the work. The length of the text is the length of the video, so the price follows the text.
import { NextResponse } from "next/server";
import { requireUser, sameOrigin, workerAlive, WORKER_DOWN } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { EXPLAINER_MAX_MIN, EXPLAINER_CREDITS_PER_MIN, explainerCredits, explainerMinutes } from "@/lib/media/ad-pricing";
import { VOICE_KEYS } from "@/lib/media/voices";

const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const MAX_CHARS = 9000;
const FORMATS = ["reel", "wide", "square"] as const;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const script = S(b.script, MAX_CHARS);
  const ownUrl = (u: unknown) => {
    const v = S(u, 500);
    return /^https:\/\//.test(v) && v.includes(session.user.id) ? v : "";
  };
  const voiceUrl = ownUrl(b.voiceUrl);
  // With a recording, the text is optional: the worker transcribes the recording and cuts the film from that.
  // The recording's length is then the video's length, and the price follows it (the client measures it).
  const audioSeconds = voiceUrl && Number.isFinite(Number(b.audioSeconds)) ? Math.max(0, Number(b.audioSeconds)) : 0;
  if (!voiceUrl && script.length < 120) return NextResponse.json({ error: "Write at least a few lines — about 150 words make a one-minute video — or upload a recording." }, { status: 400 });
  if (voiceUrl && !script && audioSeconds < 5) return NextResponse.json({ error: "That recording could not be read. Please upload it again." }, { status: 400 });
  if (audioSeconds > EXPLAINER_MAX_MIN * 60 + 30) return NextResponse.json({ error: `That recording is longer than ${EXPLAINER_MAX_MIN} minutes. Please shorten it, or make two videos.` }, { status: 400 });
  const textMinutes = script ? explainerMinutes(script) : 0;
  if (!voiceUrl && textMinutes >= EXPLAINER_MAX_MIN && script.split(/\s+/).length > EXPLAINER_MAX_MIN * 170) {
    return NextResponse.json({ error: `That text is longer than ${EXPLAINER_MAX_MIN} minutes. Please shorten it, or make two videos.` }, { status: 400 });
  }
  const minutes = audioSeconds ? Math.min(EXPLAINER_MAX_MIN, Math.max(0.5, audioSeconds / 60)) : textMinutes;
  const cost = audioSeconds ? Math.max(20, Math.ceil(minutes) * EXPLAINER_CREDITS_PER_MIN) : explainerCredits(script);

  // One long video at a time: they take minutes of CPU and the worker has a single render slot.
  const { count } = await admin.from("media_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", session.user.id).eq("kind", "explainer").in("status", ["queued", "running"]);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "A video is already being made — please wait for it to finish." }, { status: 429 });

  // Nobody to render it = nobody to charge for it.
  if (!(await workerAlive(admin))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });

  const own = ownUrl;
  const input = {
    script,
    title: S(b.title, 70),
    lang: ["en", "hi", "hinglish"].includes(b.lang) ? b.lang : "hinglish",
    voice: b.voice !== false,
    voiceStyle: VOICE_KEYS.includes(S(b.voiceStyle, 20)) ? S(b.voiceStyle, 20) : "warm",
    music: S(b.music, 40),
    // What the viewer sees. "images" = a picture made for each paragraph, changing with the topic (the default —
    // it matches what is being said far more closely than anything filmed). "footage" = real stock clips mixed with
    // pictures and the owner's photos. "slides" = the words on branded cards, nothing else.
    style: ["slides", "footage", "images"].includes(String(b.style)) ? String(b.style) : "images",
    // Subtitles, cut word by word from the voice. On unless the owner switches them off.
    captions: b.captions !== false,
    // Silence between paragraphs, in seconds. We place each paragraph on the timeline ourselves, so this is exact
    // (the voice engine's own pause markup is not — it ignores the length asked for).
    pause: Number.isFinite(Number(b.pause)) ? Math.min(3, Math.max(0.15, Number(b.pause))) : 1.5,
    // One shape per video: the shots are built once, and the pictures are generated in that shape.
    formats: (Array.isArray(b.formats) ? b.formats : ["wide"]).filter((f: unknown) => (FORMATS as readonly string[]).includes(String(f))).slice(0, 1),
    photos: (Array.isArray(b.photos) ? b.photos : []).map(own).filter(Boolean).slice(0, 12),
    // A voice-over the owner brought (recorded themselves, or made elsewhere). Their own upload only.
    voiceUrl,
    audioSeconds: audioSeconds || undefined,
    logoUrl: own(b.logoUrl),
    accent: /^#[0-9a-f]{6}$/i.test(S(b.accent, 7)) ? S(b.accent, 7) : "",
    brandName: S(b.brandName, 60),
    phone: S(b.phone, 20),
    website: S(b.website, 60),
  };
  if (!input.formats.length) input.formats = ["wide"];

  // The job id exists before the charge, so the spend, the job and any refund share one reference.
  const id = crypto.randomUUID();
  const { error: spendErr } = await admin.rpc("spend_credits", { p_user: session.user.id, p_amount: cost, p_reason: "explainer", p_ref: id });
  if (spendErr) {
    const short = spendErr.message.includes("INSUFFICIENT_CREDITS");
    return NextResponse.json({ error: short ? `Not enough credits (${cost} needed for about ${Math.ceil(minutes)} minutes).` : "Could not charge credits.", cost }, { status: 402 });
  }

  const { error } = await admin.from("media_jobs")
    .insert({ id, owner_id: session.user.id, kind: "explainer", status: "queued", input, cost })
    .select("id").single();
  if (error) {
    await admin.rpc("grant_credits", { p_user: session.user.id, p_amount: cost, p_reason: "explainer-refund", p_ref: id })
      .then(() => {}, (e) => console.error("[explainer] queue-insert refund failed", session.user.id, cost, e));
    const missingKind = /kind_check/i.test(error.message);
    return NextResponse.json({ error: missingKind ? "Long videos are not switched on yet (migration 0054)." : "Could not queue the video." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, cost, minutes: Math.round(minutes * 10) / 10 });
}
