"use client";
// "Photos & more" in a focused edit: every photograph that is on the website, one by one — the banner on top, the picture
// beside the About text, the gallery — each with Replace, Make by AI and Remove, the size it wants written under it, and
// "+ Add" for more (owner, 14 Oct 2026). An owner's own picture is fitted to the size of its place before it is sent, and
// compressed, so the page stays light. Every tap changes the live website at once (/api/card/photos).
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, Plus, Search, Sparkles, Tag, Trash2 } from "lucide-react";
import { api, uploadImage } from "@/lib/poster-client";
import { UnlockDialog } from "@/lib/ai-access";

type Slot = { id: string; kind: "banner" | "about" | "gallery"; url: string; label: string; group?: string; size: string; ours: boolean; stock: boolean };
type Got = { slots?: Slot[]; max?: number; error?: string; needCredits?: number; ideas?: string[] };

/** The slot's width ÷ height, and the width the picture is cut to. */
const FIT = { banner: { r: 16 / 9, w: 1600 }, about: { r: 4 / 3, w: 1200 }, gallery: { r: 4 / 3, w: 1200 } } as const;

/** The photo cut to the place's shape from its centre and brought down to the place's width: JPEG, about 200 KB. */
async function fitTo(file: File, kind: Slot["kind"]): Promise<File> {
  const { r, w } = FIT[kind];
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not an image")); i.src = url; });
    let sw = img.naturalWidth, sh = img.naturalHeight;
    if (sw / sh > r) sw = Math.round(sh * r); else sh = Math.round(sw / r);
    const sx = Math.round((img.naturalWidth - sw) / 2), sy = Math.round((img.naturalHeight - sh) / 2);
    const tw = Math.min(w, sw), th = Math.round(tw / r);
    const c = document.createElement("canvas"); c.width = tw; c.height = th;
    c.getContext("2d")?.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } finally { URL.revokeObjectURL(url); }
}

