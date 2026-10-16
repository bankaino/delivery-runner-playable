// live/sim.js — «ДОСТАВКА» (concept grocery delivery) playable ad: deterministic lane-runner sim, fixed 120 Hz.
// Loop: swipe to steer a scooter courier → rows of groceries (take the one from the list, skip the extras) → list done = turbo →
// car-free boulevard with booster chains and obstacles → fork (yard: shorter, obstacles / avenue: longer, clean) → the customer's door → endcard.
// World in px: x right, y down, forward = −y (the courier stands at y = −d). The game clock counts 15 game minutes down at
// SEC_PER_MIN real seconds per minute. Every reaction lives here; the scene only draws.
(function (root) {
  const DT = 1 / 120, L = 30.0;
  const ASPECT = typeof window !== 'undefined' && window.innerWidth ? window.innerHeight / window.innerWidth : 16 / 9;
  const VIEW = { W: 1080, H: Math.round(1080 * Math.max(16 / 9, Math.min(19.5 / 9, ASPECT))) };
  const HINT = 'swipe left / right · grab what is on the list · skip the extras · ride the boosters · deliver in time';
  const K = {
    RW: 215, LANES: [-140, 0, 140], STEER: 0.9, FOLLOW: 9, KEYS: 520, RUN: 560, ACC_T: 0.6, UNIT_R: 40,
    GAME_MIN: 15, SEC_PER_MIN: 1.45, TIMER: true, WRONG_MIN: 0.5, OFFER: 'promo',
    LIST: ['milk', 'bread', 'apple', 'cheese'], QTY: { milk: 3, bread: 2, apple: 4, cheese: 3 }, EXTRA: ['chips', 'soda'], EXTRA_N: 1,   // the order: 12 items (QTY missing = 1 each)
    ROW0_D: 480, ROW_D: 520, ROWS_N: 12, TRAIN_GAP: 170, TRAINS: [[2, 1], [2, 0], [1, 0], [3, 1], [2, 0], [1, 0], [2, 1], [2, 0], [3, 1], [2, 1], [2, 0], [2, 1]], ITEM_R: 50, RESOLVE: 5600, REFILL: 2600,   // TRAINS: [items, zigzag] — a zigzag train steps one lane per item;   // a row = a «train» of 1–3 needed items in one lane + extras
    OBST_R: 48, SLOW_T: 0.4, SLOW_K: 0.45, TURBO_T: 3, TURBO_K: 1.5,
    BOOST_R: 52, BOOST_GAP: 240, BOOST_K: 0.35, BOOST_T: 1.2, STREAK_SLOW: 0.5, STREAK_T: 2,
    CHAINS: [[6250, 1], [8140, -1]], YARD_CHAIN: [[11000, 0]], AVE_CHAIN: [[10240, 0], [12400, -1]],
    RAMP: 0.4, RAMP_FROM: 4000, TURBO_FADE: 1.4, BOOST_FADE: 0.7, COIN_GAP: 120, COIN_R: 45, COIN_TIP: 10,
    COINS: [[4450, 0, 'line', 8], [5400, -1, 'hop', 6], [6950, -1, 'line', 3], [7550, 1, 'zig', 6], [8900, 0, 'zig', 8],
      [9500, 1, 'line', 4, 'yard'], [10250, -1, 'hop', 6, 'yard'], [11600, 1, 'zig', 6, 'yard'], [12150, -1, 'line', 4, 'yard'], [12650, 0, 'zig', 6, 'yard'],
      [9500, 0, 'zig', 8, 'avenue'], [10900, 1, 'line', 6, 'avenue'], [11800, -1, 'hop', 6, 'avenue'], [12900, 0, 'zig', 8, 'avenue'], [13900, 1, 'line', 6, 'avenue']],
    FORK_D: 7370, SHORT_D: 1890, HOUSE_D: 15000, YARD_OBST: [10000, 11900, 12500],
    GHOST_T: 2.0, END_AFTER_DELIVER: 2.0, END_MAX: 28, END_NO_INPUT: 12, END_IDLE: 10,
  };

  const h1 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ss = (e0, e1, x) => { const q = clamp((x - e0) / (e1 - e0), 0, 1); return q * q * (3 - 2 * q); };

  // ---------------- the level, as data (rebuilt by build() after a variant overrides K) ----------------
  // rows: three lanes, one lane gets a train of 1–3 needed items (decided when the row comes RESOLVE px close: the first kind still missing,
  // as many as are still needed, up to the train length from the hash), one or two lanes get extras. Obstacles sit between rows. Boosters: chains of 3 pads. The fork splits into yard / avenue content.
  let LEVEL = null;
  function build() {
    const o = { rows: [], obst: [], pads: [] }; let id = 0;
    const NL = K.LANES.length;
    let prev = 1;                                                                          // lane where the previous train ended: the next one never starts there
    for (let i = 0; i < K.ROWS_N; i++) { const d = K.ROW0_D + i * K.ROW_D, [train, zig] = K.TRAINS[i % K.TRAINS.length], others = [0, 1, 2].filter((l) => l !== prev);
      const start = others[Math.floor(h1(i * 3 + 1) * others.length)], dir = start === 0 ? 1 : start === 2 ? -1 : (h1(i * 5 + 2) < 0.5 ? 1 : -1), path = [];
      for (let j = 0, l = start, dd = dir; j < 3; j++) { path.push(l); if (zig) { if (l + dd < 0 || l + dd > 2) dd = -dd; l += dd; } }
      const slots = [0, 1, 2].filter((l) => l !== start && l !== prev && l !== path[1]).slice(0, K.EXTRA_N);   // one extra, never in the obstacle lane or on the zigzag
      o.rows.push({ id: i, d, need: start, path, train, extras: slots.map((j, k) => ({ lane: j, kind: K.EXTRA[(i + k) % K.EXTRA.length] })) });
      if (i > 0) o.obst.push({ id: id++, x: K.LANES[prev], d: d - K.ROW_D * 0.42, kind: i % 3 === 1 ? 'cone' : i % 3 === 2 ? 'box' : 'puddle', route: '' });   // riding straight on hits this
      prev = path[Math.min(train, 3) - 1]; }
    // delivery: boosters (lane index −1/0/1 = left/mid/right) and obstacles flanking them
    const chain = (d0, li, route) => { for (let j = 0; j < 3; j++) o.pads.push({ id: id++, chain: d0, x: K.LANES[li + 1], d: d0 + j * K.BOOST_GAP, route }); };
    K.CHAINS.forEach(([d, li], i) => { chain(d, li, ''); o.obst.push({ id: id++, x: K.LANES[(li + 2) % 3], d: d + K.BOOST_GAP * 1.5, kind: i % 2 ? 'puddle' : 'cart', route: '' }); });
    K.YARD_CHAIN.forEach(([d, li]) => chain(d, li, 'yard')); K.AVE_CHAIN.forEach(([d, li]) => chain(d, li, 'avenue'));
    K.YARD_OBST.forEach((d, i) => o.obst.push({ id: id++, x: K.LANES[Math.floor(h1(i * 11 + 4) * 3)], d, kind: ['box', 'puddle', 'cone'][i % 3], route: 'yard' }));
    // tips: coin trails in the delivery phase ([d0, lane −1/0/1, pattern, count, route]); line = one lane, zig = 0-1-2-1…, hop = half in a lane, half in the next
    o.coins = []; for (const [d0, li, pat, n, route] of K.COINS) { const l0 = li + 1;
      for (let j = 0; j < n; j++) { const lane = pat === 'zig' ? [0, 1, 2, 1][(l0 + j) % 4] : pat === 'hop' ? clamp(l0 + (j >= n / 2 ? (l0 === 2 ? -1 : 1) : 0), 0, 2) : l0;
        o.coins.push({ id: id++, x: K.LANES[lane], d: d0 + j * K.COIN_GAP, route: route || '' }); } }
    o.fork = { d: K.FORK_D, yard: { x: -108, hw: 108 }, avenue: { x: 108, hw: 108 } };
    LEVEL = o; return o;
  }
  const houseD = (S) => (S.route === 'yard' ? K.HOUSE_D - K.SHORT_D : K.HOUSE_D);

  const push = (S, e) => { S.ev.push(e); const l = S.log; if (l.first[e.k] === undefined) l.first[e.k] = e.t; l.n[e.k] = (l.n[e.k] || 0) + 1; return e; };

  function create() {
    if (!LEVEL) build();
    const S = { t: 0, steps: 0, wt0: 0, ev: [], cam: [0, -330], zoom: 1, x: 0, tx: 0, d: 0, v: 0, anc: null, ghostOn: false, demoX: 540,
      got: {}, nGot: 0, wrong: 0, clock: K.GAME_MIN * 60, slowT: -9, turboT: -9, boostT: -9, streakT: -9, chainHits: {}, route: '',
      rows: LEVEL.rows.map((r) => ({ id: r.id, d: r.d, need: r.need, path: r.path, train: r.train, extras: r.extras.map((e) => Object.assign({ st: 0 }, e)), kind: null, n: 0, hit: [], st: 0, resT: -9 })),
      obst: LEVEL.obst.map((b) => Object.assign({ st: 0, hitT: -9 }, b)), pads: LEVEL.pads.map((p) => Object.assign({ st: 0, hitT: -9 }, p)),
      listT: -1, deliverT: -1, late: false, money: 0, tips: 0, coins: LEVEL.coins.map((c) => Object.assign({ st: 0 }, c)), end: -1, endWhy: '', firstIn: -1, lastIn: 0, log: { first: {}, n: {}, picks: 0, boosts: 0, streaks: 0, obst: 0, coins: 0 } };
    return S;
  }
  const spawn = (worldT) => Object.assign(create(), { wt0: worldT });
  const respawn = (S, worldT) => spawn(worldT);
  const outOfPlay = () => false;
  const qty = (k) => (K.QTY && K.QTY[k]) || 1, total = () => K.LIST.reduce((a, k) => a + qty(k), 0);
  const missing = (S) => K.LIST.filter((k) => (S.got[k] || 0) < qty(k));
  const listDone = (S) => S.nGot >= total();
  const trainD = (r, j) => r.d + j * K.TRAIN_GAP;

  // ---------------- one step ----------------
  function step(S, inp) {
    const t = S.t + DT; S.t = t; S.steps++; inp = inp || {};
    if (S.steps % 60 === 0 && S.ev.length && S.ev[0].t < t - 4) S.ev = S.ev.filter((e) => e.t > t - 4);
    // ---- input: a relative swipe (the finger's x offset moves the lane target); until the first real touch the demo finger plays (ghost) ----
    let ghost = false; if (S.firstIn < 0 && !inp.press && t < K.GHOST_T && S.end < 0) { inp = scriptInput(t, S); ghost = true; }
    const lim = K.RW - K.UNIT_R, live = inp.press && inp.px !== undefined, key = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (S.deliverT < 0) {
      if (live) { if (!S.anc || (S.ghostOn && !ghost)) S.anc = [inp.px, S.tx]; S.tx = clamp(S.anc[1] + (inp.px - S.anc[0]) * K.STEER, -lim, lim); } else S.anc = null;
      if (key && S.end < 0) S.tx = clamp(S.tx + key * K.KEYS * DT, -lim, lim);
    }
    if (ghost) S.demoX = inp.px;
    S.ghostOn = ghost; if ((live || key) && !ghost) { S.lastIn = t; if (S.firstIn < 0) S.firstIn = t; }

    if (S.end < 0 && S.deliverT < 0) {
      // ---- speed: launch from the dark store, slowed by obstacles, turbo after the list, boosters stack on top ----
      // the base speed only grows along the route; turbo / boosters fade out instead of cutting off
      const fade = (a, hold, out) => (a < 0 ? 0 : a < hold ? 1 : 1 - ss(hold, hold + out, a));
      let m = Math.min(1, t / K.ACC_T) * (1 + K.RAMP * clamp((S.d - K.RAMP_FROM) / (K.HOUSE_D - K.RAMP_FROM), 0, 1));   // the ramp starts after the collecting zone
      if (t - S.slowT < K.SLOW_T) m *= K.SLOW_K;
      m *= 1 + (K.TURBO_K - 1) * fade(t - S.turboT, K.TURBO_T, K.TURBO_FADE);
      m *= 1 + K.BOOST_K * fade(t - S.boostT, K.BOOST_T, K.BOOST_FADE);
      S.v = K.RUN * m; const d0 = S.d; S.d += S.v * DT; S.x += (S.tx - S.x) * Math.min(1, K.FOLLOW * DT);
      // ---- game clock: real seconds → game seconds; a booster streak makes the clock crawl ----
      if (K.TIMER) { const rate = 60 / K.SEC_PER_MIN * (t - S.streakT < K.STREAK_T ? K.STREAK_SLOW : 1); S.clock = Math.max(0, S.clock - rate * DT); }
      const near = (x, r) => Math.abs(S.x - x) < r + K.UNIT_R;
      // ---- rows: resolve the needed item when the row comes close; pick by overlap when the courier crosses the row ----
      for (const r of S.rows) { if (r.st) continue;
        if (r.kind === 'none' && r.d - S.d > K.REFILL && !listDone(S) && S.rows.some((q) => q.st === 1 && q.kind !== 'none' && q.hit.some((h) => h === 0))) r.kind = null;   // a miss upstream: a far spare row takes the missing item
        if (r.kind === null && r.d - S.d < K.RESOLVE) { r.resT = t; const pend = S.rows.filter((q) => q.kind && !q.st && q.kind !== 'none'), left = (k) => qty(k) - (S.got[k] || 0) - pend.filter((q) => q.kind === k).reduce((a, q) => a + q.n, 0), free = K.LIST.filter((k) => left(k) > 0);
          r.kind = free.length ? free[r.id % free.length] : 'none'; if (r.kind !== 'none') r.n = Math.min(r.train, left(r.kind));   // kinds take turns
          if (r.kind !== 'none' && r.extras.length > 1 && r.id >= 2) { const dupe = K.LIST.find((k) => (S.got[k] || 0) >= qty(k)); if (dupe && h1(r.id * 13 + 7) < 0.5) r.extras[1].kind = dupe; } }   // a list item you already have enough of: no ring, no penalty
        if (r.kind === 'none' && listDone(S)) { r.st = 2; continue; }                          // the route is cleared once the bag is full
        if (r.kind && r.kind !== 'none') for (let j = 0; j < r.n; j++) { const dj = trainD(r, j), nx = K.LANES[r.path[j]]; if (r.hit[j] !== undefined || !(d0 < dj && S.d >= dj)) continue;
          r.hit[j] = near(nx, K.ITEM_R) ? 1 : 0; if (!r.hit[j]) continue;
          if ((S.got[r.kind] || 0) >= qty(r.kind)) { push(S, { k: 'dup', t, x: nx, y: -dj, item: r.kind }); continue; }
          S.got[r.kind] = (S.got[r.kind] || 0) + 1; S.nGot++; S.log.picks++; push(S, { k: 'pick', t, x: nx, y: -dj, item: r.kind, n: S.nGot, of: S.got[r.kind], row: r.id, j });
          if (listDone(S)) { S.listT = t; S.turboT = t; push(S, { k: 'listDone', t, x: nx, y: -dj }); push(S, { k: 'turbo', t, x: nx, y: -dj });
            for (const q of S.rows) if (!q.st && q !== r) { q.st = 2; push(S, { k: 'clear', t, x: 0, y: -q.d, id: q.id }); } } }
        if (d0 < r.d && S.d >= r.d) for (const e of r.extras) if (near(K.LANES[e.lane], K.ITEM_R)) { e.st = 1;
          if (K.LIST.includes(e.kind)) push(S, { k: 'dup', t, x: K.LANES[e.lane], y: -r.d, item: e.kind });
          else { S.wrong++; if (K.TIMER) S.clock = Math.max(0, S.clock - K.WRONG_MIN * 60); else S.slowT = t; push(S, { k: 'wrong', t, x: K.LANES[e.lane], y: -r.d, item: e.kind }); } }
        if (S.d >= trainD(r, Math.max(0, r.n - 1)) && S.d >= r.d && r.kind !== null) r.st = r.st || 1; }
      // ---- tips: a coin per overlap ----
      for (const c of S.coins) { if (c.st || (c.route && c.route !== S.route) || !(d0 < c.d && S.d >= c.d)) continue; c.st = near(c.x, K.COIN_R) ? 1 : 2;
        if (c.st === 1) { S.tips += K.COIN_TIP; S.log.coins++; push(S, { k: 'coin', t, x: c.x, y: -c.d, n: S.log.coins, id: c.id }); } }
      // ---- obstacles: a stumble, never a fail ----
      for (const b of S.obst) { if (b.st || (b.route && b.route !== S.route)) continue;
        if (d0 < b.d && S.d >= b.d) { b.st = 1; if (near(b.x, K.OBST_R)) { b.hitT = t; S.slowT = t; S.log.obst++; push(S, { k: 'slow', t, x: b.x, y: -b.d, kind: b.kind }); } } }
      // ---- boosters: each pad = a short kick; three in a row = streak (the clock crawls) ----
      for (const p of S.pads) { if (p.st || (p.route && p.route !== S.route)) continue;
        if (d0 < p.d && S.d >= p.d) { p.st = 1; if (near(p.x, K.BOOST_R)) { p.hitT = t; S.boostT = t; S.log.boosts++; S.chainHits[p.chain] = (S.chainHits[p.chain] || 0) + 1; push(S, { k: 'boost', t, x: p.x, y: -p.d, n: S.chainHits[p.chain] });
          if (S.chainHits[p.chain] === 3) { S.streakT = t; S.log.streaks++; push(S, { k: 'streak', t, x: p.x, y: -p.d }); } } } }
      // ---- the fork: the side you are on decides the route ----
      if (!S.route && S.d >= LEVEL.fork.d) { S.route = S.x < 0 ? 'yard' : 'avenue'; const f = LEVEL.fork[S.route]; push(S, { k: 'fork', t, x: f.x, y: -LEVEL.fork.d, route: S.route }); }
      // ---- the door ----
      if (S.d >= houseD(S)) { S.d = houseD(S); S.deliverT = t; S.late = K.TIMER && S.clock <= 0; S.tx = 0; S.log.clock = S.clock; S.log.listFull = listDone(S);
        push(S, { k: S.late ? 'late' : 'deliver', t, x: 0, y: -S.d, clock: S.clock }); }
    } else if (S.deliverT >= 0) { S.v = 0; S.x += (0 - S.x) * Math.min(1, 4 * DT); }
    S.money = S.tips + S.log.picks * 10;
    const why = S.deliverT >= 0 && t - S.deliverT > K.END_AFTER_DELIVER ? (S.late ? 'late' : 'win')
      : S.firstIn >= 0 && t - S.firstIn > K.END_MAX ? 'time' : S.firstIn < 0 && t > K.END_NO_INPUT ? 'time' : S.firstIn >= 0 && t - S.lastIn > K.END_IDLE ? 'time' : '';
    if (S.end < 0 && why) { S.end = t; S.endWhy = why; push(S, { k: 'end', t, x: S.x, y: -S.d, why }); }
    // ---- camera: look point ahead of the courier; pulls back a little on turbo ----
    const zt = t - S.turboT < K.TURBO_T ? 0.9 : 1;
    S.zoom += (zt - S.zoom) * Math.min(1, 2 * DT); S.cam[0] += (S.x * 0.5 - S.cam[0]) * Math.min(1, 6 * DT); S.cam[1] += (-S.d - 520 - S.cam[1]) * Math.min(1, 6 * DT);
    return S;
  }

  // ---------------- the planner: what a good (or a casual) player aims at; used by the demo and by tools/casual.mjs ----------------
  // pol: fork 'yard' | 'avenue', wrong = probability per row of grabbing an extra by mistake, boosts = rides booster chains, dodge = avoids obstacles
  const POL = { fork: 'yard', wrong: 0, boosts: true, dodge: true, stay: false };
  const LOOK = 900;
  function plan(S, pol, seed) {
    pol = pol || POL; if (pol.stay) return 0;
    const d = S.d; let x = null, key = 1e9;
    for (const r of S.rows) { if (r.st || trainD(r, Math.max(0, r.n - 1)) < d - 20 || r.d - d > LOOK) continue;
      let lane = null, rd = r.d; if (r.kind && r.kind !== 'none') for (let j = 0; j < r.n; j++) { const dj = trainD(r, j); if (dj >= d - 20) { lane = r.path[j]; rd = dj; break; } }
      if (pol.wrong && r.extras.length && h1(r.id * 31 + (seed || 0) * 7.3) < pol.wrong) lane = r.extras[0].lane;     // a casual misreads the row
      if (lane === null && r.kind === 'none') { const busy = r.extras.map((e) => e.lane), freeL = [0, 1, 2].filter((l) => !busy.includes(l)); if (freeL.length) lane = freeL.reduce((a, l) => (Math.abs(K.LANES[l] - S.x) < Math.abs(K.LANES[a] - S.x) ? l : a)); }   // nothing to take: stay clear of the extras
      if (lane !== null && rd < key) { key = rd; x = K.LANES[lane]; } }
    if (pol.boosts) for (const p of S.pads) { if (p.st || (p.route && p.route !== S.route) || p.d < d - 20 || p.d - d > LOOK) continue; if (p.d < key) { key = p.d; x = p.x; } }
    if (!S.route && LEVEL.fork.d - d < LOOK && LEVEL.fork.d < key) { key = LEVEL.fork.d; x = LEVEL.fork[pol.fork].x; }
    if (x === null && pol.coins !== false) for (const c of S.coins) { if (c.st || (c.route && c.route !== S.route) || c.d < d - 20 || c.d - d > 500) continue; if (c.d < key) { key = c.d; x = c.x; } }   // tips only when nothing more important is ahead
    if (x === null) x = S.x;
    // dodge: an obstacle on the way before the target → pick the lane next to it that is closest to the target
    if (pol.dodge) for (const b of S.obst) { if (b.st || (b.route && b.route !== S.route) || b.d < d - 10 || b.d > Math.min(key, d + 600)) continue;
      if (Math.abs(x - b.x) < K.OBST_R + K.UNIT_R + 20) { const alts = K.LANES.filter((lx) => Math.abs(lx - b.x) > 100); x = alts.reduce((a, lx) => (Math.abs(lx - x) < Math.abs(a - x) ? lx : a)); } }
    return clamp(x, -(K.RW - K.UNIT_R), K.RW - K.UNIT_R);
  }
  // the finger that makes the courier aim at world x `tgt` (relative swipe: offset from the anchor, see step)
  const inputFor = (S, tgt) => { const vx = S.anc ? S.anc[0] : 540, x0 = S.anc ? S.anc[1] : S.tx; return { press: 1, px: vx + (tgt - x0) / K.STEER }; };
  const scriptInput = (t, S) => (t < 0.35 || S.end >= 0 ? { press: 0, px: 540 } : inputFor(S, plan(S, POL)));

  let cache = null;
  function at(t) {
    const loop = Math.floor(t / L), q = t - loop * L, n = Math.round(q / DT);
    if (!cache || cache.loop !== loop || cache.S.steps > n) { const S0 = Object.assign(create(), { wt0: loop * L }); cache = { loop, S: S0 }; }
    const S = cache.S; while (S.steps < n) step(S, scriptInput(S.t, S));
    return Object.assign({}, S, { loop, q, demo: true, inp: scriptInput(S.t, S) });
  }
  // the demo must hit every beat of the ad inside its loop (the corridors below)
  const demoCheck = (S) => { const f = [], F = S.log.first, a = (name, v, lo, hi) => { if (!(v >= lo && v <= hi)) f.push(name + ' ' + (v === undefined ? 'never' : (+v).toFixed(1)) + ' not in ' + lo + '–' + hi); };
    a('first pick', F.pick, 0, 2); a('list done', F.listDone, 7, 9.5); if (S.log.n.wrong) f.push(S.log.n.wrong + ' wrong items');
    a('streak', F.streak, 9, 16); a('deliver', F.deliver, 16, 19.5); if (S.log.clock !== undefined && S.log.clock < 180) f.push('only ' + (S.log.clock / 60).toFixed(1) + ' game min left');
    if (S.route !== 'yard') f.push('demo took the ' + S.route); if (S.endWhy !== 'win' || S.end > 22) f.push('end ' + S.endWhy + ' at ' + S.end.toFixed(1));
    return f; };

  build();
  root.SIM = { DT, L, K, VIEW, HINT, qty, total, trainD, build, create, spawn, respawn, outOfPlay, step, at, scriptInput, inputFor, plan, POL, demoCheck, h1, houseD, missing, listDone };
  Object.defineProperty(root.SIM, 'LEVEL', { get: () => LEVEL });
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
