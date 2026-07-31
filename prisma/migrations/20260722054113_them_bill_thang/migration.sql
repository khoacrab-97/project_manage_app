-- CreateTable
CREATE TABLE "BillThang" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "thang" TEXT NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'CHO_XAC_NHAN',
    "nguoiNhap" TEXT,
    "ngayNhap" DATETIME,
    "nguoiXacNhan" TEXT,
    "ngayXacNhan" DATETIME,
    CONSTRAINT "BillThang_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BillThang_trangThai_idx" ON "BillThang"("trangThai");

-- CreateIndex
CREATE UNIQUE INDEX "BillThang_projectId_thang_key" ON "BillThang"("projectId", "thang");
