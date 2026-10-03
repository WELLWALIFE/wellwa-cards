// A notice on the website and card (owner's call, 3 Oct 2026: "news daalni ho ya pop-up lagana ho"): one or two
// lines — "Admissions open 2026-27", "Diwali: 20% off", "Closed on Sunday" — shown as a bar under the header, as a
// pop-up when the page opens, or both; gone by itself after its date. The WhatsApp assistant reads it too.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { Card, CardNotice } from "@/lib/types";

const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A notice exactly as the card may carry it; null when there is no text. */
export function cleanNotice(raw: unknown): CardNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = S(o.text, 140);
  if (!text) return null;
  const mode = o.mode === "popup" || o.mode === "both" ? o.mode : "bar";
  const url = S(o.url, 300);
  const until = S(o.until, 10);
  const imageUrl = S(o.imageUrl, 500);
  return {
    text,
    ...(S(o.sub, 200) ? { sub: S(o.sub, 200) } : {}),
    ...(S(o.label, 40) ? { label: S(o.label, 40) } : {}),
    ...(url && /^(https?:\/\/|\/|#)/i.test(url) ? { url } : {}),
    ...(imageUrl && /^https?:\/\//i.test(imageUrl) ? { imageUrl } : {}),
    mode,
    ...(DATE.test(until) ? { until } : {}),
    ...(o.form === true ? { form: true } : {}),
    at: S(o.at, 30) || new Date().toISOString(),
  };
}

/** The notice to show now — none when there is none or its date has passed (local day, India). */
export function activeNotice(card: Pick<Card, "notice">, now = new Date()): CardNotice | null {
  const n = card.notice;
  if (!n?.text) return null;
  if (n.until) {
    const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);   // IST date
    if (n.until < today) return null;
  }
  return n;
}

/** "till 30 Apr" for the bar. */
export function untilLabel(until: string | undefined, hi: boolean): string {
  if (!until) return "";
  const d = new Date(`${until}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return "";
  const s = d.toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return hi ? `${s} तक` : `till ${s}`;
}
