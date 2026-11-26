import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, X } from 'lucide-react';
import { apiRequest, setAuthToken, useLibraryWebSocket, type WsMessage } from './lib/api';
import type {
  ActivityEvent,
  AuthStatus,
  Book,
  DashboardAnalytics,
  EmailNotificationLog,
  GeneratedReport,
  Loan,
  MemberSummary,
  PublicUser,
  ReportScheduleConfig,
} from './types';
import { AuthModal } from './components/AuthModal';
import { BarcodeScannerModal, type BarcodeScannerIntent } from './components/BarcodeScannerModal';
import { CatalogSection } from './components/CatalogSection';
import { DashboardSection } from './components/DashboardSection';
import { AdminCollectionSection } from './components/AdminCollectionSection';
import { ReportsAndEmailSection } from './components/ReportsAndEmailSection';

type ActiveView = 'catalog' | 'dashboard' | 'collection' | 'reports';

const EMPTY_ANALYTICS: DashboardAnalytics = {
  totalTitles: 0,
  totalCopies: 0,
  availableCopies: 0,
  borrowedCopies: 0,
  utilizationPct: 0,
  activeLoans: 0,
  overdueLoans: 0,
  dueSoonLoans: 0,
  returnedLoans: 0,
  totalEmailsSent: 0,
  totalMembers: 0,
  dailyTrend: [],
  categoryStats: [],
};

