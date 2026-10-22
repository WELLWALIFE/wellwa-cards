import { getCardByUsername } from "@/lib/sample-data";
import { fetchCloudCard, fetchCardPaused, getPublicSupabase } from "@/lib/supabase/public";

// vCard 3.0 text value: a newline or ; in what the owner typed would otherwise start a new field (or break the file), and an
// empty field must not read "undefined".
const esc = (v: unknown) => String(v ?? "").replace(/\\/g, "\\\\").replace(/\r?\n|\r/g, "\\n").replace(/([;,])/g, "\\$1");
// A number, address or link is not text: only kept on one line.
const one = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  // With a database connected a deleted card is gone: never answer with the built-in demo card of the same name.
  const card = (await fetchCloudCard(username)) ?? (getPublicSupabase() ? null : getCardByUsername(username));
  if (!card) {
    return new Response("Not found", { status: 404 });
  }
  // A paused card (its year ended and was not renewed) gives out no contact until it is renewed.
  if (await fetchCardPaused(card.username)) {
    return new Response("This card is paused.", { status: 410 });
  }

  const links = Array.isArray(card.links) ? card.links : [];
  const phone = links.find((l) => l?.type === "phone")?.value ?? "";
  const email = links.find((l) => l?.type === "email")?.value ?? "";
  const website = links.find((l) => l?.type === "website")?.value ?? "";
  const name = esc(card.name || card.company || card.username);

  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${name};;;;`,
    card.company ? `ORG:${esc(card.company)}` : "",
    card.jobTitle ? `TITLE:${esc(card.jobTitle)}` : "",
    phone ? `TEL;TYPE=CELL:${one(phone)}` : "",
    email ? `EMAIL:${one(email)}` : "",
    website ? `URL:${one(website)}` : "",
    card.tagline ? `NOTE:${esc(card.tagline)}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.username.replace(/[^\w.-]/g, "")}.vcf"`,
    },
  });
}
