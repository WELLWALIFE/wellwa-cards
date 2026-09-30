// Colour helpers shared by the card, the website view and the chat widget.

/** Relative luminance (WCAG) of a #rrggbb colour; 0 when unparsable. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Ink colour that stays readable on a solid fill of `hex` (white on dark brands, near-black on light ones like yellow/lime/sky). */
export function onTheme(hex: string): string {
  return luminance(hex) > 0.4 ? "#0d1a1c" : "#ffffff";
}

/** `hex` at alpha `a` as rgba(); falls back to the brand teal when unparsable. */
export function tint(hex: string, a = 0.12): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(14,158,144,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
