// POST multipart { file } → the owner's own voice-over, stored as-is in the media bucket.
// For people who record the narration themselves, or make it somewhere else (ElevenLabs and the like) and want our
// slides, photos and music around it. The file is never re-encoded here — the video engine does that once, with
// everything else — so nothing is lost twice.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { rateLimited } from "@/lib/api-security";

export const maxDuration = 60;
const MAX = 40 * 1024 * 1024;   // ~40 minutes of 128 kbps mp3; the video itself is capped at 10 minutes
// Only what phones record and what the voice sites hand back. The extension decides nothing — the type does.
const TYPES: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/opus": "opus",
};

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`upload-audio:${me.id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Please wait a few minutes and try again." }, { status: 429 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "That recording is too big (max 40 MB)." }, { status: 400 });
  const ext = TYPES[String(file.type).toLowerCase().split(";")[0]];
  if (!ext) return NextResponse.json({ error: "Please upload an audio file — mp3, m4a, wav or ogg." }, { status: 400 });

  const key = `poster/${me.id}/voice-${Date.now()}.${ext}`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, {
    method: "POST",
    headers: { ...serviceHeaders(), "Content-Type": file.type, "x-upsert": "true" },
    body: new Uint8Array(await file.arrayBuffer()),
  });
  if (!r.ok) return NextResponse.json({ error: "Upload failed.", detail: (await r.text()).slice(0, 200) }, { status: 500 });
  return NextResponse.json({ url: `${SUPA_URL}/storage/v1/object/public/media/${key}` });
}
