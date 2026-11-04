<?php
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
        $f = __DIR__ . '/.env';
        if (is_readable($f)) {
            foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if (preg_match('/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/', $line, $m) && strpos(ltrim($line), '#') !== 0) {
                    $env[$m[1]] = preg_replace('/^([\'"])(.*)\1$/', '$2', $m[2]);
                }
            }
        }
    }
    $v = getenv($name);
    return ($v !== false && $v !== '') ? $v : ($env[$name] ?? $default);
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
        $dbFile = __DIR__ . '/data.db';
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

    jsonResponse([
        'pembelian' => $pembelian,
        'master' => $master,
        'mig' => 2,
        'driver' => $dbDriver,
        'ai' => envValue('ANTHROPIC_API_KEY') !== ''
    ]);
}

// 2. POST /api/pembelian
if ($uri === '/api/pembelian' && $method === 'POST') {
    $p = getPayload();
    if (empty($p['id'])) jsonResponse(['error' => 'Missing ID'], 400);

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

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':id' => $p['id'],
        ':tanggal' => $p['tanggal'] ?? '',
        ':toko' => $p['toko'] ?? '',
        ':platform' => $p['platform'] ?? '',
        ':noPesanan' => $p['noPesanan'] ?? '',
        ':peruntukan' => $p['peruntukan'] ?? '',
        ':diskon' => floatval($p['diskon'] ?? 0),
        ':ongkir' => floatval($p['ongkir'] ?? 0),
        ':biaya' => floatval($p['biaya'] ?? 0),
        ':totalNota' => (isset($p['totalNota']) && $p['totalNota'] !== '') ? floatval($p['totalNota']) : null,
        ':metode' => $p['metode'] ?? '',
        ':akun' => $p['akun'] ?? '',
        ':status' => $p['status'] ?? 'belum',
        ':tglProses' => $p['tglProses'] ?? '',
        ':tglBayar' => $p['tglBayar'] ?? '',
        ':keterangan' => $p['keterangan'] ?? '',
        ':fotoNota' => $p['fotoNota'] ?? '',
        ':buktiBayar' => $p['buktiBayar'] ?? '',
        ':createdAt' => intval($p['createdAt'] ?? time() * 1000)
    ]);

    // Items
    $del = $pdo->prepare("DELETE FROM pembelian_items WHERE pembelian_id = :id");
    $del->execute([':id' => $p['id']]);

    if (!empty($p['items']) && is_array($p['items'])) {
        $insItem = $pdo->prepare("INSERT INTO pembelian_items (pembelian_id, nama, qty, satuan, harga, urutan) VALUES (:pid, :nama, :qty, :satuan, :harga, :urutan)");
        foreach ($p['items'] as $idx => $it) {
            $insItem->execute([
                ':pid' => $p['id'],
                ':nama' => $it['nama'] ?? '',
                ':qty' => floatval($it['qty'] ?? 1),
                ':satuan' => $it['satuan'] ?? '',
                ':harga' => floatval($it['harga'] ?? 0),
                ':urutan' => $idx
            ]);
        }
    }

    jsonResponse(['success' => true, 'id' => $p['id']]);
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
                ':tanggal' => $p['tanggal'] ?? '',
                ':toko' => $p['toko'] ?? '',
                ':platform' => $p['platform'] ?? '',
                ':noPesanan' => $p['noPesanan'] ?? '',
                ':peruntukan' => $p['peruntukan'] ?? '',
                ':diskon' => floatval($p['diskon'] ?? 0),
                ':ongkir' => floatval($p['ongkir'] ?? 0),
                ':biaya' => floatval($p['biaya'] ?? 0),
                ':totalNota' => (isset($p['totalNota']) && $p['totalNota'] !== '') ? floatval($p['totalNota']) : null,
                ':metode' => $p['metode'] ?? '',
                ':akun' => $p['akun'] ?? '',
                ':status' => $p['status'] ?? 'belum',
                ':tglProses' => $p['tglProses'] ?? '',
                ':tglBayar' => $p['tglBayar'] ?? '',
                ':keterangan' => $p['keterangan'] ?? '',
                ':fotoNota' => $p['fotoNota'] ?? '',
                ':buktiBayar' => $p['buktiBayar'] ?? '',
                ':createdAt' => intval($p['createdAt'] ?? time() * 1000)
            ]);

            if (!empty($p['items']) && is_array($p['items'])) {
                foreach ($p['items'] as $idx => $it) {
                    $insItem->execute([
                        ':pid' => $p['id'],
                        ':nama' => $it['nama'] ?? '',
                        ':qty' => floatval($it['qty'] ?? 1),
                        ':satuan' => $it['satuan'] ?? '',
                        ':harga' => floatval($it['harga'] ?? 0),
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
    $image = $in['image'] ?? '';
    $mediaType = $in['media_type'] ?? 'image/jpeg';
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
    if ($status >= 400) jsonResponse(['error' => $data['error']['message'] ?? "Claude error {$status}"], 502);

    $text = '';
    foreach ($data['content'] ?? [] as $b) {
        if (($b['type'] ?? '') === 'text') $text .= $b['text'];
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
