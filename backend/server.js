const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  // Bawaan Node.js v22+
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  try {
    // Fallback jika VPS menggunakan package better-sqlite3
    DatabaseSync = require('better-sqlite3');
  } catch (err) {
    console.error('PENTING: SQLite runtime tidak ditemukan.');
    console.error('Pastikan VPS Anda menggunakan Node.js versi 22.5.0 ke atas, atau jalankan: npm install better-sqlite3');
    process.exit(1);
  }
}

// Baca file .env (KUNCI=nilai per baris) jika ada. Variabel lingkungan yang sudah ada tidak ditimpa.
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  }
} catch (e) { console.warn('File .env tidak bisa dibaca:', e.message); }

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
const DB_FILE = process.env.DB_PATH || path.resolve(__dirname, 'database', 'data.db');
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const STORAGE_DIR = path.resolve(__dirname, '..', 'storage');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const NOTA_MODEL = process.env.NOTA_MODEL || 'claude-sonnet-5-5';

/* ---------- Baca nota otomatis (Claude API) ---------- */
const NOTA_PROMPT = `Anda membaca foto nota, struk, invoice, atau bukti pesanan belanja di Indonesia.
Kembalikan HANYA satu objek JSON tanpa teks lain dan tanpa blok kode, dengan bentuk:
{"toko": string|null, "platform": string|null, "tanggal": "YYYY-MM-DD"|null, "no_pesanan": string|null,
 "items": [{"nama": string, "qty": number, "satuan": string, "harga_satuan": number}],
 "diskon": number, "ongkir": number, "biaya_layanan": number, "total": number|null, "catatan": string|null}
Aturan:
- Semua nominal dalam rupiah sebagai bilangan bulat tanpa pemisah ribuan (Rp83.900 menjadi 83900).
- harga_satuan adalah harga per unit SEBELUM potongan.
- Jumlahkan SEMUA potongan (diskon barang, voucher toko, voucher platform, koin/cashback yang mengurangi pembayaran, potongan ongkir) ke "diskon" sebagai angka positif.
- "ongkir" adalah ongkos kirim sebelum potongan. "biaya_layanan" mencakup biaya layanan, admin, penanganan, jasa aplikasi, asuransi pengiriman.
- "total" adalah jumlah akhir yang dibayar seperti tertulis di nota.
- "platform": Tokopedia, Shopee, Lazada, Blibli, TikTok Shop, atau null untuk toko fisik / tidak jelas.
- "satuan" diisi "pcs" jika tidak tertulis.
- "tanggal" adalah tanggal transaksi/pesanan; ubah ke format YYYY-MM-DD.
- Jangan mengarang. Jika bagian tidak terbaca, isi null dan jelaskan singkat di "catatan".
- Jika total tidak sama dengan perhitungan dan tidak ada baris potongan yang terlihat, biarkan diskon 0 dan sebutkan selisihnya di "catatan".`;

async function bacaNota(image, mediaType) {
  if (!image) throw Object.assign(new Error('Foto nota kosong'), { status: 400 });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: NOTA_MODEL,
      max_tokens: 2000,
      system: NOTA_PROMPT,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
        { type: 'text', text: 'Baca nota ini dan kembalikan JSON sesuai format.' }
      ] }]
    }),
    signal: AbortSignal.timeout(90000)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw Object.assign(new Error('Kunci API Anthropic di server tidak valid. Periksa ANTHROPIC_API_KEY di file .env.'), { status: 502 });
  if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || `Claude API error ${res.status}`), { status: 502 });
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw Object.assign(new Error('Nota tidak terbaca. Coba foto yang lebih jelas.'), { status: 422 });
  try { return JSON.parse(text.slice(a, b + 1)); }
  catch { throw Object.assign(new Error('Hasil bacaan tidak valid. Coba lagi.'), { status: 422 }); }
}

