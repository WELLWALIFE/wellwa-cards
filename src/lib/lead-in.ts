// A lead that came in from outside (CRM → Lead sources: a website form, Google Forms, IndiaMART, Zapier / Make…): the owner is told at
// once — a push, and on a paid plan a line on their own WhatsApp ("message yourself"), the same alert the card's own form sends
// (api/leads/submit). Nothing is ever sent to the customer from here: a number that never wrote to the owner on WhatsApp must not get
// an automatic message (it can get the owner's number banned).
import "server-only";
import { notify, whatsappAllowed } from "@/lib/notify";
import { restAsService } from "@/lib/poster-server";

export type IncomingLead = { name: string; phone: string; message: string; source: string };

export async function alertNewLead(ownerId: string, l: IncomingLead): Promise<void> {
  await notify(ownerId, "new_lead", {
    title: `New lead: ${l.name || l.phone}`,
    body: [`via ${l.source}`, l.phone, l.message.slice(0, 100)].filter(Boolean).join(" · "),
    path: "/leads", channels: ["push"],
  }).catch(() => undefined);
  const p = (await restAsService<{ plan: string | null; plan_expires_at: string | null }[]>(`profiles?id=eq.${ownerId}&select=plan,plan_expires_at`).catch(() => null))?.data?.[0];
  const expiry = p?.plan_expires_at || "2999-12-31T23:59:59.000Z";
  const paid = !!p && ["pro", "team"].includes(String(p.plan)) && Date.parse(expiry) > Date.now();
  if (!paid || !(await whatsappAllowed("new_lead").catch(() => false))) return;
  await fetch("http://127.0.0.1:8787/notify-lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neuraledge-user": ownerId, "x-neuraledge-plan-expires": expiry },
    body: JSON.stringify({ source: l.source, name: l.name, phone: l.phone, message: l.message }),
    signal: AbortSignal.timeout(2500),
  }).catch(() => undefined);
}

/** The phone as the CRM keeps it ("+91…"), out of whatever a platform sends ("+91-98765 43210", "09876543210"); "" if none. */
export function leadPhone(v: unknown): string {
  let d = String(v ?? "").replace(/[^0-9]/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length < 10 || d.length > 15) return "";
  return "+" + (d.length === 10 ? "91" + d : d);
}
