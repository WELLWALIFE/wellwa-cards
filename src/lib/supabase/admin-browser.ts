"use client";
// The admin panel's OWN logins (owner, 2 Nov 2026: "admin login kiya to app me demo account ki jagah mera account aa gaya — sahi karo";
// 6 Nov 2026: "same browser me user app, franchise, admin sab open ho sake, ek dusre ko disturb na kare").
// Three sessions live side by side in one browser, each in its own cookie:
//   the app            → Supabase's default cookie (lib/supabase/browser.ts)
//   Shubhora staff     → `sb-shubhora-admin`      (Super Admin, support, accounts …)
//   a franchise login  → `sb-shubhora-franchise`
// Each TAB of the panel uses one of the two panel slots (sessionStorage), so a Super Admin tab and a franchise tab can be open
// together; logging in or out in one never touches the others. The admin API routes read the bearer token the panel sends
// (admin-client.ts), never a cookie.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminSlot = "staff" | "franchise";
const COOKIE: Record<AdminSlot, string> = { staff: "sb-shubhora-admin", franchise: "sb-shubhora-franchise" };
const SLOT_KEY = "ne-admin-slot", LAST_KEY = "ne-admin-last-slot";
const clients: Partial<Record<AdminSlot, SupabaseClient | null>> = {};
const isSlot = (v: unknown): v is AdminSlot => v === "staff" || v === "franchise";

/** Is there a saved login in this slot? (The cookie may be split in chunks: name.0, name.1 …) */
export function slotSignedIn(slot: AdminSlot): boolean {
  try { return document.cookie.split(/;\s*/).some((c) => c.startsWith(`${COOKIE[slot]}=`) || c.startsWith(`${COOKIE[slot]}.`)); } catch { return false; }
}
/** This tab's slot: the one it was set to; else the last one used if still logged in; else whichever is logged in. */
export function adminSlot(): AdminSlot {
  try { const s = sessionStorage.getItem(SLOT_KEY); if (isSlot(s)) return s; } catch { /* private mode */ }
  let last: string | null = null;
  try { last = localStorage.getItem(LAST_KEY); } catch { /* private mode */ }
  const pick: AdminSlot = isSlot(last) && slotSignedIn(last) ? last : slotSignedIn("staff") ? "staff" : slotSignedIn("franchise") ? "franchise" : "staff";
  try { sessionStorage.setItem(SLOT_KEY, pick); } catch { /* private mode */ }
  return pick;
}
export function setAdminSlot(slot: AdminSlot) {
  try { sessionStorage.setItem(SLOT_KEY, slot); localStorage.setItem(LAST_KEY, slot); } catch { /* private mode */ }
}
/** The other panel slot, when it holds a login too (for the "Switch to …" button). */
export function otherSlot(): AdminSlot | null {
  const o: AdminSlot = adminSlot() === "staff" ? "franchise" : "staff";
  return slotSignedIn(o) ? o : null;
}

export function getAdminSupabase(slot: AdminSlot = adminSlot()): SupabaseClient | null {
  if (clients[slot] !== undefined) return clients[slot]!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  clients[slot] = url && key ? createBrowserClient(url, key, { isSingleton: false, cookieOptions: { name: COOKIE[slot] } }) : null;
  return clients[slot]!;
}
