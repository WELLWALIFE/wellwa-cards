import "server-only";
// "Customer needs you now" — the WhatsApp bot's alert to the shop owner, with a sound (owner, 27 Nov 2026: "jab isne booking
// kiya to Joginder ji ko kya information di? koi notification ya sound bhi hua? … ek bell / alarm bajna chahiye").
// Until now the alert went only to the owner's own "message yourself" chat (WhatsApp never rings for that) on the QR
// WhatsApp, and only into the CRM notes on the Business API number. Now it also goes as:
//   push     — a phone / browser notification (with the phone's sound) to every device where the owner allowed them;
//   whatsapp — a message from the company's WhatsApp (NOTIFY_WA_USER) to the owner's number: a different sender, so it rings.
//              Skipped for the company's own account (it would be a message to itself — silent again).
// The same customer alerts at most once in 30 minutes (ref).
import { notify } from "@/lib/notify";

export async function ownerAlert(ownerId: string, a: { name?: string; phone?: string; alert: string; inbound?: string }) {
  const digits = String(a.phone ?? "").replace(/\D/g, "");
  const who = `${a.name?.trim() || "Customer"}${digits ? ` (+${digits})` : ""}`;
  const company = process.env.NOTIFY_WA_USER || "";
  const channels: ("push" | "whatsapp")[] = company && company !== ownerId ? ["push", "whatsapp"] : ["push"];
  const text = `🔔 *Customer needs you now*\n👤 ${who}\n📌 ${a.alert.slice(0, 200)}${a.inbound ? `\n💬 "${a.inbound.slice(0, 160)}"` : ""}${digits ? `\n\n👉 Reply now: https://wa.me/${digits}` : ""}`;
  return notify(ownerId, "customer_alert", {
    title: `🔔 ${who}`,
    body: a.alert.slice(0, 160),
    path: "/poster/crm",
    ref: `${digits || a.name || "x"}:${Math.floor(Date.now() / (30 * 60_000))}`,
    whatsappText: text,
    channels,
  }).catch((e) => { console.error("[owner-alert]", e); return {}; });
}
