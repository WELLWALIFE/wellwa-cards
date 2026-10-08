// Bookings (migration 0064): the row type, the time helpers and the texts the reminders send. Isomorphic — the
// Bookings tab and the phone tab import it in the browser, so nothing server-only lives here (the write is in
// bookings-server.ts; a node:fs import through poster-server broke the Leads page build, 9 Oct 2026).

export type BookingStatus = "booked" | "done" | "cancelled" | "no_show";
export type Booking = {
  id: string; owner_id: string; card_id: string | null; lead_id: string | null;
  name: string; phone: string; service: string; starts_at: string; duration_min: number; note: string;
  status: BookingStatus; source: "chat" | "whatsapp" | "owner";
  reminded_customer_24h: string | null; reminded_customer_2h: string | null; reminded_owner_at: string | null;
  created_at: string; updated_at: string;
};
export const BOOKING_COLS = "id,owner_id,card_id,lead_id,name,phone,service,starts_at,duration_min,note,status,source,reminded_customer_24h,reminded_customer_2h,reminded_owner_at,created_at,updated_at";
export const IST = "Asia/Kolkata";

/** "2026-10-09T16:00" (as the AI or the form writes it, India time) → an instant; null when it is not a usable time. */
export function istInstant(local: string): Date | null {
  const m = String(local ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`);
  if (Number.isNaN(d.getTime())) return null;
  const ahead = d.getTime() - Date.now();
  // Yesterday or half a year out is a mistake, not a booking.
  if (ahead < -36 * 3600_000 || ahead > 183 * 86400_000) return null;
  return d;
}
/** Today's date in India, YYYY-MM-DD. */
export const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** "Thu 9 Oct, 4:00 pm" / "गुरु 9 अक्टू, 4:00 pm" in India time. */
export function fmtWhen(iso: string, hindi: boolean): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(hindi ? "hi-IN" : "en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return `${day}, ${time}`;
}
/** "today" / "tomorrow" / the date, relative to India time. */
export function relDay(iso: string, hindi: boolean): string {
  const day = (t: number) => new Date(t + 5.5 * 3600_000).toISOString().slice(0, 10);
  const target = day(new Date(iso).getTime()), today = day(Date.now()), tomorrow = day(Date.now() + 86400_000);
  if (target === today) return hindi ? "आज" : "today";
  if (target === tomorrow) return hindi ? "कल" : "tomorrow";
  return new Date(iso).toLocaleDateString(hindi ? "hi-IN" : "en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "short" });
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();

/** The reminder the customer gets (sent from the owner's WhatsApp, or handed to the owner to forward). */
export function customerReminder(b: Pick<Booking, "name" | "service" | "starts_at">, business: string, hindi: boolean): string {
  const first = (b.name || "").split(" ")[0];
  return hindi
    ? `नमस्ते${first ? ` ${first} जी` : ""} 🙏 याद दिलाना था — *${business}* में आपकी बुकिंग *${relDay(b.starts_at, true)} ${timeOf(b.starts_at)}* पर है${b.service ? ` (${b.service})` : ""}। समय बदलना हो तो यहीं बता दें। धन्यवाद!`
    : `Hi${first ? ` ${first}` : ""} 🙏 A reminder — your booking at *${business}* is *${relDay(b.starts_at, false)} at ${timeOf(b.starts_at)}*${b.service ? ` (${b.service})` : ""}. Reply here if you need to change the time. Thank you!`;
}
/** wa.me link that opens the customer's chat with the reminder already typed. "" when the number is not usable. */
export function tapLink(phone: string, text: string): string {
  const num = String(phone ?? "").replace(/[^0-9]/g, "");
  if (num.length < 10) return "";
  return `https://wa.me/${num.length === 10 ? `91${num}` : num}?text=${encodeURIComponent(text)}`;
}
