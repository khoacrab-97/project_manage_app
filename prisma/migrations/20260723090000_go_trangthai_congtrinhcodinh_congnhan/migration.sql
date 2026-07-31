-- Bỏ hai cột trangThai và projectId khỏi CongNhan theo yêu cầu nghiệp vụ.
-- SQLite không xoá cột trực tiếp được nên dựng lại bảng — đúng cách Prisma sinh.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CongNhan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maCN" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "doi" TEXT NOT NULL DEFAULT 'NOI_THANH',
    "nguoiQuanLy" TEXT,
    "ngheNghiep" TEXT,
    "ghiChu" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_CongNhan" ("id", "maCN", "hoTen", "doi", "nguoiQuanLy", "ngheNghiep", "ghiChu", "ngayTao")
SELECT "id", "maCN", "hoTen", "doi", "nguoiQuanLy", "ngheNghiep", "ghiChu", "ngayTao" FROM "CongNhan";

DROP TABLE "CongNhan";
ALTER TABLE "new_CongNhan" RENAME TO "CongNhan";

CREATE UNIQUE INDEX "CongNhan_maCN_key" ON "CongNhan"("maCN");
CREATE INDEX "CongNhan_doi_idx" ON "CongNhan"("doi");

PRAGMA foreign_keys=ON;
