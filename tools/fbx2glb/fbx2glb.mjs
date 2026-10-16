// fbx2glb.mjs — converts a Tripo/Meshy FBX (static or rigged) to GLB in headless Chromium: three FBXLoader → GLTFExporter.
// Materials become MeshStandard with the base-colour map only (≤ 1024 px). Then compress it (gltf-transform + meshopt). Dev tool, not part of the build.
//   node tools/fbx2glb/fbx2glb.mjs IN.fbx OUT.glb
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
const [, , model, out] = process.argv, tool = path.dirname(new URL(import.meta.url).pathname), three = process.env.THREE_DIR || path.resolve(tool, '../../node_modules/three');
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u === '/model.fbx' ? path.resolve(model) : u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(tool, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/conv.html`); await p.waitForFunction(() => window.__info, null, { timeout: 90000 });
const info = await p.evaluate(() => window.__info); if (info.glb) fs.writeFileSync(out, Buffer.from(info.glb, 'base64')); delete info.glb;
console.log(out, info.bytes ? (info.bytes / 1024).toFixed(0) + ' KB' : '', info.errs.length ? 'ERR ' + info.errs[0] : 'ok', errs.slice(0, 2).join(' | ')); await b.close(); srv.close();
