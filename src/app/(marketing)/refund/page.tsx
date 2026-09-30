import type { Metadata } from "next";
import { BRAND, LEGAL_NAME, SUPPORT_EMAIL, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/refund", { title: `Refund and Cancellation — ${BRAND}`, description: `How cancellations and refunds work for ${BRAND} subscriptions and credits.` });
const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="text-lg font-semibold">{h}</h2><div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div></section>
);

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Refund and Cancellation</h1>
      <p className="mt-2 text-sm text-faint">Last updated 27 September 2026</p>
      <p className="mt-6 text-sm leading-relaxed text-muted">{BRAND} is a monthly software subscription operated by {LEGAL_NAME}. There is nothing to ship; access is given immediately after payment.</p>

      <S h="Try before you pay">
        <p>Every account starts on the free plan: your digital V-Card, free for its first year. We ask you to use it to decide before you pay, because that is a fairer test than a refund after the fact.</p>
        <p className="text-xs">After the first year the V-Card is ₹1,499 a year (included in Growth). If it is not renewed, the card keeps working for 7 more days and then pauses; nothing is deleted, and renewing brings it back at once.</p>
      </S>
      <S h="Cancelling">
        <p>Growth renews every month by autopay (a UPI Autopay or card mandate you approve at checkout). You can stop it at any time from your UPI app or bank, or by writing to {SUPPORT_EMAIL}. Stopping it cancels the next debit; your plan keeps working until the end of the month you already paid for, and nothing is deleted.</p>
      </S>
      <S h="Refunds">
        <p>If you were charged twice for the same month, or charged after you cancelled, we refund it in full.</p>
        <p>If the service was unusable for more than three days in a month because of a fault on our side, write to us and we will refund that month.</p>
        <p>We do not refund a month that has been used, and we do not refund AI credits that have already been spent, because the AI cost is paid to the provider at the moment you generate a video or photo.</p>
        <p>Unused credit packs can be refunded within 7 days of purchase if none of those credits have been used.</p>
      </S>
      <S h="When a job fails">
        <p>If an AI video or photo fails to render, its credits are returned to your account automatically. You do not need to ask.</p>
      </S>
      <S h="How to ask">
        <p>Write to {SUPPORT_EMAIL} from the email on the account, with the payment id. We reply within 2 working days. Approved refunds reach the original payment method within 5 to 7 working days.</p>
      </S>
    </div>
  );
}
