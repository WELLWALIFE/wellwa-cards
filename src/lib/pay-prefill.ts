"use client";
// Razorpay's own screen asks for a mobile number first; the signed-in owner's number, name and email are handed to it so
// they do not type it again (owner, 14 Oct 2026). Read once in the background; `payPrefill()` is what is ready by tap time.
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Prefill = { contact?: string; email?: string; name?: string };
let ready: Prefill = {};
let started = false;

const ten = (v: unknown) => { const d = String(v ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

export function warmPayPrefill() {
  if (started || typeof window === "undefined") return;
  started = true;
  const sb = getBrowserSupabase();
  if (!sb) return;
  void sb.auth.getUser().then(({ data }) => {
    const u = data.user; if (!u) return;
    const m = (u.user_metadata ?? {}) as Record<string, unknown>;
    const contact = ten(u.phone) || ten(m.phone) || ten(m.whatsapp) || ten(m.mobile);
    const email = u.email && !/@(phone|noemail)\./i.test(u.email) ? u.email : "";
    const name = typeof m.full_name === "string" ? m.full_name : typeof m.name === "string" ? m.name : "";
    ready = { ...(contact ? { contact } : {}), ...(email ? { email } : {}), ...(name ? { name } : {}) };
  }).catch(() => {});
}

export function payPrefill(): Prefill { warmPayPrefill(); return ready; }
