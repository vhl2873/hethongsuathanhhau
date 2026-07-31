// Simple static file server for public/, meant to replace VS Code's
// "Live Server" extension during dev. Live Server injects a reload script
// into every response and (on this project) that injection corrupts pages
// with many inline <svg> icons - like partials/header.html - truncating the
// HTML mid-tag so anything after it (the nav bar) never reaches the browser.
// This server does no injection and no URL rewriting, so it always serves
// exactly what's on disk. Run: node scripts/dev-static-server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = process.env.PORT ? Number(process.env.PORT) : 5600;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);

    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Khong tim thay file: ' + urlPath);
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
  })
  .listen(port, () => console.log(`Dang chay tai http://localhost:${port} (goc: ${root})`));
