// Menu bot. GET → { enabled, data }. PUT { enabled, data } (owner only; bridge picks it up within a minute).
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";

type Opt = { label: string; action: "menu" | "text" | "ai" | "human"; target?: string; reply?: string };
type Node = { id: string; title: string; text: string; options: Opt[] };
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

function clean(data: unknown): { greetNew: boolean; triggers: string[]; nodes: Node[] } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const nodes = (Array.isArray(d.nodes) ? d.nodes : []).slice(0, 20).map((n: Record<string, unknown>, i: number): Node => ({
    id: S(n.id, 20) || `n${i + 1}`, title: S(n.title, 40), text: S(n.text, 800),
    options: (Array.isArray(n.options) ? n.options : []).slice(0, 9).map((o: Record<string, unknown>): Opt => ({
      label: S(o.label, 40), action: (["menu", "text", "ai", "human"] as const).includes(o.action as Opt["action"]) ? (o.action as Opt["action"]) : "ai",
      target: S(o.target, 20) || undefined, reply: S(o.reply, 800) || undefined,
    })).filter((o) => o.label),
  })).filter((n) => n.text || n.options.length);
  const triggers = (Array.isArray(d.triggers) ? d.triggers : []).map((t) => S(t, 20).toLowerCase()).filter(Boolean).slice(0, 12);
  return { greetNew: d.greetNew !== false, triggers, nodes };
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsUser<{ enabled: boolean; data: unknown }[]>(me.token, "wa_flows?select=enabled,data&limit=1");
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return NextResponse.json({ enabled: !!row?.enabled, data: row ? clean(row.data) : null });
}
export async function PUT(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const data = clean(b.data);
  const enabled = !!b.enabled && data.nodes.length > 0;
  const r = await restAsUser(me.token, "wa_flows?on_conflict=owner_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: me.id, enabled, data, updated_at: new Date().toISOString() }) });
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save." }, { status: 502 });
  return NextResponse.json({ ok: true, enabled, data });
}
