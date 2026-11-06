import React, { useState, useEffect } from 'react';
import { formatRupiah, formatTanggal } from '../utils/formatters';
import { Edit2, Trash2, Image as ImageIcon, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export default function TabelTransaksi({ items = [], onEdit, onDelete, onQuickPay }) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset ke halaman 1 jika filter / data berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        <p className="text-base font-medium">Belum ada transaksi pembelian yang cocok.</p>
        <p className="text-xs text-slate-400 mt-1">Gunakan tombol "+ Catat Pembelian" untuk mencatat nota baru.</p>
      </div>
    );
  }

  // Hitung Pagination
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="sticky top-0 z-20 shadow-xs">
            <tr className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-bold text-xs tracking-wider uppercase">
              <th className="py-3 px-4">Tanggal / Toko</th>
              <th className="py-3 px-4">Peruntukan</th>
              <th className="py-3 px-4">Item Barang</th>
              <th className="py-3 px-4 text-right">Total Nota</th>
              <th className="py-3 px-4">Status & Pembayaran</th>
              <th className="py-3 px-4 text-center">Nota</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentItems.map(item => {
              const status = item.status || 'belum';
              const totalAmount = Number(item.totalNota ?? item.totalHitungan ?? 0);
              const itemsList = item.items || [];

              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                  {/* Tanggal & Toko */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{item.toko || 'Toko Tanpa Nama'}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>{formatTanggal(item.tanggal)}</span>
                      {item.platform && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[11px]">{item.platform}</span>}
                    </div>
                    {item.noPesanan && (
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">#{item.noPesanan}</div>
                    )}
                  </td>

                  {/* Peruntukan */}
                  <td className="py-3.5 px-4">
                    <span className="inline-block bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold px-2 py-0.5 rounded-md">
                      {item.peruntukan || '-'}
                    </span>
                  </td>

                  {/* Items Summary */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="text-xs text-slate-800 font-medium truncate">
                      {itemsList.length > 0 ? itemsList.map(it => `${it.nama} (${it.qty} ${it.satuan || ''})`).join(', ') : '-'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {itemsList.length} macam barang
                    </div>
                  </td>

                  {/* Total Nota */}
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {formatRupiah(totalAmount)}
                  </td>

                  {/* Status & Bayar */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      {status === 'belum' && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Belum diproses
                          </span>
                          <button
                            onClick={() => onQuickPay(item)}
                            className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                            title="Lunasi Sekarang"
                          >
                            + Lunasi
                          </button>
                        </div>
                      )}
                      {status === 'diproses' && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Diproses ({item.akun || 'Akun'})
                          </span>
                          <button
                            onClick={() => onQuickPay(item)}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                            title="Tandai Sudah Lunas"
                          >
                            ✓ Lunas
                          </button>
                        </div>
                      )}
                      {status === 'dibayar' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Dibayar {item.tglBayar ? `(${formatTanggal(item.tglBayar)})` : ''}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Foto Nota */}
                  <td className="py-3.5 px-4 text-center">
                    {item.fotoNota ? (
                      <a
                        href={item.fotoNota}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition"
                        title="Lihat foto nota"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Aksi */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                        title="Edit Data"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Menampilkan <span className="font-bold text-slate-900">{items.length === 0 ? 0 : startIndex + 1}</span> - <span className="font-bold text-slate-900">{Math.min(startIndex + ITEMS_PER_PAGE, items.length)}</span> dari <span className="font-bold text-slate-900">{items.length}</span> transaksi
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 font-semibold">
              Halaman {currentPage} dari {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
