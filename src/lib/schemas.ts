import { z } from "zod";
import { REPORT_TYPES } from "@/lib/data/reports";

const id = z.string().min(1, "Invalid id");
const name = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max = 200) => z.string().trim().max(max).optional();
const positiveQty = z.coerce.number().finite().positive("A positive quantity is required");
const nonNegativeNumber = z.coerce.number().finite().nonnegative();

export const categoryCreateSchema = z.object({
  name: name("Category name"),
});

export const supplierCreateSchema = z.object({
  name: name("Supplier name"),
  contact: optionalText(300),
  supplies: optionalText(300),
});

export const technicianSchema = z.object({
  empNo: name("Employee number", 40),
  name: name("Name"),
  position: name("Position", 80),
});

const productBase = {
  code: name("Product code", 40),
  name: name("Product name"),
  categoryId: id,
  unit: name("Unit", 30),
  amount: nonNegativeNumber.optional(),
  stocks: nonNegativeNumber.optional(),
  minLevel: nonNegativeNumber.optional(),
  supplierId: z.string().min(1).nullable().optional(),
  imageKey: z.string().max(500).nullable().optional(),
};

export const productCreateSchema = z.object(productBase);
export const productUpdateSchema = z.object(productBase);

export const productMinLevelSchema = z.object({
  minLevel: nonNegativeNumber,
});

export const userCreateSchema = z.object({
  name: name("Name"),
  username: name("Username", 60),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["OWNER", "ADMIN", "WAREHOUSE_STAFF", "TECHNICIAN"], {
    message: "A valid role is required",
  }),
});

export const profileUpdateSchema = z.object({
  name: name("Name"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(200, "New password is too long"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

// Owner-only edit of another account. Username stays immutable — it's the
// identity key that ActivityLog refNos and technician links resolve against.
export const userUpdateSchema = z.object({
  name: name("Name"),
  role: z.enum(["OWNER", "ADMIN", "WAREHOUSE_STAFF", "TECHNICIAN"], {
    message: "A valid role is required",
  }),
  status: z.enum(["ACTIVE", "INACTIVE"], { message: "A valid status is required" }),
});

export const mrfCreateSchema = z.object({
  productId: id,
  qty: positiveQty,
  project: name("Project", 200),
});

export const stockInSchema = z.object({
  productId: id,
  supplierId: id,
  qty: positiveQty,
});

export const stockOutSchema = z.object({
  mrfId: id,
  qty: positiveQty,
});

export const reportExportSchema = z.object({
  type: z.enum(REPORT_TYPES, { message: "A valid report type is required" }),
  from: z.string().min(1, "Start date is required"),
  to: z.string().min(1, "End date is required"),
});
