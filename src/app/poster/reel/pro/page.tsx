// The Advanced reel page is now part of /poster/reel itself (owner, 27 Oct 2026: one page — choose, see the words,
// make, share). Old links and bookmarks land on the one page; ?edit=<jobId> still opens a reel to change.
import { redirect } from "next/navigation";

export default async function ReelPro({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const edit = typeof sp.edit === "string" && /^[0-9a-f-]{36}$/i.test(sp.edit) ? sp.edit : "";
  redirect(edit ? `/poster/reel?edit=${edit}` : "/poster/reel");
}
