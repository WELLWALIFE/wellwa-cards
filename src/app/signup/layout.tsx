// Signup on a white-label host (join.wellwalife.com) carries the partner's
// name and logo. The Host header is the only signal of which partner the
// visitor came through, so it is read here on the server and passed down.
//
// This page is also where every partner's joining link lands (shubhora.com/join/<ID> → /signup?by=<ID>), and the
// WhatsApp assistant sends that link all day — so it has its own share preview: what the free plan gives, with the
// Shubhora picture. A white-label host shows its own name and logo instead.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { brandForHost } from "@/lib/brand";
import { BRAND, OG_IMAGE } from "@/lib/site-brand";
import { BrandProvider } from "@/components/brand-context";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandForHost((await headers()).get("host"));
  if (brand) {
    const title = `${brand.name} — Create your account`;
    const logo = brand.logoUrl ? [{ url: brand.logoUrl }] : [];
    return { title, openGraph: { title, siteName: brand.name, type: "website", images: logo }, twitter: { card: "summary", title, images: logo.map((l) => l.url) } };
  }
  const share = "Create your free Digital V-Card";
  const description = "Your business on one link — products, gallery, WhatsApp button, QR and save-contact. Free for 1 year · no card details needed.";
  return {
    title: `Create your account — ${BRAND}`,
    description,
    openGraph: { title: `${share} — ${BRAND}`, description, siteName: BRAND, type: "website", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: `${share} — ${BRAND}`, description, images: [OG_IMAGE.url] },
  };
}

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const brand = await brandForHost((await headers()).get("host"));
  return (
    <BrandProvider brand={brand ? { name: brand.name, logoUrl: brand.logoUrl ?? null, themeColor: brand.themeColor } : null}>
      {children}
    </BrandProvider>
  );
}
