import type { Metadata } from "next";
import { BRAND, LEGAL_NAME, SUPPORT_EMAIL, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/terms", { title: `Terms of Service — ${BRAND}`, description: `The terms under which ${BRAND} software is provided.` });
const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="text-lg font-semibold">{h}</h2><div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div></section>
);

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-faint">Last updated 27 September 2026</p>
      <p className="mt-6 text-sm leading-relaxed text-muted">{BRAND} is a software service operated by {LEGAL_NAME}. By creating an account or paying for a plan you agree to these terms. Please read them before you subscribe.</p>

      <S h="1. What you get">
        <p>A subscription gives one business the use of the {BRAND} software for one month at a time: a digital card and website, daily posters, social posting, the WhatsApp assistant and CRM, and the AI studio, as described on the plan you chose.</p>
        <p>Plans include a set number of AI credits each month. Those credits are for the month they are issued and do not carry forward. Credit packs you buy separately do not expire.</p>
      </S>
      <S h="2. Payment and renewal">
        <p>Plans are billed monthly in advance in Indian rupees. Prices shown include GST at the rate in force.</p>
        <p>Growth is taken with an auto-debit mandate (UPI Autopay or card) that you approve at checkout: it renews every month on its own, and your bank or UPI app tells you before each debit. You can stop it at any time from your UPI app or bank, or by writing to us; the plan then runs to the end of the month you paid for. If a renewal is not paid, your account keeps working for 7 more days, then automatic posting, the WhatsApp assistant and new AI creation stop. Your data, card and website stay available.</p>
      </S>
      <S h="3. Your content and your customers">
        <p>You own the photos, text, products and customer data you put into {BRAND}. You give us permission to store and process them only to run the service for you.</p>
        <p>You are responsible for what you publish and for the claims you make. You must not use the software for unlawful content, spam, or messages to people who did not agree to hear from you. WhatsApp, Facebook, Instagram and Google have their own rules and your account on those platforms is governed by them.</p>
      </S>
      <S h="4. AI-generated material">
        <p>Posters, videos, voice-overs and replies are produced by AI. Mistakes are possible. You are asked to review AI material before it is published, and you remain responsible for what goes out under your name.</p>
        <p>Do not use the AI to make medical, financial or income claims, or to copy someone else&apos;s brand.</p>
      </S>
      <S h="5. Availability">
        <p>We work to keep the service running but do not promise uninterrupted availability. Parts of the service depend on outside providers such as WhatsApp, Meta, Google and payment gateways, and can be affected when those providers change their rules or have an outage.</p>
      </S>
      <S h="6. Ending the service">
        <p>You may stop using {BRAND} at any time; the plan simply runs to the end of the month you paid for. We may suspend an account that breaks these terms or the law, and will tell you why.</p>
      </S>
      <S h="7. Liability">
        <p>Our total liability for any claim is limited to the amount you paid us in the three months before the claim. We are not liable for lost profit or lost business.</p>
      </S>
      <S h="8. Law and contact">
        <p>These terms are governed by Indian law and the courts where {LEGAL_NAME} is registered. Questions: {SUPPORT_EMAIL}.</p>
      </S>
    </div>
  );
}
