// The parts of every combined trade, gathered from the four data files (see lib/trade-parts.ts for what a part is).
import { PARTS_A, TICKS_A, SEEDS_A } from "./parts-a";
import { PARTS_B, TICKS_B, SEEDS_B } from "./parts-b";
import { PARTS_C, TICKS_C, SEEDS_C } from "./parts-c";
import { PARTS_D, TICKS_D, SEEDS_D } from "./parts-d";
import { PARTS_E, TICKS_E, SEEDS_E } from "./parts-e";

export const PARTS_ALL = { ...PARTS_A, ...PARTS_B, ...PARTS_C, ...PARTS_D, ...PARTS_E };
export const TICKS_ALL = { ...TICKS_A, ...TICKS_B, ...TICKS_C, ...TICKS_D, ...TICKS_E };
export const SEEDS_ALL = { ...SEEDS_A, ...SEEDS_B, ...SEEDS_C, ...SEEDS_D, ...SEEDS_E };
