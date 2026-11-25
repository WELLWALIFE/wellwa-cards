import "server-only";
// The platform website's own leads (contact form, Google check) — kept in site_leads so Admin → Leads shows every one, whatever
// card it was also handed to (migration 0100). Never throws: a lead that cannot be stored is logged, the visitor's page carries on.
import { getAdminSupabase } from "@/lib/supabase/admin";

export type SiteLead = { source: "website-contact" | "google-check"; name: string; phone?: string; email?: string; message?: string; card?: string };

export async function saveSiteLead(l: SiteLead): Promise<boolean> {
  const admin = getAdminSupabase();
  if (!admin) return false;
  const { error } = await admin.from("site_leads").insert({
    source: l.source, name: l.name.slice(0, 100), phone: (l.phone ?? "").slice(0, 20), email: (l.email ?? "").slice(0, 200),
    message: (l.message ?? "").slice(0, 2000), card: (l.card ?? "").slice(0, 80),
  });
  if (error) console.error("site_leads insert", error.message);
  return !error;
}
