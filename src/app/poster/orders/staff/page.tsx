"use client";
// Staff logins (owner, 30 Oct 2026: "multi login — admin, measurement master, cutting, stitching; admin bana sake aur
// usko kya-kya rights dene hain"). Each person logs in with their own mobile through an invite link; what they may do
// is set here. "staff" right.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Copy, LoaderCircle, MessageCircle, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { RIGHTS, ROLE_PRESETS, type Right } from "@/lib/jobs";
import { Fold, useWorkspace } from "@/components/orders/orders-common";

type Member = { id: string; name: string; phone: string; joined: boolean; active: boolean; code: string; title: string; rights: Right[]; set: boolean };

function RightsPicker({ hi, title, rights, onChange }: { hi: boolean; title: string; rights: Right[]; onChange: (title: string, rights: Right[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ROLE_PRESETS.map((p) => <button key={p.title} type="button" onClick={() => onChange(p.title, p.rights)} className={`rounded-full border px-3 py-1.5 text-xs ${title === p.title ? "border-brand bg-brand font-semibold text-white" : "border-border bg-surface"}`}>{hi ? p.hi : p.title}</button>)}
      </div>
      <input value={title} onChange={(e) => onChange(e.target.value, rights)} placeholder={hi ? "पद (जैसे Cutting master)" : "Role name (e.g. Cutting master)"} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
      <div className="grid gap-1.5 sm:grid-cols-2">
        {RIGHTS.map((r) => (
          <label key={r.key} className="flex items-center gap-2 rounded-lg bg-bg px-2.5 py-2 text-xs">
            <input type="checkbox" checked={rights.includes(r.key)} onChange={(e) => onChange(title, e.target.checked ? [...rights, r.key] : rights.filter((x) => x !== r.key))} />{hi ? r.hi : r.en}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted">{hi ? "हर किसी को अपना दिया हुआ काम दिखता है और वह उसे “हो गया” करके आगे भेज सकता है।" : "Everyone sees the work given to them and can mark it done to send it on."}</p>
    </div>
  );
}

export default function StaffPage() {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [list, setList] = useState<Member[] | null>(null);
  const [err, setErr] = useState("");
  const [add, setAdd] = useState({ name: "", phone: "", title: ROLE_PRESETS[4].title, rights: ROLE_PRESETS[4].rights as Right[] });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const [openId, setOpenId] = useState("");
  const [edits, setEdits] = useState<Record<string, { title: string; rights: Right[] }>>({});
  const [copied, setCopied] = useState("");
  const asJson = { as: ws.as || undefined };

  const load = useCallback(async () => {
    const r = await api<{ staff: Member[]; error?: string }>(`/api/jobs/staff${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); setList([]); return; }
    setList(r.data.staff); setErr("");
  }, [ws.q]);
  useEffect(() => { void load(); }, [load]);

  const link = (m: Member) => `${location.origin}/poster/orders/join?code=${m.code}`;
  const invite = (m: Member) => `https://wa.me/${m.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`नमस्ते ${m.name} 🙏\nआपको हमारी दुकान के Orders app में जोड़ा गया है (${m.title || "Staff"})।\n\n1. यह link खोलें: ${link(m)}\n2. पहली बार हैं तो “अपना login बनाएँ” दबाकर अपने mobile नंबर से login बनाएँ (पहले से Shubhora login है तो login करें)\n3. आपका दिया हुआ काम वहीं दिखेगा, और नया काम आने पर notification आएगा।\n4. बाद में सीधे खोलें: ${location.origin}/poster/orders\n5. पूरा तरीका यहाँ पढ़ें: ${location.origin}/help/orders\n\nJoin code: ${m.code}`)}`;

  async function create() {
    setErr(""); setBusy("add");
    const r = await api<{ member?: Member; error?: string }>("/api/jobs/staff", { method: "POST", json: { ...asJson, ...add } });
    setBusy("");
    if (!r.ok || !r.data.member) { setErr(r.data.error || T("Could not add.", "नहीं जुड़ा।")); return; }
    setAdding(false); setAdd({ name: "", phone: "", title: ROLE_PRESETS[4].title, rights: ROLE_PRESETS[4].rights });
    setOpenId(r.data.member.id);
    await load();
  }
  async function patch(m: Member, body: Record<string, unknown>) {
    setBusy(m.id); setErr("");
    const r = await api<{ error?: string }>("/api/jobs/staff", { method: "PATCH", json: { ...asJson, id: m.id, ...body } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || T("Could not save.", "सेव नहीं हुआ।")); return false; }
    await load(); return true;
  }
  async function remove(m: Member) {
    if (!confirm(T(`Remove ${m.name}? They can no longer open your Orders. Their past work stays.`, `${m.name} को हटाएँ? वे आपके Orders नहीं खोल पाएँगे। पुराना काम रहेगा।`))) return;
    setBusy(m.id);
    const p = new URLSearchParams(ws.q); p.set("id", m.id);
    const r = await api<{ error?: string }>(`/api/jobs/staff?${p}`, { method: "DELETE" });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || "Could not remove."); return; }
    await load();
  }

  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  if (!list) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center gap-2">
        <Link href="/poster/orders" className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="flex-1"><h1 className="text-lg font-bold">{T("Staff & logins", "Staff · login")}</h1><p className="text-xs text-muted">{T("Each person logs in with their own mobile and sees only what you allow", "हर व्यक्ति अपने mobile से login करेगा और उतना ही देखेगा जितना आप दें")}</p></div>
        {!adding && <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white"><UserPlus className="h-4 w-4" /> {T("Add", "जोड़ें")}</button>}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted shadow-card">
        <p className="flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-brand" /> {T("You (owner) — full rights", "आप (owner) — पूरे rights")}</p>
        <p className="mt-1">{T("How it works: add the person → send the invite on WhatsApp → they open the link and log in with their mobile → their work shows up in their app. Put them on a step in Setup · Flow so new work reaches them by itself.", "कैसे चलता है: व्यक्ति जोड़ें → WhatsApp पर invite भेजें → वे link खोलकर अपने mobile से login करें → उनका काम उनके app में दिखेगा। Setup · Flow में उन्हें किसी step पर लगाएँ, तो नया काम अपने-आप उन तक पहुँचेगा।")}</p>
      </div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {adding && (
        <section className="space-y-3 rounded-2xl border border-brand/40 bg-surface p-4 shadow-card">
          <p className="font-bold">{T("New staff login", "नया staff login")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={field} placeholder={T("Name", "नाम")} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
            <input className={field} placeholder={T("Mobile (their login and WhatsApp)", "मोबाइल (उनका login और WhatsApp)")} inputMode="numeric" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} />
          </div>
          <RightsPicker hi={hi} title={add.title} rights={add.rights} onChange={(title, rights) => setAdd({ ...add, title, rights })} />
          <div className="flex gap-2">
            <button type="button" onClick={() => void create()} disabled={busy === "add" || !add.name.trim()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "add" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{T("Add staff", "Staff जोड़ें")}</button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm">{T("Cancel", "रहने दें")}</button>
          </div>
        </section>
      )}

      {list.length === 0 && !adding && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">{T("No staff yet. Add your measurement master, cutting master and tailors.", "अभी कोई staff नहीं। नाप वाले master, cutting master और tailor जोड़ें।")}</p>}
      {list.map((m) => {
        const e = edits[m.id] ?? { title: m.title, rights: m.rights };
        const changed = e.title !== m.title || e.rights.join() !== m.rights.join();
        return (
          <Fold key={m.id} hi={hi} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? "" : m.id)}
            icon={<span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${m.active ? "bg-brand-soft text-brand-ink" : "bg-bg text-muted"}`}>{m.name.slice(0, 1).toUpperCase()}</span>}
            title={<>{m.name} <span className="font-normal text-muted">· {m.title || T("Staff", "Staff")}</span></>}
            summary={`${m.phone} · ${!m.active ? T("stopped", "बंद") : m.joined ? T("✓ logged in", "✓ login किया") : T("invite not opened yet", "invite अभी नहीं खोला")} · ${m.rights.length} ${T("rights", "rights")}`}>
            {!m.joined && m.active && (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                <p>{T("Not joined yet. Send them the invite:", "अभी जुड़े नहीं। उन्हें invite भेजें:")} <b className="tracking-widest">{m.code}</b></p>
                <div className="flex flex-wrap gap-2">
                  {m.phone && <a href={invite(m)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> {T("Invite on WhatsApp", "WhatsApp पर invite")}</a>}
                  <button type="button" onClick={() => { void navigator.clipboard?.writeText(link(m)).then(() => { setCopied(m.id); setTimeout(() => setCopied(""), 1500); }); }} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">{copied === m.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{T("Copy link", "Link copy")}</button>
                </div>
              </div>
            )}
            <RightsPicker hi={hi} title={e.title} rights={e.rights} onChange={(title, rights) => setEdits({ ...edits, [m.id]: { title, rights } })} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!changed || busy === m.id} onClick={async () => { if (await patch(m, e)) { const n = { ...edits }; delete n[m.id]; setEdits(n); } }} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === m.id && <LoaderCircle className="h-4 w-4 animate-spin" />}{T("Save rights", "Rights सेव करें")}</button>
              <button type="button" disabled={busy === m.id} onClick={() => void patch(m, { active: !m.active })} className="rounded-xl border border-border px-3 py-2 text-sm">{m.active ? T("Stop login", "Login बंद करें") : T("Start again", "फिर चालू")}</button>
              {m.joined && <button type="button" disabled={busy === m.id} onClick={() => { if (confirm(T("Make a new invite code? The old one stops working.", "नया invite code बनाएँ? पुराना बंद हो जाएगा।"))) void patch(m, { regenerate: true }); }} className="rounded-xl border border-border px-3 py-2 text-sm">{T("New code", "नया code")}</button>}
              <button type="button" disabled={busy === m.id} onClick={() => void remove(m)} className="ml-auto inline-flex items-center gap-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> {T("Remove", "हटाएँ")}</button>
            </div>
          </Fold>
        );
      })}
    </div>
  );
}
