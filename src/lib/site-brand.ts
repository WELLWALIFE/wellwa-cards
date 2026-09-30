// The company's own identity (not the white-label partner brands in lib/brand.ts).
// The product runs as "Shubhora"; invoices and legal notices carry the registered company name.
export const BRAND = "Shubhora";
export const LEGAL_NAME = "Wellwa Life India Pvt Ltd";
export const SUITE = "Shubhora Business Suite";
export const TAGLINE = "Software that runs your business online";
// One place for every public contact detail. Change here (or by env) and the whole site follows.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@shubhora.com";
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+91 76656 69888";
export const SUPPORT_WHATSAPP = SUPPORT_PHONE.replace(/\D/g, "");               // digits for wa.me links
export const COMPANY_CITY = "Gurgaon, Haryana, India";
export const REGISTERED_OFFICE = "704, 7th Floor, Palm Court, Gurgaon, Haryana 122007, India";
export const GRIEVANCE_OFFICER = "Mr. R. Kumar";
// Shown on the Company information page and invoices once available. Leave empty until issued.
export const GSTIN = process.env.NEXT_PUBLIC_GSTIN || "";
export const CIN = process.env.NEXT_PUBLIC_CIN || "";
export const waLink = (text: string) => `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;

/** The share picture of every Shubhora page — the big image in a WhatsApp, Facebook, LinkedIn or X preview.
 *  A file name of its own, so no app or crawler can show a cached copy of the old NeuralEdge picture;
 *  /og.jpg and /og.png carry the same Shubhora picture for links shared before (owner's call, 27 Sep 2026). */
export const OG_IMAGE = { url: "/og-shubhora.jpg", width: 1200, height: 675, alt: `${BRAND} — your business online, on one link` };

/** Page metadata with its own canonical address and share preview (WhatsApp, LinkedIn, X). */
export function pageMeta(path: string, m: { title: string; description: string }) {
  return {
    ...m,
    alternates: { canonical: path },
    openGraph: { title: m.title, description: m.description, url: path, siteName: BRAND, type: "website" as const, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image" as const, title: m.title, description: m.description, images: [OG_IMAGE.url] },
  };
}
