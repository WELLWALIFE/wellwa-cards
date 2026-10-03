// GET /api/monogram/<AB>-<rrggbb>-<round|soft|sharp>.svg → the business's monogram (src/lib/brand-identity.ts),
// used as the website logo when the owner has none. Public, cacheable, nothing stored.
import { NextResponse } from "next/server";
import { monogramSvg, type MonogramShape } from "@/lib/brand-identity";

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const m = /^([^-]{1,2})-([0-9a-f]{6})-(round|soft|sharp)\.svg$/i.exec(decodeURIComponent(file || ""));
  if (!m) return new NextResponse("Not found", { status: 404 });
  const svg = monogramSvg(m[1], m[2], m[3].toLowerCase() as MonogramShape);
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" } });
}
