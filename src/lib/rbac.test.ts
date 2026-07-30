import { describe, it, expect } from "vitest";
import { canAccess, MODULE_ACCESS } from "./rbac";

// The expected values here come from the permission matrix in the project
// brief, not from re-reading MODULE_ACCESS — otherwise the test would just
// restate whatever the code happens to say and could never disagree with it.
describe("canAccess", () => {
  it("gives Owner every module", () => {
    for (const segment of [
      "dashboard",
      "inventory",
      "products",
      "suppliers",
      "stock",
      "technicians",
      "reports",
      "users",
      "activity",
      "settings",
    ]) {
      expect(canAccess("OWNER", segment)).toBe(true);
    }
  });

  it("keeps Users and Settings exclusive to Owner", () => {
    expect(canAccess("ADMIN", "users")).toBe(false);
    expect(canAccess("ADMIN", "settings")).toBe(false);
    expect(canAccess("WAREHOUSE_STAFF", "users")).toBe(false);
    expect(canAccess("TECHNICIAN", "users")).toBe(false);
    expect(canAccess("OWNER", "users")).toBe(true);
    expect(canAccess("OWNER", "settings")).toBe(true);
  });

  it("limits Warehouse Staff to dashboard, inventory, and stock", () => {
    expect(canAccess("WAREHOUSE_STAFF", "dashboard")).toBe(true);
    expect(canAccess("WAREHOUSE_STAFF", "inventory")).toBe(true);
    expect(canAccess("WAREHOUSE_STAFF", "stock")).toBe(true);

    expect(canAccess("WAREHOUSE_STAFF", "products")).toBe(false);
    expect(canAccess("WAREHOUSE_STAFF", "suppliers")).toBe(false);
    expect(canAccess("WAREHOUSE_STAFF", "reports")).toBe(false);
    expect(canAccess("WAREHOUSE_STAFF", "technicians")).toBe(false);
  });

  it("limits Technician to dashboard and stock, where stock means their MRFs", () => {
    expect(canAccess("TECHNICIAN", "dashboard")).toBe(true);
    expect(canAccess("TECHNICIAN", "stock")).toBe(true);

    expect(canAccess("TECHNICIAN", "inventory")).toBe(false);
    expect(canAccess("TECHNICIAN", "products")).toBe(false);
    expect(canAccess("TECHNICIAN", "reports")).toBe(false);
    expect(canAccess("TECHNICIAN", "activity")).toBe(false);
  });

  it("gives Admin operations but not user or settings administration", () => {
    expect(canAccess("ADMIN", "stock")).toBe(true);
    expect(canAccess("ADMIN", "reports")).toBe(true);
    expect(canAccess("ADMIN", "products")).toBe(true);
    expect(canAccess("ADMIN", "users")).toBe(false);
  });

  it("denies an unknown module rather than defaulting open", () => {
    expect(canAccess("OWNER", "billing")).toBe(false);
    expect(canAccess("OWNER", "")).toBe(false);
  });

  it("covers all four roles and no others", () => {
    expect(Object.keys(MODULE_ACCESS).sort()).toEqual([
      "ADMIN",
      "OWNER",
      "TECHNICIAN",
      "WAREHOUSE_STAFF",
    ]);
  });
});
