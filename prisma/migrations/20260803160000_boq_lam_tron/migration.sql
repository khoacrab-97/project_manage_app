-- Cho phép tắt làm tròn cột Thành tiền của BOQ theo từng công trình.
ALTER TABLE "Project" ADD COLUMN "lamTronThanhTien" BOOLEAN NOT NULL DEFAULT true;
