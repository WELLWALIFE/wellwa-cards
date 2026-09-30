"use client";

// Settings — the user's own account: profile, password, plan/billing, sign out
// and account deletion. Everything here is about THIS user, loaded live.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, LogOut, KeyRound, User, CreditCard, TriangleAlert, LoaderCircle } from "lucide-react";
import { PushSetting } from "@/components/push-toggle";
import { SubscribeButton } from "@/components/subscribe-button";
import { GST_PCT, SAAS_EXTRA, SAAS_PLANS, rupees, type SaasTier } from "@/lib/billing";
import { useAssociate } from "@/lib/associate";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { getSessionUser, signOut, fetchMyCards } from "@/lib/cloud";
import { usePlan } from "@/lib/plan";
import { displayLogin } from "@/lib/phone";

// No Free entry to pick: every account is on the free plan until it subscribes.
// Same plans and prices as the public Pricing page (lib/billing.ts is the single source).
const plans = (["growth", "pro"] as SaasTier[]).map((t) => ({
  tier: t, name: SAAS_PLANS[t].label, price: `${rupees(SAAS_PLANS[t].amount)} / month incl. GST`,
  features: [SAAS_PLANS[t].tagline, ...SAAS_EXTRA[t]],
}));

export default function SettingsPage() {
  const router = useRouter();
  const { plan: current, isTrial, expired, daysLeft } = usePlan();
  const associate = useAssociate();
  const [tier, setTier] = useState<{ tier: string; until: string | null; active: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [cardCount, setCardCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const me = await getSessionUser();
      if (!me) return;
      setEmail(displayLogin(me.email));
      const sb = getBrowserSupabase();
      const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
      setName((data.user?.user_metadata?.display_name as string) || (data.user?.user_metadata?.full_name as string) || me.email.split("@")[0]);
      setCardCount((await fetchMyCards()).length);
      const { data: prof } = (await sb?.from("profiles").select("saas_tier,saas_expires_at").eq("id", me.id).maybeSingle()) ?? { data: null };
      if (prof) setTier({ tier: prof.saas_tier as string, until: prof.saas_expires_at as string | null, active: !!prof.saas_expires_at && Date.parse(prof.saas_expires_at as string) > Date.now() });
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const sb = getBrowserSupabase();
    const { error } = (await sb?.auth.updateUser({ data: { full_name: name, display_name: name } })) ?? { error: null };
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    const pw = prompt("Enter your new password (at least 6 characters):");
    if (!pw) return;
    if (pw.length < 6) { setMsg("Password must be at least 6 characters."); return; }
    const sb = getBrowserSupabase();
    const { error } = (await sb?.auth.updateUser({ password: pw })) ?? { error: null };
    setMsg(error ? error.message : "Password updated.");
  }

  async function logout() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted mt-1">Your account, password and subscription.</p>
      </div>

      {/* ---- Account ---- */}
      <form onSubmit={saveProfile} className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><User className="h-4 w-4 text-muted" /> Account</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />
          </label>
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Email</span>
            <input value={email} readOnly
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2.5 text-sm outline-none text-muted cursor-not-allowed" />
            <span className="text-[11px] text-faint mt-1 block">This is your login — contact support to change it.</span>
          </label>
        </div>
        {msg && <p className="text-xs text-muted">{msg}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save changes"}
          </button>
          <button type="button" onClick={changePassword}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface2">
            <KeyRound className="h-4 w-4" /> Change password
          </button>
          <button type="button" onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface2">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </form>

      {/* ---- Notifications ---- */}
      <section>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-muted" /> Notifications</h2>
        <PushSetting />
      </section>

      {/* ---- Plan ---- */}
      <section>
        <h2 className="font-semibold mb-1 flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted" /> Your plan</h2>
        <p className="text-sm text-muted mb-4">
          {(expired || current === "free") && associate
            ? <>You are on the <b className="text-ink">free plan</b>. Activate your subscription in the partner panel to unlock everything.</>
            : expired || current === "free"
            ? <>You are on the <b className="text-ink">free plan</b> — your digital V-Card is free for its first year. Subscribe for the website, daily posters, WhatsApp AI and auto-posting.</>
            : isTrial
              ? <>You&apos;re on the <b className="text-ink">free trial</b> — {daysLeft} day{daysLeft === 1 ? "" : "s"} left, everything unlocked.</>
              : tier?.active && tier.until
                ? <>You&apos;re on <b className="text-ink capitalize">{tier.tier}</b> till {new Date(tier.until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.</>
                : <>You&apos;re on <b className="text-ink capitalize">{current}</b>.</>}
          {" "}{cardCount} card{cardCount === 1 ? "" : "s"} created.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
          {plans.map((p) => {
            const isCurrent = !!tier?.active && tier.tier === p.tier;
            return (
              <div key={p.name}
                className={`rounded-xl border p-5 bg-surface flex flex-col ${isCurrent ? "border-brand ring-1 ring-brand" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  {isCurrent && <span className="mono text-[10px] font-bold uppercase text-brand-ink bg-brand-soft rounded px-1.5 py-0.5">Current</span>}
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums">{p.price}</p>
                <p className="text-xs text-faint">Includes {GST_PCT}% GST</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <div className="mt-4">
                    <SubscribeButton tier={p.tier} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">
                      Choose {p.name}
                    </SubscribeButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Danger zone ---- */}
      <section className="rounded-xl border border-danger/30 bg-danger/5 p-5">
        <h2 className="font-semibold flex items-center gap-2 text-danger">
          <TriangleAlert className="h-4 w-4" /> Delete account
        </h2>
        <p className="text-sm text-muted mt-1">
          Permanently removes your account, your cards and their public links. This cannot be undone.
        </p>
        <button
          onClick={async () => {
            if (!confirm("Delete your account and all your cards permanently?")) return;
            setMsg("To delete your account, please email support — we'll confirm it's you first.");
          }}
          className="mt-3 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger hover:text-white transition-colors"
        >
          Delete my account
        </button>
      </section>
    </div>
  );
}
