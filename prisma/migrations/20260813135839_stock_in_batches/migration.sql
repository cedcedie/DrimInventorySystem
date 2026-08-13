-- Stock In becomes multi-item: one SI-#### batch can now cover several products
-- received from the same supplier. Existing StockIn rows are preserved by wrapping
-- each one in its own 1-item StockInBatch (same refNo, supplier, user, date).

-- CreateTable
CREATE TABLE "StockInBatch" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockInBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockInBatch_refNo_key" ON "StockInBatch"("refNo");
CREATE INDEX "StockInBatch_supplierId_idx" ON "StockInBatch"("supplierId");
CREATE INDEX "StockInBatch_byUserId_idx" ON "StockInBatch"("byUserId");
CREATE INDEX "StockInBatch_createdAt_idx" ON "StockInBatch"("createdAt");

ALTER TABLE "StockInBatch" ADD CONSTRAINT "StockInBatch_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockInBatch" ADD CONSTRAINT "StockInBatch_byUserId_fkey"
  FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one batch per legacy StockIn row, reusing its refNo/supplier/user/date.
INSERT INTO "StockInBatch" ("id", "refNo", "supplierId", "byUserId", "createdAt")
SELECT
  'batch_' || "id",
  "refNo",
  "supplierId",
  "byUserId",
  "createdAt"
FROM "StockIn";

-- Detach StockIn from its old direct fields, point it at the new batch instead.
ALTER TABLE "StockIn" ADD COLUMN "stockInBatchId" TEXT;
UPDATE "StockIn" SET "stockInBatchId" = 'batch_' || "id";
ALTER TABLE "StockIn" ALTER COLUMN "stockInBatchId" SET NOT NULL;

ALTER TABLE "StockIn" DROP CONSTRAINT "StockIn_supplierId_fkey";
ALTER TABLE "StockIn" DROP CONSTRAINT "StockIn_byUserId_fkey";
DROP INDEX IF EXISTS "StockIn_refNo_key";
DROP INDEX IF EXISTS "StockIn_supplierId_idx";
DROP INDEX IF EXISTS "StockIn_byUserId_idx";

ALTER TABLE "StockIn" DROP COLUMN "refNo";
ALTER TABLE "StockIn" DROP COLUMN "supplierId";
ALTER TABLE "StockIn" DROP COLUMN "byUserId";

CREATE INDEX "StockIn_stockInBatchId_idx" ON "StockIn"("stockInBatchId");

ALTER TABLE "StockIn" ADD CONSTRAINT "StockIn_stockInBatchId_fkey"
  FOREIGN KEY ("stockInBatchId") REFERENCES "StockInBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
