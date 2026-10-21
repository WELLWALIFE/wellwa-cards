// Owner-only CRM settings (owner_prefs.crm): calling behaviour and automation switches (docs/crm-pro.md 3.13, 6).
//   GET → { prefs }   PUT { ...partial } → { prefs }
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { prefsOf, savePrefs, DEFAULT_PREFS, type CrmPrefs } from "@/lib/crm-pro";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ prefs: await prefsOf(me.id) });
}

export async function PUT(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<CrmPrefs> = {};
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof CrmPrefs)[]) {
    const v = b[k]; if (v === undefined) continue;
    const want = typeof DEFAULT_PREFS[k];
    if (want === "boolean" && typeof v === "boolean") (patch as Record<string, unknown>)[k] = v;
    else if (want === "number" && typeof v === "number" && Number.isFinite(v)) (patch as Record<string, unknown>)[k] = Math.max(0, Math.min(100000, Math.round(v)));
    else if (want === "string" && typeof v === "string") (patch as Record<string, unknown>)[k] = v.trim().slice(0, 1000);
  }
  return NextResponse.json({ prefs: await savePrefs(me.id, patch) });
}
