# Hướng dẫn triển khai Railway Postgres

Ứng dụng dùng **Postgres làm cơ sở dữ liệu trung tâm**. Local và Railway cùng trỏ
vào một database qua `DATABASE_URL`, nên không còn đồng bộ file `data/prmana.db`.

## Cấu hình Railway

Trong cùng project Railway cần có:

- Service app: `project_manage_app`
- Service database: `Postgres`
- Biến của app:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
ADMIN_EMAIL=<email-admin>
```

`DATABASE_URL` phải nằm ở service app, không chỉ ở service Postgres: Dockerfile
nhận biến này trong build stage để `next build` chạy được, và runtime cũng dùng
cùng biến đó để chạy migration rồi truy vấn DB.

Không cần nữa:

```text
RAILWAY_RUN_UID
Volume /app/data
file:/app/data/prmana.db
```

Giữ volume SQLite cũ vài ngày sau cutover để rollback, rồi detach/delete khi đã
kiểm tra ổn định.

## Cấu hình local

Lấy `DATABASE_PUBLIC_URL` của service `Postgres` trên Railway và đặt vào `.env`:

```text
DATABASE_URL=<DATABASE_PUBLIC_URL>
ADMIN_EMAIL=<email-admin>
```

Không commit `.env`.

## Cài đặt và chạy

```bash
corepack enable
pnpm install
pnpm exec prisma generate
pnpm run dev
```

Mở `http://localhost:3000`.

## Migration và seed

Dockerfile chạy tự động lệnh này mỗi lần container start trên Railway:

```bash
pnpm run db:deploy
```

Lệnh này chỉ áp các migration đã commit trong `prisma/migrations`; không sinh
migration mới và không seed dữ liệu. Nếu cần chạy thủ công để kiểm tra/sửa lỗi
deploy, dùng cùng lệnh trên từ máy có `DATABASE_URL` production.

Seed chỉ dùng cho database trống/demo:

```bash
pnpm run db:seed
pnpm run db:matkhau -- <email-admin> <mat-khau>
```

Nếu đã import dữ liệu từ SQLite production thì không chạy seed lại.

## Kiểm tra sau deploy

```bash
pnpm test
pnpm run build
pnpm run db:kiemtra
pnpm run db:kiemtra-danhmuc
```

Kiểm tra trên web:

- `/dang-nhap` trả 200.
- Đăng nhập admin thành công.
- Dashboard `/` trả 200.
- Tạo/sửa một công trình demo ở local, reload Railway thấy cùng dữ liệu.

## Sao lưu

Không sao lưu bằng copy thư mục `data/` nữa. Sao lưu bằng công cụ của Postgres
provider hoặc export từ Railway Postgres.

Trước các thay đổi lớn nên giữ một bản backup database và ghi lại commit đang
chạy trên Railway.
