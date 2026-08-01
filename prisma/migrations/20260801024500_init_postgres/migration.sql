-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "maCongTrinh" TEXT NOT NULL,
    "tenCongTrinh" TEXT NOT NULL,
    "maBase" TEXT,
    "chuDauTu" TEXT,
    "chiHuyTruong" TEXT,
    "phongPhuTrach" TEXT,
    "ngayBatDau" TIMESTAMP(3),
    "ngayKetThucKeHoach" TIMESTAMP(3),
    "ngayHoanThanh" TIMESTAMP(3),
    "trangThai" TEXT NOT NULL DEFAULT 'Đang thi công',
    "loaiDuAn" TEXT,
    "diaDiem" TEXT,
    "giaTriHopDong" DOUBLE PRECISION,
    "bienLNMucTieu" DOUBLE PRECISION,
    "ngayCapNhatCuoi" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "googleSheetUrl" TEXT,
    "googleSheetGid" TEXT,
    "lanDongBoCuoi" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stt" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "dvt" TEXT,
    "khoiLuong" DOUBLE PRECISION NOT NULL,
    "donGia" DOUBLE PRECISION NOT NULL,
    "thuTu" INTEGER NOT NULL,
    "hoanThanh" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BOQLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQCot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "thuTu" INTEGER NOT NULL,

    CONSTRAINT "BOQCot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQGiaTriCot" (
    "id" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,
    "boqLineId" TEXT NOT NULL,
    "giaTri" TEXT NOT NULL,

    CONSTRAINT "BOQGiaTriCot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillThang" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "thang" TEXT NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'CHO_XAC_NHAN',
    "nguoiNhap" TEXT,
    "ngayNhap" TIMESTAMP(3),
    "nguoiXacNhan" TEXT,
    "ngayXacNhan" TIMESTAMP(3),

    CONSTRAINT "BillThang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQThucHien" (
    "id" TEXT NOT NULL,
    "boqLineId" TEXT NOT NULL,
    "thang" TEXT NOT NULL,
    "khoiLuong" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BOQThucHien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostRevenueCode" (
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "maCha" TEXT,
    "capMa" INTEGER NOT NULL DEFAULT 1,
    "choPhepNhapTrucTiep" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hieuLucTu" TIMESTAMP(3),
    "hieuLucDen" TIMESTAMP(3),
    "thuTuHienThi" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CostRevenueCode_pkey" PRIMARY KEY ("ma")
);

-- CreateTable
CREATE TABLE "CodeCrosswalk" (
    "id" TEXT NOT NULL,
    "maCu" TEXT NOT NULL,
    "tenCu" TEXT NOT NULL,
    "maMoi" TEXT,
    "nguonMap" TEXT NOT NULL DEFAULT 'auto',
    "daDuyet" BOOLEAN NOT NULL DEFAULT false,
    "nguoiDuyet" TEXT,
    "ngayDuyet" TIMESTAMP(3),
    "ghiChu" TEXT,

    CONSTRAINT "CodeCrosswalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "maDTCP" TEXT,
    "maGoc" TEXT NOT NULL,
    "loaiKeHoach" TEXT NOT NULL DEFAULT 'Chi phí',
    "thang" TEXT NOT NULL,
    "giaTri" DOUBLE PRECISION NOT NULL,
    "phienBan" INTEGER NOT NULL DEFAULT 1,
    "trangThaiDuyet" TEXT NOT NULL DEFAULT 'DRAFT',
    "ngayHieuLuc" TIMESTAMP(3),
    "ghiChu" TEXT,
    "nguoiSua" TEXT,
    "ngaySua" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "tenFile" TEXT NOT NULL,
    "hashFile" TEXT NOT NULL,
    "nguon" TEXT NOT NULL DEFAULT 'excel',
    "projectId" TEXT,
    "kyDuLieu" TEXT,
    "nguoiTai" TEXT NOT NULL,
    "thoiDiemTai" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soDong" INTEGER NOT NULL DEFAULT 0,
    "soDongHopLe" INTEGER NOT NULL DEFAULT 0,
    "soDongLoi" INTEGER NOT NULL DEFAULT 0,
    "trangThai" TEXT NOT NULL DEFAULT 'UPLOADED',
    "nguoiDuyet" TEXT,
    "thoiDiemDuyet" TIMESTAMP(3),
    "thayTheChoId" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionStaging" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "dongExcel" INTEGER NOT NULL,
    "maCongTrinh" TEXT,
    "tenCongTrinh" TEXT,
    "soHoaDon" TEXT,
    "ngayChungTu" TIMESTAMP(3),
    "thangThucHien" TEXT,
    "tuanThucHien" INTEGER,
    "noiDung" TEXT,
    "dvt" TEXT,
    "donGia" DOUBLE PRECISION,
    "soLuong" DOUBLE PRECISION,
    "soTien" DOUBLE PRECISION,
    "maDTCP" TEXT,
    "ghiChu" TEXT,
    "rowHash" TEXT NOT NULL,

    CONSTRAINT "TransactionStaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "dong" INTEGER NOT NULL,
    "cot" TEXT,
    "maLoi" TEXT NOT NULL,
    "mucDo" TEXT NOT NULL,
    "thongDiep" TEXT NOT NULL,
    "cachXuLy" TEXT,
    "daXuLy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "sttNguon" INTEGER,
    "projectId" TEXT NOT NULL,
    "tenCongTrinhNguon" TEXT,
    "maBase" TEXT,
    "soHoaDon" TEXT,
    "ngayChungTu" TIMESTAMP(3),
    "thangThucHien" TEXT NOT NULL,
    "tuanThucHien" INTEGER,
    "noiDung" TEXT NOT NULL,
    "dvt" TEXT,
    "donGia" DOUBLE PRECISION,
    "soLuong" DOUBLE PRECISION,
    "soTien" DOUBLE PRECISION NOT NULL,
    "maDTCP" TEXT NOT NULL,
    "ghiChu" TEXT,
    "importBatchId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'CHINH_THUC',
    "rowHash" TEXT NOT NULL,
    "nguoiDuyet" TEXT,
    "ngayDuyet" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodLock" (
    "ky" TEXT NOT NULL,
    "daKhoa" BOOLEAN NOT NULL DEFAULT false,
    "nguoiKhoa" TEXT,
    "thoiDiemKhoa" TIMESTAMP(3),
    "lyDoMoLai" TEXT,
    "nguoiMoLai" TEXT,
    "thoiDiemMoLai" TIMESTAMP(3),

    CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("ky")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "bang" TEXT NOT NULL,
    "banGhiId" TEXT NOT NULL,
    "transactionId" TEXT,
    "hanhDong" TEXT NOT NULL,
    "truong" TEXT,
    "giaTriTruoc" TEXT,
    "giaTriSau" TEXT,
    "lyDo" TEXT,
    "nguoiThucHien" TEXT NOT NULL,
    "thoiDiem" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "mucDo" TEXT NOT NULL,
    "maCongTrinh" TEXT,
    "tieuDe" TEXT NOT NULL,
    "moTa" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'Mới',
    "nguoiChiuTrachNhiem" TEXT,
    "ngayPhatSinh" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayDong" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "matKhauHash" TEXT NOT NULL DEFAULT '',
    "vaiTro" TEXT NOT NULL DEFAULT 'CHI_XEM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProject" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ngayGan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProject_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "MenuBiAn" (
    "vaiTro" TEXT NOT NULL,
    "maMenu" TEXT NOT NULL,

    CONSTRAINT "MenuBiAn_pkey" PRIMARY KEY ("vaiTro","maMenu")
);

-- CreateTable
CREATE TABLE "CongNhan" (
    "id" TEXT NOT NULL,
    "maCN" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "doi" TEXT NOT NULL DEFAULT 'NOI_THANH',
    "doiDAId" TEXT,
    "nguoiQuanLy" TEXT,
    "ngheNghiep" TEXT,
    "ghiChu" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CongNhan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CongTrinhChamCong" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "khuVuc" TEXT NOT NULL DEFAULT 'NOI_THANH',
    "nguoiPhuTrach" TEXT,
    "doiDAId" TEXT,

    CONSTRAINT "CongTrinhChamCong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoiDA" (
    "id" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "nguoiQuanLyId" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoiDA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhanCongNgay" (
    "id" TEXT NOT NULL,
    "ngay" TEXT NOT NULL,
    "congNhanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "buoi" TEXT NOT NULL DEFAULT 'CA_NGAY',
    "nguoiPhanCong" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhanCongNgay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamCong" (
    "id" TEXT NOT NULL,
    "ngay" TEXT NOT NULL,
    "congNhanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "caSang" BOOLEAN NOT NULL DEFAULT false,
    "caChieu" BOOLEAN NOT NULL DEFAULT false,
    "loaiVang" TEXT,
    "lyDoVang" TEXT,
    "gioTangCaNgay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gioTangCaDem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nguoiChamCong" TEXT,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamCong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NgayLe" (
    "id" TEXT NOT NULL,
    "thang" INTEGER NOT NULL,
    "ngay" INTEGER NOT NULL,
    "nam" INTEGER,
    "ten" TEXT NOT NULL,
    "ngayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NgayLe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_maCongTrinh_key" ON "Project"("maCongTrinh");

-- CreateIndex
CREATE INDEX "Project_trangThai_idx" ON "Project"("trangThai");

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

-- CreateIndex
CREATE INDEX "BOQLine_projectId_idx" ON "BOQLine"("projectId");

-- CreateIndex
CREATE INDEX "BOQCot_projectId_idx" ON "BOQCot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BOQGiaTriCot_cotId_boqLineId_key" ON "BOQGiaTriCot"("cotId", "boqLineId");

-- CreateIndex
CREATE INDEX "BillThang_trangThai_idx" ON "BillThang"("trangThai");

-- CreateIndex
CREATE UNIQUE INDEX "BillThang_projectId_thang_key" ON "BillThang"("projectId", "thang");

-- CreateIndex
CREATE INDEX "BOQThucHien_thang_idx" ON "BOQThucHien"("thang");

-- CreateIndex
CREATE UNIQUE INDEX "BOQThucHien_boqLineId_thang_key" ON "BOQThucHien"("boqLineId", "thang");

-- CreateIndex
CREATE INDEX "CostRevenueCode_loai_isActive_idx" ON "CostRevenueCode"("loai", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CodeCrosswalk_maCu_key" ON "CodeCrosswalk"("maCu");

-- CreateIndex
CREATE INDEX "PlanLine_projectId_thang_idx" ON "PlanLine"("projectId", "thang");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLine_projectId_maGoc_thang_phienBan_key" ON "PlanLine"("projectId", "maGoc", "thang", "phienBan");

-- CreateIndex
CREATE INDEX "ImportBatch_trangThai_idx" ON "ImportBatch"("trangThai");

-- CreateIndex
CREATE INDEX "ImportBatch_hashFile_idx" ON "ImportBatch"("hashFile");

-- CreateIndex
CREATE INDEX "TransactionStaging_importBatchId_idx" ON "TransactionStaging"("importBatchId");

-- CreateIndex
CREATE INDEX "TransactionStaging_rowHash_idx" ON "TransactionStaging"("rowHash");

-- CreateIndex
CREATE INDEX "ImportError_importBatchId_mucDo_idx" ON "ImportError"("importBatchId", "mucDo");

-- CreateIndex
CREATE INDEX "Transaction_projectId_thangThucHien_idx" ON "Transaction"("projectId", "thangThucHien");

-- CreateIndex
CREATE INDEX "Transaction_maDTCP_thangThucHien_idx" ON "Transaction"("maDTCP", "thangThucHien");

-- CreateIndex
CREATE INDEX "Transaction_thangThucHien_idx" ON "Transaction"("thangThucHien");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_rowHash_projectId_key" ON "Transaction"("rowHash", "projectId");

-- CreateIndex
CREATE INDEX "AuditLog_bang_banGhiId_idx" ON "AuditLog"("bang", "banGhiId");

-- CreateIndex
CREATE INDEX "AuditLog_thoiDiem_idx" ON "AuditLog"("thoiDiem");

-- CreateIndex
CREATE INDEX "Alert_mucDo_trangThai_idx" ON "Alert"("mucDo", "trangThai");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_vaiTro_idx" ON "User"("vaiTro");

-- CreateIndex
CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "MenuBiAn_vaiTro_idx" ON "MenuBiAn"("vaiTro");

-- CreateIndex
CREATE UNIQUE INDEX "CongNhan_maCN_key" ON "CongNhan"("maCN");

-- CreateIndex
CREATE INDEX "CongNhan_doi_idx" ON "CongNhan"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "CongTrinhChamCong_projectId_key" ON "CongTrinhChamCong"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DoiDA_ten_key" ON "DoiDA"("ten");

-- CreateIndex
CREATE INDEX "DoiDA_nguoiQuanLyId_idx" ON "DoiDA"("nguoiQuanLyId");

-- CreateIndex
CREATE INDEX "PhanCongNgay_ngay_idx" ON "PhanCongNgay"("ngay");

-- CreateIndex
CREATE INDEX "PhanCongNgay_projectId_idx" ON "PhanCongNgay"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PhanCongNgay_ngay_congNhanId_projectId_key" ON "PhanCongNgay"("ngay", "congNhanId", "projectId");

-- CreateIndex
CREATE INDEX "ChamCong_ngay_idx" ON "ChamCong"("ngay");

-- CreateIndex
CREATE INDEX "ChamCong_projectId_idx" ON "ChamCong"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ChamCong_ngay_congNhanId_projectId_key" ON "ChamCong"("ngay", "congNhanId", "projectId");

-- CreateIndex
CREATE INDEX "NgayLe_thang_ngay_idx" ON "NgayLe"("thang", "ngay");

-- AddForeignKey
ALTER TABLE "BOQLine" ADD CONSTRAINT "BOQLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQCot" ADD CONSTRAINT "BOQCot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQGiaTriCot" ADD CONSTRAINT "BOQGiaTriCot_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "BOQCot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQGiaTriCot" ADD CONSTRAINT "BOQGiaTriCot_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "BOQLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillThang" ADD CONSTRAINT "BillThang_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQThucHien" ADD CONSTRAINT "BOQThucHien_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "BOQLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCode" ADD CONSTRAINT "CostRevenueCode_maCha_fkey" FOREIGN KEY ("maCha") REFERENCES "CostRevenueCode"("ma") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeCrosswalk" ADD CONSTRAINT "CodeCrosswalk_maMoi_fkey" FOREIGN KEY ("maMoi") REFERENCES "CostRevenueCode"("ma") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLine" ADD CONSTRAINT "PlanLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLine" ADD CONSTRAINT "PlanLine_maDTCP_fkey" FOREIGN KEY ("maDTCP") REFERENCES "CostRevenueCode"("ma") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionStaging" ADD CONSTRAINT "TransactionStaging_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_maDTCP_fkey" FOREIGN KEY ("maDTCP") REFERENCES "CostRevenueCode"("ma") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CongNhan" ADD CONSTRAINT "CongNhan_doiDAId_fkey" FOREIGN KEY ("doiDAId") REFERENCES "DoiDA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CongTrinhChamCong" ADD CONSTRAINT "CongTrinhChamCong_doiDAId_fkey" FOREIGN KEY ("doiDAId") REFERENCES "DoiDA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CongTrinhChamCong" ADD CONSTRAINT "CongTrinhChamCong_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoiDA" ADD CONSTRAINT "DoiDA_nguoiQuanLyId_fkey" FOREIGN KEY ("nguoiQuanLyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhanCongNgay" ADD CONSTRAINT "PhanCongNgay_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhanCongNgay" ADD CONSTRAINT "PhanCongNgay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamCong" ADD CONSTRAINT "ChamCong_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamCong" ADD CONSTRAINT "ChamCong_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
