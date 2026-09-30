// Public "how to delete your data" page — the URL Meta and Google reviewers ask for, and where Meta's data-deletion
// callback sends users to check their request (?code=SH-…). Plain words; the same facts as /privacy#delete.
import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND, LEGAL_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, pageMeta } from "@/lib/site-brand";
import { restAsService } from "@/lib/poster-server";

export const metadata: Metadata = pageMeta("/data-deletion", { title: `Delete your data — ${BRAND}`, description: `How to disconnect Facebook, Instagram, Google or WhatsApp from ${BRAND}, and how to delete your whole account and data.` });
export const dynamic = "force-dynamic";

type Req = { code: string; provider: string; removed: number; status: string; created_at: string };

async function lookup(code: string): Promise<Req | null> {
  if (!/^SH-[A-Z0-9]{4,12}-[A-F0-9]{6}$/.test(code)) return null;
  const r = await restAsService<Req[]>(`data_deletion_requests?code=eq.${encodeURIComponent(code)}&select=code,provider,removed,status,created_at`).catch(() => null);
  return r?.ok && Array.isArray(r.data) ? r.data[0] ?? null : null;
}

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  const req = code ? await lookup(code.trim().toUpperCase()) : null;
  const link = "text-brand-ink underline";
  return (
    <LegalPage title="Delete your data" updated="1 October 2026"
      intro={<>Your data belongs to you. Here is how to remove a connected account, and how to delete everything you have with {BRAND} ({LEGAL_NAME}).</>}>
      {code && (
        <Section h="Your deletion request">
          {req ? (
            <div className="rounded-xl border border-border bg-surface p-4 text-ink">
              <p className="font-semibold">Confirmation code: {req.code}</p>
              <p>Status: <b>{req.status === "done" ? "Completed" : req.status}</b> · requested {new Date(req.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST</p>
              <p>{req.removed > 0 ? `${req.removed} connected ${req.removed === 1 ? "account was" : "accounts were"} removed, with their access tokens, post history and ad records.` : "No connected account was linked to that login, so there was nothing to delete."}</p>
            </div>
          ) : (
            <p>We could not find a request with the code <b>{code}</b>. Check the code, or write to <a className={link} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
          )}
        </Section>
      )}
      <Section h="Facebook and Instagram">
        <p><b>From the app:</b> Connections → tap <b>Disconnect</b> under the Page or Instagram account. We delete the stored access token immediately and stop posting or reading anything for it.</p>
        <p><b>From Facebook:</b> Facebook → Settings &amp; privacy → Settings → Apps and websites → {BRAND} → Remove. Meta tells us at once; every token from that login is cancelled. Choosing <i>Delete data</i> there also deletes the connected accounts, their post history and ad records on our side, and Facebook shows you a confirmation code you can check on this page.</p>
      </Section>
      <Section h="Google Business Profile">
        <p><b>From the app:</b> Connections → Google → <b>Disconnect</b>. The refresh token is deleted and we no longer read reviews or post for that profile.</p>
        <p><b>From Google:</b> myaccount.google.com → Security → Third-party apps with account access → {BRAND} → Remove access.</p>
      </Section>
      <Section h="WhatsApp">
        <p>Connections → WhatsApp → <b>Disconnect</b>, or unlink the device from WhatsApp → Linked devices. Leads already saved stay in your account until you delete them or your account.</p>
      </Section>
      <Section h="Your whole account">
        <p>Email <a className={link} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your registered email, or message {SUPPORT_PHONE} from your registered mobile, with the subject <b>Delete my account</b>. We delete the account, profiles, posters, videos, leads, connected accounts and uploaded files within 7 days and confirm by reply. Invoices are kept for the period Indian tax law requires.</p>
      </Section>
      <Section h="Questions">
        <p>See the <a className={link} href="/privacy#connections">privacy policy</a> for what each connection is used for, or write to <a className={link} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </Section>
    </LegalPage>
  );
}
