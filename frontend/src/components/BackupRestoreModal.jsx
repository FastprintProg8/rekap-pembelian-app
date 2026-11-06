import React, { useState } from 'react';
import { X, Upload, Download, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export default function BackupRestoreModal({ isOpen, onClose, pembelian, master, onRestored }) {
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  if (!isOpen) return null;

  // 1. Download Backup JSON
  const handleDownloadBackup = () => {
    const backupData = {
      pembelian,
      master,
      mig: 2,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadangan-rekap-pembelian-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 2. Upload / Restore JSON File
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMsg('');
    setIsError(false);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data.pembelian) || !data.master) {
        throw new Error('Format file cadangan tidak sesuai.');
      }

      if (!confirm(`Pulihkan ${data.pembelian.length} transaksi dari file cadangan ini ke database? Data yang ada saat ini akan diperbarui.`)) {
        setImporting(false);
        return;
      }

      // Sync ke backend dan local
      await api.restoreBackup(data);
      onRestored(data.pembelian, data.master);
      setMsg(`Berhasil memulihkan ${data.pembelian.length} data pembelian dan master konfigurasi!`);
    } catch (err) {
      setIsError(true);
      setMsg(err.message || 'Gagal membaca atau memulihkan file cadangan.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col my-auto border border-slate-200">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cadangkan & Pulihkan Data</h2>
              <p className="text-xs text-slate-500">Backup dan restore file JSON lengkap beserta foto nota</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          
          {/* Card Download */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
              1. Buat File Cadangan (.JSON)
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Simpan seluruh data transaksi ({pembelian.length} nota), data master, dan foto bukti pembayaran ke dalam 1 file cadangan.
            </p>
            <button
              onClick={handleDownloadBackup}
              className="px-4 py-2 text-xs font-bold text-teal-700 bg-white hover:bg-teal-50 border border-teal-300 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4" /> Unduh File Cadangan JSON
            </button>
          </div>

          {/* Card Upload */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
              2. Pulihkan Dari File Cadangan
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Pilih file cadangan JSON yang Anda miliki (misal dari HP atau PC lain) untuk dimasukkan ke database ini.
            </p>
            
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition cursor-pointer shadow-2xs">
              <Upload className="w-4 h-4" />
              <span>{importing ? 'Memproses File...' : 'Pilih File Cadangan JSON'}</span>
              <input type="file" accept=".json" onChange={handleFileUpload} disabled={importing} className="hidden" />
            </label>
          </div>

          {/* Notifikasi Status */}
          {msg && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              isError 
                ? 'bg-rose-50 border-rose-200 text-rose-700' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
              <span>{msg}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            Kompatibel dengan format backup Rekap Pembelian
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
