"use client";
// The trade's own questions, asked right after "What do you do?" (owner's call, 2 Oct 2026: the fields after the
// category must match the category — a school is asked its classes, board and medium; a restaurant its cuisine).
// Chips for one / many, a line for text; answers go to card facts `tradeAnswers` (English option names).
import { Sec, chipCls, field, type FactsPatch } from "@/components/poster/facts-fields";
import type { CardFacts } from "@/lib/card-facts";
import { categoryOf } from "@/lib/poster-categories";
import { tradeQuestionsFor, type TradeQuestion } from "@/lib/trade-questions";

export function TradeQuestions({ category, facts, setF, hi, title = true }: {
  category: string; facts: CardFacts; setF: (p: FactsPatch) => void; hi: boolean;
  /** The "About your <trade>" heading on top. */
  title?: boolean;
}) {
  const qs = tradeQuestionsFor(category);
  const c = categoryOf(category);
  if (!c || !qs.length) return null;
  const T = (en: string, h: string) => (hi ? h : en);
  const answers = facts.tradeAnswers ?? {};
  const set = (key: string, v: string[]) => setF({ tradeAnswers: { ...answers, [key]: v } });
  const toggle = (q: TradeQuestion, v: string) => {
    const cur = answers[q.key] ?? [];
    if (q.type === "one") return set(q.key, cur.includes(v) ? [] : [v]);
    set(q.key, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  const tradeName = (hi ? c.hi : c.en).split(" / ")[0].split(" (")[0];
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold">{T(`About your ${tradeName.toLowerCase()}`, `आपके ${tradeName} के बारे में`)} <span className="font-normal text-muted">({T("tap what applies", "जो सही हो दबाएँ")})</span></p>}
      {qs.map((q) => {
        const cur = answers[q.key] ?? [];
        return (
          <Sec key={q.key} id={`q-trade-${q.key}`} title={T(q.en, q.hi)} hint={q.type === "many" && q.key !== "offerings" ? T("Tick all that apply.", "जितने हों, सब दबाएँ।") : undefined}>
            {q.type === "text" ? (
              <input value={cur[0] ?? ""} onChange={(e) => set(q.key, e.target.value ? [e.target.value.slice(0, 80)] : [])} placeholder={T(q.eg ?? "", q.egHi ?? q.eg ?? "")} className={field} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(q.options ?? []).map((o) => (
                  <button key={o.en} type="button" onClick={() => toggle(q, o.en)} className={chipCls(cur.includes(o.en))}>{hi ? o.hi : o.en}</button>
                ))}
              </div>
            )}
          </Sec>
        );
      })}
    </div>
  );
}
