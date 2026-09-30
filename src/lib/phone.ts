/** Indian mobile → E.164 (+91XXXXXXXXXX). Returns null if it isn't a mobile number. */
export function toE164(raw: string): string | null {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91") && /^[6-9]/.test(d.slice(2))) return `+${d}`;
  if (d.length === 11 && d.startsWith("0") && /^[6-9]/.test(d.slice(1))) return `+91${d.slice(1)}`;
  return null;
}
/** A mobile-only account lives in Supabase as an internal email address
 *  (email sign-ups auto-confirm, so no SMS provider is needed). Nobody ever
 *  sees or mails this address; the real contact email, if any, is kept in
 *  user metadata. */
export function phoneEmail(e164: string): string {
  return `p${e164.replace(/[^0-9]/g, "")}@phone.neuraledge.me`;
}
/** "Email or mobile" box: decide which one the person typed. */
export function splitIdentifier(raw: string): { email?: string; phone?: string } {
  const v = String(raw ?? "").trim();
  if (v.includes("@")) return { email: v.toLowerCase() };
  const p = toE164(v);
  return p ? { phone: p } : { email: v.toLowerCase() };
}

/** What to show as the login: the mobile number for phone accounts (never the internal address), else the email. */
export function displayLogin(email: string): string {
  const m = email.match(/^p(\d{10,15})@phone\./);
  return m ? `+${m[1].slice(0, -10)} ${m[1].slice(-10, -5)} ${m[1].slice(-5)}` : email;
}
