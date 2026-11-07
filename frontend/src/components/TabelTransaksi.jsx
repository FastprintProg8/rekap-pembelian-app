import React, { useState, useEffect } from 'react';
import { formatRupiah, formatTanggal, resolveImageUrl } from '../utils/formatters';
import { Edit2, Trash2, Image as ImageIcon, FileCheck, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';

const ITEMS_PER_PAGE = 20;

export default function TabelTransaksi({
  items = [],
  pagination = null, // { page, limit, total, totalPages } jika serverside
  onPageChange = null,
  onEdit,
  onDelete,
  onQuickPay
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImage, setPreviewImage] = useState(null); // { src, title }

  // Jika serverside mode aktif
  const isServerSide = !!pagination;
  const page = isServerSide ? pagination.page : currentPage;
  const totalPages = isServerSide ? pagination.totalPages : Math.ceil(items.length / ITEMS_PER_PAGE);
  const totalCount = isServerSide ? pagination.total : items.length;
  const limit = isServerSide ? pagination.limit : ITEMS_PER_PAGE;
  const startIndex = (page - 1) * limit;

  // Pastikan data selalu diurutkan: belum lunas (belum, diproses) di atas, lalu tanggal terbaru
  const sortedItems = [...items].sort((a, b) => {
    const getPriority = (st) => (st === 'belum' ? 1 : st === 'diproses' ? 2 : 3);
    const prioA = getPriority(a.status || 'belum');
    const prioB = getPriority(b.status || 'belum');
    if (prioA !== prioB) return prioA - prioB;
    const tA = a.tanggal || '';
    const tB = b.tanggal || '';
    if (tA !== tB) return tB.localeCompare(tA);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const currentItems = isServerSide ? sortedItems : sortedItems.slice(startIndex, startIndex + limit);

  const handlePrev = () => {
    const target = Math.max(page - 1, 1);
    if (isServerSide && onPageChange) onPageChange(target);
    else setCurrentPage(target);
  };

  const handleNext = () => {
    const target = Math.min(page + 1, totalPages);
    if (isServerSide && onPageChange) onPageChange(target);
    else setCurrentPage(target);
  };

  // Reset ke halaman 1 jika filter / data berubah (client-side only)
  useEffect(() => {
    if (!isServerSide) setCurrentPage(1);
  }, [items.length, isServerSide]);

  // Hitung total keseluruhan nominal dalam periode/filter yang dipilih
  const grandTotal = isServerSide && pagination?.totalNominal != null
    ? pagination.totalNominal
    : items.reduce((acc, item) => acc + Number(item.totalNota ?? item.totalHitungan ?? 0), 0);

  // Subtotal untuk data yang tampil di halaman aktif saat ini
  const pageSubtotal = currentItems.reduce((acc, item) => acc + Number(item.totalNota ?? item.totalHitungan ?? 0), 0);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        <p className="text-base font-medium">Belum ada transaksi pembelian yang cocok.</p>
        <p className="text-xs text-slate-400 mt-1">Gunakan tombol "+ Catat Pembelian" untuk mencatat nota baru.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Tampilan Tabel untuk Layar Desktop/Tablet (md ke atas) */}
      <div className="hidden md:block overflow-x-auto max-h-[68vh] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs table-fixed">
          <thead className="sticky top-0 z-20 shadow-xs">
            <tr className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-bold text-[11px] tracking-wider uppercase">
              <th className="py-2.5 px-3 w-[95px]">Tanggal</th>
              <th className="py-2.5 px-3 w-[180px]">Toko / Penerima</th>
              <th className="py-2.5 px-3 w-[75px]">Cabang</th>
              <th className="py-2.5 px-3">Rincian Barang / Upah</th>
              <th className="py-2.5 px-3 text-right w-[110px]">Total Nota</th>
              <th className="py-2.5 px-3 w-[140px]">Status Bayar</th>
              <th className="py-2.5 px-2 text-center w-[70px]">Bukti</th>
              <th className="py-2.5 px-2 text-right w-[65px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {currentItems.map(item => {
              const status = item.status || 'belum';
              const totalAmount = Number(item.totalNota ?? item.totalHitungan ?? 0);
              const itemsList = item.items || [];

              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                  {/* Tanggal Terpisah di Depan */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {formatTanggal(item.tanggal)}
                    </span>
                  </td>

                  {/* Toko / Penerima */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-slate-900 break-words leading-tight">
                        {item.toko || 'Toko Tanpa Nama'}
                      </span>
                      {item.kategori === 'gaji' ? (
                        <span className="inline-flex items-center text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded shrink-0">
                          Gaji
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded shrink-0">
                          Barang
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
                      {item.platform && <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded text-[10px]">{item.platform}</span>}
                      {item.noPesanan && <span className="text-slate-400 font-mono">#{item.noPesanan}</span>}
                    </div>
                  </td>

                  {/* Peruntukan */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="inline-block bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {item.peruntukan || '-'}
                    </span>
                  </td>

                  {/* Items Summary */}
                  <td className="py-2.5 px-3">
                    <div className="text-[11px] text-slate-800 font-medium break-words leading-relaxed">
                      {itemsList.length > 0 ? itemsList.map(it => `${it.nama} (${it.qty} ${it.satuan || ''})`).join(', ') : '-'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {itemsList.length} macam
                    </div>
                  </td>

                  {/* Total Nota */}
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap text-xs">
                    {formatRupiah(totalAmount)}
                  </td>

                  {/* Status & Bayar */}
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      {status === 'belum' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                            <Clock className="w-2.5 h-2.5" /> Belum
                          </span>
                          <button
                            onClick={() => onQuickPay(item)}
                            className="text-[9px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-1.5 py-0.2 rounded transition cursor-pointer"
                            title="Lunasi Sekarang"
                          >
                            + Lunasi
                          </button>
                        </div>
                      )}
                      {status === 'diproses' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">
                            Diproses
                          </span>
                          <button
                            onClick={() => onQuickPay(item)}
                            className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded transition cursor-pointer"
                            title="Tandai Sudah Lunas"
                          >
                            ✓ Lunas
                          </button>
                        </div>
                      )}
                      {status === 'dibayar' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                          <CheckCircle className="w-2.5 h-2.5" /> Lunas {item.tglBayar ? `(${formatTanggal(item.tglBayar)})` : ''}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Foto Nota & Bukti Bayar */}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {item.fotoNota ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ 
                            src: item.fotoNota, 
                            title: `Nota: ${item.toko || 'Toko'} (${formatTanggal(item.tanggal)})` 
                          })}
                          className="inline-flex items-center justify-center w-6 h-6 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition cursor-pointer"
                          title="Lihat Foto Nota"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                      ) : null}

                      {item.buktiBayar ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ 
                            src: item.buktiBayar, 
                            title: `Bukti Bayar: ${item.toko || 'Toko'} (${item.akun || 'Akun'})` 
                          })}
                          className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                          title="Lihat Bukti Bayar / Transfer"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                        </button>
                      ) : null}

                      {!item.fotoNota && !item.buktiBayar && (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>
                  </td>

                  {/* Aksi */}
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => onEdit(item)}
                        className="p-1 rounded text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                        title="Edit Data"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Sticky TFOOT untuk Total Keseluruhan dalam Periode Tersebut */}
          <tfoot className="sticky bottom-0 z-20 shadow-xs border-t border-slate-300">
            <tr className="bg-slate-100/95 backdrop-blur-xs text-slate-800 text-xs">
              <td colSpan={4} className="py-2 px-3 text-right font-semibold">
                Total Tagihan ({totalCount} trx):
              </td>
              <td className="py-2 px-3 text-right font-bold text-teal-800 text-xs whitespace-nowrap">
                {formatRupiah(grandTotal)}
              </td>
              <td colSpan={3} className="py-2 px-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Tampilan Khusus Mobile Screen (< md): Kartu Transaksi Responsif */}
      <div className="block md:hidden divide-y divide-slate-100 max-h-[75vh] overflow-y-auto p-2 space-y-2.5">
        {currentItems.map(item => {
          const status = item.status || 'belum';
          const totalAmount = Number(item.totalNota ?? item.totalHitungan ?? 0);
          const itemsList = item.items || [];

          return (
            <div key={item.id} className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
              {/* Header Kartu: Toko & Tanggal */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{item.toko || 'Toko Tanpa Nama'}</span>
                    {item.kategori === 'gaji' ? (
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                        Gaji
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                        Barang
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span>{formatTanggal(item.tanggal)}</span>
                    {item.peruntukan && (
                      <span className="bg-teal-50 text-teal-800 font-semibold px-1.5 py-0.2 rounded text-[10px]">
                        {item.peruntukan}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-slate-900 text-sm">
                    {formatRupiah(totalAmount)}
                  </div>
                </div>
              </div>

              {/* Rincian Barang / Upah */}
              <div className="bg-slate-50/80 p-2 rounded-lg text-xs text-slate-700 border border-slate-100">
                <span className="font-semibold text-slate-500 text-[10px] uppercase block mb-0.5">Rincian:</span>
                <p className="leading-relaxed">
                  {itemsList.length > 0 ? itemsList.map(it => `${it.nama} (${it.qty} ${it.satuan || ''})`).join(', ') : '-'}
                </p>
              </div>

              {/* Footer Kartu: Status Bayar, Bukti & Tombol Aksi */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                <div>
                  {status === 'belum' && (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Belum
                      </span>
                      <button
                        onClick={() => onQuickPay(item)}
                        className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded transition cursor-pointer"
                      >
                        + Lunasi
                      </button>
                    </div>
                  )}
                  {status === 'diproses' && (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Diproses
                      </span>
                      <button
                        onClick={() => onQuickPay(item)}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded transition cursor-pointer"
                      >
                        ✓ Lunas
                      </button>
                    </div>
                  )}
                  {status === 'dibayar' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Lunas {item.tglBayar ? `(${formatTanggal(item.tglBayar)})` : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {item.fotoNota && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ 
                        src: item.fotoNota, 
                        title: `Nota: ${item.toko || 'Toko'} (${formatTanggal(item.tanggal)})` 
                      })}
                      className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200"
                      title="Lihat Foto Nota"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.buktiBayar && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ 
                        src: item.buktiBayar, 
                        title: `Bukti: ${item.toko || 'Toko'}` 
                      })}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                      title="Lihat Bukti Bayar"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(item)}
                    className="p-1.5 rounded-lg text-slate-600 bg-slate-100"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1.5 rounded-lg text-rose-600 bg-rose-50"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Total Ringkasan Khusus Mobile */}
        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
          <span>Total Tagihan ({totalCount} trx):</span>
          <span className="text-sm font-black text-teal-800">{formatRupiah(grandTotal)}</span>
        </div>
      </div>

      {/* Pagination Bar */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Menampilkan <span className="font-bold text-slate-900">{totalCount === 0 ? 0 : startIndex + 1}</span> - <span className="font-bold text-slate-900">{Math.min(startIndex + limit, totalCount)}</span> dari <span className="font-bold text-slate-900">{totalCount}</span> transaksi
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 font-semibold">
              Halaman {page} dari {totalPages}
            </span>

            <button
              onClick={handleNext}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Modal Preview Foto / Bukti */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src}
        title={previewImage?.title}
      />
    </div>
  );
}
