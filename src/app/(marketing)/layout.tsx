import { LEGAL_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/site-brand";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { AnnouncementBar } from "@/components/site-content";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Shubhora's own business data — only on Shubhora's pages, never on a customer's card or domain. */}
      <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "Shubhora",
                  url: process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com",
                  logo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com"}/icon.png`,
                  description: "AI software, business automation, CRM systems, WhatsApp automation, app development and social media management.",
                  email: SUPPORT_EMAIL,
                  telephone: SUPPORT_PHONE,
                  legalName: LEGAL_NAME,
                  areaServed: "IN",
                },
                {
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: "Shubhora",
                  url: process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com",
                },
              ]),
            }}
          />
      <AnnouncementBar />
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
