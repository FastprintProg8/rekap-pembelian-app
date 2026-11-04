#!/bin/bash
# Script Deploy Otomatis Rekap Pembelian untuk VPS Ubuntu/Debian

set -e

echo "=========================================="
echo "  Deploy Aplikasi Rekap Pembelian (SQLite)"
echo "=========================================="

# 1. Update package list & install Node.js 22 LTS jika belum ada
if ! command -v node &> /dev/null; then
    echo "[1/4] Menginstall Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[1/4] Node.js sudah terpasang: $(node -v)"
fi

# 2. Install PM2 process manager
if ! command -v pm2 &> /dev/null; then
    echo "[2/4] Menginstall PM2..."
    sudo npm install -g pm2
else
    echo "[2/4] PM2 sudah terpasang: $(pm2 -v)"
fi

# 3. Jalankan aplikasi dengan PM2
echo "[3/4] Menjalankan server aplikasi..."
pm2 delete rekap-pembelian 2>/dev/null || true
pm2 start server.js --name "rekap-pembelian"
pm2 save
pm2 startup | tail -n 1 | bash 2>/dev/null || true

# 4. Ambil IP Publik VPS
IP_PUB=$(curl -s ifconfig.me || echo "IP_VPS_ANDA")

echo "=========================================="
echo "  DEPLOY SELESAI & BERHASIL!"
echo "=========================================="
echo "Aplikasi Anda sudah aktif dan berjalan di background!"
echo "Akses melalui browser di:"
echo "http://$IP_PUB:3000"
echo "=========================================="
