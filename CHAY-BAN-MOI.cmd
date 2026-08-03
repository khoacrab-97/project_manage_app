@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  Bam dup file nay de BUILD ban moi nhat roi CHAY app.
REM  - Dung pnpm theo packageManager cua project.
REM  - Neu may chua co pnpm, script se thu bat Corepack va cai pnpm dung version.
REM  - Tu chay Prisma migration truoc khi start app.
REM  - Chay bang "next start": KHONG dong goi standalone (ban standalone
REM    khong tuong thich voi node_modules kieu pnpm -> hay bao dong goi that bai).
REM  - DATABASE_URL: Next tu doc tu file .env, KHONG can dat tay.
REM ============================================================
cd /d "%~dp0"

set "PNPM_VERSION=11.18.0"
if "%PORT%"=="" set "PORT=3000"
set "NODE_ENV=production"

where node >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay Node.js. Hay cai Node.js 22 LTS roi chay lai file nay.
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo Khong tim thay pnpm/corepack.
    echo Hay cai Node.js 22 LTS, mo terminal moi, roi chay lai file nay.
    pause
    exit /b 1
  )

  echo Khong tim thay pnpm. Dang bat Corepack va cai pnpm %PNPM_VERSION%...
  call corepack enable
  if errorlevel 1 (
    echo Khong bat duoc Corepack. Hay mo Command Prompt bang Run as administrator roi chay:
    echo   corepack enable
    echo   corepack prepare pnpm@%PNPM_VERSION% --activate
    pause
    exit /b 1
  )

  call corepack prepare pnpm@%PNPM_VERSION% --activate
  if errorlevel 1 (
    echo Khong cai duoc pnpm %PNPM_VERSION% qua Corepack.
    pause
    exit /b 1
  )
)

for /f "tokens=*" %%v in ('pnpm --version') do set "PNPM_CURRENT=%%v"
if not "!PNPM_CURRENT!"=="%PNPM_VERSION%" (
  where corepack >nul 2>&1
  if not errorlevel 1 (
    echo Dang chuyen pnpm ve dung version %PNPM_VERSION%...
    call corepack prepare pnpm@%PNPM_VERSION% --activate
    if errorlevel 1 (
      echo Khong chuyen duoc pnpm ve version %PNPM_VERSION%.
      pause
      exit /b 1
    )
  )
)

if not exist ".env" (
  echo Khong thay file .env ^(chua co DATABASE_URL Postgres^).
  echo Hay tao .env o cung thu muc, vi du:  DATABASE_URL=postgresql://...
  pause
  exit /b 1
)

echo.
echo Dang cai/kiem tra dependency bang pnpm...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo.
  echo Cai dependency that bai. Neu vua pull code moi, kiem tra lai pnpm-lock.yaml.
  pause
  exit /b 1
)

echo.
echo Dang cap nhat schema database ^(Prisma migrate deploy^)...
call pnpm run db:deploy
if errorlevel 1 (
  echo.
  echo Cap nhat schema database that bai. Kiem tra DATABASE_URL trong .env.
  pause
  exit /b 1
)

echo Dang tat ban dang chay tren cong %PORT% neu co...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo.
echo Dang build ban moi ^(co the mat 1-2 phut^)...
call pnpm run build
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

call pnpm exec next start -H "::" -p %PORT%

echo.
echo Ung dung da dung.
pause
exit /b 0
