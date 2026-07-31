-- Thêm tên đội DA cho công nhân ngoại thành (Đội DA). Nullable, an toàn với dữ liệu cũ.
ALTER TABLE "CongNhan" ADD COLUMN "tenDoiDA" TEXT;
