-- Đơn giá BOQ tách thành phần (Vật tư / Nhân công / Máy…). Additive + nullable
-- (trừ kiểu có default) nên dữ liệu cũ giữ nguyên, DB dùng chung không vỡ.

-- Kiểu đơn giá của công trình + VAT riêng từng thành phần.
ALTER TABLE "Project" ADD COLUMN "kieuDonGiaBOQ" TEXT NOT NULL DEFAULT 'DON';
ALTER TABLE "Project" ADD COLUMN "vatVT" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "vatVTK" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "vatNC" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "vatMTC" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "vatNCMTC" DOUBLE PRECISION;

-- Đơn giá từng thành phần trên mỗi dòng BOQ.
ALTER TABLE "BOQLine" ADD COLUMN "dgVT" DOUBLE PRECISION;
ALTER TABLE "BOQLine" ADD COLUMN "dgVTK" DOUBLE PRECISION;
ALTER TABLE "BOQLine" ADD COLUMN "dgNC" DOUBLE PRECISION;
ALTER TABLE "BOQLine" ADD COLUMN "dgMTC" DOUBLE PRECISION;
ALTER TABLE "BOQLine" ADD COLUMN "dgNCMTC" DOUBLE PRECISION;
