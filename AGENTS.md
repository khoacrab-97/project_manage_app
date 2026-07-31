# Ghi chú cho người/agent làm việc trên repo này

## Next.js bản này KHÁC bản bạn quen

Đây là Next.js 16 (Turbopack). API, quy ước và cấu trúc file có thể khác dữ liệu
huấn luyện. **Đọc `node_modules/next/dist/docs/` trước khi viết code.** Cụ thể đã
gặp: `params` và `searchParams` của page là `Promise`, phải `await`.

Nếu dev server báo `Cannot find module '<gói đã cài>'`, gần như chắc chắn là chunk
cache hỏng chứ không phải thiếu gói: `rm -rf .next` rồi chạy lại.

## Quy tắc riêng của dự án

1. **Không sửa `src/lib/data/source/source-data.json` bằng tay.** File này sinh ra
   từ 3 file Excel gốc bằng `npm run extract:source`.

2. **Bất biến số liệu là thứ không được phá.** `npm test` kiểm tra tổng giao dịch
   theo từng ô (mã × công trình) khớp tuyệt đối ma trận `OUTPUT_NAM`. Test đỏ
   nghĩa là mọi con số trên dashboard mất giá trị.

3. **Dòng lỗi không bao giờ vào sổ chính thức** (§17.1 của spec). Chúng nằm ở
   `giaoDichChoXuLy`. Đừng gộp hai tập này lại cho tiện.

4. **Ngưỡng cảnh báo chỉ đặt ở `src/lib/thresholds.ts`.** Spec §6 yêu cầu ngưỡng
   do CEO + Tài chính + Phòng Dự án chốt, nên không rải hằng số vào component.

5. **Bảng màu biểu đồ đã qua validator**, xem chú thích trong
   `src/components/charts/palette.ts`. Đổi màu thì phải chạy lại validator của
   skill `dataviz`. Biểu đồ dùng màu có cảnh báo tương phản ở light mode bắt buộc
   kèm bảng số liệu — đừng bỏ bảng đi cho gọn.

6. **Mọi truy cập dữ liệu đi qua `src/lib/data/repository.ts`.** Đây là ranh giới
   để Phase 2 thay bằng Prisma mà không phải sửa component.

7. **Không tự sinh mã doanh thu – chi phí** (§3.4). Danh mục 55 mã do công ty
   kiểm soát.
