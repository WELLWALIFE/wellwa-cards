// The review helper (owner, 25 Nov 2026): the link a shop sends its customer after a sale. The customer taps the stars and what they
// liked, gets a short draft they can change, and is sent on to the shop's own Google review box with the text copied. Nothing is
// posted from here: Google takes a review only from the customer's own account.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restAsService } from "@/lib/poster-server";
import { businessOf, googleReviewUrl, hindiCard, type OwnerCard } from "@/lib/customer-send";
import { cardHome } from "@/lib/site-url";
import { ReviewHelper } from "@/components/review-helper";

export const dynamic = "force-dynamic";
type Row = OwnerCard & { owner_id: string };

async function cardBy(username: string): Promise<Row | null> {
  if (!/^[a-z0-9_.-]{1,60}$/i.test(username)) return null;
  const r = await restAsService<Row[]>(`cards?username=eq.${encodeURIComponent(username)}&select=id,owner_id,username,company,name,data&limit=1`);
  return Array.isArray(r.data) ? r.data[0] ?? null : null;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const c = await cardBy((await params).username);
  return { title: c ? `Review ${businessOf(c)}` : "Review", robots: { index: false, follow: false } };
}

export default async function ReviewPage({ params }: { params: Promise<{ username: string }> }) {
  const c = await cardBy((await params).username);
  if (!c) notFound();
  const url = await googleReviewUrl(c.owner_id, c).catch(() => "");
  const links = c.data?.links ?? [];
  const num = (links.find((l) => l.type === "whatsapp")?.value || links.find((l) => l.type === "phone")?.value || "").replace(/\D/g, "");
  const wa = num.length === 10 ? `91${num}` : num.length >= 11 ? num : "";
  return <ReviewHelper biz={businessOf(c)} url={url} wa={wa} hindi={hindiCard(c)} site={cardHome(c.username, c.data?.customDomain)} />;
}
