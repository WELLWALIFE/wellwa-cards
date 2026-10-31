// Flexible payments (owner, 1 Nov 2026): a payment can differ from the Standard package — a payment request with a short link
// (/pay/<code>) made by Super Admin / staff / a franchise for a user, or by the user for themself (an advance, a booking). Shared by
// the app, the admin panel and the server. Pure module. The server side is src/lib/payments-server.ts; migration 0079.
import { SITE_URL } from "@/lib/site-url";

export type PayKind = "plan" | "advance" | "custom";
export type PayTier = "growth" | "premium";
export type PayStatus = "open" | "paid" | "cancelled";

export type PaymentRequest = {
  id: string; code: string; owner_id: string; created_by: string | null; created_role: "self" | "admin" | "franchise";
  kind: PayKind; tier: PayTier | null; months: number; amount_paise: number; title: string; note: string;
  status: PayStatus; order_id: string | null; payment_id: string | null; paid_at: string | null; expires_at: string | null; created_at: string;
};

export const PAY_MIN_PAISE = 10000;        // Rs 100
export const PAY_MAX_PAISE = 50000000;     // Rs 5,00,000
export const payLink = (code: string) => `${SITE_URL}/pay/${encodeURIComponent(code)}`;

export const KIND_LABEL: Record<PayKind, [string, string]> = {
  plan: ["Plan", "Plan"],
  advance: ["Advance", "Advance"],
  custom: ["Custom", "Custom"],
};
export const TIER_LABEL: Record<PayTier, string> = { growth: "Standard", premium: "Premium" };

/** The one line that says what a request is for: "Standard · 3 months", "Advance towards your plan", or the custom title. */
export function requestTitle(r: Pick<PaymentRequest, "kind" | "tier" | "months" | "title">, hi: boolean): string {
  if (r.title.trim()) return r.title.trim();
  if (r.kind === "plan" && r.tier) return `${TIER_LABEL[r.tier]} · ${r.months} ${hi ? (r.months === 1 ? "महीना" : "महीने") : r.months === 1 ? "month" : "months"}`;
  if (r.kind === "advance") return hi ? "Advance — आपके plan के लिए" : "Advance towards your plan";
  return hi ? "Shubhora को भुगतान" : "Payment to Shubhora";
}

/** What happens the moment it is paid, in the customer's words. */
export function requestEffect(r: Pick<PaymentRequest, "kind" | "tier" | "months">, hi: boolean): string {
  if (r.kind === "plan" && r.tier === "growth") return hi ? `Standard plan ${r.months} महीने के लिए चालू हो जाएगा।` : `Standard runs for ${r.months} month${r.months === 1 ? "" : "s"}.`;
  if (r.kind === "plan" && r.tier === "premium") return hi ? `Premium (Standard + Premium website) ${r.months} महीने के लिए चालू हो जाएगा।` : `Premium (Standard + the Premium website) runs for ${r.months} month${r.months === 1 ? "" : "s"}.`;
  if (r.kind === "advance") return hi ? "रकम आपके account में advance की तरह रहेगी — plan लेते समय इसी से कट जाएगी।" : "The amount stays on your account as an advance and pays for your plan when you take it.";
  return hi ? "Shubhora को भुगतान दर्ज हो जाएगा और team को खबर मिल जाएगी।" : "The payment is recorded and the Shubhora team is told.";
}

export const rupeesOf = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/** A short, unambiguous link code (no 0/O/1/I). */
export function newPayCode(): string {
  const A = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = typeof crypto !== "undefined" && "getRandomValues" in crypto ? crypto.getRandomValues(new Uint8Array(8)) : Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
  for (const b of bytes) s += A[b % A.length];
  return s;
}
