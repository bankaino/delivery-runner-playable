// shot.mjs — dev close-up of the live scene: renders one demo moment with an optional camera around the courier, saves a PNG.
//   node tools/shot.mjs OUT.png [t=3] [devCam JSON e.g. '{"dist":3.5,"pitch":0.3,"yaw":0.6,"y":1}'] [--w 540 --h 960]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import http from 'node:http';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const a = process.argv.slice(2), out = a[0], t = +(a[1] || 3), dc = a[2] && /^[[{]/.test(a[2]) ? JSON.parse(a[2]) : null;
const b = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default'] }), p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`); await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const list = Array.isArray(dc) ? dc : [dc];                       // a JSON array renders one PNG per entry: OUT_0.png, OUT_1.png …
for (let i = 0; i < list.length; i++) { const u = await p.evaluate(([t, dc]) => { SCENE.devCam = dc; return window.__renderAt(dc && dc.t !== undefined ? dc.t : t); }, [t, list[i]]);
  fs.writeFileSync(list.length > 1 ? out.replace(/\.png$/, '_' + i + '.png') : out, Buffer.from(u.split(',')[1], 'base64')); } console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3).join(' | ') : 'ok ' + out); await b.close(); srv.close();
