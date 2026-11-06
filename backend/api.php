<?php
// Helper: Cari root folder aplikasi tempat folder 'storage' berada
function getAppRootDir() {
    if (is_dir(__DIR__ . '/storage')) {
        return __DIR__;
    }
    if (is_dir(dirname(__DIR__) . '/storage')) {
        return dirname(__DIR__);
    }
    return __DIR__;
}

// Helper: Simpan base64 ke file fisik di storage/uploads
function saveBase64ToStorage($dataUrl, $prefix = 'nota') {
    if (empty($dataUrl) || !is_string($dataUrl)) return $dataUrl;
    if (strpos($dataUrl, '/storage/') === 0 || strpos($dataUrl, 'storage/') === 0 || strpos($dataUrl, 'data:image/') !== 0) {
        return $dataUrl;
    }
    if (preg_match('/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/', $dataUrl, $m)) {
        $ext = strtolower(str_replace('jpeg', 'jpg', $m[1]));
        $bin = base64_decode($m[2]);
        if ($bin !== false) {
            $rootDir = getAppRootDir();
            $storageDir = $rootDir . '/storage/uploads';
            if (!is_dir($storageDir)) {
                @mkdir($storageDir, 0777, true);
            }
            $filename = $prefix . '_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.' . $ext;
            $dest = $storageDir . '/' . $filename;
            if (@file_put_contents($dest, $bin) !== false) {
                return '/storage/uploads/' . $filename;
            }
        }
    }
    return $dataUrl;
}

