// Website "Start a project" form. Saves the enquiry as a lead on the company's own card
// (SITE_LEAD_CARD = that card's username), so it shows in Leads and the CRM like any other enquiry.
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (rateLimited(clientKey(request, "site-contact"), 5, 10 * 60_000)) return Response.json({ ok: false, error: "Please try again in a few minutes." }, { status: 429 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (b.website) return Response.json({ ok: true, saved: true });            // honeypot
  const name = clean(b.name, 100); const contact = clean(b.contact, 200);
  if (!name || !contact) return Response.json({ ok: false, error: "Name and phone or email are required." }, { status: 400 });
  const email = /@/.test(contact) ? contact : ""; const phone = email ? "" : contact.replace(/[^\d+]/g, "").slice(0, 20);
  const message = [clean(b.company, 120) && `Company: ${clean(b.company, 120)}`, clean(b.project, 80) && `Project: ${clean(b.project, 80)}`, clean(b.message, 1500)]
    .filter(Boolean).join("\n");

  const username = (process.env.SITE_LEAD_CARD ?? "").trim().toLowerCase();
  const admin = getAdminSupabase();
  if (!username || !admin) return Response.json({ ok: true, saved: false });
  const { data: card } = await admin.from("cards").select("id,owner_id").eq("username", username).maybeSingle();
  if (!card) return Response.json({ ok: true, saved: false });
  const { error } = await admin.from("leads").insert({ card_id: card.id, owner_id: card.owner_id, name, phone, email, message, source: "form", src: "website-contact" });
  return Response.json({ ok: true, saved: !error });
}
