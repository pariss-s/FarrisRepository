import fs from 'node:fs';
import path from 'node:path';
import type {
  ActivityEvent,
  BookRecord,
  LibraryStoreData,
  LoanRecord,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'library-store.json');

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000).toISOString();
}

function createInitialData(): LibraryStoreData {
  const now = new Date().toISOString();

  const books: BookRecord[] = [
    {
      id: 'bk-001',
      title: 'Arsitektur Sistem Terdistribusi Modern',
      author: 'Dr. Hendra Wijaya',
      isbn: '978-602-06-3317-6',
      barcode: '9786020633176',
      category: 'Informatika',
      publisher: 'Penerbit Aksara Teknika',
      year: 2025,
      shelfLocation: 'Rak A-01',
      totalCopies: 6,
      availableCopies: 4,
      coverUrl: '/src/assets/images/cover_sistem_terdistribusi_1795659581578.jpg',
      description: 'Panduan komprehensif konsensus terdistribusi, replikasi data, dan toleransi kesalahan pada skala produksi.',
      createdAt: daysAgo(45),
      updatedAt: now,
    },
    {
      id: 'bk-002',
      title: 'Material & Geometri: Monograf Arsitektur Tropis',
      author: 'Ar. Ratna Kusuma',
      isbn: '978-602-42-4694-5',
      barcode: '9786024246945',
      category: 'Arsitektur',
      publisher: 'Balai Pustaka Desain',
      year: 2024,
      shelfLocation: 'Rak B-04',
      totalCopies: 4,
      availableCopies: 2,
      coverUrl: '/src/assets/images/cover_filosofi_arsitektur_1795659581147.jpg',
      description: 'Kajian mendalam tentang struktur batu alam, pencahayaan alami, dan proporsi ruang di arsitektur kontemporer.',
      createdAt: daysAgo(38),
      updatedAt: now,
    },
    {
      id: 'bk-003',
      title: 'Algoritma Kuantum & Komputasi Lanjut',
      author: 'Prof. Bagus Santoso',
      isbn: '978-623-00-1982-1',
      barcode: '9786230019821',
      category: 'Sains & Matematika',
      publisher: 'Lembaga Sains Nusantara',
      year: 2026,
      shelfLocation: 'Rak A-09',
      totalCopies: 5,
      availableCopies: 4,
      coverUrl: '/src/assets/images/cover_algoritma_kuantum_1795659583197.jpg',
      description: 'Pengenalan gerbang kuantum, interferensi gelombang probabilistik, dan koreksi galat kuantum.',
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      id: 'bk-004',
      title: 'Ekologi Hutan & Flora Kepulauan Nusantara',
      author: 'Dr. Sinta Maharani',
      isbn: '978-602-88-1240-4',
      barcode: '9786028812404',
      category: 'Ekologi & Alam',
      publisher: 'Pustaka Konservasi',
      year: 2024,
      shelfLocation: 'Rak C-02',
      totalCopies: 5,
      availableCopies: 4,
      coverUrl: '/src/assets/images/cover_ekologi_nusantara_1795659584064.jpg',
      description: 'Dokumentasi botani, pemetaan topografi konservasi, dan keanekaragaman hayati wilayah tropis.',
      createdAt: daysAgo(28),
      updatedAt: now,
    },
    {
      id: 'bk-005',
      title: 'Tipografi Swiss & Tata Letak Editorial',
      author: 'Nadia Pramudita',
      isbn: '978-623-71-4509-7',
      barcode: '9786237145097',
      category: 'Desain & Seni',
      publisher: 'Studio Grafis Merdeka',
      year: 2025,
      shelfLocation: 'Rak B-11',
      totalCopies: 3,
      availableCopies: 2,
      coverUrl: '/src/assets/images/cover_desain_tipografi_1795659582634.jpg',
      description: 'Prinsip sistem grid modular, ritme tipografi, dan hierarki visual untuk publikasi cetak maupun digital.',
      createdAt: daysAgo(22),
      updatedAt: now,
    },
    {
      id: 'bk-006',
      title: 'Manajemen Basis Data & Replikasi Real-Time',
      author: 'Rizky Pratama, M.Kom',
      isbn: '978-602-04-9112-8',
      barcode: '9786020491128',
      category: 'Informatika',
      publisher: 'Penerbit Aksara Teknika',
      year: 2025,
      shelfLocation: 'Rak A-03',
      totalCopies: 7,
      availableCopies: 6,
      coverUrl: '',
      description: 'Optimasi indeks B-Tree, transaksi ACID, serta sinkronisasi data multi-klien latensi rendah.',
      createdAt: daysAgo(18),
      updatedAt: now,
    },
    {
      id: 'bk-007',
      title: 'Sejarah Perdagangan Maritim Asia Tenggara',
      author: 'Prof. Darmawan Putra',
      isbn: '978-602-31-7750-9',
      barcode: '9786023177509',
      category: 'Sejarah & Humaniora',
      publisher: 'Balai Pustaka Sejarah',
      year: 2023,
      shelfLocation: 'Rak D-06',
      totalCopies: 4,
      availableCopies: 3,
      coverUrl: '',
      description: 'Penelusuran jalur pelayaran, naskah pelabuhan kuno, dan jaringan niaga lintas samudra.',
      createdAt: daysAgo(14),
      updatedAt: now,
    },
    {
      id: 'bk-008',
      title: 'Statistika Terapan untuk Riset Kebijakan Publik',
      author: 'Dr. Anisa Rahmawati',
      isbn: '978-623-55-8210-3',
      barcode: '9786235582103',
      category: 'Sains & Matematika',
      publisher: 'Lembaga Sains Nusantara',
      year: 2025,
      shelfLocation: 'Rak A-14',
      totalCopies: 5,
      availableCopies: 5,
      coverUrl: '',
      description: 'Metode inferensi kausal, regresi multivariat, dan evaluasi dampak kebijakan berbasis data.',
      createdAt: daysAgo(10),
      updatedAt: now,
    },
  ];

  // Sample historical and active loans to demonstrate real-time charts & due-date reminders
  const loans: LoanRecord[] = [
    {
      id: 'ln-101',
      bookId: 'bk-001',
      bookTitle: 'Arsitektur Sistem Terdistribusi Modern',
      bookBarcode: '9786020633176',
      userId: 'mem-seed-1',
      userName: 'Budi Santoso',
      userEmail: 'budi.santoso@contoh.id',
      memberCode: 'ANG-2026-001',
      status: 'borrowed',
      borrowedAt: daysAgo(6),
      dueAt: hoursFromNow(14), // Due soon (< 24h) -> triggers real-time email reminder!
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: 'Verifikasi barcode saat pengambilan di loket 1.',
    },
    {
      id: 'ln-102',
      bookId: 'bk-002',
      bookTitle: 'Material & Geometri: Monograf Arsitektur Tropis',
      bookBarcode: '9786024246945',
      userId: 'mem-seed-2',
      userName: 'Citra Lestari',
      userEmail: 'citra.lestari@contoh.id',
      memberCode: 'ANG-2026-002',
      status: 'overdue',
      borrowedAt: daysAgo(10),
      dueAt: daysAgo(2), // Overdue -> triggers overdue reminder!
      returnedAt: null,
      reminderSentCount: 1,
      lastReminderAt: daysAgo(1),
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: 'Peminjaman riset studio arsitektur.',
    },
    {
      id: 'ln-103',
      bookId: 'bk-001',
      bookTitle: 'Arsitektur Sistem Terdistribusi Modern',
      bookBarcode: '9786020633176',
      userId: 'mem-seed-3',
      userName: 'Dimas Prasetyo',
      userEmail: 'dimas.prasetyo@contoh.id',
      memberCode: 'ANG-2026-003',
      status: 'borrowed',
      borrowedAt: daysAgo(2),
      dueAt: hoursFromNow(120),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: 'Peminjaman online.',
    },
    {
      id: 'ln-104',
      bookId: 'bk-003',
      bookTitle: 'Algoritma Kuantum & Komputasi Lanjut',
      bookBarcode: '9786230019821',
      userId: 'mem-seed-1',
      userName: 'Budi Santoso',
      userEmail: 'budi.santoso@contoh.id',
      memberCode: 'ANG-2026-001',
      status: 'borrowed',
      borrowedAt: daysAgo(3),
      dueAt: hoursFromNow(96),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: false,
      barcodeVerifiedOnReturn: false,
      notes: 'Peminjaman katalog digital.',
    },
    {
      id: 'ln-105',
      bookId: 'bk-004',
      bookTitle: 'Ekologi Hutan & Flora Kepulauan Nusantara',
      bookBarcode: '9786028812404',
      userId: 'mem-seed-2',
      userName: 'Citra Lestari',
      userEmail: 'citra.lestari@contoh.id',
      memberCode: 'ANG-2026-002',
      status: 'borrowed',
      borrowedAt: daysAgo(4),
      dueAt: hoursFromNow(72),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: '',
    },
    {
      id: 'ln-106',
      bookId: 'bk-005',
      bookTitle: 'Tipografi Swiss & Tata Letak Editorial',
      bookBarcode: '9786237145097',
      userId: 'mem-seed-3',
      userName: 'Dimas Prasetyo',
      userEmail: 'dimas.prasetyo@contoh.id',
      memberCode: 'ANG-2026-003',
      status: 'borrowed',
      borrowedAt: daysAgo(1),
      dueAt: hoursFromNow(144),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: '',
    },
    {
      id: 'ln-107',
      bookId: 'bk-006',
      bookTitle: 'Manajemen Basis Data & Replikasi Real-Time',
      bookBarcode: '9786020491128',
      userId: 'mem-seed-1',
      userName: 'Budi Santoso',
      userEmail: 'budi.santoso@contoh.id',
      memberCode: 'ANG-2026-001',
      status: 'borrowed',
      borrowedAt: daysAgo(5),
      dueAt: hoursFromNow(48),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: '',
    },
    {
      id: 'ln-108',
      bookId: 'bk-007',
      bookTitle: 'Sejarah Perdagangan Maritim Asia Tenggara',
      bookBarcode: '9786023177509',
      userId: 'mem-seed-2',
      userName: 'Citra Lestari',
      userEmail: 'citra.lestari@contoh.id',
      memberCode: 'ANG-2026-002',
      status: 'borrowed',
      borrowedAt: daysAgo(2),
      dueAt: hoursFromNow(120),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: false,
      barcodeVerifiedOnReturn: false,
      notes: '',
    },
    {
      id: 'ln-109',
      bookId: 'bk-002',
      bookTitle: 'Material & Geometri: Monograf Arsitektur Tropis',
      bookBarcode: '9786024246945',
      userId: 'mem-seed-3',
      userName: 'Dimas Prasetyo',
      userEmail: 'dimas.prasetyo@contoh.id',
      memberCode: 'ANG-2026-003',
      status: 'borrowed',
      borrowedAt: daysAgo(3),
      dueAt: hoursFromNow(96),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: false,
      notes: '',
    },
    // Returned historical loans for circulation charts
    {
      id: 'ln-095',
      bookId: 'bk-005',
      bookTitle: 'Tipografi Swiss & Tata Letak Editorial',
      bookBarcode: '9786237145097',
      userId: 'mem-seed-1',
      userName: 'Budi Santoso',
      userEmail: 'budi.santoso@contoh.id',
      memberCode: 'ANG-2026-001',
      status: 'returned',
      borrowedAt: daysAgo(12),
      dueAt: daysAgo(5),
      returnedAt: daysAgo(6),
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: true,
      notes: 'Dikembalikan tepat waktu dengan verifikasi barcode.',
    },
    {
      id: 'ln-096',
      bookId: 'bk-008',
      bookTitle: 'Statistika Terapan untuk Riset Kebijakan Publik',
      bookBarcode: '9786235582103',
      userId: 'mem-seed-2',
      userName: 'Citra Lestari',
      userEmail: 'citra.lestari@contoh.id',
      memberCode: 'ANG-2026-002',
      status: 'returned',
      borrowedAt: daysAgo(9),
      dueAt: daysAgo(2),
      returnedAt: daysAgo(3),
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: true,
      notes: 'Kondisi buku sangat baik.',
    },
    {
      id: 'ln-097',
      bookId: 'bk-003',
      bookTitle: 'Algoritma Kuantum & Komputasi Lanjut',
      bookBarcode: '9786230019821',
      userId: 'mem-seed-3',
      userName: 'Dimas Prasetyo',
      userEmail: 'dimas.prasetyo@contoh.id',
      memberCode: 'ANG-2026-003',
      status: 'returned',
      borrowedAt: daysAgo(7),
      dueAt: daysAgo(0),
      returnedAt: daysAgo(1),
      reminderSentCount: 1,
      lastReminderAt: daysAgo(2),
      barcodeVerifiedOnBorrow: true,
      barcodeVerifiedOnReturn: true,
      notes: '',
    },
  ];

  const activities: ActivityEvent[] = [
    {
      id: 'act-001',
      type: 'loan:created',
      actorName: 'Dimas Prasetyo',
      actorRole: 'member',
      summary: 'Meminjam "Tipografi Swiss & Tata Letak Editorial" (Barcode 9786237145097)',
      targetId: 'ln-106',
      timestamp: daysAgo(1),
    },
    {
      id: 'act-002',
      type: 'loan:returned',
      actorName: 'Dimas Prasetyo',
      actorRole: 'member',
      summary: 'Mengembalikan "Algoritma Kuantum & Komputasi Lanjut" via verifikasi barcode',
      targetId: 'ln-097',
      timestamp: daysAgo(1),
    },
    {
      id: 'act-003',
      type: 'loan:overdue',
      actorName: 'Sistem Pengingat',
      actorRole: 'system',
      summary: 'Status pinjaman "Material & Geometri" oleh Citra Lestari melewati jatuh tempo',
      targetId: 'ln-102',
      timestamp: daysAgo(1),
    },
  ];

  return {
    users: [],
    books,
    loans,
    activities,
    emailLogs: [],
    reports: [],
    reportSchedule: {
      enabled: true,
      frequency: 'daily',
      recipientEmail: 'admin@farrislibrary.id',
      lastGeneratedAt: null,
    },
  };
}

