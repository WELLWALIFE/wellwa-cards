// The person's rights as the Jewellery API hands them to the app (the server builds them in src/lib/jewellery-server.ts).
import type { JwRight } from "@/lib/jewellery";
export type JwAccess = { title: string; rights: JwRight[]; owner: boolean; name: string };
