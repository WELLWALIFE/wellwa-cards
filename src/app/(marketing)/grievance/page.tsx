import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND, GRIEVANCE_OFFICER, LEGAL_NAME, REGISTERED_OFFICE, SUPPORT_EMAIL, SUPPORT_PHONE, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/grievance", { title: `Grievance Redressal — ${BRAND}`, description: `How to raise a complaint with ${BRAND} and the Grievance Officer's contact details.` });

export default function GrievancePage() {
  return (
    <LegalPage title="Grievance Redressal" updated="19 September 2026"
      intro={<>We want every problem solved quickly. If something is wrong with your account, a payment or our service, follow the steps below. This policy follows the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020.</>}>
      <Section h="Step 1: Support">
        <p>Write to <a className="text-brand-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or message us on WhatsApp at {SUPPORT_PHONE}, with your registered mobile or email and, for payments, the payment id. Most issues are solved within 2 working days.</p>
      </Section>
      <Section h="Step 2: Grievance Officer">
        <p>If you are not satisfied with the answer, write to our Grievance Officer:</p>
        <div className="rounded-xl border border-border bg-surface p-4 text-ink">
          <p className="font-semibold">{GRIEVANCE_OFFICER}, Grievance Officer</p>
          <p>{LEGAL_NAME}</p>
          <p>{REGISTERED_OFFICE}</p>
          <p>Email: <a className="text-brand-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> (subject: Grievance)</p>
          <p>Phone: {SUPPORT_PHONE} · Monday to Saturday, 10 am to 6 pm</p>
        </div>
      </Section>
      <Section h="Timelines">
        <p>We acknowledge every grievance within 48 hours and give you a complaint number. We resolve it within one month of receiving it, and tell you the outcome in writing.</p>
      </Section>
      <Section h="If you are still not satisfied">
        <p>You can approach the National Consumer Helpline (1915 or consumerhelpline.gov.in) or the consumer commission that has jurisdiction.</p>
      </Section>
    </LegalPage>
  );
}
