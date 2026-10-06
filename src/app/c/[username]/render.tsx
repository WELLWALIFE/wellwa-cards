// The public card / website, shared by /c/<user> (home) and /c/<user>/<page> (every other page).
// Each page has its own address, title, description and structured data, so search engines index all of it.
// Canonical address: the owner's own domain when connected, else the white-label address, else Shubhora.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCardByUsername } from "@/lib/sample-data";
import { fetchCloudCard, countCardView, getPublicSupabase, fetchCardExpired, fetchCardPaused, fetchCardTracking, fetchCardDomain, fetchCardOwnerUsername } from "@/lib/supabase/public";
import { CardPaused } from "@/components/card-paused";
import { CardPixels, PixelNotice } from "@/components/card-pixels";
import { CardAppBar } from "@/components/card-app-bar";
import { qrDataUrl } from "@/lib/qr";
import { CardView } from "@/components/card-view";
import { SiteView } from "@/components/site-view";
import { siteDesign } from "@/lib/site-style";
import { lookOf } from "@/lib/looks";
import { brandForHost } from "@/lib/brand";
import { PLATFORM_HOSTS, SITE_URL } from "@/lib/site-url";
import { seoDescription, seoJsonLd, seoKeywords, seoTitle } from "@/lib/seo";
import type { Card, CardPage } from "@/lib/types";
import { isShubhoraCard } from "../../../../bridge/shubhora-kb.mjs";
import { recentUpdates } from "@/lib/site-server";
import { findProduct, isProductSlug, productPageOf } from "@/lib/product-page";
import { hasShubhoraPage, isShubhoraSellerCard, shubhoraPage, withoutShubhoraLeaks } from "@/lib/shubhora-page";

// With a real database connected, the cloud is the only source of truth — a
// card that was deleted must 404, not silently fall back to built-in demo data.
async function loadCard(username: string) {
  const cloud = await fetchCloudCard(username);
  if (cloud) return cloud;
  return getPublicSupabase() ? null : getCardByUsername(username);
}

const pageOf = (card: Card, slug?: string | null): CardPage | null =>
  (slug ? card.pages.find((p) => p.slug === slug) : null) ?? null;

/** Where this card lives: the canonical origin+path of its home, and the base for page links on this host. */
async function addresses(card: Card) {
  const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];
  const onPlatform = !host || PLATFORM_HOSTS.has(host) || host.startsWith("localhost") || host === "127.0.0.1";
  const [brand, own] = await Promise.all([brandForHost(host), fetchCardDomain(card.username)]);
  const home = own ? `https://${own}` : brand ? `https://${card.username}.${brand.baseDomain}` : `${SITE_URL}/c/${card.username}`;
  // Links between pages stay on the host the visitor is on.
  const linkBase = onPlatform ? `/c/${card.username}` : "";
  return { brand, home, linkBase };
}
const urlFor = (home: string, card: Card, page: CardPage | null) => (page && page !== card.pages[0] ? `${home}/${page.slug}` : home);

