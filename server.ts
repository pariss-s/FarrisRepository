import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createApiApp } from './server/app.ts';
import { runDueDateAutomation } from './server/mailer.ts';
import { buildDashboardAnalytics, checkScheduledAutoReport } from './server/reports.ts';

const PORT = Number(process.env.PORT || '3000');

async function startServer() {
  let wssRef: WebSocketServer | null = null;

  function broadcast(event: string, payload: unknown): void {
    if (!wssRef) return;
    const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    for (const client of wssRef.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  const app = createApiApp({
    onBroadcast: broadcast,
    getWsCount: () => (wssRef ? wssRef.clients.size : 0),
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  wssRef = wss;

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        event: 'ws:connected',
        payload: { connectedClients: wss.clients.size },
        timestamp: new Date().toISOString(),
      })
    );
  });

  // --- Frontend Serving (Vite Dev Middleware or Static Production Build) ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Farris Library server running on http://0.0.0.0:${PORT}`);

    await runDueDateAutomation((event, payload) => broadcast(event, payload));
    checkScheduledAutoReport((event, payload) => broadcast(event, payload));

    setInterval(async () => {
      try {
        await runDueDateAutomation((event, payload) => broadcast(event, payload));
        checkScheduledAutoReport((event, payload) => broadcast(event, payload));
        broadcast('stats:updated', buildDashboardAnalytics());
      } catch (err) {
        console.error('Background automation error:', err);
      }
    }, 60_000);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
