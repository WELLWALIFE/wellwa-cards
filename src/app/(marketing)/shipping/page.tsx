import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND, LEGAL_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/shipping", { title: `Delivery Policy — ${BRAND}`, description: `How and when ${BRAND} software and services are delivered. Nothing is shipped physically.` });

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping and Delivery Policy" updated="19 September 2026"
      intro={<>{BRAND} sells software and software services only. {LEGAL_NAME} does not ship any physical goods, so there are no shipping charges and no courier delivery.</>}>
      <Section h="Business Suite subscriptions">
        <p>Your account is activated online as soon as the payment is confirmed, usually within a few minutes. You get access at your login address and a payment confirmation with an invoice.</p>
        <p>If you paid and your plan is not active within 24 hours, write to {SUPPORT_EMAIL} or call {SUPPORT_PHONE} with the payment id and we will activate it or refund you.</p>
      </Section>
      <Section h="AI credits and add-ons">
        <p>Credits are added to your account immediately after payment. Items made with credits (posters, banners, videos) are delivered inside your account, usually within minutes.</p>
      </Section>
      <Section h="Custom software projects">
        <p>For custom software, websites and apps, the scope, milestones and delivery dates are written in the proposal you approve. Work is delivered online: access to the software, source files or app store listing as agreed in that proposal.</p>
      </Section>
      <Section h="Service area">
        <p>We serve customers across India. All prices are in Indian rupees and GST is added as shown at checkout.</p>
      </Section>
    </LegalPage>
  );
}
