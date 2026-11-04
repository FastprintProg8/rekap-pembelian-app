# PANDUAN DEPLOY KE VPS

Aplikasi ini sudah dirancang **Full Zero-Configuration SQLite**:
- Tidak perlu install database engine terpisah (seperti MySQL/PostgreSQL).
- File database `data.db` beserta semua tabel langsung terbuat otomatis jika belum ada.
- Tidak butuh Docker. Bisa dijalankan menggunakan **PHP biasa (Apache/Nginx/cPanel)** maupun **Node.js**.

---

## CARA 1: Pakai Web Server PHP Biasa (Apache / Nginx / cPanel / aaPanel / CyberPanel)
*Paling mudah jika VPS Anda sudah terpasang LAMP/LEMP stack atau panel hosting seperti cPanel.*

1. **Upload semua file dalam folder ini** ke direktori web Anda (misalnya ke `public_html/` atau `/var/www/html/`).
2. **Selesai!**
   - File [`.htaccess`](file:///c:/Users/PC Programmer/Downloads/Telegram Desktop/rekap-pembelian-app/.htaccess) dan [`api.php`](file:///c:/Users/PC Programmer/Downloads/Telegram Desktop/rekap-pembelian-app/api.php) sudah disediakan.
   - Semua request otomatis ditangani oleh PHP & SQLite.
   - File database `data.db` akan langsung otomatis dibuat saat web diakses.

*(Catatan untuk Nginx jika tidak pakai Apache): Cukup tambahkan baris berikut di server block Nginx:*
```nginx
location /api/ {
    try_files $uri /api.php?$query_string;
}

# Lindungi database dan file konfigurasi
location ~ (^|/)\.|\.(db|db-wal|db-shm|sqlite|sh|md|yml)$ {
    deny all;
}
```

---

## CARA 2: Pakai Node.js Biasa (PM2) - Tanpa Docker

1. **Upload folder ini ke VPS** (misal ke `/var/www/rekap-pembelian`).
2. Masuk ke terminal VPS, lalu jalankan script deploy otomatis 1-klik:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
   Atau jika ingin manual:
   ```bash
   # Jalankan di background via PM2 agar aplikasi tidak mati saat terminal ditutup
   npm install -g pm2
   pm2 start server.js --name "rekap-pembelian"
   pm2 save
   pm2 startup
   ```
3. Akses via browser di: `http://IP_VPS_ANDA:3000`.

---

## CARA 3: Pakai Docker (Opsional)
Jika di VPS Anda ada Docker:
```bash
docker compose up -d --build
```


---

## Opsi Nginx Reverse Proxy (Opsional untuk Domain/HTTPS)

Jika ingin diakses lewat domain (misal: `rekap.domainanda.com`), pasang konfigurasi Nginx:

```nginx
server {
    server_name rekap.domainanda.com;

    client_max_body_size 50M; # Agar muat upload foto nota

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Lalu pasang SSL gratis via Certbot:
```bash
sudo certbot --nginx -d rekap.domainanda.com
```
