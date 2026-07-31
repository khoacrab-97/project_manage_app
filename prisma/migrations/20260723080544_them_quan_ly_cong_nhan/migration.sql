-- CreateTable
CREATE TABLE "CongNhan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maCN" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "doi" TEXT NOT NULL DEFAULT 'NOI_THANH',
    "nguoiQuanLy" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'DANG_LAM',
    "projectId" TEXT,
    "ngheNghiep" TEXT,
    "ghiChu" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CongNhan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CongTrinhChamCong" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "khuVuc" TEXT NOT NULL DEFAULT 'NOI_THANH',
    "nguoiPhuTrach" TEXT,
    CONSTRAINT "CongTrinhChamCong_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhanCongNgay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ngay" TEXT NOT NULL,
    "congNhanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nguoiPhanCong" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhanCongNgay_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhanCongNgay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChamCong" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ngay" TEXT NOT NULL,
    "congNhanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "soCong" REAL NOT NULL DEFAULT 1,
    "gioTangCa" REAL NOT NULL DEFAULT 0,
    "nguoiChamCong" TEXT,
    "ghiChu" TEXT,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChamCong_congNhanId_fkey" FOREIGN KEY ("congNhanId") REFERENCES "CongNhan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChamCong_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CongNhan_maCN_key" ON "CongNhan"("maCN");

-- CreateIndex
CREATE INDEX "CongNhan_doi_idx" ON "CongNhan"("doi");

-- CreateIndex
CREATE INDEX "CongNhan_trangThai_idx" ON "CongNhan"("trangThai");

-- CreateIndex
CREATE INDEX "CongNhan_projectId_idx" ON "CongNhan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CongTrinhChamCong_projectId_key" ON "CongTrinhChamCong"("projectId");

-- CreateIndex
CREATE INDEX "PhanCongNgay_ngay_idx" ON "PhanCongNgay"("ngay");

-- CreateIndex
CREATE INDEX "PhanCongNgay_projectId_idx" ON "PhanCongNgay"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PhanCongNgay_ngay_congNhanId_key" ON "PhanCongNgay"("ngay", "congNhanId");

-- CreateIndex
CREATE INDEX "ChamCong_ngay_idx" ON "ChamCong"("ngay");

-- CreateIndex
CREATE INDEX "ChamCong_projectId_idx" ON "ChamCong"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ChamCong_ngay_congNhanId_projectId_key" ON "ChamCong"("ngay", "congNhanId", "projectId");
