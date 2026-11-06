CREATE TABLE "VideoGeneration" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "errorItemId" TEXT NOT NULL,
 "source" TEXT NOT NULL, "voice" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued',
 "attempt" TEXT NOT NULL DEFAULT '', "plan" TEXT NOT NULL DEFAULT '', "error" TEXT NOT NULL DEFAULT '', "resultHash" TEXT NOT NULL DEFAULT '',
 "bytes" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VideoGeneration_userId_errorItemId_idx" ON "VideoGeneration"("userId","errorItemId");
CREATE INDEX "VideoGeneration_status_createdAt_idx" ON "VideoGeneration"("status","createdAt");
