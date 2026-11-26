// The customer's own copy of a mobile-shop bill or estimate (the WhatsApp link): /mb/<id>?t=<token>. No login; the token in the
// link is the key, and a wrong one shows nothing. Cost and profit are stripped before it is drawn. Never indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restAsService } from "@/lib/poster-server";
import { BILL_COLS, publicBill, type BillRow } from "@/lib/mobile";
import { msSetup, shopOf } from "@/lib/mobile-server";
import { Receipt } from "@/components/mobile/receipt";
import { PrintButton } from "@/components/jewellery/print-button";
import { UpiQr } from "@/components/mobile/upi-qr";
import { validUpi } from "@/lib/mobile";

export const metadata: Metadata = { title: "Bill", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CustomerBill({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !t || !/^[0-9a-f]{16,40}$/i.test(t)) notFound();
  const r = await restAsService<BillRow[]>(`ms_bills?id=eq.${id}&token=eq.${t}&select=${BILL_COLS}&limit=1`);
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row) notFound();
  const bill = publicBill(row);
  const setup = await msSetup(row.owner_id);
  const shop = await shopOf(row.owner_id, setup);
  // The customer's copy reads best as a sheet, whatever roll the shop prints on.
  return (
    <main className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-3 flex max-w-[600px] justify-end px-4 print:hidden"><PrintButton /></div>
      {bill.kind === "sale" && bill.status === "open" && bill.balance_paise > 0 && validUpi(setup.upi) && (
        <div className="mx-auto mb-3 max-w-[600px] rounded-xl bg-white px-4 py-4 text-center shadow print:hidden"><p className="mb-2 text-sm font-semibold">Pay the balance by UPI</p><UpiQr upi={setup.upi} name={setup.shopName || shop} paise={bill.balance_paise} note={bill.code} size={170} button /></div>
      )}
      <div className="mx-auto max-w-[600px] px-2 print:px-0"><div className="overflow-hidden rounded-xl bg-white shadow print:rounded-none print:shadow-none"><Receipt bill={bill} setup={{ ...setup, paper: "a5" }} shop={shop} qr={!(bill.kind === "sale" && bill.status === "open" && bill.balance_paise > 0 && validUpi(setup.upi))} /></div></div>
    </main>
  );
}
