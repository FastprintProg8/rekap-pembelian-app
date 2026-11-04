# Rekap Pembelian — Panduan Pemasangan

## Isi folder
- `server.js` — server lokal Node.js + database SQLite
- `data.db` — file database SQLite (dibuat otomatis)
- `jalankan.bat` — pintasan untuk langsung menjalankan server dan membuka aplikasi di browser
- `index.html` — aplikasi
- `manifest.webmanifest` — identitas aplikasi (nama, ikon, warna)
- `sw.js` — agar aplikasi bisa dipasang dan tetap terbuka saat offline
- `icons/` — ikon aplikasi

## Menjalankan dengan Database SQLite
1. Klik 2x file `jalankan.bat` (atau jalankan `npm start` / `node server.js` di terminal).
2. Browser akan terbuka otomatis di alamat `http://localhost:3000`.
3. Semua pembelian, item barang, foto nota, dan data master akan langsung tersimpan di file database **`data.db` (SQLite)**.
4. Anda bisa membuka file `data.db` menggunakan aplikasi SQLite browser (seperti *DB Browser for SQLite* atau ekstensi VS Code).

## 1. Online-kan lewat GitHub Pages (gratis)
1. Buat repository baru di GitHub, misalnya `rekap-pembelian` (boleh Public).
2. Klik **Add file → Upload files**, unggah semua isi folder ini (termasuk folder `icons`), lalu **Commit changes**.
3. Buka **Settings → Pages**. Pada *Source*, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1–2 menit. Alamat aplikasi: `https://<username>.github.io/rekap-pembelian/`

Aplikasi harus dibuka lewat alamat https agar bisa dipasang. Membuka file `index.html` langsung dari komputer tetap bisa dipakai, tetapi tidak bisa dipasang.

## 2. Pasang di Android
1. Buka alamat aplikasi di **Google Chrome**.
2. Ketuk tombol **Pasang** di bagian atas aplikasi, atau menu **⋮ → Tambahkan ke layar utama / Instal aplikasi**.
3. Ikon Rekap Pembelian muncul di layar utama dan terbuka layar penuh seperti aplikasi biasa.
4. Saat mengunggah nota, pilih **Kamera** untuk memotret langsung.

## 3. Pasang di PC (Chrome / Edge)
Buka alamat aplikasi, lalu klik tombol **Pasang** di aplikasi atau ikon pasang di ujung kanan kolom alamat. Aplikasi akan muncul di Start Menu dan bisa dibuka dari taskbar.

## 4. Memperbarui aplikasi
1. Ganti `index.html` di GitHub dengan versi baru.
2. Di `sw.js`, naikkan versi cache, misalnya `rekap-pembelian-v1` menjadi `rekap-pembelian-v2`.
3. Pengguna cukup menutup dan membuka kembali aplikasi saat online.

## 5. Penting tentang data
- Data tersimpan **di perangkat masing-masing**. Data di PC tidak otomatis muncul di HP.
- Untuk memindahkan data: menu **⋯ → Cadangkan data** di perangkat lama, lalu **Pulihkan data** di perangkat baru.
- Buat cadangan secara rutin (misalnya setiap minggu). Menghapus data browser atau uninstall aplikasi akan menghapus data di perangkat itu.
- Sinkronisasi otomatis antar perangkat dan antar pengguna membutuhkan tahap berikutnya: menghubungkan aplikasi ke Supabase.


## 6. Baca nota otomatis
Setelah foto nota diunggah, aplikasi mengisi sendiri **nama toko, tanggal, no. pesanan, barang, qty, harga satuan, diskon/voucher, ongkir, biaya layanan, dan total**. Anda tinggal mengisi **peruntukan, metode bayar, dan sumber dana**, memeriksa hasilnya, lalu menyimpan.

Pembacaan memakai Claude API dari Anthropic: butuh internet dan **kunci API berbayar** (buat di https://console.anthropic.com, lalu isi saldo). Biaya dihitung per nota yang dibaca; cek tarif terbaru di halaman harga Anthropic.

### Mengaktifkan di server (disarankan)
Kunci API disimpan di server, tidak pernah dikirim ke HP atau PC pengguna.
1. Di folder aplikasi di server, salin `.env.example` menjadi `.env`.
2. Buka `.env`, isi `ANTHROPIC_API_KEY=sk-ant-...` dengan kunci Anda, simpan.
3. Restart server:
   - Node.js/PM2: `pm2 restart rekap-pembelian`
   - Docker: `docker compose up -d` (file `.env` dibaca otomatis)
   - PHP (Apache/cPanel): tidak perlu restart.
4. Buka aplikasi, menu **⋯ → Baca nota otomatis**. Jika muncul "Server siap membaca nota", fitur sudah aktif untuk semua pengguna.

Untuk PHP, pastikan ekstensi **cURL** aktif (di cPanel: Select PHP Version → centang curl).

### Cara lain: kunci API langsung di perangkat
Jika aplikasi dibuka tanpa server, pilih **Kunci API langsung di perangkat ini** di menu ⋯ lalu tempel kunci API. Kunci hanya tersimpan di perangkat itu dan tidak ikut ke file cadangan. Gunakan hanya di perangkat pribadi.

### Tips hasil terbaik
- Screenshot pesanan Tokopedia/Shopee biasanya terbaca paling akurat.
- Untuk nota kertas, foto lurus dari atas dengan cahaya terang, seluruh nota masuk bingkai.
- Selalu cek peringatan "Total di nota berbeda" sebelum menyimpan.
