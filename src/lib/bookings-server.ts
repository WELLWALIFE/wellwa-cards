// The server-side write for bookings (service role): the AI salesman's bookings from the website chat, WhatsApp and
// the phone receptionist. Kept apart from bookings.ts so the browser bundles never pull poster-server in.
import { restAsService } from "@/lib/poster-server";
import type { Booking } from "@/lib/bookings";

/** Service-role insert (the AI salesman's bookings). Returns the row id, or null. */
export async function createBooking(b: { ownerId: string; cardId?: string | null; leadId?: string | null; name: string; phone: string; service: string; startsAt: Date; note?: string; source: Booking["source"] }): Promise<string | null> {
  const r = await restAsService<{ id: string }[]>("bookings", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ owner_id: b.ownerId, card_id: b.cardId ?? null, lead_id: b.leadId ?? null, name: b.name.slice(0, 80), phone: b.phone.slice(0, 20), service: b.service.slice(0, 120), starts_at: b.startsAt.toISOString(), note: (b.note ?? "").slice(0, 300), source: b.source }),
  });
  if (!r.ok) console.error("[bookings] insert failed", r.status, r.text.slice(0, 160), "— has migration 0064 run?");
  return r.ok ? r.data?.[0]?.id ?? null : null;
}
