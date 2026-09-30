import { SITE_HOST } from "@/lib/site-url";
import type { Metadata } from "next";
import { COMPANY_CITY, LEGAL_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/privacy", {
  title: "Privacy Policy — Shubhora",
  description: "What we collect, why, and how to delete it. Applies to shubhora.com, Shubhora digital cards and the Shubhora app.",
});

// Play Store and app-store reviewers need this page to exist and to say the
// plain truth. Keep it readable; no legalese the user would not sign off on.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 text-[15px] leading-relaxed text-ink [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-brand-ink [&_a]:underline [&_em]:text-muted">
      <h1>Privacy Policy</h1>
      <p><em>Last updated: 1 October 2026 · Applies to {SITE_HOST}, Shubhora digital cards, and the Shubhora app. Operated by {LEGAL_NAME}, {COMPANY_CITY}.</em></p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, mobile number and/or email, password (stored hashed by our auth provider, Supabase).</li>
        <li><strong>Profile you create:</strong> display name, tagline, phone number, city, photo and logo you upload — these appear on the posters and cards you generate.</li>
        <li><strong>Content:</strong> posters, cards and files you create or upload.</li>
        <li><strong>Usage:</strong> which posters you generated or shared, plan status, device type, and basic logs needed to keep the service running.</li>
        <li><strong>WhatsApp (Business plan only):</strong> if you connect your WhatsApp, messages between you and your customers pass through our assistant so it can reply on your behalf. We store the latest message per contact as a lead for you; we do not sell or share these.</li>
      </ul>

      <h2>What we do with it</h2>
      <ul>
        <li>Generate your posters and cards, and let you share them.</li>
        <li>Send you a daily notification that your poster is ready (you can turn this off in your device settings).</li>
        <li>Improve the service and prevent abuse.</li>
      </ul>
      <p>Artwork is generated with Google Gemini. Only the day&rsquo;s theme is sent to the AI model — <strong>never your name, photo, phone number or contacts.</strong> Your personal details are added on our own server.</p>

      <h2>What we never do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not read your device contacts or gallery beyond the photo you pick.</li>
        <li>We do not post anywhere you have not connected. Sharing to WhatsApp happens through your own share sheet; Facebook, Instagram and Google posts go out only after you connect that account and tap <em>Post</em> or switch on daily auto-post for it — and you can turn either off any time.</li>
      </ul>

      <h2>Where it lives</h2>
      <p>Data is stored with Supabase (database and file storage) and on our server hosted with GoDaddy. Payments, when enabled, are processed by Razorpay; we never see your card details.</p>

      <h2 id="connections">Connected accounts (Facebook, Instagram, Google, WhatsApp)</h2>
      <p>You connect these yourself, from Connections in the app, and each one asks you to allow it first. We use only what that feature needs:</p>
      <ul>
        <li><strong>Facebook Page / Instagram:</strong> to publish the posters and videos you make, read comments and reviews on them, and — only when you start an ad in the app — create and manage ads on your own ad account. The ad money goes to Meta from your account, never through us. We never see your password, friends, followers or personal messages.</li>
        <li><strong>Google Business Profile:</strong> to post updates, read and answer reviews and show you insights. Nothing from Gmail, Drive or other Google services.</li>
        <li><strong>WhatsApp:</strong> customer messages that reach your linked number pass through our assistant so it can reply for you, and each customer is saved as a lead in your account. Your customers&apos; data belongs to you; we do not sell it or use it for anything else.</li>
      </ul>
      <p><strong>Disconnecting and deleting this data:</strong> open <em>Connections</em> in the app and tap <em>Disconnect</em> under any account — we delete the stored access token at once and stop using that account. Facebook users may also remove Shubhora under <em>Facebook → Settings → Apps and websites</em>, which cancels our access on Meta&apos;s side immediately. To delete everything (account, profiles, leads, posters), see the next section.</p>

      <h2 id="delete">Your choices</h2>
      <ul>
        <li>Edit or delete any profile from the app at any time — its posters are deleted with it.</li>
        <li>To delete your whole account and data, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your registered email/mobile or message {SUPPORT_PHONE}. We complete deletion within 7 days. Step-by-step instructions, including removing a single connected account, are on <a href="/data-deletion">shubhora.com/data-deletion</a>.</li>
        <li>Children: the Student/Kids profile shows only greetings and never a phone number. The app is meant to be set up by a parent.</li>
      </ul>

      <h2>Contact</h2>
      <p>{LEGAL_NAME} · {COMPANY_CITY} · <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · {SUPPORT_PHONE}</p>
    </div>
  );
}
