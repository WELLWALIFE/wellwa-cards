"use client";
import { useParams } from "next/navigation";
import { FranchiseDetail } from "@/components/admin/franchise-detail";

export default function FranchisePage() {
  const { id } = useParams<{ id: string }>();
  return <FranchiseDetail id={id} />;
}
