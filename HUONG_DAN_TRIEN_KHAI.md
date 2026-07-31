# Hướng dẫn triển khai nội bộ

Tài liệu cho người cài đặt ứng dụng lên máy chủ công ty để CEO và Phòng Dự án
duyệt giao diện.

---

## ⚠️ Đọc trước khi cài

**Ứng dụng chưa có đăng nhập.** Ai mở được địa chỉ là xem được toàn bộ số liệu:
doanh thu, chi phí, biên lợi nhuận từng công trình, giá trị từng nhà thầu phụ.

Vì vậy:

- ✅ Cài trong **mạng nội bộ công ty** (LAN hoặc sau VPN).
- ❌ **Không** mở cổng ra Internet, không NAT, không gán tên miền công khai.
- ❌ Không đưa lên Vercel / Netlify / máy chủ cloud public.

Khi nào cần cho người ngoài mạng nội bộ xem, phải làm đăng nhập và phân quyền
theo vai trò (§8.9 của spec) trước — việc này thuộc Phase 2.

Ngoài ra, thanh đầu trang có nhãn **DỮ LIỆU DEMO**. Giữ nguyên nhãn đó cho tới
khi hệ thống chạy trên dữ liệu nhập thật, để không ai nhầm số minh họa với số
quyết toán.

---

## Yêu cầu máy chủ

| Hạng mục | Mức tối thiểu |
|---|---|
| Node.js | 20 trở lên (khuyến nghị 22) — chỉ cần nếu chạy cách B |
| Docker | 24 trở lên — chỉ cần nếu chạy cách A |
| RAM | 1 GB |
| Ổ đĩa | 1 GB |
| Cổng | 3000 (đổi được) |

Không cần cơ sở dữ liệu. Toàn bộ số liệu nằm trong ứng dụng.

---

## Cách A — Docker (khuyến nghị nếu máy chủ đã có Docker)

```bash
cd prmana-app
docker compose up -d --build
```

Xong. Mở `http://<địa-chỉ-máy-chủ>:3000`.

Các lệnh thường dùng:

```bash
docker compose logs -f      # xem log
docker compose restart      # khởi động lại
docker compose down         # dừng hẳn
docker compose up -d --build  # cập nhật sau khi sửa code
```

Đổi cổng: sửa `"3000:3000"` trong `docker-compose.yml` thành `"8080:3000"`.

Container đặt `restart: unless-stopped` nên tự bật lại khi máy chủ khởi động lại.

> **Lưu ý trung thực:** Dockerfile và docker-compose.yml được viết theo đúng
> chuẩn standalone của Next.js, nhưng **chưa được build thử** vì máy soạn thảo
> không cài Docker. Phần bên trong container (server standalone) thì **đã chạy
> và kiểm chứng đầy đủ** — xem mục Nghiệm thu bên dưới. Nếu `docker compose up`
> báo lỗi, hãy dùng cách B, không có gì mất mát.

---

## Cách B — Chỉ cần Node, không cần Docker

Chạy trên máy có Node để đóng gói:

```bash
cd prmana-app
npm install
npm run package
```

Lệnh trên tạo **hai** thư mục:

```
prmana-app/
  dist/            bản chạy (~26 MB). Đóng gói lại là XOÁ SẠCH thư mục này.
  data/prmana.db   dữ liệu vận hành. NẰM NGOÀI dist/ nên không bao giờ bị đè.
```

> **Vì sao tách ra:** nếu để cơ sở dữ liệu bên trong `dist/` thì mỗi lần cập nhật
> ứng dụng sẽ xoá mất toàn bộ số liệu đã nhập.

Chép **cả hai** thư mục sang máy chủ, rồi chạy:

```
Windows:  dist\chay.cmd
Linux:    ./dist/chay.sh
```

Mở `http://<địa-chỉ-máy-chủ>:3000`.

Hai file `chay.cmd` / `chay.sh` được sinh tự động và đã cắm sẵn biến môi trường
`DATABASE_URL`, nên người vận hành không phải nhớ gì thêm.

Đổi cổng — đặt `PORT` trước khi chạy:

```bash
# Linux / macOS
PORT=8080 ./dist/chay.sh

# Windows PowerShell
$env:PORT=8080; .\dist\chay.cmd
```

Máy chủ chỉ cần Node, **không cần** `npm install` lại — thư viện đã nằm trong
`dist/node_modules`, kể cả `better-sqlite3` bản biên dịch sẵn.

### Cập nhật ứng dụng khi đang chạy

**Phải dừng ứng dụng trước khi đóng gói lại.** Windows khoá file của tiến trình
đang chạy nên `npm run package` sẽ báo lỗi và dừng (dữ liệu không hề hấn gì). Dừng
bằng cách đóng cửa sổ đang chạy, hoặc:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object -Expand OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

```bash
# Linux
pkill -f 'node server.js'
```

### Để ứng dụng tự chạy lại sau khi khởi động máy

**Windows** — dùng Task Scheduler, tạo task chạy khi máy khởi động:

