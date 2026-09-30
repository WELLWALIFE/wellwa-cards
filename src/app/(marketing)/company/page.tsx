import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND, CIN, GRIEVANCE_OFFICER, GSTIN, LEGAL_NAME, REGISTERED_OFFICE, SUPPORT_EMAIL, SUPPORT_PHONE, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/company", { title: `Company Information — ${BRAND}`, description: `Legal name, registered office and contact details of the company behind ${BRAND}.` });

export default function CompanyPage() {
  const rows: [string, string][] = [
    ["Brand", BRAND],
    ["Legal name", LEGAL_NAME],
    ["Business", "Software development and software-as-a-service (SaaS)"],
    ["Registered office", REGISTERED_OFFICE],
    ...(CIN ? [["CIN", CIN] as [string, string]] : []),
    ...(GSTIN ? [["GSTIN", GSTIN] as [string, string]] : []),
    ["Email", SUPPORT_EMAIL],
    ["Phone and WhatsApp", SUPPORT_PHONE],
    ["Grievance Officer", GRIEVANCE_OFFICER],
  ];
  return (
    <LegalPage title="Company Information" updated="19 September 2026"
      intro={<>{BRAND} is an Indian software company. It builds the {BRAND} Business Suite and custom AI, automation, CRM and app solutions. {BRAND} is a brand of {LEGAL_NAME}.</>}>
      <Section h="Details">
        <dl className="overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map(([k, v]) => (
            <div key={k} className="grid sm:grid-cols-[200px_1fr] gap-1 border-b border-border px-4 py-3 last:border-0">
              <dt className="text-faint">{k}</dt><dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section h="Payments">
        <p>Online payments are processed by a licensed payment gateway. We never see or store your card or bank login details. Every payment gets an invoice from {LEGAL_NAME}.</p>
      </Section>
    </LegalPage>
  );
}
