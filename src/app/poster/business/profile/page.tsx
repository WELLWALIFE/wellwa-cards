"use client";
// Business › Profile — the partner profile. Name and mobile belong to the app account (Onboard › You); here: email (until linked), photo, password,
// the welcome letter, invoices (each opens in a new tab) and the TDS statement. The password is changed on the app login itself (/api/business/password).
import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, InvoiceLink, bizAct, bizPassword, dayOf, rupee, useBiz, useBizMsg } from "@/components/business/kit";
import { KycPhoto } from "@/components/business/kyc-photo";

type Prof = {
  username: string | null; code: string; status: "red" | "green"; name: string; mobile: string | null; email: string | null; dob: string | null; gender: string | null;
  sponsor: string | null; placedUnder: { code: string; leg: "left" | "right" } | null; joined: string | null; subValidUntil: string | null;
  linked: boolean; suiteEmail: string | null; photoEnabled: boolean; photoUrl: string | null;
  invoices: { id: number; invoiceNo: string; kind: string; totalPaise: number; day: string; status: string; url: string | null }[];
  tds: { fy: string; grossPaise: number; tdsPaise: number }[];
};

const GENDER: Record<string, [string, string]> = { male: ["Male", "पुरुष"], female: ["Female", "महिला"], other: ["Other", "अन्य"] };

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 border-b border-border py-1.5 last:border-0"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>;

function useAction(page: string) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(fields: Record<string, unknown>, then?: () => void) {
    setBusy(true); setMsg(null);
    const r = await bizAct<{ ok?: string }>(page, fields);
    setBusy(false); setMsg({ ok: r.ok, text: r.ok ? r.data.ok ?? "" : r.error ?? "" });
    if (r.ok) then?.();
  }
  return { busy, msg, run, setMsg, setBusy };
}
const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) => {
  const tr = useBizMsg();
  return m ? <p className={`text-sm font-semibold ${m.ok ? "text-good" : "text-danger"}`}>{tr(m.text)}</p> : null;
};
const BTN = "w-full rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60";

