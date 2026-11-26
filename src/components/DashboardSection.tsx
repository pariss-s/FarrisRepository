import { useState } from 'react';
import {
  Activity,
  BellRing,
  BookCheck,
  Clock,
  Mail,
  ScanBarcode,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  ActivityEvent,
  DashboardAnalytics,
  EmailNotificationLog,
  Loan,
  PublicUser,
} from '../types';
import { CirculationCharts } from './CirculationCharts';

interface DashboardSectionProps {
  analytics: DashboardAnalytics;
  user: PublicUser | null;
  wsConnected: boolean;
  loans: Loan[];
  activities: ActivityEvent[];
  emails: EmailNotificationLog[];
  onOpenAuth: (tab?: 'member' | 'admin') => void;
  onVerifyReturnBarcode: (loan: Loan) => void;
  onDirectReturn: (loan: Loan) => void;
  onSendManualReminder: (loanId: string) => void;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getDueCountdown(dueAt: string, status: Loan['status']): string {
  if (status === 'returned') return 'Sudah dikembalikan';
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const hours = Math.round(diffMs / 3600000);
  if (hours < 0) {
    const daysLate = Math.max(1, Math.ceil(Math.abs(hours) / 24));
    return `Terlambat ${daysLate} hari`;
  }
  if (hours < 24) {
    return `Jatuh tempo ${Math.max(1, hours)} jam lagi`;
  }
  const daysLeft = Math.ceil(hours / 24);
  return `Sisa ${daysLeft} hari`;
}

export function DashboardSection({
  analytics,
  user,
  wsConnected,
  loans,
  activities,
  emails,
  onOpenAuth,
  onVerifyReturnBarcode,
  onDirectReturn,
  onSendManualReminder,
}: DashboardSectionProps) {
  const [loanFilter, setLoanFilter] = useState<'active' | 'overdue' | 'all'>('active');

  const filteredLoans = loans.filter((l) => {
    if (loanFilter === 'active') return l.status !== 'returned';
    if (loanFilter === 'overdue') return l.status === 'overdue';
    return true;
  });

  return (
    <section className="space-y-6">
      {/* Header & Real-Time Connection State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {user?.role === 'admin'
              ? 'Dashboard Sirkulasi Real-Time (Admin)'
              : user?.role === 'member'
                ? `Dashboard Peminjaman Saya — ${user.name}`
                : 'Statistik Sirkulasi Perpustakaan Real-Time'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {user
              ? `Kode Akun: ${user.memberCode} · Pemantauan transaksi langsung melalui WebSocket`
              : 'Ringkasan koleksi & tren sirkulasi. Masuk sebagai Member atau Admin untuk melihat pinjaman pribadi dan log transaksi langsung.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium whitespace-nowrap shrink-0">
          {wsConnected ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-white border border-slate-200 px-3 py-1.5 rounded-md">
              <Wifi className="w-3.5 h-3.5" />
              WebSocket Terhubung
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-700 bg-white border border-slate-200 px-3 py-1.5 rounded-md">
              <WifiOff className="w-3.5 h-3.5" />
              Menghubungkan Ulang...
            </span>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Koleksi Buku</span>
            <BookCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {analytics.totalTitles} judul
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {analytics.availableCopies} tersedia dari {analytics.totalCopies} eksemplar
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sedang Dipinjam</span>
            <Activity className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {analytics.activeLoans + analytics.overdueLoans} transaksi
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Utilisasi koleksi {analytics.utilizationPct}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Jatuh Tempo & Terlambat</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-red-700 tabular-nums">
            {analytics.overdueLoans} terlambat
          </div>
          <div className="mt-1 text-xs text-amber-700 tabular-nums">
            {analytics.dueSoonLoans} akan jatuh tempo &lt;48 jam
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pengingat Email Terkirim</span>
            <Mail className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {analytics.totalEmailsSent} email
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Pemicu otomatis & manual real-time
          </div>
        </div>
      </div>

      {/* Charts */}
      <CirculationCharts analytics={analytics} />

      {/* Authenticated Personal / Admin Interactive Workspace */}
      {!user ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Masuk untuk Memantau Aktivitas Transaksi & Notifikasi Email
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Anggota dapat meminjam buku online, memverifikasi pengembalian dengan barcode, dan
              melihat kotak pengingat email. Administrator dapat memantau seluruh sirkulasi
              secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('member')}
              className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
            >
              Masuk Member
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('admin')}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer whitespace-nowrap"
            >
              Masuk Admin
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Loans & Return Verification Table */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {user.role === 'admin' ? 'Daftar Peminjaman Aktif' : 'Buku yang Saya Pinjam'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pantau jatuh tempo dan verifikasi pengembalian via barcode
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['active', 'overdue', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setLoanFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      loanFilter === tab
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'active' ? 'Aktif' : tab === 'overdue' ? 'Terlambat' : 'Semua'}
                  </button>
                ))}
              </div>
            </div>

            {filteredLoans.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada transaksi peminjaman pada filter ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
                {filteredLoans.map((loan) => {
                  const countdown = getDueCountdown(loan.dueAt, loan.status);
                  const isOverdue = loan.status === 'overdue';
                  const isReturned = loan.status === 'returned';

                  return (
                    <div
                      key={loan.id}
                      className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {loan.bookTitle}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-slate-700">{loan.bookBarcode}</span>
                          <span aria-hidden="true">·</span>
                          <span>{loan.userName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            Tempo {formatDateShort(loan.dueAt)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <span
                            className={`font-medium tabular-nums ${
                              isReturned
                                ? 'text-emerald-700'
                                : isOverdue
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }`}
                          >
                            {countdown}
                          </span>
                          {loan.reminderSentCount > 0 && (
                            <span className="text-slate-500 tabular-nums">
                              · {loan.reminderSentCount}x pengingat email
                            </span>
                          )}
                        </div>
                      </div>

                      {!isReturned && (
                        <div className="flex items-center gap-2 shrink-0">
                          {user.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => onSendManualReminder(loan.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer whitespace-nowrap"
                              title="Kirim pengingat email jatuh tempo"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              Ingatkan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onVerifyReturnBarcode(loan)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap"
                          >
                            <ScanBarcode className="w-3.5 h-3.5" />
                            Kembalikan (Barcode)
                          </button>
                          <button
                            type="button"
                            onClick={() => onDirectReturn(loan)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                          >
                            Selesai
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-Time Activity Stream + Personal Email Notifications */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Aktivitas Transaksi Real-Time
                </h3>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {activities.length} log
                </span>
              </div>
              {activities.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Belum ada aktivitas tercatat untuk akun Anda.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-[220px] overflow-y-auto">
                  {activities.slice(0, 12).map((act) => (
                    <div key={act.id} className="px-5 py-3 text-xs">
                      <div className="flex items-center justify-between gap-2 text-slate-500">
                        <span className="font-medium text-slate-800">{act.actorName}</span>
                        <span className="font-mono tabular-nums">
                          {formatTimeShort(act.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-snug">{act.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Notifikasi Email Jatuh Tempo Terbaru
                </h3>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {emails.length} email
                </span>
              </div>
              {emails.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Belum ada email pengingat jatuh tempo yang dikirim ke akun ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-[180px] overflow-y-auto">
                  {emails.slice(0, 5).map((mail) => (
                    <div key={mail.id} className="px-5 py-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {mail.subject}
                        </span>
                        <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                          {formatTimeShort(mail.sentAt)}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5 truncate">
                        Ke: {mail.recipientEmail} ·{' '}
                        {mail.status === 'sent_smtp'
                          ? 'Terkirim via SMTP'
                          : mail.status === 'preview_captured'
                            ? 'Tercatat di Pratinjau Server'
                            : 'Gagal'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
