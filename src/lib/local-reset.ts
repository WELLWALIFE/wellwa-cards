// What this browser keeps for one account, and when to throw it away.
//
// Super Admin's "Clear all data" (and the demo account's own Reset) wipes the account on the server, but a phone
// that was mid-way through the setup still holds the OLD answers: the onboarding draft, the V-Card form's backup
// (the old trade's facts and product rows), the built preview, the poster draft, the current profile id. Opened
// again, those used to come back over the fresh account — a medical shop kept coming out as a school, the products
// screen showed the old rows, "About you" was skipped (owner, 4 Oct 2026: "clear ke baad steps miss ho jaate hai").
// The wipe now stamps `data_cleared_at` on the account; every screen that restores something local calls
// dropStaleLocal() with the account first, and a stamp this phone has not seen yet drops all of it.
//
// Three more ways the old answers came back (owner, 14 Oct 2026: after Reset demo the new business showed the old
// "Welcome to Sharma Paints…" About and Save failed on the old profile id):
//   - a set-up screen still open (another tab, or the page the phone kept when Back was pressed) went on writing its
//     draft and its answers over the fresh account — screens now hear the reset (onLocalReset) and stop;
//   - a draft or backup of ANOTHER account stayed on a shared phone for ever — dropStaleLocal() now removes them;
//   - the list below missed keys (the website editor's preview, the chat editor's undo copy, the card editor's draft,
//     the ad seed), so they survived a wipe.

/** Browser storage that belongs to one account but is not scoped by account id where it is written. */
export const PER_ACCOUNT_KEYS = ["akp-draft", "akp-video-draft", "akp-profile", "akp-crm-ws", "vcard-preview", "site-edit"];
/** Keys written as `<prefix><account id>…` (the card editor adds `-<card id>` and `:base` after the id). */
const PER_UID_PREFIXES = ["onboard-draft:", "vcard-draft:", "vcard-form:", "vcard-products:", "ne-card-"];
/** Keys written per card, not per account: the chat editor's undo copy holds a whole old card. */
const PER_CARD_PREFIXES = ["card-undo:"];
const SESSION_KEYS = ["setup-resume-hidden", "card-seed", "akp-ad-seed"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seenKey = (uid: string) => `shubhora.cleared:${uid}`;
/** sessionStorage: the account this tab last looked at, so the tab-only leftovers of the one before can go. */
const SESSION_UID = "shubhora.sess-uid";

/** Every localStorage key now — read first, because removing while walking the list skips keys. */
function localKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) out.push(k); }
  return out;
}

/** The account id inside a per-account key (`onboard-draft:<id>`, `ne-card-<id>-<card>`), or "" for any other key. */
function uidIn(key: string): string {
  for (const p of PER_UID_PREFIXES) if (key.startsWith(p)) { const id = key.slice(p.length, p.length + 36); return UUID.test(id) ? id : ""; }
  return "";
}

/** Drops what this browser kept for accounts OTHER than `uid` (a shared phone, a partner signing up a team member, the
 *  owner's "Login as"), and the tab-only leftovers when this tab has just moved to another account. Safe without storage. */
function dropOtherAccounts(uid: string) {
  try {
    for (const k of localKeys()) { const id = uidIn(k); if (id && id.toLowerCase() !== uid.toLowerCase()) localStorage.removeItem(k); }
    const was = sessionStorage.getItem(SESSION_UID);
    if (was && was !== uid) for (const k of SESSION_KEYS) sessionStorage.removeItem(k);
    sessionStorage.setItem(SESSION_UID, uid);
  } catch { /* private mode: nothing kept, nothing to drop */ }
}

/** Drops everything this browser kept for the account when the server says it was cleared since this phone last
 *  looked. Returns true when something was dropped (the caller then reads nothing local). Safe without storage. */
export function dropStaleLocal(user: { id?: string; user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const uid = user?.id ?? "";
  if (uid) dropOtherAccounts(uid);
  const stamp = String(user?.user_metadata?.data_cleared_at ?? "");
  if (!uid || !stamp) return false;
  try {
    // Only a stamp NEWER than the one seen drops anything: a session the phone still holds from before the wipe carries
    // the older stamp, and used to drop the fresh draft being typed (and then flip back when the newer one arrived).
    const seen = localStorage.getItem(seenKey(uid));
    if (seen && stamp <= seen) return false;
    for (const k of PER_ACCOUNT_KEYS) localStorage.removeItem(k);
    for (const k of localKeys()) { if (uidIn(k).toLowerCase() === uid.toLowerCase() || PER_CARD_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k); }
    for (const k of SESSION_KEYS) sessionStorage.removeItem(k);
    localStorage.setItem(seenKey(uid), stamp);
    return true;
  } catch { return false; }
}

/* ---- "this phone was just reset" — told to the screens that keep a draft ---- */

const RESET_EVENT = "shubhora:local-reset";
/** localStorage: written on a reset; the `storage` event carries it to the other tabs of this browser. */
const RESET_SIGNAL = "shubhora.reset-at";

/** Called by the reset button BEFORE it clears storage: a screen that keeps a draft stops writing it (its page-hide
 *  flush would otherwise put the old answers back after the clear), and every other open tab reloads. Who listens: the set-up
 *  screen (it stops writing at once), and AccountGuard, which sits in every page and reloads the tabs that did not press the button. */
export function announceLocalReset() {
  try { window.dispatchEvent(new Event(RESET_EVENT)); } catch { /* ignore */ }
  try { localStorage.setItem(RESET_SIGNAL, String(Date.now())); } catch { /* ignore */ }
}

/** `cb(ownTab)` runs when the account on this phone is reset: from this tab's own button (ownTab true — it is about to
 *  open the welcome page itself) or from another tab (false — this one still shows the old answers and should reload).
 *  A plain `localStorage.clear()` in another tab is taken for a reset too. Returns the way to stop listening. */
export function onLocalReset(cb: (ownTab: boolean) => void): () => void {
  const own = () => cb(true);
  const other = (e: StorageEvent) => { if (e.storageArea === localStorage && (e.key === RESET_SIGNAL || e.key === null)) cb(false); };
  window.addEventListener(RESET_EVENT, own);
  window.addEventListener("storage", other);
  return () => { window.removeEventListener(RESET_EVENT, own); window.removeEventListener("storage", other); };
}
