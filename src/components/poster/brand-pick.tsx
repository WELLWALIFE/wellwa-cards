"use client";
// "Your name on the video" — the logo (from the ones already in the app, or a new one) and the name to say and show.
// Same block, same words as the Reel page (owner, 27 Oct 2026: "ek ko samjhne ke baad dusra easy lage"); the choice is
// shared with the Reel page through the same saved key.
import { useEffect, useState } from "react";
import { Check, ImagePlus, LoaderCircle } from "lucide-react";
import { api, uploadImage } from "@/lib/poster-client";
import { compressToFile } from "@/lib/image-utils";

export type BrandChoice = { name: string; logo: string };
type Saved = { name?: string; logo?: string; useLogo?: boolean; uploads?: string[] };
const KEY = "reel.identity";
const read = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const save = (x: Saved) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...x })); } catch { /* private window */ } };

export function BrandPick({ hi, firm, brands, phone, onChange, corner = true }: { hi: boolean; firm: string; brands: string[]; phone: string; onChange: (c: BrandChoice) => void; corner?: boolean }) {
  const [logos, setLogos] = useState<{ url: string; label: string }[]>([]);
  const [logo, setLogo] = useState(""); const [useLogo, setUseLogo] = useState(true);
  const [name, setName] = useState(""); const [own, setOwn] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  useEffect(() => { (async () => {
    const s = read();
    const found = (await api<{ logos?: { url: string; label: string }[] }>("/api/poster/logos").catch(() => null))?.data.logos ?? [];
    const all = [...found, ...(s.uploads ?? []).filter((u) => !found.some((x) => x.url === u)).map((u) => ({ url: u, label: "Logo" }))];
    setLogos(all);
    setLogo(all.some((x) => x.url === s.logo) ? s.logo! : all[0]?.url || "");
    if (typeof s.useLogo === "boolean") setUseLogo(s.useLogo);
    setName((n) => n || s.name || "");
  })(); }, []);
  // First brand of the products, else the firm, until the owner picks.
  useEffect(() => { if (!name && (brands[0] || firm)) setName(brands[0] || firm); }, [brands, firm, name]);
  useEffect(() => { onChange({ name, logo: useLogo ? logo : "" }); }, [name, logo, useLogo, onChange]);

  async function add(file: File | null) {
    if (!file) return; setBusy(true); setErr("");
    try { const u = await uploadImage(await compressToFile(file, "logo.png", 800, 1, "png"), "logo"); if (u) { setLogos((l) => [{ url: u, label: "Logo" }, ...l]); setLogo(u); setUseLogo(true); save({ logo: u, useLogo: true, uploads: [u, ...(read().uploads ?? [])].slice(0, 6) }); } else setErr(hi ? "Logo नहीं जुड़ा। फिर try करें।" : "Could not add the logo."); }
    catch { setErr(hi ? "Logo नहीं जुड़ा। फिर try करें।" : "Could not add the logo."); }
    finally { setBusy(false); }
  }
  const names = [...new Set([...brands, firm, name].map((x) => (x ?? "").trim()).filter(Boolean))].slice(0, 5);
  const small = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`;
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[11px] text-muted">{corner ? (hi ? "Logo — हर scene के कोने में और आख़िर में बड़ा" : "Logo — in the corner and big at the end") : (hi ? "Logo — आख़िरी card पर बड़ा" : "Logo — big on the closing card")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {logos.map((l) => { const on = useLogo && logo === l.url; return <button key={l.url} type="button" title={l.label} onClick={() => { setLogo(l.url); setUseLogo(true); save({ logo: l.url, useLogo: true }); }} className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border-2 bg-white p-1 ${on ? "border-brand" : "border-border"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={l.url} alt={l.label} className="max-h-full max-w-full object-contain" />{on && <Check className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-brand p-0.5 text-white" />}</button>; })}
          <label className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-surface2 text-center text-[10px] leading-tight text-muted">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span><ImagePlus className="mx-auto h-4 w-4" />{hi ? "नया" : "New"}</span>}<input type="file" accept="image/*" className="hidden" onChange={(e) => add(e.target.files?.[0] ?? null)} /></label>
          {logos.length > 0 && <button type="button" onClick={() => { setUseLogo(false); save({ useLogo: false }); }} className={`grid h-14 shrink-0 place-items-center rounded-xl border-2 px-3 text-[11px] ${!useLogo ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border text-muted"}`}>{hi ? "बिना logo" : "No logo"}</button>}
        </div>
        {err && <p className="mt-1 text-xs font-semibold text-danger">{err}</p>}
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted">{hi ? "कौन-सा नाम बोला और दिखाया जाए?" : "Which name to say and show?"}</p>
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => <button key={n} type="button" onClick={() => { setName(n); setOwn(false); save({ name: n }); }} className={small(name === n && !own)}>{n}{n === firm && names.length > 1 ? <span className="font-normal text-muted"> · {hi ? "कंपनी" : "company"}</span> : ""}</button>)}
          <button type="button" onClick={() => setOwn(true)} className={`${small(own)} border-dashed`}>+ {hi ? "दूसरा" : "Other"}</button>
        </div>
        {own && <input autoFocus className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" maxLength={40} placeholder={hi ? "जैसे: AlkaFresh" : "e.g. AlkaFresh"} value={name} onChange={(e) => { setName(e.target.value); save({ name: e.target.value }); }} />}
      </div>
      <p className="text-[11px] text-muted">{useLogo && logo ? (hi ? `${corner ? "कोने में logo · " : ""}आख़िर में logo + ${name || "नाम"}${phone ? " + 📞" : ""}` : `${corner ? "Logo in the corner · " : ""}At the end: logo + ${name || "name"}${phone ? " + 📞" : ""}`) : (hi ? `आख़िर में ${name || "नाम"}${phone ? " + 📞" : ""}` : `At the end: ${name || "name"}${phone ? " + 📞" : ""}`)}</p>
    </div>
  );
}
