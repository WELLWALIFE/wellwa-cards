// A gold scheme member's own passbook (the WhatsApp link): /js/<id>?t=<token>. No login; a wrong token shows nothing. Never indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restAsService } from "@/lib/poster-server";
import { istDay, jwSetup } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { SCHEME_COLS, schemeState, type SchemeRow } from "@/lib/jewellery-finance";
import { SchemePassbook } from "@/components/jewellery/finance-docs";
import { PrintButton } from "@/components/jewellery/print-button";

export const metadata: Metadata = { title: "Gold scheme passbook", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MemberPassbook({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !t || !/^[0-9a-f]{16,40}$/i.test(t)) notFound();
  const r = await restAsService<SchemeRow[]>(`jw_schemes?id=eq.${id}&token=eq.${t}&select=${SCHEME_COLS}&limit=1`);
  const s = Array.isArray(r.data) ? r.data[0] : null;
  if (!s) notFound();
  const [setup, shop] = await Promise.all([jwSetup(s.owner_id), shopName(s.owner_id)]);
  return (
    <main className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-3 flex max-w-[800px] justify-end px-4 print:hidden"><PrintButton /></div>
      <div className="mx-auto max-w-[800px] px-2 print:px-0"><div className="rounded-xl shadow print:rounded-none print:shadow-none"><SchemePassbook s={s} st={schemeState(s, istDay())} setup={setup} shop={shop} /></div></div>
    </main>
  );
}
