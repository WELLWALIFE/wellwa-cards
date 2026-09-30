/** Desktop dashboard path → Shubhora app path (same feature inside the phone shell). */
export function appPath(href: string): string | null {
  const m = href.match(/^\/(dashboard|cards|leads|ads|whatsapp|analytics|ai|studio|tools|settings|partner)(?:\/([^/?#]+))?/);
  if (!m) return null;
  if (m[1] === "cards" && m[2]) return `/poster/d/editor?id=${m[2]}`;
  return `/poster/d/${m[1] === "dashboard" ? "overview" : m[1]}`;
}
