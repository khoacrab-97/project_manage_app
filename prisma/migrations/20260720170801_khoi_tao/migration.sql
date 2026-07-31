-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maCongTrinh" TEXT NOT NULL,
    "tenCongTrinh" TEXT NOT NULL,
    "maBase" TEXT,
    "chuDauTu" TEXT,
    "chiHuyTruong" TEXT,
    "phongPhuTrach" TEXT,
    "ngayBatDau" DATETIME,
    "ngayKetThucKeHoach" DATETIME,
    "trangThai" TEXT NOT NULL DEFAULT 'Đang thi công',
    "loaiDuAn" TEXT,
    "diaDiem" TEXT,
    "giaTriHopDong" REAL,
    "bienLNMucTieu" REAL,
    "ngayCapNhatCuoi" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "googleSheetUrl" TEXT,
    "googleSheetGid" TEXT,
    "lanDongBoCuoi" DATETIME
);

-- CreateTable
CREATE TABLE "CostRevenueCode" (
    "ma" TEXT NOT NULL PRIMARY KEY,
    "ten" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "maCha" TEXT,
    "capMa" INTEGER NOT NULL DEFAULT 1,
    "choPhepNhapTrucTiep" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hieuLucTu" DATETIME,
    "hieuLucDen" DATETIME,
    "thuTuHienThi" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CostRevenueCode_maCha_fkey" FOREIGN KEY ("maCha") REFERENCES "CostRevenueCode" ("ma") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeCrosswalk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maCu" TEXT NOT NULL,
    "tenCu" TEXT NOT NULL,
    "maMoi" TEXT,
    "nguonMap" TEXT NOT NULL DEFAULT 'auto',
    "daDuyet" BOOLEAN NOT NULL DEFAULT false,
    "nguoiDuyet" TEXT,
    "ngayDuyet" DATETIME,
    "ghiChu" TEXT,
    CONSTRAINT "CodeCrosswalk_maMoi_fkey" FOREIGN KEY ("maMoi") REFERENCES "CostRevenueCode" ("ma") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "maDTCP" TEXT,
    "maGoc" TEXT NOT NULL,
    "loaiKeHoach" TEXT NOT NULL DEFAULT 'Chi phí',
    "thang" TEXT NOT NULL,
    "giaTri" REAL NOT NULL,
    "phienBan" INTEGER NOT NULL DEFAULT 1,
    "trangThaiDuyet" TEXT NOT NULL DEFAULT 'DRAFT',
    "ngayHieuLuc" DATETIME,
    "ghiChu" TEXT,
    "nguoiSua" TEXT,
    "ngaySua" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanLine_maDTCP_fkey" FOREIGN KEY ("maDTCP") REFERENCES "CostRevenueCode" ("ma") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenFile" TEXT NOT NULL,
    "hashFile" TEXT NOT NULL,
    "nguon" TEXT NOT NULL DEFAULT 'excel',
    "projectId" TEXT,
    "kyDuLieu" TEXT,
    "nguoiTai" TEXT NOT NULL,
    "thoiDiemTai" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soDong" INTEGER NOT NULL DEFAULT 0,
    "soDongHopLe" INTEGER NOT NULL DEFAULT 0,
    "soDongLoi" INTEGER NOT NULL DEFAULT 0,
    "trangThai" TEXT NOT NULL DEFAULT 'UPLOADED',
    "nguoiDuyet" TEXT,
    "thoiDiemDuyet" DATETIME,
    "thayTheChoId" TEXT,
    CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransactionStaging" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "dongExcel" INTEGER NOT NULL,
    "maCongTrinh" TEXT,
    "tenCongTrinh" TEXT,
    "soHoaDon" TEXT,
    "ngayChungTu" DATETIME,
    "thangThucHien" TEXT,
    "tuanThucHien" INTEGER,
    "noiDung" TEXT,
    "dvt" TEXT,
    "donGia" REAL,
    "soLuong" REAL,
    "soTien" REAL,
    "maDTCP" TEXT,
    "ghiChu" TEXT,
    "rowHash" TEXT NOT NULL,
    CONSTRAINT "TransactionStaging_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "dong" INTEGER NOT NULL,
    "cot" TEXT,
    "maLoi" TEXT NOT NULL,
    "mucDo" TEXT NOT NULL,
    "thongDiep" TEXT NOT NULL,
    "cachXuLy" TEXT,
    "daXuLy" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ImportError_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sttNguon" INTEGER,
    "projectId" TEXT NOT NULL,
    "tenCongTrinhNguon" TEXT,
    "maBase" TEXT,
    "soHoaDon" TEXT,
    "ngayChungTu" DATETIME,
    "thangThucHien" TEXT NOT NULL,
    "tuanThucHien" INTEGER,
    "noiDung" TEXT NOT NULL,
    "dvt" TEXT,
    "donGia" REAL,
    "soLuong" REAL,
    "soTien" REAL NOT NULL,
    "maDTCP" TEXT NOT NULL,
    "ghiChu" TEXT,
    "importBatchId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'CHINH_THUC',
    "rowHash" TEXT NOT NULL,
    "nguoiDuyet" TEXT,
    "ngayDuyet" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_maDTCP_fkey" FOREIGN KEY ("maDTCP") REFERENCES "CostRevenueCode" ("ma") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PeriodLock" (
    "ky" TEXT NOT NULL PRIMARY KEY,
    "daKhoa" BOOLEAN NOT NULL DEFAULT false,
    "nguoiKhoa" TEXT,
    "thoiDiemKhoa" DATETIME,
    "lyDoMoLai" TEXT,
    "nguoiMoLai" TEXT,
    "thoiDiemMoLai" DATETIME
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bang" TEXT NOT NULL,
    "banGhiId" TEXT NOT NULL,
    "transactionId" TEXT,
    "hanhDong" TEXT NOT NULL,
    "truong" TEXT,
    "giaTriTruoc" TEXT,
    "giaTriSau" TEXT,
    "lyDo" TEXT,
    "nguoiThucHien" TEXT NOT NULL,
    "thoiDiem" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loai" TEXT NOT NULL,
    "mucDo" TEXT NOT NULL,
    "maCongTrinh" TEXT,
    "tieuDe" TEXT NOT NULL,
    "moTa" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'Mới',
    "nguoiChiuTrachNhiem" TEXT,
    "ngayPhatSinh" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayDong" DATETIME
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "vaiTro" TEXT NOT NULL DEFAULT 'CHI_XEM',
    "phongBan" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserProject" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ngayGan" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "projectId"),
    CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    PRIMARY KEY ("provider", "providerAccountId"),
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,

    PRIMARY KEY ("identifier", "token")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_maCongTrinh_key" ON "Project"("maCongTrinh");

-- CreateIndex
CREATE INDEX "Project_trangThai_idx" ON "Project"("trangThai");

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

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
