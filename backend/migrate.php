<?php
/**
 * Script Migrasi Database Rekap Pembelian (PHP: MySQL & SQLite)
 * 
 * Fitur:
 * 1. Pindai (scan) tabel master_config, pembelian, pembelian_items
 * 2. Jika tabel belum ada -> Otomatis dibuatkan (CREATE TABLE IF NOT EXISTS)
 * 3. Jika kolom/field belum ada -> Otomatis ditambahkan (ALTER TABLE ... ADD COLUMN ...)
 * 4. Pindai gambar Base64 lama di database:
 *    - Otomatis diekstrak menjadi file gambar fisik di folder storage/uploads/
 *    - Field database diperbarui menjadi URL path (/storage/uploads/...)
 * 
 * Penggunaan CLI:
 * php backend/migrate.php
 */

header('Content-Type: text/plain; charset=utf-8');

function envVal($name, $default = '') {
    static $env = null;
    if ($env === null) {
        $env = [];
        $f = dirname(__DIR__) . '/.env';
        if (!is_readable($f)) $f = __DIR__ . '/.env';
        if (is_readable($f)) {
            foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if (preg_match('/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/', $line, $m) && strpos(ltrim($line), '#') !== 0) {
                    $env[$m[1]] = preg_replace('/^([\'"])(.*)\1$/', '$2', $m[2]);
                }
            }
        }
    }
    $v = getenv($name);
    return ($v !== false && $v !== '') ? $v : (isset($env[$name]) ? $env[$name] : $default);
}

$driver = strtolower(envVal('DB_DRIVER', 'sqlite'));
$storageDir = dirname(__DIR__) . '/storage/uploads';
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0777, true);
}

echo str_repeat("=", 65) . "\n";
echo "  ALAT MIGRASI DATABASE & STORAGE (PHP) - REKAP PEMBELIAN\n";
echo str_repeat("=", 65) . "\n";
echo "Database Driver : " . strtoupper($driver) . "\n";
echo "Storage Uploads : " . $storageDir . "\n";
echo str_repeat("-", 65) . "\n";

