"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Star, Trash2, Pencil, ChevronLeft } from "lucide-react";
import { api, isLoggedIn, setCurrentProfileId, PERSONAS, type Profile } from "@/lib/poster-client";
import { ProfileForm, emptyDraft, fromProfile, type ProfileDraft } from "@/components/poster/profile-form";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { goBack } from "@/lib/nav-back";


// One household, many profiles: papa's shop, mummy's boutique, the kids.
export default function ProfilesPage() {
  const router = useRouter();
  const [list, setList] = useState<Profile[] | null>(null);
  const [editing, setEditing] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // A failed Make-default / Remove says so inside THAT profile's row, under its buttons.
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);
  const { t, lang } = useT();
  const en = lang === "en";
  const errRef = useRef<HTMLParagraphElement | null>(null);
  const saveFailed = en ? "Could not save. Please try again." : "Save नहीं हुआ। फिर से कोशिश करें।";

  const noNet = en ? "No internet right now. Check your connection and try again." : "अभी internet नहीं है। Connection देखकर फिर कोशिश करें।";
  async function load() {
    try {
      // replace, not push: Back from the login screen must not land here and bounce straight back to it.
      if (!(await isLoggedIn())) { router.replace("/login?next=/poster/profiles"); return; }
      const r = await api<{ profiles: Profile[] }>("/api/poster/profiles");
      setList(r.data.profiles ?? []);
    } catch {
      // Offline: show the (empty) list with the reason on top instead of a spinner that never ends.
      setList((l) => l ?? []);
      setRowErr({ id: "", text: noNet });
    }
  }
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!editing) return;
    setBusy(true); setErr("");
    const showErr = (m: string) => { setErr(m); setTimeout(() => errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 50); };
    try {
      const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: editing });
      if (!r.ok) { showErr(r.data.error || t.saveFail); return; }
      setEditing(null); load();
    } catch { showErr(noNet); } finally { setBusy(false); }
  }
  async function makeDefault(p: Profile) {
    setRowErr(null);
    try {
      const r = await api<{ error?: string }>("/api/poster/profiles", { method: "POST", json: { ...fromProfile(p), is_default: true } });
      if (!r.ok) { setRowErr({ id: p.id, text: r.data.error || saveFailed }); return; }
      setCurrentProfileId(p.id); load();
    } catch { setRowErr({ id: p.id, text: noNet }); }
  }
  async function remove(p: Profile) {
    if (!confirm(t.removeProfile(p.name))) return;
    setRowErr(null);
    try {
      const r = await api<{ error?: string }>(`/api/poster/profiles?id=${p.id}`, { method: "DELETE" });
      if (!r.ok) { setRowErr({ id: p.id, text: r.data.error || (en ? "Could not remove. Please try again." : "हट नहीं पाया। फिर से कोशिश करें।") }); return; }
      load();
    } catch { setRowErr({ id: p.id, text: noNet }); }
  }

  // One Back per screen: the edit form has its own Back to this list; this arrow leaves the list for the screen the owner was just on (Me, or the logo page's "View profiles").
  // Drawn while loading too (a slow or offline phone must not be left with no Back: this page is in BackBar's OWN_BACK list).
  const backBtn = <button type="button" onClick={() => goBack(router, "/poster/more")} className="text-muted" aria-label={lang === "en" ? "Back" : "पीछे"}><ChevronLeft className="h-5 w-5" /></button>;
  if (list === null) return <div className="space-y-4"><div className="flex items-center gap-2">{backBtn}<h1 className="text-lg font-bold">{t.profiles}</h1></div><div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div></div>;

  if (editing) return (
    <div className="space-y-4">
      <button type="button" onClick={() => { setEditing(null); setErr(""); }} className="text-sm text-brand-ink">{t.back}</button>
      <h1 className="text-lg font-bold">{editing.id ? t.editProfile : t.newProfile}</h1>
      <ProfileForm draft={editing} onChange={setEditing} onSubmit={save} busy={busy} submitLabel={editing.id ? t.save : t.addProfile} />
      {/* Why Save is dimmed, then what went wrong when it ran — right under the Save button. */}
      {!editing.name.trim() && <p className="text-sm font-semibold text-danger">{en ? "Write the name first." : "पहले नाम लिखें।"}</p>}
      {err && <p ref={errRef} role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {backBtn}
          <h1 className="text-lg font-bold">{t.profiles}</h1>
        </div>
        <button type="button" onClick={() => { setErr(""); setRowErr(null); setEditing(emptyDraft("personal")); }} disabled={list.length >= 5}
          className="inline-flex items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          <Plus className="h-4 w-4" /> {t.add}
        </button>
      </div>
      {rowErr?.id === "" && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{rowErr.text}</p>}
      {list.length >= 5 && <p className="text-xs font-semibold text-muted">{en ? "You can keep up to 5 profiles. Remove one to add another." : "ज़्यादा से ज़्यादा 5 profile रख सकते हैं। नया जोड़ने के लिए एक हटाएँ।"}</p>}
      <Guide hi="Profile से तय होता है कि poster पर कौन-सा नाम, फ़ोटो और नंबर आएगा। घर के हर सदस्य या हर दुकान के लिए अलग profile बना सकते हैं।" en="A profile decides which name, photo and number show on your poster. You can make a separate profile for each family member or shop." />
      <Link href="/poster/products" className="block rounded-xl border border-brand bg-brand-soft/40 p-3 text-sm font-semibold text-brand-ink">📦 {t.productsTitle} →</Link>
      <div className="space-y-2">
        {list.map((p) => {
          const meta = PERSONAS.find((x) => x.key === p.persona);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <div className="h-12 w-12 rounded-full bg-surface2 overflow-hidden grid place-items-center text-xl shrink-0">
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                ) : meta?.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{p.name} {p.is_default && <span className="text-[10px] rounded-full bg-brand-soft text-brand-ink px-1.5 py-0.5 ml-1">default</span>}</p>
                <p className="text-xs text-muted truncate">{meta ? t.personas[meta.key][0] : ""}{p.tagline ? ` · ${p.tagline}` : ""}</p>
              </div>
              {!p.is_default && <button type="button" onClick={() => makeDefault(p)} title={t.makeDefault} className="p-2 text-muted"><Star className="h-4 w-4" /></button>}
              <button type="button" onClick={() => { setErr(""); setRowErr(null); setEditing(fromProfile(p)); }} className="p-2 text-muted"><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => remove(p)} className="p-2 text-muted"><Trash2 className="h-4 w-4" /></button>
              {rowErr?.id === p.id && <p role="alert" className="basis-full rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{rowErr.text}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
