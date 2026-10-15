// "Find a matching picture" (stock) or "Make by AI" (mode: "ai") for one product, from its name. 1 credit
// (owner, 14 Oct 2026: changing a photo costs one credit); given back when nothing good was found.
// Errors carry a `code` (name · limit · busy · credits · start · nomatch · slow · trouble) so the page can say them in the owner's language.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { stockPhotoForProduct, usedPhotoIds, tradeOf } from "@/lib/media/product-stock";
import { aiImage, storeImage, MODERN_LOOK, NO_TEXT } from "@/lib/media/ai-image";

export const maxDuration = 90;
const CREDITS = 1;
const MAX_BODY = 20_000;   // bytes: a product name is all this takes
const inFlight = new Set<string>();
const fail = (error: string, status: number, code: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error, code, ...extra }, { status });

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return fail("Please log in.", 401, "login");
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return fail("That request is too big.", 413, "big");
  const b = (await request.json().catch(() => ({}))) as { name?: unknown; mode?: unknown };
  const ai = b?.mode === "ai";
  const name = (typeof b?.name === "string" ? b.name : "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) return fail("Write the product name first.", 400, "name");
  // A tap while the last one is still being found is turned away BEFORE it counts against the hour (and long before any credit moves).
  if (inFlight.has(me.id)) return fail("One picture is still being found. Please wait a moment.", 409, "busy");
  if (rateLimited(`product-stock-photo:${me.id}`, ai ? 15 : 30, 60 * 60_000)) return fail("Too many tries in an hour. Please wait a little.", 429, "limit");
  inFlight.add(me.id);
  try {
    const ref = `pstock-${me.id.slice(0, 8)}-${randomUUID()}`;
    const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: CREDITS, p_reason: "product-stock-photo", p_ref: ref }) });
    if (!spend.ok) return spend.status >= 500 ? fail("Could not start just now. Nothing was charged. Please try again.", 503, "start") : fail("Not enough credits.", 402, "credits", { needCredits: CREDITS });
    // The credit goes back whenever no picture is given. A refund that did not go through is written to the log (it is the owner's money).
    const refund = async () => {
      try {
        const x = await restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: CREDITS, p_reason: "product-stock-photo-refund", p_ref: ref }) });
        if (!x.ok) console.log("[product-stock-photo] refund failed", me.id, ref, x.status, x.text.slice(0, 200));
      } catch (e) { console.log("[product-stock-photo] refund error", me.id, ref, String(e).slice(0, 200)); }
    };
    try {
      const t = await tradeOf(me.token, me.id);
      const trade = t.label || t.key;
      let url: string | null;
      let why: "nomatch" | "timeout" | "error" = "nomatch";
      if (ai) {
        // Made fresh from the name: one product, plainly shown, a modern studio look (never an old-looking picture).
        const png = await aiImage(`Photorealistic modern e-commerce product photograph of: ${name}${trade ? ` (sold by an Indian ${trade})` : ""}. One single item, shown clearly and large in the centre, on a clean light seamless background with soft natural daylight and a gentle shadow. Crisp sharp detail, true-to-life colour, current premium catalogue style. ${MODERN_LOOK} ${NO_TEXT}`, "4:5");
        url = png ? await storeImage(me.id, "product-ai", png) : null;
      } else {
        // Not a picture another product just took, nor the one a first try gave.
        const tried = await stockPhotoForProduct(me.id, name, trade, { skip: usedPhotoIds(me.id) });
        url = tried.url;
        if (tried.url === null) why = tried.reason;
      }
      if (!url) {
        await refund();
        // "Nothing fits" and "it did not work this time" are different things to tell the owner; the credit comes back in both.
        if (why === "timeout") return fail("The picture search took too long. Nothing was charged. Please try again.", 504, "slow");
        if (why === "error") return fail("The picture search did not work this time. Nothing was charged. Please try again.", 502, "trouble");
        return fail("No good matching picture could be made. Nothing was charged — you can try again or add your own photo.", 404, "nomatch");
      }
      return NextResponse.json({ url });
    } catch {
      await refund();
      return fail("Something went wrong. Nothing was charged. Please try again.", 502, "trouble");
    }
  } finally { inFlight.delete(me.id); }
}
