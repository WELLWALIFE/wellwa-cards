// One page of a card / website at its own address (/c/<user>/products, or /products on the owner's domain).
import type { Metadata } from "next";
import { CardPageView, cardMetadata } from "../render";

export async function generateMetadata({ params }: { params: Promise<{ username: string; page: string }> }): Promise<Metadata> {
  const { username, page } = await params;
  return cardMetadata(username, page);
}

export default async function PublicCardPage({ params, searchParams }: {
  params: Promise<{ username: string; page: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { username, page } = await params;
  return <CardPageView username={username} slug={page} viewParam={(await searchParams).view} />;
}
