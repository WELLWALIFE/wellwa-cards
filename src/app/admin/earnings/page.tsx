"use client";
// My earnings (a franchise login): the franchise's own page — users, account, payouts, bank details.
import { useAdminMe } from "@/lib/admin-client";
import { FranchiseDetail } from "@/components/admin/franchise-detail";
import { Empty, Spinner } from "@/components/admin/ui";

export default function EarningsPage() {
  const { me, status } = useAdminMe();
  if (status === "loading") return <Spinner />;
  if (!me?.franchise) return <Empty title="Not a franchise login" sub="This page shows a franchise its own users and earnings." />;
  return <FranchiseDetail id={me.franchise.id} mine />;
}
