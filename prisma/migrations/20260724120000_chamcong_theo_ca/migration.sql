-- Chấm công theo CA: thay soCong/ghiChu bằng caSang/caChieu + loại vắng + loại tăng ca.
-- Dựng lại bảng (SQLite), backfill từ soCong cũ: >=0,5 -> có ca sáng; >=1 -> cả ca chiều.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ChamCong" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ngay" TEXT NOT NULL,
    "congNhanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "caSang" BOOLEAN NOT NULL DEFAULT false,
    "caChieu" BOOLEAN NOT NULL DEFAULT false,
    "loaiVang" TEXT,
    "lyDoVang" TEXT,
    "gioTangCa" REAL NOT NULL DEFAULT 0,
    "loaiTangCa" TEXT,
    "nguoiChamCong" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChamCong_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChamCong_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ChamCong"
  ("id","ngay","congNhanId","projectId","caSang","caChieu","gioTangCa","loaiTangCa","nguoiChamCong","ngayTao")
SELECT "id","ngay","congNhanId","projectId",
  CASE WHEN "soCong" >= 0.5 THEN true ELSE false END,
  CASE WHEN "soCong" >= 1 THEN true ELSE false END,
  "gioTangCa",
  CASE WHEN "gioTangCa" > 0 THEN 'TRONG_NGAY' ELSE NULL END,
  "nguoiChamCong","ngayTao"
FROM "ChamCong";

DROP TABLE "ChamCong";
ALTER TABLE "new_ChamCong" RENAME TO "ChamCong";

CREATE UNIQUE INDEX "ChamCong_ngay_congNhanId_projectId_key" ON "ChamCong"("ngay", "congNhanId", "projectId");
CREATE INDEX "ChamCong_ngay_idx" ON "ChamCong"("ngay");
CREATE INDEX "ChamCong_projectId_idx" ON "ChamCong"("projectId");

PRAGMA foreign_keys=ON;
