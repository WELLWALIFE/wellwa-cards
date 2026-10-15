"use client";
// Business › Welcome letter — the member's partner details on one page, to print or save as a PDF (panel: (member)/welcome-letter).
// Data: partner handler `welcome-letter` (this member's own details; sponsor and placement are handles, never real names).
import { Printer } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, dayOf, useBiz } from "@/components/business/kit";

type Res = {
  date: string; brand: string; company: string; name: string; username: string; mobile: string | null; sponsor: string | null;
  placement: { handle: string; leg: "left" | "right" } | null; joined: string | null; activatedOn: string | null;
};

// When printed, only the letter is on the paper (not the app's bars and buttons around it).
const PRINT = "@media print { body * { visibility: hidden !important; } #welcome-letter, #welcome-letter * { visibility: visible !important; } #welcome-letter { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; } }";

export default function WelcomeLetterPage() {
  const { lang } = useT(); const en = lang === "en";
  const { data: d, error, loading, reload } = useBiz<Res>("welcome-letter");
  const rows: [string, string][] = d ? [
    [en ? "Username" : "Username", d.username],
    [en ? "Name" : "नाम", d.name],
    [en ? "Mobile" : "मोबाइल", d.mobile ?? "—"],
    [en ? "Sponsor" : "Sponsor", d.sponsor ?? "—"],
    [en ? "Placed under" : "इनके नीचे", d.placement ? `${d.placement.handle}, ${d.placement.leg === "left" ? "Left side" : "Right side"}` : "—"],
    [en ? "Joined on" : "जुड़ने की तारीख", dayOf(d.joined) || "—"],
    [en ? "Activated on" : "चालू होने की तारीख", d.activatedOn ? dayOf(d.activatedOn) : (en ? "Not activated yet" : "अभी चालू नहीं हुआ")],
  ] : [];

  return (
    <BizShell title={en ? "Welcome letter" : "Welcome letter (स्वागत पत्र)"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {d && (
          <>
            <style>{PRINT}</style>
            <button type="button" onClick={() => window.print()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold">
              <Printer className="h-4 w-4" />{en ? "Print / Save as PDF" : "Print करें / PDF में save करें"}
            </button>
            <article id="welcome-letter" className="rounded-2xl border border-border bg-white p-5 text-[#12144a]">
              <p className="text-lg font-extrabold">{d.brand}</p>
              <p className="mt-4 text-sm text-[#5a5f86]">{dayOf(d.date)}</p>
              <h2 className="mt-3 text-xl font-extrabold leading-snug">{en ? "Welcome to the Shubhora partner family" : "Shubhora partner परिवार में आपका स्वागत है"}</h2>
              <p className="mt-4 leading-relaxed">{en ? "Dear" : "प्रिय"} {d.name},</p>
              <p className="mt-3 text-sm leading-relaxed">
                {en
                  ? `Thank you for joining us as an independent partner of ${d.brand} Business Suite. Your partner details are below. Please keep them safe and do not share your password with anyone.`
                  : `${d.brand} Business Suite के independent partner बनने के लिए धन्यवाद। आपकी partner details नीचे हैं। इन्हें संभालकर रखें और अपना पासवर्ड किसी को न बताएँ।`}
              </p>
              <table className="mt-5 w-full text-sm">
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={k} className="border-b border-[#e0e3f1]">
                      <td className="py-1.5 pr-3 align-top text-[#5a5f86]">{k}</td>
                      <td className="py-1.5 text-right font-semibold">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-5 text-sm leading-relaxed">
                {en
                  ? "Your income depends only on real sales of the subscription to customers who use it. It is not guaranteed. Please read the partner agreement, and never promise anyone an income."
                  : "आपकी कमाई सिर्फ़ उस subscription की असली बिक्री पर निर्भर है जिसे ग्राहक सच में इस्तेमाल करते हैं। इसकी कोई गारंटी नहीं है। Partner agreement ज़रूर पढ़ें, और किसी से कमाई का वादा कभी न करें।"}
              </p>
              <p className="mt-6 text-sm">{en ? "With best wishes," : "शुभकामनाओं के साथ,"}<br /><b>{d.company}</b></p>
            </article>
          </>
        )}
      </BizState>
    </BizShell>
  );
}
