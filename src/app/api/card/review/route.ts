// A visitor leaves a review on a public card / website. It is saved UNAPPROVED and the owner is told, so
// nothing a stranger writes appears on the card until the owner says so (owner's call, 1 Oct 2026: a new
// business's site showed no reviews at all and had no way to collect the first ones).
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (rateLimited(clientKey(request, "card-review"), 3, 30 * 60_000)) {
    return Response.json({ ok: false, error: "Thank you — you have already sent a review. Please try again later." }, { status: 429 });
  }
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (b.website) return Response.json({ ok: true });                         // honeypot

  const username = clean(b.username, 60).toLowerCase();
  const name = clean(b.name, 60);
  const text = clean(b.text, 300);
  const city = clean(b.city, 40);
  const n = Math.round(Number(b.rating));
  const rating = n >= 1 && n <= 5 ? n : 5;
  if (!username || !name || text.length < 10) {
    return Response.json({ ok: false, error: "Please write your name and a line or two about your experience." }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return Response.json({ ok: false, error: "Could not save just now." }, { status: 503 });
  const { data: card } = await admin.from("cards").select("owner_id").eq("username", username).maybeSingle();
  if (!card?.owner_id) return Response.json({ ok: false, error: "Could not save just now." }, { status: 404 });

  const { error } = await admin.from("poster_testimonials").insert({
    user_id: card.owner_id, customer_name: name, text, rating, city, approved: false,
  });
  if (error) return Response.json({ ok: false, error: "Could not save just now." }, { status: 500 });

  // The owner decides whether it goes on the card; the notification is the only thing that tells them it is waiting.
  void notify(card.owner_id, "new_lead", {
    title: `New review from ${name}`,
    body: `${"★".repeat(rating)} “${text.slice(0, 90)}${text.length > 90 ? "…" : ""}” — approve it to show it on your card.`,
    path: "/poster/testimonials",
    ref: `review:${card.owner_id}:${name}:${text.slice(0, 20)}`,
  }).catch(() => undefined);

  return Response.json({ ok: true });
}
