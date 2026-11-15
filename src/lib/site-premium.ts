// The Premium features on the public website (owner, 15 Nov 2026): "Get our app" and the "Ask …" AI chat. The page server sets
// `site.premiumOn` for the request from the owner's package (app/c/[username]/render.tsx, lib/site-tier.ts) — never stored on the card,
// so it follows the package and not the design: any design may be worn, Standard or Premium.
import type { Card } from "@/lib/types";

export const premiumOn = (card: Pick<Card, "site">): boolean => (card.site as { premiumOn?: boolean } | undefined)?.premiumOn === true;
