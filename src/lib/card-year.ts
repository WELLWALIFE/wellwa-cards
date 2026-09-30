// The V-Card's year (migration 0057): free for the first year, then ₹1,499 a year; a running paid plan covers it.
// When the year ends the card keeps working CARD_RENEWAL.graceDays more days, then its link shows "Card renew karein".
// This file decides which renewal reminder is due and what it says — shared by the daily job and its tests.
import { CARD_RENEWAL, rupees } from "@/lib/billing";

export const DAY_MS = 86_400_000;
export type CardMark = "d30" | "d7" | "d1" | "ended" | "pause-soon" | "paused";

/** The reminder due for a card year ending at `until` on `now` (both ms), or null. Ranges, not single days, so a day
 *  the job did not run is caught up the next day — each mark is still sent only once (the caller keys it by `until`).
 *  `left`: whole days to the end (30 … 1), 0 or less once it has ended. */
export function markFor(until: number, now: number): { mark: CardMark; left: number } | null {
  const left = Math.ceil((until - now) / DAY_MS);
  if (left >= 8 && left <= 30) return { mark: "d30", left };
  if (left >= 2 && left <= 7) return { mark: "d7", left };
  if (left === 1) return { mark: "d1", left };
  const since = -left; // whole days since the end
  const grace = CARD_RENEWAL.graceDays;
  if (since >= 0 && since <= grace - 3) return { mark: "ended", left };
  if (since >= grace - 2 && since <= grace - 1) return { mark: "pause-soon", left };
  if (since >= grace && since <= 30) return { mark: "paused", left };
  return null;
}

const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Push / WhatsApp words (Hinglish, as the owner and his customers write) for one reminder. */
export function cardReminderText(mark: CardMark, until: number, left: number): { title: string; body: string } {
  const price = rupees(CARD_RENEWAL.amount);
  const pauseOn = until + CARD_RENEWAL.graceDays * DAY_MS;
  const keep = `${price} me 1 saal aur chalu rakhein — link, details aur leads bina rukawat chalte rahenge. Growth plan me V-Card shamil hai.`;
  switch (mark) {
    case "d30":
    case "d7":
      return { title: `V-Card renewal — ${left} din baaki`, body: `Aapke Shubhora V-Card ka saal ${fmt(until)} ko poora ho raha hai. ${keep}` };
    case "d1":
      return { title: "Kal aapke V-Card ka saal poora ho raha hai", body: `Aapke Shubhora V-Card ka saal ${fmt(until)} ko poora ho raha hai. ${keep}` };
    case "ended":
      return { title: "Aapke V-Card ka saal poora ho gaya", body: `${fmt(pauseOn)} tak card chalta rahega. Uske baad aapke link par "Card renew karein" dikhega. Abhi renew karein — ${price}/saal, sab details aur leads safe.` };
    case "pause-soon": {
      const n = Math.max(1, CARD_RENEWAL.graceDays + left); // left is 0 or less here: days until the pause
      return { title: `${n} din me aapka V-Card ruk jayega`, body: `${fmt(pauseOn)} ke baad aapke link par "Card renew karein" dikhega. Abhi renew karein — ${price}/saal, sab details aur leads safe.` };
    }
    case "paused":
      return { title: "Aapka V-Card ruk gaya hai", body: `Log aapke link par "Card renew karein" dekh rahe hain. ${price} me abhi chalu karein — aapki sari details, photos aur leads safe hain.` };
  }
}
