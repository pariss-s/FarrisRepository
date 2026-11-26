import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Mail,
  Play,
  RefreshCw,
  X,
  Eye,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type {
  EmailNotificationLog,
  GeneratedReport,
  PublicUser,
  ReportScheduleConfig,
} from '../types';

interface ReportsAndEmailSectionProps {
  user: PublicUser | null;
  smtpConfigured: boolean;
  emails: EmailNotificationLog[];
  reports: GeneratedReport[];
  schedule: ReportScheduleConfig;
  onOpenAuth: (tab?: 'member' | 'admin') => void;
  onRefreshData: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReportsAndEmailSection({
  user,
  smtpConfigured,
  emails,
  reports,
  schedule,
  onOpenAuth,
  onRefreshData,
}: ReportsAndEmailSectionProps) {
  const [runningDueCheck, setRunningDueCheck] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<EmailNotificationLog | null>(null);
  const [freq, setFreq] = useState<'daily' | 'weekly'>(schedule.frequency);
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [recipient, setRecipient] = useState(schedule.recipientEmail);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!user) {
    return (
      <section className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-4">
        <Mail className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900">
          Pelaporan Otomatis & Notifikasi Email Jatuh Tempo
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Masuk sebagai Member untuk melihat riwayat notifikasi email Anda, atau masuk sebagai
          Administrator untuk mengunduh laporan sirkulasi otomatis dan memicu pengingat jatuh
          tempo.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onOpenAuth('member')}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
          >
            Masuk Member
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('admin')}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
          >
            Masuk Admin
          </button>
        </div>
      </section>
    );
  }

  async function handleRunDueCheck() {
    setRunningDueCheck(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{
        updatedOverdueCount: number;
        sentEmails: EmailNotificationLog[];
      }>('/api/notifications/run-due-check', { method: 'POST' });
      setFeedback(
        `Pemeriksaan selesai: ${res.sentEmails.length} email pengingat baru dikirim, ${res.updatedOverdueCount} pinjaman diperbarui ke status terlambat.`
      );
      onRefreshData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menjalankan pemeriksaan.');
    } finally {
      setRunningDueCheck(false);
    }
  }

  async function handleGenerateReport() {
    setGeneratingReport(true);
    setFeedback(null);
    try {
      await apiRequest('/api/reports/generate', { method: 'POST' });
      setFeedback('Laporan sirkulasi terbaru berhasil dibuat dan siap diunduh.');
      onRefreshData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal membuat laporan.');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchedule(true);
    setFeedback(null);
    try {
      await apiRequest('/api/reports/schedule', {
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          frequency: freq,
          recipientEmail: recipient,
        }),
      });
      setFeedback('Jadwal pelaporan otomatis berhasil disimpan.');
      onRefreshData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan jadwal.');
    } finally {
      setSavingSchedule(false);
    }
  }

  function downloadCsv(report: GeneratedReport) {
    const blob = new Blob([report.csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      {feedback && (
        <div className="p-3.5 bg-slate-900 text-white text-xs rounded-md flex items-center justify-between gap-3">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Email Reminder Log & Real-Time Trigger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Notifikasi Pengingat Jatuh Tempo Email (Real-Time)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Status pengiriman:{' '}
              <span className="font-medium text-slate-800">
                {smtpConfigured
                  ? 'SMTP Server Aktif (pengiriman langsung ke kotak masuk)'
                  : 'Mode Pratinjau MIME Server (tambahkan variabel SMTP_* di environment untuk pengiriman eksternal)'}
              </span>
            </p>
          </div>

          {user.role === 'admin' && (
            <button
              type="button"
              disabled={runningDueCheck}
              onClick={() => void handleRunDueCheck()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {runningDueCheck ? 'Memeriksa...' : 'Jalankan Pemeriksaan Jatuh Tempo'}
            </button>
          )}
        </div>

        {emails.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Belum ada riwayat email pengingat yang dikirim.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Waktu Kirim</th>
                  <th className="py-3 px-4">Penerima</th>
                  <th className="py-3 px-4">Subjek & Buku</th>
                  <th className="py-3 px-4">Pemicu</th>
                  <th className="py-3 px-4">Status Pengiriman</th>
                  <th className="py-3 px-4 text-right">Pratinjau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {emails.map((mail) => (
                  <tr key={mail.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                      {formatDateTime(mail.sentAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{mail.recipientName}</div>
                      <div className="text-slate-500">{mail.recipientEmail}</div>
                    </td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="font-medium text-slate-900 truncate">{mail.subject}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        Barcode {mail.bookBarcode}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {mail.triggerType === 'auto_overdue'
                        ? 'Otomatis (Terlambat)'
                        : mail.triggerType === 'auto_due_soon'
                          ? 'Otomatis (<24 jam)'
                          : 'Manual Admin'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          mail.status === 'sent_smtp'
                            ? 'text-emerald-700'
                            : mail.status === 'preview_captured'
                              ? 'text-blue-700'
                              : 'text-red-700'
                        }`}
                      >
                        {mail.status === 'sent_smtp'
                          ? 'Terkirim via SMTP'
                          : mail.status === 'preview_captured'
                            ? 'Siap / Pratinjau MIME'
                            : 'Gagal Kirim'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewEmail(mail)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-blue-700 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Lihat Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Automatic Reporting System (Admin Only) */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Jadwal Pelaporan Otomatis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sistem menyusun ringkasan sirkulasi & ekspor CSV secara berkala
              </p>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-800 cursor-pointer">
                <span>Aktifkan Pelaporan Otomatis</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Frekuensi Pembuatan Laporan
                </label>
                <select
                  value={freq}
                  onChange={(e) => setFreq(e.target.value as 'daily' | 'weekly')}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                >
                  <option value="daily">Harian (Setiap 24 Jam)</option>
                  <option value="weekly">Mingguan (Setiap 7 Hari)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Tujuan Ringkasan Admin
                </label>
                <input
                  type="email"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                />
              </div>

              <button
                type="submit"
                disabled={savingSchedule}
                className="w-full py-2 px-4 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                {savingSchedule ? 'Menyimpan...' : 'Simpan Pengaturan Jadwal'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Arsip Laporan Sirkulasi & Inventaris
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Laporan otomatis dan manual siap diunduh dalam format CSV
                </p>
              </div>
              <button
                type="button"
                disabled={generatingReport}
                onClick={() => void handleGenerateReport()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {generatingReport ? 'Menyusun...' : 'Buat Laporan Sekarang'}
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada arsip laporan. Klik &quot;Buat Laporan Sekarang&quot; untuk menghasilkan
                laporan pertama.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-sm font-semibold text-slate-900">{rep.title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                        <span>{formatDateTime(rep.generatedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rep.totalLoans} transaksi</span>
                        <span aria-hidden="true">·</span>
                        <span>{rep.activeLoans} aktif</span>
                        <span aria-hidden="true">·</span>
                        <span>{rep.overdueLoans} terlambat</span>
                        <span aria-hidden="true">·</span>
                        <span>Kategori teratas: {rep.topCategory}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadCsv(rep)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh CSV
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email HTML Preview Drawer/Modal */}
      {previewEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{previewEmail.subject}</h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Kepada: {previewEmail.recipientName} &lt;{previewEmail.recipientEmail}&gt;
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
                <div className="text-xs font-mono text-slate-500 border-b border-slate-200 pb-3">
                  <div>Status: {previewEmail.status}</div>
                  <div>Dikirim: {formatDateTime(previewEmail.sentAt)}</div>
                  <div>Kode Barcode: {previewEmail.bookBarcode}</div>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
                  {previewEmail.textBody}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
