"use client";
// Platform settings (Admin v2): security policy and franchise defaults. Super Admin only ("settings.manage").
import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, ShieldCheck, Store } from "lucide-react";
import { adminApi, useAdminMe } from "@/lib/admin-client";
import { Btn, Card, ErrorBox, Field, PageHeader, Spinner, Toggle, inputCls, toast } from "@/components/admin/ui";

type S = { enforce_mfa: boolean; commission_first_pct: number; commission_renewal_pct: number; franchise_can_activate: boolean; payout_min_paise: number; signup_alert: boolean };

export default function SettingsPage() {
  const { me } = useAdminMe();
  const [s, setS] = useState<S | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const r = await adminApi<{ settings: S }>("/api/admin/v2/settings"); if (r.ok) setS(r.data.settings); else setErr(r.data.error || "Could not load."); })(); }, []);
  async function save(patch: Partial<S>) {
    setBusy(true);
    const r = await adminApi<{ settings: S }>("/api/admin/v2/settings", { method: "PUT", json: patch });
    setBusy(false);
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    setS(r.data.settings); toast("Saved.");
  }
  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!s) return <Spinner />;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Platform settings" sub="Rules that apply to the whole of Shubhora. Changes are written in the audit log." />
      <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> Security</span>}>
        <div className="space-y-3">
          <Toggle on={s.enforce_mfa} onChange={(v) => void save({ enforce_mfa: v })} disabled={busy} label="Require 2-step verification for every admin login"
            hint={me && !me.mfaEnrolled && me.via === "session" ? <>Set up your own 2-step first under <Link href="/admin/security" className="font-semibold text-brand-ink">Security</Link>.</> : "On: nobody opens the panel without an authenticator code — a new person is asked to set it up at their first login."} />
          <Toggle on={s.signup_alert} onChange={(v) => void save({ signup_alert: v })} disabled={busy} label="E-mail the company inbox on every new sign-up" hint="The registration alert that goes to support@shubhora.com." />
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Store className="h-4 w-4 text-brand" /> Franchise defaults</span>} sub="What a new franchise starts with; each franchise can be changed on its own page.">
        <form onSubmit={(e) => { e.preventDefault(); void save({ commission_first_pct: s.commission_first_pct, commission_renewal_pct: s.commission_renewal_pct, payout_min_paise: s.payout_min_paise }); }} className="grid gap-3 sm:grid-cols-3">
          <Field label="Commission on the first payment (%)"><input type="number" min={0} max={100} step={0.5} className={inputCls} value={s.commission_first_pct} onChange={(e) => setS({ ...s, commission_first_pct: Number(e.target.value) })} /></Field>
          <Field label="Commission on renewals (%)"><input type="number" min={0} max={100} step={0.5} className={inputCls} value={s.commission_renewal_pct} onChange={(e) => setS({ ...s, commission_renewal_pct: Number(e.target.value) })} /></Field>
          <Field label="Minimum payout (₹)"><input type="number" min={0} step={100} className={inputCls} value={Math.round(s.payout_min_paise / 100)} onChange={(e) => setS({ ...s, payout_min_paise: Math.round(Number(e.target.value) * 100) })} /></Field>
          <div className="sm:col-span-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Example: a ₹2,999 Standard payment earns the franchise ₹{Math.round((2999 * s.commission_first_pct) / 100).toLocaleString("en-IN")} the first time and ₹{Math.round((2999 * s.commission_renewal_pct) / 100).toLocaleString("en-IN")} on each renewal.</p>
            <Btn type="submit" variant="primary" icon={Save} loading={busy}>Save</Btn>
          </div>
        </form>
        <div className="mt-4">
          <Toggle on={s.franchise_can_activate} onChange={(v) => void save({ franchise_can_activate: v })} disabled={busy} label="New franchises may activate plans for their users" hint="For payments the franchise takes by hand. Off: only Shubhora activates plans. Can be set per franchise too." />
        </div>
      </Card>
    </div>
  );
}
