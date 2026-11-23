// The person's rights as the Mobile Shop API hands them to the app (built in src/lib/mobile-server.ts).
import type { MsRight } from "@/lib/mobile";
export type MsAccess = { title: string; rights: MsRight[]; owner: boolean; name: string };
