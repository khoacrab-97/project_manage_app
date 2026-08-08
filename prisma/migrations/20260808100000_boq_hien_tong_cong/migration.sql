-- Tùy chọn hiện/ẩn cột "Đơn giá tổng cộng" + "Thành tiền tổng cộng" (kiểu tách).
ALTER TABLE "Project" ADD COLUMN "hienTongCongBOQ" BOOLEAN NOT NULL DEFAULT true;
