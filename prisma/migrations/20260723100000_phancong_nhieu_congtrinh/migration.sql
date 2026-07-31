-- Nới khóa duy nhất của PhanCongNgay: một công nhân được điều nhiều công trình
-- trong một ngày. Đổi @@unique([ngay, congNhanId]) -> [ngay, congNhanId, projectId].
-- SQLite không đổi index kiểu này trực tiếp nên dựng lại bảng.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PhanCongNgay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ngay" TEXT NOT NULL,
    "congNhanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nguoiPhanCong" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhanCongNgay_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhanCongNgay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_PhanCongNgay" ("id", "ngay", "congNhanId", "projectId", "nguoiPhanCong", "ngayTao")
SELECT "id", "ngay", "congNhanId", "projectId", "nguoiPhanCong", "ngayTao" FROM "PhanCongNgay";

DROP TABLE "PhanCongNgay";
ALTER TABLE "new_PhanCongNgay" RENAME TO "PhanCongNgay";

CREATE UNIQUE INDEX "PhanCongNgay_ngay_congNhanId_projectId_key" ON "PhanCongNgay"("ngay", "congNhanId", "projectId");
CREATE INDEX "PhanCongNgay_ngay_idx" ON "PhanCongNgay"("ngay");
CREATE INDEX "PhanCongNgay_projectId_idx" ON "PhanCongNgay"("projectId");

PRAGMA foreign_keys=ON;
