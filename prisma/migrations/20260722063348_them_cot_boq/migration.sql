-- CreateTable
CREATE TABLE "BOQCot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "thuTu" INTEGER NOT NULL,
    CONSTRAINT "BOQCot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BOQGiaTriCot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotId" TEXT NOT NULL,
    "boqLineId" TEXT NOT NULL,
    "giaTri" TEXT NOT NULL,
    CONSTRAINT "BOQGiaTriCot_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "BOQCot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BOQGiaTriCot_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "BOQLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BOQCot_projectId_idx" ON "BOQCot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BOQGiaTriCot_cotId_boqLineId_key" ON "BOQGiaTriCot"("cotId", "boqLineId");
