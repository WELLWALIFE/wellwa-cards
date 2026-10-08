// Festival calendar for the automatic wishes (owner's call, 8 Oct 2026). Dates are India's; the lunar ones are the
// generally observed day. Extend the list each year — a date missing here simply sends nothing that day.
// Isomorphic: no 'use client', no 'server-only'.
export type Festival = { date: string; key: string; en: string; hi: string; /** The wish itself, one line. */ wishEn: string; wishHi: string };

export const FESTIVALS: Festival[] = [
  { date: "2026-10-11", key: "navratri", en: "Navratri", hi: "नवरात्रि", wishEn: "May these nine nights bring you strength and joy. Happy Navratri!", wishHi: "माँ दुर्गा का आशीर्वाद आप पर सदा बना रहे। शुभ नवरात्रि!" },
  { date: "2026-10-20", key: "dussehra", en: "Dussehra", hi: "दशहरा", wishEn: "May good win over every evil in your life. Happy Dussehra!", wishHi: "बुराई पर अच्छाई की जीत का पर्व आपके जीवन में खुशियाँ लाए। दशहरे की शुभकामनाएँ!" },
  { date: "2026-10-29", key: "karva-chauth", en: "Karva Chauth", hi: "करवा चौथ", wishEn: "Wishing you love and togetherness this Karva Chauth.", wishHi: "करवा चौथ की हार्दिक शुभकामनाएँ — सुख और साथ सदा बना रहे।" },
  { date: "2026-11-06", key: "dhanteras", en: "Dhanteras", hi: "धनतेरस", wishEn: "May Dhanteras bring wealth and good health to your home.", wishHi: "धनतेरस पर माँ लक्ष्मी आपके घर में सुख-समृद्धि लाएँ। शुभ धनतेरस!" },
  { date: "2026-11-08", key: "diwali", en: "Diwali", hi: "दीपावली", wishEn: "May the lights of Diwali fill your home with happiness and prosperity. Happy Diwali!", wishHi: "दीपों का यह पर्व आपके घर में सुख, शांति और समृद्धि लाए। शुभ दीपावली!" },
  { date: "2026-11-11", key: "bhai-dooj", en: "Bhai Dooj", hi: "भाई दूज", wishEn: "Happy Bhai Dooj — may the bond of love grow stronger.", wishHi: "भाई दूज की शुभकामनाएँ — स्नेह का यह बंधन सदा मज़बूत रहे।" },
  { date: "2026-11-24", key: "gurpurab", en: "Guru Nanak Jayanti", hi: "गुरु नानक जयंती", wishEn: "May Guru Nanak Dev Ji's teachings light your path. Happy Gurpurab!", wishHi: "गुरु नानक देव जी की शिक्षाएँ आपका मार्ग प्रकाशित करें। गुरुपुरब की शुभकामनाएँ!" },
  { date: "2026-12-25", key: "christmas", en: "Christmas", hi: "क्रिसमस", wishEn: "Merry Christmas! Wishing you warmth, peace and joy.", wishHi: "क्रिसमस की हार्दिक शुभकामनाएँ — खुशियाँ और शांति आपके साथ रहें।" },
  { date: "2027-01-01", key: "new-year", en: "New Year", hi: "नया साल", wishEn: "Happy New Year 2027! May it bring you success and good health.", wishHi: "नव वर्ष 2027 की हार्दिक शुभकामनाएँ — सफलता और स्वास्थ्य आपके साथ रहें!" },
  { date: "2027-01-14", key: "sankranti", en: "Makar Sankranti", hi: "मकर संक्रांति", wishEn: "Happy Makar Sankranti and Pongal! May the harvest bring you plenty.", wishHi: "मकर संक्रांति की शुभकामनाएँ — तिल-गुड़ की मिठास आपके जीवन में बनी रहे!" },
  { date: "2027-01-26", key: "republic-day", en: "Republic Day", hi: "गणतंत्र दिवस", wishEn: "Happy Republic Day! Proud to serve you.", wishHi: "गणतंत्र दिवस की हार्दिक शुभकामनाएँ। जय हिंद!" },
  { date: "2027-03-22", key: "holi", en: "Holi", hi: "होली", wishEn: "May your life be as colourful as Holi. Happy Holi!", wishHi: "रंगों का यह पर्व आपके जीवन में खुशियों के रंग भरे। होली की शुभकामनाएँ!" },
  { date: "2027-08-15", key: "independence-day", en: "Independence Day", hi: "स्वतंत्रता दिवस", wishEn: "Happy Independence Day! Jai Hind.", wishHi: "स्वतंत्रता दिवस की हार्दिक शुभकामनाएँ। जय हिंद!" },
  { date: "2027-10-10", key: "dussehra", en: "Dussehra", hi: "दशहरा", wishEn: "May good win over every evil in your life. Happy Dussehra!", wishHi: "बुराई पर अच्छाई की जीत का पर्व आपके जीवन में खुशियाँ लाए। दशहरे की शुभकामनाएँ!" },
  { date: "2027-10-29", key: "diwali", en: "Diwali", hi: "दीपावली", wishEn: "May the lights of Diwali fill your home with happiness and prosperity. Happy Diwali!", wishHi: "दीपों का यह पर्व आपके घर में सुख, शांति और समृद्धि लाए। शुभ दीपावली!" },
  { date: "2027-12-25", key: "christmas", en: "Christmas", hi: "क्रिसमस", wishEn: "Merry Christmas! Wishing you warmth, peace and joy.", wishHi: "क्रिसमस की हार्दिक शुभकामनाएँ — खुशियाँ और शांति आपके साथ रहें।" },
];

/** The festival on a date (YYYY-MM-DD, India), if any. */
export const festivalOn = (date: string): Festival | null => FESTIVALS.find((f) => f.date === date) ?? null;
/** The next festivals from a date, soonest first. */
export const upcomingFestivals = (date: string, n = 3): Festival[] => FESTIVALS.filter((f) => f.date >= date).slice(0, n);
