/**
 * Gom bản standalone thành một thư mục chạy được: `dist/`.
 *
 * Next chỉ đặt server.js + node_modules rút gọn vào .next/standalone; hai thư mục
 * .next/static và public phải tự chép vào đúng chỗ, nếu thiếu thì trang lên
 * nhưng mất sạch CSS. Script này làm việc đó và chạy được cả trên Windows.
 *
 * Cơ sở dữ liệu chạy trên Postgres qua biến DATABASE_URL. Bản đóng gói chỉ chứa
 * ứng dụng, không chứa dữ liệu vận hành.
 */
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const goc = process.cwd();
const standalone = path.join(goc, ".next", "standalone");
const dich = path.join(goc, "dist");

if (!existsSync(standalone)) {
  console.error('Chưa có .next/standalone. Chạy "pnpm run build" trước.');
  process.exit(1);
}

// ---------- 1. Dựng lại dist/ ----------
// XOÁ NỘI DUNG bên trong dist/ chứ KHÔNG xoá chính thư mục dist/. Trên Windows,
// một tiến trình (kể cả shell đang lấy dist/ làm thư mục hiện hành) khoá được
// CHÍNH thư mục dist/ khiến `rmSync(dist)` báo EBUSY, nhưng vẫn xoá được các file/
// thư mục con bên trong. Cách này tránh hẳn kẹt khoá đó.
// Vẫn báo EPERM/EBUSY rõ ràng nếu có file con đang bị tiến trình mở (app đang chạy).
try {
  if (existsSync(dich)) {
    for (const ten of readdirSync(dich)) {
      rmSync(path.join(dich, ten), { recursive: true, force: true });
    }
  } else {
    mkdirSync(dich, { recursive: true });
  }
} catch (e) {
  if (e.code === "EPERM" || e.code === "EBUSY") {
    console.error("");
    console.error("Không xoá được thư mục dist/ vì ỨNG DỤNG ĐANG CHẠY.");
    console.error("Hãy dừng ứng dụng rồi chạy lại lệnh này:");
    console.error("");
    console.error("  Windows:  Ngắt cửa sổ đang chạy, hoặc trong PowerShell:");
    console.error("            Get-NetTCPConnection -LocalPort 3000 -State Listen |");
    console.error("              Select-Object -Expand OwningProcess | ForEach-Object {");
    console.error("                Stop-Process -Id $_ -Force }");
    console.error("  Linux:    pkill -f 'node server.js'");
    console.error("");
    console.error("Dữ liệu trong data/ KHÔNG bị ảnh hưởng.");
    process.exit(1);
  }
  throw e;
}
cpSync(standalone, dich, { recursive: true });
cpSync(path.join(goc, ".next", "static"), path.join(dich, ".next", "static"), { recursive: true });
if (existsSync(path.join(goc, "public"))) {
  cpSync(path.join(goc, "public"), path.join(dich, "public"), { recursive: true });
}
// Biểu mẫu Bill KT-08-BM01 đọc lúc chạy theo đường dẫn tương đối với thư mục
// làm việc, mà bản đóng gói chạy từ dist/ — nên phải chép sang.
cpSync(path.join(goc, "templates"), path.join(dich, "templates"), { recursive: true });

// ---------- 2. Sinh sẵn lệnh chạy ----------
// DATABASE_URL không được ghi vào dist/ vì là secret. Máy chạy phải đặt biến này
// trỏ tới Postgres trước khi khởi động.
const CONG = 3000;

/*
 * Nghe trên "::" chứ KHÔNG phải "0.0.0.0".
 * Windows phân giải `localhost` ra ::1 (IPv6) TRƯỚC 127.0.0.1. Nếu chỉ nghe
 * 0.0.0.0 thì server chỉ có IPv4: curl vẫn vào được vì nó tự lùi về IPv4, nhưng
 * trình duyệt mở http://localhost:3000 có thể không vào được. "::" cho dual-stack,
 * nhận cả IPv6 lẫn IPv4.
 */
const DIA_CHI = "::";

writeFileSync(
  path.join(dich, "chay.cmd"),
  [
    "@echo off",
    "REM Khoi dong ung dung Quan ly Doanh thu - Chi phi",
    "cd /d %~dp0",
    "set NODE_ENV=production",
    `set HOSTNAME=${DIA_CHI}`,
    `if "%PORT%"=="" set PORT=${CONG}`,
    'if "%DATABASE_URL%"=="" (',
    "  echo Chua cau hinh DATABASE_URL Postgres.",
    "  exit /b 1",
    ")",
    // Ba chế độ:
    //   chay.cmd       -> bấm tay: in hướng dẫn + mở trình duyệt
    //   chay.cmd nen   -> chạy ngầm, không cửa sổ, không mở trình duyệt (Task Scheduler)
    //   chay.cmd moi   -> TẮT bản đang chạy rồi khởi động lại (lấy bản mới sau khi
    //                     đóng gói lại — nếu không, bản cũ vẫn chạy và tưởng chưa sửa)
    'if "%1"=="moi" (',
    '  for /f "tokens=5" %%p in (\'netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"\') do taskkill /F /PID %%p >nul 2>&1',
    ")",
    // Bấm nhầm hai lần thì node ném EADDRINUSE kèm stack trace khó hiểu, nên
    // đang chạy sẵn thì thoát ngay (bấm tay thì mở trình duyệt trước khi thoát).
    'netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul',
    "if not errorlevel 1 (",
    '  if not "%1"=="nen" start "" http://localhost:%PORT%',
    "  exit /b",
    ")",
    'if not "%1"=="nen" echo Dang chay tai http://localhost:%PORT%',
    'if not "%1"=="nen" echo DONG CUA SO NAY LA TAT APP.',
    // Mở trình duyệt sau khi server kịp lắng nghe. Dùng PowerShell cho gọn,
    // tránh lồng dấu nháy của "start" trong cmd.
    'if not "%1"=="nen" start "" /min powershell -NoProfile -Command "Start-Sleep 6; Start-Process \'http://localhost:%PORT%\'"',
    "node server.js",
    "",
  ].join("\r\n"),
  "utf8"
);

const shPath = path.join(dich, "chay.sh");
writeFileSync(
  shPath,
  [
    "#!/bin/sh",
    "# Khởi động ứng dụng Quản lý Doanh thu – Chi phí",
    'cd "$(dirname "$0")"',
    "export NODE_ENV=production",
    `export HOSTNAME=${DIA_CHI}`,
    `export PORT="\${PORT:-${CONG}}"`,
    `if [ -z "\${DATABASE_URL:-}" ]; then`,
    '  echo "Chưa cấu hình DATABASE_URL Postgres."',
    "  exit 1",
    "fi",
    'echo "Đang chạy tại http://localhost:$PORT"',
    "exec node server.js",
    "",
  ].join("\n"),
  "utf8"
);
try {
  chmodSync(shPath, 0o755);
} catch {
  // Windows không có bit thực thi — bỏ qua.
}

console.log("Đã đóng gói vào thư mục dist/");
console.log("Cơ sở dữ liệu: Postgres qua biến DATABASE_URL.");
console.log("");
console.log("Chạy:");
console.log("  Windows:  dist\\chay.cmd");
console.log("  Linux:    ./dist/chay.sh");
console.log("Lấy bản mới sau khi đóng gói lại (tắt bản cũ rồi chạy lại): dist\\chay.cmd moi");
console.log(`Đổi cổng: đặt biến PORT trước khi chạy (mặc định ${CONG}).`);
console.log("");
console.log("Sao lưu hệ thống bằng công cụ/backup của Postgres provider.");
