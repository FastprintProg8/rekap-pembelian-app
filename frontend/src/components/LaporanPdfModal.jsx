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

  // Pengelompokan mingguan (Weekly Grouping)
  // Menghitung minggu ke berapa dalam bulan/tahun
  const getWeekKey = (dateStr) => {
    if (!dateStr) return 'Lainnya';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Lainnya';
      const year = d.getFullYear();
      const monthName = d.toLocaleDateString('id-ID', { month: 'short' });
      // Tentukan minggu ke berapa dalam bulan: 1-7 (M1), 8-14 (M2), 15-21 (M3), 22+ (M4/M5)
      const day = d.getDate();
      const weekNum = Math.ceil(day / 7);
      return `Minggu ${weekNum} (${monthName} ${year})`;
    } catch {
      return 'Lainnya';
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

    const weekKey = getWeekKey(item.tanggal);
    if (!weeklySummary[weekKey]) {
      weeklySummary[weekKey] = {
        label: weekKey,
        total: 0,
        harusDibayar: 0, // Belum lunas / pending
        sudahDibayar: 0,
        count: 0
      };
    }
    weeklySummary[weekKey].total += amt;
    weeklySummary[weekKey].count += 1;
    if (isLunas) {
      weeklySummary[weekKey].sudahDibayar += amt;
    } else {
      weeklySummary[weekKey].harusDibayar += amt;
    }
  });

  const weeklyList = Object.values(weeklySummary);

  const handlePrint = () => {
    const printContent = document.getElementById('area-laporan-pdf');
    if (!printContent) return;

    // Buat iframe tersembunyi khusus untuk mencetak dokumen
    let iframe = document.getElementById('print-iframe');
    if (iframe) {
      document.body.removeChild(iframe);
    }
    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>Laporan Rekap Kost G23</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 12mm 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              background: #fff;
              color: #1e293b;
              font-size: 11px;
              line-height: 1.4;
              padding: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
            .avoid-break {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            /* Styling persis Tailwind */
            .border-b-2 { border-bottom: 2px solid #0f172a; }
            .border-b { border-bottom: 1px solid #cbd5e1; }
            .border-t { border-top: 1px solid #cbd5e1; }
            .border-t-2 { border-top: 2px solid #94a3b8; }
            .border-r { border-right: 1px solid #e2e8f0; }
            .border { border: 1px solid #cbd5e1; }
            .rounded-xl { border-radius: 8px; }
            .rounded-full { border-radius: 9999px; }
            .p-3 { padding: 10px; }
            .p-3\\.5 { padding: 12px; }
            .py-2 { padding-top: 6px; padding-bottom: 6px; }
            .px-2\\.5 { padding-left: 8px; padding-right: 8px; }
            .px-3 { padding-left: 10px; padding-right: 10px; }
            .py-2\\.5 { padding-top: 8px; padding-bottom: 8px; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2\\.5 { margin-bottom: 8px; }
            .mb-4 { margin-bottom: 14px; }
            .mb-6 { margin-bottom: 18px; }
            .pb-4 { padding-bottom: 14px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-black { font-weight: 900; }
            .font-medium { font-weight: 500; }
            .uppercase { text-transform: uppercase; }
            .whitespace-nowrap { white-space: nowrap; }
            .text-xs { font-size: 11px; }
            .text-lg { font-size: 16px; }
            .text-2xl { font-size: 20px; }
            .text-\\[10px\\] { font-size: 9.5px; }
            .text-\\[11px\\] { font-size: 10.5px; }
            .text-slate-900 { color: #0f172a; }
            .text-slate-800 { color: #1e293b; }
            .text-slate-700 { color: #334155; }
            .text-slate-600 { color: #475569; }
            .text-slate-500 { color: #64748b; }
            .text-amber-700 { color: #b45309; }
            .text-amber-800 { color: #92400e; }
            .text-amber-900 { color: #78350f; }
            .text-emerald-700 { color: #047857; }
            .text-emerald-800 { color: #065f46; }
            .text-emerald-900 { color: #064e3b; }
            .text-blue-800 { color: #1e40af; }
            .text-teal-700 { color: #0f766e; }
            .text-teal-800 { color: #115e59; }
            .bg-slate-100 { background-color: #f1f5f9; }
            .bg-slate-50 { background-color: #f8fafc; }
            .bg-amber-50 { background-color: #fffbeb; }
            .bg-amber-100 { background-color: #fef3c7; }
            .bg-emerald-50 { background-color: #ecfdf5; }
            .bg-emerald-100 { background-color: #d1fae5; }
            .bg-blue-100 { background-color: #dbeafe; }
            .grid { display: grid; }
            .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .gap-3 { gap: 10px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* CSS khusus cetak A4 dan Pengulangan Header Tabel */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          /* Sembunyikan seluruh isi aplikasi web saat print */
          body * {
            visibility: hidden;
          }
          /* Hanya tampilkan area laporan PDF modal */
          #area-laporan-pdf, #area-laporan-pdf * {
            visibility: visible;
          }
          #area-laporan-pdf {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
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
        <div id="area-laporan-pdf" ref={printAreaRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:overflow-visible text-slate-800">
          
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

          {/* KOTAK RINGKASAN: TOTAL PER MINGGU & TOTAL HARUS DIBAYAR */}
          <div className="avoid-break">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-700" />
              Ringkasan Kewajiban Pembayaran Per Minggu
            </h3>

            {/* Tabel Rincian Per Minggu */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Periode Minggu</th>
                    <th className="py-2 px-3 text-center">Jml Transaksi</th>
                    <th className="py-2 px-3 text-right">Sudah Dibayar</th>
                    <th className="py-2 px-3 text-right bg-amber-50 text-amber-900">Harus Dibayar (Pending)</th>
                    <th className="py-2 px-3 text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklyList.map((w, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{w.label}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{w.count} nota</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-medium">{formatRupiah(w.sudahDibayar)}</td>
                      <td className="py-2 px-3 text-right bg-amber-50/50 text-amber-800 font-bold">{formatRupiah(w.harusDibayar)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatRupiah(w.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
