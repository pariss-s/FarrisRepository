import express from 'express';
import {
  hashPassword,
  issueBearerToken,
  toPublicUser,
  verifyBearerToken,
  verifyEnvAdminPasscode,
  verifyPassword,
} from './auth.ts';
import { libraryStore } from './store.ts';
import {
  dispatchDueReminderEmail,
  isSmtpConfigured,
  runDueDateAutomation,
} from './mailer.ts';
import {
  buildDashboardAnalytics,
  generateLibraryReport,
} from './reports.ts';
import type { BookRecord, LoanRecord, UserRecord } from './types.ts';

function cleanString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function cleanPositiveInt(val: unknown, fallback: number, min: number, max: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

function isValidCoverUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

interface AuthedRequest extends express.Request {
  authUser?: UserRecord;
}

function authenticateRequest(req: AuthedRequest): UserRecord | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyBearerToken(token);
  if (!payload) {
    return null;
  }
  const user = libraryStore.getData().users.find((u) => u.id === payload.uid);
  return user || null;
}

function requireAuth(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const user = authenticateRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const user = authenticateRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Autentikasi diperlukan.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Khusus administrator perpustakaan.' });
    return;
  }
  req.authUser = user;
  next();
}

export interface ApiAppOptions {
  onBroadcast?: (event: string, payload: unknown) => void;
  getWsCount?: () => number;
}