try {
    if ($driver === 'mysql') {
        $host = envVal('DB_HOST', '127.0.0.1');
        $port = envVal('DB_PORT', '3306');
        $dbName = envVal('DB_NAME', 'rekap_pembelian');
        $user = envVal('DB_USER', 'root');
        $pass = envVal('DB_PASS', '');

        $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        echo "Terkoneksi ke MySQL database: {$dbName}\n";
    } else {
        $dbFile = dirname(__DIR__) . '/backend/database/data.db';
        if (!is_dir(dirname($dbFile))) @mkdir(dirname($dbFile), 0777, true);
        $pdo = new PDO("sqlite:{$dbFile}", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        $pdo->exec("PRAGMA journal_mode = WAL;");
        echo "Terkoneksi ke SQLite database: {$dbFile}\n";
    }
} catch (Exception $e) {
    die("Koneksi database gagal: " . $e->getMessage() . "\n");
}

// 1. Skema Definisi Kolom
$schema = [
    'master_config' => [
        'key' => $driver === 'mysql' ? 'VARCHAR(100) NOT NULL PRIMARY KEY' : 'TEXT PRIMARY KEY',
        'value' => $driver === 'mysql' ? 'LONGTEXT NOT NULL' : 'TEXT NOT NULL'
    ],
    'pembelian' => [
        'id' => $driver === 'mysql' ? 'VARCHAR(50) NOT NULL PRIMARY KEY' : 'TEXT PRIMARY KEY',
        'tanggal' => $driver === 'mysql' ? 'VARCHAR(50) NULL' : 'TEXT',
        'toko' => $driver === 'mysql' ? 'VARCHAR(255) NULL' : 'TEXT',
        'platform' => $driver === 'mysql' ? 'VARCHAR(100) NULL' : 'TEXT',
        'noPesanan' => $driver === 'mysql' ? 'VARCHAR(255) NULL' : 'TEXT',
        'peruntukan' => $driver === 'mysql' ? 'VARCHAR(100) NULL' : 'TEXT',
        'diskon' => $driver === 'mysql' ? 'DECIMAL(15,2) DEFAULT 0' : 'REAL DEFAULT 0',
        'ongkir' => $driver === 'mysql' ? 'DECIMAL(15,2) DEFAULT 0' : 'REAL DEFAULT 0',
        'biaya' => $driver === 'mysql' ? 'DECIMAL(15,2) DEFAULT 0' : 'REAL DEFAULT 0',
        'totalNota' => $driver === 'mysql' ? 'DECIMAL(15,2) NULL' : 'REAL',
        'metode' => $driver === 'mysql' ? 'VARCHAR(100) NULL' : 'TEXT',
        'akun' => $driver === 'mysql' ? 'VARCHAR(100) NULL' : 'TEXT',
        'status' => $driver === 'mysql' ? "VARCHAR(50) DEFAULT 'belum'" : "TEXT DEFAULT 'belum'",
        'tglProses' => $driver === 'mysql' ? 'VARCHAR(50) NULL' : 'TEXT',
        'tglBayar' => $driver === 'mysql' ? 'VARCHAR(50) NULL' : 'TEXT',
        'keterangan' => 'TEXT NULL',
        'fotoNota' => $driver === 'mysql' ? 'LONGTEXT NULL' : 'TEXT',
        'buktiBayar' => $driver === 'mysql' ? 'LONGTEXT NULL' : 'TEXT',
        'createdAt' => $driver === 'mysql' ? 'BIGINT NULL' : 'INTEGER'
    ],
    'pembelian_items' => [
        'id' => $driver === 'mysql' ? 'BIGINT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT',
        'pembelian_id' => $driver === 'mysql' ? 'VARCHAR(50) NOT NULL' : 'TEXT NOT NULL',
        'nama' => $driver === 'mysql' ? 'VARCHAR(255) NULL' : 'TEXT',
        'qty' => $driver === 'mysql' ? 'DECIMAL(10,2) DEFAULT 1' : 'REAL DEFAULT 1',
        'satuan' => $driver === 'mysql' ? 'VARCHAR(50) NULL' : 'TEXT',
        'harga' => $driver === 'mysql' ? 'DECIMAL(15,2) DEFAULT 0' : 'REAL DEFAULT 0',
        'urutan' => 'INT DEFAULT 0'
    ]
];

// 2. Ambil tabel yang sudah ada
$existingTables = [];
if ($driver === 'mysql') {
    $rows = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_NUM);
    foreach ($rows as $r) $existingTables[] = $r[0];
} else {
    $rows = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    $existingTables = $rows;
}

echo "[SCAN] Tabel terdeteksi: " . implode(', ', $existingTables) . "\n";

// 3. Scan & Buat / Tambah Kolom
foreach ($schema as $tableName => $cols) {
    if (!in_array($tableName, $existingTables)) {
        echo "\n[CREATE] Tabel '{$tableName}' belum ada. Membuat tabel...\n";
        $colDefs = [];
        foreach ($cols as $colName => $def) {
            $colDefs[] = "{$colName} {$def}";
        }
        if ($tableName === 'pembelian_items') {
            if ($driver === 'mysql') {
                $colDefs[] = "INDEX idx_pembelian_id (pembelian_id)";
                $colDefs[] = "CONSTRAINT fk_pembelian_items FOREIGN KEY (pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE";
            } else {
                $colDefs[] = "FOREIGN KEY(pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE";
            }
        }
        $sql = "CREATE TABLE `{$tableName}` (\n  " . implode(",\n  ", $colDefs) . "\n)";
        if ($driver === 'mysql') $sql .= " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        $pdo->exec($sql);
        echo "✓ Tabel '{$tableName}' berhasil dibuat.\n";
    } else {
        echo "\n[SCAN] Memeriksa struktur kolom '{$tableName}'...\n";
        $existingCols = [];
        if ($driver === 'mysql') {
            $colInfo = $pdo->query("SHOW COLUMNS FROM `{$tableName}`")->fetchAll();
            foreach ($colInfo as $ci) $existingCols[] = strtolower($ci['Field']);
        } else {
            $colInfo = $pdo->query("PRAGMA table_info(`{$tableName}`)")->fetchAll();
            foreach ($colInfo as $ci) $existingCols[] = strtolower($ci['name']);
        }

        foreach ($cols as $colName => $def) {
            if (!in_array(strtolower($colName), $existingCols)) {
                echo "  + [ALTER] Kolom '{$colName}' belum ada di '{$tableName}'. Menambahkan kolom...\n";
                $cleanDef = preg_replace('/PRIMARY\s+KEY/i', '', $def);
                $cleanDef = preg_replace('/AUTO_INCREMENT|AUTOINCREMENT/i', '', $cleanDef);
                $cleanDef = trim($cleanDef);
                $pdo->exec("ALTER TABLE `{$tableName}` ADD COLUMN `{$colName}` {$cleanDef}");
                echo "  ✓ Berhasil menambahkan kolom '{$colName}'.\n";
            }
        }
        echo "✓ Struktur kolom '{$tableName}' mutakhir.\n";
    }
}