/** `scope`: "card" = the phone card's own banner, "site" = the website's own banner (each has its own); every other photo is shared. */
export function SitePhotos({ hi, cardId, scope }: { hi: boolean; cardId?: string; scope?: "card" | "site" }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [max, setMax] = useState(12);
  const [busy, setBusy] = useState("");   // "<slot id>:<what>" or "add" / "add-ai"
  // A message belongs to ONE place (E1): `at` is the tile it came from (a slot id), "add" (the two Add buttons of the gallery) or "top" (the page failed to load).
  // It is shown under that tile's buttons, brought into view, and cleared the moment anything is tried again.
  const [err, setErrState] = useState<{ at: string; msg: string } | null>(null);
  const setErr = (msg: string, at = "top") => setErrState(msg ? { at, msg } : null);
  const errRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (err) errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [err]);
  const [pay, setPay] = useState(false);
  // Album headings ("Opening ceremony", "Seminar"): the ideas for this trade, the heading a new photo goes under, the heading
  // being edited on a photo, and the filter / search over the gallery.
  const [ideas, setIdeas] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [headFor, setHeadFor] = useState("");
  const [headVal, setHeadVal] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [q, setQ] = useState("");   // not enough credits: the Razorpay popup
  const pick = useRef<HTMLInputElement>(null);
  const target = useRef<string>("");       // the slot a chosen file is for ("" = a new gallery photo)
  const lock = useRef(false);               // one change at a time: a second tap in the same moment would be charged and then undo the first

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ ...(cardId ? { cardId } : {}), ...(scope ? { scope } : {}) }).toString();
    const r = await api<Got>(`/api/card/photos${qs ? `?${qs}` : ""}`);
    if (r.ok) { setSlots(r.data.slots ?? []); setMax(r.data.max ?? 12); setIdeas(r.data.ideas ?? []); } else { setSlots([]); setErr(r.data.error ?? T("Could not load the photos.", "Photos नहीं खुलीं।")); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(key: string, body: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true;
    const at = key === "add" || key === "add-ai" ? "add" : key.slice(0, key.lastIndexOf(":"));   // the tile (or the Add buttons) that was tapped
    setBusy(key); setErr("");
    try {
      // `expect` is the picture the owner was looking at: if the numbering moved meanwhile the server says so instead of changing another one.
      const slot = typeof body.slot === "string" ? body.slot : "";
      const r = await api<Got & { ok?: boolean; stale?: boolean }>("/api/card/photos", { method: "POST", json: { ...body, ...(cardId ? { cardId } : {}), ...(scope ? { scope } : {}), ...(slot ? { expect: slots?.find((x) => x.id === slot)?.url } : {}) } });
      if (!r.ok) {
        if (r.status === 402) { setPay(true); return; }
        setErr(r.data.error ?? T("Something went wrong. Please try again.", "कुछ गड़बड़ हुई। दोबारा try करें।"), at);
        if (r.status === 409) void load();
        return;
      }
      if (r.data.slots) setSlots(r.data.slots);
    } catch {
      setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"), at);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function chosen(file: File | null) {
    const slot = target.current;
    if (!file) return;
    const kind: Slot["kind"] = slot === "banner" || slot === "cardbanner" || slot === "sitebanner" ? "banner" : slot.startsWith("about:") ? "about" : "gallery";
    const key = slot ? `${slot}:replace` : "add";
    const at = slot || "add";
    if (lock.current) return;
    setErr("");
    let fitted: File;
    try { fitted = await fitTo(file, kind); } catch { setErr(T("That file is not a photo.", "ये file photo नहीं है।"), at); return; }
    setBusy(key); setErr("");
    let url: string | null = null;
    try { url = await uploadImage(fitted, "wide"); } catch { url = null; }
    if (!url) { setBusy(""); setErr(T("The photo could not be uploaded. Please try again.", "Photo upload नहीं हुई। दोबारा try करें।"), at); return; }
    await run(key, slot ? { action: "replace", slot, url } : { action: "add", url, group: newGroup });
  }
  const choose = (slot: string) => { target.current = slot; pick.current?.click(); };

  if (!slots) return <div className="flex items-center gap-2 rounded-2xl border border-border p-4 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> {T("Loading your photos…", "आपकी photos खुल रही हैं…")}</div>;

  const banner = slots.find((s) => s.kind === "banner");
  const about = slots.filter((s) => s.kind === "about");
  const gallery = slots.filter((s) => s.kind === "gallery");
  const groups = [...new Set(gallery.map((x) => (x.group ?? "").trim()).filter(Boolean))];
  const ql = q.trim().toLowerCase();
  const shownGallery = gallery.filter((x) => (!fGroup || x.group === fGroup) && (!ql || `${x.group ?? ""} ${x.label}`.toLowerCase().includes(ql)));
  const tag = (s: Slot) => s.ours ? T("Made by AI", "AI से बनी") : s.stock ? T("Sample picture", "नमूना picture") : T("Your photo", "आपकी photo");
  const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-semibold disabled:opacity-50";

  // Where the message is shown: under its tile / the Add buttons; if that tile is not on screen any more (renumbered after a refresh, filtered out), at the top instead — never nowhere.
  const onScreen = (id: string) => id === "add" ? gallery.length < max : [banner?.id, ...about.map((x) => x.id), ...shownGallery.map((x) => x.id)].includes(id);
  const errHere = (id: string) => err && (err.at === id || (err.at !== "top" && id === "top" && !onScreen(err.at))) ? (
    <p ref={errRef} role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">{err.msg}</p>
  ) : null;

  const tile = (s: Slot) => {
    const working = busy.startsWith(`${s.id}:`);
    return (
      <div key={s.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="relative bg-surface2" style={{ aspectRatio: s.kind === "banner" ? "16 / 9" : "4 / 3" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.url ? <img src={s.url} alt={s.label} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            : <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-muted">{T("No banner yet — add one below", "अभी banner नहीं है — नीचे से लगाएँ")}</span>}
          {s.url && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{tag(s)}</span>}
          {working && <span className="absolute inset-0 grid place-items-center bg-black/45 text-xs font-semibold text-white"><span className="flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> {busy.endsWith(":ai") ? T("Making… about 30 seconds", "बन रही है… लगभग 30 सेकंड") : T("Please wait…", "रुकिए…")}</span></span>}
        </div>
        <div className="space-y-2 p-2.5">
          {s.kind === "gallery" && (headFor === s.id ? (
            <div className="space-y-1.5 rounded-lg bg-surface2 p-2">
              <input value={headVal} onChange={(e) => setHeadVal(e.target.value.slice(0, 40))} placeholder={T("Heading", "Heading")} className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs" autoFocus />
              <div className="flex flex-wrap gap-1">{[...new Set([...groups, ...ideas])].slice(0, 8).map((g) => <button key={g} type="button" onClick={() => setHeadVal(g)} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px]">{g}</button>)}</div>
              <div className="flex gap-1.5">
                <button type="button" disabled={!!busy} onClick={() => { void run(`${s.id}:group`, { action: "group", slot: s.id, group: headVal }); setHeadFor(""); }} className="flex-1 rounded-lg grad-brand py-1.5 text-xs font-semibold text-white disabled:opacity-50">{T("Save heading", "Heading save करें")}</button>
                <button type="button" onClick={() => setHeadFor("")} className="rounded-lg border border-border px-2.5 py-1.5 text-xs">{T("Cancel", "रहने दें")}</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => { setHeadFor(s.id); setHeadVal(s.group ?? ""); }} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-brand-ink disabled:opacity-50"><Tag className="h-3 w-3 shrink-0" /> <span className="truncate">{s.group ? s.group : T("Add a heading", "Heading जोड़ें")}</span></button>
          ))}
          <p className="text-sm font-semibold">{s.id === "cardbanner" ? T("Card banner (only on your phone card)", "Card का banner (सिर्फ़ phone card पर)") : s.id === "sitebanner" ? T("Website banner (only on your website)", "Website का banner (सिर्फ़ website पर)") : s.kind === "banner" ? T("Top banner", "ऊपर का banner") : s.kind === "about" ? T("About picture", "परिचय की picture") : s.label}</p>
          <p className="text-[11px] text-muted">{T("Any photo works — we fit it.", "कोई भी photo चलेगी, हम fit कर देंगे।")}</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" className={btn} disabled={!!busy} onClick={() => choose(s.id)}><Camera className="h-3.5 w-3.5" /> {T("Replace", "बदलें")}</button>
            <button type="button" className={btn} disabled={!!busy} onClick={() => void run(`${s.id}:ai`, { action: "ai", slot: s.id })}><Sparkles className="h-3.5 w-3.5 text-brand" /> {T("Make by AI", "AI से बनाएँ")}</button>
            {s.kind === "banner"
              ? <span />
              : <button type="button" className={`${btn} text-danger`} disabled={!!busy} onClick={() => { if (window.confirm(T("Take this photo off the website?", "इस photo को website से हटाएँ?"))) void run(`${s.id}:remove`, { action: "remove", slot: s.id }); }}><Trash2 className="h-3.5 w-3.5" /> {T("Remove", "हटाएँ")}</button>}
          </div>
          {errHere(s.id)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {pay && <UnlockDialog onClose={() => setPay(false)} />}
      <input ref={pick} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void chosen(f); }} />
      {scope && <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-xs font-semibold text-ink">{scope === "card"
        ? T("Banner: card only. Other photos: card + website.", "Banner: सिर्फ़ card का। बाकी photos: card + website दोनों।")
        : T("Banner: website only. Other photos: card + website.", "Banner: सिर्फ़ website का। बाकी photos: card + website दोनों।")}</p>}
      <p className="text-xs text-muted">{T("Tap to change. It shows on your website at once. “Make by AI” = 1 credit.", "बदलने के लिए दबाएँ, website पर तुरंत दिखेगा। “AI से बनाएँ” = 1 credit।")}</p>
      {errHere("top")}
      {banner && <section className="space-y-2"><h3 className="text-sm font-bold">{T("Banner", "Banner")}</h3>{tile(banner)}</section>}
      {about.length > 0 && <section className="space-y-2"><h3 className="text-sm font-bold">{T("About", "परिचय")}</h3><div className="grid grid-cols-2 gap-2.5">{about.map((s) => tile(s))}</div></section>}
      <section className="space-y-2">
        <h3 className="text-sm font-bold">{T("Gallery", "Gallery")} <span className="font-normal text-muted">({gallery.length}/{max})</span></h3>
        <p className="text-xs text-muted">{T("Group photos under a heading, e.g. “Seminar”.", "Photos को heading में रखें, जैसे “Seminar”।")}</p>
        {(groups.length > 0 || gallery.length > 6) && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"><Search className="h-4 w-4 shrink-0 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search a heading", "Heading खोजें")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {["", ...groups].map((g) => <button key={g || "all"} type="button" onClick={() => setFGroup(g)} className={`rounded-full px-3 py-1 text-xs font-semibold ${fGroup === g ? "bg-brand text-white" : "bg-surface2 text-muted"}`}>{g || T("All", "सब")}{g ? ` · ${gallery.filter((x) => x.group === g).length}` : ""}</button>)}
              </div>
            )}
          </div>
        )}
        {shownGallery.length > 0 && <div className="grid grid-cols-2 gap-2.5">{shownGallery.map((s2) => tile(s2))}</div>}
        {gallery.length > 0 && shownGallery.length === 0 && <p className="text-xs text-muted">{T("No photo under that heading.", "इस heading के नीचे कोई photo नहीं है।")}</p>}
        {gallery.length < max && (
          <div className="space-y-1.5 rounded-xl bg-surface2 p-2.5">
            <p className="text-xs font-semibold">{T("Heading for the photo you add next (optional)", "अगली जोड़ी जाने वाली photo की heading (optional)")}</p>
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value.slice(0, 40))} placeholder={T("e.g. Opening ceremony", "जैसे उद्घाटन समारोह")} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-1.5">{[...new Set([...groups, ...ideas])].slice(0, 12).map((g) => <button key={g} type="button" onClick={() => setNewGroup(g)} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${newGroup === g ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`}>{g}</button>)}</div>
          </div>
        )}
        {gallery.length < max && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!!busy} onClick={() => choose("")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-3 text-sm font-semibold disabled:opacity-50">{busy === "add" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {T("Add a photo", "photo जोड़ें")}</button>
            <button type="button" disabled={!!busy} onClick={() => void run("add-ai", { action: "ai", group: newGroup })} className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand/50 py-3 text-sm font-semibold text-brand-ink disabled:opacity-50">{busy === "add-ai" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {T("Add one by AI", "AI से एक जोड़ें")}</button>
          </div>
        )}
        {gallery.length < max && errHere("add")}
        {gallery.length >= max && <p className="text-xs text-muted">{T(`The gallery is full (${max} photos). Remove one to add another.`, `Gallery भर गई है (${max} photos)। नई जोड़ने के लिए कोई एक हटाएँ।`)}</p>}
        {gallery.length === 0 && !busy && <p className="text-xs text-muted">{T("No gallery photos yet. Add your first one.", "अभी gallery में कोई photo नहीं है। पहली जोड़िए।")}</p>}
      </section>
    </div>
  );
}
