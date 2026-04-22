import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import translateUrlRouter from './routes/translateUrl.js';
import translateFileRouter from './routes/translateFile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', translateUrlRouter);
app.use('/api', translateFileRouter);

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Serve built frontend from repo root dist so one URL (localhost:3002) works
const hasFrontend = fs.existsSync(DIST_DIR) && fs.existsSync(path.join(DIST_DIR, 'index.html'));

if (hasFrontend) {
  app.use(express.static(DIST_DIR));
  // SPA: any non-API GET that isn't a file gets index.html
  app.get('*', (_, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  // No build yet: show a clear message instead of redirecting to 5173 (avoids connection refused)
  app.get('/', (_, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>Webpage Translator</title></head>
      <body style="font-family:system-ui;max-width:600px;margin:2rem auto;padding:1rem;">
        <h1>Webpage Translator</h1>
        <p>API server is running. To see the app, use one of these:</p>
        <ul>
          <li><strong>One command (recommended):</strong> Run <code>npm run build && node server.js</code> then open <a href="http://localhost:${PORT}">http://localhost:${PORT}</a></li>
          <li><strong>Development (two servers):</strong> Run <code>npm run dev</code> in one terminal, then open <a href="http://localhost:5173">http://localhost:5173</a></li>
        </ul>
        <p><a href="/health">API health</a></p>
      </body>
      </html>
    `);
  });
}

function startServer(port, maxTries = 5) {
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
    if (hasFrontend) console.log(`Open http://localhost:${port} in your browser for the app.`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxTries > 0) {
      const nextPort = Number(port) + 1;
      console.warn(`Port ${port} in use, trying ${nextPort}...`);
      startServer(nextPort, maxTries - 1);
    } else {
      console.error('Server error:', err.message);
      process.exit(1);
    }
  });
}

startServer(PORT);
