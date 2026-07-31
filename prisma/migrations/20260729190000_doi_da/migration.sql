-- Đội DA thành danh mục riêng (một đội làm nhiều công trình).
CREATE TABLE "DoiDA" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ten" TEXT NOT NULL,
  "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DoiDA_ten_key" ON "DoiDA"("ten");

-- Chuyển tên đội DA (chữ) đang có sang danh mục — MỖI TÊN một hàng.
INSERT INTO "DoiDA" ("id", "ten")
  SELECT lower(hex(randomblob(12))), "ten"
  FROM (SELECT DISTINCT "tenDoiDA" AS "ten" FROM "CongNhan"
        WHERE "tenDoiDA" IS NOT NULL AND "tenDoiDA" <> '');

-- Công nhân: thêm FK doiDAId, trỏ theo tên cũ, rồi bỏ cột tên chữ.
ALTER TABLE "CongNhan" ADD COLUMN "doiDAId" TEXT;
UPDATE "CongNhan"
  SET "doiDAId" = (SELECT "id" FROM "DoiDA" WHERE "DoiDA"."ten" = "CongNhan"."tenDoiDA")
  WHERE "tenDoiDA" IS NOT NULL AND "tenDoiDA" <> '';
ALTER TABLE "CongNhan" DROP COLUMN "tenDoiDA";

-- Công trình: gán đội DA sở hữu (dùng khi ngoại thành).
ALTER TABLE "CongTrinhChamCong" ADD COLUMN "doiDAId" TEXT;

CREATE INDEX "CongNhan_doiDAId_idx" ON "CongNhan"("doiDAId");
CREATE INDEX "CongTrinhChamCong_doiDAId_idx" ON "CongTrinhChamCong"("doiDAId");
