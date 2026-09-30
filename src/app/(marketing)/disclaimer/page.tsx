import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND, LEGAL_NAME, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/disclaimer", { title: `Disclaimer — ${BRAND}`, description: `Limits of what ${BRAND} software and its AI features promise.` });

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" updated="19 September 2026">
      <Section h="AI-generated content">
        <p>{BRAND} uses AI to write text, make images and videos and reply to messages. AI can make mistakes. Please check important facts, prices and claims before you publish or send them. You are responsible for the content published from your account.</p>
      </Section>
      <Section h="Results">
        <p>Our software helps you market your business and handle enquiries. We do not promise any particular number of customers, leads, sales or income. Examples and figures on this website show how the product works, not guaranteed results.</p>
      </Section>
      <Section h="Other platforms">
        <p>Features that post to WhatsApp, Facebook, Instagram or Google depend on those platforms and their rules. If a platform changes or limits its service, some features may stop or change. We are not responsible for decisions those platforms take about your account.</p>
      </Section>
      <Section h="Information on this website">
        <p>We keep this website accurate and up to date, but features and prices can change. The price shown at checkout and in your invoice is the one that applies. This website is operated by {LEGAL_NAME}.</p>
      </Section>
    </LegalPage>
  );
}