export function createApiApp(options: ApiAppOptions = {}): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const broadcast = (event: string, payload: unknown) => {
    options.onBroadcast?.(event, payload);
  };

  const broadcastStats = () => {
    broadcast('stats:updated', buildDashboardAnalytics());
  };

  // --- Health & Auth Status ---
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      smtpConfigured: isSmtpConfigured(),
      wsClients: options.getWsCount ? options.getWsCount() : 0,
    });
  });

  app.get('/api/auth/status', (_req, res) => {
    const users = libraryStore.getData().users;
    const adminClaimed = users.some((u) => u.role === 'admin');
    const envAdminConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    res.json({
      adminClaimed,
      envAdminConfigured,
      smtpConfigured: isSmtpConfigured(),
    });
  });

  app.post('/api/auth/claim-admin', (req, res) => {
    const data = libraryStore.getData();
    if (process.env.ADMIN_PASSCODE?.trim()) {
      res.status(403).json({
        error: 'Passcode admin dikonfigurasi melalui server environment. Gunakan form login admin.',
      });
      return;
    }
    if (data.users.some((u) => u.role === 'admin')) {
      res.status(409).json({
        error: 'Akun admin pertama sudah diaktivasi. Silakan masuk menggunakan kredensial admin.',
      });
      return;
    }

    const name = cleanString(req.body?.name, 80);
    const email = cleanString(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || !isValidEmail(email) || password.length < 6 || password.length > 128) {
      res.status(400).json({
        error: 'Nama minimal 2 karakter, email valid, dan kata sandi minimal 6 karakter diperlukan.',
      });
      return;
    }

    const adminUser: UserRecord = {
      id: `adm-${Date.now()}`,
      name,
      email,
      memberCode: 'ADM-001',
      role: 'admin',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    data.users.push(adminUser);
    data.reportSchedule.recipientEmail = email;
    libraryStore.save();

    const token = issueBearerToken(adminUser);
    res.status(201).json({ token, user: toPublicUser(adminUser) });
  });

  app.post('/api/auth/register', (req, res) => {
    const name = cleanString(req.body?.name, 80);
    const email = cleanString(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || !isValidEmail(email) || password.length < 6 || password.length > 128) {
      res.status(400).json({
        error: 'Nama minimal 2 karakter, email valid, dan kata sandi minimal 6 karakter.',
      });
      return;
    }

    const data = libraryStore.getData();
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
      return;
    }

    const memberNumber = data.users.filter((u) => u.role === 'member').length + 10;
    const memberUser: UserRecord = {
      id: `mem-${Date.now()}`,
      name,
      email,
      memberCode: `ANG-2026-${String(memberNumber).padStart(3, '0')}`,
      role: 'member',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    data.users.push(memberUser);
    libraryStore.save();

    const token = issueBearerToken(memberUser);
    res.status(201).json({ token, user: toPublicUser(memberUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = cleanString(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const requestedRole = req.body?.role === 'admin' ? 'admin' : 'member';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const data = libraryStore.getData();

    if (requestedRole === 'admin' && process.env.ADMIN_PASSCODE?.trim()) {
      if (!verifyEnvAdminPasscode(password)) {
        res.status(401).json({ error: 'Passcode admin tidak valid.' });
        return;
      }
      let admin = data.users.find((u) => u.role === 'admin' && u.email.toLowerCase() === email);
      if (!admin) {
        admin = {
          id: `adm-${Date.now()}`,
          name: email.split('@')[0] || 'Administrator',
          email,
          memberCode: 'ADM-ENV',
          role: 'admin',
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
        };
        data.users.push(admin);
        libraryStore.save();
      }
      const token = issueBearerToken(admin);
      res.json({ token, user: toPublicUser(admin) });
      return;
    }

    const user = data.users.find(
      (u) => u.email.toLowerCase() === email && u.role === requestedRole
    );
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }

    const token = issueBearerToken(user);
    res.json({ token, user: toPublicUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: toPublicUser(req.authUser!) });
  });

  // --- Books & Barcode Catalog ---
  app.get('/api/books', (req, res) => {
    const q = cleanString(req.query.q, 100).toLowerCase();
    const category = cleanString(req.query.category, 60);
    const availableOnly = req.query.availableOnly === 'true';
    const sort = cleanString(req.query.sort, 24) || 'newest';
    let books = [...libraryStore.getData().books];

    if (category && category !== 'Semua') {
      books = books.filter((b) => b.category === category);
    }
    if (availableOnly) {
      books = books.filter((b) => b.availableCopies > 0);
    }
    if (q) {
      books = books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          b.publisher.toLowerCase().includes(q) ||
          b.shelfLocation.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          b.barcode.toLowerCase().includes(q)
      );
    }

    if (sort === 'title') {
      books.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    } else if (sort === 'year') {
      books.sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
    } else if (sort === 'available') {
      books.sort((a, b) => b.availableCopies - a.availableCopies);
    } else {
      books.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    res.json({ books });
  });

  app.get('/api/books/barcode/:code', (req, res) => {
    const rawCode = cleanString(req.params.code, 64);
    const normalized = rawCode.replace(/[-\s]/g, '');
    if (!normalized) {
      res.status(400).json({ error: 'Kode barcode tidak valid.' });
      return;
    }

    const data = libraryStore.getData();
    const book = data.books.find(
      (b) =>
        b.barcode.replace(/[-\s]/g, '') === normalized ||
        b.isbn.replace(/[-\s]/g, '') === normalized
    );

    if (!book) {
      res.status(404).json({
        found: false,
        code: rawCode,
        error: 'Barcode tidak ditemukan di koleksi Farris Library.',
      });
      return;
    }

    const act = libraryStore.addActivity({
      type: 'barcode:verified',
      actorName: 'Pemindai Barcode',
      actorRole: 'system',
      summary: `Verifikasi barcode ${book.barcode} untuk "${book.title}"`,
      targetId: book.id,
    });
    broadcast('activity:new', act);

    res.json({ found: true, book });
  });

  app.post('/api/books', requireAdmin, (req: AuthedRequest, res) => {
    const title = cleanString(req.body?.title, 160);
    const author = cleanString(req.body?.author, 120);
    const isbn = cleanString(req.body?.isbn, 32);
    const barcode = cleanString(req.body?.barcode, 32).replace(/\s/g, '');
    const category = cleanString(req.body?.category, 60) || 'Umum';
    const publisher = cleanString(req.body?.publisher, 100) || 'Farris Library';
    const year = cleanPositiveInt(req.body?.year, 2026, 1800, 2100);
    const shelfLocation = cleanString(req.body?.shelfLocation, 40) || 'Rak A-01';
    const totalCopies = cleanPositiveInt(req.body?.totalCopies, 1, 1, 500);
    const coverUrl = cleanString(req.body?.coverUrl, 300);
    const description = cleanString(req.body?.description, 600);

    if (!title || !author || !barcode) {
      res.status(400).json({ error: 'Judul, penulis, dan kode barcode wajib diisi.' });
      return;
    }
    if (!isValidCoverUrl(coverUrl)) {
      res.status(400).json({ error: 'URL sampul harus berupa tautan http(s) atau aset lokal yang valid.' });
      return;
    }

    const data = libraryStore.getData();
    if (data.books.some((b) => b.barcode === barcode)) {
      res.status(409).json({ error: 'Buku dengan kode barcode tersebut sudah terdaftar.' });
      return;
    }

    const now = new Date().toISOString();
    const newBook: BookRecord = {
      id: `bk-${Date.now()}`,
      title,
      author,
      isbn: isbn || barcode,
      barcode,
      category,
      publisher,
      year,
      shelfLocation,
      totalCopies,
      availableCopies: totalCopies,
      coverUrl,
      description,
      createdAt: now,
      updatedAt: now,
    };

    data.books.unshift(newBook);
    libraryStore.save();

    const act = libraryStore.addActivity({
      type: 'book:created',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      summary: `Menambahkan koleksi baru "${newBook.title}" (Barcode ${newBook.barcode})`,
      targetId: newBook.id,
    });

    broadcast('book:created', newBook);
    broadcast('activity:new', act);
    broadcastStats();

    res.status(201).json({ book: newBook });
  });

  app.patch('/api/books/:id', requireAdmin, (req: AuthedRequest, res) => {
    const bookId = cleanString(req.params.id, 64);
    const data = libraryStore.getData();
    const book = data.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const borrowedCount = book.totalCopies - book.availableCopies;
    if (typeof req.body?.title === 'string' && req.body.title.trim()) {
      book.title = cleanString(req.body.title, 160);
    }
    if (typeof req.body?.author === 'string' && req.body.author.trim()) {
      book.author = cleanString(req.body.author, 120);
    }
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      book.category = cleanString(req.body.category, 60);
    }
    if (typeof req.body?.shelfLocation === 'string' && req.body.shelfLocation.trim()) {
      book.shelfLocation = cleanString(req.body.shelfLocation, 40);
    }
    if (req.body?.totalCopies !== undefined) {
      const nextTotal = cleanPositiveInt(req.body.totalCopies, book.totalCopies, borrowedCount, 500);
      book.totalCopies = nextTotal;
      book.availableCopies = Math.max(0, nextTotal - borrowedCount);
    }
    book.updatedAt = new Date().toISOString();
    libraryStore.save();

    const act = libraryStore.addActivity({
      type: 'book:updated',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      summary: `Memperbarui data koleksi "${book.title}" (Stok: ${book.availableCopies}/${book.totalCopies})`,
      targetId: book.id,
    });

    broadcast('book:updated', book);
    broadcast('activity:new', act);
    broadcastStats();

    res.json({ book });
  });

  app.delete('/api/books/:id', requireAdmin, (req: AuthedRequest, res) => {
    const bookId = cleanString(req.params.id, 64);
    const data = libraryStore.getData();
    const index = data.books.findIndex((b) => b.id === bookId);
    if (index === -1) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    const activeLoan = data.loans.some((l) => l.bookId === bookId && l.status !== 'returned');
    if (activeLoan) {
      res.status(409).json({ error: 'Buku sedang dipinjam dan tidak dapat dihapus sebelum dikembalikan.' });
      return;
    }

    const [removed] = data.books.splice(index, 1);
    libraryStore.save();

    const act = libraryStore.addActivity({
      type: 'book:deleted',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      summary: `Menghapus "${removed.title}" dari katalog koleksi`,
      targetId: removed.id,
    });

    broadcast('book:deleted', { id: removed.id });
    broadcast('activity:new', act);
    broadcastStats();

    res.json({ deleted: true, id: removed.id });
  });

  // --- Loans & Circulation ---
  app.get('/api/loans', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const allLoans = libraryStore.getData().loans;
    const scopedLoans =
      user.role === 'admin'
        ? allLoans
        : allLoans.filter((l) => l.userId === user.id || l.userEmail === user.email);
    res.json({ loans: scopedLoans });
  });

  app.post('/api/loans/borrow', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const bookId = cleanString(req.body?.bookId, 64);
    const durationDays = cleanPositiveInt(req.body?.durationDays, 7, 1, 30);
    const barcodeVerified = Boolean(req.body?.barcodeVerified);
    const notes = cleanString(req.body?.notes, 200);

    let borrowerName = user.name;
    let borrowerEmail = user.email;
    let borrowerId = user.id;
    let borrowerCode = user.memberCode;

    if (user.role === 'admin' && req.body?.memberEmail) {
      const targetEmail = cleanString(req.body.memberEmail, 160).toLowerCase();
      const targetName = cleanString(req.body.memberName, 80);
      if (!isValidEmail(targetEmail)) {
        res.status(400).json({ error: 'Email peminjam tidak valid.' });
        return;
      }
      const existingMember = libraryStore
        .getData()
        .users.find((u) => u.email.toLowerCase() === targetEmail);
      borrowerEmail = targetEmail;
      borrowerName = existingMember?.name || targetName || targetEmail.split('@')[0];
      borrowerId = existingMember?.id || `guest-${Date.now()}`;
      borrowerCode = existingMember?.memberCode || 'ANG-TAMU';
    }

    const data = libraryStore.getData();
    const book = data.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    if (book.availableCopies <= 0) {
      res.status(409).json({ error: 'Semua eksemplar buku sedang dipinjam.' });
      return;
    }

    const alreadyBorrowed = data.loans.some(
      (l) =>
        l.bookId === book.id &&
        (l.userId === borrowerId || l.userEmail === borrowerEmail) &&
        l.status !== 'returned'
    );
    if (alreadyBorrowed) {
      res.status(409).json({ error: 'Anggota masih memiliki pinjaman aktif untuk judul buku ini.' });
      return;
    }

    book.availableCopies -= 1;
    book.updatedAt = new Date().toISOString();

    const borrowedAt = new Date();
    const dueAt = new Date(borrowedAt.getTime() + durationDays * 86400 * 1000);

    const loan: LoanRecord = {
      id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookId: book.id,
      bookTitle: book.title,
      bookBarcode: book.barcode,
      userId: borrowerId,
      userName: borrowerName,
      userEmail: borrowerEmail,
      memberCode: borrowerCode,
      status: 'borrowed',
      borrowedAt: borrowedAt.toISOString(),
      dueAt: dueAt.toISOString(),
      returnedAt: null,
      reminderSentCount: 0,
      lastReminderAt: null,
      barcodeVerifiedOnBorrow: barcodeVerified,
      barcodeVerifiedOnReturn: false,
      notes,
    };

    data.loans.unshift(loan);
    libraryStore.save();

    const act = libraryStore.addActivity({
      type: 'loan:created',
      actorName: borrowerName,
      actorRole: user.role,
      summary: `Meminjam "${book.title}" selama ${durationDays} hari${barcodeVerified ? ' (Barcode terverifikasi)' : ''}`,
      targetId: loan.id,
    });

    broadcast('loan:created', loan);
    broadcast('book:updated', book);
    broadcast('activity:new', act);
    broadcastStats();

    res.status(201).json({ loan, book });
  });

  app.post('/api/loans/:id/return', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const loanId = cleanString(req.params.id, 64);
    const scannedBarcode = cleanString(req.body?.scannedBarcode, 64).replace(/[-\s]/g, '');

    const data = libraryStore.getData();
    const loan = data.loans.find((l) => l.id === loanId);
    if (!loan) {
      res.status(404).json({ error: 'Data peminjaman tidak ditemukan.' });
      return;
    }

    if (user.role !== 'admin' && loan.userId !== user.id && loan.userEmail !== user.email) {
      res.status(403).json({ error: 'Anda tidak memiliki akses untuk mengembalikan pinjaman ini.' });
      return;
    }

    if (loan.status === 'returned') {
      res.status(409).json({ error: 'Buku ini sudah dikembalikan sebelumnya.' });
      return;
    }

    if (scannedBarcode && scannedBarcode !== loan.bookBarcode.replace(/[-\s]/g, '')) {
      res.status(400).json({
        error: `Kode barcode (${scannedBarcode}) tidak cocok dengan buku "${loan.bookTitle}" (${loan.bookBarcode}).`,
      });
      return;
    }

    loan.status = 'returned';
    loan.returnedAt = new Date().toISOString();
    loan.barcodeVerifiedOnReturn = Boolean(scannedBarcode);

    const book = data.books.find((b) => b.id === loan.bookId);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      book.updatedAt = new Date().toISOString();
      broadcast('book:updated', book);
    }

    libraryStore.save();

    const act = libraryStore.addActivity({
      type: 'loan:returned',
      actorName: user.name,
      actorRole: user.role,
      summary: `Mengembalikan "${loan.bookTitle}"${scannedBarcode ? ' (Barcode terverifikasi)' : ''}`,
      targetId: loan.id,
    });

    broadcast('loan:updated', loan);
    broadcast('activity:new', act);
    broadcastStats();

    res.json({ loan, book });
  });

  // --- Dashboard Stats & Real-Time Activity ---
  app.get('/api/dashboard/stats', (_req, res) => {
    res.json({ stats: buildDashboardAnalytics() });
  });

  app.get('/api/activities', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const activities = libraryStore.getData().activities;
    if (user.role === 'admin') {
      res.json({ activities: activities.slice(0, 50) });
      return;
    }
    const memberScoped = activities.filter(
      (a) => a.actorName === user.name || a.type === 'book:created' || a.type === 'barcode:verified'
    );
    res.json({ activities: memberScoped.slice(0, 30) });
  });

  // --- Members Directory (Admin only) ---
  app.get('/api/members', requireAdmin, (_req, res) => {
    const data = libraryStore.getData();
    const registered = data.users
      .filter((u) => u.role === 'member')
      .map((u) => {
        const activeCount = data.loans.filter(
          (l) => (l.userId === u.id || l.userEmail === u.email) && l.status !== 'returned'
        ).length;
        const overdueCount = data.loans.filter(
          (l) => (l.userId === u.id || l.userEmail === u.email) && l.status === 'overdue'
        ).length;
        return {
          ...toPublicUser(u),
          activeCount,
          overdueCount,
        };
      });

    const knownEmails = new Set(registered.map((m) => m.email.toLowerCase()));
    const historicalMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        memberCode: string;
        role: 'member';
        createdAt: string;
        activeCount: number;
        overdueCount: number;
      }
    >();

    for (const loan of data.loans) {
      const emailKey = loan.userEmail.toLowerCase();
      if (knownEmails.has(emailKey)) continue;
      const existing = historicalMap.get(emailKey) || {
        id: loan.userId,
        name: loan.userName,
        email: loan.userEmail,
        memberCode: loan.memberCode,
        role: 'member' as const,
        createdAt: loan.borrowedAt,
        activeCount: 0,
        overdueCount: 0,
      };
      if (loan.status !== 'returned') existing.activeCount += 1;
      if (loan.status === 'overdue') existing.overdueCount += 1;
      historicalMap.set(emailKey, existing);
    }

    res.json({ members: [...registered, ...historicalMap.values()] });
  });

  // --- Real-Time Email Notifications ---
  app.get('/api/notifications/emails', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const logs = libraryStore.getData().emailLogs;
    const scoped =
      user.role === 'admin'
        ? logs
        : logs.filter((e) => e.userId === user.id || e.recipientEmail === user.email);
    res.json({
      emails: scoped,
      smtpConfigured: isSmtpConfigured(),
    });
  });

  app.post('/api/notifications/remind/:loanId', requireAdmin, async (req: AuthedRequest, res) => {
    const loanId = cleanString(req.params.loanId, 64);
    const data = libraryStore.getData();
    const loan = data.loans.find((l) => l.id === loanId);
    if (!loan) {
      res.status(404).json({ error: 'Data pinjaman tidak ditemukan.' });
      return;
    }
    if (loan.status === 'returned') {
      res.status(400).json({ error: 'Buku sudah dikembalikan, pengingat tidak diperlukan.' });
      return;
    }

    const emailLog = await dispatchDueReminderEmail(loan, 'manual_reminder');
    const act = libraryStore.addActivity({
      type: 'reminder:sent',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      summary: `Mengirim pengingat email ke ${loan.userEmail} untuk "${loan.bookTitle}"`,
      targetId: emailLog.id,
    });

    broadcast('email:sent', emailLog);
    broadcast('loan:updated', loan);
    broadcast('activity:new', act);
    broadcastStats();

    res.json({ emailLog, loan });
  });

  app.post('/api/notifications/run-due-check', requireAdmin, async (_req, res) => {
    const result = await runDueDateAutomation((event, payload) => broadcast(event, payload));
    broadcastStats();
    res.json(result);
  });

  // --- Automatic Reporting ---
  app.get('/api/reports', requireAdmin, (_req, res) => {
    const data = libraryStore.getData();
    res.json({
      reports: data.reports,
      schedule: data.reportSchedule,
    });
  });

  app.post('/api/reports/generate', requireAdmin, (req: AuthedRequest, res) => {
    const report = generateLibraryReport('manual');
    const act = libraryStore.addActivity({
      type: 'report:generated',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      summary: `Membuat "${report.title}" secara manual`,
      targetId: report.id,
    });

    broadcast('report:new', report);
    broadcast('activity:new', act);

    res.status(201).json({ report });
  });

  app.patch('/api/reports/schedule', requireAdmin, (req, res) => {
    const data = libraryStore.getData();
    if (typeof req.body?.enabled === 'boolean') {
      data.reportSchedule.enabled = req.body.enabled;
    }
    if (req.body?.frequency === 'daily' || req.body?.frequency === 'weekly') {
      data.reportSchedule.frequency = req.body.frequency;
    }
    if (typeof req.body?.recipientEmail === 'string') {
      const email = cleanString(req.body.recipientEmail, 160).toLowerCase();
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Alamat email penerima laporan tidak valid.' });
        return;
      }
      data.reportSchedule.recipientEmail = email;
    }
    libraryStore.save();
    res.json({ schedule: data.reportSchedule });
  });

  return app;
}
