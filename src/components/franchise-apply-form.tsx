"use client";
// The "Become a franchise" application (shubhora.com/franchise). Little is asked: who, where, what they do today. Saved by
// /api/franchise/apply; the Shubhora team calls back. If saving fails the person can finish on WhatsApp with the same details.
import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, MessageCircle } from "lucide-react";
import { waLink } from "@/lib/site-brand";
import { PASSWORD_MIN } from "@/lib/franchise-apply";

const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];

export function FranchiseApplyForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "again">("idle");
  const [error, setError] = useState("");
  const [wa, setWa] = useState("");
  const [show, setShow] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  async function submit(formData: FormData) {
    setError(""); setState("sending");
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;
    if ((data.password ?? "").length < PASSWORD_MIN) { setError(`Choose a panel password of at least ${PASSWORD_MIN} characters.`); setState("idle"); return; }
    if (data.password !== data.password2) { setError("The two passwords do not match."); setState("idle"); return; }
    try {
      const r = await fetch("/api/franchise/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "Could not send. Please use WhatsApp."); setState("idle"); if (r.status >= 500) setWa(waText(data)); return; }
      setHasAccount(!!j.hasAccount); setState(j.again ? "again" : "sent"); setWa("");
    } catch {
      setWa(waText(data)); setState("sent");
    }
  }
  const waText = (d: Record<string, string>) => waLink(["Hello Shubhora, I want to become a franchise.", `Name: ${d.name || ""}`, `Mobile: ${d.phone || ""}`, `City: ${d.city || ""}, ${d.state || ""}`, `Area wanted: ${d.area || ""}`, `What I do: ${d.company || ""} — ${d.background || ""}`].join("\n"));

  if (state === "sent" || state === "again") {
    return (
      <div id="apply" className="rounded-2xl border border-border bg-surface p-6 md:p-8 shadow-card text-center space-y-3">
        <CheckCircle2 className="mx-auto h-10 w-10 text-good" />
        <h3 className="text-xl font-semibold">{state === "again" ? "We already have your application" : "Application received"}</h3>
        <p className="text-sm text-muted">{state === "again" ? "It is with the team — you will hear from us soon. No need to apply again." : "The Shubhora team will call you within 2 working days to talk about your territory and the terms. Keep your phone handy."}</p>
        {state === "sent" && <p className="rounded-xl bg-bg px-4 py-3 text-left text-sm text-muted"><b className="text-ink">After approval:</b> log in at <b className="text-ink">shubhora.com/admin/login</b> with your mobile number and {hasAccount ? "the password of your existing Shubhora account" : "the password you just set"}. We will message you the moment it is approved.</p>}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Also send it on WhatsApp</a>}
      </div>
    );
  }
  return (
    <form id="apply" action={submit} className="rounded-2xl border border-border bg-surface p-6 md:p-8 space-y-4 shadow-card scroll-mt-24">
      <div>
        <h3 className="text-xl font-semibold">Apply for a franchise</h3>
        <p className="mt-1 text-sm text-muted">Two minutes. No fee to apply. We call you back.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><span className="text-sm font-medium mb-1.5 block">Your name</span><input name="name" required maxLength={80} placeholder="Full name" className="ct-input" /></label>
        <label className="block"><span className="text-sm font-medium mb-1.5 block">Mobile (WhatsApp)</span><input name="phone" required inputMode="numeric" maxLength={14} placeholder="10-digit mobile" className="ct-input" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><span className="text-sm font-medium mb-1.5 block">City</span><input name="city" required maxLength={60} placeholder="e.g. Ajmer" className="ct-input" /></label>
        <label className="block"><span className="text-sm font-medium mb-1.5 block">State</span><select name="state" required className="ct-input" defaultValue=""><option value="" disabled>Select state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label className="block"><span className="text-sm font-medium mb-1.5 block">Area you want to work in</span><input name="area" maxLength={120} placeholder="e.g. Ajmer city, or Ajmer district" className="ct-input" /></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><span className="text-sm font-medium mb-1.5 block">Your business / work today <span className="text-faint">(optional)</span></span><input name="company" maxLength={100} placeholder="e.g. Printing press, CA office, agency" className="ct-input" /></label>
        <label className="block"><span className="text-sm font-medium mb-1.5 block">E-mail <span className="text-faint">(optional)</span></span><input name="email" type="email" maxLength={120} placeholder="you@example.com" className="ct-input" /></label>
      </div>
      <label className="block"><span className="text-sm font-medium mb-1.5 block">Why you? <span className="text-faint">(optional)</span></span><textarea name="background" rows={3} maxLength={1000} placeholder="How many local businesses do you meet or know? Any sales or agency experience?" className="ct-input" /></label>
      <div className="rounded-xl border border-border bg-bg p-4 space-y-3">
        <p className="text-sm font-medium">Set your franchise panel password</p>
        <p className="text-xs text-muted">After approval you log in at shubhora.com/admin/login with your mobile number and this password. (If your mobile already has a Shubhora account, that password is used — leave this as you like.)</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block relative"><span className="text-sm font-medium mb-1.5 block">Password</span><input name="password" type={show ? "text" : "password"} minLength={PASSWORD_MIN} maxLength={72} autoComplete="new-password" placeholder={`At least ${PASSWORD_MIN} characters`} className="ct-input pr-10" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide" : "Show"} className="absolute right-3 top-[34px] text-muted">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></label>
          <label className="block"><span className="text-sm font-medium mb-1.5 block">Confirm password</span><input name="password2" type={show ? "text" : "password"} minLength={PASSWORD_MIN} maxLength={72} autoComplete="new-password" placeholder="Type it again" className="ct-input" /></label>
        </div>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button disabled={state === "sending"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60">
        {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Send application <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-xs text-faint text-center">By applying you agree to be contacted by Shubhora about the franchise. Your details are not shared with anyone else.</p>
      {error && <p role="alert" className="text-sm text-center text-red-600">{error}</p>}
      {error && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Send on WhatsApp instead</a>}
      <style>{`.ct-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:.7rem;padding:.72rem .85rem;font-size:.875rem;outline:none;color:var(--ink)}.ct-input:focus{border-color:var(--brand)}`}</style>
    </form>
  );
}
