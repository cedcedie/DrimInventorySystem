-- AlterEnum
ALTER TYPE "MrfStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "permissionOverrides" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "description" TEXT;
ALTER TABLE "Product" ALTER COLUMN "amount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Mrf" ADD COLUMN "externalRefNo" TEXT,
ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "MrfItem" (
    "id" TEXT NOT NULL,
    "mrfId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyRequested" INTEGER NOT NULL,
    "qtyFulfilled" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "MrfItem_pkey" PRIMARY KEY ("id")
);

-- Backfill from legacy single-item Mrf rows
INSERT INTO "MrfItem" ("id", "mrfId", "productId", "qtyRequested", "qtyFulfilled")
SELECT
  'migrated_' || "id",
  "id",
  "productId",
  "qty",
  CASE WHEN "status"::text = 'FULFILLED' THEN "qty" ELSE 0 END
FROM "Mrf";

-- DropForeignKey
ALTER TABLE "Mrf" DROP CONSTRAINT "Mrf_productId_fkey";

-- AlterTable
ALTER TABLE "Mrf" DROP COLUMN "productId",
DROP COLUMN "qty";

-- DropIndex (one stock-out per MRF → many)
DROP INDEX IF EXISTS "StockOut_mrfId_key";

-- AlterTable
ALTER TABLE "StockOut" ADD COLUMN "mrfItemId" TEXT;

-- CreateTable
CREATE TABLE "RoleDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleDefId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mrf_externalRefNo_idx" ON "Mrf"("externalRefNo");

-- CreateIndex
CREATE INDEX "MrfItem_mrfId_idx" ON "MrfItem"("mrfId");

-- CreateIndex
CREATE INDEX "MrfItem_productId_idx" ON "MrfItem"("productId");

-- CreateIndex
CREATE INDEX "StockOut_mrfId_idx" ON "StockOut"("mrfId");

-- CreateIndex
CREATE INDEX "StockOut_mrfItemId_idx" ON "StockOut"("mrfItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDef_name_key" ON "RoleDef"("name");

-- CreateIndex
CREATE INDEX "RolePermission_roleDefId_idx" ON "RolePermission"("roleDefId");

-- CreateIndex
CREATE INDEX "RolePermission_module_idx" ON "RolePermission"("module");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleDefId_module_key" ON "RolePermission"("roleDefId", "module");

-- CreateIndex
CREATE INDEX "Permission_userId_idx" ON "Permission"("userId");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_userId_module_key" ON "Permission"("userId", "module");

-- AddForeignKey
ALTER TABLE "MrfItem" ADD CONSTRAINT "MrfItem_mrfId_fkey" FOREIGN KEY ("mrfId") REFERENCES "Mrf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MrfItem" ADD CONSTRAINT "MrfItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOut" ADD CONSTRAINT "StockOut_mrfItemId_fkey" FOREIGN KEY ("mrfItemId") REFERENCES "MrfItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleDefId_fkey" FOREIGN KEY ("roleDefId") REFERENCES "RoleDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
