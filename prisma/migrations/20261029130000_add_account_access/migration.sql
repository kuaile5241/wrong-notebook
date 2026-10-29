-- 新增字段不重建用户表；旧账号保持原权限与不限时。
ALTER TABLE "User" ADD COLUMN "accessExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "canUseAi" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "canImportExport" BOOLEAN NOT NULL DEFAULT true;
