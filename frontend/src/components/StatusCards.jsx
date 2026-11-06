import React from 'react';
import { formatRupiah } from '../utils/formatters';
import { Clock, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function StatusCards({ items = [], serverStats = null, activeStatus, onSelectStatus }) {
  let stats = {
    belum: { count: 0, total: 0 },
    diproses: { count: 0, total: 0 },
    dibayar: { count: 0, total: 0 }
  };

  if (serverStats) {
    stats = {
      belum: serverStats.belum || stats.belum,
      diproses: serverStats.diproses || stats.diproses,
      dibayar: serverStats.dibayar || stats.dibayar
    };
  } else {
    items.forEach(it => {
      const st = it.status || 'belum';
      const amount = Number(it.totalNota ?? it.totalHitungan ?? 0);
      if (stats[st]) {
        stats[st].count += 1;
        stats[st].total += amount;
      }
    });
  }

  const cards = [
    {
      key: 'belum',
      title: 'Belum Diproses',
      count: stats.belum.count,
      total: stats.belum.total,
      icon: Clock,
      color: 'border-amber-300 bg-amber-50/60 text-amber-900 hover:border-amber-400',
      activeColor: 'border-amber-500 bg-amber-100 shadow-sm ring-2 ring-amber-400/30',
      badge: 'bg-amber-200/80 text-amber-800'
    },
    {
      key: 'diproses',
      title: 'Diproses',
      count: stats.diproses.count,
      total: stats.diproses.total,
      icon: RefreshCw,
      color: 'border-blue-300 bg-blue-50/60 text-blue-900 hover:border-blue-400',
      activeColor: 'border-blue-500 bg-blue-100 shadow-sm ring-2 ring-blue-400/30',
      badge: 'bg-blue-200/80 text-blue-800'
    },
    {
      key: 'dibayar',
      title: 'Dibayar',
      count: stats.dibayar.count,
      total: stats.dibayar.total,
      icon: CheckCircle2,
      color: 'border-emerald-300 bg-emerald-50/60 text-emerald-900 hover:border-emerald-400',
      activeColor: 'border-emerald-500 bg-emerald-100 shadow-sm ring-2 ring-emerald-400/30',
      badge: 'bg-emerald-200/80 text-emerald-800'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map(c => {
        const Icon = c.icon;
        const isActive = activeStatus === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onSelectStatus(isActive ? '' : c.key)}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              isActive ? c.activeColor : c.color
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Icon className="w-4 h-4" />
                {c.title}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                {c.count} Nota
              </span>
            </div>
            <div className="text-xl font-bold tracking-tight">
              {formatRupiah(c.total)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
