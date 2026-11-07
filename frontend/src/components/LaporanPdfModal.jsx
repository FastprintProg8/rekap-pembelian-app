import React, { useRef } from 'react';
import { X, Printer, Download, Calendar, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { formatRupiah, formatTanggal } from '../utils/formatters';

export default function LaporanPdfModal({
  isOpen,
  onClose,
  items = [],
  filterInfo = {}
}) {
  const printAreaRef = useRef(null);

  if (!isOpen) return null;

  // Urutkan transaksi: belum lunas di atas, lalu tanggal
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

  // Hitung total keseluruhan
  let grandTotal = 0;
  let totalBelumLunas = 0;
  let totalLunas = 0;

  // Pengelompokan Rentang 7 Hari yang Jelas (Senin - Minggu atau Tanggal Nyata)
  // Menghitung rentang tanggal presisi: Tgl Mulai s/d Tgl Selesai
  const getWeekRange = (dateStr) => {
    if (!dateStr) return { key: '9999-99-99', label: 'Tanggal Tidak Tertera', start: 0 };
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return { key: '9999-99-99', label: 'Tanggal Tidak Tertera', start: 0 };
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (isNaN(d.getTime())) return { key: '9999-99-99', label: 'Tanggal Tidak Tertera', start: 0 };

      // Cari hari Senin di minggu tersebut (Day 0 = Minggu, 1 = Senin, ...)
      const dayOfWeek = d.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const opt = { day: 'numeric', month: 'short' };
      const optWithYear = { day: 'numeric', month: 'short', year: 'numeric' };

      const formatSameYear = monday.getFullYear() === sunday.getFullYear();
      const mondayStr = monday.toLocaleDateString('id-ID', formatSameYear ? opt : optWithYear);
      const sundayStr = sunday.toLocaleDateString('id-ID', optWithYear);

      const key = monday.toISOString().split('T')[0];
      const label = `${mondayStr} - ${sundayStr}`;
      return { key, label, start: monday.getTime() };
    } catch {
      return { key: '9999-99-99', label: 'Tanggal Tidak Tertera', start: 0 };
    }
  };

  const weeklySummary = {};

  sortedItems.forEach(item => {
    const amt = Number(item.totalNota ?? item.totalHitungan ?? 0);
    grandTotal += amt;
    const isLunas = item.status === 'dibayar';
    if (isLunas) {
      totalLunas += amt;
    } else {
      totalBelumLunas += amt;
    }

    const weekInfo = getWeekRange(item.tanggal);
    if (!weeklySummary[weekInfo.key]) {
      weeklySummary[weekInfo.key] = {
        key: weekInfo.key,
        label: weekInfo.label,
        start: weekInfo.start,
        total: 0,
        harusDibayar: 0, // Belum lunas / pending
        sudahDibayar: 0,
        count: 0
      };
    }
    weeklySummary[weekInfo.key].total += amt;
    weeklySummary[weekInfo.key].count += 1;
    if (isLunas) {
      weeklySummary[weekInfo.key].sudahDibayar += amt;
    } else {
      weeklySummary[weekInfo.key].harusDibayar += amt;
    }
  });

  // Urutkan minggu dari yang paling baru / terkini ke minggu lampau
  const weeklyList = Object.values(weeklySummary).sort((a, b) => b.start - a.start);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* CSS khusus cetak A4 dan Pengulangan Header Tabel */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 12mm 10mm;
          }
          /* Sembunyikan semua elemen di luar area modal */
          body > *:not(#root) {
            display: none !important;
          }
          /* Hanya tampilkan modal dan hilangkan backdrop */
          .fixed {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .shadow-2xl, .border {
            box-shadow: none !important;
            border: none !important;
          }
          /* Sembunyikan elemen utama web app */
          header, main, [role="dialog"] ~ * {
            display: none !important;
          }
          body {
            background-color: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none print:overflow-visible">
        
        {/* Header Modal (Hidden saat print) */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Cetak & Ekspor Laporan PDF</h2>
              <p className="text-xs text-slate-500">Laporan terperinci termasuk rekapitulasi yang harus dibayar per minggu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div ref={printAreaRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:overflow-visible text-slate-800">
          
          {/* Kop Dokumen */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">SISTEM REKAP KOST G23</h1>
              <p className="text-xs text-slate-600 font-medium">Laporan Rekapitulasi Pembelian & Pengeluaran Upah/Gaji</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold text-slate-800">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {filterInfo.bulan && <p>Periode: <b>{filterInfo.bulan}</b></p>}
              {filterInfo.peruntukan && <p>Peruntukan: <b>{filterInfo.peruntukan}</b></p>}
              {filterInfo.kategori && <p>Tipe: <b>{filterInfo.kategori === 'gaji' ? 'Gaji Karyawan' : 'Pembelian Barang'}</b></p>}
            </div>
          </div>

          {/* KOTAK RINGKASAN: TOTAL KESELURUHAN PERIODE */}
          <div className="avoid-break mb-6 flex justify-end">
            <div className="w-full sm:w-72 bg-slate-100 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Total Keseluruhan Periode
              </span>
              <span className="text-xl font-black text-slate-900 block">
                {formatRupiah(grandTotal)}
              </span>
              <span className="text-[10px] text-slate-600">{sortedItems.length} transaksi tercatat</span>
            </div>
          </div>

          {/* TABEL RINCIAN TRANSAKSI */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
              Rincian Lengkap Transaksi
            </h3>
            
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-200">Tgl</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Toko / Penerima</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Peruntukan</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Rincian Barang / Upah</th>
                  <th className="py-2 px-2.5 text-right border-r border-slate-200">Total Nota</th>
                  <th className="py-2 px-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedItems.map((item, idx) => {
                  const isPending = item.status !== 'dibayar';
                  const total = Number(item.totalNota ?? item.totalHitungan ?? 0);
                  const itemsStr = (item.items || []).map(it => `${it.nama} (${it.qty} ${it.satuan || ''})`).join(', ');

                  return (
                    <tr key={item.id || idx} className={isPending ? 'bg-amber-50/20' : ''}>
                      <td className="py-2 px-2.5 whitespace-nowrap border-r border-slate-200 font-medium">
                        {formatTanggal(item.tanggal)}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200">
                        <span className="font-semibold text-slate-900 block">{item.toko || '-'}</span>
                        <span className="text-[10px] text-slate-500">
                          {item.kategori === 'gaji' ? '[Gaji/Upah]' : '[Barang]'} {item.platform ? `• ${item.platform}` : ''}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                          {item.peruntukan || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200">
                        <div className="text-[11px] text-slate-800 line-clamp-2">
                          {itemsStr || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right border-r border-slate-200 font-bold whitespace-nowrap">
                        {formatRupiah(total)}
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        {item.status === 'dibayar' ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Lunas
                          </span>
                        ) : item.status === 'diproses' ? (
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                            Diproses
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[11px]">
                    Total Keseluruhan:
                  </td>
                  <td className="py-2.5 px-2.5 text-right text-teal-800 font-black text-xs whitespace-nowrap">
                    {formatRupiah(grandTotal)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