// 4. Default config
$masterKeys = $pdo->query("SELECT `key` FROM master_config")->fetchAll(PDO::FETCH_COLUMN);
$defaultConfigs = [
    'master' => json_encode([
        'peruntukan' => ['G22', 'G23'],
        'akun' => ['DBS ****4648', 'BCA Operasional', 'Kas Kecil'],
        'platform' => ['Tokopedia', 'Shopee', 'Toko offline', 'Lainnya'],
        'metode' => ['Transfer bank', 'Kartu kredit', 'QRIS / E-Wallet', 'Tunai']
    ]),
    'ai_config' => json_encode(['apiKey' => ''])
];

foreach ($defaultConfigs as $k => $v) {
    if (!in_array($k, $masterKeys)) {
        $ins = $pdo->prepare("INSERT INTO master_config (`key`, `value`) VALUES (:k, :v)");
        $ins->execute([':k' => $k, ':v' => $v]);
        echo "[CONFIG] Konfigurasi default '{$k}' disiapkan.\n";
    }
}

// 5. Ekstrak Base64 ke File Fisik Storage
echo "\n[SCAN] Memindai gambar Base64 lama di database...\n";

function extractBase64($dataUrl, $storageDir, $prefix = 'nota') {
    if (empty($dataUrl) || !is_string($dataUrl)) return null;
    if (strpos($dataUrl, 'data:image/') !== 0) return null;

    if (preg_match('/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/', $dataUrl, $m)) {
        $ext = strtolower(str_replace('jpeg', 'jpg', $m[1]));
        $bin = base64_decode($m[2]);
        if ($bin !== false) {
            $filename = $prefix . '_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.' . $ext;
            $dest = $storageDir . '/' . $filename;
            if (@file_put_contents($dest, $bin) !== false) {
                return '/storage/uploads/' . $filename;
            }
        }
    }
    return null;
}

$rows = $pdo->query("SELECT id, fotoNota, buktiBayar FROM pembelian")->fetchAll();
$migFoto = 0;
$migBukti = 0;

$upd = $pdo->prepare("UPDATE pembelian SET fotoNota = :fn, buktiBayar = :bb WHERE id = :id");

foreach ($rows as $row) {
    $newFoto = $row['fotoNota'];
    $newBukti = $row['buktiBayar'];
    $changed = false;

    if (!empty($row['fotoNota']) && strpos($row['fotoNota'], 'data:image/') === 0) {
        $savedPath = extractBase64($row['fotoNota'], $storageDir, 'nota');
        if ($savedPath) {
            $newFoto = $savedPath;
            $migFoto++;
            $changed = true;
        }
    }

    if (!empty($row['buktiBayar']) && strpos($row['buktiBayar'], 'data:image/') === 0) {
        $savedPath = extractBase64($row['buktiBayar'], $storageDir, 'bukti');
        if ($savedPath) {
            $newBukti = $savedPath;
            $migBukti++;
            $changed = true;
        }
    }

    if ($changed) {
        $upd->execute([':fn' => $newFoto, ':bb' => $newBukti, ':id' => $row['id']]);
    }
}

echo "✓ Selesai memindai data gambar:\n";
echo "  - {$migFoto} Foto Nota Base64 dipindahkan ke file storage.\n";
echo "  - {$migBukti} Bukti Bayar Base64 dipindahkan ke file storage.\n";

echo "\n" . str_repeat("=", 65) . "\n";
echo "MIGRASI DATABASE BERHASIL SELESAI DENGAN SEMPURNA!\n";
echo str_repeat("=", 65) . "\n";
