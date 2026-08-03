@echo off
setlocal

REM ============================================================
REM  Bam dup file nay de BUILD ban moi nhat roi CHAY app.
REM  - Dung npm (co san cung Node): KHONG can pnpm / corepack / Admin.
REM  - Chay bang "next start": KHONG dong goi standalone (ban standalone
REM    khong tuong thich voi node_modules kieu pnpm -> hay bao dong goi that bai).
REM  - DATABASE_URL: Next tu doc tu file .env, KHONG can dat tay.
REM ============================================================
cd /d "%~dp0"

if "%PORT%"=="" set "PORT=3000"
set "NODE_ENV=production"

where npm >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay npm. Hay cai Node.js roi thu lai.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Khong thay file .env ^(chua co DATABASE_URL Postgres^).
  echo Hay tao .env o cung thu muc, vi du:  DATABASE_URL=postgresql://...
  pause
  exit /b 1
)

echo Dang tat ban dang chay tren cong %PORT% neu co...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo.
echo Dang build ban moi ^(co the mat 1-2 phut^)...
call npm run build
if errorlevel 1 (
  echo.
  echo Build that bai. Xem thong bao loi o tren.
  pause
  exit /b 1
)

echo.
echo Dang chay tai http://localhost:%PORT%
echo DONG CUA SO NAY LA TAT APP.
start "" /min powershell -NoProfile -Command "Start-Sleep 6; Start-Process 'http://localhost:%PORT%'"

call npx next start -H "::" -p %PORT%

echo.
echo Ung dung da dung.
pause
exit /b 0
