-- Thêm cột buổi cho phân công. Dòng cũ mặc định CA_NGAY (được điều trọn ngày).
ALTER TABLE "PhanCongNgay" ADD COLUMN "buoi" TEXT NOT NULL DEFAULT 'CA_NGAY';
