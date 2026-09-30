import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-z0-9-]{1,40}$/i.test(name)) return new NextResponse("bad", { status: 400 });
  const file = path.join(process.cwd(), "bridge", "music", `${name}.mp3`);
  if (!fs.existsSync(file)) return new NextResponse("not found", { status: 404 });
  const buf = fs.readFileSync(file);
  return new NextResponse(buf, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(buf.length), "Cache-Control": "public, max-age=86400" } });
}
