export type UserRole = 'admin' | 'member';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  role: UserRole;
  createdAt: string;
}

export interface BookRecord {
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

export interface LoanRecord {
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

export type ActivityType =
  | 'loan:created'
  | 'loan:returned'
  | 'loan:overdue'
  | 'book:created'
  | 'book:updated'
  | 'book:deleted'
  | 'reminder:sent'
  | 'report:generated'
  | 'barcode:verified';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorName: string;
  actorRole: UserRole | 'system';
  summary: string;
  targetId: string;
  timestamp: string;
}

export type EmailTriggerType = 'auto_due_soon' | 'auto_overdue' | 'manual_reminder';
export type EmailDeliveryStatus = 'sent_smtp' | 'preview_captured' | 'failed';

export interface EmailNotificationLog {
  id: string;
  loanId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  bookTitle: string;
  bookBarcode: string;
  dueAt: string;
  triggerType: EmailTriggerType;
  status: EmailDeliveryStatus;
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

export interface LibraryStoreData {
  users: UserRecord[];
  books: BookRecord[];
  loans: LoanRecord[];
  activities: ActivityEvent[];
  emailLogs: EmailNotificationLog[];
  reports: GeneratedReport[];
  reportSchedule: ReportScheduleConfig;
}
