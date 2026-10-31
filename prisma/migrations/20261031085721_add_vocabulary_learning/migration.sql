-- CreateTable
CREATE TABLE "VocabularyCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '',
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "selfReviews" INTEGER NOT NULL DEFAULT 0,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" DATETIME,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VocabularyCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VocabularyAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "choices" TEXT NOT NULL DEFAULT '[]',
    "cardRevision" INTEGER NOT NULL,
    "answer" TEXT,
    "correct" BOOLEAN,
    "grade" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "VocabularyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 只增加字段，避免重建已有用户表。
ALTER TABLE "User" ADD COLUMN "vocabularySettings" TEXT NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "VocabularyCard_userId_dueAt_idx" ON "VocabularyCard"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyCard_userId_wordId_key" ON "VocabularyCard"("userId", "wordId");

-- CreateIndex
CREATE INDEX "VocabularyAttempt_userId_completedAt_idx" ON "VocabularyAttempt"("userId", "completedAt");