function getNewest2026Additions(): BookRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'bk-009',
      title: 'Rekayasa Sistem AI & Agen Otonom',
      author: 'Dr. Farhan Hakim',
      isbn: '978-623-10-4401-2',
      barcode: '9786231044012',
      category: 'Informatika',
      publisher: 'Farris Library Press',
      year: 2026,
      shelfLocation: 'Rak A-02',
      totalCopies: 6,
      availableCopies: 6,
      coverUrl: '/src/assets/images/cover_sistem_terdistribusi_1795659581578.jpg',
      description: 'Rancangan arsitektur agen otonom, orkestrasi memori kontekstual, dan evaluasi keandalan sistem AI modern.',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      updatedAt: now,
    },
    {
      id: 'bk-010',
      title: 'Desain Antarmuka Adaptif & Sistem Tipografi Digital',
      author: 'Clarissa Kusumo',
      isbn: '978-623-10-4402-9',
      barcode: '9786231044029',
      category: 'Desain & Seni',
      publisher: 'Studio Grafis Merdeka',
      year: 2026,
      shelfLocation: 'Rak B-08',
      totalCopies: 5,
      availableCopies: 5,
      coverUrl: '/src/assets/images/cover_desain_tipografi_1795659582634.jpg',
      description: 'Pendekatan sistematis dalam merancang sistem desain responsif, aksesibilitas kontras, dan keterbacaan multi-perangkat.',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      updatedAt: now,
    },
    {
      id: 'bk-011',
      title: 'Konservasi Ekosistem Pesisir & Perubahan Iklim',
      author: 'Prof. Larasati Wibowo',
      isbn: '978-623-10-4403-6',
      barcode: '9786231044036',
      category: 'Ekologi & Alam',
      publisher: 'Pustaka Konservasi',
      year: 2026,
      shelfLocation: 'Rak C-05',
      totalCopies: 4,
      availableCopies: 4,
      coverUrl: '/src/assets/images/cover_ekologi_nusantara_1795659584064.jpg',
      description: 'Riset lapangan mengenai rehabilitasi mangrove, karbon biru, dan ketahanan ekologi wilayah kepulauan.',
      createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      updatedAt: now,
    },
  ];
}