// Helper kompatibilitas PHP 5.6+
function arrGet($arr, $key, $default = '') {
    return isset($arr[$key]) ? $arr[$key] : $default;
}
// Backend PHP (Mendukung MySQL & SQLite via PDO) untuk Rekap Pembelian
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Baca file .env jika ada
function envValue($name, $default = '') {
    static $env = null;
    if ($env === null) {
        $env = [];
        $f = dirname(__DIR__) . '/.env';
        if (!is_readable($f)) {
            $f = __DIR__ . '/.env';
        }
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

// Inisialisasi Koneksi Database (PDO: MySQL atau SQLite)
$dbDriver = strtolower(envValue('DB_DRIVER', 'sqlite'));

try {
    if ($dbDriver === 'mysql') {
        $host = envValue('DB_HOST', '127.0.0.1');
        $port = envValue('DB_PORT', '3306');
        $dbName = envValue('DB_NAME', 'rekap_pembelian');
        $user = envValue('DB_USER', 'root');
        $pass = envValue('DB_PASS', '');

        $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        // Schema DDL MySQL jika tabel belum ada
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `master_config` (
              `key` VARCHAR(100) NOT NULL PRIMARY KEY,
              `value` LONGTEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `pembelian` (
              `id` VARCHAR(50) NOT NULL PRIMARY KEY,
              `tanggal` VARCHAR(50) NULL,
              `toko` VARCHAR(255) NULL,
              `platform` VARCHAR(100) NULL,
              `noPesanan` VARCHAR(255) NULL,
              `peruntukan` VARCHAR(100) NULL,
              `diskon` DECIMAL(15,2) DEFAULT 0,
              `ongkir` DECIMAL(15,2) DEFAULT 0,
              `biaya` DECIMAL(15,2) DEFAULT 0,
              `totalNota` DECIMAL(15,2) NULL,
              `metode` VARCHAR(100) NULL,
              `akun` VARCHAR(100) NULL,
              `status` VARCHAR(50) NULL,
              `tglProses` VARCHAR(50) NULL,
              `tglBayar` VARCHAR(50) NULL,
              `keterangan` TEXT NULL,
              `fotoNota` LONGTEXT NULL,
              `buktiBayar` LONGTEXT NULL,
              `createdAt` BIGINT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS `pembelian_items` (
              `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
              `pembelian_id` VARCHAR(50) NOT NULL,
              `nama` VARCHAR(255) NULL,
              `qty` DECIMAL(10,2) DEFAULT 1,
              `satuan` VARCHAR(50) NULL,
              `harga` DECIMAL(15,2) DEFAULT 0,
              `urutan` INT DEFAULT 0,
              INDEX `idx_pembelian_id` (`pembelian_id`),
              CONSTRAINT `fk_pembelian_items_cascade` FOREIGN KEY (`pembelian_id`) REFERENCES `pembelian` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } else {
        // Default: SQLite via PDO
        $dbDir = __DIR__ . '/database';
        if (!is_dir($dbDir)) { @mkdir($dbDir, 0777, true); }
        $dbFile = $dbDir . '/data.db';
        $pdo = new PDO("sqlite:{$dbFile}", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        $pdo->exec("PRAGMA journal_mode = WAL;");
        $pdo->exec("
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
        ");
    }
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Database connection error: ' . $e->getMessage()]);
    exit;
}

// Default Master jika belum ada
$st = $pdo->prepare("SELECT value FROM master_config WHERE `key` = 'master'");
$st->execute();
$res = $st->fetchColumn();
if (!$res) {
    $defaultMaster = json_encode([
        'peruntukan' => ['Umum', 'Dapur', 'Operasional', 'G22', 'G23'],
        'akun' => ['DBS ****4648'],
        'platform' => ['Tokopedia', 'Shopee', 'Toko offline', 'Lainnya'],
        'metode' => ['Kartu kredit', 'Transfer bank', 'Tunai', 'Lainnya']
    ]);
    if ($dbDriver === 'mysql') {
        $ins = $pdo->prepare("INSERT INTO master_config (`key`, `value`) VALUES ('master', :val) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    } else {
        $ins = $pdo->prepare("INSERT OR REPLACE INTO master_config (`key`, `value`) VALUES ('master', :val)");
    }
    $ins->execute([':val' => $defaultMaster]);
}

// Router API
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Normalisasi URI jika diakses via subfolder (misal: /rekap-pembelian-app/api/... menjadi /api/...)
$uri = preg_replace('#^.*?(/api(?:/.*)?)$#', '$1', $uri);
$method = $_SERVER['REQUEST_METHOD'];

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function getPayload() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}


// 0. GET /api/pembelian (Server-side Pagination, Filter & Stats)
if ($uri === '/api/pembelian' && $method === 'GET') {
    $page = max(1, intval(isset($_GET['page']) ? $_GET['page'] : 1));
    $limit = max(1, min(100, intval(isset($_GET['limit']) ? $_GET['limit'] : 20)));
    $offset = ($page - 1) * $limit;

    $search = trim(isset($_GET['search']) ? $_GET['search'] : '');
    $status = trim(isset($_GET['status']) ? $_GET['status'] : '');
    $peruntukan = trim(isset($_GET['peruntukan']) ? $_GET['peruntukan'] : '');
    $bulan = trim(isset($_GET['bulan']) ? $_GET['bulan'] : '');

    // 1. Hitung ringkasan stats kartu (belum, diproses, dibayar)
    $stats = [
        'belum' => ['count' => 0, 'total' => 0],
        'diproses' => ['count' => 0, 'total' => 0],
        'dibayar' => ['count' => 0, 'total' => 0]
    ];

    $stStat = $pdo->query("
        SELECT status, COUNT(*) as cnt, SUM(COALESCE(totalNota, 0)) as tot 
        FROM pembelian 
        GROUP BY status
    ");
    while ($row = $stStat->fetch()) {
        $stName = $row['status'] ?: 'belum';
        if (isset($stats[$stName])) {
            $stats[$stName]['count'] = intval($row['cnt']);
            $stats[$stName]['total'] = floatval($row['tot']);
        }
    }

    // 2. Bangun klausa WHERE untuk filter
    $where = [];
    $params = [];

    if ($status !== '') {
        $where[] = "p.status = :status";
        $params[':status'] = $status;
    }
    if ($peruntukan !== '') {
        $where[] = "p.peruntukan = :peruntukan";
        $params[':peruntukan'] = $peruntukan;
    }
    if ($bulan !== '') {
        $where[] = "p.tanggal LIKE :bulan";
        $params[':bulan'] = $bulan . '-%';
    }
    if ($search !== '') {
        $where[] = "(p.toko LIKE :search OR p.noPesanan LIKE :search OR p.keterangan LIKE :search OR EXISTS (
            SELECT 1 FROM pembelian_items pi WHERE pi.pembelian_id = p.id AND pi.nama LIKE :search
        ))";
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    // Hitung total baris yang cocok
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM pembelian p $whereSql");
    $countStmt->execute($params);
    $totalRows = intval($countStmt->fetchColumn());

    // Ambil baris dengan LIMIT & OFFSET
    $listSql = "SELECT p.* FROM pembelian p $whereSql ORDER BY p.tanggal DESC, p.createdAt DESC LIMIT $limit OFFSET $offset";
    $listStmt = $pdo->prepare($listSql);
    $listStmt->execute($params);
    $pembelian = $listStmt->fetchAll();

    // Ambil items hanya untuk ID pembelian yang terpilih di halaman ini
    $pIds = array_map(function($row) { return $row['id']; }, $pembelian);
    $itemsMap = [];
    if (!empty($pIds)) {
        $inPlaceholders = implode(',', array_fill(0, count($pIds), '?'));
        $iStmt = $pdo->prepare("SELECT * FROM pembelian_items WHERE pembelian_id IN ($inPlaceholders) ORDER BY pembelian_id, urutan ASC");
        $iStmt->execute($pIds);
        while ($r = $iStmt->fetch()) {
            $pid = $r['pembelian_id'];
            if (!isset($itemsMap[$pid])) $itemsMap[$pid] = [];
            $itemsMap[$pid][] = [
                'nama' => $r['nama'] ?: '',
                'qty' => floatval($r['qty']),
                'satuan' => $r['satuan'] ?: '',
                'harga' => floatval($r['harga']),
                'hargaSatuan' => floatval($r['harga'])
            ];
        }
    }

    foreach ($pembelian as &$p) {
        $p['items'] = isset($itemsMap[$p['id']]) ? $itemsMap[$p['id']] : [];
        $p['diskon'] = floatval($p['diskon']);
        $p['ongkir'] = floatval($p['ongkir']);
        $p['biaya'] = floatval($p['biaya']);
        $p['totalNota'] = $p['totalNota'] !== null ? floatval($p['totalNota']) : null;
        $p['createdAt'] = intval($p['createdAt']);
    }

    jsonResponse([
        'data' => $pembelian,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $totalRows,
            'totalPages' => ceil($totalRows / $limit)
        ],
        'stats' => $stats
    ]);
}

// 1. GET /api/state
if ($uri === '/api/state' && $method === 'GET') {
    $pQuery = $pdo->query("SELECT * FROM pembelian ORDER BY tanggal DESC, createdAt DESC");
    $pembelian = $pQuery->fetchAll();

    $iQuery = $pdo->query("SELECT * FROM pembelian_items ORDER BY pembelian_id, urutan ASC");
    $itemsMap = [];
    while ($row = $iQuery->fetch()) {
        $pid = $row['pembelian_id'];
        if (!isset($itemsMap[$pid])) $itemsMap[$pid] = [];
        $itemsMap[$pid][] = [
            'nama' => $row['nama'] ?: '',
            'qty' => floatval($row['qty']),
            'satuan' => $row['satuan'] ?: '',
            'harga' => floatval($row['harga'])
        ];
    }

    foreach ($pembelian as &$p) {
        $p['items'] = isset($itemsMap[$p['id']]) ? $itemsMap[$p['id']] : [];
        $p['diskon'] = floatval($p['diskon']);
        $p['ongkir'] = floatval($p['ongkir']);
        $p['biaya'] = floatval($p['biaya']);
        $p['totalNota'] = $p['totalNota'] !== null ? floatval($p['totalNota']) : null;
        $p['createdAt'] = intval($p['createdAt']);
    }

    $stM = $pdo->prepare("SELECT value FROM master_config WHERE `key` = 'master'");
    $stM->execute();
    $masterRaw = $stM->fetchColumn();
    $master = json_decode($masterRaw, true) ?: [];
    $stAI = $pdo->prepare("SELECT value FROM master_config WHERE `key` = 'ai_config'");
    $stAI->execute();
    $aiRaw = $stAI->fetchColumn();
    $aiConfig = $aiRaw ? json_decode($aiRaw, true) : null;

    jsonResponse([
        'pembelian' => $pembelian,
        'master' => $master,
        'ai_config' => $aiConfig,
        'mig' => 2,
        'driver' => $dbDriver,
        'ai' => envValue('ANTHROPIC_API_KEY') !== ''
    ]);
}

// 2. POST /api/pembelian
if ($uri === '/api/pembelian' && $method === 'POST') {
    $p = getPayload();
    if (empty($p['id'])) jsonResponse(['error' => 'Missing ID'], 400);

    try {
        if ($dbDriver === 'mysql') {
            $sql = "
                INSERT INTO pembelian (
                  id, tanggal, toko, platform, noPesanan, peruntukan, diskon, ongkir, biaya, totalNota,
                  metode, akun, status, tglProses, tglBayar, keterangan, fotoNota, buktiBayar, createdAt
                ) VALUES (
                  :id, :tanggal, :toko, :platform, :noPesanan, :peruntukan, :diskon, :ongkir, :biaya, :totalNota,
                  :metode, :akun, :status, :tglProses, :tglBayar, :keterangan, :fotoNota, :buktiBayar, :createdAt
                )
                ON DUPLICATE KEY UPDATE
                  tanggal=VALUES(tanggal), toko=VALUES(toko), platform=VALUES(platform),
                  noPesanan=VALUES(noPesanan), peruntukan=VALUES(peruntukan), diskon=VALUES(diskon),
                  ongkir=VALUES(ongkir), biaya=VALUES(biaya), totalNota=VALUES(totalNota),
                  metode=VALUES(metode), akun=VALUES(akun), status=VALUES(status),
                  tglProses=VALUES(tglProses), tglBayar=VALUES(tglBayar), keterangan=VALUES(keterangan),
                  fotoNota=VALUES(fotoNota), buktiBayar=VALUES(buktiBayar), createdAt=VALUES(createdAt)
            ";
        } else {
            $sql = "
                INSERT INTO pembelian (
                  id, tanggal, toko, platform, noPesanan, peruntukan, diskon, ongkir, biaya, totalNota,
                  metode, akun, status, tglProses, tglBayar, keterangan, fotoNota, buktiBayar, createdAt
                ) VALUES (
                  :id, :tanggal, :toko, :platform, :noPesanan, :peruntukan, :diskon, :ongkir, :biaya, :totalNota,
                  :metode, :akun, :status, :tglProses, :tglBayar, :keterangan, :fotoNota, :buktiBayar, :createdAt
                )
                ON CONFLICT(id) DO UPDATE SET
                  tanggal=excluded.tanggal, toko=excluded.toko, platform=excluded.platform,
                  noPesanan=excluded.noPesanan, peruntukan=excluded.peruntukan, diskon=excluded.diskon,
                  ongkir=excluded.ongkir, biaya=excluded.biaya, totalNota=excluded.totalNota,
                  metode=excluded.metode, akun=excluded.akun, status=excluded.status,
                  tglProses=excluded.tglProses, tglBayar=excluded.tglBayar, keterangan=excluded.keterangan,
                  fotoNota=excluded.fotoNota, buktiBayar=excluded.buktiBayar, createdAt=excluded.createdAt
            ";
        }

        $savedFotoNota = saveBase64ToStorage(arrGet($p, 'fotoNota', ''), 'nota');
        $savedBuktiBayar = saveBase64ToStorage(arrGet($p, 'buktiBayar', ''), 'bukti');

        $tglVal = arrGet($p, 'tanggal', '');
        $tglProsesVal = arrGet($p, 'tglProses', '');
        $tglBayarVal = arrGet($p, 'tglBayar', '');

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id' => $p['id'],
            ':tanggal' => !empty($tglVal) ? $tglVal : null,
            ':toko' => arrGet($p, 'toko', ''),
            ':platform' => arrGet($p, 'platform', ''),
            ':noPesanan' => arrGet($p, 'noPesanan', ''),
            ':peruntukan' => arrGet($p, 'peruntukan', ''),
            ':diskon' => floatval(arrGet($p, 'diskon', 0)),
            ':ongkir' => floatval(arrGet($p, 'ongkir', 0)),
            ':biaya' => floatval(arrGet($p, 'biaya', 0)),
            ':totalNota' => (isset($p['totalNota']) && $p['totalNota'] !== '') ? floatval($p['totalNota']) : null,
            ':metode' => arrGet($p, 'metode', ''),
            ':akun' => arrGet($p, 'akun', ''),
            ':status' => arrGet($p, 'status', 'belum'),
            ':tglProses' => !empty($tglProsesVal) ? $tglProsesVal : null,
            ':tglBayar' => !empty($tglBayarVal) ? $tglBayarVal : null,
            ':keterangan' => arrGet($p, 'keterangan', ''),
            ':fotoNota' => $savedFotoNota,
            ':buktiBayar' => $savedBuktiBayar,
            ':createdAt' => intval(isset($p['createdAt']) ? $p['createdAt'] : time() * 1000)
        ]);

        // Items
        $del = $pdo->prepare("DELETE FROM pembelian_items WHERE pembelian_id = :id");
        $del->execute([':id' => $p['id']]);

        if (!empty($p['items']) && is_array($p['items'])) {
            $insItem = $pdo->prepare("INSERT INTO pembelian_items (pembelian_id, nama, qty, satuan, harga, urutan) VALUES (:pid, :nama, :qty, :satuan, :harga, :urutan)");
            foreach ($p['items'] as $idx => $it) {
                $hrg = isset($it['hargaSatuan']) ? $it['hargaSatuan'] : (isset($it['harga']) ? $it['harga'] : (isset($it['harga_satuan']) ? $it['harga_satuan'] : 0));
                $insItem->execute([
                    ':pid' => $p['id'],
                    ':nama' => arrGet($it, 'nama', ''),
                    ':qty' => floatval(arrGet($it, 'qty', 1)),
                    ':satuan' => arrGet($it, 'satuan', ''),
                    ':harga' => floatval($hrg),
                    ':urutan' => $idx
                ]);
            }
        }

        jsonResponse([
            'success' => true,
            'id' => $p['id'],
            'fotoNota' => $savedFotoNota,
            'buktiBayar' => $savedBuktiBayar
        ]);
    } catch (Exception $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// POST /api/ai-config
if ($uri === '/api/ai-config' && $method === 'POST') {
    $payload = getPayload();
    if ($dbDriver === 'mysql') {
        $stmt = $pdo->prepare("INSERT INTO master_config (`key`, `value`) VALUES ('ai_config', :val) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    } else {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO master_config (`key`, `value`) VALUES ('ai_config', :val)");
    }
    $stmt->execute([':val' => json_encode($payload)]);
    jsonResponse(['success' => true]);
}

// 3. POST /api/master
if ($uri === '/api/master' && $method === 'POST') {
    $payload = getPayload();
    if ($dbDriver === 'mysql') {
        $stmt = $pdo->prepare("INSERT INTO master_config (`key`, `value`) VALUES ('master', :val) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    } else {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO master_config (`key`, `value`) VALUES ('master', :val)");
    }
    $stmt->execute([':val' => json_encode($payload)]);
    jsonResponse(['success' => true]);
}

// 4. POST /api/sync-all
if ($uri === '/api/sync-all' && $method === 'POST') {
    $payload = getPayload();
    if (isset($payload['master'])) {
        if ($dbDriver === 'mysql') {
            $stmt = $pdo->prepare("INSERT INTO master_config (`key`, `value`) VALUES ('master', :val) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
        } else {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO master_config (`key`, `value`) VALUES ('master', :val)");
        }
        $stmt->execute([':val' => json_encode($payload['master'])]);
    }
    if (!empty($payload['pembelian']) && is_array($payload['pembelian'])) {
        $pdo->exec("DELETE FROM pembelian_items");
        $pdo->exec("DELETE FROM pembelian");

        $stmt = $pdo->prepare("INSERT INTO pembelian (id, tanggal, toko, platform, noPesanan, peruntukan, diskon, ongkir, biaya, totalNota, metode, akun, status, tglProses, tglBayar, keterangan, fotoNota, buktiBayar, createdAt) VALUES (:id, :tanggal, :toko, :platform, :noPesanan, :peruntukan, :diskon, :ongkir, :biaya, :totalNota, :metode, :akun, :status, :tglProses, :tglBayar, :keterangan, :fotoNota, :buktiBayar, :createdAt)");
        $insItem = $pdo->prepare("INSERT INTO pembelian_items (pembelian_id, nama, qty, satuan, harga, urutan) VALUES (:pid, :nama, :qty, :satuan, :harga, :urutan)");

        foreach ($payload['pembelian'] as $p) {
            $stmt->execute([
                ':id' => $p['id'],
                ':tanggal' => arrGet($p, 'tanggal', ''),
                ':toko' => arrGet($p, 'toko', ''),
                ':platform' => arrGet($p, 'platform', ''),
                ':noPesanan' => arrGet($p, 'noPesanan', ''),
                ':peruntukan' => arrGet($p, 'peruntukan', ''),
                ':diskon' => floatval(arrGet($p, 'diskon', 0)),
                ':ongkir' => floatval(arrGet($p, 'ongkir', 0)),
                ':biaya' => floatval(arrGet($p, 'biaya', 0)),
                ':totalNota' => (isset($p['totalNota']) && $p['totalNota'] !== '') ? floatval($p['totalNota']) : null,
                ':metode' => arrGet($p, 'metode', ''),
                ':akun' => arrGet($p, 'akun', ''),
                ':status' => arrGet($p, 'status', 'belum'),
                ':tglProses' => arrGet($p, 'tglProses', ''),
                ':tglBayar' => arrGet($p, 'tglBayar', ''),
                ':keterangan' => arrGet($p, 'keterangan', ''),
                ':fotoNota' => arrGet($p, 'fotoNota', ''),
                ':buktiBayar' => arrGet($p, 'buktiBayar', ''),
                ':createdAt' => intval(isset($p['createdAt']) ? $p['createdAt'] : time() * 1000)
            ]);

            if (!empty($p['items']) && is_array($p['items'])) {
                foreach ($p['items'] as $idx => $it) {
                    $insItem->execute([
                        ':pid' => $p['id'],
                        ':nama' => arrGet($it, 'nama', ''),
                        ':qty' => floatval(arrGet($it, 'qty', 1)),
                        ':satuan' => arrGet($it, 'satuan', ''),
                        ':harga' => floatval(arrGet($it, 'harga', 0)),
                        ':urutan' => $idx
                    ]);
                }
            }
        }
    }
    jsonResponse(['success' => true]);
}

// 5. DELETE /api/pembelian/{id}
if (strpos($uri, '/api/pembelian/') === 0 && $method === 'DELETE') {
    $id = urldecode(substr($uri, strlen('/api/pembelian/')));
    $pdo->prepare("DELETE FROM pembelian_items WHERE pembelian_id = :id")->execute([':id' => $id]);
    $pdo->prepare("DELETE FROM pembelian WHERE id = :id")->execute([':id' => $id]);
    jsonResponse(['success' => true]);
}

// 6. POST /api/baca-nota — baca foto nota dengan Claude API
if ($uri === '/api/baca-nota' && $method === 'POST') {
    $key = envValue('ANTHROPIC_API_KEY');
    if ($key === '') jsonResponse(['error' => 'Server belum diberi ANTHROPIC_API_KEY'], 503);
    if (!function_exists('curl_init')) jsonResponse(['error' => 'Ekstensi PHP cURL belum aktif di server'], 500);

    $in = getPayload();
    $image = arrGet($in, 'image', '');
    $mediaType = arrGet($in, 'media_type', 'image/jpeg');
    if ($image === '') jsonResponse(['error' => 'Foto nota kosong'], 400);

    $prompt = <<<'PROMPT'
Anda membaca foto nota, struk, invoice, atau bukti pesanan belanja di Indonesia.
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
PROMPT;

    $model = envValue('NOTA_MODEL', 'claude-sonnet-5-5');
    $payload = [
        'model' => $model,
        'max_tokens' => 1024,
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $image]],
                ['type' => 'text', 'text' => $prompt]
            ]
        ]]
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'content-type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30
    ]);
    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) jsonResponse(['error' => 'Gagal menghubungi Claude API: ' . $err], 502);
    $data = json_decode($res, true) ?: [];

    if ($status === 401) jsonResponse(['error' => 'Kunci ANTHROPIC_API_KEY tidak valid.'], 502);
    if ($status >= 400) jsonResponse(['error' => (isset($data['error']['message']) ? $data['error']['message'] : "Claude error {$status}")], 502);

    $text = '';
    foreach ((isset($data['content']) && is_array($data['content']) ? $data['content'] : []) as $b) {
        if ((arrGet($b, 'type', '')) === 'text') $text .= $b['text'];
    }
    $a = strpos($text, '{');
    $b = strrpos($text, '}');
    if ($a === false || $b === false || $b < $a) {
        jsonResponse(['error' => 'Nota tidak terbaca dengan jelas.'], 422);
    }
    $parsed = json_decode(substr($text, $a, $b - $a + 1), true);
    if (!$parsed) jsonResponse(['error' => 'Hasil JSON Claude tidak valid.'], 422);

    jsonResponse($parsed);
}

// 404
jsonResponse(['error' => 'Not found'], 404);
