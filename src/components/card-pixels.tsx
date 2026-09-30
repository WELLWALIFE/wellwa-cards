"use client";

// Loads the card owner's Facebook Pixel / Google Ads / GA4 tags.
//
// Only what's configured is loaded — a card with no ad ids ships no third-party
// script at all, which keeps the common case fast and private. A white-label
// partner's ids load alongside the member's own, so the partner sees the whole
// network in one ad account while the member still gets their own data.

import { useEffect } from "react";
import Script from "next/script";

export type Tracking = {
  fbPixelId?: string | null;
  ga4Id?: string | null;
  googleAdsId?: string | null;
  adsLabel?: string | null;
  brandFbPixelId?: string | null;
  brandGa4Id?: string | null;
  brandGoogleAdsId?: string | null;
  brandAdsLabel?: string | null;
};

/** Ids are printed into a script tag, so only allow the shapes the vendors use. */
const safe = (v: string | null | undefined, re: RegExp) =>
  v && re.test(v.trim()) ? v.trim() : null;

const FB = /^[0-9]{8,20}$/;                 // 1234567890123456
const GA4 = /^G-[A-Z0-9]{6,14}$/i;          // G-XXXXXXX
const ADS = /^AW-[0-9]{6,14}$/i;            // AW-123456789
const LABEL = /^[A-Za-z0-9_-]{6,30}$/;      // abcDEF12ghIJK

export function CardPixels(t: Tracking) {
  const fb = safe(t.fbPixelId, FB);
  const brandFb = safe(t.brandFbPixelId, FB);
  const ga4 = safe(t.ga4Id, GA4);
  const brandGa4 = safe(t.brandGa4Id, GA4);
  const ads = safe(t.googleAdsId, ADS);
  const brandAds = safe(t.brandGoogleAdsId, ADS);
  const label = safe(t.adsLabel, LABEL) ?? safe(t.brandAdsLabel, LABEL);

  const pixels = [fb, brandFb].filter(Boolean) as string[];
  const gtags = [ga4, brandGa4, ads, brandAds].filter(Boolean) as string[];

  // track.ts reads these when firing a Google Ads conversion.
  useEffect(() => {
    const w = window as Window & { __neAdsId?: string; __neAdsLabel?: string };
    if (ads ?? brandAds) w.__neAdsId = (ads ?? brandAds)!;
    if (label) w.__neAdsLabel = label;
  }, [ads, brandAds, label]);

  if (!pixels.length && !gtags.length) return null;

  return (
    <>
      {pixels.length > 0 && (
        <Script id="ne-fb-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          ${pixels.map((p) => `fbq('init','${p}');`).join("")}
        `}</Script>
      )}

      {gtags.length > 0 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtags[0]}`} strategy="afterInteractive" />
          <Script id="ne-gtag" strategy="afterInteractive">{`
            window.dataLayer=window.dataLayer||[];
            function gtag(){dataLayer.push(arguments);}
            window.gtag=gtag;
            gtag('js', new Date());
            ${gtags.map((g) => `gtag('config','${g}');`).join("")}
          `}</Script>
        </>
      )}
    </>
  );
}

/** Shown once when trackers are active, so visitors aren't tracked silently. */
export function PixelNotice({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <p className="mt-2 text-center text-[10px] text-faint">
      This card uses cookies to measure ad performance.
    </p>
  );
}
