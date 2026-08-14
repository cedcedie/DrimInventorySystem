-- ActivityLog: mark account/permission/company-config rows as sensitive so
-- the new system-wide activity feed can hide them from non-Owner/Admin users
-- while the existing full audit log (Owner/Admin only) stays unfiltered.
ALTER TABLE "ActivityLog" ADD COLUMN "sensitive" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "ActivityLog_sensitive_createdAt_idx" ON "ActivityLog"("sensitive", "createdAt");

-- Notification: track who sent a manually-composed notification (null for
-- every automatic, event-triggered notification).
ALTER TABLE "Notification" ADD COLUMN "senderUserId" TEXT;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
