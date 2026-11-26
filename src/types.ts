export type UserRole = 'admin' | 'member';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthStatus {
  adminClaimed: boolean;
  envAdminConfigured: boolean;
  smtpConfigured: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  barcode: string;
  category: string;
  publisher: string;
  year: number;
  shelfLocation: string;
  totalCopies: number;
  availableCopies: number;
  coverUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type LoanStatus = 'borrowed' | 'overdue' | 'returned';

export interface Loan {
  id: string;
  bookId: string;
  bookTitle: string;
  bookBarcode: string;
  userId: string;
  userName: string;
  userEmail: string;
  memberCode: string;
  status: LoanStatus;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  reminderSentCount: number;
  lastReminderAt: string | null;
  barcodeVerifiedOnBorrow: boolean;
  barcodeVerifiedOnReturn: boolean;
  notes: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  actorName: string;
  actorRole: string;
  summary: string;
  targetId: string;
  timestamp: string;
}

export interface EmailNotificationLog {
  id: string;
  loanId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  bookTitle: string;
  bookBarcode: string;
  dueAt: string;
  triggerType: 'auto_due_soon' | 'auto_overdue' | 'manual_reminder';
  status: 'sent_smtp' | 'preview_captured' | 'failed';
  subject: string;
  textBody: string;
  htmlBody: string;
  errorMessage: string | null;
  sentAt: string;
}

export interface ReportScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  recipientEmail: string;
  lastGeneratedAt: string | null;
}

export interface GeneratedReport {
  id: string;
  title: string;
  periodLabel: string;
  generatedAt: string;
  triggeredBy: 'auto' | 'manual';
  totalBooks: number;
  totalCopies: number;
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  returnedLoans: number;
  reminderCount: number;
  topCategory: string;
  csvContent: string;
}

export interface DashboardAnalytics {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  utilizationPct: number;
  activeLoans: number;
  overdueLoans: number;
  dueSoonLoans: number;
  returnedLoans: number;
  totalEmailsSent: number;
  totalMembers: number;
  dailyTrend: Array<{ label: string; borrowed: number; returned: number }>;
  categoryStats: Array<{ category: string; titles: number; activeLoans: number }>;
}

export interface MemberSummary extends PublicUser {
  activeCount: number;
  overdueCount: number;
}
