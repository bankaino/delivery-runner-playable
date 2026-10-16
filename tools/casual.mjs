// casual.mjs — 300 seeded players play the ad headless; prints on-time / late %, full list %, wrong items, route, clock left.
//   node tools/casual.mjs [--n 300] [--profile casual|good] [--variant name] [--set KEY=value ...] [--quiet]
// A player = the SIM planner with human flaws : reaction, aim noise, a finger that moves at a
// finite speed, a chance per row to grab an extra by mistake, avenue instead of the yard, ignoring boosters / obstacles; 12 % of the
// casuals barely steer (stay in the middle). Targets: casual on time 60–70 %, full list ≥ 80 %; good on time ≥ 90 %.
// Tune ROW_D, WRONG_MIN, SEC_PER_MIN, SLOW_*, BOOST_*, STREAK_SLOW until the corridors hold.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
global.window = undefined; const SIM = req(path.join(root, 'live', 'sim.js'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const N = +opt('n', 300), variant = opt('variant', ''), quiet = args.includes('--quiet'), GOOD = opt('profile', 'casual') === 'good';
if (variant) { const v = JSON.parse(fs.readFileSync(path.join(root, 'variants', variant + '.json'), 'utf8')); Object.assign(SIM.K, v.K || {}); }
args.forEach((a, i) => { if (args[i - 1] === '--set') { const [k, v] = a.split('='); SIM.K[k] = JSON.parse(v); } });
SIM.build();
const h = SIM.h1;

function player(seed) {
  const r = (j) => h(seed * 17 + j), bad = !GOOD && r(1) < 0.08;
  if (GOOD) return { bad, react: 0.15 + 0.2 * r(2), noise: 30, touch: 0.2 + 0.4 * r(3), speed: 2000 + 1200 * r(4),
    pol: { fork: r(5) < 0.9 ? 'yard' : 'avenue', wrong: 0.04, boosts: r(6) < 0.9, dodge: r(7) < 0.9, stay: false } };
  return { bad, react: 0.3 + 0.5 * r(2), noise: 75, touch: 0.2 + 0.8 * r(3), speed: 1100 + 1200 * r(4),
    pol: { fork: r(5) < 0.65 ? 'yard' : 'avenue', wrong: 0.06 + 0.1 * r(9), boosts: r(6) < 0.55, dodge: r(7) < 0.6, stay: bad } };
}
function play(seed) {
  const P = player(seed), S = SIM.spawn(0); let tgt = 0, next = 0, fx = 540, pressed = false, k = 0;
  while (S.end < 0 && S.t < 40) {
    if (S.t >= P.touch) { pressed = true;
      if (S.t >= next) { next = S.t + P.react; tgt = SIM.plan(S, P.pol, seed) + P.noise * (h(seed * 31 + ++k) * 2 - 1); }
      const want = SIM.inputFor(S, tgt).px, dx = want - fx, mv = P.speed * SIM.DT; fx += Math.max(-mv, Math.min(mv, dx)); }
    SIM.step(S, pressed ? { press: 1, px: fx } : {});
  }
  return { why: S.endWhy, end: S.end, full: !!S.log.listFull, got: S.nGot, wrong: S.wrong, route: S.route, clock: S.log.clock || 0, obst: S.log.obst, streaks: S.log.streaks, deliver: S.deliverT, bad: P.bad };
}
const res = []; for (let s = 1; s <= N; s++) res.push(play(s));
const pct = (f, a = res) => (a.length ? (100 * a.filter(f).length / a.length).toFixed(0) : '–') + '%', med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : NaN);
console.log(`${GOOD ? 'GOOD' : 'casual'} ${N} players${variant ? ' variant ' + variant : ''}: on time ${pct((x) => x.why === 'win')}  late ${pct((x) => x.why === 'late')}  other ${pct((x) => x.why !== 'win' && x.why !== 'late')}  | full list ${pct((x) => x.full)}  | yard ${pct((x) => x.route === 'yard')}`);
console.log(`median: clock left ${(med(res.map((x) => x.clock)) / 60).toFixed(1)} min, wrong ${med(res.map((x) => x.wrong))}, obstacles ${med(res.map((x) => x.obst))}, streaks ${med(res.map((x) => x.streaks))}, deliver ${med(res.map((x) => x.deliver)).toFixed(1)} s, end max ${Math.max(...res.map((x) => x.end)).toFixed(1)} s`);
if (!quiet) { const row = (name, a) => a.length && console.log(`  ${name.padEnd(18)} n=${String(a.length).padStart(3)} on time ${pct((x) => x.why === 'win', a)}  full ${pct((x) => x.full, a)}  clock ${(med(a.map((x) => x.clock)) / 60).toFixed(1)} min`);
  row('stay (bad)', res.filter((x) => x.bad)); row('yard', res.filter((x) => !x.bad && x.route === 'yard')); row('avenue', res.filter((x) => !x.bad && x.route === 'avenue'));
  for (const w of [0, 1, 2, 3]) row('wrong ' + w + (w === 3 ? '+' : ''), res.filter((x) => !x.bad && (w === 3 ? x.wrong >= 3 : x.wrong === w))); }
