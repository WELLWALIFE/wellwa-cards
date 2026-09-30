"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { waLink } from "@/lib/site-brand";

const projectTypes = ["Shubhora Business Suite", "AI application", "Business automation", "CRM / portal / dashboard", "WhatsApp system", "Website or mobile app", "Other custom software"];

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [wa, setWa] = useState("");                      // set when the enquiry could not be stored: finish on WhatsApp

  async function submit(formData: FormData) {
    setError("");
    setState("sending");
    const data = Object.fromEntries(formData.entries());
    let saved = false;
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "Could not send. Please use WhatsApp."); setState("idle"); return; }
      saved = !!j.saved;
    } catch { /* network: still continue on WhatsApp */ }
    const lines = [
      "Hello Shubhora, I want to discuss a software project.",
      `Name: ${data.name || ""}`, `Company: ${data.company || ""}`, `Phone / Email: ${data.contact || ""}`,
      `Project: ${data.project || ""}`, `Requirement: ${data.message || ""}`,
    ];
    setWa(saved ? "" : waLink(lines.join("\n")));
    setState("sent");
  }

  return (
    <form action={submit} className="rounded-2xl border border-border bg-surface p-6 md:p-8 space-y-4 shadow-card">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><span className="text-sm font-medium mb-1.5 block">Name</span><input name="name" required placeholder="Your name" className="ct-input" /></label>
        <label className="block"><span className="text-sm font-medium mb-1.5 block">Company</span><input name="company" placeholder="Company or brand" className="ct-input" /></label>
      </div>
      <label className="block"><span className="text-sm font-medium mb-1.5 block">Phone or email</span><input name="contact" required placeholder="How should we reach you?" className="ct-input" /></label>
      <label className="block"><span className="text-sm font-medium mb-1.5 block">What do you want to build?</span><select name="project" required className="ct-input"><option value="">Select project type</option>{projectTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="block"><span className="text-sm font-medium mb-1.5 block">What should the software improve?</span><textarea name="message" required placeholder="Tell us about your users, current process and desired result…" className="ct-input min-h-32 resize-y" /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button disabled={state === "sending"} className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60">
        {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Send enquiry <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-xs text-faint text-center">We usually reply within one working day.</p>
      {error && <p role="alert" className="text-sm text-center text-red-600">{error}</p>}
      {state === "sent" && !wa && <p role="status" className="flex items-center justify-center gap-2 text-sm text-good"><CheckCircle2 className="h-4 w-4" /> Thank you. We have your enquiry and will contact you soon.</p>}
      {state === "sent" && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white">Last step: send it on WhatsApp</a>}
      <style>{`.ct-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:.7rem;padding:.72rem .85rem;font-size:.875rem;outline:none;color:var(--ink)}.ct-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 15%,transparent)}`}</style>
    </form>
  );
}
