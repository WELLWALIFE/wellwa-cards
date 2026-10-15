"use client";
// Shared pieces of the Business screens (Team, Income, Wallet…): the data hook, the page shell with its Back, the small formatters,
// the Hindi for the partner service's messages, and the "Download Excel" / "View invoice" links.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { api, authHeaders, isLoggedIn } from "@/lib/poster-client";
import { goBack } from "@/lib/nav-back";
import { useT } from "@/lib/poster-i18n";

export const rupee = (paise: number | null | undefined) => `₹${Math.round((paise ?? 0) / 100).toLocaleString("en-IN")}`;
export const rupeeExact = (paise: number | null | undefined) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** What the partner service sends: a day ("2026-10-12"), an ISO time, or a database time ("2026-10-12 08:30:15.123456+00", which Safari cannot read as it is). */
function parseWhen(s: string): { date: Date; dayOnly: boolean } | null {
  const t = s.trim();
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(t);
  const d = new Date(dayOnly ? `${t}T00:00:00Z` : t.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(d.getTime()) ? null : { date: d, dayOnly };
}
// A plain day stays that day everywhere (read as UTC, shown as UTC); a time is shown in India time, where the business runs.
function fmtWhen(s: string | null | undefined, o: Intl.DateTimeFormatOptions): string {
  const p = s ? parseWhen(s) : null;
  return p ? p.date.toLocaleDateString("en-IN", { ...o, timeZone: p.dayOnly ? "UTC" : "Asia/Kolkata" }) : "";
}
export const dayOf = (s: string | null | undefined) => fmtWhen(s, { day: "numeric", month: "short", year: "numeric" });
export const dayShort = (s: string | null | undefined) => fmtWhen(s, { day: "numeric", month: "short" });

/** The kinds of income, as [English, Hindi] — one list for the Income and Wallet pages. */
export const INCOME_KIND: Record<string, [string, string]> = {
  direct: ["Direct sale", "सीधी बिक्री"], match_new: ["Pair (new)", "Pair (नया)"], match_renewal: ["Pair (renewal)", "Pair (renewal)"], sponsor: ["Sponsor", "Sponsor"], rank_reward: ["Rank reward", "Rank reward"],
};

/** Only a normal web address goes into a link (the addresses come from our own service; this keeps anything else out). */
export const safeHref = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);

/* ---------- the partner service's messages, in Hindi ---------- */

