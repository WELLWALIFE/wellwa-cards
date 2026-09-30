// The platform owners' own logins. The panel's lock screen (components/admin-gate.tsx) and the /api/admin/* guard
// (lib/admin-guard.ts) must read the SAME list: when the gate lets an owner in by email but the APIs do not know
// that email, the panel opens and then every page inside it says "unauthorized".
// ADMIN_EMAILS (comma separated) replaces the list on a server that wants a different one. It is a server-only
// variable, so the lock screen always sees the default list — harmless, because the API guard decides in the end.
const fromEnv = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const OWNER_EMAILS: readonly string[] = fromEnv.length ? fromEnv : ["wellwalife@gmail.com", "licuretech@gmail.com"];

export const isOwnerEmail = (email: string | null | undefined): boolean =>
  OWNER_EMAILS.includes(String(email ?? "").trim().toLowerCase());
