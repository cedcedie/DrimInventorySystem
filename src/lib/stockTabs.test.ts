import { describe, it, expect } from "vitest";
import {
  parseStockTab,
  searchIncludesWarehouseSlips,
  searchOwnMrfsOnly,
} from "./stockTabs";

describe("parseStockTab", () => {
  it("defaults to Open MRFs queue", () => {
    expect(parseStockTab(undefined)).toBe("requests");
    expect(parseStockTab("")).toBe("requests");
    expect(parseStockTab("junk")).toBe("requests");
  });

  it("accepts known tabs", () => {
    expect(parseStockTab("in")).toBe("in");
    expect(parseStockTab("out")).toBe("out");
    expect(parseStockTab("requests")).toBe("requests");
  });
});

describe("search scoping", () => {
  it("hides SI/SO slips from technicians", () => {
    expect(searchIncludesWarehouseSlips(true)).toBe(false);
    expect(searchIncludesWarehouseSlips(false)).toBe(true);
  });

  it("scopes MRF results to own requests for technicians", () => {
    expect(searchOwnMrfsOnly(true)).toBe(true);
    expect(searchOwnMrfsOnly(false)).toBe(false);
  });
});
