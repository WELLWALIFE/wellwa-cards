// GET (bearer) ?as=&q=&stage=&kind=&tag=&stars=<1-5, at least>&source=&assigned=me|none|<uuid>&city=&due=today|overdue|any&idle=<days>&sort=&page=&extra=1
// → 50 leads a page, searched and filtered on the server (the old /api/crm/inbox loads everything and stays for the old UI).
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { listLeads } from "@/lib/crm-pro";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  if (!scope) return NextResponse.json({ error: "You are not a member of that team." }, { status: 403 });
  const s = (k: string) => (p.get(k) ?? "").trim().slice(0, 60) || undefined;
  const r = await listLeads(scope, { q: s("q"), stage: s("stage"), kind: s("kind"), tag: s("tag"), stars: Number(s("stars")) || 0, source: s("source"), assigned: s("assigned"), city: s("city"), due: s("due"), idle: Number(p.get("idle") ?? 0) || undefined, sort: s("sort"), page: Number(p.get("page") ?? 0) || 0 });
  // ?extra=1 (the export): each lead's own-field values, read apart so a missing column never breaks the list.
  if (p.get("extra") && r.leads.length) {
    const x = await restAsService<{ id: string; extra: Record<string, string> | null }[]>(`leads?id=in.(${r.leads.map((l) => l.id).join(",")})&owner_id=eq.${scope.ownerId}&select=id,extra`);
    const by = new Map((x.ok && Array.isArray(x.data) ? x.data : []).map((l) => [l.id, l.extra ?? {}]));
    return NextResponse.json({ ...r, leads: r.leads.map((l) => ({ ...l, extra: by.get(l.id) ?? {} })) });
  }
  return NextResponse.json(r);
}
