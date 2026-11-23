// The customer's own copy of an order or repair receipt (the WhatsApp link): /jo/<id>?t=<token>. No login; the token in the link is
// the key, and a wrong one shows nothing. Never indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restAsService } from "@/lib/poster-server";
import { jwSetup } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { ORDER_COLS, type OrderRow } from "@/lib/jewellery-orders";
import { OrderReceipt } from "@/components/jewellery/order-receipt";
import { PrintButton } from "@/components/jewellery/print-button";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CustomerOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !t || !/^[0-9a-f]{16,40}$/i.test(t)) notFound();
  const r = await restAsService<OrderRow[]>(`jw_orders?id=eq.${id}&token=eq.${t}&select=${ORDER_COLS}&limit=1`);
  const order = Array.isArray(r.data) ? r.data[0] : null;
  if (!order) notFound();
  const [setup, shop] = await Promise.all([jwSetup(order.owner_id), shopName(order.owner_id)]);
  return (
    <main className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-3 flex max-w-[800px] justify-end px-4 print:hidden"><PrintButton /></div>
      <div className="mx-auto max-w-[800px] px-2 print:px-0"><div className="rounded-xl shadow print:rounded-none print:shadow-none"><OrderReceipt order={order} setup={setup} shop={shop} /></div></div>
    </main>
  );
}
