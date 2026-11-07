import React, { useState, useEffect } from 'react';
import StatusCards from './components/StatusCards';
import FilterBar from './components/FilterBar';
import TabelTransaksi from './components/TabelTransaksi';
import FormPembelianModal from './components/FormPembelianModal';
import MasterDataModal from './components/MasterDataModal';
import BackupRestoreModal from './components/BackupRestoreModal';
import SettingsDrawer from './components/SettingsDrawer';
import LaporanPdfModal from './components/LaporanPdfModal';
import { api, DEFAULT_MASTER } from './services/api';
import { Plus, Sparkles, Smartphone, Menu, RefreshCw, Settings, Printer } from 'lucide-react';

export default function App() {
  const [pembelian, setPembelian] = useState([]);
  const [master, setMaster] = useState(DEFAULT_MASTER);
  const [aiActive, setAiActive] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [isServer, setIsServer] = useState(false);
  const [loading, setLoading] = useState(true);

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [peruntukanFilter, setPeruntukanFilter] = useState('');
  const [bulanFilter, setBulanFilter] = useState('');

  // Server-side State
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [serverStats, setServerStats] = useState(null);

  // Modals & Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  // Load Initial Data & PWA Listener
  useEffect(() => {
    loadData();

    // Event listener sebelum browser menampilkan prompt install PWA
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  const loadData = async () => {
    setLoading(true);
    const data = await api.getInitialState();
    setMaster(data.master || DEFAULT_MASTER);
    setAiActive(data.aiActive);
    setAiApiKey(data.aiApiKey || '');
    setIsServer(data.isServer);

    if (data.isServer) {
      await fetchServerPembelian(1);
    } else {
      setPembelian(data.pembelian || []);
      setLoading(false);
    }
  };

  const fetchServerPembelian = async (targetPage = 1) => {
    setLoading(true);
    const res = await api.getPembelianServer({
      page: targetPage,
      limit: 20,
      search,
      status: statusFilter,
      kategori: kategoriFilter,
      peruntukan: peruntukanFilter,
      bulan: bulanFilter
    });

    if (res && res.isServer) {
      setPembelian(res.data);
      setPagination(res.pagination);
      setServerStats(res.stats);
      setPage(targetPage);
    }
    setLoading(false);
  };

  // Trigger server-side fetch saat filter berubah
  useEffect(() => {
    if (isServer) {
      const timer = setTimeout(() => {
        fetchServerPembelian(1);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search, statusFilter, kategoriFilter, peruntukanFilter, bulanFilter, isServer]);

  // Save Item
  const handleSaveItem = async (itemData) => {
    try {
      // 1. Simpan ke database / server terlebih dahulu
      await api.savePembelian(itemData);

      // 2. Jika sukses tersimpan di server
      const existingIndex = pembelian.findIndex(p => p.id === itemData.id);
      let updatedList;
      if (existingIndex >= 0) {
        updatedList = [...pembelian];
        updatedList[existingIndex] = itemData;
      } else {
        updatedList = [itemData, ...pembelian];
      }

      setPembelian(updatedList);
      api.saveToLocal(updatedList, master);

      if (isServer) {
        await fetchServerPembelian(page);
      }
      setIsModalOpen(false);
      setSelectedItem(null);
      return true;
    } catch (err) {
      console.error('Error saat menyimpan transaksi:', err);
      // Fallback: simpan di lokal dan beritahu user
      const existingIndex = pembelian.findIndex(p => p.id === itemData.id);
      let updatedList;
      if (existingIndex >= 0) {
        updatedList = [...pembelian];
        updatedList[existingIndex] = itemData;
      } else {
        updatedList = [itemData, ...pembelian];
      }
      setPembelian(updatedList);
      api.saveToLocal(updatedList, master);

      alert(`Peringatan: Gagal menyimpan data ke database server (${err.message || 'Koneksi terputus'}). Form tetap disimpan di perangkat Anda agar tidak perlu input ulang.`);
      // Form modal TIDAK DITUTUP agar user tidak kehilangan context dan bisa coba lagi
      return false;
    }
  };


  // Quick Pay / Lunasi Transaksi Langsung dari Tabel
  const handleQuickPay = async (item) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultAkun = item.akun || master.akun?.[0] || 'DBS ****4648';
    const updated = {
      ...item,
      status: 'dibayar',
      akun: defaultAkun,
      tglBayar: item.tglBayar || today,
      tglProses: item.tglProses || today
    };
    await handleSaveItem(updated);
  };

  // Delete Item
  const handleDeleteItem = async (id) => {
    if (!confirm('Yakin ingin menghapus data pembelian ini?')) return;
    try {
      await api.deletePembelian(id);
      const updated = pembelian.filter(p => p.id !== id);
      setPembelian(updated);
      api.saveToLocal(updated, master);
      if (isServer) {
        await fetchServerPembelian(page);
      }
    } catch (err) {
      alert(`Gagal menghapus data: ${err.message || 'Terjadi kesalahan sistem'}`);
    }
  };

  // Save Master
  const handleSaveMaster = async (updatedMaster) => {
    setMaster(updatedMaster);
    api.saveToLocal(pembelian, updatedMaster);
    await api.saveMaster(updatedMaster);
  };

  // Save AI Token ke database server
  const handleSaveAiKey = async (newKey) => {
    setAiApiKey(newKey);
    setAiActive(!!newKey);
    await api.saveAiConfig(newKey);
  };

  // On Restored
  const handleRestored = (restoredPembelian, restoredMaster) => {
    setPembelian(restoredPembelian);
    setMaster(restoredMaster);
  };

  // Export Excel (CSV dengan BOM UTF-8 agar rapi dibuka di Microsoft Excel)
  const handleExportCSV = async () => {
    let itemsToExport = [];

    if (isServer) {
      // Ambil seluruh data sesuai filter aktif tanpa batasan halaman (limit 10000)
      setLoading(true);
      try {
        const res = await api.getPembelianServer({
          page: 1,
          limit: 10000,
          search,
          status: statusFilter,
          kategori: kategoriFilter,
          peruntukan: peruntukanFilter,
          bulan: bulanFilter
        });
        itemsToExport = res?.data || [];
      } catch (e) {
        itemsToExport = pembelian;
      } finally {
        setLoading(false);
      }
    } else {
      itemsToExport = filteredItems;
    }

    if (itemsToExport.length === 0) return alert('Tidak ada data untuk diexport.');

    // Urutkan seperti tampilan preview (prioritas belum bayar di atas, lalu tanggal terbaru)
    const sorted = [...itemsToExport].sort((a, b) => {
      const getPriority = (st) => (st === 'belum' ? 1 : st === 'diproses' ? 2 : 3);
      const prioA = getPriority(a.status || 'belum');
      const prioB = getPriority(b.status || 'belum');
      if (prioA !== prioB) return prioA - prioB;
      const tA = a.tanggal || '';
      const tB = b.tanggal || '';
      if (tA !== tB) return tB.localeCompare(tA);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const escapeCsv = (str) => {
      if (str == null) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const headers = [
      'Tanggal',
      'Tipe Transaksi',
      'Toko / Penerima',
      'Tempat Beli / Kanal',
      'No Pesanan / Referensi',
      'Peruntukan',
      'Rincian Barang / Upah',
      'Total Nota',
      'Status Pembayaran',
      'Sumber Dana',
      'Tanggal Lunas',
      'Keterangan'
    ].join(',');

    let grandTotal = 0;
    const rows = sorted.map(p => {
      const totalAmount = Number(p.totalNota ?? p.totalHitungan ?? 0);
      grandTotal += totalAmount;

      const rincianStr = (p.items || []).map(it => {
        const hrg = Number(it.hargaSatuan ?? it.harga ?? 0);
        return `${it.nama || ''} (${it.qty || 1} ${it.satuan || ''} @ ${hrg})`;
      }).join('; ');

      const statusLabel = p.status === 'dibayar' 
        ? 'Dibayar' 
        : p.status === 'diproses' 
        ? 'Diproses' 
        : 'Belum diproses';

      const tipeLabel = p.kategori === 'gaji' ? 'Gaji Karyawan' : 'Pembelian Barang';

      return [
        escapeCsv(p.tanggal),
        escapeCsv(tipeLabel),
        escapeCsv(p.toko),
        escapeCsv(p.platform),
        escapeCsv(p.noPesanan),
        escapeCsv(p.peruntukan),
        escapeCsv(rincianStr),
        totalAmount,
        escapeCsv(statusLabel),
        escapeCsv(p.akun),
        escapeCsv(p.tglBayar),
        escapeCsv(p.keterangan)
      ].join(',');
    });

    // Baris Total di bagian akhir (seperti tfoot pada tabel preview)
    const totalRow = [
      escapeCsv('TOTAL KESELURUHAN'),
      '""',
      '""',
      '""',
      '""',
      '""',
      escapeCsv(`${sorted.length} Transaksi`),
      grandTotal,
      '""',
      '""',
      '""',
      '""'
    ].join(',');

    // Gunakan UTF-8 BOM (\uFEFF) agar Microsoft Excel langsung membaca karakter dan koma dengan tepat
    const csvContent = '\uFEFF' + [headers, ...rows, totalRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterTag = bulanFilter ? `-${bulanFilter}` : '';
    a.download = `rekap-kost-g23${filterTag}-${dateStr}.csv`;
    a.click();
  };

  // Filtered Items (client-side fallback / local mode)
  const filteredItems = pembelian
    .filter(item => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (kategoriFilter && (item.kategori || 'barang') !== kategoriFilter) return false;
      if (peruntukanFilter && item.peruntukan !== peruntukanFilter) return false;
      if (bulanFilter && (!item.tanggal || !item.tanggal.startsWith(bulanFilter))) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchToko = (item.toko || '').toLowerCase().includes(q);
        const matchNo = (item.noPesanan || '').toLowerCase().includes(q);
        const matchBarang = (item.items || []).some(it => (it.nama || '').toLowerCase().includes(q));
        if (!matchToko && !matchNo && !matchBarang) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Prioritaskan yang belum lunas (belum, diproses) di atas
      const getPriority = (st) => (st === 'belum' ? 1 : st === 'diproses' ? 2 : 3);
      const prioA = getPriority(a.status || 'belum');
      const prioB = getPriority(b.status || 'belum');
      if (prioA !== prioB) return prioA - prioB;
      const tA = a.tanggal || '';
      const tB = b.tanggal || '';
      if (tA !== tB) return tB.localeCompare(tA);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  return (
    <div className="min-h-screen pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              G23
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">SISTEM REKAP KOST G23</h1>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>{isServer ? 'Tersambung ke Server' : 'Mode Offline'}</span>
                {aiActive ? (
                  <span className="text-teal-600 font-semibold flex items-center gap-0.5">
                    • <Sparkles className="w-3 h-3 inline" /> AI Aktif
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal">
                    • AI Belum Disetting
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Install PWA */}
            {canInstall && (
              <button
                onClick={handleInstallPWA}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs animate-pulse"
                title="Pasang aplikasi di layar utama PC / HP"
              >
                <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                <span>Pasang Aplikasi</span>
              </button>
            )}

            {/* Tombol Data Master Langsung di Navbar */}
            <button
              onClick={() => setIsMasterOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-200/80 shadow-2xs"
              title="Kelola Cabang, Rekening Bayar & Tempat Belanja"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Data Master</span>
            </button>

            {/* Tombol Cetak / PDF Laporan */}
            <button
              onClick={() => setIsPdfOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-200/80 shadow-2xs"
              title="Cetak atau Simpan Laporan PDF dengan Rincian Mingguan"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Cetak PDF</span>
            </button>

            {/* Tombol Menu & Pengaturan */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-200/80 shadow-2xs"
              title="Menu Pengaturan, Token Gemini, WhatsApp, Master & Cadangan"
            >
              <Menu className="w-4 h-4 text-slate-600" />
              <span>Menu & Pengaturan</span>
            </button>

            {/* Tombol Tambah Transaksi */}
            <button
              onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 px-4 py-2 rounded-xl shadow-sm hover:shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Catat Pembelian
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 print:hidden">
        {/* Status Signature Cards */}
        <StatusCards
          items={pembelian}
          serverStats={serverStats}
          activeStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />

        {/* Filter Toolbar */}
        <FilterBar
          search={search}
          setSearch={setSearch}
          kategori={kategoriFilter}
          setKategori={setKategoriFilter}
          peruntukan={peruntukanFilter}
          setPeruntukan={setPeruntukanFilter}
          bulan={bulanFilter}
          setBulan={setBulanFilter}
          masterPeruntukan={master.peruntukan || []}
          onReset={() => { setSearch(''); setKategoriFilter(''); setPeruntukanFilter(''); setBulanFilter(''); setStatusFilter(''); }}
        />

        {/* Tabel Rekap */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
            <p className="text-xs">Memuat data transaksi...</p>
          </div>
        ) : (
          <TabelTransaksi
            items={isServer ? pembelian : filteredItems}
            pagination={isServer ? pagination : null}
            onPageChange={fetchServerPembelian}
            onEdit={(item) => { setSelectedItem(item); setIsModalOpen(true); }}
            onDelete={handleDeleteItem}
            onQuickPay={handleQuickPay}
          />
        )}
      </main>

      {/* Modal Form Tambah/Edit */}
      <FormPembelianModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedItem(null); }}
        initialData={selectedItem}
        master={master}
        onSave={handleSaveItem}
        aiActive={aiActive}
        aiApiKey={aiApiKey}
      />

      {/* Modal Kelola Data Master */}
      <MasterDataModal
        isOpen={isMasterOpen}
        onClose={() => setIsMasterOpen(false)}
        master={master}
        onSaveMaster={handleSaveMaster}
      />

      {/* Modal Cadangkan & Pulihkan (Backup & Restore) */}
      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        pembelian={pembelian}
        master={master}
        onRestored={handleRestored}
      />

      {/* Drawer Menu & Pengaturan */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        pembelian={pembelian}
        filteredItems={filteredItems}
        filterInfo={{ peruntukan: peruntukanFilter, bulan: bulanFilter }}
        master={master}
        aiApiKey={aiApiKey}
        onSaveAiKey={handleSaveAiKey}
        onOpenMaster={() => setIsMasterOpen(true)}
        onOpenBackupRestore={() => setIsBackupOpen(true)}
        onExportCSV={handleExportCSV}
        onOpenPdf={() => setIsPdfOpen(true)}
      />

      {/* Modal Cetak & Ekspor PDF */}
      <LaporanPdfModal
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
        items={isServer ? pembelian : filteredItems}
        filterInfo={{
          bulan: bulanFilter,
          peruntukan: peruntukanFilter,
          kategori: kategoriFilter,
          status: statusFilter
        }}
      />
    </div>
  );
}
