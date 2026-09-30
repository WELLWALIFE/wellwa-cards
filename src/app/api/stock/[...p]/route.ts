// Serves the cached stock media the card builder places on cards (public/poster/base/stock/card/…): photos and
// the short landscape clip per trade. Served here rather than from /public because those files are written
// after the build, and the static server only knows the files it was built with.
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const ROOT = path.join(process.cwd(), "public", "poster", "base", "stock", "card");
// Folders written after the build, served by prefix: /api/stock/banners/… (profession banners),
// /api/stock/vcard/… (the V-Card seller template's pictures), /api/stock/demo/… (its explainer videos).
const PREFIXES: Record<string, string> = {
  banners: path.join(process.cwd(), "public", "art", "banners"),
  vcard: path.join(process.cwd(), "public", "art", "vcard"),
  demo: path.join(process.cwd(), "public", "demo"),
};
const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".pdf": "application/pdf" };

export async function GET(_req: Request, ctx: { params: Promise<{ p: string[] }> }) {
  const { p } = await ctx.params;
  const rel = (p ?? []).join("/");
  if (!/^[a-z0-9_./-]+$/i.test(rel) || rel.includes("..")) return new NextResponse("Not found", { status: 404 });
  const prefix = Object.keys(PREFIXES).find((k) => rel.startsWith(`${k}/`));
  const root = prefix ? PREFIXES[prefix] : ROOT;
  const file = path.join(root, prefix ? rel.slice(prefix.length + 1) : rel);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(root) || !fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  const stat = fs.statSync(file);
  const range = _req.headers.get("range");
  // Byte ranges so the clip scrubs and starts fast on phones.
  if (range && type === "video/mp4") {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : Math.min(start + 1_000_000, stat.size - 1);
    const stream = fs.createReadStream(file, { start, end });
    return new NextResponse(stream as unknown as ReadableStream, { status: 206, headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  return new NextResponse(fs.readFileSync(file), { headers: { "Content-Type": type, "Content-Length": String(stat.size), "Accept-Ranges": "bytes", "Cache-Control": type === "application/pdf" ? "public, max-age=3600" : "public, max-age=31536000, immutable", ...(type === "application/pdf" ? { "Content-Disposition": `inline; filename="${path.basename(file)}"` } : {}) } });
}
