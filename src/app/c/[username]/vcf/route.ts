import { getCardByUsername } from "@/lib/sample-data";
import { fetchCloudCard, fetchCardPaused } from "@/lib/supabase/public";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const card = (await fetchCloudCard(username)) ?? getCardByUsername(username);
  if (!card) {
    return new Response("Not found", { status: 404 });
  }
  // A paused card (its year ended and was not renewed) gives out no contact until it is renewed.
  if (await fetchCardPaused(card.username)) {
    return new Response("This card is paused.", { status: 410 });
  }

  const phone = card.links.find((l) => l.type === "phone")?.value ?? "";
  const email = card.links.find((l) => l.type === "email")?.value ?? "";
  const website = card.links.find((l) => l.type === "website")?.value ?? "";

  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${card.name}`,
    `N:${card.name};;;;`,
    `ORG:${card.company}`,
    `TITLE:${card.jobTitle}`,
    phone ? `TEL;TYPE=CELL:${phone}` : "",
    email ? `EMAIL:${email}` : "",
    website ? `URL:${website}` : "",
    `NOTE:${card.tagline}`,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.username}.vcf"`,
    },
  });
}
