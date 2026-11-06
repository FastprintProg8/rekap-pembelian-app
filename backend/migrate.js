/**
 * Script Migrasi Database Rekap Pembelian (SQLite)
 * 
 * Fitur:
 * 1. Pindai (scan) tabel master_config, pembelian, pembelian_items
 * 2. Jika tabel belum ada -> Otomatis dibuatkan (CREATE TABLE IF NOT EXISTS)
 * 3. Jika kolom/field belum ada -> Otomatis ditambahkan (ALTER TABLE ... ADD COLUMN ...)
 * 4. Pindai data foto nota & bukti bayar lama yang masih berupa base64:
 *    - Otomatis diekstrak menjadi file fisik di folder storage/uploads/
 *    - Path field di database diperbarui menjadi /storage/uploads/...
 * 
 * Penggunaan:
 * node backend/migrate.js [path/ke/database.db]
 */

const fs = require('fs');
const path = require('path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  try {
    DatabaseSync = require('better-sqlite3');
  } catch (err) {
    console.error('ERROR: Modul SQLite tidak ditemukan.');
    console.error('Gunakan Node.js v22.5.0+ atau install better-sqlite3');
    process.exit(1);
  }
}

// Target database (default: backend/database/data.db)
const defaultDbPath = path.resolve(__dirname, 'database', 'data.db');
const targetDbPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultDbPath;
const storageUploadsDir = path.resolve(__dirname, '..', 'storage', 'uploads');

console.log('='.repeat(65));
console.log('  ALAT MIGRASI DATABASE & STORAGE - REKAP PEMBELIAN');
console.log('='.repeat(65));
console.log(`Database Target : ${targetDbPath}`);
console.log(`Storage Uploads : ${storageUploadsDir}`);
console.log('-'.repeat(65));

// Pastikan folder database dan storage/uploads tersedia
const dbDir = path.dirname(targetDbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(storageUploadsDir)) fs.mkdirSync(storageUploadsDir, { recursive: true });

const db = new DatabaseSync(targetDbPath);
db.exec('PRAGMA journal_mode = WAL;');

// Skema yang diharapkan
const EXPECTED_SCHEMA = {
  master_config: {
    columns: {
      key: 'TEXT PRIMARY KEY',
      value: 'TEXT NOT NULL'
    },
    primaryKey: ['key']
  },
  pembelian: {
    columns: {
      id: 'TEXT PRIMARY KEY',
      tanggal: 'TEXT',
      toko: 'TEXT',
      platform: 'TEXT',
      noPesanan: 'TEXT',
      peruntukan: 'TEXT',
      diskon: 'REAL DEFAULT 0',
      ongkir: 'REAL DEFAULT 0',
      biaya: 'REAL DEFAULT 0',
      totalNota: 'REAL',
      metode: 'TEXT',
      akun: 'TEXT',
      status: 'TEXT DEFAULT "belum"',
      tglProses: 'TEXT',
      tglBayar: 'TEXT',
      keterangan: 'TEXT',
      fotoNota: 'TEXT',
      buktiBayar: 'TEXT',
      createdAt: 'INTEGER'
    },
    primaryKey: ['id']
  },
  pembelian_items: {
    columns: {
      id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      pembelian_id: 'TEXT NOT NULL',
      nama: 'TEXT',
      qty: 'REAL DEFAULT 1',
      satuan: 'TEXT',
      harga: 'REAL DEFAULT 0',
      urutan: 'INTEGER DEFAULT 0'
    },
    primaryKey: ['id']
  }
};

// Ambil daftar tabel yang ada di database target
const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
console.log(`[SCAN] Tabel ditemukan saat ini: ${existingTables.join(', ') || '(belum ada)'}`);

