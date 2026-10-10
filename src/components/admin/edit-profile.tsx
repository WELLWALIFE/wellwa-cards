"use client";
// Super Admin → user → "Edit profile": name, username, mobile, email, photo, date of birth, gender and the business
// details, saved to the login, the profile, the poster profile and the partner ID in one go (/api/admin/profile).
import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";

type Business = { name?: string; role?: string; reach?: string; category?: string; city?: string; address?: string; about?: string; website?: string; map?: string; gstin?: string };
type Loaded = {
  email: string; phone: string; meta: Record<string, unknown>; username: string | null; fullName: string | null; mobileLogin?: boolean; contactEmail?: string;
  posterProfile: { id: string; name: string; phone: string | null } | null;
  partner: { code: string; username: string | null; name: string; mobile: string | null; email: string | null; status: string; dob: string | null; gender: string | null } | null;
};

const ROLES: [string, string][] = [["business", "Business / shop"], ["professional", "Professional (doctor, CA…)"], ["agent", "Agent / network (e.g. Shubhora partner)"], ["personal", "Personal"]];
const REACH: [string, string][] = [["local", "Local (my city)"], ["india", "Pan India"], ["online", "Online"]];

export function EditProfile({ id, headers, onClose, onSaved }: { id: string; headers: () => Promise<Record<string, string>>; onClose: () => void; onSaved: (msg: string) => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", username: "", phone: "", email: "", photoUrl: "", dob: "", gender: "" });
  const [biz, setBiz] = useState<Business>({});
  const [syncPartner, setSyncPartner] = useState(true);
  const [syncPoster, setSyncPoster] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/admin/profile?id=${id}`, { headers: await headers(), cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || `Error ${r.status}`); return; }
      const d = j as Loaded; const md = d.meta as Record<string, unknown>;
      setData(d);
      const phoneDigits = String(md.phone ?? d.phone ?? d.partner?.mobile ?? "").replace(/\D/g, "").slice(-10);
      setF({
        name: String(md.display_name ?? md.full_name ?? md.name ?? d.fullName ?? d.partner?.name ?? ""),
        username: d.username ?? d.partner?.username ?? "",
        phone: phoneDigits, email: d.mobileLogin ? (d.contactEmail || d.partner?.email || "") : d.email,
        photoUrl: String(md.photo_url ?? ""), dob: String(md.dob ?? d.partner?.dob ?? ""), gender: String(md.gender ?? d.partner?.gender ?? ""),
      });
      setBiz((md.business && typeof md.business === "object" ? md.business : {}) as Business);
    })();
  }, [id, headers]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setB = (k: keyof Business) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setBiz((x) => ({ ...x, [k]: e.target.value }));
  const usernameChanged = !!data && (f.username || "") !== (data.username ?? data.partner?.username ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (usernameChanged && !confirm(`Change username to "${f.username}"?\n\nTheir referral (join) links and the name their team sees change too. Links already shared with the old username stop working.`)) return;
    setBusy(true); setErr("");
    const body: Record<string, unknown> = { id, name: f.name, phone: f.phone, photoUrl: f.photoUrl, dob: f.dob, gender: f.gender, business: biz, partner: syncPartner, posterProfile: syncPoster };
    if (f.email || data?.mobileLogin) body.email = f.email;   // a mobile sign-up may also clear its contact email
    if (usernameChanged) body.username = f.username;
    const r = await fetch("/api/admin/profile", { method: "PATCH", headers: await headers(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || `Error ${r.status}`); return; }
    onSaved(`Saved: ${(j.done ?? []).join(", ")}.${j.partnerNote ? ` ${j.partnerNote}` : ""}`);
  }

  const inp = "ed-input mt-1";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-surface p-5 shadow-float space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <button type="button" onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {!data && !err && <p className="text-sm text-muted inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</p>}
        {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        {data && (
          <>
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-faint">Person</p>
              <label className="block"><span className="text-xs font-medium text-muted">Name</span><input className={inp} value={f.name} onChange={set("name")} required minLength={2} /></label>
              <label className="block"><span className="text-xs font-medium text-muted">Username (referral links, partner name)</span><input className={`${inp} mono`} value={f.username} onChange={(e) => setF((x) => ({ ...x, username: e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20) }))} placeholder="4–20 letters, numbers or _" />
                {usernameChanged && <span className="mt-1 block text-[11px] text-amber-700">Changing it changes their join links — old links stop working.</span>}</label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-muted">Mobile{data?.mobileLogin ? " (also the login)" : ""}</span><input className={inp} value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} inputMode="numeric" placeholder="10 digits" /></label>
                <label className="block"><span className="text-xs font-medium text-muted">{data.mobileLogin ? "Contact email" : "Email"}</span><input className={inp} type="email" value={f.email} onChange={set("email")} placeholder={data.mobileLogin ? "e.g. name@gmail.com" : ""} />
                  {data.mobileLogin && <span className="mt-1 block text-[11px] text-muted">Signs in with the mobile; this email is for contact, welcome mails and the card.</span>}</label>
                <label className="block"><span className="text-xs font-medium text-muted">Date of birth</span><input className={inp} type="date" value={f.dob} onChange={set("dob")} /></label>
                <label className="block"><span className="text-xs font-medium text-muted">Gender</span>
                  <select className={inp} value={f.gender} onChange={set("gender")}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
              </div>
              <label className="block"><span className="text-xs font-medium text-muted">Photo URL</span><input className={inp} value={f.photoUrl} onChange={set("photoUrl")} placeholder="https://…" /></label>
              {f.photoUrl && /^https?:\/\//.test(f.photoUrl) && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={f.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover border border-border" />)}
            </section>

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-faint">Business</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2"><span className="text-xs font-medium text-muted">Business / company name</span><input className={inp} value={biz.name ?? ""} onChange={setB("name")} /></label>
                <label className="block"><span className="text-xs font-medium text-muted">Type</span><select className={inp} value={biz.role ?? ""} onChange={setB("role")}><option value="">—</option>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="block"><span className="text-xs font-medium text-muted">Reach</span><select className={inp} value={biz.reach ?? ""} onChange={setB("reach")}><option value="">—</option>{REACH.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="block"><span className="text-xs font-medium text-muted">Category</span><input className={inp} value={biz.category ?? ""} onChange={setB("category")} placeholder="e.g. mlm, doctor, restaurant" /></label>
                <label className="block"><span className="text-xs font-medium text-muted">City</span><input className={inp} value={biz.city ?? ""} onChange={setB("city")} /></label>
                <label className="block col-span-2"><span className="text-xs font-medium text-muted">Address</span><input className={inp} value={biz.address ?? ""} onChange={setB("address")} /></label>
                <label className="block"><span className="text-xs font-medium text-muted">Website</span><input className={inp} value={biz.website ?? ""} onChange={setB("website")} /></label>
                <label className="block"><span className="text-xs font-medium text-muted">GSTIN</span><input className={`${inp} mono`} value={biz.gstin ?? ""} onChange={setB("gstin")} /></label>
                <label className="block col-span-2"><span className="text-xs font-medium text-muted">Google Maps link</span><input className={inp} value={biz.map ?? ""} onChange={setB("map")} /></label>
                <label className="block col-span-2"><span className="text-xs font-medium text-muted">About</span><textarea className={inp} rows={3} value={biz.about ?? ""} onChange={setB("about")} /></label>
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-border p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-faint">Also update</p>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={syncPartner} onChange={(e) => setSyncPartner(e.target.checked)} disabled={!data.partner} />
                <span>Partner ID {data.partner ? <b className="mono">{data.partner.code}</b> : <span className="text-faint">(none)</span>} — name, username, mobile, email, DOB, gender <span className="block text-[11px] text-muted">So the User Panel, Staff Admin and the tree show the same details. Recorded in the activity log.</span></span></label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={syncPoster} onChange={(e) => setSyncPoster(e.target.checked)} disabled={!data.posterProfile} />
                <span>Poster profile {data.posterProfile ? <b>{data.posterProfile.name}</b> : <span className="text-faint">(none)</span>} — the name and number printed on daily posters</span></label>
              <p className="text-[11px] text-faint">The card itself (its text and link) is edited in the card editor — use “Login as” to open it.</p>
            </section>

            {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg grad-brand py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save profile"}</button>
          </>
        )}
      </form>
    </div>
  );
}
