// Login on a white-label host shows the partner's name and logo — see
// signup/layout.tsx for why the Host header is read on the server.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { brandForHost } from "@/lib/brand";
import { BrandProvider } from "@/components/brand-context";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandForHost((await headers()).get("host"));
  return { title: brand ? `${brand.name} — Sign in` : "Sign in — Shubhora" };
}

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const brand = await brandForHost((await headers()).get("host"));
  return (
    <BrandProvider brand={brand ? { name: brand.name, logoUrl: brand.logoUrl ?? null, themeColor: brand.themeColor } : null}>
      {children}
    </BrandProvider>
  );
}
