// The panel's search box (Cmd+K): users by name / mobile / e-mail / username / business, franchises by code / name.
//   GET ?q= → { hits: [{ type, id, title, sub, href }] }   (a franchise login finds only its own users)
import { requireAdmin, scopeOf } from "@/lib/admin-v2";
import { svc } from "@/lib/service";

const enc = encodeURIComponent;
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
type Hit = { type: "user" | "franchise"; id: string; title: string; sub: string; href: string };

export async function GET(request: Request) {
  const g = await requireAdmin(request, ["users.view", "franchises.view"]); if (!g.ok) return g.res;
  const { me } = g;
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().replace(/[(),*"\\]/g, " ").replace(/\s+/g, " ").slice(0, 60);
  if (q.length < 2) return Response.json({ hits: [] });
  const digits = q.replace(/\D/g, "");
  const scope = scopeOf(me);
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const push = (h: Hit) => { if (!seen.has(h.id)) { seen.add(h.id); hits.push(h); } };
  if (me.rights.includes("users.view") && scope !== "none") {
    const inScope = (ids: string[]) => scope ? svc<{ id: string }[]>(`profiles?id=in.(${ids.join(",")})&franchise_id=eq.${scope}&select=id`).then((r) => new Set(list(r).map((x) => x.id))) : Promise.resolve(null);
    const like = `*${enc(q)}*`;
    const [pr, pp, cd] = await Promise.all([
      svc<{ id: string; full_name: string | null; username: string | null; business: string | null }[]>(`profiles?or=(full_name.ilike.${like},username.ilike.${like},business.ilike.${like})${scope ? `&franchise_id=eq.${scope}` : ""}&select=id,full_name,username,business&limit=8`),
      digits.length >= 4
        ? svc<{ user_id: string; name: string; phone: string }[]>(`poster_profiles?phone.ilike.*${digits}*&select=user_id,name,phone&limit=8`)
        : svc<{ user_id: string; name: string; phone: string }[]>(`poster_profiles?name.ilike.${like}&select=user_id,name,phone&limit=6`),
      svc<{ owner_id: string; username: string; name: string; company: string }[]>(`cards?or=(username.ilike.${like},name.ilike.${like},company.ilike.${like})&select=owner_id,username,name,company&limit=6`),
    ]);
    for (const r of list(pr)) push({ type: "user", id: r.id, title: r.full_name || r.username || "User", sub: [r.username && `@${r.username}`, r.business].filter(Boolean).join(" · "), href: `/admin/users/${r.id}` });
    const extra = [...list(pp).map((x) => ({ id: x.user_id, title: x.name, sub: x.phone })), ...list(cd).map((x) => ({ id: x.owner_id, title: x.name || x.company, sub: `/${x.username}${x.company ? ` · ${x.company}` : ""}` }))].filter((x) => x.id && !seen.has(x.id));
    const ok = extra.length ? await inScope([...new Set(extra.map((x) => x.id))]) : null;
    for (const x of extra) if (!ok || ok.has(x.id)) push({ type: "user", id: x.id, title: x.title, sub: x.sub, href: `/admin/users/${x.id}` });
  }
  if (me.rights.includes("franchises.view") && !me.franchise) {
    const fr = list(await svc<{ id: string; code: string; name: string; city: string }[]>(`franchises?or=(code.ilike.*${enc(q.toUpperCase())}*,name.ilike.*${enc(q)}*,city.ilike.*${enc(q)}*)&select=id,code,name,city&limit=5`));
    for (const f of fr) push({ type: "franchise", id: f.id, title: `${f.code} · ${f.name}`, sub: f.city, href: `/admin/franchises/${f.id}` });
  }
  return Response.json({ hits: hits.slice(0, 12) });
}
