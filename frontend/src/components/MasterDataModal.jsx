import React, { useState } from 'react';
import { X, Plus, Trash2, Settings, ShieldCheck } from 'lucide-react';

const MASTER_CATEGORIES = [
  {
    key: 'peruntukan',
    title: 'Peruntukan (Cabang / Divisi)',
    desc: 'Cabang atau divisi yang memakai barang (misal: G22, G23, Dapur, Operasional).'
  },
  {
    key: 'akun',
    title: 'Sumber Dana / Rekening Bayar',
    desc: 'Rekening bank atau kartu kredit untuk pembayaran (misal: DBS ****4648, BCA Operasional).'
  },
  {
    key: 'platform',
    title: 'Tempat Pembelian / Platform',
    desc: 'Platform toko pembelian (misal: Tokopedia, Shopee, Toko Offline).'
  },
  {
    key: 'metode',
    title: 'Metode Pembayaran',
    desc: 'Cara pembayaran yang digunakan (misal: Transfer Bank, Kartu Kredit, QRIS).'
  }
];

export default function MasterDataModal({ isOpen, onClose, master, onSaveMaster }) {
  const [data, setData] = useState(master);
  const [inputs, setInputs] = useState({});

  if (!isOpen) return null;

  const handleAdd = (key) => {
    const val = (inputs[key] || '').trim();
    if (!val) return;
    const currentList = data[key] || [];
    if (currentList.some(item => item.toLowerCase() === val.toLowerCase())) {
      alert('Isian tersebut sudah ada!');
      return;
    }
    const updated = { ...data, [key]: [...currentList, val] };
    setData(updated);
    setInputs(prev => ({ ...prev, [key]: '' }));
    onSaveMaster(updated);
  };

  const handleRemove = (key, index) => {
    const currentList = data[key] || [];
    const updatedList = currentList.filter((_, i) => i !== index);
    const updated = { ...data, [key]: updatedList };
    setData(updated);
    onSaveMaster(updated);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-auto border border-slate-200">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Kelola Data Master</h2>
              <p className="text-xs text-slate-500">Atur peruntukan cabang, rekening sumber dana, dan platform belanja.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {MASTER_CATEGORIES.map(cat => {
            const list = data[cat.key] || [];
            return (
              <div key={cat.key} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
                <div className="mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{cat.title}</h3>
                  <p className="text-[11px] text-slate-500">{cat.desc}</p>
                </div>

                {/* Chips Item */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {list.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Belum ada data</span>
                  ) : (
                    list.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium shadow-2xs"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => handleRemove(cat.key, idx)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition"
                          title={`Hapus ${item}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Form Tambah */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAdd(cat.key); }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder={`Tambah ${cat.title.toLowerCase()}...`}
                    value={inputs[cat.key] || ''}
                    onChange={(e) => setInputs({ ...inputs, [cat.key]: e.target.value })}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            Tersimpan otomatis ke database
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition cursor-pointer"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