export async function cardMetadata(username: string, slug?: string | null): Promise<Metadata> {
  const card = await loadCard(username);
  if (!card) return { title: "Card not found" };
  // Paused (its year ended and was not renewed): kept out of search results until it is renewed.
  if (await fetchCardPaused(card.username)) {
    return { title: { absolute: `${card.lead === "business" && card.company ? card.company : card.name} — card paused` }, robots: { index: false, follow: false } };
  }
  // One product at its own address: its own title, its own description, its own picture in a share preview.
  const product = findProduct(card, slug);
  const page = product ? productPageOf(card, product) : pageOf(card, slug);
  const { brand, home } = await addresses(card);
  const updates = slug === "updates" && !page;
  const business = (card.lead === "business" && card.company ? card.company : card.name).trim();
  // "Kaju Katli — ₹325 | Haldiram's, Dharuhera": the thing, the price, who sells it and where. The city is
  // dropped before the price, and the price before the name, when there is no room for all of it.
  const seller = [business, card.seo?.city].filter(Boolean).join(", ");
  const productTitle = () => {
    const name = product!.item.name.trim(), p = product!.item.price?.trim();
    for (const t of [`${name}${p ? ` — ${p}` : ""} | ${seller}`, `${name}${p ? ` — ${p}` : ""} | ${business}`, `${name} | ${business}`]) if (t.length <= 70) return t;
    return `${name} | ${business}`.slice(0, 70);
  };
  const title = product ? productTitle() : updates ? `Updates — ${business}` : seoTitle(card, page);
  const description = product
    ? [product.item.desc, product.item.price && `Price ${product.item.price}.`, `Order from ${business}${card.seo?.city ? `, ${card.seo.city}` : ""} on WhatsApp.`].filter(Boolean).join(" ").slice(0, 155)
    : seoDescription(card, page);
  const url = product ? `${home}/${product.slug}` : urlFor(home, card, page);
  const productPic = product?.item.images?.[0] || product?.item.imageUrl;
  const ogImage = productPic && /^https?:\/\//.test(productPic)
    ? productPic
    : `${home.replace(/\/c\/[^/]+$/, "")}/c/${card.username}/opengraph-image`;
  return {
    title: { absolute: title },
    description,
    keywords: seoKeywords(card),
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: seoTitle(card).split(" – ")[0] || brand?.name || "Shubhora", type: "website", locale: "en_IN",
      images: [{ url: ogImage, width: 1200, height: 630, alt: card.company || card.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    // Free plan: live, shareable, but not on Google (owner's call, 3 Oct 2026: Google is Premium).
    robots: { index: card.active !== false && (!slug || !!page || updates) && !(await fetchCardExpired(card.username)), follow: true, "max-image-preview": "large", "max-snippet": -1 },
    // The business's own logo (or photo) as the tab icon of its card and website.
    ...((card.site?.logoUrl || card.avatarUrl || "").startsWith("https://") ? { icons: { icon: card.site?.logoUrl || card.avatarUrl! } } : {}),
    ...(card.seo?.googleVerify ? { verification: { google: card.seo.googleVerify.replace(/^.*content="([^"]+)".*$/, "$1").trim() } } : {}),
  };
}

export async function CardPageView({ username, slug, viewParam }: { username: string; slug?: string | null; viewParam?: string }) {
  const stored = await loadCard(username);
  if (!stored) notFound();
  // The Shubhora strip's "Know more" opens the owner's Shubhora page: a "Both" card carries it already; every other
  // card gets it here, for this request only, hidden from the tab row (owner's call, 2 Oct 2026).
  const shPage = hasShubhoraPage(stored) ? null : shubhoraPage({ visible: false });
  // Every card that is the owner's own business ("both" included) shows Shubhora on the bottom strip only; the
  // cleanup takes any Shubhora material off its visible pages (owner's call, 2 Oct 2026). A partner's card whose
  // whole business IS Shubhora is left as it is.
  const withPage: Card = shPage ? { ...stored, pages: [...stored.pages, shPage] } : stored;
  const seller = isShubhoraSellerCard(stored);
  const card: Card = seller ? withPage : withoutShubhoraLeaks(withPage);
  // The V-Card's year ended more than 7 days ago with no renewal and no paid plan: "Card renew karein" instead of the
  // card, on every page and view of it (owner's call, 27 Sep 2026). Renewing brings everything back at once.
  if (await fetchCardPaused(card.username)) {
    const { brand } = await addresses(card);
    const joinHandle = brand ? null : await fetchCardOwnerUsername(card.username);
    const business = card.lead === "business" && !!card.company;
    return (
      <CardPaused
        name={business ? card.company : card.name}
        subtitle={business ? card.jobTitle : [card.jobTitle, card.company].filter(Boolean).join(" · ")}
        avatarUrl={card.avatarUrl || undefined} square={card.avatarShape === "square"}
        renewUrl={`${SITE_URL}/poster/plan?renew=card`}
        joinHref={joinHandle ? `/signup?by=${encodeURIComponent(joinHandle)}` : null}
      />
    );
  }
  const product = findProduct(card, slug);
  const page = product ? productPageOf(card, product) : pageOf(card, slug);

  await countCardView(username);

  const hdrs = await headers();
  const { brand, home, linkBase } = await addresses(card);
  // Website mode: one link, two looks — phones get the card, desktops the full
  // website; ?view=site|card forces either (used by previews and the footer link).
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(hdrs.get("user-agent") ?? "");
  // Free plan (or lapsed): the card stays online (its first year free, then ₹1,499 a year — see fetchCardPaused above);
  // the full website and the AI chat need the plan.
  const expired = await fetchCardExpired(card.username);
  // Free or paid, one link, two looks: phones get the card, computers the website (owner's call, 3 Oct 2026: the
  // free website is a real website — it wears a FREE strip on top and bottom, Premium wears none).
  // The Story look is built for phones (docs/website-looks-v2.md §3.3; owner's call, 5 Oct 2026: "phone par story
  // website khule"): a phone gets the website itself then, not the card. ?view=card still opens the card.
  const story = card.site?.style?.blueprint === "story";
  const view = viewParam === "card" ? "card" : viewParam === "site" ? "site" : card.site?.enabled && (!mobile || story) ? "site" : "card";
  const freeSite = view === "site" && expired && !brand;
  const tracking = await fetchCardTracking(card.username);
  const joinHandle = brand ? null : await fetchCardOwnerUsername(card.username);
  const tracked = Boolean(tracking && Object.values(tracking).some(Boolean));
  // "Aapko ye V-Card kaisa laga?" strip → the same joining link: Shubhora partner cards only (owner's call, 27 Sep 2026).
  const nudge = !!joinHandle && isShubhoraCard(card);
  // The Shubhora strip: on every free card, and on a paid card whose owner also sells Shubhora ("Both" — the card
  // carries the Shubhora page). Never on a white-label partner's card.
  // A "Both" card always carries it, with the owner's own handle when the partner link cannot be looked up.
  const both = hasShubhoraPage(stored) && !seller;
  const by = joinHandle ?? (both ? card.username : null);
  const shubhora = by && !brand && (expired || both)
    ? { joinHref: `/signup?by=${encodeURIComponent(by)}`, moreHref: `${linkBase}/shubhora`, free: expired }
    : null;

  const shareUrl = home;
  const qr = await qrDataUrl(shareUrl, card.themeColor);
  // The AI assistant's instructions stay on the server (the chat route reads them itself).
  // A product's page is added to the card for this request only, and kept out of the menu — the visitor came
  // to it from a product card or from search, and the rest of the site stays where it was.
  const pub = product
    ? { ...card, botPersona: undefined, botKnowledge: undefined, pages: [...card.pages, page!] }
    : { ...card, botPersona: undefined, botKnowledge: undefined };
  const ld = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seoJsonLd(card, { url: product ? `${home}/${product.slug}` : urlFor(home, card, page), homeUrl: home, page, product: product?.item })).replace(/</g, "\\u003c") }} />;
  // "updates" is the website's own page (recent posters), not one of the card's pages.
  const initialPage = page?.slug ?? (slug === "updates" ? "updates" : undefined);
  // A product page only exists on the website; a phone visitor is shown the products page of the card.
  if (product && view !== "site") return <CardPageView username={username} slug={product.page} viewParam={viewParam} />;

  if (view === "site") {
    // The two first-paint fonts (docs/premium-look.md §2.1): the display face and the text file of the site's set.
    // React hoists these <link>s into <head>. The preview iframe renders from localStorage and keeps its in-body faces.
    const preload = siteDesign(card, lookOf(card.template)).fonts.preload;
    return (
      <>
        {preload.map((href) => <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />)}
        {ld}
        <CardAppBar />
        {tracking && <CardPixels {...tracking} />}
        {freeSite && (
          <a href={joinHandle ? `/signup?by=${encodeURIComponent(joinHandle)}` : "/signup"} className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[#12144a] px-4 py-1.5 text-center text-[12px] text-white">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-[#ffd54a]">FREE</span>
            <span>Website + digital card by <b>Shubhora</b> · make yours free →</span>
          </a>
        )}
        {freeSite && story && <style>{`.site{--site-top:30px}`}</style>}
        <SiteView card={pub} qr={qr} brand={brand} shareUrl={shareUrl} free={expired} initialPage={initialPage} linkBase={linkBase} joinHandle={joinHandle} nudge={nudge} shubhora={shubhora} updates={card.site?.hidden?.includes("updates") ? [] : await recentUpdates(card.username)} unlisted={product ? [page!.slug] : []} />
        <PixelNotice active={tracked} />
      </>
    );
  }

  return (
    // Mobile: full-bleed so the banner starts at the very top edge; the
    // comfortable frame returns from the sm breakpoint up.
    <div className="flex-1 pt-0 px-0 pb-8 sm:pt-8 sm:px-4" style={{ background: "var(--bg)" }}>
      {ld}
      <CardAppBar />
      {tracking && <CardPixels {...tracking} />}
      <CardView card={pub} qr={qr} brand={brand} expired={expired} shareUrl={shareUrl} initialPage={initialPage} linkBase={linkBase} joinHandle={joinHandle} nudge={nudge} shubhora={shubhora} />
      <PixelNotice active={tracked} />
    </div>
  );
}
