// Google Health Check API (owner, 4 Nov 2026).
//   POST { step: "find", q, city }                 → up to 5 matching businesses (cheap: one Places text search)
//   POST { step: "noprofile", q, city, phone, name } → nothing found on Google: the visitor asks for a profile to be made (a lead)
//   POST { step: "report", placeId, phone?, name? } → the full report. A visitor leaves a phone number (the lead); a signed-in
//                                                    account (every account is a partner) needs none and gets a bigger daily limit.
// Limits per IP a day: find 20; report 3 (visitor) / 20 (signed in). A report already made in the last 7 days costs nothing.
import { clientIp, clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildReport, cachedReport, findPlaces, placesConfigured, replaceReport, saveReport, withSiteSpeed } from "@/lib/google-check";
import { isShubhoraSellerCard } from "@/lib/shubhora-page";
import { bridge, ownerPlanExpiry } from "@/lib/crm-server";
import { notify } from "@/lib/notify";
import { SITE_URL } from "@/lib/site-url";
import { saveSiteLead } from "@/lib/site-leads";

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

  // Not on Google at all (owner, 26 Nov 2026: a business with a website but no Google profile is not found by name, and those are
  // the ones who need it most): the visitor leaves a number and the profile is made for them. A lead like the report's, no report.
  if (b.step === "noprofile") {
    const me = await requireUser();
    const phone = clean(b.phone, 20).replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 10) return Response.json({ ok: false, error: "Enter your WhatsApp number." }, { status: 400 });
    if (rateLimited(clientKey(request, "gcheck-noprofile"), 5, DAY)) return Response.json({ ok: false, error: "Daily limit reached. Try again tomorrow." }, { status: 429 });
    const biz = clean(b.q, 80), city = clean(b.city, 60), name = clean(b.name, 100) || biz;
    if (biz.length < 2) return Response.json({ ok: false, error: "Type the business name." }, { status: 400 });
    const by = clean(b.by, 60).toLowerCase();
    const card = await leadCard(by, me?.user.id).catch(() => null);
    const message = `Google check: "${biz}"${city ? ` (${city})` : ""} — not found on Google. Wants a Google Business Profile made.`;
    const admin = getAdminSupabase();
    let cardName = "";
    if (admin && card) { const { data: u } = await admin.from("cards").select("username").eq("id", card.id).maybeSingle(); cardName = u?.username ?? ""; }
    await saveSiteLead({ source: "google-check", name, phone, message, card: cardName }).catch(() => false);
    if (admin && card) {
      await admin.from("leads").insert({ card_id: card.id, owner_id: card.owner_id, name, phone, email: "", message, source: "form", src: "google-check" });
      const digits = phone.replace(/\D/g, ""); const to = digits.length === 10 ? `91${digits}` : digits;
      await notify(card.owner_id, "new_lead", {
        title: `New lead: ${name} — no Google profile`.slice(0, 80), body: `${biz}${city ? `, ${city}` : ""} · ${phone}`.slice(0, 160),
        path: "/poster/leads", ref: `gcheck-np:${digits}:${biz}`.slice(0, 120),
        whatsappText: `🔎 *New lead from the Google check*\n${name} — ${phone}\n"${biz}"${city ? ` (${city})` : ""} is not on Google. They want a Google Business Profile.\n\nMessage them: https://wa.me/${to}`,
      }).catch(() => undefined);
    }
    const partner = await partnerOf(by).catch(() => null);
    return Response.json({ ok: true, ...(partner ? { partner } : {}) });
  }

  if (b.step === "report") {
    const placeId = clean(b.placeId, 300); if (!placeId) return Response.json({ ok: false, error: "Pick a business first." }, { status: 400 });
    const me = await requireUser();
    const phone = clean(b.phone, 20).replace(/[^\d+]/g, "");
    if (!me && phone.replace(/\D/g, "").length < 10) return Response.json({ ok: false, error: "Enter your WhatsApp number to see the full report." }, { status: 400 });
    if (rateLimited(clientKey(request, me ? "gcheck-user" : "gcheck-public"), me ? 20 : 3, DAY)) return Response.json({ ok: false, error: "Daily limit reached. Try again tomorrow." }, { status: 429 });

    const query = clean(b.q, 120);
    const sells = clean(b.sells, 40);
    let report = await cachedReport(placeId); let fresh = false;
    // A kept report with no local list, and now the visitor says what they sell: made again with it.
    if (report && !report.local && sells) report = null;
    if (!report) {
      try { report = await buildReport(placeId, sells, false); fresh = true; }
      catch (e) { console.error("google-check report", e); return Response.json({ ok: false, error: "Could not build the report. Try again in a minute." }, { status: 502 }); }
    }
    await saveReport(report, { ip: clientIp(request), userId: me?.user.id, phone: phone || undefined, query }).catch(() => {});
    // A number typed in is a lead — also when the one checking is signed in (a partner checking a shop with its owner beside them; the
    // owner tested with his own number while signed in and nothing arrived — 25 Nov 2026). Ten digits at least.
    if (phone.replace(/\D/g, "").length >= 10) await saveLead(phone, clean(b.name, 100) || report.place.name, report, clean(b.by, 60).toLowerCase(), me?.user.id).catch((e) => console.error("google-check lead", e));
    // Came from a partner's website: the report's "Fix my Google profile" button opens THAT partner's WhatsApp (their public number).
    const partner = await partnerOf(clean(b.by, 60).toLowerCase()).catch(() => null);
    return Response.json({ ok: true, report, fresh, ...(partner ? { partner } : {}) });
  }
  // The website's speed, asked by the page right after it shows the report (it takes 20 to 40 seconds). Only for a report already
  // made and still waiting for it: nothing new is asked of Google Places, and nobody's number is needed again.
  if (b.step === "speed") {
    const placeId = clean(b.placeId, 300); if (!placeId) return Response.json({ ok: false }, { status: 400 });
    if (rateLimited(clientKey(request, "gcheck-speed"), 30, DAY)) return Response.json({ ok: false, error: "Daily limit reached." }, { status: 429 });
    const kept = await cachedReport(placeId);
    if (!kept) return Response.json({ ok: false }, { status: 404 });
    if (!kept.sitePending) return Response.json({ ok: true, report: kept });
    const report = await withSiteSpeed(kept);
    await replaceReport(report).catch(() => {});
    return Response.json({ ok: true, report });
  }
  return Response.json({ ok: false, error: "Unknown step." }, { status: 400 });
}

