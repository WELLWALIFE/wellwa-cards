// GET   (bearer) → FactsResponse: the saved V-Card answers (poster_profiles.card_facts), the setup, the owner's
//                  products (or their brand's) and the number of approved reviews — everything the
//                  "Make your V-Card" form is prefilled from.
// PATCH (bearer) { facts } → saves the keys sent (merged into what is saved; "" or [] clears one) → { facts }.
//                  The form autosaves through this, so a reload or a killed tab loses nothing.
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-security";
import { userFromRequest } from "@/lib/poster-server";
import { loadCardInputs, loadSavedFacts, ownMediaFacts, saveFacts } from "@/lib/card-inputs";
import { mergeFacts, type FactsResponse } from "@/lib/card-facts";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const inputs = await loadCardInputs(me);
  const body: FactsResponse = {
    facts: inputs.facts,
    setup: inputs.setup,
    products: inputs.products,
    brandProducts: inputs.brandProducts,
    reviews: inputs.reviewStats.count,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  // The form autosaves about once every 1.2 s of typing pause, so one long session makes many saves.
  if (rateLimited(`card-facts:${me.id}`, 600, 60 * 60_000)) return NextResponse.json({ error: "Too many saves. Please wait a few minutes." }, { status: 429 });
  const b = await request.json().catch(() => null);
  const patch = b && typeof b === "object" && b.facts && typeof b.facts === "object" && !Array.isArray(b.facts) ? b.facts : null;
  if (!patch) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const saved = await loadSavedFacts(me.id);
  if (!saved.profileId) return NextResponse.json({ error: "Please finish About you first." }, { status: 409 });
  // Only the owner's own uploads may be the shop banner or work photos (never a picture from another site).
  const merged = ownMediaFacts(mergeFacts(saved.facts, patch), me.id);
  // Nothing actually changed (the form re-sends everything on every autosave): no write.
  if (JSON.stringify(merged) === JSON.stringify(saved.facts)) return NextResponse.json({ facts: merged });
  if (!(await saveFacts(me.id, saved.profileId, merged))) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ facts: merged });
}
