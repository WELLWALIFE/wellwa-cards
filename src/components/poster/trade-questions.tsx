"use client";
// The trade's own questions, asked right after "What do you do?" (owner's call, 2 Oct 2026: the fields after the
// category must match the category — a school is asked its classes, board and medium; a restaurant its cuisine).
// Chips for one / many, a line for text; answers go to card facts `tradeAnswers` (English option names).
// Every chip question also has "Other ✎": tapping it opens a line for the real answer (owner's call: "other se AI
// kya samjhega?"), and that typed text is what is saved — never the word "Other".
import { useState } from "react";
import { Sec, chipCls, field, type FactsPatch } from "@/components/poster/facts-fields";
import type { CardFacts } from "@/lib/card-facts";
import { categoryOf } from "@/lib/poster-categories";
import { tradeQuestionsFor } from "@/lib/trade-questions";

const isOtherOption = (en: string) => /^(other|others)$/i.test(en.trim());

export function TradeQuestions({ category, facts, setF, hi, title = true }: {
  category: string; facts: CardFacts; setF: (p: FactsPatch) => void; hi: boolean;
  /** The "About your <trade>" heading on top. */
  title?: boolean;
}) {
  const qs = tradeQuestionsFor(category);
  const c = categoryOf(category);
  // Which questions have their "Other" line open (also open whenever a typed answer is saved).
  const [otherOpen, setOtherOpen] = useState<Record<string, boolean>>({});
  if (!c || !qs.length) return null;
  const T = (en: string, h: string) => (hi ? h : en);
  const answers = facts.tradeAnswers ?? {};
  const set = (key: string, v: string[]) => setF({ tradeAnswers: { ...answers, [key]: v } });
  const tradeName = (hi ? c.hi : c.en).split(" / ")[0].split(" (")[0];
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold">{T(`About your ${tradeName.toLowerCase()}`, `आपके ${tradeName} के बारे में`)} <span className="font-normal text-muted">({T("tap what applies", "जो सही हो दबाएँ")})</span></p>}
      {qs.map((q) => {
        const cur = answers[q.key] ?? [];
        if (q.type === "text") return (
          <Sec key={q.key} id={`q-trade-${q.key}`} title={T(q.en, q.hi)}>
            <input value={cur[0] ?? ""} onChange={(e) => set(q.key, e.target.value ? [e.target.value.slice(0, 80)] : [])} placeholder={T(q.eg ?? "", q.egHi ?? q.eg ?? "")} className={field} />
          </Sec>
        );
        // The listed options; a literal "Other" in the data is the generic "Other ✎" below.
        const options = (q.options ?? []).filter((o) => !isOtherOption(o.en));
        const known = new Set(options.map((o) => o.en));
        const picked = cur.filter((v) => known.has(v));
        const typed = cur.find((v) => !known.has(v)) ?? "";
        const otherOn = !!otherOpen[q.key] || !!typed;
        const toggle = (v: string) => {
          if (q.type === "one") { setOtherOpen((o) => ({ ...o, [q.key]: false })); return set(q.key, picked.includes(v) ? [] : [v]); }
          set(q.key, picked.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
        };
        const toggleOther = () => {
          if (otherOn) { setOtherOpen((o) => ({ ...o, [q.key]: false })); set(q.key, picked); return; }
          setOtherOpen((o) => ({ ...o, [q.key]: true }));
          if (q.type === "one") set(q.key, []);
        };
        const typeOther = (t: string) => {
          const v = t.slice(0, 80);
          set(q.key, q.type === "one" ? (v ? [v] : []) : v ? [...picked, v] : picked);
        };
        return (
          <Sec key={q.key} id={`q-trade-${q.key}`} title={T(q.en, q.hi)} hint={q.type === "many" && q.key !== "offerings" ? T("Tick all that apply.", "जितने हों, सब दबाएँ।") : undefined}>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <button key={o.en} type="button" onClick={() => toggle(o.en)} className={chipCls(picked.includes(o.en))}>{hi ? o.hi : o.en}</button>
              ))}
              <button type="button" onClick={toggleOther} className={chipCls(otherOn)}>{T("Other ✎", "अन्य ✎")}</button>
            </div>
            {otherOn && (
              <input autoFocus={!typed} value={typed} onChange={(e) => typeOther(e.target.value)}
                placeholder={T("Write it here — e.g. the exact name", "यहाँ लिखें — जैसे सही नाम")} className={field} />
            )}
          </Sec>
        );
      })}
    </div>
  );
}
