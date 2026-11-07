import React from 'react';
import { Search, Filter, X } from 'lucide-react';

export default function FilterBar({
  search, setSearch,
  kategori, setKategori,
  peruntukan, setPeruntukan,
  bulan, setBulan,
  masterPeruntukan = [],
  onReset
}) {
  const hasFilter = search || kategori || peruntukan || bulan;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm mb-6 flex flex-wrap gap-3 items-center justify-between">
      <div className="flex flex-1 min-w-[240px] items-center relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari toko, barang, nomor pesanan..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Filter Tipe Transaksi */}
        <select
          value={kategori}
          onChange={e => setKategori(e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 cursor-pointer"
        >
          <option value="">Semua Tipe Transaksi</option>
          <option value="barang">📦 Pembelian Barang</option>
          <option value="gaji">💼 Gaji / Upah Karyawan</option>
        </select>

        {/* Filter Peruntukan */}
        <select
          value={peruntukan}
          onChange={e => setPeruntukan(e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 cursor-pointer"
        >
          <option value="">Semua Peruntukan</option>
          {masterPeruntukan.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Filter Bulan */}
        <input
          type="month"
          value={bulan}
          onChange={e => setBulan(e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
        />

        {hasFilter && (
          <button
            onClick={onReset}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-2 hover:bg-rose-50 rounded-lg transition"
          >
            Reset Filter
          </button>
        )}
      </div>
    </div>
  );
}
