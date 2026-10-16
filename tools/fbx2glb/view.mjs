// view.mjs — dev: node tools/fbx2glb/view.mjs OUT.png a.glb b.glb … (GLB paths relative to tools/fbx2glb/)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
const [, , out, ...files] = process.argv, tool = path.dirname(new URL(import.meta.url).pathname), three = process.env.THREE_DIR || path.resolve(tool, '../../node_modules/three');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(tool, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default'] }), p = await b.newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/view.html?f=${files.join(',')}`); await p.waitForFunction(() => window.__info, null, { timeout: 60000 });
const info = await p.evaluate(() => window.__info); if (info.png) fs.writeFileSync(out, Buffer.from(info.png.split(',')[1], 'base64')); delete info.png; console.log(JSON.stringify(info)); await b.close(); srv.close();
