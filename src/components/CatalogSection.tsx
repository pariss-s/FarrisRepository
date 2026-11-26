import { useMemo, useState } from 'react';
import {
  BookOpen,
  ScanBarcode,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Book, Loan, PublicUser } from '../types';
import { BarcodeDisplay } from './BarcodeDisplay';

interface CatalogSectionProps {
  books: Book[];
  user: PublicUser | null;
  onOpenScanner: () => void;
  onOpenAuth: (tab?: 'member' | 'admin') => void;
  onBorrowed: (loan: Loan, updatedBook: Book) => void;
  borrowRequestBook: Book | null;
  onClearBorrowRequest: () => void;
}

type SortOption = 'newest' | 'year' | 'title' | 'available';

function BookCover({ book }: { book: Book }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (book.coverUrl && !imgFailed) {
    return (
      <img
        src={book.coverUrl}
        alt={`Sampul buku ${book.title}`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 flex flex-col justify-between text-white">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
        <span>{book.shelfLocation}</span>
        <span>{book.year}</span>
      </div>
      <div>
        <div className="text-[11px] text-slate-400 mb-1.5">{book.category}</div>
        <h4 className="font-display text-sm font-semibold leading-snug line-clamp-3">
          {book.title}
        </h4>
      </div>
      <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
        <span className="truncate pr-2">{book.author}</span>
        <BookOpen className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      </div>
    </div>
  );
}

export function CatalogSection({
  books,
  user,
  onOpenScanner,
  onOpenAuth,
  onBorrowed,
  borrowRequestBook,
  onClearBorrowRequest,
}: CatalogSectionProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [barcodeBook, setBarcodeBook] = useState<Book | null>(null);

  // Borrow form state
  const [durationDays, setDurationDays] = useState(7);
  const [barcodeVerified, setBarcodeVerified] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);

  const activeModalBook = borrowRequestBook || selectedBook;

  const categories = useMemo(() => {
    const set = new Set<string>(['Semua']);
    for (const b of books) set.add(b.category);
    return Array.from(set);
  }, [books]);

  const availableTitleCount = useMemo(
    () => books.filter((b) => b.availableCopies > 0).length,
    [books]
  );

  // 4 koleksi terbaru berdasarkan tanggal penambahan & tahun terbit
  const newestBooks = useMemo(() => {
    return [...books]
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.year - a.year
      )
      .slice(0, 4);
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = books.filter((b) => {
      if (activeCategory !== 'Semua' && b.category !== activeCategory) return false;
      if (availableOnly && b.availableCopies <= 0) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q) ||
        b.shelfLocation.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.barcode.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'id'));
    }
    if (sortBy === 'year') {
      return [...list].sort(
        (a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt)
      );
    }
    if (sortBy === 'available') {
      return [...list].sort((a, b) => b.availableCopies - a.availableCopies);
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [books, search, activeCategory, availableOnly, sortBy]);

  function openBorrowModal(book: Book, fromScanner = false) {
    if (!user) {
      onOpenAuth('member');
      return;
    }
    setBorrowError(null);
    setDurationDays(7);
    setBarcodeVerified(fromScanner);
    setMemberEmail('');
    setMemberName('');
    setNotes('');
    setSelectedBook(book);
  }

  function closeBorrowModal() {
    setSelectedBook(null);
    onClearBorrowRequest();
  }

  async function handleBorrowSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModalBook) return;
    setSubmitting(true);
    setBorrowError(null);

    try {
      const payload: Record<string, unknown> = {
        bookId: activeModalBook.id,
        durationDays,
        barcodeVerified: Boolean(borrowRequestBook) || barcodeVerified,
        notes,
      };
      if (user?.role === 'admin' && memberEmail.trim()) {
        payload.memberEmail = memberEmail.trim();
        payload.memberName = memberName.trim();
      }
      const res = await apiRequest<{ loan: Loan; book: Book }>('/api/loans/borrow', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onBorrowed(res.loan, res.book);
      closeBorrowModal();
    } catch (err) {
      setBorrowError(err instanceof Error ? err.message : 'Gagal memproses peminjaman.');
    } finally {
      setSubmitting(false);
    }
  }

  const dueDatePreview = new Date(Date.now() + durationDays * 86400 * 1000).toLocaleDateString(
    'id-ID',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  const isSearchingOrFiltering =
    search.trim().length > 0 || activeCategory !== 'Semua' || availableOnly;

  return (
    <section className="space-y-8">
      {/* Editorial Intro + Search & Availability Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Katalog Koleksi & Peminjaman Buku Online
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Telusuri ketersediaan buku di Farris Library secara real-time, filter koleksi yang
              siap dipinjam, temukan edisi terbaru, dan verifikasi kode barcode EAN-13/Code128.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4" />
              Pindai Barcode
            </button>
          </div>
        </div>

        {/* Search + Availability Toggle + Sort */}
        <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul, penulis, kategori, penerbit, rak, ISBN, atau barcode..."
                className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Hapus kata kunci pencarian"
                  className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setAvailableOnly((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  availableOnly
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Hanya yang Tersedia ({availableTitleCount})
              </button>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-md">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  aria-label="Urutkan koleksi"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="newest">Urutkan: Koleksi Terbaru</option>
                  <option value="year">Urutkan: Tahun Terbit Terbaru</option>
                  <option value="available">Urutkan: Stok Terbanyak</option>
                  <option value="title">Urutkan: Judul (A–Z)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Koleksi Terbaru Showcase (Visible when browsing full catalog) */}
      {!isSearchingOrFiltering && newestBooks.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Koleksi Terbaru</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Rilis & Pengadaan Terbaru di Farris Library
              </h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              Menampilkan {newestBooks.length} koleksi paling baru ditambahkan
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {newestBooks.map((book) => {
              const isAvailable = book.availableCopies > 0;
              return (
                <article
                  key={`newest-${book.id}`}
                  className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <button
                      type="button"
                      onClick={() => setDetailBook(book)}
                      className="w-16 aspect-[3/4] rounded overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                    >
                      <BookCover book={book} />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[11px] text-slate-500 truncate">
                        Terbit {book.year} · {book.category}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailBook(book)}
                        className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 leading-snug line-clamp-2 cursor-pointer"
                      >
                        {book.title}
                      </button>
                      <div className="text-xs text-slate-600 truncate">{book.author}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        isAvailable ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {isAvailable
                        ? `Tersedia (${book.availableCopies}/${book.totalCopies})`
                        : 'Dipinjam Semua'}
                    </span>
                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => openBorrowModal(book, false)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Pinjam
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          {isSearchingOrFiltering ? 'Hasil Pencarian Koleksi' : 'Semua Koleksi Katalog'}
        </h2>
        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
          <span>
            Menampilkan {filteredBooks.length} dari {books.length} judul
          </span>
          {isSearchingOrFiltering && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActiveCategory('Semua');
                setAvailableOnly(false);
              }}
              className="text-blue-700 hover:text-blue-800 font-medium cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Book Catalog Grid */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">
            Tidak ada buku yang sesuai dengan kriteria pencarian Anda.
          </p>
          <p className="text-xs text-slate-500">
            Coba ubah kata kunci, nonaktifkan filter ketersediaan, atau pilih kategori lain.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setActiveCategory('Semua');
              setAvailableOnly(false);
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            Tampilkan Semua Koleksi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredBooks.map((book) => {
            const isAvailable = book.availableCopies > 0;
            return (
              <article
                key={book.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setDetailBook(book)}
                    className="aspect-[3/4] w-full bg-slate-100 overflow-hidden border-b border-slate-200 block cursor-pointer"
                  >
                    <BookCover book={book} />
                  </button>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <span>{book.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{book.shelfLocation}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{book.year}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailBook(book)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 leading-snug line-clamp-2 cursor-pointer"
                    >
                      {book.title}
                    </button>
                    <p className="text-xs text-slate-600 truncate">{book.author}</p>
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span
                        className={`font-medium tabular-nums ${
                          isAvailable ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isAvailable
                          ? `Tersedia (${book.availableCopies}/${book.totalCopies})`
                          : `Dipinjam Semua (0/${book.totalCopies})`}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {book.barcode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setBarcodeBook(book)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ScanBarcode className="w-3.5 h-3.5" />
                    Barcode
                  </button>
                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => openBorrowModal(book, false)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isAvailable ? 'Pinjam Buku' : 'Stok Habis'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Book Detail Modal */}
      {detailBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Detail Koleksi Buku</h3>
              <button
                type="button"
                onClick={() => setDetailBook(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-32 aspect-[3/4] rounded-md overflow-hidden border border-slate-200 shrink-0">
                  <BookCover book={detailBook} />
                </div>
                <div className="space-y-2 min-w-0">
                  <div className="text-xs text-slate-500">
                    {detailBook.category} · {detailBook.shelfLocation} · Terbit {detailBook.year}
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 leading-snug">
                    {detailBook.title}
                  </h4>
                  <div className="text-xs text-slate-700">
                    Penulis: <span className="font-medium">{detailBook.author}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Penerbit: {detailBook.publisher}
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    ISBN {detailBook.isbn} · Barcode {detailBook.barcode}
                  </div>
                  <div
                    className={`text-xs font-semibold tabular-nums pt-1 ${
                      detailBook.availableCopies > 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {detailBook.availableCopies > 0
                      ? `Tersedia ${detailBook.availableCopies} dari ${detailBook.totalCopies} eksemplar`
                      : `Sedang dipinjam semua (0/${detailBook.totalCopies})`}
                  </div>
                </div>
              </div>

              {detailBook.description && (
                <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-4">
                  {detailBook.description}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const target = detailBook;
                    setDetailBook(null);
                    setBarcodeBook(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  <ScanBarcode className="w-3.5 h-3.5" />
                  Lihat Barcode
                </button>
                <button
                  type="button"
                  disabled={detailBook.availableCopies <= 0}
                  onClick={() => {
                    const target = detailBook;
                    setDetailBook(null);
                    openBorrowModal(target, false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 rounded-md cursor-pointer"
                >
                  {detailBook.availableCopies > 0 ? 'Pinjam Buku Ini' : 'Stok Habis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Label Inspection Modal */}
      {barcodeBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Label Barcode Koleksi</h3>
              <button
                type="button"
                onClick={() => setBarcodeBook(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">{barcodeBook.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {barcodeBook.author} · {barcodeBook.shelfLocation}
                </div>
              </div>
              <div className="flex justify-center py-2">
                <BarcodeDisplay
                  value={barcodeBook.barcode}
                  label={`ISBN ${barcodeBook.isbn}`}
                  allowDownload
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Online Borrow Confirmation Modal */}
      {activeModalBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                Konfirmasi Peminjaman Buku
              </h3>
              <button
                type="button"
                onClick={closeBorrowModal}
                className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBorrowSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                <div className="text-sm font-semibold text-slate-900">
                  {activeModalBook.title}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {activeModalBook.author} · Barcode{' '}
                  <span className="font-mono text-slate-900">{activeModalBook.barcode}</span>
                </div>
                {Boolean(borrowRequestBook) && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terverifikasi melalui pemindai barcode
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Durasi Peminjaman
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDurationDays(days)}
                      className={`py-2 px-3 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        durationDays === days
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {days} Hari
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Jatuh tempo pengembalian:{' '}
                  <span className="font-medium text-slate-800">{dueDatePreview}</span>. Pengingat
                  email akan dikirim otomatis 24 jam sebelum jatuh tempo.
                </p>
              </div>

              {user?.role === 'admin' && (
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="text-xs font-medium text-slate-700">
                    Pinjamkan atas nama anggota (opsional)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="Nama anggota"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="Email anggota"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Sirkulasi (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Pengambilan di loket utama"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                />
              </div>

              {borrowError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{borrowError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeBorrowModal}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Konfirmasi Peminjaman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
