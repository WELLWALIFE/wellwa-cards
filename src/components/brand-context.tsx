"use client";
import { SITE_HOST } from "@/lib/site-url";

// White-label context for the auth pages. The server layout reads the Host
// header, resolves the partner brand and hands it down here, so a distributor
// who signs up on join.wellwalife.com sees Wellwa's name and logo — never
// Shubhora's. Off a brand host the value is null and everything falls back
// to the platform branding.

import { createContext, useContext } from "react";
import { Logo } from "@/components/logo";

export type AuthBrand = { name: string; logoUrl: string | null; themeColor: string; baseDomain?: string } | null;

const Ctx = createContext<AuthBrand>(null);

export function BrandProvider({ brand, children }: { brand: AuthBrand; children: React.ReactNode }) {
  return <Ctx.Provider value={brand}>{children}</Ctx.Provider>;
}

export function useBrand(): AuthBrand {
  return useContext(Ctx);
}

/** Public address of a card as the current host would share it (no scheme):
 *  <user>.wellwalife.com on a partner host, <site>/c/<user> otherwise. */
export function useCardHost(): (username: string) => string {
  const brand = useBrand();
  return (username) => (brand?.baseDomain ? `${username}.${brand.baseDomain}` : `${SITE_HOST}/c/${username}`);
}

/** Partner logo + name on a brand host; the Shubhora logo otherwise. */
export function BrandLogo() {
  const brand = useBrand();
  if (!brand) return <Logo />;
  return (
    <span className="flex items-center gap-2.5">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt={brand.name} className="h-9 w-9 rounded-lg object-contain bg-white shadow-sm" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-lg text-white font-bold" style={{ background: brand.themeColor }}>
          {brand.name.slice(0, 1)}
        </span>
      )}
      <span className="font-semibold tracking-tight text-ink">{brand.name}</span>
    </span>
  );
}

/** "Welcome back to <brand>." — brand-aware copy for the login page. */
export function BrandWelcome() {
  const brand = useBrand();
  return <>Welcome back to {brand?.name ?? "Shubhora"}.</>;
}
