import { describe, it, expect } from "vitest";
import { maxRefSuffix, formatRefNo } from "./refNo";

describe("maxRefSuffix", () => {
  it("returns the highest numeric suffix, not lexicographic order", () => {
    const refs = ["MRF-99", "MRF-120", "MRF-118", "MRF-9"];
    expect(maxRefSuffix(refs, "MRF")).toBe(120);
  });

  it("ignores refs that do not match the prefix", () => {
    const refs = ["MRF-010", "SO-0042", "migrated_abc"];
    expect(maxRefSuffix(refs, "MRF")).toBe(10);
  });

  it("returns 0 when no matching refs exist", () => {
    expect(maxRefSuffix([], "MRF")).toBe(0);
    expect(maxRefSuffix(["SO-0001"], "MRF")).toBe(0);
  });
});

describe("formatRefNo", () => {
  it("pads the numeric suffix", () => {
    expect(formatRefNo("MRF", 121)).toBe("MRF-0121");
    expect(formatRefNo("SO", 42, 4)).toBe("SO-0042");
  });
});
