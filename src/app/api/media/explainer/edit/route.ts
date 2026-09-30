// The Scene Editor's API for a finished long video.
//
// GET  ?id=<job>  → the film as it was made (bridge/explainer-edit.mjs writes scenes-<fmt>.json with the work):
//                   every paragraph with its words and times, every scene with its picture, heading, camera move —
//                   plus every picture on file (for "use this one instead") and what the edit prices are.
// POST { id, edits } → validates the owner's changes, prices them (only AI work costs: a picture made to order,
//                   a paragraph spoken again), takes the credits, writes edits.json next to the work and puts the
//                   job back in the queue with input.edit = { n, credits }. The worker remakes only what changed;
//                   the finished video stays in place until the new cut is done.
import { NextResponse } from "next/server";
import { requireUser, sameOrigin, workerAlive, WORKER_DOWN } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";

const EDIT_PICTURE_CREDITS = 1;
const EDIT_VOICE_CREDITS = 1;
const MOVES = ["push", "pan-right", "pull", "push-left", "tilt-down", "push-right", "pan-left"];
const FRAMES = ["object", "hands", "screen", "place", "pair", "person"];
const PIC_FILE = /^(img-[a-z]+-\d+(-e\d+)?|own-\d+)\.jpg$/;
const S = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

type Para = { p: number; text: string; start: number; end: number };
type Shot = { i: number; unit: number; para: number; start: number; sec: number; text: string; heading: string; kind: string; picture: string | null; frame: string; subject: string; moment: string; move: string | null; tight: boolean; captions: boolean };
type Manifest = { v: number; n: number; fmt: string; W: number; H: number; total: number; title: string; voice: "own" | "ai" | "none"; lang?: string; voiceStyle?: string; captions?: boolean; paragraphs: Para[]; shots: Shot[] };
type Input = { title?: string; formats?: string[]; voiceUrl?: string; outputs?: Record<string, string>; edits?: number; edit?: { n: number; credits: number } | null; lastEditError?: string | null; costOriginal?: number; seconds?: number };

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const workPrefix = (owner: string, id: string) => `ai-media/${owner}/work/${id}`;

async function loadJob(admin: NonNullable<ReturnType<typeof getAdminSupabase>>, id: string, owner: string) {
  const { data } = await admin.from("media_jobs").select("id, owner_id, kind, status, output_url, cost, error, progress, input, created_at").eq("id", id).single();
  if (!data || data.owner_id !== owner || data.kind !== "explainer") return null;
  return data as { id: string; owner_id: string; kind: string; status: string; output_url: string | null; cost: number | null; error: string | null; progress: { text?: string } | null; input: Input | null; created_at: string };
}

