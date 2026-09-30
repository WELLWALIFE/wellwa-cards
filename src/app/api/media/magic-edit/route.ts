// Studio: turn a plain-language edit request ("dusre scene me chai ki jagah
// coffee dikhao") into the {sceneIndex: description} map the existing remix
// flow (POST /api/media/reel with remixOf) already understands. This route
// only PARSES the request — it doesn't spend credits or touch the job; the
// caller reviews the parsed changes and submits them via the normal remix UI.

import { NextResponse } from "next/server";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { geminiComplete } from "@/lib/gemini";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `magic-edit:${session.user.id}`), 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  }
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const jobId = String(b.jobId ?? "");
  const editRequest = String(b.request ?? "").trim().slice(0, 300);
  if (!jobId || editRequest.length < 3) {
    return NextResponse.json({ error: "Write what you want to change." }, { status: 400 });
  }

  const { data: job } = await admin.from("media_jobs")
    .select("owner_id, kind, status, input")
    .eq("id", jobId).single();
  const scenes: { i: number; line: string }[] = job?.input?.scenes ?? [];
  if (!job || job.owner_id !== session.user.id || job.kind !== "reel" || job.status !== "done" || !scenes.length) {
    return NextResponse.json({ error: "This reel cannot be edited." }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });

  const sceneList = scenes.map((s) => `${s.i}: "${s.line}"`).join("\n");
  const prompt = `A short vertical reel has these scenes (index: spoken line):\n${sceneList}\n\nThe owner typed this edit request: "${editRequest}"\n\nDecide which scene index/indices this refers to, and what the new visual should show for each. Match by meaning, not just exact words. If the request doesn't clearly match any scene, return an empty object rather than guessing.\n\nRespond with ONLY valid JSON, no markdown fence, no text before or after: {"changes":{"<index>":"<short visual description in English, max 15 words>"}}`;

  try {
    const { text } = await geminiComplete({
      apiKey: key,
      maxOutputTokens: 300,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON in response: " + text.slice(0, 200));
    const parsed = JSON.parse(text.slice(start, end + 1)) as { changes?: Record<string, string> };
    const validIndexes = new Set(scenes.map((s) => s.i));
    const changes: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.changes ?? {})) {
      if (/^\d+$/.test(k) && validIndexes.has(Number(k))) changes[k] = String(v ?? "").trim().slice(0, 200);
    }
    if (!Object.keys(changes).length) {
      return NextResponse.json({ error: "Could not tell which scene to change — mention the scene number or add a little detail." }, { status: 422 });
    }
    return NextResponse.json({ changes });
  } catch (e) {
    console.error("[media/magic-edit] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not understand that — please try again." }, { status: 502 });
  }
}
