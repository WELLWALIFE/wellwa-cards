// Template catalogue.
//   GET    → built-in templates merged with the owner's custom ones (public)
//   POST   → create/update a template   (super admin)
//   DELETE → remove a custom template   (super admin)

import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";
import { BUILT_IN_TEMPLATES, type CardTemplateDef } from "@/lib/templates";
import { getPublicSupabase } from "@/lib/supabase/public";
import { callerBrandSlug, canUseTemplate, templateBrand } from "@/lib/template-access";

type Row = CardTemplateDef & { sort?: number; active?: boolean; custom?: boolean };

export async function GET(request: Request) {
  // Company designs (e.g. Wellwa's) only for that company's people; the admin sees all. Signed-out callers get the
  // general designs only.
  const [admin, mine] = await Promise.all([adminAllowed(request).catch(() => false), callerBrandSlug(request)]);
  const allowed = (t: Row) => canUseTemplate(t.brand ?? templateBrand(t.key, BUILT_IN_TEMPLATES), mine, admin);
  const headers = { "Cache-Control": "private, no-store" };
  const built: Row[] = BUILT_IN_TEMPLATES.map((t, i) => ({ ...t, sort: i, custom: false })).filter(allowed);

  const sb = getPublicSupabase();
  if (!sb) return Response.json({ templates: built }, { headers });

  try {
    const { data } = await sb
      .from("card_templates")
      .select("key,name,category,description,emoji,data,sort,active")
      .eq("active", true)
      .order("sort");
    const custom = ((data ?? []) as Row[]).filter(allowed);
    // A custom row with the same key replaces the built-in of that key.
    const merged = [
      ...built.filter((b) => !custom.some((c) => c.key === b.key)),
      ...custom.map((c) => ({ ...c, custom: true })),
    ].sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100));
    return Response.json({ templates: merged }, { headers });
  } catch {
    return Response.json({ templates: built }, { headers });
  }
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });

  const t = (await request.json()) as Partial<Row>;
  if (!t.key || !t.name) return Response.json({ error: "key and name are required" }, { status: 400 });

  const row = {
    key: t.key, name: t.name,
    category: t.category ?? "", description: t.description ?? "",
    emoji: t.emoji || "✨", data: t.data ?? {},
    sort: t.sort ?? 100, active: t.active ?? true,
    updated_at: new Date().toISOString(),
  };

  const r = await fetch(`${SUPA_URL}/rest/v1/card_templates?on_conflict=key`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!r.ok) return Response.json({ error: await r.text() }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { key } = (await request.json()) as { key?: string };
  if (!key) return Response.json({ error: "key required" }, { status: 400 });
  const r = await fetch(`${SUPA_URL}/rest/v1/card_templates?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE", headers: serviceHeaders(),
  });
  return Response.json({ ok: r.ok });
}
