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
AXIOM_TOKEN=<basic-token>
AXIOM_DATASET=prmana_app
AXIOM_SERVICE_NAME=prmana-app
AXIOM_LOG_FULL_API_BODIES=true
```

`DATABASE_URL` phải nằm ở service app, không chỉ ở service Postgres: Dockerfile
nhận biến này trong build stage để `next build` chạy được, và runtime cũng dùng
cùng biến đó để chạy migration rồi truy vấn DB.

`AXIOM_TOKEN` là Basic API token chỉ có quyền ingest vào dataset log của ứng dụng.
Nếu chưa cấu hình Axiom thì app vẫn chạy bình thường và chỉ ghi log ra stdout/stderr
của Railway.

Nếu workspace Axiom dùng region/edge riêng, thêm biến theo hướng dẫn của Axiom:

```text
AXIOM_EDGE=<edge>
AXIOM_EDGE_URL=<edge-url>
```

Quy ước log production: event dùng `lower_snake_case`; không ghi mật khẩu, cookie,
session token, email, họ tên, tên file gốc, nội dung Excel thô, số tiền hoặc chi
tiết giao dịch vào log.

Riêng khi `AXIOM_LOG_FULL_API_BODIES=true`, API route và Server Action log sẽ ghi
raw request/response body theo yêu cầu vận hành production. API route ghi raw HTTP
body; Server Action ghi raw JSON của arguments và return value sau khi Next giải
mã action. JSON/text được ghi UTF-8 trong `requestBodyRaw` / `responseBodyRaw`;
binary như Excel được ghi base64 và đánh dấu bằng `requestBodyEncoding` /
`responseBodyEncoding`. Chế độ này có thể đưa dữ liệu nhạy cảm và file lớn lên
Axiom; tắt bằng cách xoá biến hoặc đặt khác `true`.

Các event chính:

- `api_request_completed` / `api_request_failed`: các route `/api/*`.
- `server_action_completed` / `server_action_failed`: Server Action đã được wrap,
  ví dụ action tạo/sửa/mở lại công trình.
- `web_request_seen`: page request và Server Action `GET/POST` đi qua web route.
- `web_request_redirected`: request web bị proxy chuyển về `/dang-nhap`.

Sau deploy có thể kiểm tra trong Axiom:

```apl
['prmana_app'] | where event == "web_request_seen" | limit 20
```

```apl
['prmana_app'] | where event == "api_request_completed" | limit 20
```

```apl
['prmana_app'] | where event == "server_action_completed" | limit 20
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
