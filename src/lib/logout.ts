// The Business section (partner panel, served under /partners on this same site) keeps its own session cookie.
// Ending it together with the app session means one logout — a shared phone never keeps the earnings pages open.
// Best effort: the panel being down must never block logging out of the app.
export async function endPartnerSession(): Promise<void> {
  try {
    await fetch("/partners/logout", { method: "POST", credentials: "same-origin", keepalive: true, signal: AbortSignal.timeout(3000) });
  } catch { /* ignore */ }
}
