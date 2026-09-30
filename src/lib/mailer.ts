import "server-only";
// Email from support@shubhora.com through GoDaddy's mail server (shubhora.com's SPF allows only GoDaddy, so mail sent
// any other way lands in spam). The password lives in a root-only file on the server (SMTP_PASS_FILE), never in code.
// Without SMTP settings every send is skipped quietly, so a missing setting can never break sign-up.
import { readFileSync } from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";
import { BRAND, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/site-brand";
import { SITE_URL } from "@/lib/site-url";
import type { CardMark } from "@/lib/card-year";
import { CARD_RENEWAL } from "@/lib/billing";

let transport: Transporter | null | undefined;
function smtp(): Transporter | null {
  if (transport !== undefined) return transport;
  const user = process.env.SMTP_USER ?? "";
  let pass = process.env.SMTP_PASS ?? "";
  if (!pass && process.env.SMTP_PASS_FILE) { try { pass = readFileSync(process.env.SMTP_PASS_FILE, "utf8").trim(); } catch { pass = ""; } }
  transport = user && pass
    ? nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtpout.secureserver.net", port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user, pass } })
    : null;
  return transport;
}

export const mailReady = () => !!smtp();
/** Where new-registration alerts go (the company inbox unless set). */
export const ALERT_TO = () => process.env.SIGNUP_ALERT_TO || SUPPORT_EMAIL;
/** A real inbox, not the stand-in address made for mobile-number sign-ups. */
export const realEmail = (e?: string | null) => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/@phone\./i.test(e);

export async function sendMail(m: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const t = smtp();
  if (!t) return { ok: false, skipped: true };
  try {
    await t.sendMail({ from: `"${BRAND}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo });
    return { ok: true };
  } catch (e) {
    console.error("[mail]", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** One simple, light email layout that reads well in Gmail on a phone. */
function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f7;font-family:Arial,Helvetica,sans-serif;color:#1d2b2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e3eaea">
<tr><td style="padding:22px 26px 6px;font-size:20px;font-weight:bold;color:#0d8f86">${esc(BRAND)}</td></tr>
<tr><td style="padding:6px 26px 4px;font-size:22px;font-weight:bold;line-height:1.3">${esc(title)}</td></tr>
<tr><td style="padding:8px 26px 8px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
${cta ? `<tr><td style="padding:8px 26px 20px"><a href="${cta.url}" style="display:inline-block;background:#0d8f86;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding:14px 26px 22px;font-size:12px;color:#667;border-top:1px solid #e3eaea">Need help? WhatsApp or call ${esc(SUPPORT_PHONE)} · <a href="mailto:${SUPPORT_EMAIL}" style="color:#0d8f86">${SUPPORT_EMAIL}</a></td></tr>
</table></td></tr></table></body></html>`;
}
const list = (items: string[]) => `<ol style="padding-left:20px;margin:8px 0">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join("")}</ol>`;

/** Welcome to a new Suite account. */
export function welcomeMail(name: string, credits: number) {
  const hi = name ? `Hi ${esc(name.split(" ")[0])},` : "Hi,";
  const steps = ["Add your details and your business", "Add your products or services", "Make your digital card and website — free", "Get a new poster with your name every day"];
  return {
    subject: `Welcome to ${BRAND} — your account is ready`,
    html: layout("Your account is ready", `<p>${hi}</p><p>Thank you for joining ${esc(BRAND)}. Your digital V-Card is free for its first year.${credits > 0 ? ` We have added <b>${credits} free AI credits</b> so you can try the AI tools.` : ""}</p><p><b>Next steps (about 10 minutes):</b></p>${list(steps)}<p>Want the daily poster and status video, the website, WhatsApp AI and auto-posting? Upgrade any time from the app.</p>`,
      { label: "Open my account", url: `${SITE_URL}/poster/setup` }),
    text: `${hi}\n\nThank you for joining ${BRAND}. Your digital V-Card is free for its first year.${credits > 0 ? ` We have added ${credits} free AI credits.` : ""}\n\nNext steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nOpen your account: ${SITE_URL}/poster/setup\n\nHelp: ${SUPPORT_PHONE} · ${SUPPORT_EMAIL}`,
  };
}

/** V-Card renewal reminder: the card's year (free first year, then ₹1,499 a year) is ending, has ended, or has paused. */
export function cardRenewalMail(p: { mark: CardMark; until: string; pauseOn: string; left: number; price: string }) {
  const url = `${SITE_URL}/poster/plan?renew=card`;
  const keep = `Renew for <b>${esc(p.price)} a year</b> and your link, details and leads keep working without a break. The V-Card is also included in the Growth plan.`;
  const safe = "Nothing is deleted — your details, photos and leads are safe, and the card comes back the moment you renew.";
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const toPause = Math.max(1, CARD_RENEWAL.graceDays + p.left); // p.left is 0 or less once the year has ended
  const m =
    p.mark === "d30" || p.mark === "d7" ? { subject: `Your ${BRAND} V-Card: ${days(p.left)} left in its year`, title: `${days(p.left)} left in your V-Card year`, lead: `Your digital V-Card's year ends on <b>${esc(p.until)}</b>. ${keep}` }
    : p.mark === "d1" ? { subject: `Your ${BRAND} V-Card year ends tomorrow`, title: "Your V-Card year ends tomorrow", lead: `Your digital V-Card's year ends on <b>${esc(p.until)}</b>. ${keep}` }
    : p.mark === "ended" ? { subject: `Your ${BRAND} V-Card year has ended — renew by ${p.pauseOn}`, title: "Your V-Card year has ended", lead: `Your card keeps working till <b>${esc(p.pauseOn)}</b>. After that your link shows “Card renew karein” until you renew. ${safe}` }
    : p.mark === "pause-soon" ? { subject: `Your ${BRAND} V-Card pauses in ${days(toPause)}`, title: `Your V-Card pauses in ${days(toPause)}`, lead: `On <b>${esc(p.pauseOn)}</b> your link will show “Card renew karein” instead of your card. Renew now to keep it running. ${safe}` }
    : { subject: `Your ${BRAND} V-Card is paused — renew to bring it back`, title: "Your V-Card is paused", lead: `Visitors see “Card renew karein” on your link. ${safe}` };
  const text = m.lead.replace(/<[^>]+>/g, "");
  return {
    subject: m.subject,
    html: layout(m.title, `<p>Hi,</p><p>${m.lead}</p><p style="font-size:13px;color:#667">V-Card renewal: ${esc(p.price)} for one more year, GST included.</p>`, { label: "Renew my V-Card", url }),
    text: `Hi,\n\n${text}\n\nRenew: ${url}\n\nV-Card renewal: ${p.price} for one more year, GST included.\n\nHelp: ${SUPPORT_PHONE} · ${SUPPORT_EMAIL}`,
  };
}

/** Welcome to a new partner ID (no income claims — compliance). */
export function partnerWelcomeMail(p: { name: string; code: string }) {
  const hi = p.name ? `Hi ${esc(p.name.split(" ")[0])},` : "Hi,";
  const url = `${SITE_URL}/partners/login`;
  return {
    subject: `Welcome to the ${BRAND} Partner programme — ID ${p.code}`,
    html: layout("Your partner ID is ready", `<p>${hi}</p><p>Your ${esc(BRAND)} partner ID is <b>${esc(p.code)}</b>. Log in with your mobile number and the password you chose.</p><p><b>Next steps:</b></p>${list(["Complete your profile and KYC (PAN and bank)", "Activate your Business Suite subscription to turn your ID green", "Read the plan and the partner agreement in the panel"])}<p style="font-size:13px;color:#667">Income depends only on real subscriptions and is not guaranteed. <a href="${SITE_URL}/partners/legal/disclosures" style="color:#0d8f86">Read the disclosures</a>.</p>`,
      { label: "Open partner panel", url }),
    text: `${hi}\n\nYour ${BRAND} partner ID is ${p.code}. Log in with your mobile number and the password you chose: ${url}\n\nNext: complete KYC, activate your subscription, read the plan and the agreement.\nIncome depends only on real subscriptions and is not guaranteed.\n\nHelp: ${SUPPORT_PHONE} · ${SUPPORT_EMAIL}`,
  };
}

/** Alert to the company: somebody registered. */
export function signupAlertMail(a: { app: "Business Suite" | "Partner"; name: string; mobile?: string; email?: string; extra?: string }) {
  const rows: [string, string][] = [["App", a.app], ["Name", a.name || "—"], ["Mobile", a.mobile || "—"], ["Email", a.email || "—"], ...(a.extra ? [["Details", a.extra] as [string, string]] : []),
    ["Time", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })]];
  const digits = (a.mobile ?? "").replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  const wa = to.length >= 11 ? `https://wa.me/${to}?text=${encodeURIComponent(`Hi ${a.name || ""}, welcome to ${BRAND}! I am from the ${BRAND} team — can I help you set up?`)}` : "";
  return {
    subject: `New ${a.app === "Partner" ? "partner" : "sign-up"}: ${a.name || a.mobile || a.email || "someone"}`,
    html: layout(`New registration — ${a.app}`, `<table cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="color:#667">${k}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>`,
      wa ? { label: "Say hello on WhatsApp", url: wa } : undefined),
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}
