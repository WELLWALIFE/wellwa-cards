"use client";
// A form block as visitors fill it (types.ts `form`): the owner's own fields — an admission enquiry, a booking, a
// quote request. A submission is a lead (name, phone, the rest as the message), so it lands in the CRM like any
// other enquiry. Used by the website and the card.
import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import type { CardBlock } from "@/lib/types";

type Block = Extract<CardBlock, { kind: "form" }>;

export function FormBlock({ block, username, theme, t = (s) => s }: { block: Block; username: string; theme: string; t?: (s: string) => string }) {
  const [v, setV] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const fields = block.fields.filter((f) => f.label);
  const set = (k: string, val: string) => setV((o) => ({ ...o, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields) if (f.required && !(v[f.key] ?? "").trim()) { setErr(`${t(f.label)} — ${t("required")}`); setState("error"); return; }
    setState("busy"); setErr("");
    const nameF = fields.find((f) => f.key === "name" || f.type === "text" && /name|नाम/i.test(f.label));
    const phoneF = fields.find((f) => f.type === "phone");
    const emailF = fields.find((f) => f.type === "email");
    const rest = fields.filter((f) => f !== nameF && f !== phoneF && f !== emailF).map((f) => `${f.label}: ${(v[f.key] ?? "").trim()}`).filter((x) => !/:\s*$/.test(x));
    const { submitLead } = await import("@/lib/cloud");
    const res = await submitLead(username, { name: (nameF && v[nameF.key]) || "", phone: (phoneF && v[phoneF.key]) || "", email: (emailF && v[emailF.key]) || "", message: `📝 ${block.title}\n${rest.join("\n")}`.trim(), source: "form" });
    if (res.ok || res.error === "demo") { setState("done"); return; }
    setErr(res.error ?? "Something went wrong. Try WhatsApp instead."); setState("error");
  }

  if (state === "done") return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full text-white" style={{ background: theme }}><Check className="h-5 w-5" /></span>
      <p className="mt-3 text-sm font-semibold">{t("Sent!")}</p>
      <p className="mt-1 text-xs text-muted">{t(block.note || "We will get back to you soon.")}</p>
    </div>
  );
  const inp = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-[var(--tc)]";
  return (
    <form onSubmit={submit} className="space-y-3">
      {fields.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="mb-1 block font-medium">{t(f.label)}{f.required && <span className="text-danger"> *</span>}</span>
          {f.type === "textarea" ? <textarea value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={3} className={inp} />
            : f.type === "select" ? (
              <select value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={inp}>
                <option value="">{t("Choose…")}</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{t(o)}</option>)}
              </select>
            ) : <input type={f.type === "phone" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"} inputMode={f.type === "phone" ? "tel" : undefined} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={inp} />}
        </label>
      ))}
      {err && <p className="text-sm text-danger">{err}</p>}
      <button type="submit" disabled={state === "busy"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-semibold text-white disabled:opacity-60" style={{ background: theme }}>
        {state === "busy" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null} {t(block.button || "Send")}
      </button>
      {block.note && <p className="text-center text-xs text-muted">{t(block.note)}</p>}
    </form>
  );
}