async function loadManifest(admin: NonNullable<ReturnType<typeof getAdminSupabase>>, owner: string, id: string, fmt: string): Promise<Manifest | null> {
  const { data } = await admin.storage.from("media").download(`${workPrefix(owner, id)}/scenes-${fmt}.json`);
  if (!data) return null;
  try {
    const m = JSON.parse(await data.text()) as Manifest;
    return Array.isArray(m?.paragraphs) && Array.isArray(m?.shots) ? m : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Video id is required." }, { status: 400 });
  const job = await loadJob(admin, id, session.user.id);
  if (!job) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const inp = job.input ?? {};
  const fmt = inp.formats?.[0] ?? "wide";
  const [{ data: credits }, manifest, { data: files }] = await Promise.all([
    session.supabase.rpc("my_credits"),
    loadManifest(admin, session.user.id, id, fmt),
    admin.storage.from("media").list(workPrefix(session.user.id, id), { limit: 1000 }),
  ]);
  const base = `${SUPA_URL}/storage/v1/object/public/media/${workPrefix(session.user.id, id)}`;
  const pictures = (files ?? []).map((f) => f?.name ?? "").filter((n) => PIC_FILE.test(n)).sort().map((file) => ({ file, url: `${base}/${file}` }));
  return NextResponse.json({
    job: {
      id: job.id, status: job.status, output_url: job.output_url, error: job.error, progress: job.progress,
      title: manifest?.title ?? inp.title ?? "", fmt, voice: manifest?.voice ?? (inp.voiceUrl ? "own" : "ai"),
      seconds: manifest?.total ?? inp.seconds ?? 0, edits: Number(inp.edits) || 0, editing: !!inp.edit, lastEditError: inp.lastEditError ?? null,
      busy: job.status === "queued" || job.status === "running",
    },
    editable: !!manifest,
    manifest, pictures, base,
    credits: typeof credits === "number" ? credits : 0,
    prices: { picture: EDIT_PICTURE_CREDITS, voice: EDIT_VOICE_CREDITS },
  });
}

type SceneEdit = { heading?: string; move?: string; captions?: boolean; picture?: { mode: "regen"; frame: string; subject: string; moment: string } | { mode: "own"; url: string } | { mode: "pick"; from: string } | { mode: "card" } };
type ParaEdit = { text?: string; revoice?: boolean; voiceUrl?: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const b = await request.json().catch(() => ({})) as { id?: unknown; edits?: { title?: unknown; paragraphs?: Record<string, unknown>; scenes?: Record<string, unknown> } };
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Video id is required." }, { status: 400 });
  const job = await loadJob(admin, id, session.user.id);
  if (!job) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (job.status !== "done") return NextResponse.json({ error: job.status === "queued" || job.status === "running" ? "This video is still being made — edit it when it is done." : "Only a finished video can be edited." }, { status: 400 });
  const inp = job.input ?? {};
  const fmt = inp.formats?.[0] ?? "wide";
  const manifest = await loadManifest(admin, session.user.id, id, fmt);
  if (!manifest) return NextResponse.json({ error: "This video was made before editing existed, so its scenes are not on file. Please make it again to edit it." }, { status: 400 });
  const { data: files } = await admin.storage.from("media").list(workPrefix(session.user.id, id), { limit: 1000 });
  const onFile = new Set((files ?? []).map((f) => f?.name ?? "").filter((n) => PIC_FILE.test(n)));
  const own = (u: unknown) => { const v = S(u, 500); return /^https:\/\//.test(v) && v.includes(session.user.id) ? v : ""; };

  // Only what actually changed is kept; the worker sees a short, honest list.
  const src = b.edits ?? {};
  const edits: { n: number; at: string; title?: string; paragraphs: Record<string, ParaEdit>; scenes: Record<string, SceneEdit> } = { n: (Number(inp.edits) || 0) + 1, at: new Date().toISOString(), paragraphs: {}, scenes: {} };
  let pictures = 0, voices = 0, changes = 0;
  if (typeof src.title === "string" && S(src.title, 70) !== String(manifest.title ?? "")) { edits.title = S(src.title, 70); changes++; }
  for (const [k, raw] of Object.entries(src.paragraphs ?? {})) {
    const p = Number(k);
    const para = manifest.paragraphs[p];
    const e = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
    if (!para || !e) continue;
    const out: ParaEdit = {};
    if (typeof e.text === "string") {
      const t = S(e.text, 1500);
      if (t.length < 2) return NextResponse.json({ error: `Paragraph ${p + 1} cannot be empty.` }, { status: 400 });
      if (t !== para.text.replace(/\s+/g, " ").trim()) out.text = t;
    }
    const textChanged = out.text !== undefined;
    if (manifest.voice === "ai") {
      if (e.revoice === true || (textChanged && e.revoice !== false)) { out.revoice = true; voices++; }
      else if (textChanged) out.revoice = false;
    }
    if (manifest.voice === "own" && e.voiceUrl) {
      const u = own(e.voiceUrl);
      if (!u) return NextResponse.json({ error: `The new recording for paragraph ${p + 1} could not be used. Please upload it again.` }, { status: 400 });
      out.voiceUrl = u;
    }
    if (Object.keys(out).length) { edits.paragraphs[String(p)] = out; changes++; }
  }
  for (const [k, raw] of Object.entries(src.scenes ?? {})) {
    const i = Number(k);
    const shot = manifest.shots[i];
    const e = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
    if (!shot || !e) continue;
    const out: SceneEdit = {};
    if (typeof e.heading === "string" && S(e.heading, 60) !== String(shot.heading ?? "")) out.heading = S(e.heading, 60);
    if (typeof e.move === "string" && MOVES.includes(e.move) && e.move !== shot.move) out.move = e.move;
    if (e.captions === false && shot.captions) out.captions = false;
    const pic = e.picture && typeof e.picture === "object" ? e.picture as Record<string, unknown> : null;
    if (pic?.mode === "regen") {
      const subject = S(pic.subject, 240);
      if (subject.length < 3) return NextResponse.json({ error: `Scene ${i + 1}: describe the picture you want in a few words.` }, { status: 400 });
      out.picture = { mode: "regen", frame: FRAMES.includes(String(pic.frame)) ? String(pic.frame) : (shot.frame || "object"), subject, moment: S(pic.moment, 240) };
      pictures++;
    } else if (pic?.mode === "own") {
      const u = own(pic.url);
      if (!u) return NextResponse.json({ error: `Scene ${i + 1}: the uploaded picture could not be used. Please upload it again.` }, { status: 400 });
      out.picture = { mode: "own", url: u };
    } else if (pic?.mode === "pick") {
      const from = S(pic.from, 80);
      if (!PIC_FILE.test(from) || !onFile.has(from)) return NextResponse.json({ error: `Scene ${i + 1}: that picture is not on file any more.` }, { status: 400 });
      if (from !== shot.picture) out.picture = { mode: "pick", from };
    } else if (pic?.mode === "card") {
      if (shot.kind !== "card") out.picture = { mode: "card" };
    }
    if (Object.keys(out).length) { edits.scenes[String(i)] = out; changes++; }
  }
  if (!changes) return NextResponse.json({ error: "Nothing has changed yet." }, { status: 400 });
  const credits = pictures * EDIT_PICTURE_CREDITS + voices * EDIT_VOICE_CREDITS;

  // One long video at a time, and somebody there to make it.
  const { count } = await admin.from("media_jobs").select("id", { count: "exact", head: true })
    .eq("owner_id", session.user.id).eq("kind", "explainer").in("status", ["queued", "running"]);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "A video is already being made — please wait for it to finish." }, { status: 429 });
  if (!(await workerAlive(admin))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });

  const ref = `${id}:edit:${edits.n}`;
  if (credits > 0) {
    const { error: spendErr } = await admin.rpc("spend_credits", { p_user: session.user.id, p_amount: credits, p_reason: "explainer-edit", p_ref: ref });
    if (spendErr) {
      const short = spendErr.message.includes("INSUFFICIENT_CREDITS");
      return NextResponse.json({ error: short ? `You need ${credits} credits for these changes (${pictures} new picture${pictures === 1 ? "" : "s"}${voices ? `, ${voices} paragraph${voices === 1 ? "" : "s"} spoken again` : ""}).` : "Could not charge credits.", cost: credits }, { status: 402 });
    }
  }
  const refundEdit = () => credits > 0 && admin.rpc("grant_credits", { p_user: session.user.id, p_amount: credits, p_reason: "explainer-edit-refund", p_ref: ref }).then(() => {}, (e) => console.error("[explainer-edit] refund failed", id, credits, e));

  // The list of changes goes next to the work; the worker reads it fresh at the start of the run.
  const { error: upErr } = await admin.storage.from("media").upload(`${workPrefix(session.user.id, id)}/edits.json`, new Blob([JSON.stringify(edits)], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (upErr) { await refundEdit(); return NextResponse.json({ error: "Could not save the changes. Please try again." }, { status: 500 }); }

  // Back in the queue under the same id. During the edit the row's cost is the edit's credits — that is what a
  // stop or a failure hands back — and the video's own cost waits in costOriginal.
  const { data: back } = await admin.from("media_jobs").update({
    status: "queued", error: null, attempts: 0, progress: { text: "Waiting to apply your edits…" }, cost: credits,
    input: { ...inp, edit: { n: edits.n, credits, at: edits.at }, costOriginal: inp.costOriginal ?? job.cost ?? 0, lastEditError: null },
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "done").select("id");
  if (!back?.length) { await refundEdit(); return NextResponse.json({ error: "This video is busy right now. Please try again in a moment." }, { status: 409 }); }
  return NextResponse.json({ ok: true, id, n: edits.n, credits, changes, pictures, voices });
}
