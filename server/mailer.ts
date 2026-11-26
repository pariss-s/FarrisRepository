import nodemailer from 'nodemailer';
import { libraryStore } from './store.ts';
import type {
  EmailNotificationLog,
  EmailTriggerType,
  LoanRecord,
} from './types.ts';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIndonesianDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function buildEmailContent(loan: LoanRecord, triggerType: EmailTriggerType) {
  const isOverdue = triggerType === 'auto_overdue' || new Date(loan.dueAt).getTime() < Date.now();
  const formattedDue = formatIndonesianDate(loan.dueAt);

  const subject = isOverdue
    ? `[TERLAMBAT] Pengingat Pengembalian Buku: ${loan.bookTitle}`
    : `[PENGINGAT JATUH TEMPO] Segera Kembalikan: ${loan.bookTitle}`;

  const statusHeadline = isOverdue
    ? 'Masa Peminjaman Telah Melewati Batas Jatuh Tempo'
    : 'Batas Waktu Peminjaman Buku Segera Berakhir';

  const textBody = [
    `Halo ${loan.userName} (${loan.memberCode}),`,
    '',
    statusHeadline,
    `Judul Buku: ${loan.bookTitle}`,
    `Kode Barcode: ${loan.bookBarcode}`,
    `Batas Jatuh Tempo: ${formattedDue}`,
    '',
    'Silakan lakukan pengembalian atau perpanjangan melalui portal Farris Library atau memindai barcode di loket perpustakaan.',
    '',
    'Salam,',
    'Tim Sirkulasi Farris Library',
  ].join('\n');

  const htmlBody = `
<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background-color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;background:#0f172a;color:#ffffff;">
        <div style="font-size:16px;font-weight:600;letter-spacing:-0.01em;">Farris Library</div>
        <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">Notifikasi Sirkulasi Real-Time</div>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">Halo <strong>${escapeHtml(loan.userName)}</strong> (${escapeHtml(loan.memberCode)}),</p>
        <h2 style="margin:0 0 16px;font-size:18px;color:${isOverdue ? '#dc2626' : '#d97706'};">${escapeHtml(statusHeadline)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;width:140px;">Judul Buku</td>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">${escapeHtml(loan.bookTitle)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Kode Barcode</td>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:monospace;color:#0f172a;">${escapeHtml(loan.bookBarcode)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Jatuh Tempo</td>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:${isOverdue ? '#dc2626' : '#0f172a'};">${escapeHtml(formattedDue)}</td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">
          Mohon segera mengembalikan buku ke perpustakaan atau memverifikasi pengembalian melalui pemindai barcode pada portal Farris Library.
        </p>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
        Email otomatis dikirim oleh sistem pengingat Farris Library.
      </div>
    </div>
  </body>
</html>`.trim();

  return { subject, textBody, htmlBody };
}

export async function dispatchDueReminderEmail(
  loan: LoanRecord,
  triggerType: EmailTriggerType
): Promise<EmailNotificationLog> {
  const { subject, textBody, htmlBody } = buildEmailContent(loan, triggerType);
  let status: EmailNotificationLog['status'] = 'preview_captured';
  let errorMessage: string | null = null;

  if (isSmtpConfigured()) {
    try {
      const port = Number(process.env.SMTP_PORT || '587');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'Pustaka Aksara <noreply@pustaka-aksara.id>',
        to: loan.userEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      status = 'sent_smtp';
    } catch (err) {
      status = 'failed';
      errorMessage = err instanceof Error ? err.message : 'SMTP delivery error';
    }
  }

  const now = new Date().toISOString();
  const logEntry: EmailNotificationLog = {
    id: `eml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    loanId: loan.id,
    userId: loan.userId,
    recipientEmail: loan.userEmail,
    recipientName: loan.userName,
    bookTitle: loan.bookTitle,
    bookBarcode: loan.bookBarcode,
    dueAt: loan.dueAt,
    triggerType,
    status,
    subject,
    textBody,
    htmlBody,
    errorMessage,
    sentAt: now,
  };

  loan.reminderSentCount += 1;
  loan.lastReminderAt = now;

  const data = libraryStore.getData();
  data.emailLogs.unshift(logEntry);
  if (data.emailLogs.length > 200) {
    data.emailLogs = data.emailLogs.slice(0, 200);
  }
  libraryStore.save();

  return logEntry;
}

export async function runDueDateAutomation(
  onBroadcast?: (eventName: string, payload: unknown) => void
): Promise<{ updatedOverdueCount: number; sentEmails: EmailNotificationLog[] }> {
  const data = libraryStore.getData();
  const nowMs = Date.now();
  const twentyFourHoursMs = 24 * 3600 * 1000;
  const twelveHoursMs = 12 * 3600 * 1000;

  let updatedOverdueCount = 0;
  const sentEmails: EmailNotificationLog[] = [];

  for (const loan of data.loans) {
    if (loan.status === 'returned') {
      continue;
    }

    const dueMs = new Date(loan.dueAt).getTime();
    const isPastDue = dueMs < nowMs;
    const isDueSoon = !isPastDue && dueMs - nowMs <= twentyFourHoursMs;

    if (isPastDue && loan.status !== 'overdue') {
      loan.status = 'overdue';
      updatedOverdueCount += 1;
      const act = libraryStore.addActivity({
        type: 'loan:overdue',
        actorName: 'Sistem Pengingat',
        actorRole: 'system',
        summary: `Pinjaman "${loan.bookTitle}" oleh ${loan.userName} melewati batas jatuh tempo`,
        targetId: loan.id,
      });
      onBroadcast?.('activity:new', act);
      onBroadcast?.('loan:updated', loan);
    }

    if (isPastDue || isDueSoon) {
      const lastSentMs = loan.lastReminderAt ? new Date(loan.lastReminderAt).getTime() : 0;
      const cooldownElapsed = nowMs - lastSentMs >= twelveHoursMs;
      if (cooldownElapsed) {
        const triggerType: EmailTriggerType = isPastDue ? 'auto_overdue' : 'auto_due_soon';
        const log = await dispatchDueReminderEmail(loan, triggerType);
        sentEmails.push(log);

        const act = libraryStore.addActivity({
          type: 'reminder:sent',
          actorName: 'Sistem Pengingat Email',
          actorRole: 'system',
          summary: `Pengingat jatuh tempo dikirim ke ${loan.userEmail} untuk "${loan.bookTitle}"`,
          targetId: log.id,
        });

        onBroadcast?.('email:sent', log);
        onBroadcast?.('activity:new', act);
        onBroadcast?.('loan:updated', loan);
      }
    }
  }

  if (updatedOverdueCount > 0) {
    libraryStore.save();
  }

  return { updatedOverdueCount, sentEmails };
}
