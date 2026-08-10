export type StockTab = "requests" | "in" | "out";

export function parseStockTab(value?: string | null): StockTab {
  if (value === "in" || value === "out" || value === "requests") return value;
  return "requests";
}

/** Global search result types allowed for a role (techs never see SI/SO slips). */
export function searchIncludesWarehouseSlips(roleIsTechnician: boolean): boolean {
  return !roleIsTechnician;
}

export function searchOwnMrfsOnly(roleIsTechnician: boolean): boolean {
  return roleIsTechnician;
}