for (const [tableName, tableDef] of Object.entries(EXPECTED_SCHEMA)) {
  if (!existingTables.includes(tableName)) {
    console.log(`\n[CREATE] Tabel '${tableName}' belum ada. Membuat tabel...`);
    
    const colDefs = Object.entries(tableDef.columns).map(([colName, colType]) => `${colName} ${colType}`);
    if (tableName === 'pembelian_items') {
      colDefs.push('FOREIGN KEY(pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE');
    }
    const createSql = `CREATE TABLE ${tableName} (\n  ${colDefs.join(',\n  ')}\n);`;
    db.exec(createSql);
    console.log(`✓ Tabel '${tableName}' berhasil dibuat.`);
  } else {
    // Tabel sudah ada, sekarang scan field/kolom
    console.log(`\n[SCAN] Memeriksa struktur kolom tabel '${tableName}'...`);
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const existingCols = tableInfo.map(c => c.name.toLowerCase());
    
    for (const [colName, colDef] of Object.entries(tableDef.columns)) {
      if (!existingCols.includes(colName.toLowerCase())) {
        console.log(`  + [ALTER] Kolom '${colName}' belum ada di '${tableName}'. Menambahkan kolom...`);
        // SQLite ADD COLUMN tidak boleh menyertakan PRIMARY KEY atau AUTOINCREMENT
        let addColDef = colDef.replace(/PRIMARY\s+KEY/i, '').replace(/AUTOINCREMENT/i, '').trim();
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${addColDef};`);
        console.log(`  ✓ Berhasil menambahkan kolom '${colName}'.`);
      }
    }
    console.log(`✓ Struktur kolom tabel '${tableName}' sudah lengkap & mutakhir.`);
  }
}

// Inisialisasi default master_config jika kosong
const masterKeys = db.prepare('SELECT key FROM master_config').all().map(r => r.key);
const defaults = {
  master: JSON.stringify({
    peruntukan: ['G22', 'G23'],
    akun: ['DBS ****4648', 'BCA Operasional', 'Kas Kecil'],
    platform: ['Tokopedia', 'Shopee', 'Toko offline', 'Lainnya'],
    metode: ['Transfer bank', 'Kartu kredit', 'QRIS / E-Wallet', 'Tunai']
  }),
  ai_config: JSON.stringify({ apiKey: '' })
};

for (const [key, val] of Object.entries(defaults)) {
  if (!masterKeys.includes(key)) {
    db.prepare('INSERT INTO master_config (key, value) VALUES (?, ?)').run(key, val);
    console.log(`[CONFIG] Konfigurasi default '${key}' disiapkan.`);
  }
}

// Migrasi Gambar Base64 Lama ke File Fisik Storage
console.log('\n[SCAN] Memindai gambar lama berformat Base64 di database...');

function convertBase64ToFile(dataUrl, prefix = 'nota') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:image/')) return null;

  try {
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return null;

    const ext = matches[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const filePath = path.join(storageUploadsDir, fileName);

    fs.writeFileSync(filePath, buffer);
    return `/storage/uploads/${fileName}`;
  } catch (err) {
    console.error(`  x Gagal mengekstrak gambar base64 (${prefix}):`, err.message);
    return null;
  }
}

const allRows = db.prepare('SELECT id, fotoNota, buktiBayar FROM pembelian').all();
let migratedFotoCount = 0;
let migratedBuktiCount = 0;

const updateStmt = db.prepare('UPDATE pembelian SET fotoNota = ?, buktiBayar = ? WHERE id = ?');

for (const row of allRows) {
  let newFoto = row.fotoNota;
  let newBukti = row.buktiBayar;
  let changed = false;

  if (row.fotoNota && row.fotoNota.startsWith('data:image/')) {
    const savedPath = convertBase64ToFile(row.fotoNota, 'nota');
    if (savedPath) {
      newFoto = savedPath;
      migratedFotoCount++;
      changed = true;
    }
  }

  if (row.buktiBayar && row.buktiBayar.startsWith('data:image/')) {
    const savedPath = convertBase64ToFile(row.buktiBayar, 'bukti');
    if (savedPath) {
      newBukti = savedPath;
      migratedBuktiCount++;
      changed = true;
    }
  }

  if (changed) {
    updateStmt.run(newFoto, newBukti, row.id);
  }
}

console.log(`✓ Selesai memindai data gambar:`);
console.log(`  - ${migratedFotoCount} Foto Nota Base64 dipindahkan ke file fisik storage.`);
console.log(`  - ${migratedBuktiCount} Bukti Bayar Base64 dipindahkan ke file fisik storage.`);

console.log('\n' + '='.repeat(65));
console.log('MIGRASI DATABASE BERHASIL SELESAI DENGAN SEMPURNA!');
console.log('='.repeat(65));