// Inisialisasi Database SQLite otomatis (buat file jika belum ada)
const db = new DatabaseSync(DB_FILE);

// Schema database
db.exec(`
  PRAGMA journal_mode = WAL;
  
  CREATE TABLE IF NOT EXISTS master_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pembelian (
    id TEXT PRIMARY KEY,
    tanggal TEXT,
    toko TEXT,
    platform TEXT,
    noPesanan TEXT,
    peruntukan TEXT,
    diskon REAL DEFAULT 0,
    ongkir REAL DEFAULT 0,
    biaya REAL DEFAULT 0,
    totalNota REAL,
    metode TEXT,
    akun TEXT,
    status TEXT,
    tglProses TEXT,
    tglBayar TEXT,
    keterangan TEXT,
    fotoNota TEXT,
    buktiBayar TEXT,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS pembelian_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pembelian_id TEXT NOT NULL,
    nama TEXT,
    qty REAL DEFAULT 1,
    satuan TEXT,
    harga REAL DEFAULT 0,
    urutan INTEGER DEFAULT 0,
    FOREIGN KEY(pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE
  );
`);

// Default master config
const DEFAULT_MASTER = {
  peruntukan: ['Umum', 'Dapur', 'Operasional', 'G22', 'G23'],
  akun: ['DBS ****4648'],
  platform: ['Tokopedia', 'Shopee', 'Toko offline', 'Lainnya'],
  metode: ['Kartu kredit', 'Transfer bank', 'Tunai', 'Lainnya']
};

const getMasterRow = db.prepare('SELECT value FROM master_config WHERE key = ?');
const setMasterRow = db.prepare('INSERT INTO master_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getMasterData() {
  const row = getMasterRow.get('master');
  if (!row) {
    setMasterRow.run('master', JSON.stringify(DEFAULT_MASTER));
    return DEFAULT_MASTER;
  }
  try {
    return JSON.parse(row.value);
  } catch {
    return DEFAULT_MASTER;
  }
}

function getAllPembelian() {
  const pembelianRows = db.prepare('SELECT * FROM pembelian ORDER BY tanggal DESC, createdAt DESC').all();
  const itemsRows = db.prepare('SELECT * FROM pembelian_items ORDER BY pembelian_id, urutan ASC').all();
  
  const itemsMap = {};
  for (const it of itemsRows) {
    if (!itemsMap[it.pembelian_id]) itemsMap[it.pembelian_id] = [];
    itemsMap[it.pembelian_id].push({
      nama: it.nama || '',
      qty: it.qty,
      satuan: it.satuan || '',
      harga: it.harga
    });
  }

  return pembelianRows.map(p => ({
    ...p,
    items: itemsMap[p.id] || []
  }));
}


