// Platform settings (Admin v2). Needs "settings.manage". GET → { settings } · PUT { ...patch } → { settings }
import { requireAdmin, getSettings, setSettings, audit, DEFAULT_SETTINGS, type Settings } from "@/lib/admin-v2";

export async function GET(request: Request) {
  const g = await requireAdmin(request, "settings.manage"); if (!g.ok) return g.res;
  return Response.json({ settings: await getSettings(true), defaults: DEFAULT_SETTINGS });
}
export async function PUT(request: Request) {
  const g = await requireAdmin(request, "settings.manage", { sensitive: true }); if (!g.ok) return g.res;
  const b = (await request.json().catch(() => ({}))) as Partial<Record<keyof Settings, unknown>>;
  const before = await getSettings(true);
  const patch: Partial<Settings> = {};
  if (typeof b.enforce_mfa === "boolean") patch.enforce_mfa = b.enforce_mfa;
  if (typeof b.franchise_can_activate === "boolean") patch.franchise_can_activate = b.franchise_can_activate;
  if (typeof b.signup_alert === "boolean") patch.signup_alert = b.signup_alert;
  for (const k of ["commission_first_pct", "commission_renewal_pct"] as const) { const n = Number(b[k]); if (b[k] !== undefined && Number.isFinite(n) && n >= 0 && n <= 100) patch[k] = Math.round(n * 100) / 100; }
  if (b.payout_min_paise !== undefined) { const n = Math.round(Number(b.payout_min_paise)); if (Number.isFinite(n) && n >= 0) patch.payout_min_paise = n; }
  // Turning 2-step on for everyone while you have none yourself would lock you out at the next call.
  if (patch.enforce_mfa && g.me.via === "session" && !g.me.mfaEnrolled) return Response.json({ error: "Set up your own 2-step first (Security), then require it for everyone." }, { status: 400 });
  const settings = await setSettings(patch, g.me.id || null);
  await audit(g.me, "settings.update", { type: "setting", id: "platform", before, after: settings }, request);
  return Response.json({ settings });
}
