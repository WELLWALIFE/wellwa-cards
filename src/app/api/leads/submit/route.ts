import { notify, whatsappAllowed } from "@/lib/notify";
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Body = {
  cardUsername?: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  source?: string;
  website?: string;
  attribution?: Record<string, string | null | undefined>;
};

const LEAD_SOURCES = new Set(["form", "popup"]);

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (rateLimited(clientKey(request, "lead-submit"), 8, 10 * 60_000)) {
    return Response.json({ ok: false, error: "Please try again later." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) {
    return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
  }

  let body: Body;
  try { body = await request.json() as Body; }
  catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (body.website) return Response.json({ ok: true }); // honeypot

  const cardUsername = clean(body.cardUsername, 32).toLowerCase();
  const name = clean(body.name, 100);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 200);
  const message = clean(body.message, 1000);
  if (!cardUsername || !name || (!phone && !email)) {
    return Response.json({ ok: false, error: "Name and phone or email are required." }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return Response.json({ ok: false, error: "Service unavailable." }, { status: 503 });
  const { data: card } = await admin.from("cards").select("id,owner_id,active").eq("username", cardUsername).maybeSingle();
  if (!card?.active) return Response.json({ ok: false, error: "Card not found." }, { status: 404 });

  const a = body.attribution ?? {};
  const source = LEAD_SOURCES.has(String(body.source ?? "")) ? String(body.source) : "form";
  const { error } = await admin.from("leads").insert({
    card_id: card.id,
    owner_id: card.owner_id,
    name, phone, email, message,
    source,
    src: clean(a.src, 80) || null,
    utm_source: clean(a.utm_source, 120) || null,
    utm_medium: clean(a.utm_medium, 120) || null,
    utm_campaign: clean(a.utm_campaign, 160) || null,
    utm_content: clean(a.utm_content, 160) || null,
    utm_term: clean(a.utm_term, 160) || null,
    referrer: clean(a.referrer, 500) || null,
  });
  if (error) return Response.json({ ok: false, error: "Could not save the lead." }, { status: 500 });

  await notify(card.owner_id, "new_lead", { title: `New lead: ${name}`, body: [phone || email, message.slice(0, 100)].filter(Boolean).join(" · "), path: "/leads", channels: ["push"] }).catch(() => undefined);
  const { data: owner } = await admin.from("profiles").select("plan,plan_expires_at").eq("id", card.owner_id).maybeSingle();
  const expiry = owner?.plan_expires_at || "2999-12-31T23:59:59.000Z";
  const whatsappActive = Boolean(owner && ["pro", "team"].includes(owner.plan) && Date.parse(expiry) > Date.now()) && await whatsappAllowed("new_lead");
  if (whatsappActive) {
    fetch("http://127.0.0.1:8787/notify-lead", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-neuraledge-user": card.owner_id,
        "x-neuraledge-plan-expires": expiry,
      },
      body: JSON.stringify({ card: cardUsername, source: "form", name, phone, message }),
      signal: AbortSignal.timeout(2500),
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}
