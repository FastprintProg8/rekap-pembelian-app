import React, { useState } from 'react';
import { X, Copy, Check, FileSpreadsheet, Database, Settings, KeyRound, MessageSquare } from 'lucide-react';
import { formatRupiah, formatTanggal } from '../utils/formatters';

export default function SettingsDrawer({
  isOpen,
  onClose,
  pembelian = [],
  filteredItems = [],
  filterInfo = {},
  master = {},
  aiApiKey = '',
  onSaveAiKey,
  onOpenMaster,
  onOpenBackupRestore,
  onExportCSV
}) {
  const [copied, setCopied] = useState(false);
  const [keyInput, setKeyInput] = useState(aiApiKey || '');
  const [keySaved, setKeySaved] = useState(false);

  // Sinkronkan keyInput jika prop berubah
  React.useEffect(() => {
    setKeyInput(aiApiKey || '');
  }, [aiApiKey, isOpen]);

  if (!isOpen) return null;

  // Handler Simpan Kunci Gemini ke Database Server
  const handleSaveKey = async (e) => {
    e.preventDefault();
    await onSaveAiKey(keyInput.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  // Generate Ringkasan Teks untuk WhatsApp
  const generateWaText = () => {
    let lines = [];
    lines.push('📋 *REKAP PEMBELIAN*');
    if (filterInfo.peruntukan) lines.push(`Peruntukan: ${filterInfo.peruntukan}`);
    if (filterInfo.bulan) lines.push(`Periode: ${filterInfo.bulan}`);
    lines.push(`Total Item: ${filteredItems.length} transaksi`);
    lines.push('-----------------------------');

    let totalNominal = 0;
    filteredItems.forEach((p, idx) => {
      const amount = Number(p.totalNota ?? p.totalHitungan ?? 0);
      totalNominal += amount;
      const statusIcon = p.status === 'dibayar' ? '✅' : p.status === 'diproses' ? '⏳' : '⚠️';
      lines.push(`${idx + 1}. ${formatTanggal(p.tanggal)} - *${p.toko}* (${p.peruntukan || '-'})`);
      if (p.items?.length > 0) {
        p.items.forEach(it => {
          lines.push(`   • ${it.nama} (${it.qty} ${it.satuan || ''})`);
        });
      }
      lines.push(`   Nominal: *${formatRupiah(amount)}* [${statusIcon} ${p.status?.toUpperCase()}]`);
      if (p.akun) lines.push(`   Sumber dana: ${p.akun}`);
      lines.push('');
    });

    lines.push('-----------------------------');
    lines.push(`*TOTAL: ${formatRupiah(totalNominal)}*`);
    return lines.join('\n');
  };

  const waText = generateWaText();

  const handleCopyWA = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      alert('Gagal menyalin otomatis, silakan blok dan copy teks manual.');
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div onClick={e => e.stopPropagation()} className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        
        {/* Header Drawer */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pengaturan & Peralatan</h2>
              <p className="text-xs text-slate-500">Konfigurasi AI Token, Ekspor, Master, dan Cadangan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. Kunci API Gemini (Disimpan ke Database Server) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                API Key Google Gemini (AI OCR)
              </span>
              {aiApiKey && (
                <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
                  Tersimpan di Database
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Kunci API disimpan ke tabel master_config database. Digunakan untuk membaca foto nota otomatis.
            </p>
            <form onSubmit={handleSaveKey} className="space-y-2">
              <input
                type="password"
                placeholder="Tempel Kunci API (AIzaSy...)"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                autoComplete="off"
              />
              <div className="flex items-center justify-between">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-teal-700 hover:underline font-semibold"
                >
                  Dapatkan Kunci Gratis →
                </a>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  {keySaved ? <Check className="w-3.5 h-3.5" /> : null}
                  {keySaved ? 'Tersimpan ke DB!' : 'Simpan Kunci ke DB'}
                </button>
              </div>
            </form>
          </div>

          {/* 2. Ringkasan WhatsApp */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                Salin Ringkasan (WhatsApp)
              </span>
              <button
                onClick={handleCopyWA}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 bg-white hover:bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg transition shadow-2xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Tersalin!' : 'Salin Teks'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Format teks rekapitulasi otomatis sesuai filter cabang & periode yang sedang aktif.
            </p>
            <textarea
              readOnly
              value={waText}
              className="w-full h-32 text-[11px] font-mono bg-white border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none resize-none"
            />
          </div>

          {/* 3. Menu Aksi Cepat */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Peralatan Data</h3>
            
            {/* Export CSV */}
            <button
              onClick={() => { onClose(); onExportCSV(); }}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Ekspor ke Excel (CSV)</div>
                  <div className="text-[11px] text-slate-500">Unduh data tabel dalam format spreadsheet</div>
                </div>
              </div>
            </button>

            {/* Cadangan & Pulihkan */}
            <button
              onClick={() => { onClose(); onOpenBackupRestore(); }}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Cadangkan & Pulihkan (.JSON)</div>
                  <div className="text-[11px] text-slate-500">Backup seluruh data transaksi dan foto nota</div>
                </div>
              </div>
            </button>

            {/* Kelola Data Master */}
            <button
              onClick={() => { onClose(); onOpenMaster(); }}
              className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Kelola Data Master</div>
                  <div className="text-[11px] text-slate-500">Cabang, rekening sumber dana, dan toko platform</div>
                </div>
              </div>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-[11px] text-slate-400">Rekap Pembelian Sistem • Modern Clean Edition</p>
        </div>

      </div>
    </div>
  );
}