const EMPTY_SCHEDULE: ReportScheduleConfig = {
  enabled: true,
  frequency: 'daily',
  recipientEmail: '',
  lastGeneratedAt: null,
};

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('catalog');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    adminClaimed: false,
    envAdminConfigured: false,
    smtpConfigured: false,
  });

  const [books, setBooks] = useState<Book[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_ANALYTICS);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [emails, setEmails] = useState<EmailNotificationLog[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [schedule, setSchedule] = useState<ReportScheduleConfig>(EMPTY_SCHEDULE);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Modals & notifications
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'member' | 'admin'>('member');
  const [borrowRequestBook, setBorrowRequestBook] = useState<Book | null>(null);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  // Barcode scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerIntent, setScannerIntent] = useState<BarcodeScannerIntent>('lookup');
  const [verifyingLoan, setVerifyingLoan] = useState<Loan | null>(null);
  const fillFormCallbackRef = useRef<((code: string) => void) | null>(null);

  const showToast = useCallback((msg: string) => {
    setLiveToast(msg);
  }, []);

  useEffect(() => {
    if (!liveToast) return;
    const timer = window.setTimeout(() => setLiveToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [liveToast]);

  const loadPublicData = useCallback(async () => {
    try {
      const [statusRes, booksRes, statsRes] = await Promise.all([
        apiRequest<AuthStatus>('/api/auth/status'),
        apiRequest<{ books: Book[] }>('/api/books'),
        apiRequest<{ stats: DashboardAnalytics }>('/api/dashboard/stats'),
      ]);
      setAuthStatus(statusRes);
      setBooks(booksRes.books);
      setAnalytics(statsRes.stats);
    } catch (err) {
      console.error('Failed to load initial public data:', err);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const loadAuthedData = useCallback(async (currentUser: PublicUser | null) => {
    if (!currentUser) {
      setLoans([]);
      setActivities([]);
      setEmails([]);
      setReports([]);
      setMembers([]);
      return;
    }

    try {
      const [loansRes, actRes, emailRes] = await Promise.all([
        apiRequest<{ loans: Loan[] }>('/api/loans'),
        apiRequest<{ activities: ActivityEvent[] }>('/api/activities'),
        apiRequest<{ emails: EmailNotificationLog[] }>('/api/notifications/emails'),
      ]);
      setLoans(loansRes.loans);
      setActivities(actRes.activities);
      setEmails(emailRes.emails);

      if (currentUser.role === 'admin') {
        const [reportsRes, membersRes] = await Promise.all([
          apiRequest<{ reports: GeneratedReport[]; schedule: ReportScheduleConfig }>(
            '/api/reports'
          ),
          apiRequest<{ members: MemberSummary[] }>('/api/members'),
        ]);
        setReports(reportsRes.reports);
        setSchedule(reportsRes.schedule);
        setMembers(membersRes.members);
      }
    } catch (err) {
      console.error('Failed to load authenticated data:', err);
    }
  }, []);

  useEffect(() => {
    void loadPublicData();
  }, [loadPublicData]);

  useEffect(() => {
    void loadAuthedData(user);
  }, [user, loadAuthedData]);

  // Real-Time WebSocket synchronization
  const handleWsEvent = useCallback(
    (msg: WsMessage) => {
      switch (msg.event) {
        case 'stats:updated': {
          setAnalytics(msg.payload as DashboardAnalytics);
          break;
        }
        case 'book:created': {
          const newBook = msg.payload as Book;
          setBooks((prev) =>
            prev.some((b) => b.id === newBook.id) ? prev : [newBook, ...prev]
          );
          break;
        }
        case 'book:updated': {
          const updated = msg.payload as Book;
          setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          break;
        }
        case 'book:deleted': {
          const { id } = msg.payload as { id: string };
          setBooks((prev) => prev.filter((b) => b.id !== id));
          break;
        }
        case 'loan:created': {
          const newLoan = msg.payload as Loan;
          if (user) {
            const belongs =
              user.role === 'admin' ||
              newLoan.userId === user.id ||
              newLoan.userEmail === user.email;
            if (belongs) {
              setLoans((prev) =>
                prev.some((l) => l.id === newLoan.id) ? prev : [newLoan, ...prev]
              );
            }
          }
          showToast(`Peminjaman baru: "${newLoan.bookTitle}" oleh ${newLoan.userName}`);
          break;
        }
        case 'loan:updated': {
          const updatedLoan = msg.payload as Loan;
          setLoans((prev) =>
            prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l))
          );
          break;
        }
        case 'activity:new': {
          const act = msg.payload as ActivityEvent;
          if (user) {
            setActivities((prev) =>
              prev.some((a) => a.id === act.id) ? prev : [act, ...prev].slice(0, 50)
            );
          }
          break;
        }
        case 'email:sent': {
          const mail = msg.payload as EmailNotificationLog;
          if (
            user &&
            (user.role === 'admin' ||
              mail.userId === user.id ||
              mail.recipientEmail === user.email)
          ) {
            setEmails((prev) =>
              prev.some((e) => e.id === mail.id) ? prev : [mail, ...prev]
            );
            showToast(`Notifikasi email dikirim ke ${mail.recipientEmail}: ${mail.bookTitle}`);
          }
          break;
        }
        case 'report:new': {
          const rep = msg.payload as GeneratedReport;
          if (user?.role === 'admin') {
            setReports((prev) =>
              prev.some((r) => r.id === rep.id) ? prev : [rep, ...prev]
            );
            showToast(`Laporan baru dibuat: ${rep.title}`);
          }
          break;
        }
        default:
          break;
      }
    },
    [user, showToast]
  );

  const { connected: wsConnected } = useLibraryWebSocket(handleWsEvent);

  function openAuth(tab: 'member' | 'admin' = 'member') {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }

  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    setActiveView('catalog');
  }

  function openLookupScanner() {
    setScannerIntent('lookup');
    setVerifyingLoan(null);
    fillFormCallbackRef.current = null;
    setScannerOpen(true);
  }

  function openReturnVerifyScanner(loan: Loan) {
    setScannerIntent('return_verify');
    setVerifyingLoan(loan);
    fillFormCallbackRef.current = null;
    setScannerOpen(true);
  }

  function openNewBookScanner(cb: (code: string) => void) {
    setScannerIntent('fill_form');
    setVerifyingLoan(null);
    fillFormCallbackRef.current = cb;
    setScannerOpen(true);
  }

  async function processReturn(loan: Loan, scannedBarcode?: string) {
    try {
      const res = await apiRequest<{ loan: Loan; book?: Book }>(
        `/api/loans/${loan.id}/return`,
        {
          method: 'POST',
          body: JSON.stringify({ scannedBarcode: scannedBarcode || '' }),
        }
      );
      setLoans((prev) => prev.map((l) => (l.id === res.loan.id ? res.loan : l)));
      if (res.book) {
        setBooks((prev) => prev.map((b) => (b.id === res.book!.id ? res.book! : b)));
      }
      showToast(
        `Pengembalian "${loan.bookTitle}" berhasil${scannedBarcode ? ' dengan verifikasi barcode' : ''}.`
      );
      void loadPublicData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memproses pengembalian.');
    }
  }

  async function handleSendManualReminder(loanId: string) {
    try {
      const res = await apiRequest<{ emailLog: EmailNotificationLog; loan: Loan }>(
        `/api/notifications/remind/${loanId}`,
        { method: 'POST' }
      );
      setLoans((prev) => prev.map((l) => (l.id === res.loan.id ? res.loan : l)));
      setEmails((prev) =>
        prev.some((e) => e.id === res.emailLog.id) ? prev : [res.emailLog, ...prev]
      );
      showToast(`Pengingat email dikirim ke ${res.emailLog.recipientEmail}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim pengingat.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Farris Library
          </button>

          {/* Zone 2: 4 single-line navigation links */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setActiveView('catalog')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'catalog'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'dashboard'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveView('collection')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'collection'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Kelola Koleksi
            </button>
            <button
              type="button"
              onClick={() => setActiveView('reports')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'reports'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Laporan & Email
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="max-w-[140px] truncate">
                  {user.name} ({user.role === 'admin' ? 'Admin' : 'Member'})
                </span>
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('member')}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Masuk Portal
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <div className="md:hidden border-t border-slate-200 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium text-slate-600">
          {(
            [
              ['catalog', 'Katalog'],
              ['dashboard', 'Dashboard'],
              ['collection', 'Kelola Koleksi'],
              ['reports', 'Laporan & Email'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                activeView === key ? 'text-blue-700 font-semibold' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-8">
        {loadingInitial ? (
          <div className="space-y-6">
            <div className="h-36 bg-white border border-slate-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-80 bg-white border border-slate-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {activeView === 'catalog' && (
              <CatalogSection
                books={books}
                user={user}
                onOpenScanner={openLookupScanner}
                onOpenAuth={openAuth}
                borrowRequestBook={borrowRequestBook}
                onClearBorrowRequest={() => setBorrowRequestBook(null)}
                onBorrowed={(loan, updatedBook) => {
                  setBooks((prev) =>
                    prev.map((b) => (b.id === updatedBook.id ? updatedBook : b))
                  );
                  setLoans((prev) =>
                    prev.some((l) => l.id === loan.id) ? prev : [loan, ...prev]
                  );
                  showToast(`Peminjaman "${loan.bookTitle}" berhasil dicatat.`);
                  void loadPublicData();
                }}
              />
            )}

            {activeView === 'dashboard' && (
              <DashboardSection
                analytics={analytics}
                user={user}
                wsConnected={wsConnected}
                loans={loans}
                activities={activities}
                emails={emails}
                onOpenAuth={openAuth}
                onVerifyReturnBarcode={openReturnVerifyScanner}
                onDirectReturn={(loan) => void processReturn(loan)}
                onSendManualReminder={(id) => void handleSendManualReminder(id)}
              />
            )}

            {activeView === 'collection' && (
              <AdminCollectionSection
                user={user}
                books={books}
                loans={loans}
                members={members}
                onOpenAuth={openAuth}
                onScanForNewBook={openNewBookScanner}
                onBookCreated={(book) => {
                  setBooks((prev) =>
                    prev.some((b) => b.id === book.id) ? prev : [book, ...prev]
                  );
                  showToast(`Koleksi "${book.title}" ditambahkan.`);
                  void loadPublicData();
                }}
                onBookUpdated={(book) => {
                  setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
                  showToast(`Stok "${book.title}" diperbarui.`);
                  void loadPublicData();
                }}
                onBookDeleted={(id) => {
                  setBooks((prev) => prev.filter((b) => b.id !== id));
                  showToast('Koleksi berhasil dihapus.');
                  void loadPublicData();
                }}
                onVerifyReturnBarcode={openReturnVerifyScanner}
              />
            )}

            {activeView === 'reports' && (
              <ReportsAndEmailSection
                user={user}
                smtpConfigured={authStatus.smtpConfigured}
                emails={emails}
                reports={reports}
                schedule={schedule}
                onOpenAuth={openAuth}
                onRefreshData={() => {
                  void loadPublicData();
                  void loadAuthedData(user);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Farris Library — Sistem Perpustakaan Digital & Sirkulasi Terintegrasi</span>
          <span className="tabular-nums">
            {analytics.totalTitles} judul · {analytics.totalCopies} eksemplar terdaftar
          </span>
        </div>
      </footer>

      {/* Live Real-Time Toast Notification */}
      {liveToast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center justify-between gap-3 text-xs"
        >
          <span>{liveToast}</span>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        initialTab={authModalTab}
        authStatus={authStatus}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(authedUser) => {
          setUser(authedUser);
          showToast(`Selamat datang, ${authedUser.name}.`);
        }}
        onStatusRefresh={() => void loadPublicData()}
      />

      {/* Barcode Scanner & Verification Modal */}
      <BarcodeScannerModal
        open={scannerOpen}
        intent={scannerIntent}
        expectedBarcode={verifyingLoan?.bookBarcode}
        expectedBookTitle={verifyingLoan?.bookTitle}
        sampleBarcodes={books.slice(0, 3).map((b) => ({ title: b.title, barcode: b.barcode }))}
        onClose={() => setScannerOpen(false)}
        onBookFound={(book) => {
          setActiveView('catalog');
          if (!user) {
            openAuth('member');
          } else {
            setBorrowRequestBook(book);
          }
        }}
        onCodeCaptured={(code) => {
          if (scannerIntent === 'return_verify' && verifyingLoan) {
            setScannerOpen(false);
            void processReturn(verifyingLoan, code);
          } else if (scannerIntent === 'fill_form' && fillFormCallbackRef.current) {
            fillFormCallbackRef.current(code);
          }
        }}
      />
    </div>
  );
}
