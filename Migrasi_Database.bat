@echo off
setlocal
chcp 65001 >nul
title Migrasi Database Rekap Pembelian

echo =================================================================
echo   ALAT MIGRASI STRUKTUR DATABASE ^& STORAGE - REKAP PEMBELIAN
echo =================================================================
echo.
echo Script ini akan:
echo 1. Memindai tabel dan kolom database lama.
echo 2. Menambahkan kolom atau membuat tabel baru yang belum ada.
echo 3. Memindahkan gambar Base64 lama ke folder storage/uploads/.
echo.

set "NODE_CMD="

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
  set "NODE_CMD=node"
  goto :run_migrate
)

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
  goto :run_migrate
)

if exist "C:\laragon\bin\nodejs\node.exe" (
  set "NODE_CMD=C:\laragon\bin\nodejs\node.exe"
  goto :run_migrate
)

where php >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo Menjalankan migrasi via PHP...
  php backend/migrate.php
  goto :done
)

echo [PERINGATAN] Node.js atau PHP tidak ditemukan di PATH.
pause
exit /b 1

:run_migrate
echo Menjalankan migrasi database...
"%NODE_CMD%" backend/migrate.js %*

:done
echo.
echo Tekan tombol apa saja untuk keluar...
pause >nul
