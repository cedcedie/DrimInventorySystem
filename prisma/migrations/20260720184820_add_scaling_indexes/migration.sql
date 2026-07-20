-- CreateIndex
CREATE INDEX "Mrf_technicianId_idx" ON "Mrf"("technicianId");

-- CreateIndex
CREATE INDEX "Mrf_productId_idx" ON "Mrf"("productId");

-- CreateIndex
CREATE INDEX "Mrf_status_idx" ON "Mrf"("status");

-- CreateIndex
CREATE INDEX "Mrf_createdAt_idx" ON "Mrf"("createdAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE INDEX "StockIn_productId_idx" ON "StockIn"("productId");

-- CreateIndex
CREATE INDEX "StockIn_supplierId_idx" ON "StockIn"("supplierId");

-- CreateIndex
CREATE INDEX "StockIn_byUserId_idx" ON "StockIn"("byUserId");

-- CreateIndex
CREATE INDEX "StockIn_createdAt_idx" ON "StockIn"("createdAt");

-- CreateIndex
CREATE INDEX "StockOut_productId_idx" ON "StockOut"("productId");

-- CreateIndex
CREATE INDEX "StockOut_technicianId_idx" ON "StockOut"("technicianId");

-- CreateIndex
CREATE INDEX "StockOut_byUserId_idx" ON "StockOut"("byUserId");

-- CreateIndex
CREATE INDEX "StockOut_createdAt_idx" ON "StockOut"("createdAt");