export default function ProfilePage() {
  const { lang } = useT(); const en = lang === "en";
  const { data, error, loading, reload } = useBiz<Prof>("profile");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState({ current: "", password: "", password2: "" });
  const [photoId, setPhotoId] = useState<string | null>(null);
  const em = useAction("profile"); const pa = useAction("profile"); const ph = useAction("profile");

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pa.busy) return;
    pa.setBusy(true); pa.setMsg(null);
    const r = await bizPassword(pw);
    pa.setBusy(false); pa.setMsg(r);
    if (r.ok) setPw({ current: "", password: "", password2: "" });
  }

  return (
    <BizShell title={en ? "Profile" : "प्रोफ़ाइल"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className={`${CARD} text-sm`}>
              <Row k={en ? "Username" : "Username"} v={data.username ?? "—"} />
              <Row k={en ? "Account no. (for support)" : "खाता नंबर (support के लिए)"} v={<span className="font-mono text-muted">{data.code}</span>} />
              <Row k="ID" v={data.status === "green" ? "Green" : "Red"} />
              <Row k={en ? "Name" : "नाम"} v={data.name} />
              <Row k={en ? "Mobile" : "मोबाइल"} v={data.mobile ?? "—"} />
              {(data.dob || data.gender) && <Row k={en ? "Birth date · Gender" : "जन्म तारीख · लिंग"} v={`${data.dob ? dayOf(data.dob) : "—"} · ${data.gender ? (GENDER[data.gender] ? GENDER[data.gender][en ? 0 : 1] : data.gender) : "—"}`} />}
              <Row k={en ? "Sponsor" : "Sponsor"} v={data.sponsor ?? "—"} />
              <Row k={en ? "Placed under" : "इनके नीचे"} v={data.placedUnder ? `${data.placedUnder.code} · ${data.placedUnder.leg === "left" ? (en ? "Left side" : "Left side") : (en ? "Right side" : "Right side")}` : "—"} />
              <Row k={en ? "Joined" : "जुड़े"} v={dayOf(data.joined) || "—"} />
              <Row k={en ? "Subscription till" : "Subscription कब तक"} v={dayOf(data.subValidUntil) || "—"} />
              <p className="pt-2 text-xs text-muted">{en ? "To change name or mobile, " : "नाम या मोबाइल बदलने के लिए "}<Link href="/poster/onboard?step=you&back=/poster/business/profile" className="font-semibold text-brand">{en ? "open your account details" : "अपनी account details खोलें"}</Link>.</p>
            </div>

            {data.photoEnabled && (
              <div className={`${CARD} space-y-3`}>
                <p className="font-bold">{en ? "Profile photo" : "प्रोफ़ाइल फ़ोटो"}</p>
                <KycPhoto kind="photo" maxDim={600} label={en ? "Photo" : "फ़ोटो"} id={photoId ?? (data.photoUrl ? "current" : "")} currentUrl={data.photoUrl} onChange={setPhotoId} />
                <Msg m={ph.msg} />
                <button type="button" disabled={ph.busy || photoId === null} onClick={() => void ph.run({ op: "set_photo", file: photoId }, reload)} className={BTN}>{en ? "Save photo" : "फ़ोटो सेव करें"}</button>
              </div>
            )}

            <div className={`${CARD} space-y-3`}>
              <p className="font-bold">{en ? "Email" : "ईमेल"}</p>
              {data.linked
                ? <p className="text-sm text-muted">{en ? "Your Shubhora login email: " : "आपका Shubhora login ईमेल: "}<b className="text-ink">{data.suiteEmail}</b></p>
                : <form onSubmit={(e) => { e.preventDefault(); void em.run({ op: "set_email", email }, reload); }} className="space-y-3">
                    <input type="email" required className="ed-input" placeholder={data.email ?? "name@email.com"} value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Msg m={em.msg} />
                    <button type="submit" disabled={em.busy} className={BTN}>{en ? "Save" : "सेव करें"}</button>
                  </form>}
            </div>

            <form onSubmit={changePassword} className={`${CARD} space-y-3`}>
              <p className="font-bold">{en ? "Change password" : "पासवर्ड बदलें"}</p>
              <input type="password" required autoComplete="current-password" className="ed-input" placeholder={en ? "Current password" : "अभी का पासवर्ड"} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              <input type="password" required autoComplete="new-password" className="ed-input" placeholder={en ? "New password (8 or more letters)" : "नया पासवर्ड (8 या ज़्यादा अक्षर)"} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
              <input type="password" required autoComplete="new-password" className="ed-input" placeholder={en ? "New password again" : "नया पासवर्ड दोबारा"} value={pw.password2} onChange={(e) => setPw({ ...pw, password2: e.target.value })} />
              <p className="text-xs text-muted">{en ? "This is the password you log in to Shubhora with. Signed in with Google and never made a password? Tap " : "यह वही पासवर्ड है जिससे आप Shubhora में login करते हैं। Google से login करते हैं और पासवर्ड नहीं बनाया? पासवर्ड बनाने के लिए "}<Link href="/forgot" className="font-semibold text-brand">Forgot password?</Link>{en ? " to make one." : " दबाएँ।"}</p>
              <Msg m={pa.msg} />
              <button type="submit" disabled={pa.busy} className={BTN}>{en ? "Change password" : "पासवर्ड बदलें"}</button>
            </form>

            <Link href="/poster/business/welcome-letter" className={`${CARD} flex items-center gap-3`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink"><FileText className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{en ? "Welcome letter" : "Welcome letter (स्वागत पत्र)"}</span>
                <span className="block text-xs text-muted">{en ? "Your partner details on one page. You can print it or save it as a PDF." : "आपकी partner details एक पन्ने पर। Print या PDF save कर सकते हैं।"}</span>
              </span>
            </Link>

            <div className={CARD}>
              <p className="mb-2 font-bold">{en ? "Invoices" : "Invoice"}</p>
              {data.invoices.length === 0 ? <p className="text-sm text-muted">{en ? "No invoices yet." : "अभी कोई invoice नहीं।"}</p> : data.invoices.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
                  <div><p className="font-mono text-xs">{x.invoiceNo}</p><p className="text-xs capitalize text-muted">{dayOf(x.day)} · {x.kind}</p><InvoiceLink url={x.url} /></div>
                  <div className="text-right"><p className="font-semibold">{rupee(x.totalPaise)}</p><p className={`text-xs font-semibold ${x.status === "paid" ? "text-good" : "text-danger"}`}>{x.status === "paid" ? (en ? "Paid" : "चुकाया") : (en ? "Refunded" : "वापस")}</p></div>
                </div>
              ))}
            </div>

            <div className={CARD}>
              <p className="mb-2 font-bold">{en ? "TDS statement" : "TDS का हिसाब"}</p>
              {data.tds.length === 0 ? <p className="text-sm text-muted">{en ? "No income yet." : "अभी कोई कमाई नहीं।"}</p> : data.tds.map((t) => (
                <div key={t.fy} className="flex justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
                  <span className="font-semibold">{t.fy}</span>
                  <span className="text-right text-xs text-muted">{en ? "Earned" : "कमाई"} {rupee(t.grossPaise)} · TDS {rupee(t.tdsPaise)} · <b className="text-ink">{en ? "Net" : "बचा"} {rupee(t.grossPaise - t.tdsPaise)}</b></span>
                </div>
              ))}
            </div>
          </>
        )}
      </BizState>
    </BizShell>
  );
}
