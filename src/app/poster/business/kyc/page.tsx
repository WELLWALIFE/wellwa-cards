"use client";
// Business › KYC — PAN, bank account and photos of the documents (needed for withdrawals and TDS). Data and checks: partner handler p.kyc.
import { useEffect, useState } from "react";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, bizAct, dayOf, useBiz, useBizMsg } from "@/components/business/kit";
import { KycPhoto } from "@/components/business/kyc-photo";

type FileRef = { id: string; url: string | null } | null;
type Kyc = {
  disabled?: boolean; status: "none" | "pending" | "approved" | "rejected"; rejectReason: string | null; submittedAt: string | null; canEdit: boolean;
  panMasked: string | null; accountLast4: string | null; aadhaarLast4: string | null;
  values: { pan_name: string; bank_name: string; account_name: string; ifsc: string; nominee: string; address: string; gstin: string };
  files: Record<"pan_file" | "bank_file" | "aadhaar_front_file" | "aadhaar_back_file", FileRef>;
};
type F = { pan: string; pan_name: string; aadhaar: string; gstin: string; account_name: string; bank_name: string; account_no: string; account_no2: string; ifsc: string; nominee: string; address: string };
const EMPTY: F = { pan: "", pan_name: "", aadhaar: "", gstin: "", account_name: "", bank_name: "", account_no: "", account_no2: "", ifsc: "", nominee: "", address: "" };
const INPUT = "ed-input";

