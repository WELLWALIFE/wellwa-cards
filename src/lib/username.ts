// The account username — one name for the card link (/c/<username>), the referral link and the partner name.
// The same rules live in the database (username_rules_ok) and in the partner app; keep the three identical.
export const USERNAME_RE = /^[A-Za-z0-9_]{4,20}$/;
export const USERNAME_HINT = "4 to 20 letters, numbers or _";
/** What the user typed, kept as typed (case is shown as chosen; uniqueness ignores case). */
export const cleanAccountUsername = (raw: string) => String(raw ?? "").trim().replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
/** The link form: lower case, so /c/YADAV_ENTERPRISES and /c/yadav_enterprises are one address. */
export const usernameSlug = (u: string) => cleanAccountUsername(u).toLowerCase();
/** Shaped like a partner ID (two letters + 4 or more digits, e.g. SH100245). Never allowed as a username: joining links
 *  carry either one, and a username equal to someone's ID would take that partner's sign-ups (owner's review, 28 Sep 2026).
 *  The same rule is in the database (username_rules_ok, 0060_security_lock.sql) and in the partner app. */
export const looksLikePartnerId = (u: string) => /^[A-Za-z]{2}\d{4,}$/.test(String(u ?? "").trim());
export const usernameOk = (u: string) => USERNAME_RE.test(u) && !looksLikePartnerId(u);
/** The introducer travels in the sign-up link (?by=<username>) and survives a Google sign-up through this localStorage key. */
export const INTRODUCER_KEY = "shubhora.by";
/** The side (L | R) the introducer's link asked for, kept next to the introducer until sign-up. */
export const INTRODUCER_LEG_KEY = "shubhora.by.leg";
/** The sponsor for a sign-up that carries no introducer at all (the main site's "Start free", no link, nothing kept in
 *  the browser): Next_Level, not the Shubhora root (owner's call, 4 Oct 2026). Links from a member's card or a partner's
 *  joining link always win. Changeable without a rebuild of the server side via DEFAULT_INTRODUCER. */
export const DEFAULT_INTRODUCER = process.env.NEXT_PUBLIC_DEFAULT_INTRODUCER || "Next_Level";
