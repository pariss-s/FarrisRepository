import { useState } from 'react';
import {
  Plus,
  ScanBarcode,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  BookOpen,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Book, Loan, MemberSummary, PublicUser } from '../types';
import { BarcodeDisplay } from './BarcodeDisplay';

interface AdminCollectionSectionProps {
  user: PublicUser | null;
  books: Book[];
  loans: Loan[];
  members: MemberSummary[];
  onOpenAuth: (tab?: 'member' | 'admin') => void;
  onScanForNewBook: (callback: (code: string) => void) => void;
  onBookCreated: (book: Book) => void;
  onBookUpdated: (book: Book) => void;
  onBookDeleted: (id: string) => void;
  onVerifyReturnBarcode: (loan: Loan) => void;
}

export function AdminCollectionSection({
  user,
  books,
  loans,
  members,
  onOpenAuth,
  onScanForNewBook,
  onBookCreated,
  onBookUpdated,
  onBookDeleted,
  onVerifyReturnBarcode,
}: AdminCollectionSectionProps) {
  const [subTab, setSubTab] = useState<'inventory' | 'members'>('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [labelBook, setLabelBook] = useState<Book | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Informatika');
  const [publisher, setPublisher] = useState('Penerbit Aksara Teknika');
  const [year, setYear] = useState(2026);
  const [shelfLocation, setShelfLocation] = useState('Rak A-01');
  const [totalCopies, setTotalCopies] = useState(5);
  const [description, setDescription] = useState('');

  if (!user || user.role !== 'admin') {
    return (
      <section className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-4">
        <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900">
          Manajemen Koleksi & Verifikasi Barcode (Khusus Admin)
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Masuk menggunakan akun Administrator untuk menambah koleksi buku dengan pemindaian
          barcode, mengatur stok eksemplar, memantau anggota, serta memproses pengembalian.
        </p>
        <button
          type="button"
          onClick={() => onOpenAuth('admin')}
          className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
        >
          Masuk sebagai Administrator
        </button>
      </section>
    );
  }

  function resetForm() {
    setTitle('');
    setAuthor('');
    setIsbn('');
    setBarcode(String(9786020000000 + Math.floor(Math.random() * 900000)));
    setCategory('Informatika');
    setPublisher('Pustaka Aksara');
    setYear(2026);
    setShelfLocation('Rak A-01');
    setTotalCopies(4);
    setDescription('');
    setErrorMsg(null);
  }

  function openAdd() {
    resetForm();
    setShowAddModal(true);
  }

  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ book: Book }>('/api/books', {
        method: 'POST',
        body: JSON.stringify({
          title,
          author,
          isbn: isbn || barcode,
          barcode,
          category,
          publisher,
          year,
          shelfLocation,
          totalCopies,
          description,
        }),
      });
      onBookCreated(res.book);
      setShowAddModal(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menambah koleksi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStock(book: Book, newTotal: number, newShelf: string) {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ book: Book }>(`/api/books/${book.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ totalCopies: newTotal, shelfLocation: newShelf }),
      });
      onBookUpdated(res.book);
      setEditingBook(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui buku.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBook(bookId: string) {
    try {
      await apiRequest(`/api/books/${bookId}`, { method: 'DELETE' });
      onBookDeleted(bookId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Tidak dapat menghapus buku.');
    }
  }

  const activeLoans = loans.filter((l) => l.status !== 'returned');

  return (
    <section className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Manajemen Koleksi, Barcode & Anggota
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola inventaris buku, cetak label barcode, dan verifikasi sirkulasi fisik anggota
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('inventory')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                subTab === 'inventory'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inventaris ({books.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('members')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                subTab === 'members'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anggota ({members.length})
            </button>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Buku
          </button>
        </div>
      </div>

      {errorMsg && !showAddModal && !editingBook && (
        <div className="flex items-center justify-between gap-2 p-3.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {subTab === 'inventory' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Judul & Penulis</th>
                  <th className="py-3 px-4">Barcode / ISBN</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Lokasi Rak</th>
                  <th className="py-3 px-4 text-right">Stok Tersedia</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 max-w-[260px]">
                      <div className="font-semibold text-slate-900 truncate">{book.title}</div>
                      <div className="text-slate-500 truncate">{book.author}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      <div>{book.barcode}</div>
                      <div className="text-[11px] text-slate-400">{book.isbn}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{book.category}</td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {book.shelfLocation}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          book.availableCopies > 0
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-700 font-semibold'
                        }
                      >
                        {book.availableCopies}
                      </span>
                      <span className="text-slate-400"> / {book.totalCopies}</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLabelBook(book)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-blue-700 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <ScanBarcode className="w-3.5 h-3.5" />
                          Label
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBook(book)}
                          className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          Ubah Stok
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBook(book.id)}
                          aria-label={`Hapus ${book.title}`}
                          className="p-1 text-slate-400 hover:text-red-700 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Direktori Anggota & Pinjaman Aktif
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Kode Anggota</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-right">Sedang Dipinjam</th>
                  <th className="py-3 px-4 text-right">Terlambat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {members.map((m) => (
                  <tr key={m.email} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-slate-700">{m.memberCode}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{m.name}</td>
                    <td className="py-3 px-4 text-slate-600">{m.email}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {m.activeCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={m.overdueCount > 0 ? 'text-red-700 font-semibold' : 'text-slate-600'}>
                        {m.overdueCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Return Verification Strip */}
      {activeLoans.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Antrean Pengembalian & Verifikasi Barcode ({activeLoans.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeLoans.slice(0, 6).map((loan) => (
              <div
                key={loan.id}
                className="p-3.5 border border-slate-200 rounded-md flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {loan.bookTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {loan.userName} · <span className="font-mono">{loan.bookBarcode}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onVerifyReturnBarcode(loan)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verifikasi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Book Modal with Barcode Scanner Hook */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Tambah Koleksi Buku Baru</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBook} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Kode Barcode (EAN-13 / Code128)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onScanForNewBook((scanned) => {
                        setBarcode(scanned);
                        if (!isbn) setIsbn(scanned);
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                  >
                    <ScanBarcode className="w-3.5 h-3.5" />
                    Pindai untuk Isi Cepat
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Judul Buku</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Penulis</label>
                  <input
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  >
                    <option value="Informatika">Informatika</option>
                    <option value="Arsitektur">Arsitektur</option>
                    <option value="Sains & Matematika">Sains & Matematika</option>
                    <option value="Ekologi & Alam">Ekologi & Alam</option>
                    <option value="Desain & Seni">Desain & Seni</option>
                    <option value="Sejarah & Humaniora">Sejarah & Humaniora</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lokasi Rak</label>
                  <input
                    type="text"
                    required
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jumlah Eksemplar
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ISBN</label>
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Penerbit</label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    min={1800}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ringkasan</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                />
              </div>

              {barcode && (
                <div className="pt-1">
                  <div className="text-xs text-slate-500 mb-1.5">Pratinjau Label Barcode:</div>
                  <BarcodeDisplay value={barcode} compact height={36} />
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Koleksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Stock Modal */}
      {editingBook && (
        <EditStockModal
          book={editingBook}
          saving={saving}
          errorMsg={errorMsg}
          onClose={() => setEditingBook(null)}
          onSave={(newTotal, newShelf) => void handleUpdateStock(editingBook, newTotal, newShelf)}
        />
      )}

      {/* Barcode Label Modal */}
      {labelBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Cetak Label Barcode</h3>
              <button
                type="button"
                onClick={() => setLabelBook(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm font-semibold text-slate-900">{labelBook.title}</div>
              <div className="flex justify-center">
                <BarcodeDisplay
                  value={labelBook.barcode}
                  label={`${labelBook.shelfLocation} · ${labelBook.isbn}`}
                  allowDownload
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EditStockModal({
  book,
  saving,
  errorMsg,
  onClose,
  onSave,
}: {
  book: Book;
  saving: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onSave: (total: number, shelf: string) => void;
}) {
  const borrowed = book.totalCopies - book.availableCopies;
  const [total, setTotal] = useState(book.totalCopies);
  const [shelf, setShelf] = useState(book.shelfLocation);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Ubah Stok & Lokasi Rak</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(total, shelf);
          }}
          className="p-5 space-y-4"
        >
          <div className="text-xs font-medium text-slate-800">{book.title}</div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Total Eksemplar (minimal {borrowed} sedang dipinjam)
            </label>
            <input
              type="number"
              min={borrowed}
              max={500}
              value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lokasi Rak</label>
            <input
              type="text"
              value={shelf}
              onChange={(e) => setShelf(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>
          {errorMsg && <div className="text-xs text-red-700">{errorMsg}</div>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
