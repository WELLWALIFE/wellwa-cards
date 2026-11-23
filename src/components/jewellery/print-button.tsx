"use client";
// "Print / Save as PDF": the browser's print box, where the customer can also choose "Save as PDF".
import { Printer } from "lucide-react";
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
