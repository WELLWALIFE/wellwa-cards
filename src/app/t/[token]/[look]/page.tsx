// One design of a website, as a test page (lib/test-links.ts). Opened from the six links the owner sends from the build screen; never indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadTestLinks } from "@/lib/test-links";
import { applyLook } from "@/lib/site-looks";
import { wearAdvanced } from "@/lib/adv-preview";
import { TestSite } from "./view";
import type { Card } from "@/lib/types";

export const metadata: Metadata = { title: "Website design test", robots: { index: false, follow: false } };

export default async function TestLinkPage({ params }: { params: Promise<{ token: string; look: string }> }) {
  const { token, look } = await params;
  const t = await loadTestLinks(token);
  // A Premium design (d1…d6): its spec and words on the card.
  const ds = t?.designs ?? [];
  const d = ds.find((x) => x.key === look);
  // Numbered as on the choose screen: the Premium designs first, then the Standard looks.
  const all = (t?.looks.length ?? 0) + ds.length;
  if (t && d) return <TestSite card={wearAdvanced(t.card, d.adv)} name={d.name} n={ds.indexOf(d) + 1} of={all} />;
  const l = t?.looks.find((x) => x.key === look);
  if (!t || !l) notFound();
  const idx = t.looks.findIndex((x) => x.key === look);
  // A look is the basic website: a Premium design on the card is put aside for it.
  const plain: Card = t.card.site ? { ...t.card, site: { ...t.card.site, advancedOn: false } as Card["site"] } : t.card;
  return <TestSite card={applyLook(plain, l)} name={l.name} n={ds.length + idx + 1} of={all} />;
}