- Program: `cmd.exe`
- Arguments: `/c chay.cmd`
- Start in: đường dẫn tới thư mục `dist`

**Linux** — tạo `/etc/systemd/system/prmana.service`:

```ini
[Unit]
Description=Quan ly Doanh thu - Chi phi
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/prmana/dist
ExecStart=/opt/prmana/dist/chay.sh
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now prmana
sudo systemctl status prmana
```

---

## Nghiệm thu sau khi cài

Chạy lần lượt, tất cả phải đúng:

1. Mở `http://<máy-chủ>:3000` — trang **Tổng quan điều hành** hiện ra, giao diện
   có màu và bố cục (nếu trang trắng trơn không CSS thì thiếu thư mục
   `.next/static`, đóng gói lại bằng `npm run package`).

2. Bốn thẻ KPI lũy kế phải đúng các số này:

   | Chỉ tiêu | Giá trị |
   |---|---|
   | Doanh thu lũy kế | **27,23 tỷ** |
   | Chi phí lũy kế | **24,16 tỷ** |
   | Lợi nhuận gộp | **3,06 tỷ** |
   | Biên lợi nhuận gộp | **11,2%** |

   Bốn số này chỉ ra đúng khi ứng dụng đọc được cơ sở dữ liệu. Nếu trang báo lỗi
   truy vấn, gần như chắc chắn thiếu file
   `dist/node_modules/better-sqlite3/build/Release/better_sqlite3.node` — đóng gói
   lại, script sẽ tự dừng và báo nếu file này thiếu.

3. Vào **Nhập dữ liệu**, kéo thả file `MẪU DOANH THU - CHI PHÍ.xlsx`. Kết quả
   phải là: nhận **15/15 cột**, bỏ qua **10 cột thừa**, bắt **9 lỗi thiếu Tháng
   thực hiện**, **9 lỗi thiếu Mã DT–CP**, **2 cảnh báo thiếu chứng từ**.

4. Vào **Công trình**, bấm một mã bất kỳ, sang tab **Giao dịch** — phải thấy danh
   sách giao dịch chi tiết.

Đây chính là bộ kiểm tra đã chạy trên bản đóng gói thật, chạy nền tách rời:
11/11 trang trả 200, trang nặng nhất 1,4 giây, đọc đúng cơ sở dữ liệu SQLite.

---

## Tài khoản và mật khẩu

Hệ thống **không cho tự đăng ký**. Mọi tài khoản do quản trị cấp.

Cấp mật khẩu cho tài khoản quản trị đầu tiên (chạy một lần sau khi cài):

```bash
npm run db:matkhau -- <email-quan-tri>
```

Lệnh in ra mật khẩu — chép lại, không xem lại được. Sau đó đăng nhập rồi vào
**Quản trị → Cấp tài khoản mới** để tạo tài khoản cho người khác ngay trên giao diện.

Mật khẩu lưu bằng băm scrypt, **không ai đọc lại được kể cả quản trị**. Quên mật khẩu
thì quản trị bấm "Đặt lại MK" để cấp mật khẩu mới.

Nếu khoá mất tài khoản quản trị cuối cùng, dùng lại `npm run db:matkhau` từ dòng lệnh
trên máy chủ để mở lại.

## Sao lưu

**Sao lưu hệ thống = copy thư mục `data/`.** Chỉ một file `data/prmana.db` chứa toàn
bộ số liệu. Nên sao lưu trước mỗi lần cập nhật ứng dụng và định kỳ hằng ngày.

Khôi phục: dừng ứng dụng, chép file `prmana.db` cũ đè vào `data/`, chạy lại.

> Đóng gói lại ứng dụng **không** đụng tới `data/` — script chỉ chép cơ sở dữ liệu
> vào đó khi thư mục còn trống, không bao giờ ghi đè.

---

## Cập nhật ứng dụng

Khi sửa code hoặc khi ba file Excel nguồn thay đổi:

```bash
npm run extract:source   # chỉ khi file Excel nguồn đổi
npm test                 # bắt buộc xanh — kiểm tra tổng khớp OUTPUT_NAM
npm run package          # đóng gói lại vào dist/
```

Rồi chép lại `dist/` sang máy chủ và khởi động lại dịch vụ.

Nếu dùng Docker: `docker compose up -d --build`.

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Trang trắng, không có định dạng | Thiếu `.next/static` | Đóng gói lại bằng `npm run package` |
| `EADDRINUSE` | Cổng 3000 đang bị chiếm | Đổi `PORT` sang cổng khác |
| Máy khác trong mạng không vào được | Server chỉ nghe 127.0.0.1 | Đặt `HOSTNAME=0.0.0.0` rồi chạy lại |
| `Cannot find module '<gói>'` khi chạy `npm run dev` | Cache build hỏng | `rm -rf .next` rồi chạy lại |
| Tải file Excel báo "không đọc được" | File đang mở trong Excel, hoặc là file tạm `~$` | Đóng Excel, tải đúng file gốc |
| Số KPI khác bảng ở mục Nghiệm thu | Dữ liệu nguồn bị sửa tay | Chạy `npm test`, xem test bất biến |
