import type { Request, Response } from 'express';
import { createApiApp } from '../server/app.ts';
import { runDueDateAutomation } from '../server/mailer.ts';
import { checkScheduledAutoReport } from '../server/reports.ts';

const app = createApiApp();
let coldStartInitialized = false;

async function ensureInitialized() {
  if (coldStartInitialized) return;
  coldStartInitialized = true;
  try {
    await runDueDateAutomation();
    checkScheduledAutoReport();
  } catch (err) {
    console.error('Serverless cold-start automation error:', err);
  }
}

export default async function handler(req: Request, res: Response) {
  await ensureInitialized();
  return app(req, res);
}
