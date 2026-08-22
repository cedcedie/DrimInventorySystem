import { describe, it, expect } from "vitest";
import { peso, formatDateTime, formatDate } from "./format";

describe("peso", () => {
  it("prefixes the peso sign and always shows two decimals", () => {
    expect(peso(185)).toBe("₱185.00");
  });

  it("groups thousands", () => {
    expect(peso(42500)).toBe("₱42,500.00");
  });

  it("formats zero rather than rendering an empty value", () => {
    expect(peso(0)).toBe("₱0.00");
  });

  it("keeps two decimals on a fractional amount", () => {
    expect(peso(96.5)).toBe("₱96.50");
  });

  it("handles a large inventory valuation", () => {
    expect(peso(1234567.89)).toBe("₱1,234,567.89");
  });
});

describe("formatDateTime", () => {
  it("renders month, day, and a 24-hour time", () => {
    // Asserted on parts, not one exact string — ICU spacing varies by Node build.
    const formatted = formatDateTime(new Date(2026, 6, 20, 14, 30));
    expect(formatted).toContain("Jul");
    expect(formatted).toContain("20");
    expect(formatted).toContain("14:30");
  });

  it("uses 24-hour time, so afternoon is not rendered as 02", () => {
    const formatted = formatDateTime(new Date(2026, 6, 20, 14, 30));
    expect(formatted).not.toMatch(/\bPM\b/i);
    expect(formatted).not.toMatch(/\b02:30\b/);
  });

  it("zero-pads the hour before 10am", () => {
    const formatted = formatDateTime(new Date(2026, 6, 20, 9, 5));
    expect(formatted).toContain("09:05");
  });

  it("shows midnight as 00, not 24", () => {
    const formatted = formatDateTime(new Date(2026, 6, 20, 0, 0));
    expect(formatted).toContain("00:00");
  });
});

describe("formatDate", () => {
  it("renders month, day, and year without a time", () => {
    const formatted = formatDate(new Date(2026, 6, 20));
    expect(formatted).toContain("Jul");
    expect(formatted).toContain("20");
    expect(formatted).toContain("2026");
    expect(formatted).not.toMatch(/\d{2}:\d{2}/);
  });
});
