import { useState } from 'react';
import type { DashboardAnalytics } from '../types';

interface CirculationChartsProps {
  analytics: DashboardAnalytics;
}

export function CirculationCharts({ analytics }: CirculationChartsProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxTrend = Math.max(
    4,
    ...analytics.dailyTrend.map((d) => Math.max(d.borrowed, d.returned))
  );

  const maxCat = Math.max(
    1,
    ...analytics.categoryStats.map((c) => Math.max(c.titles, c.activeLoans))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 7-Day Circulation Trend Chart */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Tren Sirkulasi 7 Hari Terakhir
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan transaksi peminjaman dan pengembalian harian secara real-time
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-700 rounded-xs inline-block" />
              Peminjaman
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs inline-block" />
              Pengembalian
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-7 gap-3 items-end h-48 pt-6 border-b border-slate-200">
            {analytics.dailyTrend.map((day, idx) => {
              const borrowPct = Math.round((day.borrowed / maxTrend) * 100);
              const returnPct = Math.round((day.returned / maxTrend) * 100);
              const isHovered = hoveredIdx === idx;
              return (
                <div
                  key={day.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="relative flex flex-col items-center justify-end h-full group"
                >
                  {isHovered && (
                    <div className="absolute -top-2 z-10 px-2.5 py-1.5 bg-slate-900 text-white text-[11px] rounded shadow-md whitespace-nowrap pointer-events-none tabular-nums">
                      Pinjam: {day.borrowed} · Kembali: {day.returned}
                    </div>
                  )}
                  <div className="flex items-end justify-center gap-1.5 w-full h-full pb-1">
                    <div
                      style={{ height: `${Math.max(4, borrowPct)}%` }}
                      className="w-3.5 sm:w-4 bg-blue-700 group-hover:bg-blue-800 rounded-t-xs transition-all duration-150"
                      title={`Peminjaman: ${day.borrowed}`}
                    />
                    <div
                      style={{ height: `${Math.max(4, returnPct)}%` }}
                      className="w-3.5 sm:w-4 bg-emerald-600 group-hover:bg-emerald-700 rounded-t-xs transition-all duration-150"
                      title={`Pengembalian: ${day.returned}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-3 pt-2.5">
            {analytics.dailyTrend.map((day) => (
              <div
                key={day.label}
                className="text-[11px] text-slate-500 text-center truncate tabular-nums"
              >
                {day.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Distribution & Utilization */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Distribusi Kategori & Peminjaman Aktif
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Utilisasi koleksi saat ini:{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {analytics.utilizationPct}%
            </span>{' '}
            ({analytics.borrowedCopies}/{analytics.totalCopies} eksemplar dipinjam)
          </p>

          <div className="mt-5 space-y-3.5">
            {analytics.categoryStats.map((cat) => {
              const barWidth = Math.round((cat.activeLoans / maxCat) * 100);
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 truncate pr-2">
                      {cat.category}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums shrink-0">
                      {cat.activeLoans} aktif · {cat.titles} judul
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(6, barWidth)}%` }}
                      className="h-full bg-slate-800 rounded-full transition-all duration-200"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-slate-500">Anggota Aktif</div>
            <div className="text-base font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
              {analytics.totalMembers}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Dikembalikan</div>
            <div className="text-base font-semibold font-mono text-emerald-700 tabular-nums mt-0.5">
              {analytics.returnedLoans}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Jatuh Tempo &lt;48j</div>
            <div className="text-base font-semibold font-mono text-amber-700 tabular-nums mt-0.5">
              {analytics.dueSoonLoans}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
