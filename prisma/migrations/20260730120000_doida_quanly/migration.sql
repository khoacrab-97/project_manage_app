-- Đội DA có người quản lý (tài khoản User) — người này chấm công cho cả dự án
-- và ở tab Chấm công chỉ thấy dự án mình quản lý.
ALTER TABLE "DoiDA" ADD COLUMN "nguoiQuanLyId" TEXT;
CREATE INDEX "DoiDA_nguoiQuanLyId_idx" ON "DoiDA"("nguoiQuanLyId");
