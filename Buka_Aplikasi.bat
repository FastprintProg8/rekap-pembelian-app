@echo off
title Rekap Pembelian (Server LAN Aktif)
color 0A
cd /d "%~dp0"

echo ========================================================
echo        MENYALAKAN SERVER REKAP PEMBELIAN (LAN)
echo ========================================================
echo.

:: 1. Cek node.exe bawaan di folder aplikasi (Portable)
if exist "%~dp0node_bin\node.exe" (
    set "NODE_CMD=%~dp0node_bin\node.exe"
    goto :jalankan
)
if exist "%~dp0node.exe" (
    set "NODE_CMD=%~dp0node.exe"
    goto :jalankan
)

:: 2. Cek di PATH sistem
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
    goto :jalankan
)

:: 3. Cek instalasi umum
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    goto :jalankan
)

echo [PERINGATAN] Node.js tidak ditemukan di komputer.
pause
exit

:jalankan
:: Auto build jika dist belum ada
if not exist "%~dp0dist\index.html" (
    echo Menyiapkan tampilan aplikasi...
    cd /d "%~dp0frontend"
    call "%NODE_CMD%" "%~dp0frontend\node_modules\vite\bin\vite.js" build
    cd /d "%~dp0"
)

echo [OK] Menjalankan server database dan LAN...
echo.
start "" "http://localhost:3000"
"%NODE_CMD%" "%~dp0backend\server.js"
pause
