// "Open now · till 8 pm" from the card's hours block (docs/website-looks-v2.md §4.2). The rows are the owner's own
// words ("Mon – Sat", "9:00 AM – 8:00 PM", "Closed", "10 बजे से 8 बजे तक"), so this reads them tolerantly and says
// nothing when it cannot be sure: a wrong "Closed" on an open shop costs a customer, a missing chip costs nothing.
// Times are India's (IST), whatever the visitor's clock says. Pure module.

export type HoursRow = { day: string; time: string };
export type OpenState = { state: "open" | "closed"; /** "till 8 pm" / "opens 10 am" / "opens Mon" */ note: string; noteHi: string };

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_WORDS: [RegExp, number][] = [
  [/\b(sun|sunday|रवि|इतवार)\b/i, 0], [/\b(mon|monday|सोम)\b/i, 1], [/\b(tue|tues|tuesday|मंगल)\b/i, 2], [/\b(wed|wednesday|बुध)\b/i, 3],
  [/\b(thu|thur|thurs|thursday|गुरु|बृहस्पति)\b/i, 4], [/\b(fri|friday|शुक्र)\b/i, 5], [/\b(sat|saturday|शनि)\b/i, 6],
];
const CLOSED = /closed|holiday|off\b|बंद|छुट्टी|अवकाश/i;
const ALL_DAYS = /all days|every ?day|daily|7 days|सभी दिन|रोज़|रोज|हर दिन|सातों दिन/i;

/** Which weekdays a row names: "Mon – Sat" → 1..6, "Sunday" → [0], "All days" → 0..6; [] when it cannot tell. */
export function rowDays(day: string): number[] {
  const d = day.trim();
  if (!d || ALL_DAYS.test(d)) return [0, 1, 2, 3, 4, 5, 6];
  const found: number[] = [];
  for (const [re, n] of DAY_WORDS) { const m = re.exec(d); if (m) found.push(n); }
  if (!found.length) return [];
  // "Mon – Sat" / "Mon to Sat" / "Mon-Sat": the two ends of a range, in week order (Sat–Sun wraps).
  if (found.length === 2 && /[-–—]|\bto\b|से/i.test(d)) {
    const [a, b] = found; const out: number[] = [];
    for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; if (out.length > 7) break; }
    return out;
  }
  return [...new Set(found)];
}

/** "9:00 AM – 8:00 PM" / "9am-8pm" / "10:00-20:00" / "10 बजे से 8 बजे" → minutes since midnight [open, close]; null when unsure. */
export function rowTimes(time: string): [number, number] | null {
  // Hindi says the part of day BEFORE the hour ("सुबह 10", "शाम 8"): moved after it, so one pattern reads both.
  const t = time.trim().toLowerCase().replace(/(सुबह|दोपहर|शाम|रात)\s*(\d{1,2}(?::\d{2})?)/g, "$2 $1").replace(/बजे|से|तक|to|hrs?|\./g, " ");
  const re = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|सुबह|शाम|दोपहर|रात)?/g;
  const hits: { h: number; m: number; ap?: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) && hits.length < 2) hits.push({ h: Number(m[1]), m: Number(m[2] ?? 0), ap: m[3] });
  if (hits.length !== 2) return null;
  const toMin = (x: { h: number; m: number; ap?: string }, guessPm: boolean) => {
    let h = x.h;
    if (h > 24 || x.m > 59) return null;
    const pm = x.ap === "pm" || x.ap === "शाम" || x.ap === "रात" || (x.ap === "दोपहर" && h < 6);
    const am = x.ap === "am" || x.ap === "सुबह";
    if (pm && h < 12) h += 12;
    else if (am && h === 12) h = 0;
    else if (!x.ap && !am && guessPm && h < 12 && h <= 11) h += 12;   // "9 – 8" with no am/pm: the close is after noon
    return h * 60 + x.m;
  };
  const open = toMin(hits[0], false);
  let close = toMin(hits[1], true);
  if (open === null || close === null) return null;
  if (close <= open && !hits[1].ap) close += 12 * 60;                // "10 – 8" → 10:00–20:00
  if (close <= open) close += 24 * 60;                                 // past midnight
  if (close - open < 30 || close - open > 24 * 60) return null;
  return [open, close];
}

const fmt = (min: number, hi: boolean) => {
  const h24 = Math.floor(min / 60) % 24, m = min % 60;
  const h = h24 % 12 || 12, ap = h24 < 12 ? (hi ? "सुबह" : "am") : (hi ? (h24 < 16 ? "दोपहर" : h24 < 20 ? "शाम" : "रात") : "pm");
  const mm = m ? `:${String(m).padStart(2, "0")}` : "";
  return hi ? `${ap} ${h}${mm} बजे` : `${h}${mm} ${ap}`;
};

/** The shop's state at `now` (IST): open till a time, or closed with when it next opens. Null when the rows cannot be read. */
export function openNow(rows: HoursRow[], now = new Date()): OpenState | null {
  if (!rows?.length) return null;
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60_000);
  const dow = ist.getDay(), minutes = ist.getHours() * 60 + ist.getMinutes();
  // Each weekday's hours: the last row naming it wins ("All days 9–8" then "Sunday closed").
  const week: (([number, number] | "closed") | undefined)[] = [];
  let readable = 0;
  for (const r of rows) {
    const days = rowDays(r.day);
    // "Mon–Sat 10am–8pm" with nothing in `time`: the day column carries the hours too.
    const timeText = r.time.trim() || r.day;
    const closed = CLOSED.test(timeText);
    const times = closed ? "closed" : rowTimes(timeText);
    if (!days.length || !times) continue;
    readable++;
    for (const d of days) week[d] = times;
  }
  if (!readable) return null;
  const today = week[dow];
  const hiNote = (en: string, hi: string) => ({ note: en, noteHi: hi });
  // Yesterday's hours running past midnight ("10 pm – 2 am") come first: at 1 am the shop is still open.
  const y = week[(dow + 6) % 7];
  if (y && y !== "closed" && y[1] > 24 * 60 && minutes < y[1] - 24 * 60) return { state: "open", ...hiNote(`till ${fmt(y[1], false)}`, `${fmt(y[1], true)} तक`) };
  if (today && today !== "closed") {
    const [o, c] = today;
    if (minutes >= o && minutes < c) return { state: "open", ...hiNote(`till ${fmt(c, false)}`, `${fmt(c, true)} तक`) };
    if (minutes < o) return { state: "closed", ...hiNote(`opens ${fmt(o, false)}`, `${fmt(o, true)} खुलेगा`) };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7, h = week[d];
    if (h && h !== "closed") {
      const dayEn = i === 1 ? "tomorrow" : DAYS[d][0].toUpperCase() + DAYS[d].slice(1);
      const dayHi = i === 1 ? "कल" : ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"][d];
      return { state: "closed", ...hiNote(`opens ${dayEn} ${fmt(h[0], false)}`, `${dayHi} ${fmt(h[0], true)} खुलेगा`) };
    }
  }
  return { state: "closed", ...hiNote("closed today", "आज बंद") };
}
