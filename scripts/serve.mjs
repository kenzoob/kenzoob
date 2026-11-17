// Petit serveur local pour prévisualiser les SVG (clair et sombre côte à côte).
import { createServer } from 'http';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') {
    const only = new URL(req.url, 'http://x').searchParams.get('f');
    const all = [...new Set(readdirSync(join(root, 'assets')).map((f) => f.replace(/-(light|dark)\.svg$/, '')))];
    const names = only ? only.split(',') : all;
    const stack = new URL(req.url, 'http://x').searchParams.has('stack');
    const col = (m, bg) => `<div style="background:${bg};padding:16px;flex:1">${names.map((n) => `<img src="/assets/${n}-${m}.svg?${Date.now()}" style="width:100%;margin-bottom:12px;display:block">`).join('')}</div>`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<body style="margin:0;display:${stack ? 'block' : 'flex'}">${col('light', '#fff')}${col('dark', '#0d1117')}</body>`);
  }
  let buf;
  try { buf = readFileSync(join(root, u)); } catch { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
  res.end(buf);
}).listen(4807);
