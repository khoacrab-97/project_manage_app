-- Ngày lễ đổi từ chuỗi ngày (yyyy-MM-dd) sang thang/ngay/nam để hỗ trợ LẶP LẠI
-- HẰNG NĂM (nam = NULL). Lễ dương lịch cố định (1/1, 30/4, 1/5, 2/9, 24/11) đổi
-- thành lặp hằng năm; các ngày lễ khác giữ đúng năm đã nhập (lễ âm lịch).
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_NgayLe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thang" INTEGER NOT NULL,
    "ngay" INTEGER NOT NULL,
    "nam" INTEGER,
    "ten" TEXT NOT NULL,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_NgayLe" ("id", "thang", "ngay", "nam", "ten", "ngayTao")
SELECT
    lower(hex(randomblob(12))),
    CAST(substr("ngay", 6, 2) AS INTEGER),
    CAST(substr("ngay", 9, 2) AS INTEGER),
    CASE
        WHEN substr("ngay", 6, 5) IN ('01-01', '04-30', '05-01', '09-02', '11-24') THEN NULL
        ELSE CAST(substr("ngay", 1, 4) AS INTEGER)
    END,
    "ten",
    "ngayTao"
FROM "NgayLe";

DROP TABLE "NgayLe";
ALTER TABLE "new_NgayLe" RENAME TO "NgayLe";
CREATE INDEX "NgayLe_thang_ngay_idx" ON "NgayLe"("thang", "ngay");

-- Điền sẵn các lễ dương lịch chuẩn còn THIẾU (chỉ thêm khi chưa có lặp hằng năm ở
-- ngày đó — nên không tạo trùng với dữ liệu đã chuyển ở trên).
INSERT INTO "NgayLe" ("id", "thang", "ngay", "nam", "ten", "ngayTao")
SELECT 'le-tet-duong', 1, 1, NULL, 'Tết Dương lịch', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NgayLe" WHERE "thang" = 1 AND "ngay" = 1 AND "nam" IS NULL);
INSERT INTO "NgayLe" ("id", "thang", "ngay", "nam", "ten", "ngayTao")
SELECT 'le-30-4', 4, 30, NULL, 'Ngày Giải phóng miền Nam', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NgayLe" WHERE "thang" = 4 AND "ngay" = 30 AND "nam" IS NULL);
INSERT INTO "NgayLe" ("id", "thang", "ngay", "nam", "ten", "ngayTao")
SELECT 'le-1-5', 5, 1, NULL, 'Quốc tế Lao động', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NgayLe" WHERE "thang" = 5 AND "ngay" = 1 AND "nam" IS NULL);
INSERT INTO "NgayLe" ("id", "thang", "ngay", "nam", "ten", "ngayTao")
SELECT 'le-2-9', 9, 2, NULL, 'Quốc khánh', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NgayLe" WHERE "thang" = 9 AND "ngay" = 2 AND "nam" IS NULL);
INSERT INTO "NgayLe" ("id", "thang", "ngay", "nam", "ten", "ngayTao")
SELECT 'le-24-11', 11, 24, NULL, 'Ngày Văn hóa Việt Nam', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NgayLe" WHERE "thang" = 11 AND "ngay" = 24 AND "nam" IS NULL);

PRAGMA foreign_keys=ON;
