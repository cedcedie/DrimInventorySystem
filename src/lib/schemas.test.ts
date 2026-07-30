import { describe, it, expect } from "vitest";
import {
  productCreateSchema,
  productUpdateSchema,
  passwordChangeSchema,
  stockAdjustmentSchema,
  userUpdateSchema,
} from "./schemas";

const validProduct = {
  code: "PIP-012",
  name: 'Copper Pipe 1/2"',
  categoryId: "cat_1",
  unit: "Meter",
  amount: 185,
  minLevel: 50,
};

describe("productUpdateSchema", () => {
  // This is the integrity guard from the stock-adjustment work: an edit must
  // never be able to move the on-hand count, because that path writes no
  // record of the delta or a reason. If someone re-adds `stocks` to this
  // schema, this test is what catches it.
  it("strips stocks from an edit payload so the count can't be silently overwritten", () => {
    const result = productUpdateSchema.parse({ ...validProduct, stocks: 99999 });
    expect(result).not.toHaveProperty("stocks");
  });

  it("keeps the fields an edit is allowed to change", () => {
    const result = productUpdateSchema.parse(validProduct);
    expect(result.code).toBe("PIP-012");
    expect(result.name).toBe('Copper Pipe 1/2"');
    expect(result.minLevel).toBe(50);
  });

  it("rejects a blank product name", () => {
    const result = productUpdateSchema.safeParse({ ...validProduct, name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("productCreateSchema", () => {
  // Creating a product sets an opening balance, which is legitimate — the
  // asymmetry with the update schema is deliberate, so it's pinned here.
  it("accepts stocks as an opening balance on create", () => {
    const result = productCreateSchema.parse({ ...validProduct, stocks: 320 });
    expect(result.stocks).toBe(320);
  });

  it("rejects a negative opening balance", () => {
    const result = productCreateSchema.safeParse({ ...validProduct, stocks: -5 });
    expect(result.success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  const base = {
    currentPassword: "demo1234",
    newPassword: "correct-horse",
    confirmPassword: "correct-horse",
  };

  it("accepts a valid change", () => {
    expect(passwordChangeSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a new password under 8 characters", () => {
    const result = passwordChangeSchema.safeParse({
      ...base,
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when the confirmation doesn't match", () => {
    const result = passwordChangeSchema.safeParse({
      ...base,
      confirmPassword: "something-else",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/do not match/i);
    }
  });

  it("rejects reusing the current password as the new one", () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: "demo1234",
      newPassword: "demo1234",
      confirmPassword: "demo1234",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/different/i);
    }
  });
});

describe("stockAdjustmentSchema", () => {
  const base = { productId: "prod_1", qtyAfter: 44, reason: "MISCOUNT" as const };

  it("accepts a corrected count with a reason", () => {
    const result = stockAdjustmentSchema.parse(base);
    expect(result.qtyAfter).toBe(44);
    expect(result.reason).toBe("MISCOUNT");
  });

  it("allows adjusting down to zero", () => {
    expect(stockAdjustmentSchema.safeParse({ ...base, qtyAfter: 0 }).success).toBe(true);
  });

  it("rejects a negative corrected count", () => {
    expect(stockAdjustmentSchema.safeParse({ ...base, qtyAfter: -1 }).success).toBe(false);
  });

  it("rejects a reason outside the allowed set", () => {
    const result = stockAdjustmentSchema.safeParse({ ...base, reason: "SHRINKAGE" });
    expect(result.success).toBe(false);
  });

  it("requires a reason", () => {
    const result = stockAdjustmentSchema.safeParse({ productId: "prod_1", qtyAfter: 44 });
    expect(result.success).toBe(false);
  });
});

describe("userUpdateSchema", () => {
  // Username is the identity key that ActivityLog refNos and the technician
  // link resolve against, so an Owner editing an account must not change it.
  it("ignores username even when one is supplied", () => {
    const result = userUpdateSchema.parse({
      name: "M. Santos",
      role: "ADMIN",
      status: "ACTIVE",
      username: "hijacked",
    });
    expect(result).not.toHaveProperty("username");
  });

  it("rejects a role outside the four defined roles", () => {
    const result = userUpdateSchema.safeParse({
      name: "M. Santos",
      role: "SUPERUSER",
      status: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = userUpdateSchema.safeParse({
      name: "M. Santos",
      role: "ADMIN",
      status: "SUSPENDED",
    });
    expect(result.success).toBe(false);
  });
});
