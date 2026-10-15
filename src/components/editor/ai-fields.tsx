"use client";

import { useRef, useState } from "react";
import { Sparkles, Bot, Upload, Loader2, Check, X } from "lucide-react";

/* ------------------------------------------------------------------ *
 * AiTextarea — a textarea with an inline "AI suggest" button.
 * As the user writes (or from scratch), they can pull an AI suggestion
 * and accept/dismiss it. Reused for About, Tagline, Knowledge, admin copy.
 * ------------------------------------------------------------------ */
export function AiTextarea({
  value,
  onChange,
  task = "rewrite",
  role,
  company,
  placeholder,
  minH = "min-h-24",
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  task?: "rewrite" | "bio" | "tagline";
  role?: string;
  company?: string;
  placeholder?: string;
  minH?: string;
  rows?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function suggest() {
    setBusy(true);
    setErr(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, input: value || placeholder || "", role, company }),
      });
      const data = await res.json();
      if (data.text) setSuggestion(String(data.text).trim());
      else setErr(data.error || "The AI could not suggest anything. Please try again.");
    } catch {
      setErr("The AI is not working right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* The AI button sits UNDER the box, never on top of the text (owner's review, 28 Sep 2026). */}
      <div>
        <textarea
          className={`ed-input ${minH} resize-y`}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={suggest}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-ai/10 text-ai px-2 py-1 text-[11px] font-medium hover:bg-ai/20 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Suggest with AI
          </button>
        </div>
      </div>

      {err && <p className="text-[11px] text-red-500">{err}</p>}

      {suggestion && (
        <div className="rounded-lg border border-ai/30 bg-ai/5 p-2.5 text-sm space-y-2">
          <p className="whitespace-pre-wrap text-ink">{suggestion}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onChange(suggestion);
                setSuggestion(null);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-ai text-white px-2 py-1 text-[11px] font-medium"
            >
              <Check className="h-3 w-3" /> Use this
            </button>
            <button
              type="button"
              onClick={() => onChange((value ? value + "\n" : "") + suggestion)}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface"
            >
              Add below
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted hover:text-ink"
            >
              <X className="h-3 w-3" /> No thanks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * TrainAiPanel — bot training. Persona + knowledge base (text) with an
 * optional PDF upload that Claude distills into clean knowledge text.
 * Works for ANY product (ionizer or anything else the seller offers).
 * ------------------------------------------------------------------ */
export function TrainAiPanel({
  persona,
  knowledge,
  site = "",
  onPersona,
  onKnowledge,
  onSite,
}: {
  persona: string;
  knowledge: string;
  /** The owner's own website: the bot sends this link instead of the card's and answers from it. */
  site?: string;
  onPersona: (v: string) => void;
  onKnowledge: (v: string) => void;
  onSite?: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  // PDF messages sit right under the "Add PDF" row; website messages sit under the website box (each next to its own button).
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [siteStatus, setSiteStatus] = useState<string | null>(null);
  const [siteErr, setSiteErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [siteDraft, setSiteDraft] = useState(site);

  /** Read the owner's website into the knowledge base (replacing what an earlier read of it added). */
  async function readSite() {
    const raw = siteDraft.trim();
    if (!raw) return;
    setSiteErr(null); setErr(null); setStatus(null); setSiteStatus("Reading the website…"); setBusy(true);
    try {
      const res = await fetch("/api/ai/train", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: raw }) });
      const data = await res.json();
      if (!data.knowledge) { setSiteStatus(null); setSiteErr(data.error || "Could not read the website."); return; }
      const url = String(data.url || raw);
      const header = `--- From my website: ${url.replace(/^https?:\/\//, "")} ---`;
      // An earlier read of the website is replaced, hand-written notes and PDFs stay.
      const kept = knowledge.split(/\n\n(?=--- From my website: )/).filter((b) => !b.startsWith("--- From my website: ")).join("\n\n").trim();
      onKnowledge((kept ? kept + "\n\n" : "") + header + "\n" + String(data.knowledge).trim());
      onSite?.(url);
      setSiteDraft(url);
      setSiteStatus("Website read ✓. The bot will now answer from it and send this link. Tap Save to keep it.");
    } catch { setSiteStatus(null); setSiteErr("Could not read the website. Try again or paste its text below."); }
    finally { setBusy(false); }
  }

  async function onPdf(file: File) {
    setErr(null);
    setStatus(null);
    setSiteErr(null); setSiteStatus(null);
    if (file.type !== "application/pdf") {
      setErr("Please choose a PDF file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErr("This PDF is too big. Please use a PDF under 12 MB.");
      return;
    }
    setBusy(true);
    setStatus(`Reading ${file.name}…`);
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch("/api/ai/train", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdfBase64: b64, filename: file.name }),
      });
      const data = await res.json();
      if (data.knowledge) {
        const header = `--- From: ${file.name} ---\n`;
        onKnowledge((knowledge ? knowledge.trim() + "\n\n" : "") + header + data.knowledge.trim());
        setStatus(`Added details from ${file.name} ✓`);
      } else {
        setErr(data.error || "Could not read this PDF.");
      }
    } catch {
      setErr("Could not add the PDF. Try again or paste the text below.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-ai/5 border border-ai/20 p-3">
        <Bot className="h-4 w-4 text-ai mt-0.5 shrink-0" />
        <p className="text-xs text-muted">
          Tell your AI bot about what you sell. It answers customers in your card chat <strong>and</strong> on
          WhatsApp. Paste your details, or add a PDF or brochure. The AI reads it for you.
        </p>
      </div>

      <div className="rounded-lg border border-border p-3">
        <span className="text-xs font-medium text-muted">My own website (the bot sends this link to customers instead of the card, and answers from it)</span>
        <div className="mt-1 flex gap-2">
          <input className="ed-input mt-0 flex-1" value={siteDraft} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="e.g. alkafresh.in" onChange={(e) => { setSiteDraft(e.target.value); if (!e.target.value.trim()) onSite?.(""); }} />
          <button type="button" onClick={readSite} disabled={busy || !siteDraft.trim()} className="rounded-md bg-ai px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "…" : "Read website"}</button>
        </div>
        {siteStatus && <p className="mt-1 text-[11px] text-emerald-600">{siteStatus}</p>}
        {siteErr && <p className="mt-1 text-[11px] text-red-500">{siteErr}</p>}
        <p className="mt-1 text-[11px] text-muted">{site ? <>Website added: <b>{site.replace(/^https?:\/\//, "")}</b>. Tap Save to keep it. Read it again if you change your website. Empty the box to use the card&apos;s link again.</> : "If you leave this empty, the bot sends your Shubhora card link."}</p>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-muted">How the bot should talk</span>
        <input
          className="ed-input mt-1"
          value={persona}
          placeholder="e.g. Friendly and polite, answers in simple Hindi, invites people to call or visit"
          onChange={(e) => onPersona(e.target.value)}
        />
      </label>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted">What the bot should know</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Add PDF
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onPdf(e.target.files[0])}
          />
        </div>
        {status && <p className="mb-1 text-[11px] text-emerald-600">{status}</p>}
        {err && <p className="mb-1 text-[11px] text-red-500">{err}</p>}
        <textarea
          className="ed-input min-h-40 resize-y"
          value={knowledge}
          placeholder={
            "Your products or services, prices, offers, timings, area, warranty, common questions…\n\nExample:\n- Bridal makeup — ₹8,000, trial included\n- Open 10 am – 8 pm, closed Tuesday\n- Home service within 10 km of Rewari\n- Advance ₹500 to book a date"
          }
          onChange={(e) => onKnowledge(e.target.value)}
        />
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1)); // strip data:...;base64,
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