class LibraryStore {
  private data: LibraryStoreData;

  constructor() {
    this.data = this.load();
  }

  private load(): LibraryStoreData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as LibraryStoreData;
        if (parsed && Array.isArray(parsed.books) && Array.isArray(parsed.loans)) {
          let changed = false;
          for (const newestBook of getNewest2026Additions()) {
            if (!parsed.books.some((b) => b.id === newestBook.id || b.barcode === newestBook.barcode)) {
              parsed.books.unshift(newestBook);
              changed = true;
            }
          }
          if (changed) {
            this.persist(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load library store, initializing default data:', err);
    }
    const initial = createInitialData();
    for (const newestBook of getNewest2026Additions().reverse()) {
      initial.books.unshift(newestBook);
    }
    this.persist(initial);
    return initial;
  }

  private persist(target: LibraryStoreData = this.data): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(target, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  }

  getData(): LibraryStoreData {
    return this.data;
  }

  save(): void {
    this.persist(this.data);
  }

  addActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>): ActivityEvent {
    const entry: ActivityEvent = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.data.activities.unshift(entry);
    if (this.data.activities.length > 150) {
      this.data.activities = this.data.activities.slice(0, 150);
    }
    this.save();
    return entry;
  }
}

export const libraryStore = new LibraryStore();