// The messages come in English from the partner service and from the routes in front of it. Hindi readers get these (very simple words).
// A few are plain codes ("blocked"): they get a readable English line too.
const EN_FIX: Record<string, string> = {
  blocked: "This ID is blocked. Please contact support.",
  "no partner account": "Your Business account is not ready yet.",
  "partner service error": "Something went wrong. Please try again in a little while.",
  "bad user": "Please log in again.",
  "unknown page": "This page was not found.",
};
const HI: Record<string, string> = {
  blocked: "यह ID बंद है। Support से बात करें।",
  "no partner account": "आपका Business account अभी तैयार नहीं है।",
  "partner service error": "कुछ गड़बड़ हो गई। थोड़ी देर बाद फिर कोशिश करें।",
  "bad user": "फिर से login करें।",
  "unknown page": "यह page नहीं मिला।",
  "Please log in.": "पहले login करें।",
  "Unknown page.": "यह page नहीं मिला।",
  "The Business section is not available right now.": "Business section अभी उपलब्ध नहीं है।",
  "The Business section did not answer. Please try again.": "Business section ने जवाब नहीं दिया। फिर से कोशिश करें।",
  "Could not open this page. Please try again.": "यह page नहीं खुला। फिर से कोशिश करें।",
  "No internet — please try again.": "Internet नहीं है — फिर से कोशिश करें।",
  "Something went wrong. Please try again.": "कुछ गड़बड़ हो गई। फिर से कोशिश करें।",
  "The file could not be sent. Please try again.": "फ़ाइल नहीं जा पाई। फिर से कोशिश करें।",
  "The file could not be saved. Please try again.": "फ़ाइल सेव नहीं हो पाई। फिर से कोशिश करें।",
  "Too many uploads. Please wait a little.": "बहुत सारी फ़ाइलें भेज दीं। थोड़ा रुकें।",
  "Choose a file.": "एक फ़ाइल चुनें।",
  "That file is too big. Please send one under 2 MB.": "फ़ाइल बहुत बड़ी है। 2 MB से छोटी भेजें।",
  "Send a photo (JPG, PNG) or a PDF.": "फ़ोटो (JPG, PNG) या PDF भेजें।",
  "Upload a photo (JPG or PNG) or a PDF.": "फ़ोटो (JPG या PNG) या PDF भेजें।",
  "Upload a photo (JPG or PNG).": "फ़ोटो (JPG या PNG) भेजें।",
  // profile and password
  "Enter a valid email address.": "सही email address डालें।",
  "Your Shubhora login is already set up on your current email. Contact support to change it.": "आपका Shubhora login पहले से इसी email पर बना है। बदलने के लिए Support से बात करें।",
  "Saved.": "सेव हो गया।",
  "Too many tries. Please wait 15 minutes and try again.": "बहुत ज़्यादा कोशिशें हो गईं। 15 मिनट रुककर फिर कोशिश करें।",
  "Enter your current password.": "अभी का पासवर्ड डालें।",
  "The new password must be at least 8 characters.": "नया पासवर्ड कम से कम 8 अक्षर का हो।",
  "The new password is too long.": "नया पासवर्ड बहुत लंबा है।",
  "The two new passwords do not match.": "दोनों नए पासवर्ड एक जैसे नहीं हैं।",
  "The new password must be different from the current one.": "नया पासवर्ड अभी के पासवर्ड से अलग हो।",
  "The current password is not correct.": "अभी का पासवर्ड सही नहीं है।",
  "This password is too easy to guess. Please choose a longer one.": "यह पासवर्ड बहुत आसान है। थोड़ा लंबा पासवर्ड चुनें।",
  "The password could not be changed. Please try again.": "पासवर्ड नहीं बदल पाया। फिर से कोशिश करें।",
  "The password cannot be changed right now. Please try again later.": "अभी पासवर्ड नहीं बदल सकते। थोड़ी देर बाद कोशिश करें।",
  "Password changed.": "पासवर्ड बदल गया।",
  "Password changed. Your Shubhora app password is the same new one.": "पासवर्ड बदल गया। आपके Shubhora app का पासवर्ड भी यही नया है।",
  "Photo upload is turned off.": "फ़ोटो भेजना अभी बंद है।",
  "Photo saved.": "फ़ोटो सेव हो गई।",
  "Photo removed.": "फ़ोटो हटा दी।",
  "Unknown action.": "यह काम नहीं हो सका।",
  // KYC
  "Enter a valid PAN, for example ABCDE1234F.": "सही PAN डालें, जैसे ABCDE1234F।",
  "Enter a valid IFSC code, for example SBIN0001234.": "सही IFSC code डालें, जैसे SBIN0001234।",
  "Enter a valid bank account number.": "सही बैंक खाता नंबर डालें।",
  "The two account numbers do not match.": "दोनों खाता नंबर एक जैसे नहीं हैं।",
  "Aadhaar must be 12 digits.": "आधार नंबर 12 अंकों का होना चाहिए।",
  "Enter the name as written on your PAN card.": "PAN card पर लिखा नाम डालें।",
  "Enter the name of the bank account holder.": "बैंक खाताधारक का नाम डालें।",
  "Enter the name of your bank.": "अपने बैंक का नाम डालें।",
  "Enter a valid GSTIN, or leave it empty.": "सही GSTIN डालें, या खाली छोड़ दें।",
  "Your KYC is already approved. Contact support to change bank details.": "आपका KYC पास हो चुका है। बैंक बदलना हो तो Support से बात करें।",
  "This PAN is already used by another ID.": "यह PAN किसी और ID पर लगा है।",
  "Upload a photo of your PAN card.": "अपने PAN card की फ़ोटो डालें।",
  "Upload a photo of a cancelled cheque or your passbook's first page.": "कैंसिल चेक या पासबुक के पहले पन्ने की फ़ोटो डालें।",
  "KYC submitted. We will review it shortly.": "KYC भेज दिया। हम जल्दी देखेंगे।",
  // support
  "Write your message.": "अपना संदेश लिखें।",
  "Ticket not found.": "यह संदेश नहीं मिला।",
  "Sent. Our team will reply here.": "भेज दिया। हमारी team यहीं जवाब देगी।",
  "Add a subject.": "विषय लिखें।",
  // subscription
  "You can pay only for your own ID or an ID in your team.": "आप सिर्फ़ अपनी ID या अपनी team की ID के लिए भर सकते हैं।",
  "This ID is blocked. Contact support.": "यह ID बंद है। Support से बात करें।",
  "Choose how you paid.": "चुनें कि कैसे भरा।",
  "Enter the receipt number or the name of the person you paid.": "रसीद का number या जिसे पैसे दिए उसका नाम डालें।",
  "Enter the UTR / transaction number of the payment.": "Payment का UTR / transaction number डालें।",
  "Enter the date you paid (not a future date).": "भरने की तारीख डालें (आगे की तारीख नहीं)।",
  "Enter the amount you paid.": "भरी हुई रकम डालें।",
  "Upload a screenshot or photo of the payment.": "Payment का screenshot या फ़ोटो डालें।",
  "This transaction number was already sent. Check the number, or contact support.": "यह transaction number पहले भेजा जा चुका है। Number जाँचें, या Support से बात करें।",
  // wallet
  "Withdrawals are paused right now.": "अभी निकासी बंद है।",
  "Enter an amount in rupees.": "रकम रुपये में डालें।",
  "Withdrawals are on hold for this ID. Contact support.": "इस ID की निकासी रुकी है। Support से बात करें।",
  "Your KYC must be approved before you can withdraw.": "निकासी से पहले आपका KYC पास होना ज़रूरी है।",
  "The amount is more than your available balance.": "रकम आपके उपलब्ध balance से ज़्यादा है।",
  "Withdrawal requested. You will see the bank reference here once it is paid.": "निकासी की माँग भेज दी गई। भुगतान होने पर bank reference यहीं दिखेगा।",
  // team
  "That person is not in your team.": "यह व्यक्ति आपकी team में नहीं है।",
};
const HI_PATTERN: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^The file is too large\. Maximum ([\d.]+) MB\.$/, (m) => `फ़ाइल बहुत बड़ी है। ज़्यादा से ज़्यादा ${m[1]} MB।`],
  [/^ID (.+) not found\.$/, (m) => `ID ${m[1]} नहीं मिली।`],
  [/^A payment for (.+) is already waiting for approval\. Please wait for the company to check it\.$/, (m) => `${m[1]} का payment पहले से मंज़ूरी के इंतज़ार में है। कंपनी के जाँचने तक रुकें।`],
  [/^Sent\. The company will check the payment and (activate|renew) (.+)\. You will see the status below\.$/, (m) => `भेज दिया। कंपनी payment जाँचकर ${m[2]} को ${m[1] === "activate" ? "चालू" : "renew"} कर देगी। नीचे status दिखेगा।`],
  [/^The minimum withdrawal is ₹([\d,.]+)\.$/, (m) => `₹${m[1]} से कम नहीं निकाल सकते।`],
];
/** A message from the partner service (or the routes in front of it) in the reader's language; anything not known is shown as it is. */
export function bizMsg(s: string | null | undefined, en: boolean): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  if (en) return EN_FIX[t] ?? t;
  if (HI[t]) return HI[t];
  for (const [re, fn] of HI_PATTERN) { const m = t.match(re); if (m) return fn(m); }
  return t;
}
/** `const tr = useBizMsg(); tr(message)` — the message in the language the app is set to. */
export function useBizMsg() {
  const { lang } = useT();
  return useCallback((s?: string | null) => bizMsg(s, lang === "en"), [lang]);
}

