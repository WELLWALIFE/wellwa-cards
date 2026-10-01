// Every trade's seeds in one map (see types.ts). Each group file covers the categories of that group in
// poster-categories.ts; GROUP_DATA holds one general entry per group for a key that has no file of its own.
import type { TradeData } from "./types";
import { FOOD } from "./food";
import { RETAIL, RETAIL_DEFAULT } from "./retail";
import { HEALTH, HEALTH_DEFAULT } from "./health";
import { SERVICES, SERVICES_DEFAULT } from "./services";
import { EDUCATION, EDUCATION_DEFAULT } from "./education";
import { SALES, SALES_DEFAULT } from "./sales";
import { INDUSTRY, INDUSTRY_DEFAULT } from "./industry";
import { COMMUNITY, COMMUNITY_DEFAULT } from "./community";
import { PERSONAL, PERSONAL_DEFAULT } from "./personal";

export const TRADE_DATA: Record<string, TradeData> = {
  ...FOOD, ...RETAIL, ...HEALTH, ...SERVICES, ...EDUCATION, ...SALES, ...INDUSTRY, ...COMMUNITY, ...PERSONAL,
};

/** One general entry per group (poster-categories.ts group names). */
export const GROUP_DATA: Record<string, TradeData> = {
  Retail: RETAIL_DEFAULT,
  Food: FOOD.restaurant,
  Health: HEALTH_DEFAULT,
  Services: SERVICES_DEFAULT,
  Education: EDUCATION_DEFAULT,
  Sales: SALES_DEFAULT,
  Industry: INDUSTRY_DEFAULT,
  Community: COMMUNITY_DEFAULT,
  Personal: PERSONAL_DEFAULT,
};