export default function KycPage() {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const { data, error, loading, reload } = useBiz<Kyc>("kyc");
  const [f, setF] = useState<F>(EMPTY);
  const [ids, setIds] = useState({ pan_file: "", bank_file: "", aadhaar_front_file: "", aadhaar_back_file: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!data || data.disabled) return;
    const v = data.values;
    setF((p) => ({ ...p, pan_name: v.pan_name, bank_name: v.bank_name, account_name: v.account_name, ifsc: v.ifsc, nominee: v.nominee, address: v.address, gstin: v.gstin }));
    setIds({ pan_file: data.files.pan_file?.id ?? "", bank_file: data.files.bank_file?.id ?? "", aadhaar_front_file: data.files.aadhaar_front_file?.id ?? "", aadhaar_back_file: data.files.aadhaar_back_file?.id ?? "" });
  }, [data]);

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await bizAct<{ ok?: string }>("kyc", { op: "submit", ...f, ...ids });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: en ? "KYC sent. We will check it soon." : "KYC भेज दिया। हम जल्दी देखेंगे।" }); setF((p) => ({ ...p, pan: "", account_no: "", account_no2: "", aadhaar: "" })); void reload(); }
    else setMsg({ ok: false, text: tr(r.error) });
  }

  const fld = (label: string, k: keyof F, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="text-xs font-semibold text-muted">{label}</span><input className={`${INPUT} mt-1`} value={f[k]} onChange={set(k)} {...props} /></label>
  );

  return (
    <BizShell title="KYC">
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled ? <p className={`${CARD} text-sm text-muted`}>{en ? "This is switched off right now." : "यह अभी बंद है।"}</p> : data && (
          <>
            <p className="text-sm text-muted">{en ? "KYC is needed to take out money and for correct tax (TDS). Only the KYC team sees it." : "पैसे निकालने और सही TDS के लिए KYC चाहिए। इसे सिर्फ़ KYC team देखती है।"}</p>
            {data.status === "approved" && <div className={`${CARD} flex gap-2 border-good/40 text-sm`}><CircleCheck className="h-5 w-5 shrink-0 text-good" /><div><p className="font-semibold">{en ? "Your KYC is approved." : "आपका KYC पास हो गया है।"}</p><p className="text-muted">{en ? "To change bank details, send a message in Support." : "बैंक बदलना हो तो Support में लिखें।"}</p></div></div>}
            {data.status === "pending" && <div className={`${CARD} flex gap-2 text-sm`}><Clock className="h-5 w-5 shrink-0 text-brand" /><div><p className="font-semibold">{en ? "Under check" : "जाँच चल रही है"}</p><p className="text-muted">{data.submittedAt ? (en ? `Sent on ${dayOf(data.submittedAt)}.` : `${dayOf(data.submittedAt)} को भेजा।`) : ""}</p></div></div>}
            {data.status === "rejected" && <div className={`${CARD} flex gap-2 border-danger/40 text-sm`}><TriangleAlert className="h-5 w-5 shrink-0 text-danger" /><div><p className="font-semibold text-danger">{en ? "Not approved" : "पास नहीं हुआ"}</p><p>{data.rejectReason}</p><p className="text-muted">{en ? "Fix it and send again." : "सुधारकर फिर भेजें।"}</p></div></div>}

            {data.status !== "none" && (
              <div className={`${CARD} text-sm space-y-1`}>
                {data.panMasked && <p><span className="text-muted">PAN: </span><span className="font-mono">{data.panMasked}</span></p>}
                {data.accountLast4 && <p><span className="text-muted">{en ? "Bank account: " : "बैंक खाता: "}</span><span className="font-mono">XXXX{data.accountLast4}</span></p>}
                {data.aadhaarLast4 && <p><span className="text-muted">Aadhaar: </span><span className="font-mono">XXXX XXXX {data.aadhaarLast4}</span></p>}
              </div>
            )}

            {data.canEdit && (
              <form onSubmit={submit} className={`${CARD} space-y-3`}>
                {fld("PAN", "pan", { required: true, placeholder: "ABCDE1234F", autoCapitalize: "characters", maxLength: 10 })}
                {fld(en ? "Name on PAN" : "PAN पर नाम", "pan_name", { required: true })}
                {fld(en ? "Aadhaar number (optional)" : "आधार नंबर (ज़रूरी नहीं)", "aadhaar", { inputMode: "numeric", maxLength: 14 })}
                {fld(en ? "GSTIN (if you have one)" : "GSTIN (हो तो)", "gstin")}
                <p className="pt-1 text-sm font-bold">{en ? "Bank account" : "बैंक खाता"}</p>
                {fld(en ? "Account holder name" : "खाताधारक का नाम", "account_name", { required: true })}
                {fld(en ? "Bank name" : "बैंक का नाम", "bank_name", { required: true })}
                {fld(en ? "Account number" : "खाता नंबर", "account_no", { required: true, inputMode: "numeric", autoComplete: "off" })}
                {fld(en ? "Account number again" : "खाता नंबर दोबारा", "account_no2", { required: true, inputMode: "numeric", autoComplete: "off" })}
                {fld("IFSC", "ifsc", { required: true, placeholder: "SBIN0001234", autoCapitalize: "characters", maxLength: 11 })}
                {fld(en ? "Nominee (optional)" : "नॉमिनी (ज़रूरी नहीं)", "nominee")}
                {fld(en ? "Address (optional)" : "पता (ज़रूरी नहीं)", "address")}
                <p className="pt-1 text-sm font-bold">{en ? "Photos" : "फ़ोटो"}</p>
                <p className="text-xs text-muted">{en ? "Take a clear photo. PAN and cheque (or passbook) are a must. Aadhaar is optional." : "साफ़ फ़ोटो लें। PAN और चेक (या पासबुक) ज़रूरी हैं। आधार ज़रूरी नहीं।"}</p>
                <KycPhoto kind="kyc_pan" pdf label={en ? "PAN card (must)" : "PAN card (ज़रूरी)"} id={ids.pan_file} currentUrl={data.files.pan_file?.url} onChange={(id) => setIds((p) => ({ ...p, pan_file: id }))} />
                <KycPhoto kind="kyc_bank" pdf label={en ? "Cancelled cheque or passbook (must)" : "कैंसिल चेक या पासबुक (ज़रूरी)"} id={ids.bank_file} currentUrl={data.files.bank_file?.url} onChange={(id) => setIds((p) => ({ ...p, bank_file: id }))} />
                <KycPhoto kind="kyc_aadhaar_front" label={en ? "Aadhaar front (optional)" : "आधार आगे का (ज़रूरी नहीं)"} id={ids.aadhaar_front_file} currentUrl={data.files.aadhaar_front_file?.url} onChange={(id) => setIds((p) => ({ ...p, aadhaar_front_file: id }))} />
                <KycPhoto kind="kyc_aadhaar_back" label={en ? "Aadhaar back (optional)" : "आधार पीछे का (ज़रूरी नहीं)"} id={ids.aadhaar_back_file} currentUrl={data.files.aadhaar_back_file?.url} onChange={(id) => setIds((p) => ({ ...p, aadhaar_back_file: id }))} />
                {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.text}</p>}
                <button type="submit" disabled={busy} className="w-full rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? (en ? "Sending…" : "भेज रहे हैं…") : data.status === "none" ? (en ? "Send KYC" : "KYC भेजें") : (en ? "Send again" : "फिर से भेजें")}
                </button>
              </form>
            )}
          </>
        )}
      </BizState>
    </BizShell>
  );
}
