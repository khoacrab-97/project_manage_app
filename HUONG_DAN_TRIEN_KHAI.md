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
npm install
npx prisma generate
npm run dev
```

Mở `http://localhost:3000`.

## Migration và seed

Triển khai schema lên Postgres:

```bash
npx prisma migrate deploy
```

Seed chỉ dùng cho database trống/demo:

```bash
npm run db:seed
npm run db:matkhau -- <email-admin> <mat-khau>
```

Nếu đã import dữ liệu từ SQLite production thì không chạy seed lại.

## Kiểm tra sau deploy

```bash
npm test
npm run build
npm run db:kiemtra
npm run db:kiemtra-danhmuc
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
