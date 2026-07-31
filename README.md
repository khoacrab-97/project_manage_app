# Quản lý Doanh thu – Chi phí Thi công Xây dựng

Bản mẫu giao diện (prototype) cho hệ thống quản trị doanh thu – chi phí thi công,
xây theo `PLAN_XAY_DUNG_APP_QUAN_LY_DOANH_THU_CHI_PHI_XAY_DUNG.md`.

## Chạy thử

```bash
npm install
npm run dev      # http://localhost:3000 — KHÔNG cần cơ sở dữ liệu
npm test         # 16 test, quan trọng nhất là bất biến số liệu
npm run build    # kiểm tra build production
```

## Trạng thái: đây là gì và chưa là gì

**Có thật:**

- Số tổng lấy nguyên từ ma trận `OUTPUT_NAM` của file tổng hợp (31 công trình,
  39 mã có phát sinh, 326 ô số liệu).
- Danh mục 55 mã doanh thu – chi phí trích nguyên từ `DM_MA_DT_CP`.
- Bộ đọc file Excel và kiểm tra dữ liệu **chạy thật** — kéo thả file công trình
  vào trang *Nhập dữ liệu* để thấy.
- Toàn bộ công thức KPI theo §21.

**Chưa có (Phase 2):**

- Cơ sở dữ liệu thật. Hiện dùng bộ nhớ trong; `prisma/schema.prisma` đã viết sẵn
  làm hợp đồng dữ liệu để rà soát trước.
- Đăng nhập, phân quyền theo vai trò (§8.9).
- Workflow phê duyệt hai cấp, khóa kỳ, điều chỉnh sau khóa (§8.7).
- Ghi sổ thật từ màn hình nhập liệu (hiện dừng ở bước kiểm tra).
- Gửi email cảnh báo, đồng bộ thư mục tự động.

**Từng giao dịch trong app là dữ liệu dựng ngược từ số tổng, không phải chứng từ
thật.** Nhãn `DỮ LIỆU DEMO` trên thanh đầu trang phản ánh điều đó — đừng gỡ cho
tới khi hệ thống chạy trên dữ liệu nhập thật.

## Ba phát hiện từ dữ liệu nguồn, cần công ty quyết

1. **Hai hệ mã không khớp nhau.** `KẾ HOẠCH TH` dùng `DA*`, sổ thực hiện dùng
   `CP-*`. Không có ánh xạ thì mọi KPI Kế hoạch vs Thực hiện đều vô nghĩa. Bảng
   ánh xạ do máy đề xuất nằm ở trang *Kế hoạch – Ngân sách → Ánh xạ hệ mã*, **Tài
   chính phải rà và duyệt**. Riêng `DA11` (Tiền ĐB CQT bị cắt trừ) không có mã
   tương ứng và đang bị loại khỏi KPI.

2. **12/31 công trình có chi phí nhưng doanh thu bằng 0.** Tổng chi phí đang treo
   khoảng 3,7 tỷ. Cần xác minh: chưa tới kỳ ra bill, hay thiếu dữ liệu doanh thu?

3. **Chỉ mã `Bill` có phát sinh doanh thu.** `TDATU`, `TDATT1`, `TDAQT` đều bằng
   0. Dashboard đang lấy `Bill` làm chỉ tiêu doanh thu điều hành — đây là quyết
   định CEO cần chốt (§23 mục 2), đổi ở `src/lib/thresholds.ts`.

## Cấu trúc

```
scripts/extract-source.mjs      Trích dữ liệu từ 3 file Excel gốc
prisma/schema.prisma            Hợp đồng dữ liệu cho Phase 2 (chưa chạy)
src/lib/
  data/source/source-data.json  Dữ liệu trích ra — KHÔNG sửa tay
  data/seed/                    Phân rã ngược số tổng thành giao dịch
  data/repository.ts            ★ Ranh giới đổi sang Prisma
  kpi.ts  thresholds.ts         Công thức §21 và ngưỡng cảnh báo
  crosswalk.ts                  Ánh xạ DA* → CP-*
  excel/parse-chitiet-th.ts     Thay đoạn Power Query gốc
  validation.ts                 Quy tắc từ sheet KIỂM TRA INPUT
src/app/                        9 trang theo menu §22
```

## Cập nhật dữ liệu nguồn

Khi 3 file Excel thay đổi:

```bash
npm run extract:source
npm test        # bất biến phải vẫn xanh
```
