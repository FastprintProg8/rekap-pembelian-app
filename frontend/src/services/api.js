const LS_KEY = 'rekap-pembelian:v2';
const AI_LS_KEY = 'rekap-pembelian:ai';

const getApiBase = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  return `${path}/api`;
};

export const DEFAULT_MASTER = {
  peruntukan: ['G22', 'G23'],
  akun: ['DBS ****4648', 'BCA Operasional', 'Kas Kecil'],
  platform: ['Tokopedia', 'Shopee', 'Toko offline', 'Lainnya'],
  metode: ['Transfer bank', 'Kartu kredit', 'QRIS / E-Wallet', 'Tunai']
};

export const api = {
  async getInitialState() {
    let localAiKey = '';
    try {
      const savedAi = localStorage.getItem(AI_LS_KEY);
      if (savedAi) localAiKey = JSON.parse(savedAi).apiKey || '';
    } catch (e) {}

    try {
      const res = await fetch(`${getApiBase()}/state`);
      if (res.ok) {
        const data = await res.json();
        const serverAiKey = data.ai_config?.apiKey || '';
        const finalAiKey = serverAiKey || localAiKey;
        const normalizedPembelian = (data.pembelian || []).map(p => ({
          ...p,
          items: (p.items || []).map(it => {
            const hrg = Number(it.hargaSatuan ?? it.harga ?? it.harga_satuan ?? 0);
            return {
              ...it,
              qty: Number(it.qty) || 1,
              hargaSatuan: hrg,
              harga: hrg
            };
          })
        }));

        return {
          pembelian: normalizedPembelian,
          master: data.master || DEFAULT_MASTER,
          aiActive: !!(data.ai || finalAiKey),
          aiApiKey: finalAiKey,
          isServer: true
        };
      }
    } catch (e) {
      console.warn('Gagal hubungi backend, beralih ke localStorage:', e);
    }

    // Fallback LocalStorage
    let local = { pembelian: [], master: DEFAULT_MASTER };
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) local = JSON.parse(saved);
    } catch (e) {}

    return {
      pembelian: local.pembelian || [],
      master: local.master || DEFAULT_MASTER,
      aiActive: !!localAiKey,
      aiApiKey: localAiKey,
      isServer: false
    };
  },

  async getPembelianServer({ page = 1, limit = 20, search = '', status = '', peruntukan = '', bulan = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (peruntukan) params.append('peruntukan', peruntukan);
    if (bulan) params.append('bulan', bulan);

    try {
      const res = await fetch(`${getApiBase()}/pembelian?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const normalized = (json.data || []).map(p => ({
          ...p,
          items: (p.items || []).map(it => {
            const hrg = Number(it.hargaSatuan ?? it.harga ?? it.harga_satuan ?? 0);
            return {
              ...it,
              qty: Number(it.qty) || 1,
              hargaSatuan: hrg,
              harga: hrg
            };
          })
        }));
        return {
          data: normalized,
          pagination: json.pagination || { page: 1, limit, total: 0, totalPages: 1 },
          stats: json.stats || null,
          isServer: true
        };
      }
    } catch (e) {
      console.warn('Gagal ambil data serverside:', e);
    }
    return null;
  },

  async saveAiConfig(apiKey) {
    try {
      localStorage.setItem(AI_LS_KEY, JSON.stringify({ apiKey }));
    } catch (e) {}

    try {
      await fetch(`${getApiBase()}/ai-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
    } catch (e) {}
  },

  async restoreBackup(backupData) {
    this.saveToLocal(backupData.pembelian || [], backupData.master || DEFAULT_MASTER);
    try {
      await fetch(`${getApiBase()}/sync-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
      });
    } catch (e) {
      console.warn('Sync server gagal, disimpan di local:', e);
    }
  },

  async savePembelian(item) {
    try {
      const res = await fetch(`${getApiBase()}/pembelian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Simpan ke server gagal, menyimpan ke offline storage');
    }
    return { ok: true, offline: true };
  },

  async deletePembelian(id) {
    try {
      const res = await fetch(`${getApiBase()}/pembelian/${id}`, { method: 'DELETE' });
      if (res.ok) return true;
    } catch (e) {}
    return false;
  },

  async saveMaster(masterData) {
    try {
      await fetch(`${getApiBase()}/master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(masterData)
      });
    } catch (e) {}
  },

    async scanNota(imageBase64, mediaType = 'image/jpeg', clientApiKey = '') {
    const NOTA_PROMPT = `Anda adalah asisten cerdas spesialis membaca dan mengekstrak data dari berbagai jenis nota, struk belanja, invoice, maupun bon/nota manual bertuliskan tangan di Indonesia (termasuk toko bahan bangunan, besi/baja, kelontong, bengkel, supplier, toko ritel, dan e-commerce).

Tugas Anda adalah membaca gambar nota ini dengan SANGAT TELITI dan mengembalikan data HANYA dalam format JSON valid.

PANDUAN & ATURAN PENTING:
1. INFORMASI UMUM:
   - "toko": Nama toko/penjual atau stempel/kop nota (contoh: "UD. SUMBER REJEKI SAIDIN"). Jika ada nama orang atau keterangan toko, cantumkan. Jika tidak ada, isi null.
   - "platform": Jika nota berasal dari e-commerce/marketplace (Shopee, Tokopedia, TikTok Shop, Lazada, Blibli, dll) isi namanya. Jika toko fisik/offline, isi "Offline" atau null.
   - "tanggal": Format "YYYY-MM-DD". Perhatikan penulisan tanggal di nota (bisa format DD/MM/YY, DD-MM-YYYY, dsb). Jika tahun tertulis 2 digit (misal 24/25/26), konversikan ke 4 digit. Jika tidak terbaca, gunakan tanggal hari ini atau null.
   - "no_pesanan": No nota, no invoice, no faktur, atau no pesanan (jika ada).
   - "peruntukan": Pembeli / Tuan / Kepada Yth jika tertera di nota (contoh: "Mas Samsol").
   - "catatan": Keterangan tambahan penting (misal catatan pembayaran "LUNAS", no rekening BCA, dsb).

2. PENANGANAN NOTA TULISAN TANGAN / TOKO BANGUNAN (SANGAT KRUSIAL):
   - Seringkali pada nota tulisan tangan di Indonesia, kolom "HARGA" atau "HARGA SATUAN" ditulis dalam SINGKATAN RIBUAN (angka "000" dihilangkan).
     CONTOH KASUS NYATA:
     - Qty: 3, Harga tertulis "185", Jumlah tertulis "555.000".
       Artinya harga_satuan SEBENARNYA adalah 185000 (Rp 185.000), BUKAN 185 perak!
     - Qty: 15, Harga tertulis "85", Jumlah tertulis "1.275.000".
       Artinya harga_satuan adalah 85000 (Rp 85.000).
   - Selalu validasi matematis: jika (qty * harga_satuan) jauh lebih kecil dari nilai di kolom Jumlah/Total karena ribuan disingkat, kalikan harga_satuan dengan 1.000 atau sesuaikan agar konsisten dengan nilai rupiah sebenarnya di kolom Jumlah!
   - Perhatikan item tambahan dengan tanda panah atau coretan di bagian bawah/luar tabel (contoh: "5 kg BENDRAT -> 115.000" atau barang titipan/tambahan). Masukkan juga ke dalam daftar items!
   - Jika satu baris berisi kombinasi dimensi/ukuran (misal: "8x16 4. m = 48", "50 biji Begel 8x8"), tuliskan nama barang sejelas mungkin sesuai konteks barang material/bangunan tersebut.

3. STRUKTUR ARRAY ITEMS:
   Setiap item wajib memiliki:
   - "nama": Nama barang / rincian jelas (string).
   - "qty": Jumlah barang (number, float jika desimal, contoh 1.5 atau 20.5). Default 1 jika tidak tertera.
   - "satuan": Satuan barang jika ada (contoh: "pcs", "batang", "btg", "kg", "m", "lonjor", "biji", "dus", "zak", dll). Jika tidak ada satuan eksplisit, gunakan "pcs".
   - "harga_satuan": Harga per unit dalam rupiah penuh (number integer murni, tanpa titik/koma, contoh: 185000).

4. TOTAL & BIAYA:
   - "diskon": Potongan harga jika ada (number, default 0).
   - "ongkir": Biaya pengiriman/ongkir jika ada (number, default 0).
   - "biaya_layanan": Biaya layanan/admin/aplikasi/parkir jika ada (number, default 0).
   - "total": Total akhir pembayaran yang tertera di nota (number murni). Jika ada tulisan total akhir seperti "5.394.700", pastikan diisi 5394700.

FORMAT OUTPUT (HARUS PERSIS JSON INI, TANPA TEKS LAIN ATAU BACKTICKS):
{
  "toko": string atau null,
  "platform": string atau null,
  "tanggal": "YYYY-MM-DD" atau null,
  "no_pesanan": string atau null,
  "peruntukan": string atau null,
  "catatan": string atau null,
  "items": [
    {
      "nama": string,
      "qty": number,
      "satuan": string,
      "harga_satuan": number
    }
  ],
  "diskon": number,
  "ongkir": number,
  "biaya_layanan": number,
  "total": number
}`;

    const apiKey = (clientApiKey || '').trim();
    if (!apiKey) {
      throw new Error('Kunci API Gemini belum diatur. Masukkan kunci API di Menu & Pengaturan.');
    }

    const media = mediaType || 'image/jpeg';
    const b64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const payload = {
      contents: [{
        parts: [
          { text: NOTA_PROMPT },
          { inline_data: { mime_type: media, data: b64 } }
        ]
      }],
      generationConfig: {
        response_mime_type: 'application/json'
      }
    };

    // Gunakan model persis proyek lama: gemini-3.5-flash-lite, dengan fallback gemini-3.8-flash sesuai info Google
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    let lastMsg = '';

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastMsg = data.error?.message || `HTTP ${res.status}`;
          continue;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('AI tidak mengembalikan hasil teks.');

        const a = text.indexOf('{'), b = text.lastIndexOf('}');
        if (a < 0 || b < a) throw new Error('Hasil bacaan AI tidak berbentuk data. Coba foto yang lebih jelas.');
        return JSON.parse(text.slice(a, b + 1));
      } catch (e) {
        lastMsg = e.message;
      }
    }

    throw new Error('Gagal membaca nota: ' + lastMsg);
  },

  saveToLocal(pembelian, master) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ pembelian, master }));
    } catch (e) {}
  }
};
