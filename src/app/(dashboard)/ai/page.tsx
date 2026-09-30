"use client";

import { useState } from "react";
import { Bot, Sparkles, Copy, Check, LoaderCircle, Wand2, Type, Languages, LayoutGrid, CalendarDays, MessageCircle, Megaphone } from "lucide-react";
import { PaidPage } from "@/components/paid-page";

type Tool = {
  id: string; task: string; icon: typeof Type; title: string; desc: string;
  placeholder: string; extra?: boolean;
};

const tools: Tool[] = [
  { id: "social-post", task: "social-post", icon: Megaphone, title: "Social post creator", desc: "Ready caption, CTA, hashtags and creative direction for manual posting.", placeholder: "Business, audience, offer and preferred language…", extra: true },
  { id: "campaign-kit", task: "campaign-kit", icon: CalendarDays, title: "7-day content calendar", desc: "A practical organic campaign you can post manually.", placeholder: "What you sell, target customer, city and current offer…", extra: true },
  { id: "follow-up", task: "follow-up", icon: MessageCircle, title: "WhatsApp follow-up writer", desc: "Three respectful messages for a lead or offer.", placeholder: "Lead enquiry, product and desired next action…", extra: true },
  { id: "tagline", task: "tagline", icon: Wand2, title: "AI Tagline writer", desc: "A punchy one-liner for your card.", placeholder: "e.g. Alkaline water distributor, Wellwa Life", extra: true },
  { id: "bio", task: "bio", icon: Type, title: "AI Bio / About writer", desc: "A warm 2-3 sentence about-me.", placeholder: "What you do, experience, what you offer…", extra: true },
  { id: "rewrite", task: "rewrite", icon: Sparkles, title: "AI Rewrite / polish", desc: "Make any text clearer & warmer.", placeholder: "Paste text to improve…" },
  { id: "translate-hi", task: "translate-hi", icon: Languages, title: "Translate → Hindi", desc: "English/Hinglish → Hindi.", placeholder: "Text to translate to Hindi…" },
  { id: "translate-en", task: "translate-en", icon: Languages, title: "Translate → English", desc: "Hindi/Hinglish → English.", placeholder: "Text to translate to English…" },
  { id: "card", task: "card", icon: LayoutGrid, title: "AI Card builder", desc: "Draft full card copy from a line.", placeholder: "e.g. Water ionizer distributor in Indore" },
];

function AiStudioPageInner() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="h-12 w-12 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "var(--grad-ai)" }}>
          <Bot className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Studio</h1>
          <p className="text-muted mt-1 max-w-2xl">Create manual social posts, campaigns, WhatsApp follow-ups and card copy. Review, copy and publish from your own account.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {tools.map((t) => <AiTool key={t.id} tool={t} />)}
      </div>
    </div>
  );
}

function AiTool({ tool }: { tool: Tool }) {
  const [input, setInput] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [out, setOut] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [demo, setDemo] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    setState("busy"); setOut("");
    try {
      const r = await fetch("/api/ai/write", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: tool.task, input, role, company }),
      }).then((x) => x.json());
      setOut(r.text ?? r.error ?? "");
      setDemo(!!r.demo);
      setState("done");
    } catch { setOut("Something went wrong."); setState("done"); }
  }

  const Icon = tool.icon;
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: "var(--grad-ai)" }}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-semibold text-sm">{tool.title}</h2>
          <p className="text-xs text-muted">{tool.desc}</p>
        </div>
      </div>

      {tool.extra && (
        <div className="grid grid-cols-2 gap-2">
          <input className="ai-input" placeholder="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
          <input className="ai-input" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
      )}
      <textarea className="ai-input min-h-20 resize-y" placeholder={tool.placeholder} value={input} onChange={(e) => setInput(e.target.value)} />

      <button onClick={run} disabled={state === "busy" || (!input && !role)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--grad-ai)" }}>
        {state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate
      </button>

      {out && (
        <div className="rounded-xl border border-border bg-surface2/50 p-3">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{out}</p>
          <div className="mt-2 flex items-center gap-3">
            <button onClick={() => { navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
            {demo && <span className="text-[11px] text-lead">demo output — add ANTHROPIC_API_KEY for live AI</span>}
          </div>
        </div>
      )}

      <style>{`.ai-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:.6rem;padding:.55rem .75rem;font-size:.875rem;outline:none;color:var(--ink)}.ai-input:focus{border-color:var(--ai)}`}</style>
    </section>
  );
}

export default function AiStudioPage() {
  return (
    <PaidPage feature="ai-studio">
      <AiStudioPageInner />
    </PaidPage>
  );
}
