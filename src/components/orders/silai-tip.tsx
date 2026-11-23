"use client";
// The "?" help on Orders · Silai fields (owner, 23 Nov 2026: field-wise how to use), by the field's English label.
import { FieldTip } from "@/components/field-tip";
import { useT } from "@/lib/poster-i18n";

const TIPS: Record<string, [string, string]> = {
  "Mobile": ["Type the customer's mobile first — an old customer's name and measurements come up by themselves.", "पहले ग्राहक का मोबाइल लिखें — पुराने ग्राहक का नाम और नाप अपने-आप आ जाता है।"],
  "Name": ["The customer's name for the slip and WhatsApp.", "पर्ची और WhatsApp के लिए ग्राहक का नाम।"],
  "Charge ₹": ["What this item costs the customer.", "इस item का ग्राहक से चार्ज।"],
  "Pieces": ["How many of this item (2 blouses = 2).", "इस item के कितने पीस (2 ब्लाउज़ = 2)।"],
  "Karigar": ["An outside karigar for this item — they get the work on WhatsApp. Leave empty if done in the shop.", "इस item के लिए बाहर का कारीगर — उसे काम WhatsApp पर जाएगा। दुकान में बने तो खाली छोड़ें।"],
  "Tailor in the app": ["A staff login who does this work; it shows in their own list.", "जो staff login यह काम करेगा; उसकी अपनी सूची में दिखेगा।"],
  "Delivery date": ["The date promised to the customer. Late orders are shown in red.", "ग्राहक को दी गई तारीख़। देर वाले ऑर्डर लाल दिखते हैं।"],
  "Advance received ₹": ["Money taken now. The balance is shown on the slip and at delivery.", "अभी लिया पैसा। बाकी पर्ची पर और देते समय दिखता है।"],
  "Whose work": ["Who does this step: the master, a tailor login, or an outside karigar.", "यह step कौन करेगा: मास्टर, टेलर login या बाहर का कारीगर।"],
  "Usual work (picked by itself)": ["The work most orders of this item need; it is ticked by itself when booking.", "इस item के ज़्यादातर ऑर्डर में जो काम होता है; बुकिंग पर अपने-आप चुना जाता है।"],
  "Days": ["How many days this item usually takes; the delivery date fills from it.", "यह item आम तौर पर कितने दिन लेता है; देने की तारीख़ इसी से भरती है।"],
};

export function SilaiTip({ k }: { k: string }) {
  const { lang } = useT();
  const t = TIPS[k];
  return t ? <FieldTip en={t[0]} hi={t[1]} lang={lang} /> : null;
}
