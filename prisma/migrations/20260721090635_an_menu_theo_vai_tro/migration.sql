-- CreateTable
CREATE TABLE "MenuBiAn" (
    "vaiTro" TEXT NOT NULL,
    "maMenu" TEXT NOT NULL,

    PRIMARY KEY ("vaiTro", "maMenu")
);

-- CreateIndex
CREATE INDEX "MenuBiAn_vaiTro_idx" ON "MenuBiAn"("vaiTro");
