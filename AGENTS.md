# Ghi chú cho người/agent làm việc trên repo này

## Next.js bản này KHÁC bản bạn quen

Đây là Next.js 16 (Turbopack). API, quy ước và cấu trúc file có thể khác dữ liệu
huấn luyện. **Đọc `node_modules/next/dist/docs/` trước khi viết code.** Cụ thể đã
gặp: `params` và `searchParams` của page là `Promise`, phải `await`.

Nếu dev server báo `Cannot find module '<gói đã cài>'`, gần như chắc chắn là chunk
cache hỏng chứ không phải thiếu gói: `rm -rf .next` rồi chạy lại.

## Package manager

Repo này dùng **pnpm 11.20.0** theo `packageManager` trong `package.json`.
Không dùng `npm`, `npx`, `yarn`, `package-lock.json` hoặc `yarn.lock`.

- Cài dependency: `pnpm install`
- Chạy lệnh package: `pnpm run <script>`
- Chạy binary: `pnpm exec <binary>`
- Thêm dependency: `pnpm add <package>` hoặc `pnpm add -D <package>`

## Quy tắc riêng của dự án

1. **Không sửa `src/lib/data/source/source-data.json` bằng tay.** File này sinh ra
   từ 3 file Excel gốc bằng `pnpm run extract:source`.

2. **Bất biến số liệu là thứ không được phá.** `pnpm test` kiểm tra tổng giao dịch
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

8. **Tailwind v4: ưu tiên class canonical, tránh arbitrary spacing không cần
   thiết.** Biome rule `tailwindcss(suggestCanonicalClasses)` sẽ cảnh báo các
   class như `w-[76px]`, `min-w-[220px]`, `left-[90px]`, `max-w-[320px]`,
   `max-h-[4.75rem]` vì có dạng canonical tương đương theo `--spacing: .25rem`:
   `w-19`, `min-w-55`, `left-22.5`, `max-w-80`, `max-h-19`. Tailwind v4 chấp
   nhận thang số tự do, kể cả số lẻ như `22.5`, `32.5`, `37.5`, và số lớn như
   `400`.

   Chỉ giữ arbitrary value khi thật sự không có canonical rõ ràng, ví dụ
   `max-h-[60vh]`, `w-[min(34rem,72vw)]`, `grid-cols-[1fr_7rem_5rem]`,
   `shadow-[...]`, `text-[11px]`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