// Helper: Simpan image base64 ke disk fisik storage/uploads/ dan kembalikan URL path
function saveBase64Image(dataUrl, prefix = 'nota') {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  // Jika sudah berupa path URL storage (/storage/...) atau bukan base64, biarkan apa adanya
  if (dataUrl.startsWith('/storage/') || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  try {
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return dataUrl;

    const ext = matches[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const uploadsDir = path.join(STORAGE_DIR, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/storage/uploads/${fileName}`;
  } catch (err) {
    console.error('Gagal menyimpan file image ke storage:', err);
    return dataUrl; // fallback simpan base64 jika gagal tulis file
  }
}

function savePembelianRecord(p) {
  const savedFotoNota = saveBase64Image(p.fotoNota, 'nota');
  const savedBuktiBayar = saveBase64Image(p.buktiBayar, 'bukti');
  const insertPembelian = db.prepare(`
    INSERT INTO pembelian (
      id, tanggal, toko, platform, noPesanan, peruntukan, diskon, ongkir, biaya, totalNota,
      metode, akun, status, tglProses, tglBayar, keterangan, fotoNota, buktiBayar, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      tanggal=excluded.tanggal,
      toko=excluded.toko,
      platform=excluded.platform,
      noPesanan=excluded.noPesanan,
      peruntukan=excluded.peruntukan,
      diskon=excluded.diskon,
      ongkir=excluded.ongkir,
      biaya=excluded.biaya,
      totalNota=excluded.totalNota,
      metode=excluded.metode,
      akun=excluded.akun,
      status=excluded.status,
      tglProses=excluded.tglProses,
      tglBayar=excluded.tglBayar,
      keterangan=excluded.keterangan,
      fotoNota=excluded.fotoNota,
      buktiBayar=excluded.buktiBayar,
      createdAt=excluded.createdAt
  `);

  insertPembelian.run(
    p.id,
    p.tanggal || '',
    p.toko || '',
    p.platform || '',
    p.noPesanan || '',
    p.peruntukan || '',
    p.diskon === '' || p.diskon == null ? 0 : Number(p.diskon),
    p.ongkir === '' || p.ongkir == null ? 0 : Number(p.ongkir),
    p.biaya === '' || p.biaya == null ? 0 : Number(p.biaya),
    p.totalNota === '' || p.totalNota == null ? null : Number(p.totalNota),
    p.metode || '',
    p.akun || '',
    p.status || 'belum',
    p.tglProses || '',
    p.tglBayar || '',
    p.keterangan || '',
    savedFotoNota || '',
    savedBuktiBayar || '',
    p.createdAt || Date.now()
  );

  // Replace items
  db.prepare('DELETE FROM pembelian_items WHERE pembelian_id = ?').run(p.id);
  const insertItem = db.prepare(`
    INSERT INTO pembelian_items (pembelian_id, nama, qty, satuan, harga, urutan)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  if (Array.isArray(p.items)) {
    p.items.forEach((it, idx) => {
      insertItem.run(
        p.id,
        it.nama || '',
        it.qty === '' || it.qty == null ? 1 : Number(it.qty),
        it.satuan || '',
        it.harga === '' || it.harga == null ? 0 : Number(it.harga),
        idx
      );
    });
  }
  return { fotoNota: savedFotoNota, buktiBayar: savedBuktiBayar };
}

function deletePembelianRecord(id) {
  db.prepare('DELETE FROM pembelian_items WHERE pembelian_id = ?').run(id);
  db.prepare('DELETE FROM pembelian WHERE id = ?').run(id);
}

// MIME types untuk static server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // JSON helper
  const sendJSON = (data, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  const getBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // limit 50MB (karena ada base64 foto)
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });

  // REST API Routes
  if (pathname === '/api/pembelian' && req.method === 'GET') {
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const status = (url.searchParams.get('status') || '').trim();
    const peruntukan = (url.searchParams.get('peruntukan') || '').trim();
    const bulan = (url.searchParams.get('bulan') || '').trim();

    const all = getAllPembelian();
    const filtered = all.filter(p => {
      if (status && p.status !== status) return false;
      if (peruntukan && p.peruntukan !== peruntukan) return false;
      if (bulan && (!p.tanggal || !p.tanggal.startsWith(bulan))) return false;
      if (search) {
        const matchToko = (p.toko || '').toLowerCase().includes(search);
        const matchNo = (p.noPesanan || '').toLowerCase().includes(search);
        const matchKet = (p.keterangan || '').toLowerCase().includes(search);
        const matchBarang = (p.items || []).some(it => (it.nama || '').toLowerCase().includes(search));
        if (!matchToko && !matchNo && !matchKet && !matchBarang) return false;
      }
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    // Hitung stats
    const stats = {
      belum: { count: 0, total: 0 },
      diproses: { count: 0, total: 0 },
      dibayar: { count: 0, total: 0 }
    };
    for (const p of all) {
      const st = p.status || 'belum';
      const tot = p.totalNota != null ? Number(p.totalNota) : ((p.items || []).reduce((acc, it) => acc + (Number(it.qty || 1) * Number(it.harga || 0)), 0) - Number(p.diskon || 0) + Number(p.ongkir || 0) + Number(p.biaya || 0));
      if (stats[st]) {
        stats[st].count++;
        stats[st].total += tot;
      }
    }

    return sendJSON({
      data: paged,
      pagination: { page, limit, total, totalPages },
      stats,
      isServer: true
    });
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJSON({
      pembelian: getAllPembelian(),
      master: getMasterData(),
      ai_config: (() => { try { const r = getMasterRow.get('ai_config'); return r ? JSON.parse(r.value) : null; } catch(e){ return null; } })(),
      mig: 2,
      sqlite: true,
      ai: !!ANTHROPIC_API_KEY
    });
  }

  if (pathname === '/api/pembelian' && req.method === 'POST') {
    getBody().then(record => {
      const saved = savePembelianRecord(record);
      sendJSON({ success: true, id: record.id, fotoNota: saved.fotoNota, buktiBayar: saved.buktiBayar });
    }).catch(err => sendJSON({ error: err.message }, 400));
    return;
  }

  if (pathname === '/api/baca-nota' && req.method === 'POST') {
    if (!ANTHROPIC_API_KEY) return sendJSON({ error: 'Server belum diberi ANTHROPIC_API_KEY' }, 503);
    getBody()
      .then(b => bacaNota(b.image, b.media_type))
      .then(r => sendJSON(r))
      .catch(err => sendJSON({ error: err.name === 'TimeoutError' ? 'Pembacaan nota terlalu lama. Coba lagi.' : err.message }, err.status || 502));
    return;
  }

  if (pathname.startsWith('/api/pembelian/') && req.method === 'DELETE') {
    const id = decodeURIComponent(pathname.replace('/api/pembelian/', ''));
    deletePembelianRecord(id);
    return sendJSON({ success: true });
  }

  if (pathname === '/api/ai-config' && req.method === 'POST') {
    getBody().then(cfg => {
      setMasterRow.run('ai_config', JSON.stringify(cfg));
      sendJSON({ success: true });
    }).catch(err => sendJSON({ error: err.message }, 400));
    return;
  }

  if (pathname === '/api/master' && req.method === 'POST') {
    getBody().then(masterData => {
      setMasterRow.run('master', JSON.stringify(masterData));
      sendJSON({ success: true, master: masterData });
    }).catch(err => sendJSON({ error: err.message }, 400));
    return;
  }

  if (pathname === '/api/sync-all' && req.method === 'POST') {
    // Digunakan saat restore / migrasi penuh dari localStorage ke SQLite
    getBody().then(data => {
      if (data.master) setMasterRow.run('master', JSON.stringify(data.master));
      if (Array.isArray(data.pembelian)) {
        db.exec('DELETE FROM pembelian_items; DELETE FROM pembelian;');
        for (const p of data.pembelian) {
          savePembelianRecord(p);
        }
      }
      sendJSON({ success: true, count: (data.pembelian || []).length });
    }).catch(err => sendJSON({ error: err.message }, 400));
    return;
  }

  // Static File Serving
  // Layani file storage gambar
  if (pathname.startsWith('/storage/')) {
    const rel = pathname.replace(/^\/storage\//, '');
    const sPath = path.join(STORAGE_DIR, rel);
    if (fs.existsSync(sPath) && !fs.statSync(sPath).isDirectory()) {
      const ext = path.extname(sPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(sPath).pipe(res);
    }
    res.writeHead(404); return res.end('Not found');
  }

  // Lindungi file sensitif
  if (/(^|\/)\.|\.(db|db-wal|db-shm|sqlite|php|sh|md|yml|yaml|bat)$/i.test(pathname)) {
    res.writeHead(404); return res.end('Not found');
  }

  // Layani hasil build dist/
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading dist. Pastikan frontend sudah di-build.');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server Rekap Pembelian berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`File database: ${DB_FILE}`);
});
