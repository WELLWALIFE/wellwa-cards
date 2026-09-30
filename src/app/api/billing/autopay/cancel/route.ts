// "Autopay band karein": no more monthly debits. The month already paid keeps running to its end; nothing is deleted.
// (The customer can also stop it from their UPI app — Razorpay then tells the webhook.)
import { razorpayConfigured } from "@/lib/billing";
import { requireUser, sameOrigin } from "@/lib/api-security";
import { LIVE_STATES, latestAutopay, razorpay, saveAutopay } from "@/lib/autopay";
import { notify } from "@/lib/notify";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ ok: false, error: "sign in required" }, { status: 401 });
  if (!razorpayConfigured()) return Response.json({ ok: false, error: "Payments are not configured." }, { status: 503 });
  try {
    const last = await latestAutopay(session.user.id);
    if (!last || !LIVE_STATES.includes(last.status)) return Response.json({ ok: true, status: last?.status ?? "none" });
    const sub = await razorpay().subscriptions.cancel(last.id, false);
    await saveAutopay({ id: last.id, owner_id: session.user.id, status: sub.status || "cancelled", charge_at: null });
    await notify(session.user.id, "payment", {
      title: "Autopay stopped",
      body: "No more monthly debits. Your plan keeps working till the end of the month you have paid for.",
      path: "/poster/plan", ref: `autopay-cancel-${last.id}`,
    }).catch(() => undefined);
    return Response.json({ ok: true, status: sub.status || "cancelled" });
  } catch (e) {
    console.error("[autopay] cancel failed", e);
    const msg = (e as { error?: { description?: string } })?.error?.description || (e instanceof Error ? e.message : "");
    return Response.json({ ok: false, error: msg || "Could not stop autopay." }, { status: 500 });
  }
}
