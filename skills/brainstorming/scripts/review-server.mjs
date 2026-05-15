#!/usr/bin/env node
// Review server — backs the inline-comment system in HTML review files.
// Serves the project's working directory and persists comments to
// `<htmlpath>.comments.json` next to each HTML file.
//
// Usage:
//   node review-server.mjs            # serves $PWD on port 7681
//   REVIEW_PORT=8081 node review-server.mjs
//
// Endpoints:
//   GET  /api/health                          → liveness probe
//   GET  /api/comments?file=<rel-html-path>   → returns { file, comments: [] }
//   POST /api/comments?file=<rel-html-path>   → body: { file, comments: [] }; persists
//   POST /api/shutdown                        → graceful exit
//   GET  /<path>                              → static file from CWD

import http from 'node:http';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

const PORT = parseInt(process.env.REVIEW_PORT || '7681', 10);
const ROOT = process.cwd();
const PID_FILE = process.env.REVIEW_PID_FILE || path.join('/tmp', `claude-review-server-${Buffer.from(ROOT).toString('hex').slice(0, 16)}.pid`);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.md':   'text/markdown; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
};

function safeJoin(rel) {
  const cleaned = (rel || '').replace(/^\/+/, '');
  const abs = path.normalize(path.join(ROOT, cleaned));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    throw new Error('forbidden');
  }
  return abs;
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 5_000_000) { req.destroy(); reject(new Error('payload too large')); } });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  let url;
  try { url = new URL(req.url, `http://localhost:${PORT}`); }
  catch { return sendJson(res, 400, { error: 'bad url' }); }

  try {
    if (url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, uptime: process.uptime(), root: ROOT });
    }

    if (url.pathname === '/api/shutdown' && req.method === 'POST') {
      sendJson(res, 200, { ok: true, shutting_down: true });
      setTimeout(() => { cleanup(); process.exit(0); }, 50);
      return;
    }

    if (url.pathname === '/api/comments') {
      const file = url.searchParams.get('file');
      if (!file) return sendJson(res, 400, { error: 'file param required' });
      if (!file.endsWith('.html')) return sendJson(res, 400, { error: 'file must end in .html' });

      const htmlAbs = safeJoin(file);
      const jsonAbs = htmlAbs.replace(/\.html$/, '.comments.json');

      if (req.method === 'GET') {
        try {
          const content = await fs.readFile(jsonAbs, 'utf8');
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(content);
        } catch {
          return sendJson(res, 200, { file, comments: [] });
        }
      }

      if (req.method === 'POST') {
        const body = await readBody(req);
        let data;
        try { data = JSON.parse(body); }
        catch (e) { return sendJson(res, 400, { error: 'bad json' }); }
        if (!Array.isArray(data?.comments)) return sendJson(res, 400, { error: 'comments array required' });
        await fs.mkdir(path.dirname(jsonAbs), { recursive: true });
        await fs.writeFile(jsonAbs, JSON.stringify(data, null, 2));
        return sendJson(res, 200, { ok: true, file, count: data.comments.length });
      }

      return sendJson(res, 405, { error: 'method not allowed' });
    }

    // Static file serving
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/docs';
    let abs;
    try { abs = safeJoin(p); } catch { return sendJson(res, 403, { error: 'forbidden' }); }

    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) return sendJson(res, 404, { error: 'not found', path: p });

    if (stat.isDirectory()) {
      const entries = (await fs.readdir(abs)).filter(e => !e.startsWith('.')).sort().reverse();
      const items = entries.map(e => {
        const href = path.posix.join(p, e);
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(e)}</a></li>`;
      }).join('');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset=utf-8><title>${escapeHtml(p)}</title><body style="font:14px ui-monospace,Menlo,monospace;padding:32px;background:#0d1117;color:#e6edf3"><h2 style="font-weight:600;font-size:18px">${escapeHtml(p)}</h2><ul style="line-height:1.8">${items || '<li><em style="color:#7d8590">(empty)</em></li>'}</ul><p style="color:#7d8590;margin-top:32px;font-size:12px">review server · root: ${escapeHtml(ROOT)}</p>`);
    }

    const ct = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    const content = await fs.readFile(abs);
    res.writeHead(200, { 'content-type': ct });
    res.end(content);
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
});

function cleanup() {
  try { fssync.unlinkSync(PID_FILE); } catch {}
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[review-server] port ${PORT} already in use — another server is running?`);
  } else {
    console.error(`[review-server] error:`, e);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  try { fssync.writeFileSync(PID_FILE, String(process.pid)); } catch {}
  console.log(`[review-server] http://localhost:${PORT}`);
  console.log(`[review-server] serving ${ROOT}`);
  console.log(`[review-server] pid file: ${PID_FILE}`);
  console.log(`[review-server] runs until POST /api/shutdown or SIGINT/SIGTERM`);
});

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
