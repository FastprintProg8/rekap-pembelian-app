import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Sparkles, Upload, AlertTriangle, Check, Camera } from 'lucide-react';
import { formatRupiah, hitungTotalHitungan, generateId, resolveImageUrl } from '../utils/formatters';
import { api } from '../services/api';

const DRAFT_KEY = 'rekap-pembelian:form-draft';

export default function FormPembelianModal({
  isOpen,
  onClose,
  initialData,
  master = {},
  onSave,
  aiActive = false,
  aiApiKey = ''
}) {
  const [formData, setFormData] = useState({
    id: '',
    tanggal: new Date().toISOString().split('T')[0],
    toko: '',
    platform: 'Tokopedia',
    noPesanan: '',
    peruntukan: master.peruntukan?.[0] || 'G22',
    diskon: 0,
    ongkir: 0,
    biaya: 0,
    totalNota: '',
    metode: master.metode?.[0] || 'Transfer bank',
    akun: '',
    status: 'belum',
    tglBayar: '',
    keterangan: '',
    fotoNota: '',
    items: [{ id: '1', nama: '', qty: 1, satuan: 'pcs', hargaSatuan: 0 }]
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      const normalizedItems = (initialData.items || []).map((it, idx) => ({
        id: it.id || String(idx + 1),
        nama: it.nama || '',
        qty: Number(it.qty) || 1,
        satuan: it.satuan || 'pcs',
        hargaSatuan: Number(it.hargaSatuan ?? it.harga ?? it.harga_satuan ?? 0)
      }));

      setFormData({
        ...initialData,
        diskon: initialData.diskon || 0,
        ongkir: initialData.ongkir || 0,
        biaya: initialData.biaya || 0,
        totalNota: initialData.totalNota !== null ? initialData.totalNota : '',
        items: normalizedItems.length > 0 ? normalizedItems : [{ id: '1', nama: '', qty: 1, satuan: 'pcs', hargaSatuan: 0 }]
      });
    } else {
      // Cek apakah ada draft yang tersimpan sebelumnya di localStorage
      let restoredFromDraft = false;
      try {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed && typeof parsed === 'object') {
            setFormData(parsed);
            restoredFromDraft = true;
          }
        }
      } catch (e) {}

      if (!restoredFromDraft) {
        setFormData({
          id: generateId(),
          tanggal: new Date().toISOString().split('T')[0],
          toko: '',
          platform: master.platform?.[0] || 'Tokopedia',
          noPesanan: '',
          peruntukan: master.peruntukan?.[0] || 'G22',
          diskon: 0,
          ongkir: 0,
          biaya: 0,
          totalNota: '',
          metode: master.metode?.[0] || 'Transfer bank',
          akun: '',
          status: 'belum',
          tglBayar: '',
          keterangan: '',
          fotoNota: '',
          items: [{ id: '1', nama: '', qty: 1, satuan: 'pcs', hargaSatuan: 0 }]
        });
      }
    }
    setScanError('');
  }, [initialData, isOpen, master]);

  // Simpan draft otomatis saat form berubah (khusus mode tambah data baru)
  useEffect(() => {
    if (isOpen && !initialData && formData.id) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      } catch (e) {}
    }
  }, [formData, isOpen, initialData]);

  if (!isOpen) return null;

  const totalHitungan = hitungTotalHitungan(formData.items, formData.diskon, formData.ongkir, formData.biaya);
  const adaSelisih = formData.totalNota !== '' && Number(formData.totalNota) !== totalHitungan;

  // Handler input item
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), nama: '', qty: 1, satuan: 'pcs', hargaSatuan: 0 }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  // Upload & Scan AI
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      setFormData(prev => ({ ...prev, fotoNota: base64Data }));

      // Jika AI aktif, otomatis baca nota
      if (aiActive) {
        setIsScanning(true);
        setScanError('');
        try {
          const rawBase64 = base64Data.split(',')[1] || base64Data;
          const result = await api.scanNota(rawBase64, file.type, aiApiKey);

          // Auto-fill dari AI
          setFormData(prev => ({
            ...prev,
            toko: result.toko || prev.toko,
            platform: result.platform || prev.platform,
            tanggal: result.tanggal || prev.tanggal,
            noPesanan: result.no_pesanan || prev.noPesanan,
            diskon: result.diskon || 0,
            ongkir: result.ongkir || 0,
            biaya: result.biaya_layanan || 0,
            totalNota: result.total || prev.totalNota,
            keterangan: result.catatan || prev.keterangan,
            items: result.items?.length > 0
              ? result.items.map((it, idx) => ({
                id: String(idx + 1),
                nama: it.nama,
                qty: it.qty || 1,
                satuan: it.satuan || 'pcs',
                hargaSatuan: it.harga_satuan || 0
              }))
              : prev.items
          }));
        } catch (err) {
          setScanError(err.message || 'Gagal membaca nota otomatis.');
        } finally {
          setIsScanning(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Otomatis ubah status ke diproses jika akun terisi dan status masih belum
    let st = formData.status;
    if (formData.akun && st === 'belum') {
      st = 'diproses';
    }
    if (formData.tglBayar && st !== 'dibayar') {
      st = 'dibayar';
    }

    const payload = {
      ...formData,
      status: st,
      totalHitungan,
      totalNota: formData.totalNota !== '' ? Number(formData.totalNota) : null,
      diskon: Number(formData.diskon) || 0,
      ongkir: Number(formData.ongkir) || 0,
      biaya: Number(formData.biaya) || 0,
      items: formData.items.map(it => {
        const hrg = Number(it.hargaSatuan ?? it.harga ?? it.harga_satuan ?? 0);
        return {
          ...it,
          qty: Number(it.qty) || 1,
          hargaSatuan: hrg,
          harga: hrg // kompatibilitas dengan backend SQLite/MySQL
        };
      })
    };

    setIsSubmitting(true);
    try {
      const ok = await onSave(payload);
      if (ok) {
        // Hapus draft jika sukses tersimpan
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch (err) {}
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[90vh] flex flex-col border border-slate-200 overflow-hidden">

        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initialData ? 'Edit Data Pembelian' : 'Catat Pembelian Baru'}
            </h2>
            <p className="text-xs text-slate-500">
              Unggah foto nota untuk isi otomatis dengan AI, atau isi manual di bawah.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="formPembelian" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Section 1: Upload Foto & AI Scan */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Foto Nota / Bukti Pembelian
              </span>
              {aiActive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  AI Siap Baca Nota Otomatis
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-teal-500 bg-white hover:bg-teal-50/30 rounded-xl py-3 px-4 text-xs font-semibold text-slate-700 cursor-pointer transition">
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Pilih Foto Nota (Kamera / File)</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              {formData.fotoNota && (
                <div className="relative group w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200">
                  <img src={resolveImageUrl(formData.fotoNota)} alt="Preview Nota" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, fotoNota: '' }))}
                    className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {isScanning && (
              <div className="mt-3 text-xs text-teal-700 flex items-center gap-2 bg-teal-50 p-2 rounded-lg">
                <span className="animate-spin text-sm">⏳</span> Sedang membaca data dari foto nota via AI...
              </div>
            )}

            {scanError && (
              <div className="mt-3 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {scanError}
              </div>
            )}
          </div>

          {/* Section 2: Info Dasar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Nota</label>
              <input
                type="date"
                required
                value={formData.tanggal}
                onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Toko</label>
              <input
                type="text"
                required
                placeholder="Contoh: Toko Jaya Abadi"
                value={formData.toko}
                onChange={e => setFormData({ ...formData, toko: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Peruntukan (Cabang/Divisi)</label>
              <select
                value={formData.peruntukan}
                onChange={e => setFormData({ ...formData, peruntukan: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                {master.peruntukan?.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tempat Beli</label>
              <select
                value={formData.platform}
                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                {master.platform?.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Pesanan / Invoice</label>
              <input
                type="text"
                placeholder="INV/2026/..."
                value={formData.noPesanan}
                onChange={e => setFormData({ ...formData, noPesanan: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Section 3: Rincian Barang Dinamis */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Rincian Barang</span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:bg-teal-50 px-2 py-1 rounded transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Barang
              </button>
            </div>

            <div className="space-y-2">
              {formData.items.map((it, idx) => (
                <div key={it.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    required
                    placeholder="Nama barang..."
                    value={it.nama}
                    onChange={e => handleItemChange(idx, 'nama', e.target.value)}
                    className="flex-1 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Qty"
                    value={it.qty}
                    onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                    className="w-16 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="text"
                    placeholder="Satuan"
                    value={it.satuan}
                    onChange={e => handleItemChange(idx, 'satuan', e.target.value)}
                    className="w-16 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Harga Satuan"
                    value={it.hargaSatuan}
                    onChange={e => handleItemChange(idx, 'hargaSatuan', e.target.value)}
                    className="w-28 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 text-right"
                  />
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Biaya, Diskon, & Total */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Diskon / Potongan</label>
              <input
                type="number"
                min="0"
                value={formData.diskon}
                onChange={e => setFormData({ ...formData, diskon: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ongkos Kirim</label>
              <input
                type="number"
                min="0"
                value={formData.ongkir}
                onChange={e => setFormData({ ...formData, ongkir: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Biaya Layanan/Admin</label>
              <input
                type="number"
                min="0"
                value={formData.biaya}
                onChange={e => setFormData({ ...formData, biaya: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total di Nota</label>
              <input
                type="number"
                placeholder={totalHitungan.toString()}
                value={formData.totalNota}
                onChange={e => setFormData({ ...formData, totalNota: e.target.value })}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Notifikasi Selisih */}
          {adaSelisih && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Hitungan sistem: <b>{formatRupiah(totalHitungan)}</b>, tertulis di nota: <b>{formatRupiah(Number(formData.totalNota))}</b> (Selisih: {formatRupiah(Math.abs(Number(formData.totalNota) - totalHitungan))})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, totalNota: totalHitungan })}
                className="text-teal-700 hover:underline font-semibold text-[11px] cursor-pointer"
              >
                Samakan ke hitungan
              </button>
            </div>
          )}

          {/* Section 5: Pembayaran & Status */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sumber Dana / Akun Bayar</label>
                <select
                  value={formData.akun}
                  onChange={e => setFormData({ ...formData, akun: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">-- Belum Diproses (Pilih Akun) --</option>
                  {master.akun?.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Bayar</label>
                <select
                  value={formData.metode}
                  onChange={e => setFormData({ ...formData, metode: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {master.metode?.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Transaksi</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="belum">Belum diproses</option>
                  <option value="diproses">Diproses</option>
                  <option value="dibayar">Dibayar (Lunas)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Lunas (Jika Dibayar)</label>
                <input
                  type="date"
                  value={formData.tglBayar}
                  onChange={e => setFormData({ ...formData, tglBayar: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* Field Keterangan / Catatan Tambahan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan / Catatan Tambahan</label>
              <textarea
                rows="2"
                placeholder="Catatan tambahan keperluan nota..."
                value={formData.keterangan}
                onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
              />
            </div>
          </div>
        </form>

        {/* STICKY FOOTER MODAL (Di Luar Scroll Body) */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Total hitungan: <b className="text-slate-900 text-sm">{formatRupiah(totalHitungan)}</b>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              form="formPembelian"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pembelian'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