/** A Shubhora partner's name and WhatsApp number as their own card shows them; null for any other card. */
async function partnerOf(by: string): Promise<{ name: string; wa: string; card: string } | null> {
  const admin = getAdminSupabase();
  if (!admin || !/^[a-z0-9_.-]{2,60}$/.test(by)) return null;
  const { data } = await admin.from("cards").select("data").eq("username", by).maybeSingle();
  const d = (data?.data ?? {}) as { company?: string; name?: string; jobTitle?: string; tagline?: string; links?: { type?: string; value?: string }[] };
  if (!data || !isShubhoraSellerCard(d)) return null;
  const wa = ((d.links ?? []).find((l) => l.type === "whatsapp")?.value ?? "").replace(/\D/g, "");
  return wa.length >= 10 ? { name: (d.name || d.company || "").trim(), wa: wa.length === 10 ? `91${wa}` : wa, card: by } : null;
}

/** The report as one WhatsApp message: where they stand, the score, what to fix first, and the link to check again. */
function reportText(r: { place: { name: string; id?: string }; city: string; score: number; fixes: { title: string; why: string }[]; issues?: unknown[]; local?: { rank: number | null; total: number; ahead: unknown[] }; profile?: { ok: boolean }[] }, from: string): string {
  const fixes = r.fixes.slice(0, 3).map((f, i) => `${i + 1}. *${f.title}*\n   ${f.why}`).join("\n");
  const pct = r.profile?.length ? Math.round((r.profile.filter((x) => x.ok).length / r.profile.length) * 100) : null;
  return [
    `🔎 *Google report — ${r.place.name}*${r.city ? ` (${r.city})` : ""}`,
    r.local && r.local.ahead.length ? `🏆 *${r.local.ahead.length}${r.local.rank === null ? "+" : ""} businesses* show before you on Google` : "",
    `📊 Score: *${r.score}/100*${pct !== null ? ` · Profile ${pct}% complete` : ""}${r.issues?.length ? ` · ${r.issues.length} issues found` : ""}`,
    fixes ? `\n*Fix these first:*\n${fixes}` : "",
    r.place.id ? `\n🖼️ Your report as a picture: ${SITE_URL}/api/google-check/card?p=${encodeURIComponent(r.place.id)}` : "",
    `\nSee the full report: ${SITE_URL}/google-check`,
    `— ${from}`,
  ].filter(Boolean).join("\n");
}

