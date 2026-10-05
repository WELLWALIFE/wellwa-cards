// What this browser keeps for one account, and when to throw it away.
//
// Super Admin's "Clear all data" (and the demo account's own Reset) wipes the account on the server, but a phone
// that was mid-way through the setup still holds the OLD answers: the onboarding draft, the V-Card form's backup
// (the old trade's facts and product rows), the built preview, the poster draft, the current profile id. Opened
// again, those used to come back over the fresh account — a medical shop kept coming out as a school, the products
// screen showed the old rows, "About you" was skipped (owner, 4 Oct 2026: "clear ke baad steps miss ho jaate hai").
// The wipe now stamps `data_cleared_at` on the account; every screen that restores something local calls
// dropStaleLocal() with the account first, and a stamp this phone has not seen yet drops all of it.

/** Browser storage that belongs to one account but is not scoped by account id where it is written. */
export const PER_ACCOUNT_KEYS = ["akp-draft", "akp-video-draft", "akp-profile", "akp-crm-ws", "vcard-preview"];
/** Keys written as `<prefix><uid>`. */
const PER_UID_PREFIXES = ["onboard-draft:", "vcard-draft:", "vcard-form:", "vcard-products:"];
const SESSION_KEYS = ["setup-resume-hidden", "card-seed"];

const seenKey = (uid: string) => `shubhora.cleared:${uid}`;

/** Drops everything this browser kept for the account when the server says it was cleared since this phone last
 *  looked. Returns true when something was dropped (the caller then reads nothing local). Safe without storage. */
export function dropStaleLocal(user: { id?: string; user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const uid = user?.id ?? "";
  const stamp = String(user?.user_metadata?.data_cleared_at ?? "");
  if (!uid || !stamp) return false;
  try {
    if (localStorage.getItem(seenKey(uid)) === stamp) return false;
    for (const k of PER_ACCOUNT_KEYS) localStorage.removeItem(k);
    for (const p of PER_UID_PREFIXES) localStorage.removeItem(`${p}${uid}`);
    for (const k of SESSION_KEYS) sessionStorage.removeItem(k);
    localStorage.setItem(seenKey(uid), stamp);
    return true;
  } catch { return false; }
}
