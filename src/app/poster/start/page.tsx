"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isLoggedIn, saveDraft, loadDraft, clearDraft, setCurrentProfileId, captureRef, takeRef, clearRef, type Profile, type Persona } from "@/lib/poster-client";
import { ProfileForm, emptyDraft, type ProfileDraft } from "@/components/poster/profile-form";
import { useT } from "@/lib/poster-i18n";

// Onboarding: the form first, login only at the moment of creation — the draft
// survives the round-trip through /login so nobody types twice.
export default function StartPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyDraft("personal"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useT();

  useEffect(() => {
    captureRef();
    const d = loadDraft() as ProfileDraft | null;
    if (d?.persona) setDraft({ ...emptyDraft(d.persona as Persona), ...d });
  }, []);
  useEffect(() => { saveDraft(draft); }, [draft]);

  async function submit() {
    setErr("");
    // replace: this form is only a hand-off to the login and the login returns here; a pushed form stays in the history under the finished
    // set-up, and Back from the set-up list would land on this (by then empty) form and make a second profile. The draft is kept, so nothing is lost.
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/start"); return; }
    setBusy(true);
    const r = await api<{ profile?: Profile; error?: string }>("/api/poster/profiles", { method: "POST", json: { ...draft, is_default: true, ref: takeRef() ?? undefined } });
    setBusy(false);
    if (!r.ok || !r.data.profile) { setErr(r.data.error || t.saveFail); return; }
    clearDraft(); clearRef(); setCurrentProfileId(r.data.profile.id);
    // replace: the profile is made, so Back from the set-up list must not land on this (now empty) form and make a second one.
    router.replace("/poster/setup");
  }

  return (
    <div className="py-4 space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand">SHUBHORA</p>
        <h1 className="text-2xl font-bold mt-1">{t.setupTitle}</h1>
        <p className="text-sm text-muted mt-1">{t.setupSub}</p>
      </div>
      <ProfileForm draft={draft} onChange={setDraft} onSubmit={submit} busy={busy} submitLabel={t.makeMine} />
      {err && <p className="text-sm text-danger">{err}</p>}
      <p className="text-[11px] text-faint text-center">{t.setupNote}</p>
    </div>
  );
}
