import { libraryStore } from './store.ts';
import type { GeneratedReport } from './types.ts';

function sanitizeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function generateLibraryReport(triggeredBy: 'auto' | 'manual'): GeneratedReport {
  const data = libraryStore.getData();
  const now = new Date();

  const totalBooks = data.books.length;
  const totalCopies = data.books.reduce((sum, b) => sum + b.totalCopies, 0);
  const totalLoans = data.loans.length;
  const activeLoans = data.loans.filter((l) => l.status === 'borrowed').length;
  const overdueLoans = data.loans.filter((l) => l.status === 'overdue').length;
  const returnedLoans = data.loans.filter((l) => l.status === 'returned').length;
  const reminderCount = data.emailLogs.length;

  const categoryCounts = new Map<string, number>();
  for (const loan of data.loans) {
    const book = data.books.find((b) => b.id === loan.bookId);
    const cat = book?.category || 'Umum';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  let topCategory = 'Belum ada data';
  let topCount = -1;
  for (const [cat, count] of categoryCounts.entries()) {
    if (count > topCount) {
      topCount = count;
      topCategory = cat;
    }
  }

  const header = [
    'ID Transaksi',
    'Judul Buku',
    'Kode Barcode',
    'Nama Peminjam',
    'Email Peminjam',
    'Kode Anggota',
    'Status',
    'Tanggal Pinjam',
    'Jatuh Tempo',
    'Tanggal Kembali',
    'Pengingat Terkirim',
  ]
    .map(sanitizeCsvCell)
    .join(',');

  const rows = data.loans.map((loan) =>
    [
      loan.id,
      loan.bookTitle,
      loan.bookBarcode,
      loan.userName,
      loan.userEmail,
      loan.memberCode,
      loan.status === 'borrowed'
        ? 'Dipinjam'
        : loan.status === 'overdue'
          ? 'Terlambat'
          : 'Dikembalikan',
      loan.borrowedAt,
      loan.dueAt,
      loan.returnedAt || '-',
      loan.reminderSentCount,
    ]
      .map(sanitizeCsvCell)
      .join(',')
  );

  // UTF-8 BOM for Indonesian Excel compatibility
  const csvContent = `\uFEFF${[header, ...rows].join('\n')}`;

  const periodLabel = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const report: GeneratedReport = {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title:
      triggeredBy === 'auto'
        ? `Laporan Sirkulasi Otomatis (${periodLabel})`
        : `Laporan Sirkulasi Manual (${periodLabel})`,
    periodLabel,
    generatedAt: now.toISOString(),
    triggeredBy,
    totalBooks,
    totalCopies,
    totalLoans,
    activeLoans,
    overdueLoans,
    returnedLoans,
    reminderCount,
    topCategory,
    csvContent,
  };

  data.reports.unshift(report);
  if (data.reports.length > 50) {
    data.reports = data.reports.slice(0, 50);
  }
  data.reportSchedule.lastGeneratedAt = now.toISOString();
  libraryStore.save();

  return report;
}

export function checkScheduledAutoReport(
  onBroadcast?: (eventName: string, payload: unknown) => void
): GeneratedReport | null {
  const data = libraryStore.getData();
  if (!data.reportSchedule.enabled) {
    return null;
  }

  const lastMs = data.reportSchedule.lastGeneratedAt
    ? new Date(data.reportSchedule.lastGeneratedAt).getTime()
    : 0;
  const intervalMs =
    data.reportSchedule.frequency === 'weekly'
      ? 7 * 24 * 3600 * 1000
      : 24 * 3600 * 1000;

  if (Date.now() - lastMs >= intervalMs) {
    const report = generateLibraryReport('auto');
    const act = libraryStore.addActivity({
      type: 'report:generated',
      actorName: 'Sistem Pelaporan',
      actorRole: 'system',
      summary: `${report.title} dibuat secara otomatis (${report.totalLoans} transaksi)`,
      targetId: report.id,
    });
    onBroadcast?.('report:new', report);
    onBroadcast?.('activity:new', act);
    return report;
  }

  return null;
}

export function buildDashboardAnalytics() {
  const data = libraryStore.getData();
  const totalTitles = data.books.length;
  const totalCopies = data.books.reduce((sum, b) => sum + b.totalCopies, 0);
  const availableCopies = data.books.reduce((sum, b) => sum + b.availableCopies, 0);
  const borrowedCopies = totalCopies - availableCopies;

  const activeLoans = data.loans.filter((l) => l.status === 'borrowed').length;
  const overdueLoans = data.loans.filter((l) => l.status === 'overdue').length;
  const returnedLoans = data.loans.filter((l) => l.status === 'returned').length;

  const dueSoonLoans = data.loans.filter((l) => {
    if (l.status !== 'borrowed') return false;
    const diff = new Date(l.dueAt).getTime() - Date.now();
    return diff >= 0 && diff <= 48 * 3600 * 1000;
  }).length;

  // Last 7 days daily circulation trend
  const dailyTrend: Array<{ label: string; borrowed: number; returned: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000);
    const dayKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    const borrowed = data.loans.filter((l) => l.borrowedAt.slice(0, 10) === dayKey).length;
    const returned = data.loans.filter(
      (l) => l.returnedAt && l.returnedAt.slice(0, 10) === dayKey
    ).length;
    dailyTrend.push({ label, borrowed, returned });
  }

  // Category distribution
  const catMap = new Map<string, { category: string; titles: number; activeLoans: number }>();
  for (const book of data.books) {
    const entry = catMap.get(book.category) || {
      category: book.category,
      titles: 0,
      activeLoans: 0,
    };
    entry.titles += 1;
    catMap.set(book.category, entry);
  }
  for (const loan of data.loans) {
    if (loan.status === 'returned') continue;
    const book = data.books.find((b) => b.id === loan.bookId);
    if (book) {
      const entry = catMap.get(book.category);
      if (entry) entry.activeLoans += 1;
    }
  }

  const registeredMembers = data.users.filter((u) => u.role === 'member').length;
  const uniqueSeedBorrowers = new Set(data.loans.map((l) => l.memberCode)).size;

  return {
    totalTitles,
    totalCopies,
    availableCopies,
    borrowedCopies,
    utilizationPct: totalCopies > 0 ? Math.round((borrowedCopies / totalCopies) * 100) : 0,
    activeLoans,
    overdueLoans,
    dueSoonLoans,
    returnedLoans,
    totalEmailsSent: data.emailLogs.length,
    totalMembers: Math.max(registeredMembers, uniqueSeedBorrowers),
    dailyTrend,
    categoryStats: Array.from(catMap.values()),
  };
}
