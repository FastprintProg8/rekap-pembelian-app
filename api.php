<?php
// Backend PHP + SQLite untuk Rekap Pembelian (Mirip server.js tapi native PHP)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Baca file .env (KUNCI=nilai per baris) jika ada
function envValue($name) {
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
    return ($v !== false && $v !== '') ? $v : ($env[$name] ?? '');
}

$dbFile = __DIR__ . '/data.db';
$db = new SQLite3($dbFile);
$db->exec('PRAGMA journal_mode = WAL;');

// Inisialisasi Tabel SQLite
$db->exec("
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

// Default Master jika belum ada
$res = $db->querySingle("SELECT value FROM master_config WHERE key = 'master'");
if (!$res) {
    $defaultMaster = json_encode([
        'peruntukan' => ['Umum', 'Dapur', 'Operasional', 'G22', 'G23'],
        'akun' => ['DBS ****4648'],
        'platform' => ['Tokopedia', 'Shopee', 'Toko offline', 'Lainnya'],
        'metode' => ['Kartu kredit', 'Transfer bank', 'Tunai', 'Lainnya']
    ]);
    $stmt = $db->prepare("INSERT INTO master_config (key, value) VALUES ('master', :val)");
    $stmt->bindValue(':val', $defaultMaster, SQLITE3_TEXT);
    $stmt->execute();
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
    $pembelian = [];
    $pQuery = $db->query("SELECT * FROM pembelian ORDER BY tanggal DESC, createdAt DESC");
    while ($row = $pQuery->fetchArray(SQLITE3_ASSOC)) {
        $pembelian[] = $row;
    }

    $itemsMap = [];
    $iQuery = $db->query("SELECT * FROM pembelian_items ORDER BY pembelian_id, urutan ASC");
    while ($row = $iQuery->fetchArray(SQLITE3_ASSOC)) {
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

    $masterRaw = $db->querySingle("SELECT value FROM master_config WHERE key = 'master'");
    $master = json_decode($masterRaw, true) ?: [];

    jsonResponse([
        'pembelian' => $pembelian,
        'master' => $master,
        'mig' => 2,
        'sqlite' => true,
        'ai' => envValue('ANTHROPIC_API_KEY') !== ''
    ]);
}

// 2. POST /api/pembelian
if ($uri === '/api/pembelian' && $method === 'POST') {
    $p = getPayload();
    $stmt = $db->prepare("
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
    ");

    $stmt->bindValue(':id', $p['id'], SQLITE3_TEXT);
    $stmt->bindValue(':tanggal', $p['tanggal'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':toko', $p['toko'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':platform', $p['platform'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':noPesanan', $p['noPesanan'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':peruntukan', $p['peruntukan'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':diskon', floatval($p['diskon'] ?? 0), SQLITE3_FLOAT);
    $stmt->bindValue(':ongkir', floatval($p['ongkir'] ?? 0), SQLITE3_FLOAT);
    $stmt->bindValue(':biaya', floatval($p['biaya'] ?? 0), SQLITE3_FLOAT);
    $stmt->bindValue(':totalNota', isset($p['totalNota']) && $p['totalNota'] !== '' ? floatval($p['totalNota']) : null, isset($p['totalNota']) && $p['totalNota'] !== '' ? SQLITE3_FLOAT : SQLITE3_NULL);
    $stmt->bindValue(':metode', $p['metode'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':akun', $p['akun'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':status', $p['status'] ?? 'belum', SQLITE3_TEXT);
    $stmt->bindValue(':tglProses', $p['tglProses'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':tglBayar', $p['tglBayar'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':keterangan', $p['keterangan'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':fotoNota', $p['fotoNota'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':buktiBayar', $p['buktiBayar'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':createdAt', intval($p['createdAt'] ?? time()*1000), SQLITE3_INTEGER);
    $stmt->execute();

    // Items
    $del = $db->prepare("DELETE FROM pembelian_items WHERE pembelian_id = :id");
    $del->bindValue(':id', $p['id'], SQLITE3_TEXT);
    $del->execute();

    if (!empty($p['items']) && is_array($p['items'])) {
        $insItem = $db->prepare("INSERT INTO pembelian_items (pembelian_id, nama, qty, satuan, harga, urutan) VALUES (:pid, :nama, :qty, :satuan, :harga, :urutan)");
        foreach ($p['items'] as $idx => $it) {
            $insItem->bindValue(':pid', $p['id'], SQLITE3_TEXT);
            $insItem->bindValue(':nama', $it['nama'] ?? '', SQLITE3_TEXT);
            $insItem->bindValue(':qty', floatval($it['qty'] ?? 1), SQLITE3_FLOAT);
            $insItem->bindValue(':satuan', $it['satuan'] ?? '', SQLITE3_TEXT);
            $insItem->bindValue(':harga', floatval($it['harga'] ?? 0), SQLITE3_FLOAT);
            $insItem->bindValue(':urutan', $idx, SQLITE3_INTEGER);
            $insItem->execute();
        }
    }

    jsonResponse(['success' => true, 'id' => $p['id']]);
}

// 3. POST /api/master
if ($uri === '/api/master' && $method === 'POST') {
    $payload = getPayload();
    $stmt = $db->prepare("INSERT INTO master_config (key, value) VALUES ('master', :val) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    $stmt->bindValue(':val', json_encode($payload), SQLITE3_TEXT);
    $stmt->execute();
    jsonResponse(['success' => true]);
}

// 4. POST /api/sync-all
if ($uri === '/api/sync-all' && $method === 'POST') {
    $payload = getPayload();
    if (isset($payload['master'])) {
        $stmt = $db->prepare("INSERT OR REPLACE INTO master_config (key, value) VALUES ('master', :val)");
        $stmt->bindValue(':val', json_encode($payload['master']), SQLITE3_TEXT);
        $stmt->execute();
    }
    if (!empty($payload['pembelian']) && is_array($payload['pembelian'])) {
        $db->exec("DELETE FROM pembelian_items; DELETE FROM pembelian;");
        foreach ($payload['pembelian'] as $p) {
            // Re-insert pembelian
            $stmt = $db->prepare("INSERT INTO pembelian (id, tanggal, toko, platform, noPesanan, peruntukan, diskon, ongkir, biaya, totalNota, metode, akun, status, tglProses, tglBayar, keterangan, fotoNota, buktiBayar, createdAt) VALUES (:id, :tanggal, :toko, :platform, :noPesanan, :peruntukan, :diskon, :ongkir, :biaya, :totalNota, :metode, :akun, :status, :tglProses, :tglBayar, :keterangan, :fotoNota, :buktiBayar, :createdAt)");
            $stmt->bindValue(':id', $p['id'], SQLITE3_TEXT);
            $stmt->bindValue(':tanggal', $p['tanggal'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':toko', $p['toko'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':platform', $p['platform'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':noPesanan', $p['noPesanan'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':peruntukan', $p['peruntukan'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':diskon', floatval($p['diskon'] ?? 0), SQLITE3_FLOAT);
            $stmt->bindValue(':ongkir', floatval($p['ongkir'] ?? 0), SQLITE3_FLOAT);
            $stmt->bindValue(':biaya', floatval($p['biaya'] ?? 0), SQLITE3_FLOAT);
            $stmt->bindValue(':totalNota', isset($p['totalNota']) && $p['totalNota'] !== '' ? floatval($p['totalNota']) : null, isset($p['totalNota']) && $p['totalNota'] !== '' ? SQLITE3_FLOAT : SQLITE3_NULL);
            $stmt->bindValue(':metode', $p['metode'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':akun', $p['akun'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':status', $p['status'] ?? 'belum', SQLITE3_TEXT);
            $stmt->bindValue(':tglProses', $p['tglProses'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':tglBayar', $p['tglBayar'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':keterangan', $p['keterangan'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':fotoNota', $p['fotoNota'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':buktiBayar', $p['buktiBayar'] ?? '', SQLITE3_TEXT);
            $stmt->bindValue(':createdAt', intval($p['createdAt'] ?? time()*1000), SQLITE3_INTEGER);
            $stmt->execute();

            if (!empty($p['items'])) {
                $insItem = $db->prepare("INSERT INTO pembelian_items (pembelian_id, nama, qty, satuan, harga, urutan) VALUES (:pid, :nama, :qty, :satuan, :harga, :urutan)");
                foreach ($p['items'] as $idx => $it) {
                    $insItem->bindValue(':pid', $p['id'], SQLITE3_TEXT);
                    $insItem->bindValue(':nama', $it['nama'] ?? '', SQLITE3_TEXT);
                    $insItem->bindValue(':qty', floatval($it['qty'] ?? 1), SQLITE3_FLOAT);
                    $insItem->bindValue(':satuan', $it['satuan'] ?? '', SQLITE3_TEXT);
                    $insItem->bindValue(':harga', floatval($it['harga'] ?? 0), SQLITE3_FLOAT);
                    $insItem->bindValue(':urutan', $idx, SQLITE3_INTEGER);
                    $insItem->execute();
                }
            }
        }
    }
    jsonResponse(['success' => true]);
}

// 5. DELETE /api/pembelian/{id}
if (strpos($uri, '/api/pembelian/') === 0 && $method === 'DELETE') {
    $id = urldecode(substr($uri, strlen('/api/pembelian/')));
    foreach (["DELETE FROM pembelian_items WHERE pembelian_id = :id", "DELETE FROM pembelian WHERE id = :id"] as $sql) {
        $st = $db->prepare($sql);
        $st->bindValue(':id', $id, SQLITE3_TEXT);
        $st->execute();
    }
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
- "platform": Tokopedia, Shopee, Lazada, Blibli, TikTok Shop, atau null untuk toko fisik / tidak jelas.
- "satuan" diisi "pcs" jika tidak tertulis.
- "tanggal" adalah tanggal transaksi/pesanan; ubah ke format YYYY-MM-DD.
- Jangan mengarang. Jika bagian tidak terbaca, isi null dan jelaskan singkat di "catatan".
- Jika total tidak sama dengan perhitungan dan tidak ada baris potongan yang terlihat, biarkan diskon 0 dan sebutkan selisihnya di "catatan".
PROMPT;

    $model = envValue('NOTA_MODEL') ?: 'claude-sonnet-5-5';
    $body = json_encode([
        'model' => $model,
        'max_tokens' => 2000,
        'system' => $prompt,
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $image]],
                ['type' => 'text', 'text' => 'Baca nota ini dan kembalikan JSON sesuai format.']
            ]
        ]]
    ]);

    @set_time_limit(120);
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_HTTPHEADER => ['content-type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'],
        CURLOPT_POSTFIELDS => $body
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($resp === false) jsonResponse(['error' => 'Gagal menghubungi Claude API: ' . $err], 502);
    $data = json_decode($resp, true) ?: [];
    if ($code === 401) jsonResponse(['error' => 'Kunci API Anthropic di server tidak valid. Periksa ANTHROPIC_API_KEY di file .env.'], 502);
    if ($code >= 400) jsonResponse(['error' => $data['error']['message'] ?? "Claude API error $code"], 502);

    $text = '';
    foreach (($data['content'] ?? []) as $blk) {
        if (($blk['type'] ?? '') === 'text') $text .= $blk['text'];
    }
    $a = strpos($text, '{'); $b = strrpos($text, '}');
    if ($a === false || $b === false || $b < $a) jsonResponse(['error' => 'Nota tidak terbaca. Coba foto yang lebih jelas.'], 422);
    $obj = json_decode(substr($text, $a, $b - $a + 1), true);
    if (!is_array($obj)) jsonResponse(['error' => 'Hasil bacaan tidak valid. Coba lagi.'], 422);
    jsonResponse($obj);
}

// Fallback jika dibuka langsung
http_response_code(404);
echo "API endpoint tidak ditemukan";
