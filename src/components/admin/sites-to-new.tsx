"use client";
// Super Admin → Websites: every live website on the new designs (owner, 24 Nov 2026). "Check" lists what would happen and writes nothing;
// "Convert one" does a single website (try it on a demo first); "Convert all" goes through every card, 10 at a time.
import { useState } from "react";
import { adminApi } from "@/lib/admin-client";
import { Btn, Card, useConfirm, toast } from "@/components/admin/ui";

type Line = { username: string; steps: string[]; ok: boolean; error?: string };
type Res = { dryRun: boolean; report: Line[]; next: number | null; error?: string };

export function SitesToNew() {
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState("");
  const [one, setOne] = useState("");
  const [confirm, dialog] = useConfirm();
  async function run(dryRun: boolean, username?: string) {
    if (!dryRun && !(await confirm(username
      ? { title: `Put /${username} on a new design?`, body: "Its text and photos stay; only the design changes. The old look stays stored.", ok: "Convert" }
      : { title: "Put EVERY live website on a new design?", body: "Each website without a new design gets the first of its 12. Partner websites are saved as they look today first. Text and photos stay; the old look stays stored.", ok: "Convert all", danger: true }))) return;
    setBusy(dryRun ? "check" : username ? "one" : "all"); setLines([]);
    let offset: number | null = 0; const all: Line[] = [];
    try {
      while (offset !== null) {
        const r: { ok: boolean; data: Res } = await adminApi<Res>("/api/admin/sites-to-new", { method: "POST", json: { dryRun, offset, limit: 10, ...(username ? { username } : {}) } });
        if (!r.ok) { toast(r.data.error || "Stopped — could not continue.", "err"); break; }
        all.push(...r.data.report); setLines([...all]);
        offset = r.data.next;
      }
    } finally { setBusy(""); }
    if (!dryRun) toast(`Done — ${all.filter((l) => l.ok).length} of ${all.length} handled.`);
  }
  const changed = lines.filter((l) => !l.steps.every((s) => /already on a new design|no website/.test(s)));
  return (
    <Card>
      {dialog}
      <p className="text-sm font-bold">All websites on the new designs</p>
      <p className="mt-1 text-[12px] text-muted">So every website has the same editor: section designs, Build your own design, Change design. Text and photos stay; the old look stays stored.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn size="sm" loading={busy === "check"} disabled={!!busy} onClick={() => void run(true)}>Check (changes nothing)</Btn>
        <input value={one} onChange={(e) => setOne(e.target.value.trim())} placeholder="username, e.g. mamata-garments" className="h-8 rounded-lg border border-border bg-surface px-2.5 text-[12px]" />
        <Btn size="sm" loading={busy === "one"} disabled={!!busy || !one} onClick={() => void run(false, one)}>Convert one</Btn>
        <Btn size="sm" variant="primary" loading={busy === "all"} disabled={!!busy} onClick={() => void run(false)}>Convert all</Btn>
      </div>
      {lines.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[12px] font-semibold">{lines.length} cards looked at · {changed.length} {lines[0] && busy !== "check" ? "to change / changed" : "to change"} · {lines.filter((l) => !l.ok).length} errors</p>
          <ul className="max-h-80 overflow-auto rounded-lg border border-border text-[12px]">
            {changed.map((l) => <li key={l.username} className="flex gap-2 border-b border-border px-2.5 py-1.5 last:border-0"><span className="w-48 shrink-0 truncate font-mono">/{l.username}</span><span className={l.ok ? "text-muted" : "text-danger"}>{l.ok ? l.steps.join(" · ") : l.error}</span></li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}
