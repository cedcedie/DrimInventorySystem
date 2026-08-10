import { describe, it, expect } from "vitest";
import {
  canViewStockModule,
  isProductRequestable,
  mrfCancelActivityAction,
  mrfCancelButtonLabel,
  mrfCancelConfirmMessage,
  mrfStatusLabel,
  techMayCancelMrf,
  warehouseMayCancelMrf,
} from "./mrfLifecycle";

describe("canViewStockModule", () => {
  it("does not bridge technician mrf view into stock", () => {
    expect(canViewStockModule(false, true)).toBe(false);
    expect(canViewStockModule(true, false)).toBe(true);
  });
});

describe("isProductRequestable", () => {
  it("rejects archived products for new MRF/SI", () => {
    expect(isProductRequestable(null)).toBe(true);
    expect(isProductRequestable(undefined)).toBe(true);
    expect(isProductRequestable(new Date())).toBe(false);
    expect(isProductRequestable("2026-01-01")).toBe(false);
  });
});

describe("cancel policy", () => {
  it("blocks tech cancel once any qty is released (SO race window)", () => {
    expect(techMayCancelMrf("PENDING", false)).toBe(true);
    expect(techMayCancelMrf("PENDING", true)).toBe(false);
    expect(techMayCancelMrf("PARTIAL", false)).toBe(false);
    expect(techMayCancelMrf("PARTIAL", true)).toBe(false);
  });

  it("allows warehouse to close remaining on PARTIAL", () => {
    expect(warehouseMayCancelMrf("PENDING")).toBe(true);
    expect(warehouseMayCancelMrf("PARTIAL")).toBe(true);
    expect(warehouseMayCancelMrf("FULFILLED")).toBe(false);
    expect(warehouseMayCancelMrf("CANCELLED")).toBe(false);
  });
});

describe("close-remaining copy", () => {
  it("labels cancelled-with-releases distinctly", () => {
    expect(mrfStatusLabel("CANCELLED", 0)).toBe("Cancelled");
    expect(mrfStatusLabel("CANCELLED", 3)).toBe("Closed remaining");
  });

  it("uses close-remaining wording when stock was already released", () => {
    expect(mrfCancelButtonLabel(true)).toBe("Close remaining");
    expect(mrfCancelConfirmMessage("MRF-0001", true)).toMatch(/Close remaining/);
    expect(mrfCancelActivityAction("MRF-0001", true, "job done")).toBe(
      "Closed remaining on MRF MRF-0001 — job done"
    );
    expect(mrfCancelActivityAction("MRF-0001", false)).toBe("Cancelled MRF MRF-0001");
  });
});
