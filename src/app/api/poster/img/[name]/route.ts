// Streams a rendered poster or status video (files are created after the build, so Next's static map never
// sees them). Names are <profile-uuid>-<date>-<suffixes>.jpg|mp4 — the uuid keeps them unguessable, so the
// suffix part is only checked for safe characters (the strict per-suffix pattern used to 404 the clip
// videos, "…-w-c.mp4", 23 Sep 2026). Videos honour Range requests: Safari and Chrome seek with them and
// Safari refuses to play a video whose server ignores them.
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "poster", "out");
const NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,16}){0,10}\.(jpg|mp4)$/i;

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME.test(name) || name.includes("..")) return new NextResponse("Not found", { status: 404 });
  const file = path.join(DIR, name);
  let stat: { size: number };
  try { stat = await fs.stat(file); } catch { return new NextResponse("Not found", { status: 404 }); }
  const mp4 = name.endsWith(".mp4");
  const base: Record<string, string> = {
    "Content-Type": mp4 ? "video/mp4" : "image/jpeg",
    "Cache-Control": "private, max-age=600",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="shubhora-${name.slice(-14)}"`,
  };
  const range = mp4 ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "") : null;
  if (range) {
    const size = stat.size;
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : size - 1;
    if (Number.isNaN(start)) { start = Math.max(0, size - Number(range[2])); end = size - 1; } // suffix range: last N bytes
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const fh = await fs.open(file, "r");
    try {
      const buf = Buffer.alloc(end - start + 1);
      await fh.read(buf, 0, buf.length, start);
      return new NextResponse(new Uint8Array(buf), { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(buf.length) } });
    } finally { await fh.close(); }
  }
  const buf = await fs.readFile(file);
  return new NextResponse(new Uint8Array(buf), { headers: { ...base, "Content-Length": String(buf.length) } });
}
