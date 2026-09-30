import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsService<unknown[]>(`social_posts?user_id=eq.${me.id}&select=id,provider,status,error,created_at&order=created_at.desc&limit=30`);
  return NextResponse.json({ posts: r.data ?? [] });
}
