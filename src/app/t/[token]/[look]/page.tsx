// One design of a website, as a test page (lib/test-links.ts). Opened from the six links the owner sends from the build screen; never indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadTestLinks } from "@/lib/test-links";
import { applyLook } from "@/lib/site-looks";
import { wearAdvanced } from "@/lib/adv-preview";
import { TestSite } from "./view";

export const metadata: Metadata = { title: "Website design test", robots: { index: false, follow: false } };

export default async function TestLinkPage({ params }: { params: Promise<{ token: string; look: string }> }) {
  const { token, look } = await params;
  const t = await loadTestLinks(token);
  // A Premium design (d1…d6): its spec and words on the card.
  const ds = t?.designs ?? [];
  const d = ds.find((x) => x.key === look);
  if (t && d) return <TestSite card={wearAdvanced(t.card, d.adv)} name={d.name} n={ds.indexOf(d) + 1} of={ds.length} />;
  const l = t?.looks.find((x) => x.key === look);
  if (!t || !l) notFound();
  const idx = t.looks.findIndex((x) => x.key === look);
  return <TestSite card={applyLook(t.card, l)} name={l.name} n={idx + 1} of={t.looks.length} />;
}
