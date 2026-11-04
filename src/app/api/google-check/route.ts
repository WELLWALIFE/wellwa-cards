// Google Health Check API (owner, 4 Nov 2026).
//   POST { step: "find", q, city }                 → up to 5 matching businesses (cheap: one Places text search)
//   POST { step: "report", placeId, phone?, name? } → the full report. A visitor leaves a phone number (the lead); a signed-in
//                                                    account (every account is a partner) needs none and gets a bigger daily limit.
// Limits per IP a day: find 20; report 3 (visitor) / 20 (signed in). A report already made in the last 7 days costs nothing.
import { clientIp, clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildReport, cachedReport, findPlaces, placesConfigured, saveReport } from "@/lib/google-check";

const DAY = 86_400_000;
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (!placesConfigured()) return Response.json({ ok: false, error: "Google check is not set up yet." }, { status: 503 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (b.website) return Response.json({ ok: true });                                            // honeypot

  if (b.step === "find") {
    if (rateLimited(clientKey(request, "gcheck-find"), 20, DAY)) return Response.json({ ok: false, error: "Daily limit reached. Try again tomorrow." }, { status: 429 });
    const q = clean(b.q, 80); const city = clean(b.city, 60);
    if (q.length < 2) return Response.json({ ok: false, error: "Type the business name." }, { status: 400 });
    try {
      const places = await findPlaces(city ? `${q} ${city}` : q);
      return Response.json({ ok: true, places });
    } catch (e) { console.error("google-check find", e); return Response.json({ ok: false, error: "Google did not answer. Try again." }, { status: 502 }); }
  }

  if (b.step === "report") {
    const placeId = clean(b.placeId, 300); if (!placeId) return Response.json({ ok: false, error: "Pick a business first." }, { status: 400 });
    const me = await requireUser();
    const phone = clean(b.phone, 20).replace(/[^\d+]/g, "");
    if (!me && phone.replace(/\D/g, "").length < 10) return Response.json({ ok: false, error: "Enter your WhatsApp number to see the full report." }, { status: 400 });
    if (rateLimited(clientKey(request, me ? "gcheck-user" : "gcheck-public"), me ? 20 : 3, DAY)) return Response.json({ ok: false, error: "Daily limit reached. Try again tomorrow." }, { status: 429 });

    const query = clean(b.q, 120);
    let report = await cachedReport(placeId); let fresh = false;
    if (!report) {
      try { report = await buildReport(placeId); fresh = true; }
      catch (e) { console.error("google-check report", e); return Response.json({ ok: false, error: "Could not build the report. Try again in a minute." }, { status: 502 }); }
    }
    await saveReport(report, { ip: clientIp(request), userId: me?.user.id, phone: phone || undefined, query }).catch(() => {});
    if (!me && phone) await saveLead(phone, clean(b.name, 100) || report.place.name, report).catch(() => {});
    return Response.json({ ok: true, report, fresh });
  }
  return Response.json({ ok: false, error: "Unknown step." }, { status: 400 });
}

/** The visitor's number goes to the company's own leads (same as the contact form), with the score in the message. */
async function saveLead(phone: string, name: string, r: { place: { name: string; address: string }; score: number; fixes: { title: string }[] }) {
  const username = (process.env.SITE_LEAD_CARD ?? "").trim().toLowerCase(); const admin = getAdminSupabase();
  if (!username || !admin) return;
  const { data: card } = await admin.from("cards").select("id,owner_id").eq("username", username).maybeSingle();
  if (!card) return;
  const message = [`Google check: ${r.place.name} — score ${r.score}/100`, r.place.address, ...r.fixes.map((f) => `• ${f.title}`)].join("\n");
  await admin.from("leads").insert({ card_id: card.id, owner_id: card.owner_id, name, phone, email: "", message, source: "form", src: "google-check" });
}
