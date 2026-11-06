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
    const NOTA_PROMPT = `Anda membaca foto nota, struk, invoice, atau rincian pesanan belanja di Indonesia.
Kembalikan HANYA format JSON berikut:
{
  "toko": string atau null,
  "platform": string atau null,
  "tanggal": "YYYY-MM-DD" atau null,
  "no_pesanan": string atau null,
  "peruntukan": string atau null,
  "items": [
    {"nama": string, "qty": number, "satuan": string, "harga_satuan": number}
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
