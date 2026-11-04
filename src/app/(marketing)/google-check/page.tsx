import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import { GoogleCheck } from "@/components/google-check";

export const metadata: Metadata = pageMeta("/google-check", {
  title: "Free Google Health Check — Shubhora",
  description: "See where your shop stands on Google in one minute: rating, reviews, Maps rank, competitors and website speed. Free.",
});

export default function GoogleCheckPage() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-5 pb-6 pt-16 text-center">
        <span className="mono text-xs uppercase tracking-wide text-faint">Free · 1 minute</span>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">Where does your shop stand on Google?</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">Type your business name. We check your Google profile, rating, reviews, Maps rank, your nearby competitors and your website — and give you a score out of 100.</p>
      </section>
      <section className="mx-auto max-w-3xl px-5 pb-20">
        <GoogleCheck />
        <p className="mt-8 text-center text-xs text-faint">Public Google data only. Maps rank is checked from your business&apos;s own area on a phone; it varies a little by place and device. Not affiliated with Google.</p>
      </section>
    </div>
  );
}