/* ---------- data ---------- */

export function useBiz<T>(page: string, fields: Record<string, unknown> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(fields);
  const seq = useRef(0); // only the newest answer is kept (a quick tab change must not be overwritten by the slower old one)
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setError("");
    try {
      // replace, not href: this page must not stay in the history, or Back from the login would land here and bounce to the login again.
      if (!(await isLoggedIn())) { window.location.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
      const r = await api<T & { error?: string }>(`/api/business/${page}`, { method: "POST", json: JSON.parse(key) });
      if (mine !== seq.current) return;
      if (!r.ok) setError((r.data as { error?: string })?.error ?? "Could not open this page. Please try again.");
      else setData(r.data as T);
    } catch { if (mine === seq.current) setError("No internet — please try again."); } finally { if (mine === seq.current) setLoading(false); }
  }, [page, key]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

/** A form action: POST to the page with an `op` and fields. Resolves { ok, error?, data }. */
export async function bizAct<T = Record<string, unknown>>(page: string, fields: Record<string, unknown>): Promise<{ ok: boolean; error?: string; data: T }> {
  try {
    const r = await api<T & { error?: string }>(`/api/business/${page}`, { method: "POST", json: fields });
    return { ok: r.ok, error: r.ok ? undefined : (r.data as { error?: string })?.error ?? "Something went wrong. Please try again.", data: r.data as T };
  } catch { return { ok: false, error: "No internet — please try again.", data: {} as T }; }
}

/** Change the account password (checked against the login itself, not the partner record). Resolves { ok, text } with the message to show. */
export async function bizPassword(fields: { current: string; password: string; password2: string }): Promise<{ ok: boolean; text: string }> {
  try {
    const r = await api<{ ok?: string; error?: string }>("/api/business/password", { method: "POST", json: fields });
    return r.ok ? { ok: true, text: r.data.ok ?? "Password changed." } : { ok: false, text: r.data.error ?? "Something went wrong. Please try again." };
  } catch { return { ok: false, text: "No internet — please try again." }; }
}

/** A file for a form (KYC photo, payment proof, attachment) → its id on the partner service. */
export async function bizUpload(file: File, kind: string): Promise<{ id?: string; error?: string }> {
  try {
    const fd = new FormData(); fd.append("file", file); fd.append("kind", kind);
    const h = await authHeaders(); delete h["content-type"];
    const r = await fetch("/api/business/upload", { method: "POST", headers: h, body: fd });
    const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
    return r.ok && j.id ? { id: j.id } : { error: j.error ?? "The file could not be sent. Please try again." };
  } catch { return { error: "No internet — please try again." }; }
}

/* ---------- screens ---------- */

/** The page frame with its Back arrow. Back = the screen the owner was just on (Wallet → KYC → Back is Wallet, not the menu); only with no earlier
 *  screen in the app (a link opened fresh) does it go to `parent` (default: the Business menu; a page that hangs under another says so).
 *  `onBack`: a step INSIDE the page (an open message, a found person) — Back closes that step first, the page's own Back comes after. */
export function BizShell({ title, children, right, parent = "/poster/business", onBack }: { title: string; children: React.ReactNode; right?: React.ReactNode; parent?: string; onBack?: () => void }) {
  const router = useRouter();
  const { lang } = useT();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (onBack ? onBack() : goBack(router, parent))} aria-label={lang === "en" ? "Back" : "पीछे"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Loading / error wrapper: renders `children` once `ready`. */
export function BizState({ loading, error, onRetry, children }: { loading: boolean; error: string; onRetry: () => void; children: React.ReactNode }) {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  if (loading) return <div className="py-20 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (error) return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-center space-y-2">
      <p className="text-sm font-semibold text-danger">{tr(error)}</p>
      <button type="button" onClick={onRetry} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold">{en ? "Try again" : "दोबारा try करें"}</button>
    </div>
  );
  return <>{children}</>;
}

/** "Download Excel": a signed link from the partner service for the member's own statement; opens in a new tab. Nothing is shown without a link. */
export function ExcelButton({ url }: { url?: string | null }) {
  const { lang } = useT(); const en = lang === "en";
  const href = safeHref(url);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold">
      <FileSpreadsheet className="h-4 w-4 text-good" />{en ? "Download Excel" : "Excel में download करें"}
    </a>
  );
}

/** "View invoice": a signed link to that one invoice; opens in a new tab. Without a link (not ready, or not yours to open) it says who to ask. */
export function InvoiceLink({ url }: { url?: string | null }) {
  const { lang } = useT(); const en = lang === "en";
  const href = safeHref(url);
  if (!href) return <span className="text-xs text-muted">{en ? "Ask support if you need a copy." : "Copy चाहिए तो Support से पूछें।"}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink underline">
      <FileText className="h-3.5 w-3.5" />{en ? "View invoice" : "Invoice देखें"}
    </a>
  );
}

export const CARD = "rounded-2xl border border-border bg-surface p-4";
