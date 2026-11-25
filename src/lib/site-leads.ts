import "server-only";
// The platform website's own leads (contact form, Google check) — kept in site_leads so Admin → Leads shows every one, whatever
// card it was also handed to (migration 0100). Never throws: a lead that cannot be stored is logged, the visitor's page carries on.
import { getAdminSupabase } from "@/lib/supabase/admin";
import { restAsService } from "@/lib/poster-server";
import { notify } from "@/lib/notify";

export type SiteLead = { source: "website-contact" | "google-check"; name: string; phone?: string; email?: string; message?: string; card?: string };

export async function saveSiteLead(l: SiteLead): Promise<boolean> {
  const admin = getAdminSupabase();
  if (!admin) return false;
  const { error } = await admin.from("site_leads").insert({
    source: l.source, name: l.name.slice(0, 100), phone: (l.phone ?? "").slice(0, 20), email: (l.email ?? "").slice(0, 200),
    message: (l.message ?? "").slice(0, 2000), card: (l.card ?? "").slice(0, 80),
  });
  if (error) console.error("site_leads insert", error.message);
  // The Super Admins hear of every website lead (owner, 25 Nov 2026), whoever's card it also went to. Push + WhatsApp, as each
  // admin's own notification settings allow; a tap opens Admin → Leads.
  try {
    const admins = (await restAsService<{ id: string }[]>("admin_users?franchise_id=is.null&active=is.true&select=id&limit=20")).data;
    const from = l.source === "google-check" ? "Google check" : "Website form";
    await Promise.all((Array.isArray(admins) ? admins : []).map((a) => notify(a.id, "new_lead", {
      title: `New website lead: ${l.name}`.slice(0, 80), body: `${from} · ${l.phone || l.email || ""}${l.card ? ` · also in ${l.card}` : ""}`.slice(0, 160),
      path: "/admin/leads", ref: `site-lead:${l.source}:${l.phone || l.email}:${(l.message ?? "").slice(0, 40)}`.slice(0, 120),
    }).catch(() => undefined)));
  } catch { /* a lead is never lost to a failed alert */ }
  return !error;
}
