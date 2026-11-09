import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Sparkles, Upload, AlertTriangle, Check, Camera, ZoomIn } from 'lucide-react';
import { formatRupiah, hitungTotalHitungan, generateId, resolveImageUrl } from '../utils/formatters';
import ImagePreviewModal from './ImagePreviewModal';
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
    kategori: 'barang', // 'barang' | 'gaji'
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
    buktiBayar: '',
    items: [{ id: '1', nama: '', qty: 1, satuan: 'pcs', hargaSatuan: 0 }]
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

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
        kategori: initialData.kategori || 'barang',
        diskon: initialData.diskon || 0,
        ongkir: initialData.ongkir || 0,
        biaya: initialData.biaya || 0,
        totalNota: initialData.totalNota !== null ? initialData.totalNota : '',
        fotoNota: initialData.fotoNota || '',
        buktiBayar: initialData.buktiBayar || '',
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
            setFormData({
              ...parsed,
              kategori: parsed.kategori || 'barang'
            });
            restoredFromDraft = true;
          }
        }
      } catch (e) {}

      if (!restoredFromDraft) {
        setFormData({
          id: generateId(),
          kategori: 'barang',
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
          buktiBayar: '',
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
    const defaultSatuan = formData.kategori === 'gaji' ? 'hari' : 'pcs';
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), nama: '', qty: 1, satuan: defaultSatuan, hargaSatuan: 0 }]
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
            kategori: result.kategori || prev.kategori || 'barang',
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
                satuan: it.satuan || (result.kategori === 'gaji' ? 'org' : 'pcs'),
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

  // Upload Bukti Bayar / Pelunasan
  const handleBuktiBayarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, buktiBayar: reader.result }));
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

          {/* Tipe Transaksi: Pembelian Barang vs Gaji Karyawan */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tipe Pengeluaran / Transaksi:
            </span>
            <div className="inline-flex p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  kategori: 'barang',
                  items: prev.items.map(it => ({
                    ...it,
                    satuan: (it.satuan === 'hari' || it.satuan === 'bulan' || it.satuan === 'hr' || it.satuan === 'bln') ? 'pcs' : it.satuan
                  }))
                }))}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  formData.kategori === 'barang'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 Pembelian Barang
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  kategori: 'gaji',
                  items: prev.items.map(it => ({
                    ...it,
                    satuan: (it.satuan === 'pcs' || !it.satuan) ? 'hari' : it.satuan
                  }))
                }))}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  formData.kategori === 'gaji'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💼 Gaji / Upah Karyawan
              </button>
            </div>
          </div>

          {/* Section 1: Upload Foto & AI Scan */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                {formData.kategori === 'gaji' ? 'Foto Slip / Bukti Transfer Gaji' : 'Foto Nota / Bukti Pembelian'}
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
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    onClick={() => setPreviewImage({
                      src: formData.fotoNota,
                      title: `Preview Nota: ${formData.toko || 'Nota Pembelian'}`
                    })}
                    className="relative group w-16 h-16 rounded-xl overflow-hidden border-2 border-teal-500/40 cursor-pointer shadow-xs hover:ring-2 hover:ring-teal-400 transition"
                    title="Klik untuk melihat preview besar"
                  >
                    <img src={resolveImageUrl(formData.fotoNota)} alt="Preview Nota" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <ZoomIn className="w-5 h-5 drop-shadow" />
                    </div>
                  </div>

                  {/* Tombol Hapus Foto di Bawah Preview */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, fotoNota: '' }))}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                    title="Hapus Foto Nota"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {formData.kategori === 'gaji' ? 'Tanggal Pembayaran / Slip' : 'Tanggal Nota'}
              </label>
              <input
                type="date"
                required
                value={formData.tanggal}
                onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {formData.kategori === 'gaji' ? 'Karyawan / Bagian' : 'Nama Toko'}
              </label>
              <input
                type="text"
                required
                placeholder={formData.kategori === 'gaji' ? 'Contoh: Nanang / Tim Finishing' : 'Contoh: Toko Jaya Abadi'}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {formData.kategori === 'gaji' ? 'Kategori Gaji / Kanal' : 'Tempat Beli'}
              </label>
              <select
                value={formData.platform}
                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                {formData.kategori === 'gaji' && (
                  <>
                    <option value="Gaji Pokok">Gaji Pokok</option>
                    <option value="Upah Borongan">Upah Borongan</option>
                    <option value="Upah Harian">Upah Harian</option>
                    <option value="Lembur">Lembur</option>
                    <option value="Insentif / Bonus">Insentif / Bonus</option>
                  </>
                )}
                {master.platform?.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {formData.kategori === 'gaji' ? 'No. Referensi / Bukti Transfer' : 'Nomor Pesanan / Invoice'}
              </label>
              <input
                type="text"
                placeholder={formData.kategori === 'gaji' ? 'No. Referensi TF...' : 'INV/2026/...'}
                value={formData.noPesanan}
                onChange={e => setFormData({ ...formData, noPesanan: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Section 3: Rincian Barang / Gaji Dinamis */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {formData.kategori === 'gaji' ? 'Rincian Gaji / Upah Karyawan' : 'Rincian Barang'}
              </span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:bg-teal-50 px-2 py-1 rounded transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> {formData.kategori === 'gaji' ? 'Tambah Rincian Upah' : 'Tambah Barang'}
              </button>
            </div>

            <div className="space-y-2">
              {formData.items.map((it, idx) => (
                <div key={it.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    required
                    placeholder={formData.kategori === 'gaji' ? 'Nama karyawan / pos upah...' : 'Nama barang...'}
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
                  {formData.kategori === 'gaji' ? (
                    <select
                      value={it.satuan || 'hari'}
                      onChange={e => handleItemChange(idx, 'satuan', e.target.value)}
                      className="w-20 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                    >
                      <option value="hari">hari</option>
                      <option value="bulan">bulan</option>
                      <option value="minggu">minggu</option>
                      <option value="jam">jam</option>
                      <option value="borongan">borongan</option>
                      <option value="orang">orang</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Satuan"
                      value={it.satuan}
                      onChange={e => handleItemChange(idx, 'satuan', e.target.value)}
                      className="w-16 text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  )}
                  <input
                    type="number"
                    min="0"
                    placeholder={formData.kategori === 'gaji' ? 'Nominal Upah' : 'Harga Satuan'}
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

            {/* Total / Subtotal Rincian di bagian bawah list rincian */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-white/70 px-3 py-2 rounded-lg">
              <span className="font-semibold">
                {formData.kategori === 'gaji' ? 'Total Upah / Gaji:' : 'Total Harga Barang:'}
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {formatRupiah(formData.items.reduce((acc, it) => acc + ((Number(it.qty) || 1) * (Number(it.hargaSatuan ?? it.harga ?? it.harga_satuan ?? 0))), 0))}
              </span>
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

            {/* Upload Bukti Pembayaran / Pelunasan (buktiBayar) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  Bukti Pembayaran / Transfer Pelunasan
                </label>
                <span className="text-[11px] text-slate-400">Opsional (Struk ATM, M-Banking, dll)</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-teal-500 bg-white hover:bg-teal-50/30 rounded-xl py-2.5 px-3 text-xs font-semibold text-slate-700 cursor-pointer transition">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>{formData.buktiBayar ? 'Ganti Foto Bukti Bayar' : 'Pilih Foto Bukti Bayar / Transfer'}</span>
                  <input type="file" accept="image/*" onChange={handleBuktiBayarUpload} className="hidden" />
                </label>

                {formData.buktiBayar && (
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div
                      onClick={() => setPreviewImage({
                        src: formData.buktiBayar,
                        title: `Bukti Bayar: ${formData.toko || 'Transaksi'} (${formData.akun || 'Lunas'})`
                      })}
                      className="relative group w-14 h-14 rounded-xl overflow-hidden border-2 border-blue-500/40 cursor-pointer shadow-xs hover:ring-2 hover:ring-blue-400 transition"
                      title="Klik untuk melihat preview besar"
                    >
                      <img src={resolveImageUrl(formData.buktiBayar)} alt="Preview Bukti Bayar" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <ZoomIn className="w-4 h-4 drop-shadow" />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, buktiBayar: '' }))}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                      title="Hapus Bukti Bayar"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0 gap-2">
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

      {/* Modal Preview Gambar Besar */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        src={previewImage?.src}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
