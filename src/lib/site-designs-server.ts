import "server-only";
// The designs kept for a card and the twelve to choose from (moved out of api/card/advanced so the admin "all websites to the new
// designs" step uses the very same code, 24 Nov 2026).
import { advDesigns, rememberAdvDesign } from "@/lib/adv-designs";
import { libraryDesigns } from "@/lib/site-advanced-ai";
import { parseAdvanced, type AdvancedSpec } from "@/lib/site-advanced";
import { distinctTradeHeroes, fixedSpecs, spreadSections, tradeTint } from "@/lib/site-advanced-archetypes";
import type { Card } from "@/lib/types";

type Obj = Record<string, unknown>;

// The designs an owner has already made for a card: kept on disk (lib/adv-designs.ts), so "Try another layout" is measured against them,
// an earlier one can be put live, and a closed screen or a restart never loses a design that was paid for.
export const seenItems = (uid: string, cardId: string) => advDesigns(uid, cardId);
/** The kept designs of one card, each in a colour of the card's own trade (trade-colours.ts): designs kept before 17 Nov 2026 could
 *  wear any trade's colour (plum and rust on a cleaning company); they are repaired as they are read, so the choose screen and the
 *  design put live agree. */
export const tradeItems = async (uid: string, row: { id: string; data: Card }) => {
  const kept = (await seenItems(uid, row.id)).filter((r) => r.cardId === row.id && r.spec);
  // A finished template is read as it is written TODAY, not as it was on the day it was kept (24 Nov 2026: the bridal twelve were
  // rewritten to be twelve different pages; a card that had kept the old ones would have gone on showing them). The design that is
  // live on the card is the card's own copy and is not touched here.
  const now = new Map(fixedSpecs(row.data).map((sp) => [sp.seed, sp]));
  const list = kept.map((r) => { const cur = now.get((r.spec as AdvancedSpec).seed); return cur ? { ...r, spec: cur } : r; });
  const tinted = tradeTint(list.map((r) => ({ r, palette: (r.spec as AdvancedSpec).palette })), row.data);
  // …and each with its own layouts: every section shared out over the designs (spreadSections), then one top each.
  return distinctTradeHeroes(spreadSections(list.map((r, i) => ({ ...r, spec: { ...(r.spec as AdvancedSpec), palette: tinted[i].palette } })), row.data), row.data);
};

export const seenSpecs = async (uid: string, cardId: string): Promise<AdvancedSpec[]> => (await seenItems(uid, cardId)).map((r) => r.spec as AdvancedSpec).filter(Boolean);

/** Six designs to choose from (owner, 14 Nov 2026), the same number as a Standard website's looks: the ones already made, filled up from
 *  the design library with no AI run. They carry the words of the design on the card (written once), so choosing one changes the layout only. */
// Twelve for every trade (owner, 24 Nov 2026: "dono me Premium hi bane" — the six old basic looks are no longer offered).
const CHOICES = 12;
export async function fillDesigns(uid: string, row: { id: string; username: string; data: Card }, from?: Obj): Promise<void> {
  const kept = (await seenItems(uid, row.id)).filter((r) => r.cardId === row.id && r.spec);
  // A trade with finished templates (owner, 16 Nov 2026: bridal wear first): its twelve, exactly as written — no seeded variation, no AI.
  // The words stay the ones on the card. Kept once; a template already there is not written again.
  const fixed = fixedSpecs(row.data);
  if (fixed.length) {
    const site0 = row.data.site as (Card["site"] & { advancedCopy?: unknown; advancedMeta?: { critique?: unknown; round?: number } }) | undefined;
    const words = from ?? kept[kept.length - 1] ?? { copy: site0?.advancedCopy ?? {}, critique: site0?.advancedMeta?.critique, round: site0?.advancedMeta?.round ?? 0 };
    const have = new Set(kept.map((r) => (r.spec as AdvancedSpec | undefined)?.seed));
    for (const spec of fixed.filter((x) => !have.has(x.seed))) {
      await rememberAdvDesign(uid, row.id, { ok: true, mode: "preview", cardId: row.id, username: row.username, copy: words.copy ?? {}, critique: words.critique, round: words.round ?? 0, spec, source: { review: "signals", spec: "fixed", copy: "none" } } as unknown as Obj);
    }
    // A trade with a full set of finished templates (bridal's twelve) shows only those. A trade with fewer (motors has one, the
    // Showroom, 28 Nov 2026) still gets the library's designs beside them, so its owners keep twelve to choose from.
    if (fixed.length >= CHOICES) return;
  }
  const kept2 = fixed.length ? (await seenItems(uid, row.id)).filter((r) => r.cardId === row.id && r.spec) : kept;
  if (kept2.length >= CHOICES) return;
  const site = row.data.site as (Card["site"] & { advancedCopy?: unknown; advancedMeta?: { critique?: unknown; source?: Obj; round?: number } }) | undefined;
  const onCard = parseAdvanced(site?.advanced);
  const have = [...kept2.map((r) => parseAdvanced(r.spec)).filter((x): x is AdvancedSpec => !!x), ...(onCard ? [onCard] : [])];
  // A website that never had a Premium design (a Standard order) gets six from the library too (owner, 15 Nov 2026: every design for everyone).
  const base = from ?? kept2[kept2.length - 1] ?? { copy: site?.advancedCopy ?? {}, critique: site?.advancedMeta?.critique, round: site?.advancedMeta?.round ?? 0 };
  for (const spec of libraryDesigns(row.data, have, CHOICES - kept2.length)) {
    await rememberAdvDesign(uid, row.id, { ok: true, mode: "preview", cardId: row.id, username: row.username, copy: base.copy ?? {}, critique: base.critique, round: base.round ?? 0, spec, source: { review: "signals", spec: "library", copy: "none" } } as unknown as Obj);
  }
}
