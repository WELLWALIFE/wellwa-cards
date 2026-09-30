"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Plus, Star, Trash2, Pencil } from "lucide-react";
import { api, isLoggedIn, setCurrentProfileId, PERSONAS, type Profile } from "@/lib/poster-client";
import { ProfileForm, emptyDraft, fromProfile, type ProfileDraft } from "@/components/poster/profile-form";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";


// One household, many profiles: papa's shop, mummy's boutique, the kids.
export default function ProfilesPage() {
  const router = useRouter();
  const [list, setList] = useState<Profile[] | null>(null);
  const [editing, setEditing] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useT();

  async function load() {
    if (!(await isLoggedIn())) { router.push("/login?next=/poster/profiles"); return; }
    const r = await api<{ profiles: Profile[] }>("/api/poster/profiles");
    setList(r.data.profiles ?? []);
  }
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!editing) return;
    setBusy(true); setErr("");
    const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: editing });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || t.saveFail); return; }
    setEditing(null); load();
  }
  async function makeDefault(p: Profile) {
    await api("/api/poster/profiles", { method: "POST", json: { ...fromProfile(p), is_default: true } });
    setCurrentProfileId(p.id); load();
  }
  async function remove(p: Profile) {
    if (!confirm(t.removeProfile(p.name))) return;
    await api(`/api/poster/profiles?id=${p.id}`, { method: "DELETE" }); load();
  }

  if (list === null) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  if (editing) return (
    <div className="space-y-4">
      <button type="button" onClick={() => setEditing(null)} className="text-sm text-brand-ink">{t.back}</button>
      <h1 className="text-lg font-bold">{editing.id ? t.editProfile : t.newProfile}</h1>
      <ProfileForm draft={editing} onChange={setEditing} onSubmit={save} busy={busy} submitLabel={editing.id ? t.save : t.addProfile} />
      {err && <p className="text-sm text-danger">{err}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{t.profiles}</h1>
        <button type="button" onClick={() => setEditing(emptyDraft("personal"))} disabled={list.length >= 5}
          className="inline-flex items-center gap-1 rounded-full grad-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          <Plus className="h-4 w-4" /> {t.add}
        </button>
      </div>
      <Guide hi="Profile = poster पर कौन-सा नाम, फ़ोटो, नंबर आएगा। परिवार/दुकान के लिए अलग-अलग profile बना सकते हैं।" en="Profile = which name, photo and number go on the poster. Make separate profiles for family/shop." />
      <Link href="/poster/products" className="block rounded-xl border border-brand bg-brand-soft/40 p-3 text-sm font-semibold text-brand-ink">📦 {t.productsTitle} →</Link>
      <div className="space-y-2">
        {list.map((p) => {
          const meta = PERSONAS.find((x) => x.key === p.persona);
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
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
              <button type="button" onClick={() => setEditing(fromProfile(p))} className="p-2 text-muted"><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => remove(p)} className="p-2 text-muted"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
