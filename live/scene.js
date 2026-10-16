// live/scene.js — «ДОСТАВКА» (concept grocery delivery) 3D world: draws SIM state with three.js; the HUD on top is hud.js.
// Contract used by index.html / tools: SCENE.init(glCanvas, hudCanvas, VW, VH) → Promise, SCENE.render(t), SCENE.state,
// SCENE.hit (tappable HUD rects, from hud.js), SCENE.stats(), SCENE.probe(), SCENE.QA(), SCENE.proj(xPx, yPx, hM).
// World mapping: sim px → metres with U (x → X, y → Z, forward = −Z, up = Y). Everything is a pure function of (state, t).
// Look (art/style_bible.txt): a sunny car-free boulevard (no cars anywhere — user decision), low-poly shop fronts with awnings, trees and
// planters; the courier is the CC0 Quaternius "Hoodie Character" recoloured teal, standing on a procedural kick-scooter with a teal
// insulated backpack (canvas wordmark) and a teal cap; the customer is the same rig in coral. Flat Lambert + ACES, one shadow-casting sun.
// Dev: SCENE.devCam = { dist, pitch, yaw, y, fov, arm } puts the camera around the courier (tools/shot.mjs).
(function () {
  const T = THREE, S = (window.SCENE = { state: null, hit: [], devCam: null }), U = 0.01, CS = 1.3;   // CS: courier group scale (reads at phone size)
  const K = () => SIM.K, IS = 2.1;   // IS: item scale (torso-sized, reads at phone size)
  const COL = { teal: 0xffcc00, tealD: 0xd9a900, coral: 0xff6f59, coralD: 0xd9533f, graphite: 0x1f2433, cream: 0xfff6ec, asphalt: 0x7e858f, walk: 0xe4ddd0, walk2: 0xd6cdbd, curb: 0xc9ced6,
    wall: [0xf3c9a8, 0xeee6d6, 0xcfe0e8, 0xf0b9a0, 0xe8d7b0, 0xd7e6d2], win: 0x8fc3dc, frame: 0xffffff, roof: 0x7d5a4a, tree: [0x5cae5a, 0x6cbf5c, 0x4f9e52], trunk: 0x7a5236, bush: 0x58a85a,
    item: { milk: 0xf4f6f8, bread: 0xd99a4e, apple: 0xe0352b, cheese: 0xf5c542, chips: 0xff8a1e, soda: 0x3d6fe0 } };
  let R, scene, cam, sun, VW = 1080, VH = 1920, end = {}, gltf;
  const P = {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), ease = (x) => 1 - (1 - x) * (1 - x), SS = (a, b, x) => { const q = clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  const h1 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const M4 = new T.Matrix4(), V3 = new T.Vector3(), Q4 = new T.Quaternion(), E3 = new T.Euler();

  // ---------------- geometry kit (procedural, vertex-coloured, merged → one draw per kind) ----------------
  const tf = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(M4.compose(V3.set(...p), Q4.setFromEuler(E3.set(...r)), new T.Vector3(...s)));
  const col = (g, hex) => KIT.paint(g, hex), mergeG = (a) => T.BufferGeometryUtils.mergeGeometries(a.map((q) => { q = q.index ? q.toNonIndexed() : q; if (q.attributes.uv) q.deleteAttribute('uv'); return q; }));
  const bx = (w, h, d, hex, p, r) => col(tf(new T.BoxGeometry(w, h, d), p, r), hex), cy = (rt, rb, h, n, hex, p, r) => col(tf(new T.CylinderGeometry(rt, rb, h, n), p, r), hex);
  const ico = (r, hex, p, s, det = 0) => col(tf(new T.IcosahedronGeometry(r, det), p, [0, 0, 0], s), hex);
  const tex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; } return t; };

  // kick-scooter, facing −Z, deck top at y = 0.165 (metres before CS)
  const scooterGeo = () => mergeG([
    bx(0.2, 0.05, 0.78, COL.graphite, [0, 0.135, 0.02]), bx(0.21, 0.012, 0.7, 0x3a4050, [0, 0.165, 0.02]), bx(0.06, 0.03, 0.18, COL.teal, [0, 0.12, 0.42], [-0.35, 0, 0]), bx(0.012, 0.03, 0.7, COL.teal, [-0.106, 0.14, 0.02]), bx(0.012, 0.03, 0.7, COL.teal, [0.106, 0.14, 0.02]), bx(0.1, 0.03, 0.02, 0xff3a2a, [0, 0.16, 0.45]),
    cy(0.085, 0.085, 0.06, 12, 0x2a2d33, [0, 0.085, -0.42], [0, 0, Math.PI / 2]), cy(0.085, 0.085, 0.06, 12, 0x2a2d33, [0, 0.085, 0.4], [0, 0, Math.PI / 2]),
    cy(0.04, 0.04, 0.07, 8, 0xc9ced6, [0, 0.085, -0.42], [0, 0, Math.PI / 2]), cy(0.04, 0.04, 0.07, 8, 0xc9ced6, [0, 0.085, 0.4], [0, 0, Math.PI / 2]),
    cy(0.022, 0.022, 0.92, 8, COL.teal, [0, 0.6, -0.37], [0.08, 0, 0]), bx(0.05, 0.08, 0.05, COL.graphite, [0, 0.16, -0.43]),
    cy(0.018, 0.018, 0.44, 8, COL.graphite, [0, 1.04, -0.31], [0, 0, Math.PI / 2]), cy(0.026, 0.026, 0.1, 8, 0x2a2d33, [-0.19, 1.04, -0.31], [0, 0, Math.PI / 2]), cy(0.026, 0.026, 0.1, 8, 0x2a2d33, [0.19, 1.04, -0.31], [0, 0, Math.PI / 2]),
    bx(0.08, 0.05, 0.03, 0xfff3c0, [0, 0.85, -0.44])]);
  const bagGeo = () => mergeG([bx(0.34, 0.36, 0.2, COL.teal, [0, 0.18, 0]), bx(0.02, 0.16, 0.02, COL.tealD, [-0.08, 0.42, 0]), bx(0.02, 0.16, 0.02, COL.tealD, [0.08, 0.42, 0]), bx(0.18, 0.02, 0.02, COL.tealD, [0, 0.5, 0]),
    bx(0.06, 0.14, 0.05, 0xf4f6f8, [-0.07, 0.4, 0.02]), col(tf(new T.CapsuleGeometry(0.04, 0.16, 3, 6), [0.07, 0.38, 0], [0.3, 0, 0.2]), COL.item.bread)]);
  // items, ~0.45 m, sitting on y = 0
  const ITEM = {
    milk: () => mergeG([bx(0.26, 0.34, 0.26, COL.item.milk, [0, 0.17, 0]), bx(0.27, 0.11, 0.27, COL.teal, [0, 0.12, 0]), col(tf(new T.CylinderGeometry(0.0, 0.19, 0.13, 4), [0, 0.405, 0], [0, Math.PI / 4, 0]), 0xe8eef0), cy(0.035, 0.035, 0.05, 8, COL.teal, [0.06, 0.45, 0])]),
    bread: () => mergeG([col(tf(new T.CapsuleGeometry(0.13, 0.34, 4, 8), [0, 0.14, 0], [0, 0, Math.PI / 2], [1, 0.85, 1]), COL.item.bread), ...[-0.12, 0, 0.12].map((x) => bx(0.03, 0.02, 0.16, 0xf2c48a, [x, 0.25, 0], [0, 0.5, 0]))]),
    apple: () => mergeG([ico(0.2, COL.item.apple, [0, 0.2, 0], [1, 0.92, 1], 2), ico(0.12, 0xff6b5e, [-0.06, 0.27, 0.12], [1, 0.8, 0.5], 1), cy(0.016, 0.022, 0.12, 6, COL.trunk, [0.0, 0.43, 0], [0, 0, 0.2]), col(tf(new T.SphereGeometry(0.075, 6, 4), [0.08, 0.42, 0], [0, 0, -0.6], [1.6, 0.25, 0.8]), 0x4fae3e)]),   // ONE apple: body, highlight, stem, leaf
    cheese: () => mergeG([col(tf(new T.CylinderGeometry(0.24, 0.24, 0.2, 3, 1, false, 0, Math.PI * 0.55), [0, 0.1, 0], [0, 0.6, 0]), COL.item.cheese), ...[[0.08, 0.2, 0.05], [0.13, 0.12, -0.04]].map((p) => ico(0.025, 0xd9a520, p))]),
    chips: () => mergeG([bx(0.3, 0.42, 0.12, COL.item.chips, [0, 0.21, 0]), bx(0.32, 0.04, 0.13, 0xd96a00, [0, 0.43, 0]), bx(0.32, 0.04, 0.13, 0xd96a00, [0, 0.0, 0]), ico(0.07, 0xffe066, [0, 0.24, 0.07], [1, 1, 0.3])]),
    soda: () => mergeG([cy(0.1, 0.1, 0.32, 12, COL.item.soda, [0, 0.16, 0]), cy(0.101, 0.101, 0.08, 12, 0xffffff, [0, 0.18, 0]), cy(0.08, 0.1, 0.04, 12, 0xc8ccd2, [0, 0.34, 0])]),
  };
  // facades: painted shop fronts from the Codex atlas (art/gen/facade_tex.png: 4 fronts side by side) on flat quads facing the road; the
  // building bodies behind them are plain boxes in the front's average colour. FAC is the shared layout (cityGeo + facadeGeo).
  const NF = 8, QW = 3.4, QH = QW * 683 / 256, TINT = [0xf1e3c8, 0x8fae8a, 0xc8644a, 0xf2d27a, 0xa9cfe0, 0xf3b79c, 0xe08a6a, 0xf2efe8];   // 8 painted fronts (art/gen/facades8_tex.png)
  const AWN = { 0: COL.coral, 2: COL.teal, 4: COL.teal, 6: COL.coral };   // fronts with a painted awning get a 3D one in the same colour
  const RIVER = 18;   // the river on the left: width in metres (houses stand on the far bank)
  let FAC = [];
  function facadeLayout() { const k = K(), RW = k.RW * U, z0 = 16, z1 = -(k.HOUSE_D + 2800) * U; FAC = [];
    for (const sx of [-1, 1]) { let last = -1; for (let z = z0, i = 0; z > z1; i++) { let q = Math.floor(h1(i * 3 + (sx > 0 ? 11 : 5)) * NF) % NF; if (q === last) q = (q + 3) % NF; last = q;   // neighbours never repeat
      const w = QW, h = QH * (0.94 + 0.12 * h1(i + sx)); FAC.push({ sx, z: z - w / 2, w, h, n: 1, q, tint: TINT[q], far: sx < 0 ? RIVER : 0 }); z -= w + 0.1; } } }   // left side: houses on the far bank of the river
  function facadeGeo() { const k = K(), x0 = k.RW * U + 0.22 + 2.4, P_ = [], N_ = [], UV = [], I = [];
    for (const f of FAC) for (let j = 0; j < f.n; j++) { const za = f.z + f.w / 2 - j * QW, zb = za - QW, x = f.sx * (x0 + f.far - 0.02), u0 = f.q / NF + 0.001, u1 = (f.q + 1) / NF - 0.001, b = P_.length / 3;
      const nx = -f.sx, [zl, zr] = f.sx < 0 ? [za, zb] : [zb, za];                                                            // u runs left → right as seen from the road
      P_.push(x, 0, zl, x, 0, zr, x, f.h, zr, x, f.h, zl); for (let v = 0; v < 4; v++) N_.push(nx, 0, 0); UV.push(u0, 0, u1, 0, u1, 1, u0, 1);
      if (f.sx < 0) I.push(b, b + 1, b + 2, b, b + 2, b + 3); else I.push(b, b + 2, b + 1, b, b + 3, b + 2); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P_, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N_, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); return g; }
  S.CUST = { yaw: Math.PI / 2, h: 1.5, palm: 1.6 };   // the customer (Tripo model, faces +X like the courier): yaw to face group −Z, height (m before CS), wave palm twist
  S.HOUSE = { h: 7.6, x: -0.35, yaw: -Math.PI / 2 };   // the Tripo house: height (m), x so the door is by the courier, yaw so its front faces the street
  S.TREE = { h: 3.6 };   // street tree height (m)
  S.TL = { h: 2.4, stretch: 1.25, yaw: -Math.PI / 2 };   // decor traffic light: height (m), extra vertical stretch for a taller pole, yaw so the lenses face the courier
  // meshopt-quantized attributes (Int16 / Int8, normalized) clamp when a transform is baked in: unpack them to Float32 first
  const dequant = (g) => { for (const n of Object.keys(g.attributes)) { const a = g.attributes[n]; if (a.array instanceof Float32Array && !a.normalized) continue;
    const arr = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(n, new T.BufferAttribute(arr, a.itemSize)); } return g; };
  const LIGHTS = [], TREES = [];
  P.custHand = new THREE.Vector3();   // [x, z] of the decor traffic lights (always green: no cars, no stopping)
  // the boulevard: sidewalks, curbs, shop fronts (windows, awnings), trees, planters, benches, lamps, decor traffic lights (always green), crosswalks
  function cityGeo() {
    const k = K(), RW = k.RW * U, z0 = 16, z1 = -(k.HOUSE_D + 2800) * U, L = z0 - z1, zc = (z0 + z1) / 2, g = [], SW = 2.4;
    for (const sx of [-1, 1]) {
      g.push(bx(0.22, 0.16, L, COL.curb, [sx * (RW + 0.11), 0.08, zc]), bx(SW, 0.12, L, COL.walk, [sx * (RW + 0.22 + SW / 2), 0.06, zc]));
      const bx0 = RW + 0.22 + SW;                                                                                                   // building line
      for (const f of FAC.filter((q) => q.sx === sx)) { const fb = bx0 + f.far, y0 = f.far ? -0.1 : 0; g.push(bx(4.6, f.h * 0.6, f.w - 0.06, new T.Color(f.tint).multiplyScalar(0.72).getHex(), [sx * (fb + 2.4), y0 + f.h * 0.3, f.z]),   // body: lower than the roofline, in shade
        bx(0.25, 0.35, f.w, 0x9a8f80, [sx * (fb + 0.1), 0.17, f.z])); }                                                         // body + roof + a darker plinth (reads as contact shadow)
      // depth on the flat painted fronts: a striped 3D awning over the shop window (fronts that have one painted), pilasters between houses
      for (const f of FAC.filter((q) => q.sx === sx)) { const aw = AWN[f.q], y0 = f.h * 0.33, ww = QW * 0.78, nS = 6, bx0 = RW + 0.22 + SW + f.far;
        if (aw) for (let j = 0; j < nS; j++) g.push(bx(1.05, 0.06, ww / nS, j % 2 ? COL.cream : aw, [sx * (bx0 - 0.45), y0, f.z - ww / 2 + (j + 0.5) * ww / nS], [0, 0, sx * 0.42]));
        if (aw) g.push(bx(0.06, 0.22, ww, aw, [sx * (bx0 - 0.92), y0 - 0.3, f.z]));                                                // the valance
        g.push(bx(0.16, f.h * 0.82, 0.22, new T.Color(f.tint).multiplyScalar(0.85).getHex(), [sx * (bx0 - 0.06), f.h * 0.41, f.z + QW / 2 + 0.05])); }
      if (sx > 0) g.push(bx(0.6, 0.004, L, 0xb9ae9c, [sx * (bx0 - 0.3), 0.124, zc]));                                         // soft shade strip along the house line
      else {   // the embankment: granite parapet with a railing, a quay wall down to the river, the far bank's quay and promenade
        g.push(bx(0.4, 0.5, L, 0xcfc4b2, [-(bx0 + 0.2), 0.37, zc]), bx(0.5, 0.08, L, 0xe4dccd, [-(bx0 + 0.2), 0.66, zc]), bx(0.35, 1.9, L, 0xa89c8a, [-(bx0 + 0.42), -0.8, zc]),
          bx(0.05, 0.05, L, COL.graphite, [-(bx0 + 0.2), 1.25, zc]), bx(0.03, 0.03, L, COL.graphite, [-(bx0 + 0.2), 0.95, zc]),
          bx(0.5, 1.9, L, 0xa89c8a, [-(bx0 + RIVER - 0.25), -0.8, zc]), bx(RIVER * 0.12, 0.12, L, COL.walk, [-(bx0 + RIVER * 0.94), 0.06, zc]));
        for (let z = z0; z > z1; z -= 1.6) g.push(bx(0.05, 0.6, 0.05, COL.graphite, [-(bx0 + 0.2), 0.95, z])); }
      // sidewalk furniture: trees in pits, planters, lamps + benches
      for (let z = z0 - 2, i = 0; z > z1; z -= 4.2, i++) { const x = sx * (RW + 0.9), kind = i % 3;
        if (kind === 0 && sx > 0) { g.push(bx(0.9, 0.04, 0.9, 0x8a7a64, [x, 0.13, z])); TREES.push([x, z, i]); }   // trees only on the house side: the river side stays open
        else if (kind === 0) g.push(bx(0.7, 0.45, 1.3, 0xc9b79c, [x, 0.34, z]), ico(0.42, COL.bush, [x, 0.7, z - 0.3], [1, 0.7, 1]), ico(0.12, 0xffd84a, [x - 0.1, 0.92, z + 0.2]), ico(0.12, COL.coral, [x + 0.1, 0.92, z - 0.2]));                               // tree pit; the Tripo tree is instanced in init
        else if (kind === 1) g.push(bx(0.7, 0.45, 1.3, 0xc9b79c, [x, 0.34, z]), ico(0.42, COL.bush, [x, 0.7, z - 0.3], [1, 0.7, 1]), ico(0.38, COL.bush, [x, 0.7, z + 0.3], [1, 0.7, 1]), ico(0.12, COL.coral, [x + 0.1, 0.92, z]));
        else g.push(cy(0.05, 0.06, 3.6, 6, COL.graphite, [x, 1.9, z]), bx(0.12, 0.08, 0.5, COL.graphite, [x - sx * 0.2, 3.65, z]), bx(0.18, 0.1, 0.3, 0xfff3c0, [x - sx * 0.38, 3.58, z]),
          bx(0.5, 0.06, 1.3, 0xb07a4a, [sx * (RW + 1.95), 0.5, z + 1.6]), bx(0.08, 0.5, 1.3, 0xb07a4a, [sx * (RW + 2.2), 0.75, z + 1.6]), bx(0.4, 0.4, 0.06, COL.graphite, [sx * (RW + 1.95), 0.3, z + 1.0]), bx(0.4, 0.4, 0.06, COL.graphite, [sx * (RW + 1.95), 0.3, z + 2.2])); }
    }
    // crosswalks with decor traffic lights (always green: no cars, no stopping)
    for (let d = 1700; d < k.HOUSE_D + 2000; d += 2600) { const z = -d * U;
      for (let j = 0; j < 7; j++) g.push(bx(0.42, 0.012, 1.7, 0xf4f4f0, [-RW + 0.4 + j * (RW * 2 - 0.8) / 6, 0.012, z]));
      for (const sx of [-1, 1]) LIGHTS.push([sx * (RW + 0.5), z + 1.2]); }                                     // decor traffic lights: the Tripo model, placed in init
    return mergeG(g);
  }
  const archGeo = (hex, hexD) => mergeG([bx(0.26, 3.0, 0.26, hexD, [-1.0, 1.5, 0]), bx(0.26, 3.0, 0.26, hexD, [1.0, 1.5, 0]), bx(2.4, 0.6, 0.3, hex, [0, 3.0, 0]), bx(2.2, 0.08, 0.32, 0xffffff, [0, 2.68, 0]),
    bx(0.4, 0.12, 0.4, hexD, [-1.0, 0.06, 0]), bx(0.4, 0.12, 0.4, hexD, [1.0, 0.06, 0])]);
  // the customer's house: a cosy front with a coral door, steps, lamp, windows with flower boxes
  const houseGeo = () => mergeG([bx(7, 6.5, 4, 0xf3dcc0, [0, 3.25, -2]), bx(7.4, 0.4, 4.4, COL.roof, [0, 6.6, -2]), bx(1.3, 2.3, 0.14, COL.coral, [0, 1.35, 0.02]), bx(1.6, 2.6, 0.08, 0xffffff, [0, 1.4, -0.02]),
    ico(0.05, 0xffd84a, [0.45, 1.3, 0.12]), bx(2.4, 0.12, 1.0, COL.walk2, [0, 0.06, 0.55]), bx(2.0, 0.12, 0.6, COL.walk2, [0, 0.18, 0.35]), bx(1.6, 0.08, 0.6, 0x9a6040, [0, 0.27, 0.6]),
    ...[-2.2, 2.2].flatMap((x) => [bx(1.1, 1.1, 0.1, COL.win, [x, 2.0, 0.02]), bx(1.25, 1.25, 0.06, 0xffffff, [x, 2.0, -0.01]), bx(1.2, 0.25, 0.3, 0x9a6040, [x, 1.35, 0.15]), ico(0.16, COL.coral, [x - 0.3, 1.55, 0.15]), ico(0.16, 0xffd84a, [x, 1.55, 0.15]), ico(0.16, COL.coral, [x + 0.3, 1.55, 0.15])]),
    bx(0.12, 0.3, 0.12, COL.graphite, [-0.95, 2.4, 0.1]), bx(0.16, 0.2, 0.16, 0xfff3c0, [-0.95, 2.2, 0.1])]);

  // ---------------- the courier: Tripo model, Mixamo-style skeleton, posed by code (no clips) ----------------
  // recolour by hue on the base-colour texture (customer: the courier's teal → coral)
  function recolor(rules) {
    let mat; gltf.scene.traverse((o) => { if (o.isMesh && !mat) mat = o.material; });
    const img = mat.map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn; let h = 0;
      if (df) { h = mx === r ? ((g - b) / df) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4; h *= 60; if (h < 0) h += 360; }
      const s = mx ? df / mx : 0;
      for (const q of rules) if (h >= q.h[0] && h <= q.h[1] && s >= q.s && mx >= (q.v || 0)) { const kf = clamp(mx / q.vref, 0.5, 1.4); d[i] = clamp(q.to[0] * kf, 0, 255); d[i + 1] = clamp(q.to[1] * kf, 0, 255); d[i + 2] = clamp(q.to[2] * kf, 0, 255); break; } }
    x.putImageData(id, 0, 0); const t = new T.CanvasTexture(c); t.flipY = false; t.colorSpace = mat.map.colorSpace;
    const m = mat.clone(); m.map = t; return m;
  }
  const hexRGB = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  function makeRig(mat, shadow, G = gltf) { const r = KIT.rig(G, { shadow }); r.bones = {}; r.root.traverse((o) => { if (o.isMesh && mat) o.material = mat; if (o.isBone) { r.bones[o.name.replace(/^mixamorig:?/, '')] = o; o.userData.q0 = o.quaternion.clone(); } }); return r; }
  // poses = bone → local Euler offsets from the bind A-pose (tuned with tools/shot.mjs devCam.pose); blended with weights each frame
  S.POSE = {
    ride: { LeftArm: [0, 0, 0], RightArm: [0, 0, 0], LeftForeArm: [0, 0, 0], RightForeArm: [0, 0, 0], Spine: [0, 0, 0], LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0] },
    kick: { LeftUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0] },
    stumble: { Spine1: [0, 0, 0], LeftArm: [0, 0, 0], RightArm: [0, 0, 0], Head: [0, 0, 0] },
    hand: { RightArm: [0, 0, 0], RightForeArm: [0, 0, 0] },
    wave: { RightArm: [0, 0, 0], RightForeArm: [0, 0, 0] }, waveOsc: { RightForeArm: [0, 0, 0] },
    idle: { LeftArm: [0, 0, 0], RightArm: [0, 0, 0] },
  };
  const QO = new T.Quaternion();
  const offset = (b, e, w = 1) => { if (!b || !w) return; QO.setFromEuler(E3.set(e[0] * w, e[1] * w, e[2] * w)); b.quaternion.multiply(QO); };
  function poseRig(r, ws) {                    // ws: { poseName: weight }
    for (const n in r.bones) r.bones[n].quaternion.copy(r.bones[n].userData.q0);
    const D = S.devCam && S.devCam.pose;
    for (const pn in ws) { const P_ = Object.assign({}, S.POSE[pn], D && D[pn]); for (const bn in P_) offset(r.bones[bn], P_[bn], ws[pn]); }
    r.root.updateMatrixWorld(true);
  }
  S.RIG = { yaw: Math.PI / 2, h: 1.55, z: 0.02 };   // the Tripo model faces +X: turn it to −Z; standing height in metres (before CS)
  const PO = { logo: [0.05, -0.4, 0.0] };            // decal on the backpack: offset from the Spine2 bone in courier-local metres (y, z back, x)
  // the courier group: procedural scooter + the rig (backpack and cap are part of the model); the backpack decal stays hidden (no brand mark)
  function makeCourier(target, mat, shadow) {
    const g = new T.Group(), sc = new T.Mesh(scooterGeo(), KIT.vmat), r = makeRig(mat, shadow);
    sc.castShadow = shadow; g.add(sc); r.root.rotation.y = S.RIG.yaw; g.add(r.root);
    r.root.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(r.root), RS = S.RIG.h / (bb.max.y - bb.min.y);
    r.root.scale.setScalar(RS); r.root.position.set(0, 0.165 - bb.min.y * RS, S.RIG.z); r.RS = RS;
    const logo = new T.Mesh(new T.PlaneGeometry(0.3, 0.15), new T.MeshLambertMaterial({ map: P.logoT, transparent: true })); logo.visible = false; g.add(logo);
    target.add(g); return { g, sc, r, logo };
  }
  // two-bone IK in world space: bend A→B→C so that C reaches target T (elbow / knee pushed towards `hint`). Axis-agnostic: works for any rig.
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _t = new T.Vector3(), _e = new T.Vector3(), _v1 = new T.Vector3(), _v2 = new T.Vector3(), _q = new T.Quaternion(), _pq = new T.Quaternion(), _wq = new T.Quaternion();
  function aim(bone, from, to) {               // rotate `bone` (world) so the direction `from` becomes `to`
    _q.setFromUnitVectors(from, to); bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q).multiply(_wq)); bone.updateMatrixWorld(true); }
  function twist(bone, child, ang) {           // roll a bone around its own axis (world), e.g. turn the palm forward
    if (!bone || !child || !ang) return; bone.getWorldPosition(_a); child.getWorldPosition(_b); _q.setFromAxisAngle(_v1.copy(_b).sub(_a).normalize(), ang);
    bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q).multiply(_wq)); bone.updateMatrixWorld(true); }
  function ik2(A, B, C, target, hint, w = 1) {
    if (!A || !B || !C || w <= 0) return;
    A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c); _t.copy(_c).lerp(target, w);
    const d = clamp(_a.distanceTo(_t), 0.05, (l1 + l2) * 0.999), dir = _v1.copy(_t).sub(_a).normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const side = _v2.copy(hint).sub(_a); side.sub(dir.clone().multiplyScalar(side.dot(dir))).normalize();
    _e.copy(_a).addScaledVector(dir, x).addScaledVector(side, hgt);                          // where the elbow should be
    aim(A, _v1.copy(_b).sub(_a).normalize(), _v2.copy(_e).sub(_a).normalize());
    B.getWorldPosition(_b); C.getWorldPosition(_c);
    aim(B, _v1.copy(_c).sub(_b).normalize(), _v2.copy(_t).sub(_b).normalize());
  }
  const L_ = (C, x, y, z) => C.g.localToWorld(new T.Vector3(x, y, z));   // a point in courier-local metres (before CS) → world
  // mode: 'ride' | 'stumble' | 'hand' | 'wave'; tt = seconds in the mode; kick 0..1 push-off; pop 0..1 pick bounce
  // stance on the deck: left foot forward, right foot back (ankle targets, deck top 0.165 + ankle 0.08); the BACK foot does the push-off to the road
  S.IK = { grip: [0.19, 1.04, -0.31], elbow: [0.45, 0.9, 0.25], footF: [-0.04, 0.25, -0.12], footB: [0.05, 0.25, 0.24], kneeF: [-0.1, 0.7, -0.6], kneeB: [0.1, 0.65, -0.3],
    kick: [0.16, 0.08, 0.6], wave: [0.55, 1.8, -0.08], waveEl: [0.95, 1.15, 0.0], palm: 1.6, hand: [0.28, 1.15, -0.55] };   // wave: hand above the shoulder, elbow out to the side and down
  function poseCourier(C, mode, tt, kick = 0, pop = 0) {
    const r = C.r, B = r.bones, K_ = S.devCam && S.devCam.ik ? Object.assign({}, S.IK, S.devCam.ik) : S.IK, br = 0.5 + 0.5 * Math.sin(tt * 2.2);
    poseRig(r, { ride: 1 });
    C.g.updateMatrixWorld(true);
    const sp = B.Spine2; if (sp) { sp.quaternion.multiply(QO.setFromEuler(E3.set(0.03 * br - 0.06 * pop, 0, 0))); }   // breathing + a little bounce on a pick
    if (mode === 'stumble') { const q = Math.sin(clamp(tt / 0.55, 0, 1) * Math.PI); if (B.Spine1) B.Spine1.quaternion.multiply(QO.setFromEuler(E3.set(-0.35 * q, 0, 0))); if (B.Head) B.Head.quaternion.multiply(QO.setFromEuler(E3.set(-0.3 * q, 0, 0))); }
    r.root.updateMatrixWorld(true);
    const g = K_.grip, el = K_.elbow, armL = mode === 'stumble' ? 1 - Math.sin(clamp(tt / 0.55, 0, 1) * Math.PI) * 0.7 : 1;
    // hands on the grips (right hand lets go to hand the bag / wave at the door)
    let rT = L_(C, g[0], g[1], g[2]), rW = armL;   // facing −Z: the right side is +X
    if (mode === 'hand') { rT = L_(C, K_.hand[0], K_.hand[1], K_.hand[2]); rW = SS(0, 0.35, tt); }
    if (mode === 'wave') { const o = Math.sin(tt * 8); rT = L_(C, K_.wave[0] + 0.13 * o, K_.wave[1] - 0.04 * Math.abs(o), K_.wave[2]); rW = SS(0, 0.3, tt); }   // the hand sways over the shoulder, pivoting at the elbow
    if (mode === 'hand' || mode === 'wave') { ik2(B.RightArm, B.RightForeArm, B.RightHand, L_(C, g[0], g[1], g[2]), L_(C, el[0], el[1], el[2]), 1 - rW); }
    const rEl = mode === 'wave' ? K_.waveEl : el; ik2(B.RightArm, B.RightForeArm, B.RightHand, rT, L_(C, rEl[0], rEl[1], rEl[2]), mode === 'hand' || mode === 'wave' ? rW : armL);
    if (mode === 'wave') twist(B.RightForeArm, B.RightHand, K_.palm * rW);   // palm towards the viewer
    ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, L_(C, -g[0], g[1], g[2]), L_(C, -el[0], el[1], el[2]), armL);
    // push-off: the left foot reaches the road behind the deck and comes back
    const fF = K_.footF, fB = K_.footB, kF = K_.kneeF, kB = K_.kneeB, kk = K_.kick, onDeck = mode !== 'stumble' ? 1 : 0.6;
    ik2(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, L_(C, fF[0], fF[1], fF[2]), L_(C, kF[0], kF[1], kF[2]), onDeck);
    const kq = kick, bx = fB[0] + (kk[0] - fB[0]) * kq, by = fB[1] + (kk[1] - fB[1]) * kq + 0.12 * Math.sin(kq * Math.PI), bz = fB[2] + (kk[2] - fB[2]) * kq;   // back foot: deck → road behind → deck
    ik2(B.RightUpLeg, B.RightLeg, B.RightFoot, L_(C, bx, by, bz), L_(C, kB[0], kB[1], kB[2]), onDeck);
    C.g.updateMatrixWorld(true);
    if (sp) { sp.getWorldPosition(V3); C.g.worldToLocal(V3); const LO = S.devCam && S.devCam.logo || PO.logo; C.logo.position.set(V3.x + LO[2], V3.y + LO[0], V3.z - LO[1]); const ps = 1 + 0.25 * pop; C.logo.scale.set(ps, ps, 1); }
  }

  S.init = async (gl, hudCv, W, H) => {
    VW = W; VH = H; R = KIT.renderer(gl, W, H); R.info.autoReset = false; KIT.H.init(hudCv, W, H);
    R.toneMapping = T.NeutralToneMapping; R.toneMappingExposure = 1.0;   // keeps the brand colours saturated (ACES washed them out)
    scene = new T.Scene(); scene.fog = new T.Fog(0xe3eff5, 40, 110); cam = new T.PerspectiveCamera(50, W / H, 0.3, 140);
    scene.background = tex(4, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6fb6ea'); gr.addColorStop(0.55, '#bfe1f4'); gr.addColorStop(1, '#e8f3f8'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    scene.add(new T.HemisphereLight(0xbfe3ff, 0xb89f80, 0.8));
    sun = new T.DirectionalLight(0xffe6bf, 2.9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 14, bottom: -8, near: 1, far: 50 }); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
    // ---- road: warm asphalt, dashed lane lines, teal bike-lane edges ----
    const RWm = K().RW * U * 2, Lz = (K().HOUSE_D + 2800) * U + 16, zc = (16 - (K().HOUSE_D + 2800) * U) / 2;
    const roadImg = await KIT.image('road_tex').catch(() => null);
    const roadT = tex(512, 512, (c, w, h) => { c.fillStyle = '#7e858f'; c.fillRect(0, 0, w, h); if (roadImg) { c.drawImage(roadImg, 0, 0, w, h / 2); c.drawImage(roadImg, 0, h / 2, w, h / 2); } else for (let i = 0; i < 2600; i++) { const v = 112 + h1(i) * 34; c.fillStyle = `rgba(${v},${v + 5},${v + 12},0.45)`; c.fillRect(h1(i + 9) * w, h1(i + 5) * h, 2, 2); }
      const sh = c.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(30,36,50,0.28)'); sh.addColorStop(0.07, 'rgba(30,36,50,0)'); sh.addColorStop(0.93, 'rgba(30,36,50,0)'); sh.addColorStop(1, 'rgba(30,36,50,0.28)'); c.fillStyle = sh; c.fillRect(0, 0, w, h);   // curb AO
      c.fillStyle = '#f4f4f0'; for (const fx of [1 / 3, 2 / 3]) { c.fillRect(w * fx - 6, h * 0.1, 12, h * 0.36); c.fillRect(w * fx - 6, h * 0.6, 12, h * 0.36); } c.fillStyle = '#ffd84d'; c.fillRect(12, 0, 14, h); c.fillRect(w - 26, 0, 14, h); }, [1, Lz / 3]);
    const road = new T.Mesh(new T.PlaneGeometry(RWm, Lz), new T.MeshLambertMaterial({ map: roadT })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.002, zc); road.receiveShadow = true; scene.add(road);
    facadeLayout();
    const img = {}; for (const n of ['facades8_tex', 'sidewalk_tex', 'road_tex']) { try { img[n] = await KIT.image(n); } catch (e) { img[n] = null; } }
    if (img.facades8_tex) { const ft = new T.Texture(img.facades8_tex); ft.colorSpace = T.SRGBColorSpace; ft.anisotropy = 4; ft.needsUpdate = true;
      P.facadeMat = new T.MeshLambertMaterial({ map: ft, alphaTest: 0.5 }); const fm = new T.Mesh(facadeGeo(), P.facadeMat); fm.receiveShadow = true; scene.add(fm); P.facades = fm; }
    if (img.sidewalk_tex) { const st = new T.Texture(img.sidewalk_tex); st.colorSpace = T.SRGBColorSpace; st.wrapS = st.wrapT = T.RepeatWrapping; st.repeat.set(2, Lz / 1.5); st.anisotropy = 4; st.needsUpdate = true;
      for (const sx of [-1, 1]) { const m = new T.Mesh(new T.PlaneGeometry(2.4, Lz), new T.MeshLambertMaterial({ map: st })); m.rotation.x = -Math.PI / 2; m.position.set(sx * (K().RW * U + 0.22 + 1.2), 0.122, zc); m.receiveShadow = true; scene.add(m); } }
    { const wt = tex(128, 128, (c, w, h) => { c.fillStyle = '#3f9fd6'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(220,245,255,0.55)'; c.lineWidth = 2; for (let i = 0; i < 26; i++) { const x = h1(i) * w, y = h1(i + 40) * h; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 9, y - 3, x + 20, y); c.stroke(); } }, [6, Lz / 6]);
      const bx0 = K().RW * U + 0.22 + 2.4; P.waterT = wt; const wm = new T.Mesh(new T.PlaneGeometry(RIVER, Lz), new T.MeshLambertMaterial({ map: wt, color: 0xbfe6ff })); wm.rotation.x = -Math.PI / 2; wm.position.set(-(bx0 + RIVER / 2), -1.1, zc); scene.add(wm); P.water = wm; }
    LIGHTS.length = 0; const city = new T.Mesh(cityGeo(), KIT.vmat);
    // static Tripo props: one GLB → one instanced draw (base at y = 0, centred, height h metres, extra vertical stretch, yaw)
    const propGeo = async (name, h, stretch = 1, yaw = 0) => { const tg = await KIT.model(name); let mesh; tg.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; }); tg.scene.updateMatrixWorld(true);
      const geo = dequant(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox(); const bb = geo.boundingBox, k = h / (bb.max.y - bb.min.y);
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k * stretch, k); geo.rotateY(yaw); return { geo, mat: new T.MeshLambertMaterial({ map: mesh.material.map }) }; };
    { const { geo, mat } = await propGeo('trafficlight', S.TL.h, S.TL.stretch, S.TL.yaw), pool = new KIT.Pool(scene, geo, mat, 32, { shadow: true });
      pool.begin(); for (const [x, z] of LIGHTS) pool.add(x, 0.12, z, 1, 1, 1); pool.end(); }
    { const { geo, mat } = await propGeo('tree', S.TREE.h); P.tree = new KIT.Pool(scene, geo, mat, 48, { shadow: false }); }   // no shadow pass for the street trees (halves their triangles)   // filled per frame with the trees in view only
    city.receiveShadow = true; scene.add(city); P.city = city;
    // far skyline (canvas), rides with the camera far ahead
    P.sky = new T.Mesh(new T.PlaneGeometry(90, 22), new T.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false, map: tex(512, 128, (c, w, h) => { for (let i = 0; i < 46; i++) { const bw = 10 + 18 * h1(i), bh = 30 + 90 * h1(i + 50), x = h1(i + 99) * w; c.fillStyle = `rgba(${150 + 30 * h1(i + 3)},${185 + 20 * h1(i + 4)},${210 + 15 * h1(i + 5)},0.85)`; c.fillRect(x, h - bh, bw, bh); } }) }));
    P.sky.renderOrder = -1; scene.add(P.sky);
    { const sk = await KIT.image('skyline_tex').catch(() => null); if (sk) { const t = new T.Texture(sk); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; P.sky.material.map = t; P.sky.material.transparent = false; P.sky.material.needsUpdate = true; P.sky.scale.set(80 / 90, 80 / 1.5 / 22, 1); P.skyY = 80 / 1.5 / 2 - 6; } }   // 80 m wide, image aspect 1.5, bottom a little below the horizon   // the Codex skyline replaces the canvas blocks
    // ---- the courier (CC0 rig + procedural scooter / backpack / cap), the customer, the house, the fork arches ----
    P.logoT = tex(256, 128, (c, w, h) => { c.font = '900 76px "Arial Black",Arial,sans-serif'; c.textBaseline = 'middle'; const a = c.measureText('hop').width, b = c.measureText('pa').width, x0 = (w - a - b) / 2 - 8;
      c.fillStyle = '#1f1f1f'; c.fillText('hop', x0, h / 2); c.fillStyle = '#ffffff'; c.fillText('pa', x0 + a, h / 2); c.fillStyle = '#ff6f59'; c.beginPath(); c.arc(x0 + a + b + 12, h / 2 + 20, 9, 0, 7); c.fill(); });
    gltf = await KIT.model('courier2');
    P.courM = recolor([{ h: [160, 200], s: 0.25, vref: 0.62, to: hexRGB(COL.teal) }]);   // brand colour (COL.teal now holds the yellow)
    P.cour = makeCourier(scene, P.courM, true); P.cour.g.scale.setScalar(CS);
    { const cg = await KIT.model('customer'), r = makeRig(null, true, cg), g = new T.Group(); r.root.rotation.y = S.CUST.yaw; g.add(r.root); r.root.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(r.root), k = S.CUST.h / (bb.max.y - bb.min.y); r.root.scale.setScalar(k); r.root.position.y = -bb.min.y * k; g.scale.setScalar(CS); scene.add(g); P.cust = { g, r }; }
    P.bag = new T.Mesh(bagGeo(), KIT.vmat); P.bag.castShadow = true; P.bag.scale.setScalar(CS); scene.add(P.bag);
    // the customer's house closes the street: three painted fronts from the atlas (peach house with the door in the middle) + 3D entrance details
    { const grp = new T.Group(), front = (q, x, w) => { const h = w * 683 / 256, g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (q + uv.getX(i)) / NF); g.translate(x, h / 2, 0); return g; };
      // either side of the house: a trimmed hedge with flowers and a tree (the painted neighbours are gone)
      grp.add(new T.Mesh(mergeG([...[-1, 1].flatMap((sx) => [bx(4.4, 1.15, 1.0, 0x4f9e52, [sx * 4.6, 0.58, -0.7]), ...[0, 1, 2, 3].map((k) => ico(0.42, 0x5cae5a, [sx * (3.0 + k * 1.05), 1.15, -0.7], [1.3, 0.55, 1.1], 1)),
        ...[0, 1, 2].map((k) => ico(0.09, k % 2 ? COL.coral : 0xffd84a, [sx * (3.4 + k * 1.2), 1.32, -0.25]))])]), KIT.vmat));
      { const { geo, mat } = await propGeo('tree', 4.4); for (const sx of [-1, 1]) { const tm = new T.Mesh(geo, mat); tm.position.set(sx * 5.6, 0, -2.2); tm.rotation.y = sx; tm.castShadow = true; grp.add(tm); } }
      { const { geo, mat } = await propGeo('house', S.HOUSE.h, 1, S.HOUSE.yaw); geo.computeBoundingBox(); const hm = new T.Mesh(geo, mat); hm.position.set(S.HOUSE.x, 0, -0.1 - geo.boundingBox.max.z); hm.castShadow = true; hm.receiveShadow = true; grp.add(hm); }   // its front on the street line
      P.house = grp; scene.add(grp); }
    const f = SIM.LEVEL.fork; P.arch = {};
    for (const r of ['yard', 'avenue']) { const m = new T.Mesh(archGeo(r === 'yard' ? COL.coral : COL.teal, r === 'yard' ? COL.coralD : COL.tealD), KIT.vmat); m.castShadow = true; m.position.set(f[r].x * U, 0, -f.d * U); m.scale.setScalar(0.8); scene.add(m); P.arch[r] = m; }
    // ---- instanced kinds: items, glow rings, obstacles, boosters, FX ----
    const mk = (geo, mat, n, sh) => new KIT.Pool(scene, geo, mat, n, { shadow: !!sh }), basic = (o) => new T.MeshBasicMaterial(Object.assign({ toneMapped: false, depthWrite: false, transparent: true }, o));
    P.item = {}; for (const k of Object.keys(ITEM)) P.item[k] = mk(ITEM[k](), KIT.vmat, 12, true);
    const glowT = tex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
    P.glow = mk(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), basic({ map: glowT, color: COL.teal, blending: T.AdditiveBlending }), 24);
    P.beam = mk(new T.CylinderGeometry(0.42, 0.5, 2.2, 20, 1, true).translate(0, 1.1, 0), basic({ map: tex(4, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.55)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), color: 0xffe066, blending: T.AdditiveBlending, side: T.DoubleSide }), 12);
    P.ring = mk(new T.RingGeometry(0.44, 0.56, 28).rotateX(-Math.PI / 2), basic({ color: 0xffe066, opacity: 0.95, side: T.DoubleSide }), 24);
    P.fx = mk(new T.RingGeometry(0.8, 1, 28).rotateX(-Math.PI / 2), basic({ color: 0xffffff, opacity: 0.85, side: T.DoubleSide }), 40);
    P.box = mk(mergeG([bx(0.75, 0.5, 0.6, 0xc8955a, [0, 0.25, 0]), bx(0.77, 0.04, 0.14, 0xe8c48a, [0, 0.51, 0]), bx(0.6, 0.4, 0.5, 0xb88550, [0.05, 0.7, 0.02], [0, 0.3, 0]), bx(0.62, 0.04, 0.12, 0xe8c48a, [0.05, 0.91, 0.02], [0, 0.3, 0])]), KIT.vmat, 12, true);
    P.cone = mk(mergeG([col(tf(new T.ConeGeometry(0.26, 0.72, 12), [0, 0.42, 0]), COL.coral), bx(0.56, 0.06, 0.56, COL.coralD, [0, 0.03, 0]), cy(0.165, 0.19, 0.11, 12, 0xffffff, [0, 0.38, 0])]), KIT.vmat, 12, true);
    P.cart = mk(mergeG([bx(0.8, 0.45, 0.55, 0x9aa3ad, [0, 0.55, 0]), bx(0.82, 0.04, 0.57, 0xc9ced6, [0, 0.78, 0]), bx(0.05, 0.55, 0.05, 0x5a6068, [0, 0.95, 0.27]), bx(0.4, 0.05, 0.05, 0x5a6068, [0, 1.22, 0.27]),
      ...[[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]].map(([x, z]) => cy(0.07, 0.07, 0.05, 8, 0x333333, [x, 0.07, z], [0, 0, Math.PI / 2])), bx(0.3, 0.25, 0.25, 0xc8955a, [0.1, 0.92, -0.05])]), KIT.vmat, 8, true);
    { const blob = (r, n, seed) => { const sh = new T.Shape(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = r * (1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 2)); k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); } return new T.ShapeGeometry(sh).rotateX(-Math.PI / 2); };
      // a spilled-water puddle that reads on asphalt: dark wet rim, bright blue water, white sky glints; lifted off the road + polygon offset (no z-fighting)
      P.puddle = mk(mergeG([col(tf(blob(0.78, 24, 1), [0, 0, 0]), 0x4f6e86), col(tf(blob(0.64, 24, 2), [0, 0.004, 0]), 0x4fb4f0), col(tf(blob(0.42, 24, 3), [0.08, 0.008, -0.05]), 0x8fd6ff),
        col(tf(new T.PlaneGeometry(0.42, 0.06).rotateX(-Math.PI / 2), [0.1, 0.012, -0.18], [0, 0.5, 0]), 0xffffff), col(tf(new T.PlaneGeometry(0.22, 0.05).rotateX(-Math.PI / 2), [-0.2, 0.012, 0.12], [0, 0.4, 0]), 0xffffff)]),
        new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 8); }

    { const s = new T.Shape(); s.moveTo(0, 0.7); s.lineTo(0.55, 0.05); s.lineTo(0.22, 0.05); s.lineTo(0.22, -0.55); s.lineTo(-0.22, -0.55); s.lineTo(-0.22, 0.05); s.lineTo(-0.55, 0.05); s.closePath();
      P.coin = mk(mergeG([cy(0.24, 0.24, 0.06, 18, 0xe0a100, [0, 0, 0], [Math.PI / 2, 0, 0]), cy(0.18, 0.18, 0.075, 18, 0xffd23a, [0, 0, 0], [Math.PI / 2, 0, 0]),
        bx(0.05, 0.2, 0.08, 0xe0a100, [-0.02, 0, 0]), bx(0.12, 0.05, 0.08, 0xe0a100, [0.02, 0.06, 0]), bx(0.12, 0.04, 0.08, 0xe0a100, [0, -0.03, 0])]), KIT.vmat, 60, true);   // a tip coin with a ₽-ish emboss
      P.pad = mk(new T.ShapeGeometry(s).rotateX(-Math.PI / 2), basic({ color: 0xffe066, opacity: 0.95, side: T.DoubleSide }), 16); }
    P.blob = mk(new T.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x1f2433, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 40);
    P.bits = mk(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ flatShading: true }), 140);
    P.streak = mk(new T.BoxGeometry(0.035, 0.035, 2.6), basic({ color: 0xffffff, opacity: 0.6 }), 30);
    P.trail = mk(new T.PlaneGeometry(0.5, 1).rotateX(-Math.PI / 2), basic({ map: glowT, color: COL.teal, blending: T.AdditiveBlending, opacity: 0.9 }), 24);
    // ---- endcard pass (own scene): dim, the courier waving on the scooter, confetti ----
    end.scene = new T.Scene(); end.cam = new T.PerspectiveCamera(30, W / H, 0.1, 100); end.scene.add(new T.HemisphereLight(0xffffff, 0xb89f80, 2.9)); const l = new T.DirectionalLight(0xfff0d8, 3.8); l.position.set(2, 4, 5); end.scene.add(l);
    end.C = makeCourier(end.scene, P.courM, false);
    end.conf = new KIT.Pool(end.scene, new T.BoxGeometry(0.06, 0.1, 0.01), new T.MeshBasicMaterial(), 90);
    end.dim = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ color: 0x0b1a22, transparent: true, depthTest: false })); end.dim.position.z = -0.5;
    end.dimScene = new T.Scene(); end.dimScene.add(end.dim); end.dimCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    for (const n of Object.keys((window.BUILD || {}).images || {})) KIT.H.img[n] = await KIT.image(n);
    return S;
  };

  const POOLS = () => [P.coin, P.tree, ...Object.values(P.item), P.beam, P.glow, P.ring, P.fx, P.box, P.cone, P.cart, P.puddle, P.pad, P.blob, P.bits, P.streak, P.trail];
  const OB = { box: () => P.box, cone: () => P.cone, cart: () => P.cart, puddle: () => P.puddle };

  S.render = (t) => {
    const ST = S.state || SIM.at(t), GT = ST.t, k = K(), cz = ST.cam[1] * U; S.cur = ST;
    const vis = (d) => { const z = -d * U; return z < cz + 8 && z > cz - 50; };
    for (const p of POOLS()) p.begin();
    for (const [x, z, i] of TREES) { if (z > cz + 10 || z < cz - 52) continue; const sc = 0.85 + 0.3 * h1(i * 7.1 + x); P.tree.add(x, 0.12, z, sc, sc * (0.95 + 0.1 * h1(i)), sc, 0, h1(i * 3.3 + z) * 6.28, 0); }
    // ---- courier: lean into the steer, bob with speed, stumble on an obstacle, hand the bag over at the door ----
    const steer = clamp((ST.tx - ST.x) / 160, -1, 1), stumA = GT - ST.slowT, stum = stumA < k.SLOW_T ? Math.sin(stumA / k.SLOW_T * Math.PI) : 0, sp = Math.min(1.5, ST.v / k.RUN);
    const C = P.cour, dA = ST.deliverT >= 0 ? GT - ST.deliverT : -1, mode = dA >= 0 ? (dA < 1.0 ? 'hand' : 'wave') : stumA < k.SLOW_T ? 'stumble' : 'ride';
    C.g.position.set(ST.x * U, 0.015 * Math.sin(GT * 11) * Math.min(1, sp), -ST.d * U); C.g.rotation.set(-0.18 * stum + 0.22 * Math.max(0, sp - 1), -steer * 0.18, -steer * 0.2);
    // push-offs: two at the launch, one after a stumble, then a lazy one every 2.6 s (never on turbo / boost); a pick squashes the backpack
    const kickAt = (a) => (a >= 0 && a < 0.55 ? Math.sin(a / 0.55 * Math.PI) : 0), fastNow = GT - ST.turboT < k.TURBO_T || GT - ST.boostT < k.BOOST_T;
    let kick = Math.max(kickAt(GT - 0.15), kickAt(GT - 0.75), kickAt(stumA - k.SLOW_T - 0.1)); if (!fastNow && GT > 1.5) kick = Math.max(kick, kickAt((GT - 1.5) % 2.6));
    let pop = 0; for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'pick' && a > 0.3 && a < 0.6) pop = Math.max(pop, Math.sin((a - 0.3) / 0.3 * Math.PI)); }
    poseCourier(C, mode, mode === 'ride' ? GT : mode === 'stumble' ? stumA * 1.4 : dA >= 1 ? dA - 1 : dA * 1.6, ST.deliverT < 0 ? kick : 0, pop);
    P.blob.add(ST.x * U, 0.02, -ST.d * U, 0.9, 1, 1.7);
    // ---- rows: a train of needed items on glowing teal rings (beam on the first), extras plain; a taken item flies into the backpack ----
    for (const r of ST.rows) { if (!vis(r.d)) continue; const z = -r.d * U, cl = ST.ev.find((e) => e.k === 'clear' && e.id === r.id), ca = cl ? GT - cl.t : 9e9, gone = r.st === 2 && ca > 0.3;
      const put = (kind, lx, zz, ring, beam, ta) => { const x = lx * U, bob = 0.32 + 0.08 * Math.sin(GT * 3 + lx + zz);
        if (ta !== undefined) { if (ta < 0.35) { const q = ease(ta / 0.35), s = IS * (1 - 0.7 * q); P.item[kind].add(x + (ST.x * U - x) * q, bob + 1.2 * Math.sin(q * Math.PI) + 0.8 * q, zz + (-ST.d * U + 0.45 - zz) * q, s, s, s, 0, GT * 8, 0); } return; }
        P.item[kind].add(x, bob, zz, IS, IS, IS, 0, GT * 1.5 + lx, 0); P.blob.add(x, 0.02, zz, 0.85, 1, 0.85);
        if (ring) { const pu = 1 + 0.08 * Math.sin(GT * 5 + zz); P.ring.add(x, 0.04, zz, pu * 1.75, 1, pu * 1.75); P.glow.add(x, 0.03, zz, 2.6 * pu, 1, 2.6 * pu); if (beam) P.beam.add(x, 0, zz, 0.9, 1 + 0.1 * Math.sin(GT * 4 + lx), 0.9); } };
      if (gone) continue;
      if (r.kind && r.kind !== 'none') { const need = (ST.got[r.kind] || 0) < SIM.qty(r.kind);
        for (let j = 0; j < r.n; j++) { const zz = -SIM.trainD(r, j) * U, pk = r.hit[j] === 1 ? ST.ev.find((e) => e.k === 'pick' && e.row === r.id && e.j === j) : null;
          if (r.hit[j] === 1) { if (pk) put(r.kind, k.LANES[r.path[j]], zz, false, false, GT - pk.t); continue; }
          if (GT - r.resT < 0.4 && r.resT > 0.5) { const q = ease((GT - r.resT) / 0.4); P.fx.add(k.LANES[r.path[j]] * U, 0.06, zz, 2 * (1 - q) + 0.3, 1, 2 * (1 - q) + 0.3, 0, 0, 0, 0xffe066); }   // a refilled spare row pops in
          put(r.kind, k.LANES[r.path[j]], zz, need, j === 0, undefined); } }
      for (const e of r.extras) if (!e.st) put(e.kind, k.LANES[e.lane], z, false, false, undefined); }
    // ---- obstacles, boosters (route content only after the fork decided it) ----
    for (const b of ST.obst) { if ((b.route && b.route !== ST.route) || !vis(b.d)) continue; const hit = GT - b.hitT < 0.5 ? GT - b.hitT : -1;
      if (b.kind === 'puddle') { const rp = 1 + 0.04 * Math.sin(GT * 3 + b.id); P.puddle.add(b.x * U, 0.03, -b.d * U, 1.25 * rp, 1, 1.25 * rp, 0, b.id * 0.7, 0); if (GT % 1.2 < 0.6) P.fx.add(b.x * U, 0.045, -b.d * U, 0.25 + 0.6 * (GT % 1.2) / 0.6, 1, 0.2 + 0.5 * (GT % 1.2) / 0.6, 0, 0, 0, 0xd8f2ff); }   // flat, never tilts; a slow ripple ring
      else OB[b.kind]().add(b.x * U, 0, -b.d * U, 1, 1, 1, hit >= 0 ? -0.4 * Math.sin(hit / 0.5 * Math.PI) : 0, b.id * 0.7, 0); if (b.kind !== 'puddle') P.blob.add(b.x * U, 0.02, -b.d * U, 1.1, 1, 1); }
    // ---- tips: spinning coins; a taken one flies into the backpack ----
    for (const c of ST.coins) { if ((c.route && c.route !== ST.route) || !vis(c.d)) continue; const z = -c.d * U, x = c.x * U;
      if (c.st === 1) { const e = ST.ev.find((q) => q.k === 'coin' && q.id === c.id), a = e ? GT - e.t : 9; if (a < 0.3) { const q = ease(a / 0.3), sc = 1.3 * (1 - q); P.coin.add(x + (ST.x * U - x) * q, 0.6 + 1.4 * q, z + (-ST.d * U + 0.3 - z) * q, sc, sc, sc, 0, GT * 14, 0); } continue; }
      P.coin.add(x, 0.6 + 0.07 * Math.sin(GT * 4 + c.id), z, 1.3, 1.3, 1.3, 0, GT * 4 + c.id * 0.4, 0); }
    for (const p of ST.pads) { if ((p.route && p.route !== ST.route) || !vis(p.d)) continue; const lit = GT - p.hitT < 0.4, pu = 1 + 0.06 * Math.sin(GT * 6 - p.d * 0.01);
      P.pad.add(p.x * U, 0.03, -p.d * U, pu * (lit ? 1.3 : 1), 1, pu * (lit ? 1.3 : 1), 0, 0, 0, lit ? 0xffffff : 0xffe066); P.glow.add(p.x * U, 0.025, -p.d * U, 1.8, 1, 1.8); }
    // ---- fork arches until passed; the door + customer at the route's distance ----
    for (const r of ['yard', 'avenue']) P.arch[r].visible = !ST.route || GT - ST.log.first.fork < 1.0;
    const hz = -SIM.houseD(ST) * U, near = !!ST.route && hz > cz - 50; P.house.position.set(0, 0.12, hz - 1.6); P.house.visible = near;
    P.cust.g.visible = near; if (near) { const Cc = P.cust, B = Cc.r.bones, I = S.IK; Cc.g.position.set(0.9, 0.3, hz - 1.1); Cc.g.rotation.y = Math.PI + 0.35;   // group −Z faces the street
      for (const n in B) B[n].quaternion.copy(B[n].userData.q0); Cc.r.play('Idle', GT); Cc.g.updateMatrixWorld(true);
      const reach = dA >= 0 ? SS(0.25, 0.6, dA) * (1 - SS(0.85, 1.25, dA)) : 0, hold = dA >= 0 ? SS(0.85, 1.25, dA) : 0;   // reach out with the right hand, take the bag, bring it to her side
      if (reach > 0) ik2(B.RightArm, B.RightForeArm, B.RightHand, L_(Cc, 0.16, 1.02, -0.42), L_(Cc, 0.45, 0.8, 0.1), reach);
      if (hold > 0) ik2(B.RightArm, B.RightForeArm, B.RightHand, L_(Cc, 0.27, 0.78, -0.1), L_(Cc, 0.5, 0.95, 0.15), hold);
      if (B.RightHand) B.RightHand.getWorldPosition(P.custHand); }
    P.bag.visible = dA >= 0.2; if (dA >= 0.2) { const q = SS(0.2, 0.62, dA), x0 = ST.x * U + 0.3, y0 = 0.9, z0 = -ST.d * U - 0.4, hx = P.custHand.x, hy = P.custHand.y - 0.6, hz2 = P.custHand.z;   // into her hand, then it hangs from it
      P.bag.position.set(x0 + (hx - x0) * q, y0 + (hy - y0) * q + 0.35 * Math.sin(q * Math.PI), z0 + (hz2 - z0) * q); P.bag.rotation.set(0, q * 1.2, 0.08 * Math.sin(GT * 3) * SS(0.9, 1.3, dA)); }
    // ---- FX from events ----
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue; const x = e.x * U, z = e.y * U;
      if (e.k === 'pick' && a < 0.45) { const r = 0.5 + 1.3 * ease(a / 0.45); P.fx.add(x, 0.06, z, r, 1, r, 0, 0, 0, 0xffe066); for (let j = 0; j < 12; j++) { const an = j * 0.52, v = 2.5 * a; P.bits.add(x + Math.cos(an) * v, 0.6 + 2.6 * a - 4 * a * a, z + Math.sin(an) * v * 0.6, 0.08, 0.08, 0.08, a * 9, an, 0, [0xffffff, COL.teal, 0xffe066][j % 3]); } }
      if (e.k === 'wrong' && a < 0.45) { const r = 0.5 + 1.2 * ease(a / 0.45); P.fx.add(x, 0.06, z, r, 1, r, 0, 0, 0, 0xff5a4a); }
      if (e.k === 'slow' && a < 0.5) for (let j = 0; j < 8; j++) { const an = j * 0.8, v = 1.3 * a, s = 0.2 * (1 - a); P.bits.add(x + Math.cos(an) * v, 0.2 + a, z + Math.sin(an) * v, s, s, s, 0, 0, 0, e.kind === 'puddle' ? 0x9fd0f0 : 0xd9cdb8); }
      if (e.k === 'streak' && a < 0.9 && ST.log.first.streak !== undefined && e.t > ST.log.first.streak + 0.5) for (let j = 0; j < 40; j++) { const an = j * 0.157, v = 3.2 * a; P.bits.add(x + Math.cos(an) * v, 0.8 + 3.5 * a - 4 * a * a, z + Math.sin(an) * v * 0.7, 0.09, 0.14, 0.03, a * 12 + j, an, 0, [COL.teal, COL.coral, 0xffe066, 0xffffff][j % 4]); }   // the 2nd streak pays off bigger
      if (e.k === 'boost' && a < 0.35) { const r = 0.6 + 1.0 * ease(a / 0.35); P.fx.add(x, 0.05, z, r, 1, r, 0, 0, 0, 0xffe066); }
      if ((e.k === 'deliver' || e.k === 'late') && a > 0.8) for (let j = 0; j < 50 && a < 3; j++) { const ph = ((a - 0.8) * 0.5 + h1(j)) % 1; P.bits.add((h1(j + 3) - 0.5) * 4, 3.4 - ph * 3.4, hz - 0.2 + (h1(j + 7) - 0.5) * 2, 0.07, 0.11, 0.02, ph * 9 + j, ph * 5, 0, [COL.teal, COL.coral, 0xffe066][j % 3]); } }
    // ---- speed: streaks + a glowing teal trail behind the scooter on turbo / boost ----
    const fast = Math.max(GT - ST.turboT < k.TURBO_T ? 1 : 0, GT - ST.boostT < k.BOOST_T ? 0.6 : 0);
    if (fast && ST.end < 0 && ST.deliverT < 0) { for (let j = 0; j < 22; j++) { const ph = (GT * 3 + h1(j)) % 1, sx = (h1(j + 11) - 0.5) * 7; P.streak.add(ST.x * U + sx, 0.2 + 2.4 * h1(j + 5), -ST.d * U - 6 + ph * 11, 1, 1, fast, 0, 0, 0, j % 3 ? 0xffffff : 0xfff1a8); }
      for (let j = 0; j < 10; j++) P.trail.add(ST.x * U + steer * 0.04 * j, 0.04, -ST.d * U + 0.8 + j * 0.45, 0.55 * (1 - j / 12), 1, 0.6 * fast, 0, 0, 0, j % 2 ? 0xffe066 : 0xffcc00); }
    for (const p of POOLS()) p.end();
    // ---- camera: the sim's look point + zoom → a tilted follow camera; FOV punch on turbo / streak, shake on a stumble ----
    let punch = 0, tr = 0; for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue; if ((e.k === 'turbo' || e.k === 'streak') && a < 0.5) punch = Math.max(punch, (e.k === 'streak' ? 12 : 8) * (1 - a / 0.5)); if (e.k === 'streak' && a < 0.35) tr = Math.max(tr, 0.6 * (1 - a / 0.35)); if (e.k === 'slow' && a < 0.3) tr = Math.max(tr, 1 - a / 0.3); }
    const sh = 0.08 * tr, tx = ST.cam[0] * U + sh * Math.sin(GT * 83), tz = ST.cam[1] * U, dist = 11.5 / ST.zoom, pitch = 0.3, D = S.devCam;
    cam.fov = 58 + punch + (GT - ST.turboT < k.TURBO_T ? 6 * (1 - SS(k.TURBO_T - 0.6, k.TURBO_T, GT - ST.turboT)) : 0);
    if (D) { const cx = ST.x * U, cz2 = -ST.d * U, dd = D.dist || 3.5, pt = D.pitch || 0.3, yw = D.yaw || 0; cam.fov = D.fov || 40; cam.position.set(cx + Math.sin(yw) * Math.cos(pt) * dd, (D.y || 1) + Math.sin(pt) * dd, cz2 + Math.cos(yw) * Math.cos(pt) * dd); cam.lookAt(cx, D.y || 1, cz2); }
    else { cam.position.set(tx, Math.sin(pitch) * dist, tz + Math.cos(pitch) * dist); cam.lookAt(tx, 0, tz); }
    cam.updateProjectionMatrix(); P.city.visible = !(D && D.bare); if (P.facades) P.facades.visible = P.city.visible; if (D && D.bare) { P.house.visible = false; if (!D.cust) P.cust.g.visible = false; }
    P.sky.position.set(tx, P.skyY || 6, tz - 58); if (P.waterT) P.waterT.offset.set(GT * 0.01, GT * 0.03);
    sun.position.set(tx - 7, 15, tz + 4); sun.target.position.set(tx, 0, tz - 2); sun.target.updateMatrixWorld();
    R.info.reset(); R.autoClear = true; R.render(scene, cam);
    // ---- endcard: dim the world, then the courier on the scooter between the headline and the coupon (win: waves + confetti) ----
    if (ST.end >= 0) { const a = GT - ST.end, kk = SS(0, 0.45, a), sm = clamp((a - 0.3) / 0.35, 0, 1);
      end.dim.material.opacity = 0.34 * kk; R.autoClear = false; R.render(end.dimScene, end.dimCam);   // lighter: the street stays readable behind the card
      if (sm > 0) { const oy = (VH - 1920) / 2, yf = 895 + oy, hpx = 420 * (sm < 1 ? 1.12 * ease(sm) - 0.12 * sm * sm : 1), tn = Math.tan(15 * Math.PI / 180);
        const d = 1.5 * VH / (2 * tn * Math.max(1, hpx)), yc = (2 * yf / VH - 1) * d * tn;       // feet at screen y = yf, ~1.5 m tall = hpx px
        const E = end.C; E.g.rotation.set(0, Math.PI - 0.6 + 0.15 * Math.sin(GT * 0.8), 0); poseCourier(E, ST.endWhy === 'win' ? 'wave' : 'ride', a);
        end.conf.begin(); if (ST.endWhy === 'win') for (let j = 0; j < 90; j++) { const ph = (a * 0.35 + h1(j)) % 1; end.conf.add((h1(j + 3) - 0.5) * 3.2, 2.6 - ph * 3.0, (h1(j + 7) - 0.5) * 1.5, 1, 1, 1, ph * 9 + j, ph * 5, 0, [COL.teal, COL.coral, 0xffe066, 0xffffff][j % 4]); } end.conf.end();
        end.cam.position.set(0, yc, d); end.cam.lookAt(0, yc, 0);
        R.clearDepth(); R.render(end.scene, end.cam); }
      R.autoClear = true; }
    S.proj = (x, y, h) => KIT.proj(cam, x * U, h, y * U, VW, VH);
    HUD.draw(ST, t, S.proj);
    S.hit = HUD.hit;
  };

  S.debugScene = () => scene; S.debugEnd = () => end;
  S.stats = () => ({ calls: R.info.render.calls, tris: R.info.render.triangles });
  // numbers instead of screenshots: draw calls, triangles, the courier's screen box (share of the view height), HUD boxes off-screen / overlapping
  S.probe = () => { const ST = S.cur; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
    for (const [dx, h, dz] of [[-0.4, 0, 0.6], [0.4, 0, -0.6], [-0.4, 1.9, 0], [0.4, 1.9, 0.6]]) { const p = KIT.proj(cam, ST.x * U + dx, h, -ST.d * U + dz, VW, VH); if (!p) continue; n++; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const b = n ? [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)] : null, c = HUD.check();
    return { calls: R.info.render.calls, tris: R.info.render.triangles, hero: b, heroH: b ? +((b[3] - b[1]) / VH * 100).toFixed(1) : 0, heroY: b ? +(((b[1] + b[3]) / 2) / VH * 100).toFixed(0) : 0,
      heroOn: !!b && b[0] >= 0 && b[2] <= VW && b[1] >= 0 && b[3] <= VH, hudOut: c.out, hudOverlap: c.ov }; };
  // QA states: moments of the attract demo found by event time (they follow the tuning), plus a late courier and a passive viewer
  S.QA = () => { const copy = (s) => JSON.parse(JSON.stringify(s)), F = SIM.at(SIM.L - 0.01).log.first, at = (tt) => copy(SIM.at(tt));
    const until = (pol, stop) => { const s = SIM.spawn(0); while (!stop(s) && s.t < 40) SIM.step(s, SIM.inputFor(s, SIM.plan(s, pol))); return copy(s); };
    const run = (pol) => { const s = SIM.spawn(0); while (s.end < 0 && s.t < 40) SIM.step(s, pol ? SIM.inputFor(s, SIM.plan(s, pol)) : {}); const e = s.end; while (s.t < e + 1.6) SIM.step(s, {}); return copy(s); };
    return [['start', at(0.3)], ['pick', at(F.pick + 0.2)], ['collect', at(F.pick + 2.6)], ['listDone', at(F.listDone + 0.3)], ['turbo', at(F.listDone + 1.6)], ['tips', at(F.coin + 0.9)], ['streak', at(F.streak + 0.2)],
      ['fork', at(F.fork - 0.7)], ['yard', at(F.fork + 2.6)], ['deliver', at(F.deliver + 0.9)], ['endcard_win', at(F.end + 1.5)],
      ['endcard_late', run({ fork: 'avenue', wrong: 1, boosts: false, dodge: false, stay: false })], ['endcard_time', run(null)], ['wrong', until({ fork: 'avenue', wrong: 1, boosts: false, dodge: false, stay: false }, (s) => s.log.first.wrong !== undefined && s.t > s.log.first.wrong + 0.2)]]; };
})();
