-- Tách giờ tăng ca thành hai loại độc lập: trong ngày và qua đêm (một ngày có
-- thể có cả hai). Backfill từ cột cũ theo loaiTangCa.
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
    "gioTangCaNgay" REAL NOT NULL DEFAULT 0,
    "gioTangCaDem" REAL NOT NULL DEFAULT 0,
    "nguoiChamCong" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChamCong_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChamCong_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ChamCong"
  ("id","ngay","congNhanId","projectId","caSang","caChieu","loaiVang","lyDoVang","gioTangCaNgay","gioTangCaDem","nguoiChamCong","ngayTao")
SELECT "id","ngay","congNhanId","projectId","caSang","caChieu","loaiVang","lyDoVang",
  CASE WHEN "loaiTangCa" = 'QUA_DEM' THEN 0 ELSE "gioTangCa" END,
  CASE WHEN "loaiTangCa" = 'QUA_DEM' THEN "gioTangCa" ELSE 0 END,
  "nguoiChamCong","ngayTao"
FROM "ChamCong";

DROP TABLE "ChamCong";
ALTER TABLE "new_ChamCong" RENAME TO "ChamCong";

CREATE UNIQUE INDEX "ChamCong_ngay_congNhanId_projectId_key" ON "ChamCong"("ngay", "congNhanId", "projectId");
CREATE INDEX "ChamCong_ngay_idx" ON "ChamCong"("ngay");
CREATE INDEX "ChamCong_projectId_idx" ON "ChamCong"("projectId");

PRAGMA foreign_keys=ON;