/** The visitor's number goes to the company's own leads (same as the contact form), with the score in the message. */
async function saveLead(phone: string, name: string, r: Parameters<typeof reportText>[0] & { place: { name: string; address: string } }, by = "", signedIn?: string) {
  const admin = getAdminSupabase();
  if (!admin) return;
  const card = await leadCard(by, signedIn);
  const message = [`Google check: ${r.place.name} — score ${r.score}/100`, r.place.address, ...r.fixes.map((f) => `• ${f.title}`)].join("\n");
  return deliverLead(admin, card, phone, name, message, r);
}

/** Whose lead a visitor is: the partner whose website sent them, else the signed-in account, else the company's own card. */
async function leadCard(by: string, signedIn?: string): Promise<{ id: string; owner_id: string } | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  // Opened from a Shubhora partner's website (?by=<their card>): the visitor is that partner's lead (owner, 25 Nov 2026). Only a real
  // partner card counts — any other name, or none, and the lead goes to the company's own card as before.
  let card: { id: string; owner_id: string } | null = null;
  if (/^[a-z0-9_.-]{2,60}$/.test(by)) {
    const { data } = await admin.from("cards").select("id,owner_id,data").eq("username", by).maybeSingle();
    const d = (data?.data ?? {}) as { company?: string; name?: string; jobTitle?: string; tagline?: string };
    if (data && isShubhoraSellerCard(d)) card = { id: data.id, owner_id: data.owner_id };
  }
  // Signed in, not sent by a partner: the lead is the signed-in account's own (their customer), on their newest card.
  if (!card && signedIn) {
    const { data } = await admin.from("cards").select("id,owner_id").eq("owner_id", signedIn).order("created_at", { ascending: false }).limit(1).maybeSingle();
    card = data ?? null;
  }
  if (!card) {
    const username = (process.env.SITE_LEAD_CARD ?? "").trim().toLowerCase();
    if (username) { const { data } = await admin.from("cards").select("id,owner_id").eq("username", username).maybeSingle(); card = data ?? null; }
  }
  return card;
}

async function deliverLead(admin: NonNullable<ReturnType<typeof getAdminSupabase>>, card: { id: string; owner_id: string } | null, phone: string, name: string, message: string, r: Parameters<typeof reportText>[0]) {
  // Always kept for Admin → Leads, with the card it also went to.
  let cardName = "";
  if (card) { const { data: u } = await admin.from("cards").select("username").eq("id", card.id).maybeSingle(); cardName = u?.username ?? ""; }
  await saveSiteLead({ source: "google-check", name, phone, message, card: cardName });
  if (!card) return;
  await admin.from("leads").insert({ card_id: card.id, owner_id: card.owner_id, name, phone, email: "", message, source: "form", src: "google-check" });

  // The page says "we send the full report there too": it goes from the lead owner's own WhatsApp when it is linked (the same
  // bridge as booking reminders). Not linked: the owner gets the report with the customer's number, to forward in one tap.
  const { data: c } = await admin.from("cards").select("data").eq("id", card.id).maybeSingle();
  const cd = (c?.data ?? {}) as { company?: string; name?: string };
  const from = (cd.company || cd.name || "Shubhora").trim();
  const text = reportText(r, from);
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  let sent = false;
  const expiry = await ownerPlanExpiry(card.owner_id).catch(() => null);
  if (expiry) sent = (await bridge(card.owner_id, expiry, "send", { to, text })).ok;
  await notify(card.owner_id, "new_lead", {
    title: `New lead: ${name}`.slice(0, 80),
    body: `Google check ${r.score}/100 · ${phone}${sent ? " · report sent on WhatsApp" : ""}`.slice(0, 160),
    path: "/poster/leads", ref: `gcheck:${digits}:${r.place.name}`.slice(0, 120),
    whatsappText: sent ? undefined : `🔎 *New lead from the Google check*\n${name} — ${phone}\nScore ${r.score}/100\n\nSend them the report in one tap:\nhttps://wa.me/${to}?text=${encodeURIComponent(text)}`,
  }).catch(() => undefined);
}
