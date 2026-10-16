// live/hud.js — «ДОСТАВКА» (concept grocery delivery) HUD on the Canvas2D overlay (view px, VW×VH).
// Top: the order card (4 item glyphs + checkmarks), the game clock (red in the last 3 minutes), a thin progress strip to the door.
// In the world: «+1» / «−1 МИН», fork labels («ДВОР −2 МИН» / «ПРОСПЕКТ»), «ТУРБО-СЕРИЯ!». GENERIC blocks kept from the template: callouts,
// tutorial hand + banner, persistent CTA bar, endcard (headline by endWhy, two-colour logo, coupon card, CTA, replay, footnote, ad-marking slot,
// whole screen = CTA). HUD.hit = tappable rects (index.html: 'cta' → store, 'replay'); HUD.check() = QA (boxes off-screen / overlapping).
(function () {
  const H = KIT.H, HUD = (window.HUD = { hit: [] });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), ease = (x) => 1 - (1 - x) * (1 - x), SS = (a, b, x) => { const q = clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  const GRAPH = [0.12, 0.14, 0.2], GRAPH2 = [0.07, 0.08, 0.12], TEAL = [1, 0.8, 0], TEAL2 = [0.85, 0.66, 0], CORAL = [1, 0.44, 0.35], CORAL2 = [0.88, 0.32, 0.24], CREAM = [1, 0.965, 0.925];
  const BRAND = 'ДОСТАВКА', PROMO = 'ДОСТАВКА30';   // generic concept name (no real brand)
  const NAME = { milk: 'молоко', bread: 'хлеб', apple: 'яблоко', cheese: 'сыр' };
  const mmss = (s) => { const m = Math.floor(s / 60), r = Math.floor(s % 60); return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0'); };

  // item glyphs drawn in code (no image bytes)
  const glyph = (kind, x, y, r) => { const c = H.ctx; c.save(); c.translate(x, y);
    if (kind === 'milk') { c.fillStyle = '#fff'; c.fillRect(-r * 0.5, -r * 0.45, r, r * 1.2); c.fillStyle = '#ffcc00'; c.fillRect(-r * 0.5, r * 0.1, r, r * 0.35); c.beginPath(); c.moveTo(-r * 0.5, -r * 0.45); c.lineTo(0, -r * 0.9); c.lineTo(r * 0.5, -r * 0.45); c.fillStyle = '#e8eef0'; c.fill(); }
    else if (kind === 'bread') { c.fillStyle = '#d99a4e'; c.beginPath(); c.ellipse(0, 0, r * 0.95, r * 0.5, -0.3, 0, 7); c.fill(); c.strokeStyle = '#a8692a'; c.lineWidth = r * 0.1; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * r * 0.35 - r * 0.12, -r * 0.25); c.lineTo(i * r * 0.35 + r * 0.12, r * 0.15); c.stroke(); } }
    else if (kind === 'apple') { c.fillStyle = '#e0352b'; c.beginPath(); c.arc(-r * 0.25, r * 0.05, r * 0.55, 0, 7); c.arc(r * 0.25, r * 0.05, r * 0.55, 0, 7); c.fill(); c.fillStyle = '#4a9e3a'; c.beginPath(); c.ellipse(r * 0.25, -r * 0.6, r * 0.3, r * 0.14, -0.5, 0, 7); c.fill(); }
    else if (kind === 'cheese') { c.fillStyle = '#f5c542'; c.beginPath(); c.moveTo(-r * 0.9, r * 0.5); c.lineTo(r * 0.9, r * 0.5); c.lineTo(r * 0.9, -r * 0.1); c.lineTo(-r * 0.9, r * 0.1); c.closePath(); c.fill(); c.fillStyle = '#d9a520'; c.beginPath(); c.arc(-r * 0.2, r * 0.28, r * 0.12, 0, 7); c.arc(r * 0.45, r * 0.2, r * 0.09, 0, 7); c.fill(); }
    c.restore(); };
  const check = (x, y, r, on, pop) => { const c = H.ctx; H.ctx.lineWidth = 6; c.strokeStyle = on ? '#ffcc00' : '#c9ced6'; c.fillStyle = on ? '#ffcc00' : '#fff'; H.rr(x - r, y - r, r * 2, r * 2, r * 0.35); c.fill(); c.stroke();
    if (on) { const s = pop; c.strokeStyle = '#1f1f1f'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * 0.5 * s, y); c.lineTo(x - r * 0.1 * s, y + r * 0.4 * s); c.lineTo(x + r * 0.55 * s, y - r * 0.45 * s); c.stroke(); c.lineCap = 'butt'; } };
  const dashed = (x, y, w, h, r) => { const c = H.ctx; c.save(); c.setLineDash([22, 14]); c.lineWidth = 6; c.strokeStyle = '#ffcc00'; H.rr(x, y, w, h, r); c.stroke(); c.restore(); };

  HUD.draw = (ST, t, proj) => {
    const W = H.W, Hh = H.Hh, GT = ST.t, K = SIM.K, c = H.ctx, live = ST.end < 0;
    H.begin(); const hit = [];
    // ---- top: the order card (glyphs + checks), the clock pill, a thin progress strip to the door ----
    if (live) { const cx = 40, cy = 40, cw = W - 80 - 250, ch = 170, FLY = 0.45, src = proj(ST.x, -ST.d, 2.2) || [W / 2, Hh * 0.65];
      const wr = ST.ev.filter((e) => e.k === 'wrong').pop(), wa = wr ? GT - wr.t : 9, shake = wa < 0.4 ? 14 * (1 - wa / 0.4) * Math.sin(wa * 60) : 0;   // a wrong item shakes the clock
      H.pill(cx, cy, cw, ch, 36, CREAM, [0.97, 0.93, 0.88], 0.96, 'list');
      K.LIST.forEach((k, i) => { const x = cx + cw * (i + 0.5) / K.LIST.length, evs = ST.ev.filter((e) => e.k === 'pick' && e.item === k), ev = evs[evs.length - 1], a = ev ? GT - ev.t - FLY : 9, q = SIM.qty(k);
        const have = (ST.got[k] || 0) - (ev && a < 0 ? 1 : 0), got = have >= q, pop = a < 0.25 ? 0.5 + 0.5 * ease(a / 0.25) : 1;   // the count ticks when the flying item lands
        glyph(k, x, cy + 60, 40 * (a >= 0 && a < 0.3 ? 1 + 0.35 * Math.sin(a / 0.3 * Math.PI) : 1));
        if (got || q === 1) check(x, cy + 130, 26, got, pop); else H.label(have + '/' + q, x, cy + 132, { size: Math.round(40 * (a >= 0 && a < 0.25 ? 1 + 0.3 * Math.sin(a / 0.25 * Math.PI) : 1)), col: have ? '#1f1f1f' : '#9aa4ad', al: 0.5 });
        if (ev && a >= 0 && a < 0.35) H.ring(x, cy + 70, 40 + 70 * ease(a / 0.35), [1, 0.8, 0], 1 - a / 0.35, 8);
        for (const fe of evs) { const a = GT - fe.t - FLY; if (!(a < 0 && a > -FLY)) continue; const q = ease((a + FLY) / FLY), fx = src[0] + (x - src[0]) * q, fy = src[1] + (cy + 58 - src[1]) * q - 260 * Math.sin(q * Math.PI);   // the item flies from the courier into its slot
          const gr = 30 + 22 * Math.sin(q * Math.PI); H.glow(fx, fy, 90, [1, 0.9, 0.4], 0.6); c.fillStyle = '#1f2433'; c.beginPath(); c.arc(fx, fy, gr * 1.45, 0, 7); c.fill(); c.lineWidth = 6; c.strokeStyle = '#ffe066'; c.stroke(); glyph(k, fx, fy, gr); } });
      const tx = W - 40 - 230 + shake, low = K.TIMER && ST.clock < 180, pul = low ? 1 + 0.05 * Math.sin(t * 10) : 1;
      if (K.TIMER) { H.pill(tx, cy, 230, ch, 36, low || wa < 0.4 ? CORAL : GRAPH, low || wa < 0.4 ? CORAL2 : GRAPH2, 0.94, 'clock'); H.label(mmss(ST.clock), tx + 115, cy + 82, { size: Math.round(66 * pul), col: '#fff', al: 0.5 });
        if (GT - ST.streakT < K.STREAK_T) H.label('×0.5', tx + 115, cy + 140, { size: 34, col: '#fff1a8', al: 0.5 });
        if (wa < 0.9) H.label('−' + mmss(K.WRONG_MIN * 60), tx + 115, cy + ch + 160 + 40 * ease(wa / 0.9), { size: 60, col: '#ff8a7a', out: '#5a0d06', al: 0.5, a: 1 - SS(0.6, 0.9, wa) }); }
      else { H.pill(tx, cy, 230, ch, 36, GRAPH, GRAPH2, 0.94, 'clock'); H.label(BRAND, tx + 115, cy + 85, { size: 34, col: '#ffcc00', al: 0.5 }); }
      // tips: a pill under the clock, bumps on every coin
      if (ST.tips > 0 || ST.listT >= 0) { const ce = ST.ev.filter((e) => e.k === 'coin').pop(), ca = ce ? GT - ce.t : 9, b = ca < 0.15 ? 1 + 0.15 * (1 - ca / 0.15) : 1, ty = cy + ch + 52;
        H.pill(W - 40 - 230, ty, 230, 76, 38, GRAPH, GRAPH2, 0.9, 'tips'); c.fillStyle = '#ffcc00'; c.beginPath(); c.arc(W - 40 - 230 + 42, ty + 38, 22 * b, 0, 7); c.fill();
        H.label('₽', W - 40 - 230 + 42, ty + 39, { size: 30, col: '#1f1f1f', al: 0.5 }); H.label(String(ST.tips), W - 40 - 230 + 140, ty + 39, { size: Math.round(44 * b), col: '#fff', al: 0.5 }); }
      // progress strip: courier dot rides to the house icon
      const px = 60, pw = W - 150, py = cy + ch + 26, f = clamp(ST.d / SIM.houseD(ST), 0, 1), dx = px + pw * f;
      H.pill(px, py, pw, 14, 7, GRAPH, GRAPH2, 0.35, 'prog'); H.pill(px, py, Math.max(14, pw * f), 14, 7, TEAL, TEAL2, 0.95);
      c.fillStyle = '#ffcc00'; c.beginPath(); c.arc(dx, py + 7, 17, 0, 7); c.fill(); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke();
      const hx = px + pw + 34, hy = py + 7; c.fillStyle = '#ff6f59'; c.beginPath(); c.moveTo(hx - 20, hy - 2); c.lineTo(hx, hy - 20); c.lineTo(hx + 20, hy - 2); c.lineTo(hx + 15, hy - 2); c.lineTo(hx + 15, hy + 16); c.lineTo(hx - 15, hy + 16); c.lineTo(hx - 15, hy - 2); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.fillRect(hx - 5, hy + 4, 10, 12);
      if (wa < 0.35) { const g = c.createRadialGradient(W / 2, Hh / 2, Hh * 0.3, W / 2, Hh / 2, Hh * 0.7); g.addColorStop(0, 'rgba(255,60,40,0)'); g.addColorStop(1, `rgba(255,60,40,${0.35 * (1 - wa / 0.35)})`); c.fillStyle = g; c.fillRect(0, 0, W, Hh); } }
    // ---- in the world: fork labels over the arches ----
    if (live && !ST.route && SIM.LEVEL.fork.d - ST.d < 2600) { const F = SIM.LEVEL.fork; for (const r of ['yard', 'avenue']) { const p = proj(F[r].x, -(F.d - 220), 0.05); if (!p || p[1] < 420 || p[1] > Hh - 320) continue;   // planted on the road just before each arch
      const k = 0.8 + 0.3 * clamp((p[1] - 300) / (Hh * 0.5), 0, 1), txt = r === 'yard' ? '↑ ДВОР −2 МИН' : '↑ ПРОСПЕКТ', sz = Math.round(54 * k), tw = H.labelW(txt, sz); p[0] = clamp(r === 'yard' ? Math.min(p[0], W / 2 - tw / 2 - 12) : Math.max(p[0], W / 2 + tw / 2 + 12), tw / 2 + 40, W - tw / 2 - 40);   // never overlap the other label
      H.pill(p[0] - tw / 2 - 24, p[1] - sz * 0.75, tw + 48, sz * 1.5, sz * 0.75, r === 'yard' ? CORAL : TEAL, r === 'yard' ? CORAL2 : TEAL2, 0.95); H.label(txt, p[0], p[1], { size: sz, col: r === 'yard' ? '#fff' : '#1f1f1f', al: 0.5 }); } }
    // ---- callouts from events ----
    const BIG = { listDone: 2.0, streak: 1.4, fork: 1.2, deliver: 2.0, late: 2.0 }; let bigE = null;   // only ONE big caption at a time: the newest one still alive
    for (const e of ST.ev) { const a = GT - e.t; if (BIG[e.k] && a >= 0 && a < BIG[e.k] && (!bigE || e.t >= bigE.t)) bigE = e; }
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue; if (BIG[e.k] && e !== bigE) continue;
      const pop = (txt, x, y, life, size, col, out) => { if (a > life) return; const q = a / life, s = size * (a < 0.12 ? 0.6 + 0.4 * a / 0.12 : 1);
        H.label(txt, x, y - 60 * ease(Math.min(1, q * 2)), { size: Math.round(s), col, out, al: 0.5, a: 1 - SS(0.78, 1, q) }); };   // rises in the first half, holds, fades in the last 22 %
      const sq = proj(ST.x, -ST.d, 2.0) || [W / 2, Hh * 0.6];
      if (e.k === 'pick') pop('+1 ' + NAME[e.item], sq[0], sq[1] - 30, 0.8, 64, '#fff', '#2a2200');
      if (e.k === 'wrong') pop(K.TIMER ? (K.WRONG_MIN >= 1 ? '−' + K.WRONG_MIN + ' МИН' : '−' + Math.round(K.WRONG_MIN * 60) + ' СЕК') : 'НЕ ИЗ СПИСКА', sq[0], sq[1] - 30, 0.9, 70, '#ff8a7a', '#5a0d06');
      if (e.k === 'dup') pop('УЖЕ ЕСТЬ', sq[0], sq[1] - 30, 0.7, 52, '#fff', '#3a4250');
      if (e.k === 'slow') pop('ОЙ!', sq[0], sq[1] - 40, 0.6, 60, '#fff', '#5a3a00');
      if (e.k === 'listDone') pop('ЗАКАЗ СОБРАН!', W / 2, Hh * 0.25, BIG.listDone, 104, '#fff', '#2a2200');
      if (e.k === 'boost' && e.n < 3) pop(e.n + '/3', sq[0] + 90, sq[1] - 10, 0.55, 64, '#fff1a8', '#2a2200');
      if (e.k === 'streak') pop('ТУРБО-СЕРИЯ!', W / 2, Hh * 0.25, BIG.streak, a < 0.08 ? 120 : 100, '#fff1a8', '#2a2200');
      if (e.k === 'fork') pop(e.route === 'yard' ? 'КОРОТКИЙ ПУТЬ!' : 'ПО ПРОСПЕКТУ', W / 2, Hh * 0.25, BIG.fork, 76, '#fff', e.route === 'yard' ? '#7a2010' : '#2a2200');
      if (e.k === 'deliver') pop('ДОСТАВИЛИ ЗА ' + Math.max(1, Math.round(K.GAME_MIN - e.clock / 60)) + ' МИН!', W / 2, Hh * 0.25, BIG.deliver, 64, '#fff', '#2a2200');
      if (e.k === 'late') pop('ПОЧТИ УСПЕЛИ!', W / 2, Hh * 0.25, BIG.late, 92, '#fff', '#7a2010');
      if ((e.k === 'listDone' || e.k === 'streak') && a < 0.2) { c.fillStyle = `rgba(255,255,255,${0.3 * (1 - a / 0.2)})`; c.fillRect(0, 0, W, Hh); } }
    // ---- tutorial: the hand swipes left / right (demo and ghost play: where the scripted finger is; play: before the first swipe or after 2.5 s idle) ----
    const ghost = ST.ghostOn, idle = live && !ST.demo && ST.deliverT < 0 && (ST.firstIn < 0 || GT - ST.lastIn > 2.5), showHand = live && (ST.demo ? GT < 2.6 : idle || ghost);
    if (showHand) { const q = (t * 0.7) % 1, hx = ghost || ST.demo ? clamp(540 + ST.tx / K.STEER, 160, 920) : 540 + 190 * Math.sin(q * Math.PI * 2), hy = Hh * 0.8, down = ghost || ST.demo || (q > 0.05 && q < 0.95);
      if (down) H.glow(hx, hy, 70, [1, 1, 1], 0.35);
      const hh = 190 * (down ? 0.92 : 1); if (H.img.hand) H.sprite('hand', hx - hh * 0.54 * 0.33, hy - hh * 0.03, hh * 0.54, hh); else H.ring(hx, hy, 40, [1, 1, 1], 0.9, 14);
      if (ST.firstIn < 0 && GT < 6) { const b = 1 + 0.04 * Math.sin(t * 6), sz = Math.round(58 * b), txt = 'СВАЙПАЙ, ЧТОБЫ СОБРАТЬ', tw = H.labelW(txt, sz);
        H.pill(W / 2 - tw / 2 - 36, Hh * 0.3 - 52, tw + 72, 104, 52, GRAPH, GRAPH2, 0.78, 'tut'); H.label(txt, W / 2, Hh * 0.3, { size: sz, col: '#fff', al: 0.5 }); } }
    // ---- persistent CTA bar (store button visible the whole time) ----
    if (live) { const bw = 400, bh = 124, bx = W - bw - 36, by = Hh - bh - 44, pul = 1 + 0.03 * Math.sin(t * 5);
      H.pill(24, by - 18, W - 48, bh + 36, 30, GRAPH, GRAPH2, 0.78);
      H.label(BRAND, 64, by + bh / 2, { size: 46, col: '#ffcc00', id: 'brand' });
      H.pill(bx - (pul - 1) * bw / 2, by - (pul - 1) * bh / 2, bw * pul, bh * pul, bh / 2, CORAL, CORAL2, 1, 'cta');
      H.label('Заказать', bx + bw / 2, by + bh / 2, { size: 56, col: '#fff', al: 0.5 });
      hit.push({ id: 'cta', x: bx, y: by, w: bw, h: bh }); }
    // ---- endcard (the world is dimmed in 3D by scene.js; text, coupon and buttons here) ----
    if (ST.end >= 0) { const oy = (Hh - 1920) / 2, a = GT - ST.end, k = SS(0, 0.45, a), pop = (d) => { const q = clamp((a - d) / 0.35, 0, 1); return q < 1 ? 1.12 * ease(q) - 0.12 * q * q : 1; };
      const win = ST.endWhy === 'win', free = K.OFFER === 'free' || ST.endWhy === 'late';
      const head = win ? 'ДОСТАВИЛИ ЗА ' + Math.max(1, Math.round(K.GAME_MIN - (ST.log.clock || 0) / 60)) + ' МИН!' : ST.endWhy === 'late' ? 'ПОЧТИ УСПЕЛИ!' : 'ПРОДУКТЫ ЗА 15 МИНУТ';
      const s1 = pop(0.2); if (s1 > 0.01) { const sz = Math.round(118 * s1);   // the wordmark: yellow on a dark outline
        H.label(BRAND, W / 2, 175 + oy, { size: sz, col: '#ffcc00', out: '#1f1f1f', al: 0.5, id: 'logo' });
        H.label(head, W / 2, 335 + oy, { size: Math.round((head.length > 18 ? 58 : 70) * s1), col: '#fff', out: '#0b1a22', al: 0.5, id: 'head' }); }
      if (ST.tips > 0 && pop(0.35) > 0.01) H.label('+' + ST.tips + ' ₽ чаевых', W / 2, 428 + oy, { size: Math.round(56 * pop(0.35)), col: '#ffcc00', out: '#1f1f1f', al: 0.5, id: 'tipsEnd' });
      const s2 = pop(0.45); if (s2 > 0.01) { const cw = 820 * s2, chh = 360 * s2, cx = W / 2 - cw / 2, cy = 1090 + oy - chh / 2;   // the coupon card with a dashed border
        H.pill(cx, cy, cw, chh, 44, CREAM, [0.98, 0.94, 0.89], 1, 'coupon'); if (s2 > 0.5) dashed(cx + 18, cy + 18, cw - 36, chh - 36, 30);
        if (s2 > 0.95) { if (free) { H.label('БЕСПЛАТНАЯ', W / 2, cy + 105, { size: 76, col: '#ff6f59', al: 0.5 }); H.label('ДОСТАВКА', W / 2, cy + 190, { size: 76, col: '#ff6f59', al: 0.5 }); H.label('первого заказа', W / 2, cy + 280, { size: 48, col: '#1f2433', al: 0.5 }); }
          else { H.label('−30%', W / 2, cy + 115, { size: 130, col: '#ff6f59', al: 0.5 }); H.label('на первый заказ', W / 2, cy + 215, { size: 48, col: '#1f2433', al: 0.5 }); H.label('промокод ' + PROMO, W / 2, cy + 290, { size: 46, col: '#1f1f1f', al: 0.5 }); } } }
      const s3 = pop(0.7), pul = 1 + 0.045 * Math.sin(t * 6), bw = 760 * s3 * pul, bh = 170 * s3 * pul, bx = W / 2 - bw / 2, by = 1420 + oy - bh / 2;
      if (s3 > 0.01) { H.glow(W / 2, 1420 + oy, 420, [1, 0.6, 0.45], 0.3);
        H.pill(bx, by + 12, bw, bh, bh / 2, [0.6, 0.2, 0.12], [0.5, 0.15, 0.1]); H.pill(bx, by, bw, bh, bh / 2, CORAL, CORAL2, 1, 'endcta');
        H.label('Заказать', W / 2, by + bh / 2, { size: Math.round(86 * s3), col: '#fff', al: 0.5 });
        hit.push({ id: 'cta', x: bx, y: by, w: bw, h: bh }); }
      if (a > 1.2) { const fa = SS(1.2, 1.6, a); H.pill(W / 2 - 200, 1595 + oy - 46, 400, 92, 46, GRAPH, GRAPH2, 0.88 * fa); H.label('↻ ЕЩЁ РАЗ', W / 2, 1595 + oy, { size: 50, col: '#ffcc00', al: 0.5, a: fa, id: 'replay' });   // solid pill: readable on any background
        hit.unshift({ id: 'replay', x: W / 2 - 220, y: 1540 + oy, w: 440, h: 110 });
        H.pill(40, Hh - 196, W - 80, 136, 30, GRAPH, GRAPH2, 0.78 * fa);   // legal block: its own dark plate
        H.label('Концепт. Бренд и промокод вымышлены', W / 2, Hh - 158, { size: 30, col: '#ffffff', al: 0.5, a: fa, id: 'note' });
        H.label('Реклама · ООО «Рекламодатель» · erid: XXXXXXXXXX', W / 2, Hh - 104, { size: 30, col: '#cfd6dc', al: 0.5, a: fa, id: 'mark' }); }   // placeholder: the real text comes from the client's lawyers
      if (a > 0.6) hit.push({ id: 'cta', x: 0, y: 0, w: W, h: Hh }); }
    HUD.hit = hit;
  };
  // QA: pills and labels that leave the screen or overlap (the CTA bar holds brand + button)
  HUD.check = () => H.check(['brand', 'cta']);
})();
