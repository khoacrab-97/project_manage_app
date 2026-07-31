-- Ngày lễ do ADMIN khai báo. Khi tổng hợp, ngày lễ xử lý như Chủ nhật: không
-- tính công thường, toàn bộ giờ làm dồn vào cột tăng ca ngày lễ.
CREATE TABLE "NgayLe" (
    "ngay" TEXT NOT NULL PRIMARY KEY,
    "ten" TEXT NOT NULL,
    "ngayTao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
