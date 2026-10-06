// The website's line icons (docs/premium-look.md §2.4): eighteen 16 px strokes at 1.5 px in currentColor, inline so
// the hero paints them with the HTML (no icon font, no emoji, no numeric fallback glyph). Lucide stays in the nav
// and the sections; the heroes, trust row, CTAs and the "good to know" strip draw from here.
//
// Pure module with no side effects (a bundler drops it when nothing imports it); the paths are plain JSX, ~2 KB in all.
// Server-safe: no 'use client', no hooks.
import type { SVGProps } from "react";

const PATHS = {
  pin: <><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  phone: <path d="M5 4h3.5l1.5 4-2 1.3a9 9 0 0 0 6.7 6.7L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z" />,
  whatsapp: <><path d="M4 20l1.3-3.8A8.5 8.5 0 1 1 8.4 19.2L4 20z" /><path d="M9 8.5c.3 1.2.8 2.3 1.6 3.3.8.9 1.9 1.6 3.1 2l1.3-1.2-2-1-.9.6a4.6 4.6 0 0 1-1.5-1.6l.6-.9-1-2z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></>,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />,
  rupee: <path d="M6.5 4.5h11M6.5 9h11M6.5 4.5h3a4.5 4.5 0 0 1 0 9H6.5L15 20" />,
  truck: <><path d="M3 7h10v9H3zM13 10h4.5l3.5 3.5V16H13" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  receipt: <><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8.5h6M9 12h6M9 15.5h4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  "arrow-right": <path d="M4 12h16M13 5l7 7-7 7" />,
  "arrow-up-right": <path d="M7 17L17 7M8 7h9v9" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  directions: <><path d="M12 3l9 9-9 9-9-9z" /><path d="M9.5 14v-2.5h5M12.8 9.8l1.7 1.7-1.7 1.7" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" /><path d="M9 12l2 2 4-4" /></>,
  tag: <><path d="M3.5 12.5V4.5h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  map: <><path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/** One line icon. `fill` paints the shape solid (the star in a rating, the open dot); `title` makes it readable to
 *  a screen reader, otherwise it is decoration (aria-hidden). */
export function Icon({ name, size = 16, strokeWidth = 1.5, fill = false, title, className, ...rest }: {
  name: IconName; size?: number; strokeWidth?: number; fill?: boolean; title?: string; className?: string;
} & Omit<SVGProps<SVGSVGElement>, "fill" | "name" | "width" | "height" | "viewBox" | "children">) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined} focusable="false" {...rest}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** The highlight's word → its icon: "UPI accepted" → rupee, "Home delivery" → truck, "GST" → receipt; null when no
 *  icon fits (the strip then drops the glyph rather than show a wrong one). */
export function iconFor(text: string): IconName | null {
  const t = (text ?? "").toLowerCase();
  if (/\b(upi|cash|card|payment|emi|₹|rupee|price)|पेमेंट|यूपीआई|नकद|दाम/.test(t)) return "rupee";
  if (/\b(deliver|courier|shipping|pickup|pick-up)|डिलीवरी|होम सर्विस|home service/.test(t)) return "truck";
  if (/\b(gst|bill|invoice|receipt|tax)|बिल|जीएसटी/.test(t)) return "receipt";
  if (/\b(open|timing|hours|24x7|24\/7|daily)|खुला|समय|रोज़/.test(t)) return "clock";
  if (/\b(book|appointment|slot|since|est\.?|established|year)|बुक|अपॉइंटमेंट|साल|से\b/.test(t)) return "calendar";
  if (/\b(review|rating|star|rated)|रिव्यू|रेटिंग|★/.test(t)) return "star";
  if (/\b(verified|trusted|licen[cs]ed|certified|registered|warranty|guarantee|bis|hallmark|iso)|प्रमाणित|रजिस्टर्ड|भरोसे|गारंटी|वारंटी/.test(t)) return "shield";
  if (/\b(offer|discount|off\b|sale|deal)|ऑफ़र|छूट/.test(t)) return "tag";
  if (/\b(serving|area|near|nearby|branch|location|address|market)|इलाक|आस-पास|पता|मार्केट/.test(t)) return "pin";
  if (/\b(whatsapp)|व्हाट्सऐप/.test(t)) return "whatsapp";
  if (/\b(call|phone)|कॉल|फ़ोन/.test(t)) return "phone";
  return null;
}
