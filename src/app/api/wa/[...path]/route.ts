// Proxy to the local WhatsApp bridge (bridge/index.mjs on :8787).
// Keeps the dashboard same-origin; returns a clear error when the
// bridge isn't running.

import { requireUser, sameOrigin } from "@/lib/api-security";

const BRIDGE = "http://127.0.0.1:8787";

const ALLOWED = new Set([
  "status", "qr", "pair", "config", "contacts", "send", "logout",
  "followups/start", "followups/stop", "followups/test",
]);

async function proxy(request: Request, path: string[]) {
  const route = path.join("/");
  if (!ALLOWED.has(route)) return Response.json({ error: "not found" }, { status: 404 });
  if (request.method === "POST" && !sameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  // Everyone may link WhatsApp (owner's call, 27 Sep 2026): a free card links its number too — Status posting, and every
  // message saved as a lead. The AI auto-reply (chat bot, follow-ups) runs only on a paid plan: a card plan (pro / team,
  // incl. the trial) or a running Shubhora subscription (Growth / Pro). Same paid rule as waPlanExpiry() in crm-server.
  const FAR = "2999-12-31T23:59:59.000Z";
  const { data: planData } = await session.supabase.rpc("my_plan");
  const plan = Array.isArray(planData) ? planData[0] : planData;
  let expiresAt: string | null = plan && ["pro", "team"].includes(plan.plan) && !plan.expired ? (plan.expires_at || FAR) : null;
  if (!expiresAt) {
    const { data: saasData } = await session.supabase.rpc("my_saas");
    const saas = Array.isArray(saasData) ? saasData[0] : saasData;
    if (saas && saas.tier && saas.tier !== "none" && ["active", "grace"].includes(String(saas.state))) expiresAt = saas.expires_at || FAR;
  }
  // "?link=1": the WhatsApp page is open to link this number, so the bridge may start a WhatsApp process for it. Other
  // callers (the setup bar asks on every screen) get an answer without one (owner's review, 28 Sep 2026).
  const link = new URL(request.url).searchParams.get("link") === "1";
  const target = `${BRIDGE}/${route}${link ? "?link=1" : ""}`;
  try {
    const headers: Record<string, string> = {
      "X-Shubhora-User": session.user.id,
      // The linked number itself works as long as the account does; "none" = no AI replies (free plan).
      "X-Shubhora-Plan-Expires": expiresAt ?? FAR,
      "X-Shubhora-Ai-Until": expiresAt ?? "none",
    };
    const init: RequestInit = { method: request.method, headers };
    if (request.method === "POST") {
      init.body = await request.text();
      headers["Content-Type"] = "application/json";
    }
    const r = await fetch(target, init);
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "bridge_offline", message: "WhatsApp bridge is not running. Start it with: npm run wa" },
      { status: 503 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(request, path);
}
