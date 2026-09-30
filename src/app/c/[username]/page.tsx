import type { Metadata } from "next";
import { CardPageView, cardMetadata } from "./render";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  return cardMetadata((await params).username);
}

export default async function PublicCard({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  return <CardPageView username={(await params).username} viewParam={(await searchParams).view} />;
}
