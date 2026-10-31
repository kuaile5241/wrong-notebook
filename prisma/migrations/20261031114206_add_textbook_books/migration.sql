-- CreateTable
CREATE TABLE "TextbookBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedKey" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'english',
    "stage" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "volume" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "edition" TEXT NOT NULL,
    "isbn" TEXT NOT NULL DEFAULT '',
    "sourceTitle" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TextbookUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "moduleTitle" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "pageReference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "courseUrl" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TextbookUnit_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "TextbookBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TextbookTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT NOT NULL DEFAULT '',
    "translation" TEXT NOT NULL DEFAULT '',
    "atlasId" TEXT NOT NULL DEFAULT '',
    "useAtlasImage" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TextbookTerm_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "TextbookUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 只增加列，不重建既有练习表。
ALTER TABLE "VocabularyAttempt" ADD COLUMN "scope" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "TextbookBook_seedKey_key" ON "TextbookBook"("seedKey");

-- CreateIndex
CREATE INDEX "TextbookBook_published_archived_stage_grade_idx" ON "TextbookBook"("published", "archived", "stage", "grade");

-- CreateIndex
CREATE INDEX "TextbookUnit_bookId_position_idx" ON "TextbookUnit"("bookId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TextbookUnit_bookId_code_key" ON "TextbookUnit"("bookId", "code");

-- CreateIndex
CREATE INDEX "TextbookTerm_unitId_position_idx" ON "TextbookTerm"("unitId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TextbookTerm_unitId_key_key" ON "TextbookTerm"("unitId", "key");
