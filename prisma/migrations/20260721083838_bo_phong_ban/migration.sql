/*
  Warnings:

  - You are about to drop the column `phongBan` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "matKhauHash" TEXT NOT NULL DEFAULT '',
    "vaiTro" TEXT NOT NULL DEFAULT 'CHI_XEM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "hoTen", "id", "image", "isActive", "matKhauHash", "vaiTro") SELECT "createdAt", "email", "emailVerified", "hoTen", "id", "image", "isActive", "matKhauHash", "vaiTro" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_vaiTro_idx" ON "User"("vaiTro");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
