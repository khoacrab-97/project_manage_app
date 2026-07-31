-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BOQLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stt" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "dvt" TEXT,
    "khoiLuong" REAL NOT NULL,
    "donGia" REAL NOT NULL,
    "thuTu" INTEGER NOT NULL,
    "hoanThanh" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BOQLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BOQLine" ("donGia", "dvt", "id", "khoiLuong", "noiDung", "projectId", "stt", "thuTu") SELECT "donGia", "dvt", "id", "khoiLuong", "noiDung", "projectId", "stt", "thuTu" FROM "BOQLine";
DROP TABLE "BOQLine";
ALTER TABLE "new_BOQLine" RENAME TO "BOQLine";
CREATE INDEX "BOQLine_projectId_idx" ON "BOQLine"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
