// Category seeds for product facts (spec §3.3). Seeds only fill gaps; the owner's deletions stick (removed_defaults).
// No default assumes a hose, glass or panel — output.* always comes from the photo draft + the owner's tap.
export type FactSeed = { size_class?: "handheld" | "tabletop" | "countertop" | "floor" | "wall" | "wearable" | "consumable" | "vehicle" | "service"; hands?: "none" | "edge" | "operating"; must_not_show?: string[]; banned_claims?: string[] };
export const GROUP_DEFAULTS: Record<string, FactSeed> = {
  Retail: { size_class: "tabletop", hands: "edge", must_not_show: ["a second copy of the product", "legible price tags", "other companies' brand names"], banned_claims: ["No.1", "cheapest in India", "guaranteed"] },
  Food: { size_class: "consumable", hands: "operating", must_not_show: ["other companies' brand names"], banned_claims: ["No.1", "guaranteed"] },
  Health: { size_class: "service", hands: "operating", must_not_show: ["blood", "needles", "before/after body or skin changes"], banned_claims: ["cures", "guaranteed", "100%", "permanent", "doctor-recommended"] },
  Services: { size_class: "service", hands: "operating", banned_claims: ["guaranteed", "No.1"] },
  Education: { size_class: "service", banned_claims: ["guaranteed marks", "100% result"] },
  Sales: { size_class: "service", banned_claims: ["guaranteed income"] },
  Industry: { size_class: "floor", hands: "edge" },
  Community: { size_class: "service" },
  Personal: { size_class: "service" },
};
export const KEY_OVERRIDES: Record<string, FactSeed> = {
  water: { size_class: "countertop", hands: "edge", must_not_show: ["liquid leaving any tap, faucet or spout that is not part of the product", "a second appliance", "a bottle, jug or pitcher pouring"], banned_claims: ["cures", "doctor-recommended", "100% pure", "No.1"] },
  kirana: { size_class: "consumable", hands: "operating" },
  garments: { size_class: "wearable", hands: "operating", must_not_show: ["changed fabric pattern or colour", "different garment cut"] },
  dentist: { must_not_show: ["blood", "needles", "fake before/after teeth"], banned_claims: ["100% painless", "permanent cure"] },
  salon: { must_not_show: ["skin-tone change"] },
  gym: { must_not_show: ["exaggerated before/after bodies"], banned_claims: ["guaranteed weight loss"] },
};
