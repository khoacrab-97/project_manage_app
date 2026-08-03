-- VAT của BOQ theo công trình (additive, có default nên dữ liệu cũ không vỡ).
ALTER TABLE "Project" ADD COLUMN "donGiaGomVAT" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "vatPhanTram" DOUBLE PRECISION NOT NULL DEFAULT 10;
