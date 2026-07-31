-- CreateTable
CREATE TABLE "BOQLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "stt" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "dvt" TEXT,
    "khoiLuong" REAL NOT NULL,
    "donGia" REAL NOT NULL,
    "thuTu" INTEGER NOT NULL,
    CONSTRAINT "BOQLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BOQThucHien" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boqLineId" TEXT NOT NULL,
    "thang" TEXT NOT NULL,
    "khoiLuong" REAL NOT NULL,
    CONSTRAINT "BOQThucHien_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "BOQLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BOQLine_projectId_idx" ON "BOQLine"("projectId");

-- CreateIndex
CREATE INDEX "BOQThucHien_thang_idx" ON "BOQThucHien"("thang");

-- CreateIndex
CREATE UNIQUE INDEX "BOQThucHien_boqLineId_thang_key" ON "BOQThucHien"("boqLineId", "thang");
