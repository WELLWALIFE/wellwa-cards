// The audit log (Admin v2): who did what. Needs "audit.view". A franchise login (if given the right) sees only its own actions.
//   GET ?q=&actor=&action=&type=&target=&from=&to=&page= → { rows, page, more }
import { requireAdmin } from "@/lib/admin-v2";
import { svc } from "@/lib/service";

const enc = encodeURIComponent;
export async function GET(request: Request) {
  const g = await requireAdmin(request, "audit.view"); if (!g.ok) return g.res;
  const { me } = g;
  const p = new URL(request.url).searchParams;
  const size = 50, page = Math.max(0, Number(p.get("page")) || 0);
  const f: string[] = [];
  if (me.franchise) f.push(`actor_id=eq.${me.id}`);
  else if (p.get("actor") && /^[0-9a-f-]{36}$/i.test(p.get("actor")!)) f.push(`actor_id=eq.${p.get("actor")}`);
  if (p.get("action")) f.push(`action=like.${enc(p.get("action")!.replace(/[^a-z_.*]/gi, "").replace(/\*/g, "%"))}*`);
  if (p.get("type")) f.push(`target_type=eq.${enc(p.get("type")!.slice(0, 30))}`);
  if (p.get("target")) f.push(`target_id=eq.${enc(p.get("target")!.slice(0, 60))}`);
  if (p.get("from")) f.push(`at=gte.${enc(p.get("from")!)}`);
  if (p.get("to")) f.push(`at=lte.${enc(p.get("to")!)}T23:59:59`);
  const q = (p.get("q") ?? "").trim().replace(/[(),.*"\\]/g, " ").slice(0, 60);
  if (q) f.push(`or=(target_label.ilike.*${enc(q)}*,actor_email.ilike.*${enc(q)}*,note.ilike.*${enc(q)}*,action.ilike.*${enc(q)}*)`);
  const r = await svc<Record<string, unknown>[]>(`audit_log?${f.join("&")}${f.length ? "&" : ""}select=id,at,actor_id,actor_email,actor_role,action,target_type,target_id,target_label,before,after,note,ip&order=at.desc&offset=${page * size}&limit=${size + 1}`);
  const rows = Array.isArray(r.data) ? r.data : [];
  if (!r.ok) return Response.json({ error: /audit_log/.test(r.text) ? "Admin v2 is not set up yet — run migration 0078 in Supabase." : "Could not load." }, { status: 502 });
  return Response.json({ rows: rows.slice(0, size), page, more: rows.length > size });
}
