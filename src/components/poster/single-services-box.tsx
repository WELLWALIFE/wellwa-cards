"use client";
// "Take one service alone" on My plan (owner, 28 Nov 2026: "koi akela lena chahe le sakta hai, aur suggestion denge ki Growth Plan
// me ye sab itne me milega"). Each single service by the month at its list price, a running one shows its date, and one line says
// what the plan gives for less. Buying makes the account's own request (/api/pay/mine op "service") and opens its pay page.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { api } from "@/lib/poster-client";
import { SAAS_PLANS, rupees } from "@/lib/billing";
import { SERVICE_KEYS, SERVICES_TOTAL_PAISE, SINGLE_SERVICES, type ServiceKey } from "@/lib/single-services";

const d = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function SingleServicesBox() {
  const router = useRouter();
  const [running, setRunning] = useState<Partial<Record<ServiceKey, string>> | null>(null);
  const [busy, setBusy] = useState<ServiceKey | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<{ services?: Partial<Record<ServiceKey, string>> }>("/api/pay/mine").then((r) => setRunning(r.ok ? r.data.services ?? {} : {})).catch(() => setRunning({}));
  }, []);

  async function buy(s: ServiceKey) {
    setBusy(s); setErr("");
    const r = await api<{ code?: string; error?: string }>("/api/pay/mine", { method: "POST", json: { op: "service", service: s, months: 1 } }).catch(() => null);
    setBusy(null);
    if (!r?.ok || !r.data.code) { setErr(r?.data?.error || "Could not start the payment. Please try again."); return; }
    router.push(`/pay/${encodeURIComponent(r.data.code)}`);
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="font-bold">Take one service alone</p>
      <p className="text-xs text-muted">By the month, GST included. All four together cost {rupees(SERVICES_TOTAL_PAISE)} — the Standard plan gives them all, plus broadcasts and a monthly report, for {rupees(SAAS_PLANS.growth.amount)}.</p>
      <div className="mt-3 space-y-2">
        {SERVICE_KEYS.map((s) => {
          const svc = SINGLE_SERVICES[s];
          const until = running?.[s];
          return (
            <div key={s} className="flex items-center gap-3 rounded-xl border border-border bg-bg p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{svc.en} <span className="font-normal text-muted">· {rupees(svc.paise)}/month</span></p>
                <p className="text-xs text-muted">{svc.what[0]}</p>
              </div>
              {until
                ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-good"><Check className="h-3.5 w-3.5" /> On till {d(until)}</span>
                : null}
              <button type="button" onClick={() => void buy(s)} disabled={!!busy || running === null}
                className="shrink-0 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-50">
                {busy === s ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : until ? "Add a month" : "Take it"}
              </button>
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-danger">{err}</p>}
    </div>
  );
}
