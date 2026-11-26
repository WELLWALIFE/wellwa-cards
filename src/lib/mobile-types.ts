// The person's rights as the Mobile Shop API hands them to the app (built in src/lib/mobile-server.ts).
import type { MsRight } from "@/lib/mobile";
/** store: the branch this login works in ("" = main shop); agentId: its crm_agents row ("" for the owner). */
export type MsAccess = { title: string; rights: MsRight[]; owner: boolean; name: string; store: string; agentId: string };
