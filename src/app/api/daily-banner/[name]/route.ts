// Serves the daily follow-up banners. They are generated on the server after
// the build, and Next's static file map does not pick up new public/ files,
// so they are streamed here instead. Read-only, name-whitelisted.
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "wellwa", "followups", "daily");

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^\d{4}-\d{2}-\d{2}(-[a-z0-9-]{1,40})?\.jpg$/i.test(name)) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(DIR, name));
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "Content-Length": String(buf.length) },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
