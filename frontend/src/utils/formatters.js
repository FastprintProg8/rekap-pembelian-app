export function formatRupiah(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function formatTanggal(tglStr) {
  if (!tglStr) return '-';
  try {
    const parts = tglStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return tglStr;
  } catch (e) {
    return tglStr;
  }
}

export function hitungTotalBarang(items = []) {
  return items.reduce((acc, it) => acc + ((Number(it.qty) || 0) * (Number(it.hargaSatuan || it.harga_satuan) || 0)), 0);
}

export function hitungTotalHitungan(items = [], diskon = 0, ongkir = 0, biaya = 0) {
  const barang = hitungTotalBarang(items);
  return barang - (Number(diskon) || 0) + (Number(ongkir) || 0) + (Number(biaya) || 0);
}

export function generateId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

/**
 * Normalisasi URL foto (Base64 atau Path fisik di storage)
 * Mendukung subfolder deployment otomatis.
 */
export function resolveImageUrl(src) {
  if (!src) return '';
  // Jika sudah base64 atau absolute http(s) URL
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // Jika path /storage/... atau storage/...
  const cleanPath = src.startsWith('/') ? src : `/${src}`;
  const basePath = window.location.pathname.replace(/\/+$/, '');
  return `${basePath}${cleanPath}`;
}
