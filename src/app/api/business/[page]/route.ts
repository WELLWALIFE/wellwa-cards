// The Business screens' data and actions: the signed-in account's partner pages, as JSON, from the partner service (server to server,
// signed). One route for every page: POST { ...fields } → partner action `p.<page>` for THIS account (the account id is set here, never taken
// from the request). GET ?x=y is the same with the query as the fields.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { partnerCall, partnerLinked } from "@/lib/partner-link";

export const PAGES = ["team", "grow", "income", "rank", "wallet", "subscription", "support", "downloads", "profile", "kyc"] as const;

async function run(request: Request, page: string, fields: Record<string, unknown>) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!(PAGES as readonly string[]).includes(page)) return NextResponse.json({ error: "Unknown page." }, { status: 404 });
  if (!partnerLinked()) return NextResponse.json({ error: "The Business section is not available right now." }, { status: 503 });
  const r = await partnerCall<Record<string, unknown>>(`p.${page}`, { ...fields, suiteUserId: me.id }, 20_000);
  if (!r.ok && r.status === 0) return NextResponse.json({ error: "The Business section did not answer. Please try again." }, { status: 503 });
  return NextResponse.json(r.data, { status: r.status || 502 });
}

export async function POST(request: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params;
  const b = await request.json().catch(() => ({}));
  return run(request, page, b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {});
}

export async function GET(request: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params;
  return run(request, page, Object.fromEntries(new URL(request.url).searchParams));
}
