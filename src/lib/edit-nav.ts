// One "Edit" for card and website (owner, 26 Oct 2026: "ek hi Edit"): the two editors are one place with a Card | Website switch.
// The last one used opens next time; a part open in one opens in the other too (?part=), when it is there.
const KEY = "shubhora-edit-at";
export type EditAt = "card" | "site";
export const editHref = (at: EditAt, part = "") => `/poster/${at === "card" ? "card" : "website"}/edit${part ? `?part=${encodeURIComponent(part)}` : ""}`;
export function rememberEdit(at: EditAt) { try { localStorage.setItem(KEY, at); } catch { /* private mode */ } }
export function lastEdit(): EditAt | null { try { const v = localStorage.getItem(KEY); return v === "card" || v === "site" ? v : null; } catch { return null; } }
/** ?part=<key> on the editor's address, once. */
export function partParam(): string { try { return new URLSearchParams(window.location.search).get("part") ?? ""; } catch { return ""; } }
