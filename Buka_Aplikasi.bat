@echo off
title Rekap Pembelian (Server LAN Aktif)
color 0A
cd /d "%~dp0"

echo ========================================================
echo        MENYALAKAN SERVER REKAP PEMBELIAN (LAN)
echo ========================================================
echo.

:: 1. Cek node.exe bawaan di folder aplikasi (Portable)
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

:: Fallback jika benar-benar tidak ada
start "" "%~dp0index.html"
exit

:jalankan
echo [OK] Menjalankan server database dan LAN...
echo.
start "" "http://localhost:3000"
"%NODE_CMD%" "%~dp0server.js"
pause
