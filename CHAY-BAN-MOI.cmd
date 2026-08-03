@echo off
setlocal

REM Bam dup file nay de dong goi lai va chay ban moi nhat.
REM Script se nap DATABASE_URL tu .env/.env.local neu Windows chua co bien nay.
cd /d "%~dp0"

if "%DATABASE_URL%"=="" (
  if exist ".env.local" call :load_env ".env.local"
)

if "%DATABASE_URL%"=="" (
  if exist ".env" call :load_env ".env"
)

if "%DATABASE_URL%"=="" (
  echo Chua cau hinh DATABASE_URL Postgres.
  echo Hay tao file .env o cung thu muc voi file nay, vi du:
  echo.
  echo   DATABASE_URL=postgresql://...
  echo.
  pause
  exit /b 1
)

if "%PORT%"=="" set "PORT=3000"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay pnpm. Hay cai Node.js va chay: corepack enable
  pause
  exit /b 1
)

echo Dang tat ban dang chay tren cong %PORT% neu co...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo.
echo Dang dong goi ban moi...
call pnpm run package
set "PACKAGE_CODE=%ERRORLEVEL%"

if not "%PACKAGE_CODE%"=="0" (
  echo.
  echo Dong goi that bai voi ma loi %PACKAGE_CODE%.
  pause
  exit /b %PACKAGE_CODE%
)

if not exist "dist\chay.cmd" (
  echo.
  echo Dong goi xong nhung khong thay dist\chay.cmd.
  pause
  exit /b 1
)

echo.
call "dist\chay.cmd" moi
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Ung dung da dung voi ma loi %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%

:load_env
for /f "usebackq tokens=1,* delims==" %%A in ("%~1") do (
  if /I "%%A"=="DATABASE_URL" set "DATABASE_URL=%%~B"
  if /I "%%A"=="PORT" if "%PORT%"=="" set "PORT=%%~B"
  if /I "%%A"=="HTTPS" if "%HTTPS%"=="" set "HTTPS=%%~B"
)
exit /b 0
