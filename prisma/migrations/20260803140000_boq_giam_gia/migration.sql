-- Chiết khấu / giảm giá BOQ (danh sách dòng giảm dưới TỔNG CỘNG).
CREATE TABLE "BOQGiamGia" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "moTa" TEXT,
  "tuStt" INTEGER NOT NULL,
  "denStt" INTEGER NOT NULL,
  "phanTram" DOUBLE PRECISION NOT NULL,
  "thuTu" INTEGER NOT NULL,
  CONSTRAINT "BOQGiamGia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BOQGiamGia_projectId_idx" ON "BOQGiamGia"("projectId");

ALTER TABLE "BOQGiamGia" ADD CONSTRAINT "BOQGiamGia_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
