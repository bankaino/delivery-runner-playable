// beats.mjs — prints the attract demo's event timeline (headless) + demoCheck; dev helper, not part of the build.
//   node tools/beats.mjs [--set KEY=value ...]
import path from 'node:path'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
global.window = undefined; const SIM = req(path.join(root, 'live', 'sim.js'));
const args = process.argv.slice(2); args.forEach((a, i) => { if (args[i - 1] === '--set') { const [k, v] = a.split('='); SIM.K[k] = JSON.parse(v); } }); SIM.build();
const S = SIM.create(), seen = new Set(), out = [];
while (S.t < SIM.L && S.end < 0) { SIM.step(S, SIM.scriptInput(S.t, S)); for (const e of S.ev) { const id = e.k + e.t; if (seen.has(id)) continue; seen.add(id); out.push(`${e.t.toFixed(2)} ${e.k}${e.item ? ':' + e.item : ''}${e.route ? ':' + e.route : ''}${e.n ? '#' + e.n : ''} d=${Math.round(-e.y)} clock=${(S.clock / 60).toFixed(1)}`); } }
console.log(out.join('\n')); const f = SIM.demoCheck(S); console.log(f.length ? 'DEMO FAIL ' + f.join('; ') : 'demo ok', '| end', S.endWhy, S.end.toFixed(1), '| clock left', (S.log.clock / 60).toFixed(2), 'min');
