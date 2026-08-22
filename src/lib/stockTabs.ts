export type StockTab = "requests" | "in" | "out";

export function parseStockTab(value?: string | null): StockTab {
  if (value === "in" || value === "out" || value === "requests") return value;
  return "requests";
}

/** Techs never see SI/SO slips. */
export function searchIncludesWarehouseSlips(roleIsTechnician: boolean): boolean {
  return !roleIsTechnician;
}

export function searchOwnMrfsOnly(roleIsTechnician: boolean): boolean {
  return roleIsTechnician;
}
