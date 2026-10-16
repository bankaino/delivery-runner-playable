// live/audio.js — procedural sound (WebAudio, zero asset bytes) driven by the sim event bus S.ev.
// index.html calls AUDIO.tick(state) once per frame in play mode; the context starts on the first user gesture (autoplay policy)
// and AUDIO.mute(bool) is wired to ad-network viewability / audio-volume callbacks. Phase 1: first pass of the cues; phase 3 polishes.
(function () {
  let ac = null, out = null, last = -1, muted = false, nbuf = null, hum = null;
  const at = {};
  const start = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    ac = new C(); out = ac.createGain(); out.gain.value = muted ? 0 : 0.55;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 5; out.connect(comp); comp.connect(ac.destination);
    // scooter hum: a soft filtered triangle, only while moving
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 70; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(out); o.start(); hum = { o, g };
  };
  addEventListener('pointerdown', start, { capture: true }); addEventListener('keydown', start, { capture: true });
  const noise = () => { if (nbuf) return nbuf; nbuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate); const d = nbuf.getChannelData(0);
    let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } return nbuf; };
  const env = (node, t0, a, peak, dur) => { const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(g); g.connect(out); return g; };
  const tone = (freq, t0, dur, type = 'sine', peak = 0.2, slide = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur); env(o, t0, 0.005, peak, dur); o.start(t0); o.stop(t0 + dur + 0.05); };
  const burst = (t0, dur, f0, f1, peak, q = 1.2, type = 'bandpass') => { const s = ac.createBufferSource(); s.buffer = noise(); const f = ac.createBiquadFilter();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur); s.connect(f); env(f, t0, 0.004, peak, dur); s.start(t0); s.stop(t0 + dur + 0.05); };
  const fan = (t0, notes, step = 0.1, type = 'triangle', peak = 0.1) => notes.forEach((f, i) => tone(f, t0 + i * step, 0.28, type, peak));
  const SFX = {
    pick: (n, e) => { const f = 784 * Math.pow(2, (e.n - 1) * 2 / 12); tone(f, n, 0.1, 'triangle', 0.14); tone(f * 1.5, n + 0.06, 0.16, 'triangle', 0.11); },   // «дзынь», higher per item
    wrong: (n) => { tone(110, n, 0.25, 'sine', 0.35, 0.5); burst(n, 0.12, 600, 150, 0.15); },
    dup: (n) => tone(300, n, 0.08, 'triangle', 0.1),
    slow: (n) => { burst(n, 0.2, 900, 200, 0.25, 0.8, 'lowpass'); tone(160, n, 0.15, 'triangle', 0.2, 0.6); },
    listDone: (n) => fan(n, [523, 659, 784, 1047], 0.07, 'square', 0.08),
    turbo: (n) => { tone(180, n + 0.2, 0.7, 'sawtooth', 0.1, 4); burst(n + 0.2, 0.7, 300, 3500, 0.12, 0.7); },
    boost: (n, e) => { tone(440 * Math.pow(2, (e.n - 1) * 4 / 12), n, 0.18, 'sawtooth', 0.07, 2); burst(n, 0.2, 800, 3000, 0.08, 0.8); },
    streak: (n) => fan(n + 0.12, [659, 880, 1175], 0.06, 'square', 0.08),
    fork: (n) => tone(660, n, 0.12, 'triangle', 0.1),
    deliver: (n) => { tone(1318, n, 0.15, 'sine', 0.15); tone(1046, n + 0.12, 0.3, 'sine', 0.15); fan(n + 0.4, [523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.1); },   // door chime + arpeggio
    late: (n) => fan(n, [523, 494, 440, 392], 0.14, 'triangle', 0.1),
    coin: (n, e) => { const f = 1320 * Math.pow(2, ((e.n - 1) % 8) / 12); tone(f, n, 0.07, 'square', 0.05); tone(f * 1.5, n + 0.04, 0.09, 'triangle', 0.06); },   // tips: a bright ding, rising along a trail
    clear: (n) => burst(n, 0.25, 3000, 800, 0.05, 0.7),                                                   // spare rows vanish: a soft «пуф»
    end: (n, e) => { if (e.why === 'win') fan(n + 0.35, [784, 988, 1175, 1568], 0.08, 'triangle', 0.09); else tone(660, n + 0.3, 0.25, 'triangle', 0.08); },
  };
  let netMute = false, hidden = false; const apply = () => { if (out) out.gain.value = netMute || hidden ? 0 : 0.55; };
  addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });
  window.AUDIO = {
    cta: () => { if (ac) { tone(660, ac.currentTime, 0.08, 'triangle', 0.14); tone(990, ac.currentTime + 0.07, 0.12, 'triangle', 0.14); } },
    mute: (m) => { muted = m; netMute = m; apply(); },
    tick: (S) => {
      if (!ac || !S) return; const now = ac.currentTime;
      if (S.t < last) last = -1;                                                                  // restart / replay
      for (const e of S.ev) { if (e.t <= last || !SFX[e.k]) continue; if (now - (at[e.k] || -9) < 0.05) continue; at[e.k] = now; SFX[e.k](now, e); }
      if (hum) { const mv = S.end < 0 && S.v > 0 ? Math.min(1, S.v / SIM.K.RUN) : 0; hum.g.gain.setTargetAtTime(0.03 * mv, now, 0.1); hum.o.frequency.setTargetAtTime(60 + 40 * mv, now, 0.1); }
      last = S.t;
    },
  };
})();
