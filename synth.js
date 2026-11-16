// STILL — the synthesizer: the score and every sound, in plain JS.
// Runs in a Worker (live and export) so the real-time audio thread only copies samples.
// Written as one function so it can be turned into a Worker from the page itself (works from file:// too).
// It reproduces the Web Audio engine of audio.js (kept in test/legacy-audio.js as the reference):
// same score, same random draws, same envelopes, filters, panning, rooms and compressor.

function StillSynthModule(G){
  'use strict';
  const BLOCK = 512;                 // frames per internal block (also the reverb's first partition)

  // ------------------------------------------------------------ harmony (as in audio.js)
  const HERE_CHORDS = [
    [0, 12, 19, 23, 26, 28], [-3, 9, 16, 19, 23, 24], [-7, 5, 12, 16, 19, 23],
    [-5, 7, 14, 21, 23, 26], [2, 14, 17, 21, 24, 28], [-7, 5, 12, 19, 21, 24],
  ];
  const ION = [0, 2, 4, 5, 7, 9, 11], LYD = [0, 2, 4, 6, 7, 9, 11], DOR = [0, 2, 3, 5, 7, 9, 10];
  const AEO = [0, 2, 3, 5, 7, 8, 10], MIX = [0, 2, 4, 5, 7, 9, 10], BHAIRAV = [0, 1, 4, 5, 7, 8, 11];
  const PADS = {
    here: { types: ['sawtooth', 'triangle'], gains: [0.35, 0.8], det: 6, attack: 6 },
    air:  { types: ['sine', 'triangle'],     gains: [0.9, 0.55], det: 9, attack: 9 },
    warm: { types: ['sawtooth', 'sawtooth'], gains: [0.42, 0.42], det: 9, attack: 7 },
    soft: { types: ['triangle', 'sine'],     gains: [0.75, 0.6], det: 5, attack: 8 },
    dark: { types: ['triangle', 'triangle'], gains: [0.8, 0.6], det: 7, attack: 11 },
  };
  const DRONES = {
    here:   [[-12, 0.9], [0, 0.35], [0, 0.35], [7, 0.35]],
    light:  [[0, 0.45], [12, 0.22], [12, 0.22], [19, 0.18]],
    soft:   [[-12, 0.6], [0, 0.22], [0, 0.22], [7, 0.12]],
    fifth:  [[-12, 0.9], [-5, 0.5], [0, 0.42], [7, 0.4]],
    tanpura:[[-12, 0.55], [0, 0.12], [0, 0.12], [7, 0.08]],
    sub:    [[-12, 0.95], [-12, 0.3], [0, 0.3], [7, 0.12]],
  };
  const MOODS = {
    here:    { scale: ION, melody: [0, 1, 2, 4, 5], chords: HERE_CHORDS,
               pad: 'here', drone: 'here', chordLen: 1, motion: 'here', reg: 0, density: 1, bright: 1 },
    dawn:    { scale: LYD, melody: [0, 1, 2, 3, 4, 6], prog: [0, 1, 5, 0, 4, 1], voicing: 'air',
               pad: 'air', drone: 'light', chordLen: 0.75, motion: 'rise', reg: 12, density: 1.35, bright: 1.8, padLevel: 1.35 },
    soulful: { scale: DOR, melody: [0, 2, 3, 4, 5, 6], prog: [0, 3, 0, 6, 2, 3],
               pad: 'warm', drone: 'here', chordLen: 1.3, motion: 'phrase', reg: 0, density: 1, bright: 0.95, padLevel: 1.25 },
    tender:  { scale: AEO, melody: [0, 1, 2, 4, 6], prog: [0, 5, 2, 6, 0, 3], voicing: 'close',
               pad: 'soft', drone: 'soft', chordLen: 1.6, motion: 'echo', reg: 0, density: 0.6, bright: 0.65, padLevel: 1.15 },
    earth:   { scale: MIX, melody: [0, 1, 2, 4, 6], prog: [0, 6, 0, 3], voicing: 'open',
               pad: 'soft', drone: 'fifth', chordLen: 1.5, motion: 'ostinato', reg: 0, density: 1, bright: 0.9, padLevel: 0.7 },
    raga:    { scale: BHAIRAV, melody: [0, 1, 2, 3, 4, 5, 6], chords: null,
               pad: null, drone: 'tanpura', chordLen: 1, motion: 'raga', reg: 0, density: 0.9, bright: 1 },
    deep:    { scale: AEO, melody: [0, 2, 3, 4, 6], prog: [0, 5, 3, 0, 6], voicing: 'open',
               pad: 'dark', drone: 'sub', chordLen: 2, motion: 'here', reg: -12, density: 0.45, bright: 0.45 },
  };
  const deg = (scale, d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  function chordOn(scale, r, voicing){
    let b = deg(scale, r); if(b > 5) b -= 12;
    const i = k => deg(scale, r + k) - deg(scale, r);
    if(voicing === 'air')   return [b + 12, b + 12 + i(4), b + 24, b + 24 + i(2), b + 24 + i(6)];
    if(voicing === 'close') return [b, b + 12, b + 12 + i(2), b + 12 + i(4), b + 12 + i(6)];
    if(voicing === 'open')  return [b, b + i(4), b + 12, b + 12 + i(4), b + 24];
    return [b, b + 12, b + 12 + i(4), b + 12 + i(6), b + 12 + i(8), b + 24 + i(2)];
  }
  function chordsFor(M){
    if(M.chords !== undefined) return M.chords;
    return M._chords || (M._chords = M.prog.map(r => chordOn(M.scale, r, M.voicing)));
  }
  function melodyFor(M){
    const out = [];
    for(let o = 0; o < 5; o++) M.melody.forEach(d => {
      const n = deg(M.scale, d) + 12 * o;
      if(n >= 19 && n <= 38) out.push(n);
    });
    return out.sort((a, b) => a - b);
  }
  const tonicBase = pitch => 31 + pitch;
  const VOICES = {
    wood:    { reg: 0,   step: 0.42 },
    bowl:    { reg: -12, step: 1.6, slow: true },
    kalimba: { reg: 0,   step: 0.36 },
    harp:    { reg: 0,   step: 0.34 },
    handpan: { reg: -12, step: 0.55 },
    flute:   { reg: 0,   step: 0.75 },
  };

  // ------------------------------------------------------------ seeded randomness (as in audio.js)
  function mulberry(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const hash = (...xs) => xs.reduce((h, x) => Math.imul(h ^ (x | 0), 0x9E3779B1) ^ (h >>> 15), 0x811C9DC5);
  const hashStr = str => hash(...[...str].map(c => c.charCodeAt(0)));
  let RNG = Math.random;
  const rand = () => RNG();
  const rnd = (a, b) => a + rand() * (b - a);
  const pick = a => a[Math.floor(rand() * a.length)];
  function seeded(seed, fn){
    const prev = RNG; RNG = mulberry(seed);
    try { return fn(); } finally { RNG = prev; }
  }

  // ------------------------------------------------------------ FFT (radix-2, complex, in place)
  const FFTS = {};
  function fftPlan(N){
    if(FFTS[N]) return FFTS[N];
    const bits = Math.log2(N) | 0, rev = new Uint32Array(N);
    for(let i = 0; i < N; i++){ let r = 0; for(let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    const cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
    for(let i = 0; i < N / 2; i++){ cos[i] = Math.cos(2 * Math.PI * i / N); sin[i] = Math.sin(2 * Math.PI * i / N); }
    return FFTS[N] = { N, rev, cos, sin };
  }
  // inverse: sign +1 (no scaling)
  function fft(plan, re, im, inverse){
    const { N, rev, cos, sin } = plan;
    for(let i = 0; i < N; i++){
      const j = rev[i];
      if(j > i){ let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    const s = inverse ? 1 : -1;
    for(let size = 2; size <= N; size <<= 1){
      const half = size >> 1, step = N / size;
      for(let i = 0; i < N; i += size){
        for(let j = 0, k = 0; j < half; j++, k += step){
          const wr = cos[k], wi = s * sin[k];
          const a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  }

  // ------------------------------------------------------------ oscillators: band-limited wavetables
  // Web Audio's oscillators are band-limited Fourier series normalised to a peak of 1; so are these.
  const TBL = 4096;
  const WAVES = {};
  const TABLE_COUNTS = [];
  for(let j = 0; ; j++){ const c = Math.max(1, Math.round(2048 * Math.pow(2, -j / 3))); TABLE_COUNTS.push(c); if(c === 1) break; }
  function coef(type, n){
    if(type === 'sawtooth') return 2 / (n * Math.PI) * (n % 2 ? 1 : -1);
    if(type === 'triangle') return 8 * Math.sin(n * Math.PI / 2) / (Math.PI * n) ** 2;
    return n === 1 ? 1 : 0;
  }
  function waveTable(type, count){
    const W = WAVES[type] || (WAVES[type] = { tables: [], norm: 0 });
    if(W.tables[count]) return W.tables[count];
    const build = cnt => {
      const plan = fftPlan(TBL), re = new Float64Array(TBL), im = new Float64Array(TBL);
      // x(t) = sum b[n] sin(2π n t): inverse DFT with X[n] = -i b/2, X[N-n] = +i b/2
      for(let n = 1; n <= Math.min(cnt, TBL / 2 - 1); n++){ const b = coef(type, n); im[n] = -b / 2; im[TBL - n] = b / 2; }
      fft(plan, re, im, true);
      const t = new Float32Array(TBL + 1);
      for(let i = 0; i < TBL; i++) t[i] = re[i];
      t[TBL] = t[0];
      return t;
    };
    if(!W.norm){
      const full = build(2047); let peak = 0;
      for(let i = 0; i < TBL; i++) peak = Math.max(peak, Math.abs(full[i]));
      W.norm = 1 / peak;
    }
    const t = build(count);
    for(let i = 0; i <= TBL; i++) t[i] *= W.norm;
    return W.tables[count] = t;
  }
  function tableFor(type, freq, sr){
    if(type === 'sine') return waveTable('sine', 1);
    const allowed = sr / 2 / Math.max(1e-3, Math.abs(freq));
    for(const c of TABLE_COUNTS) if(c <= allowed) return waveTable(type, c);
    return waveTable(type, 1);
  }

  // ------------------------------------------------------------ AudioParam: Web Audio automation semantics
  const SET = 0, LIN = 1, EXP = 2, TGT = 3;
  class Param {
    constructor(s, v){
      this.s = s; this.v = v; this.ev = []; this.ins = null;
      this.mode = SET; this.lastT = 0; this.lastV = v;     // the last event passed, and its value
      this.nextF = Infinity; this.dirty = true;
      this.buf = null; this.isConst = true;
    }
    get value(){ return this.v; }
    set value(v){ this.v = this.lastV = v; this.mode = SET; this.dirty = true; }
    add(e){
      const ev = this.ev; let i = ev.length;
      while(i > 0 && ev[i - 1].t > e.t) i--;
      ev.splice(i, 0, e); this.dirty = true;
      return this;
    }
    setValueAtTime(v, t){ return this.add({ type: SET, t, v }); }
    linearRampToValueAtTime(v, t){ return this.add({ type: LIN, t, v }); }
    exponentialRampToValueAtTime(v, t){ return this.add({ type: EXP, t, v }); }
    setTargetAtTime(v, t, tc){ return this.add({ type: TGT, t, v, tc: Math.max(1e-6, tc) }); }
    cancelScheduledValues(t){ this.ev = this.ev.filter(e => e.t < t); this.dirty = true; }
    cancelAndHoldAtTime(t){
      // hold the value the curve has now; what comes after is forgotten
      this.ev = this.ev.filter(e => e.t < t);
      this.refresh(Math.round(t * this.s.sr));
      const v = this.v;
      this.ev = []; this.mode = SET; this.lastT = t; this.lastV = v; this.v = v; this.dirty = true;
    }
    connect(){ throw new Error('params do not connect'); }
    // bring the state up to frame k: pass every event whose time has come, choose the curve ahead
    refresh(k){
      const sr = this.s.sr, ev = this.ev;
      while(ev.length && ev[0].t * sr <= k){
        const e = ev.shift();
        if(e.type === TGT){ this.mode = TGT; this.tgt = e.v; this.tc = e.tc * sr; this.v0 = this.v; this.f0 = e.t * sr; }
        else { this.mode = SET; this.v = this.lastV = e.v; }
        this.lastT = e.t;
      }
      const n = ev[0];
      this.seg = null;
      if(n && (n.type === LIN || n.type === EXP)){
        let t0 = this.lastT, v0 = this.mode === TGT ? this.v : this.lastV;
        if(this.mode === TGT){ t0 = k / sr; }
        this.seg = { type: n.type, f0: t0 * sr, v0, f1: n.t * sr, v1: n.v };
      }
      this.nextF = n ? Math.ceil(n.t * sr - 1e-9) : Infinity;
      if(this.nextF <= k) this.nextF = k + 1;
      this.dirty = false;
    }
    valueAtFrame(k){
      const g = this.seg;
      if(g){
        const x = (k - g.f0) / (g.f1 - g.f0);
        if(g.type === LIN) return g.v0 + (g.v1 - g.v0) * x;
        if(g.v0 === 0 || g.v0 * g.v1 <= 0) return g.v0;
        return g.v0 * Math.pow(g.v1 / g.v0, x);
      }
      if(this.mode === TGT) return this.tgt + (this.v0 - this.tgt) * Math.exp(-(k - this.f0) / this.tc);
      return this.lastV;
    }
    // fills this.buf for the current block; returns it (isConst tells if it is one value)
    process(){
      const s = this.s, k0 = s.frame, n = BLOCK;
      if(this.dirty) this.refresh(k0);
      const buf = this.buf || (this.buf = new Float32Array(BLOCK));
      let i = 0, flat = true;
      while(i < n){
        const k = k0 + i;
        if(k >= this.nextF){ this.refresh(k); if(i > 0) flat = false; }   // a value changes inside the block
        const end = Math.min(n, this.nextF - k0);
        const g = this.seg;
        if(g){
          flat = false;
          if(g.type === LIN || g.v0 === 0 || g.v0 * g.v1 <= 0){
            for(; i < end; i++) buf[i] = this.valueAtFrame(k0 + i);
          } else {
            let v = this.valueAtFrame(k0 + i);
            const r = Math.pow(g.v1 / g.v0, 1 / (g.f1 - g.f0));
            for(; i < end; i++){ buf[i] = v; v *= r; }
          }
          this.v = buf[i - 1];
        } else if(this.mode === TGT){
          flat = false;
          let v = this.valueAtFrame(k0 + i);
          const c = Math.exp(-1 / this.tc), T = this.tgt;
          for(; i < end; i++){ buf[i] = v; v = T + (v - T) * c; }
          this.v = buf[i - 1];
          if(Math.abs(this.v - T) < 1e-7 * Math.max(1, Math.abs(T))){ this.mode = SET; this.v = this.lastV = T; }
        } else {
          const v = this.lastV;
          for(; i < end; i++) buf[i] = v;
          this.v = v;
        }
      }
      if(this.ins){
        flat = false;
        for(const node of this.ins){ const x = node.pull(); for(let j = 0; j < n; j++) buf[j] += x[j]; }
      }
      this.isConst = flat;
      return buf;
    }
  }

  // ------------------------------------------------------------ a tiny mono node graph (pull, one block at a time)
  class Node {
    constructor(s){ this.s = s; this.out = new Float32Array(BLOCK); this.ins = []; this.blk = -1; }
    connect(d){ if(d instanceof Param) (d.ins || (d.ins = [])).push(this); else d.ins.push(this); return d; }
    pull(){ if(this.blk !== this.s.blk){ this.blk = this.s.blk; this.process(); } return this.out; }
    sumIn(){
      const o = this.out; o.fill(0);
      for(const n of this.ins){ const x = n.pull(); for(let i = 0; i < BLOCK; i++) o[i] += x[i]; }
      return o;
    }
  }
  class Gain extends Node {
    constructor(s, v){ super(s); this.gain = new Param(s, v === undefined ? 1 : v); }
    process(){
      const o = this.sumIn(), g = this.gain.process();
      if(this.gain.isConst){ const v = g[0]; if(v !== 1) for(let i = 0; i < BLOCK; i++) o[i] *= v; }
      else for(let i = 0; i < BLOCK; i++) o[i] *= g[i];
    }
  }
  // scheduled sources: silent outside [start, stop)
  class Source extends Node {
    constructor(s){ super(s); this.startF = Infinity; this.stopF = Infinity; }
    start(t){ this.startF = Math.max(Math.ceil(t * this.s.sr - 1e-9), this.s.frame); this.s.watch(this); return this; }
    stop(t){ this.stopF = Math.min(this.stopF, Math.max(Math.ceil(t * this.s.sr - 1e-9), this.s.frame)); }
    span(){
      const k0 = this.s.frame;
      return [Math.max(0, Math.min(BLOCK, this.startF - k0)), Math.max(0, Math.min(BLOCK, this.stopF - k0))];
    }
  }
  class Osc extends Source {
    constructor(s, type, freq){
      super(s); this.type = type || 'sine'; this.frequency = new Param(s, freq || 440); this.detune = { value: 0 };
      this.phase = 0;
    }
    process(){
      const o = this.out; o.fill(0);
      const [a, b] = this.span(); if(a >= b){ this.frequency.process(); return; }
      const f = this.frequency.process(), sr = this.s.sr, dm = Math.pow(2, this.detune.value / 1200);
      const tab = tableFor(this.type, f[a] * dm, sr);
      let ph = this.phase;
      for(let i = a; i < b; i++){
        const x = ph * TBL, k = x | 0, fr = x - k;
        o[i] = tab[k] + (tab[k + 1] - tab[k]) * fr;
        ph += f[i] * dm / sr; ph -= Math.floor(ph);
      }
      this.phase = ph;
    }
  }
  class BufSrc extends Source {
    constructor(s, data){ super(s); this.data = data; this.pos = 0; this.loop = false; this.rate = 1; }
    start(t, offset){ super.start(t); this.pos = Math.round((offset || 0) * this.s.sr); if(this.pos >= this.data.length) this.pos = this.loop ? this.pos % this.data.length : this.data.length; return this; }
    process(){
      const o = this.out; o.fill(0);
      const [a, b] = this.span(); if(a >= b) return;
      const d = this.data, L = d.length, r = this.rate;
      let p = this.pos;
      for(let i = a; i < b; i++){
        if(p >= L){ if(this.loop) p -= L; else { p = Infinity; break; } }
        const k = p | 0, fr = p - k, nx = k + 1 < L ? d[k + 1] : this.loop ? d[0] : 0;
        o[i] = fr ? d[k] + (nx - d[k]) * fr : d[k];
        p += r;
      }
      this.pos = p;
    }
  }
  // the Web Audio biquads (Audio EQ Cookbook; lowpass Q in dB, bandpass Q linear)
  function bqCoef(type, f, Q, sr, c){
    const nyq = sr / 2, fn = Math.max(0, Math.min(1, f / nyq));
    if(type === 'lowpass'){
      if(fn >= 1){ c[0] = 1; c[1] = c[2] = c[3] = c[4] = 0; return; }
      if(fn <= 0){ c[0] = c[1] = c[2] = c[3] = c[4] = 0; return; }
      const w0 = Math.PI * fn, alpha = Math.sin(w0) / (2 * Math.pow(10, Q / 20)), cw = Math.cos(w0);
      const a0 = 1 + alpha;
      c[0] = (1 - cw) / 2 / a0; c[1] = (1 - cw) / a0; c[2] = (1 - cw) / 2 / a0; c[3] = -2 * cw / a0; c[4] = (1 - alpha) / a0;
    } else {   // bandpass
      if(fn <= 0 || fn >= 1){ c[0] = c[1] = c[2] = c[3] = c[4] = 0; return; }
      if(Q <= 0){ c[0] = 1; c[1] = c[2] = c[3] = c[4] = 0; return; }
      const w0 = Math.PI * fn, alpha = Math.sin(w0) / (2 * Q), cw = Math.cos(w0), a0 = 1 + alpha;
      c[0] = alpha / a0; c[1] = 0; c[2] = -alpha / a0; c[3] = -2 * cw / a0; c[4] = (1 - alpha) / a0;
    }
  }
  class Biquad extends Node {
    constructor(s, type, freq, Q, channels){
      super(s); this.type = type; this.frequency = new Param(s, freq || 350); this.Q = { value: Q === undefined ? 1 : Q };
      this.c = new Float64Array(5); this.cf = NaN; this.cq = NaN;
      this.st = new Float64Array(4 * (channels || 1));
    }
    coefs(f){
      if(f !== this.cf || this.Q.value !== this.cq){ bqCoef(this.type, f, this.Q.value, this.s.sr, this.c); this.cf = f; this.cq = this.Q.value; }
      return this.c;
    }
    // filter x into y (may be the same array), channel ch's state; f: frequency per frame
    run(x, y, ch, f, flat){
      const st = this.st, o = ch * 4;
      let x1 = st[o], x2 = st[o + 1], y1 = st[o + 2], y2 = st[o + 3];
      for(let i0 = 0; i0 < BLOCK; i0 += 32){
        const c = this.coefs(flat ? f[0] : f[i0]), b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
        for(let i = i0; i < i0 + 32; i++){
          const xi = x[i], yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi;
        }
      }
      if(Math.abs(y1) < 1e-25){ y1 = 0; } if(Math.abs(y2) < 1e-25){ y2 = 0; }
      st[o] = x1; st[o + 1] = x2; st[o + 2] = y1; st[o + 3] = y2;
    }
    process(){
      const o = this.sumIn(), f = this.frequency.process();
      this.run(o, o, 0, f, this.frequency.isConst);
    }
  }
  // the end of a voice: a StereoPanner (mono in, equal power) adding into a stereo bus
  class Pan extends Node {
    constructor(s, bus, pan){ super(s); this.bus = bus; this.pan = { value: pan || 0 }; }
    connect(){ throw new Error('pan is terminal'); }
    mix(){
      const x = this.sumIn(), p = (Math.max(-1, Math.min(1, this.pan.value)) + 1) / 2;
      const gl = Math.cos(p * Math.PI / 2), gr = Math.sin(p * Math.PI / 2), L = this.bus.L, R = this.bus.R;
      for(let i = 0; i < BLOCK; i++){ L[i] += x[i] * gl; R[i] += x[i] * gr; }
    }
  }

  // ------------------------------------------------------------ rooms: exact convolution, partitioned in growing blocks
  // ConvolverNode's normalisation (Chromium/WebKit Reverb): 1/rms · −58 dB · 44100/sr
  function normScale(ir, sr){
    let p = 0, n = 0;
    for(const ch of ir){ for(let i = 0; i < ch.length; i++) p += ch[i] * ch[i]; n += ch.length; }
    p = Math.sqrt(p / n); if(!isFinite(p) || p < 0.000125) p = 0.000125;
    return 1 / p * Math.pow(10, -58 / 20) * 44100 / sr;
  }
  // stages: [partition size, first IR frame]; each stage starts at least one partition into the IR,
  // so its output is always needed later than its input is complete
  const STAGES = [[BLOCK, 0], [BLOCK * 8, BLOCK * 8], [BLOCK * 64, BLOCK * 64]];
  class Rooms {
    constructor(irs, sr){   // irs: [[L, R], ...]: one stereo impulse per room
      this.rooms = irs.map(ir => {
        const k = normScale(ir, sr);
        return { L: ir[0], R: ir[1], k, len: ir[0].length, on: true };
      });
      const maxLen = Math.max(...this.rooms.map(r => r.len));
      this.stages = [];
      STAGES.forEach(([P, D], si) => {
        const end = si + 1 < STAGES.length ? STAGES[si + 1][1] : maxLen;
        if(D >= maxLen) return;
        const N = 2 * P, H = P + 1, plan = fftPlan(N);
        const st = { P, D, N, H, plan, fill: 0, xL: new Float64Array(N), xR: new Float64Array(N),
          re: new Float64Array(N), im: new Float64Array(N), fdl: [], head: 0, parts: Math.ceil((Math.min(end, maxLen) - D) / P) };
        for(let q = 0; q < st.parts; q++) st.fdl.push({ L: [new Float64Array(H), new Float64Array(H)], R: [new Float64Array(H), new Float64Array(H)] });
        // each room's partitions, as spectra
        st.h = this.rooms.map(room => {
          const out = [];
          for(let q = 0; q < st.parts; q++){
            const a = D + q * P; if(a >= Math.min(end, room.len)){ out.push(null); continue; }
            const re = new Float64Array(N), im = new Float64Array(N);
            for(let i = 0; i < P && a + i < Math.min(end, room.len); i++){ re[i] = room.L[a + i] * room.k; im[i] = room.R[a + i] * room.k; }
            fft(plan, re, im, false);
            out.push(splitSpec(re, im, N));
          }
          return out;
        });
        this.stages.push(st);
      });
      // output accumulators (per room, stereo), a ring longer than the longest look-ahead
      this.ringN = 2 * BLOCK * 64 * 2;
      this.acc = this.rooms.map(() => [new Float64Array(this.ringN), new Float64Array(this.ringN)]);
      this.pos = 0;
    }
    // in: one block of the bus (L, R); out: per room [L, R] blocks
    process(inL, inR, outs){
      const B = BLOCK;
      for(const st of this.stages){
        // append to the stage's input (the second half of its window)
        for(let i = 0; i < B; i++){ st.xL[st.P + st.fill + i] = inL[i]; st.xR[st.P + st.fill + i] = inR[i]; }
        st.fill += B;
        if(st.fill < st.P) continue;
        st.fill = 0;
        const { N, H, P, plan, re, im } = st;
        re.set(st.xL); im.set(st.xR);
        fft(plan, re, im, false);
        st.head = (st.head + st.parts - 1) % st.parts;
        const slot = st.fdl[st.head];
        splitSpec(re, im, N, slot.L, slot.R);
        // slide the window
        st.xL.copyWithin(0, P); st.xR.copyWithin(0, P);
        this.rooms.forEach((room, r) => {
          if(!room.on) return;
          const yLr = new Float64Array(H), yLi = new Float64Array(H), yRr = new Float64Array(H), yRi = new Float64Array(H);
          let any = false;
          for(let q = 0; q < st.parts; q++){
            const h = st.h[r][q]; if(!h) continue; any = true;
            const x = st.fdl[(st.head + q) % st.parts];
            const xLr = x.L[0], xLi = x.L[1], xRr = x.R[0], xRi = x.R[1];
            const hLr = h.L[0], hLi = h.L[1], hRr = h.R[0], hRi = h.R[1];
            for(let k = 0; k < H; k++){
              yLr[k] += xLr[k] * hLr[k] - xLi[k] * hLi[k]; yLi[k] += xLr[k] * hLi[k] + xLi[k] * hLr[k];
              yRr[k] += xRr[k] * hRr[k] - xRi[k] * hRi[k]; yRi[k] += xRr[k] * hRi[k] + xRi[k] * hRr[k];
            }
          }
          if(!any) return;
          // Z = YL + i·YR (full spectrum), inverse → real part left, imaginary part right
          re[0] = yLr[0] - yRi[0]; im[0] = yLi[0] + yRr[0];
          for(let k = 1; k < H; k++){
            re[k] = yLr[k] - yRi[k]; im[k] = yLi[k] + yRr[k];
            if(k < N - k){ re[N - k] = yLr[k] + yRi[k]; im[N - k] = -yLi[k] + yRr[k]; }
          }
          fft(plan, re, im, true);
          const acc = this.acc[r], ring = this.ringN, start = this.pos + B - P + st.D;   // first output frame (relative)
          for(let i = 0; i < P; i++){
            const j = (start + i) % ring;
            acc[0][j] += re[P + i] / N; acc[1][j] += im[P + i] / N;
          }
        });
      }
      // the current block of each room
      this.rooms.forEach((room, r) => {
        const acc = this.acc[r], o = outs[r], ring = this.ringN;
        for(let i = 0; i < B; i++){
          const j = (this.pos + i) % ring;
          o[0][i] = acc[0][j]; o[1][i] = acc[1][j];
          acc[0][j] = 0; acc[1][j] = 0;
        }
      });
      this.pos = (this.pos + B) % this.ringN;
    }
  }
  // split the FFT of (a + i·b), a and b real, into the half spectra of a and of b
  function splitSpec(re, im, N, A, Bs){
    const H = N / 2 + 1;
    A = A || [new Float64Array(H), new Float64Array(H)]; Bs = Bs || [new Float64Array(H), new Float64Array(H)];
    for(let k = 0; k < H; k++){
      const m = (N - k) % N;
      const zr = re[k], zi = im[k], cr = re[m], ci = -im[m];          // conj(Z[N-k])
      A[0][k] = (zr + cr) / 2; A[1][k] = (zi + ci) / 2;
      // (Z - conj)/(2i) = (dr + i di)/(2i) = (di - i dr)/2
      const dr = zr - cr, di = zi - ci;
      Bs[0][k] = di / 2; Bs[1][k] = -dr / 2;
    }
    return { L: A, R: Bs };
  }

  // ------------------------------------------------------------ the compressor of Chromium (DynamicsCompressor), ported
  class Compressor {
    constructor(sr, threshold, knee, ratio, attack, release){
      this.sr = sr;
      const dB = x => 20 * Math.log10(x), lin = x => Math.pow(10, x / 20);
      this.dB = dB; this.lin = lin;
      this.linThr = lin(threshold); this.dbThr = threshold; this.dbKnee = knee; this.slope = 1 / ratio;
      this.k = this.kAtSlope(1 / ratio);
      this.dbKneeThr = threshold + knee; this.kneeThr = lin(this.dbKneeThr);
      this.dbYKneeThr = dB(this.kneeCurve(this.kneeThr, this.k));
      this.post = Math.pow(1 / this.saturate(1, this.k), 0.6);
      this.attackF = Math.max(0.001, attack) * sr;
      const R = release * sr, z1 = 0.09, z2 = 0.16, z3 = 0.42, z4 = 0.98;
      this.a = R * (0.9999999999999998 * z1 + 1.8432219684323923e-16 * z2 - 1.9373394351676423e-16 * z3 + 8.824516011816245e-18 * z4);
      this.b = R * (-1.5788320352845888 * z1 + 2.3305837032074286 * z2 - 0.9141194204840429 * z3 + 0.1623677525612032 * z4);
      this.c = R * (0.5334142869106424 * z1 - 1.272736789213631 * z2 + 0.9258856042207512 * z3 - 0.18656310191776226 * z4);
      this.d = R * (0.08783463138207234 * z1 - 0.1694162967925622 * z2 + 0.08588057951595272 * z3 - 0.00429891410546283 * z4);
      this.e = R * (-0.042416883008123074 * z1 + 0.1115693827987602 * z2 - 0.09764676325265872 * z3 + 0.028494263462021576 * z4);
      this.satRelF = 0.0025 * sr;
      this.pd = Math.min(1023, Math.floor(0.006 * sr));
      this.bufL = new Float32Array(1024); this.bufR = new Float32Array(1024);
      this.ri = 0; this.wi = this.pd;
      this.det = 0; this.gain = 1; this.maxAtt = -1;
    }
    kneeCurve(x, k){ return x < this.linThr ? x : this.linThr + (1 - Math.exp(-k * (x - this.linThr))) / k; }
    saturate(x, k){
      if(x < this.kneeThr) return this.kneeCurve(x, k);
      return this.lin(this.dbYKneeThr + this.slope * (this.dB(x) - this.dbKneeThr));
    }
    kAtSlope(want){
      const dbx = this.dbThr + this.dbKnee, x = this.lin(dbx);
      let x2 = 1, dbx2 = 0;
      if(!(x < this.linThr)){ x2 = x * 1.001; dbx2 = this.dB(x2); }
      let mn = 0.1, mx = 10000, k = 5, slope = 1;
      for(let i = 0; i < 15; i++){
        if(!(x < this.linThr)) slope = (this.dB(this.kneeCurve(x2, k)) - this.dB(this.kneeCurve(x, k))) / (dbx2 - dbx);
        if(slope < want) mx = k; else mn = k;
        k = Math.sqrt(mn * mx);
      }
      return k;
    }
    process(L, R, n){
      const k = this.k, post = this.post;
      for(let f = 0; f < n; f += 32){
        if(!isFinite(this.det)) this.det = 1;
        const desired = this.det, scaled = Math.asin(desired) / (Math.PI / 2);
        let rate = 0;
        const releasing = scaled > this.gain;
        let diff = scaled === 0 ? (releasing ? -1 : 1) : this.dB(this.gain / scaled);
        if(releasing){
          this.maxAtt = -1;
          if(!isFinite(diff)) diff = -1;
          let x = Math.max(-12, Math.min(0, diff)); x = 0.25 * (x + 12);
          const x2 = x * x, frames = this.a + this.b * x + this.c * x2 + this.d * x2 * x + this.e * x2 * x2;
          rate = this.lin(5 / frames);
        } else {
          if(!isFinite(diff)) diff = 1;
          if(this.maxAtt === -1 || this.maxAtt < diff) this.maxAtt = diff;
          rate = 1 - Math.pow(0.25 / Math.max(0.5, this.maxAtt), 1 / this.attackF);
        }
        let det = this.det, gain = this.gain, ri = this.ri, wi = this.wi;
        const end = Math.min(n, f + 32);
        for(let i = f; i < end; i++){
          const l = L[i], r = R[i];
          this.bufL[wi] = l; this.bufR[wi] = r;
          const ax = Math.max(Math.abs(l), Math.abs(r));
          const shaped = this.saturate(ax, k), att = ax <= 0.0001 ? 1 : shaped / ax;
          const dbAtt = Math.max(2, -this.dB(att));
          const satRate = this.lin(dbAtt / this.satRelF) - 1;
          det += (att - det) * (att > det ? satRate : 1);
          det = Math.min(1, det); if(!isFinite(det)) det = 1;
          if(rate < 1) gain += (scaled - gain) * rate;
          else { gain *= rate; gain = Math.min(1, gain); }
          const total = post * Math.sin(Math.PI / 2 * gain);
          L[i] = this.bufL[ri] * total; R[i] = this.bufR[ri] * total;
          ri = (ri + 1) & 1023; wi = (wi + 1) & 1023;
        }
        this.ri = ri; this.wi = wi;
        this.det = Math.abs(det) < 1e-30 ? 0 : det; this.gain = Math.abs(gain) < 1e-30 ? 0 : gain;
      }
    }
  }
  // the soft clip of audio.js: linear below −4.5 dBFS (a WaveShaper curve, 4096 points)
  const CURVE = (() => {
    const N = 4096, c = new Float32Array(N), K = 0.6;
    for(let i = 0; i < N; i++){
      const x = i / (N - 1) * 2 - 1, a = Math.abs(x);
      c[i] = Math.sign(x) * (a <= K ? a : K + (1 - K) * Math.tanh((a - K) / (1 - K)));
    }
    return c;
  })();
  function softClip(x){
    const N = CURVE.length, v = (N - 1) / 2 * (x + 1);
    if(v <= 0) return CURVE[0];
    if(v >= N - 1) return CURVE[N - 1];
    const k = v | 0, f = v - k;
    return CURVE[k] + (CURVE[k + 1] - CURVE[k]) * f;
  }

  // ------------------------------------------------------------ the synth
  class Synth {
    // opts: seed, sr, onNote(time, info)
    constructor(p, opts){
      opts = opts || {};
      this.p = Object.assign({}, p);
      this.seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 2 ** 31);
      this.sr = opts.sr || 48000;
      this.rand = mulberry(this.seed);
      this.onNote = opts.onNote || null;
      this.frame = 0; this.blk = 0;
      this.chordIndex = 0; this.pads = []; this.strings = new Map();
      this.sources = []; this.voices = [];
      this.breathPhase = 0;
      const B = () => new Float32Array(BLOCK);
      this.padBus = { L: B(), R: B() }; this.tanBus = { L: B(), R: B() }; this.melBus = { L: B(), R: B() };
      this.busL = B(); this.busR = B(); this.mL = B(); this.mR = B();
      this.roomOut = [[B(), B()], [B(), B()]];
      this.build();
    }
    get now(){ return this.frame / this.sr; }
    get ctx(){ return this; }                 // so the ported code reads ctx.currentTime / ctx.sampleRate
    get currentTime(){ return this.frame / this.sr; }
    get sampleRate(){ return this.sr; }
    mtof(m){ return (this.p.a432 ? 432 : 440) * Math.pow(2, (m - 69) / 12); }
    get base(){ return tonicBase(this.p.pitch); }
    get mood(){ return MOODS[this.p.mode] || MOODS.here; }
    watch(src){ this.sources.push(src); }

    build(){
      const prevRng = RNG; RNG = mulberry(this.seed);       // the rooms and the noise: the same draws as audio.js's export
      const hall = this.impulse(9, 2.6), vast = this.impulse(16, 2.2);
      const len = this.sr * 2;
      this.noise = new Float32Array(len);
      for(let i = 0; i < len; i++) this.noise[i] = rand() * 2 - 1;
      RNG = prevRng;
      this.rooms = new Rooms([hall, vast], this.sr);
      this.comp = new Compressor(this.sr, -18, 30, 3, 0.05, 0.6);

      this.master = new Param(this, 1);
      this.hallWet = new Param(this, 0); this.vastWet = new Param(this, 0); this.dry = new Param(this, 1);
      this.padFilter = new Biquad(this, 'lowpass', 700, 0.4, 2);
      this.padLevel = new Param(this, this.mood.padLevel || 1);
      this.tanFilter = new Biquad(this, 'lowpass', 3400, 1, 2);
      this.melFilter = new Biquad(this, 'lowpass', 350, 0.3, 2);
      this.drone();
      this.applySpace(true);
      this.applyLight(true);
      this.nextChordAt = 0.5; this.nextNoteAt = 7; this.nextBeatAt = 4; this.nextTanpuraAt = 0.3;
      this.nextBellAt = (this.p.bells || 0) * 60;
      this.nextTick = 0;
    }

    impulse(seconds, decay){
      const rate = this.sr, len = Math.floor(rate * seconds), out = [];
      for(let ch = 0; ch < 2; ch++){
        const d = new Float32Array(len);
        let lp = 0;
        for(let i = 0; i < len; i++){
          const x = i / len;
          lp = lp * 0.6 + (rand() * 2 - 1) * 0.4;
          d[i] = lp * Math.pow(1 - x, decay) * (i < rate * 0.02 ? i / (rate * 0.02) : 1);
        }
        out.push(d);
      }
      return out;
    }

    // ------------------------------------------------------------ ground (the drone)
    droneSpec(){
      const b = this.base;
      return DRONES[this.mood.drone].map(([rel, g]) => {
        let m = b + rel; while(m < 24) m += 12;
        return [m, g];
      });
    }
    drone(){
      const g = new Gain(this, 0);
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(0.10, 14);
      this.droneLevel = new Gain(this, this.droneGain());
      const f = new Biquad(this, 'lowpass', 320);
      g.connect(f).connect(this.droneLevel);
      this.droneVoices = this.droneSpec().map(([m, gain], i) => {
        const o = new Osc(this, i === 0 ? 'sine' : 'triangle', this.mtof(m)); o.detune.value = [0, 3, -4, 2][i];
        const og = new Gain(this, gain);
        const lfo = new Osc(this, 'sine', 0.03 + i * 0.011);
        const lg = new Gain(this, 0.15);
        lfo.connect(lg).connect(og.gain);
        o.connect(og).connect(g);
        o.start(0); lfo.start(0);
        return { o, og };
      });
    }
    droneGain(){
      const d = this.p.drone, low = 1 - 0.045 * Math.max(0, 7 - this.p.pitch);
      return (d < 0.01 ? 0 : d <= 0.5 ? 2 * d : 1 + (d - 0.5) * 1.1) * low;
    }
    retuneDrone(tc){
      const now = this.now;
      this.droneSpec().forEach(([m, gain], i) => {
        this.droneVoices[i].o.frequency.setTargetAtTime(this.mtof(m), now, tc);
        this.droneVoices[i].og.gain.setTargetAtTime(gain, now, tc);
      });
    }

    // ------------------------------------------------------------ chords
    pad(chord, when, dur){
      seeded(hash(this.seed, Math.round(when * 1000), 1), () => this._pad(chord, when, dur));
    }
    _pad(chord, when, dur){
      const base = this.base, envs = [], oscs = [];
      const P = PADS[this.mood.pad] || PADS.here;
      chord.forEach((rel, i) => {
        const m = base + rel, fr = this.mtof(m);
        const env = new Gain(this);
        const peak = (i === 0 ? 0.05 : 0.035) * (m > 60 ? 0.7 : 1) * (m > 72 ? 0.7 : 1);
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(peak, when + P.attack + rand() * 2);
        env.gain.setValueAtTime(peak, when + dur - 1);
        env.gain.linearRampToValueAtTime(0, when + dur + 8);
        const pan = new Pan(this, this.padBus, (rand() * 2 - 1) * 0.6);
        env.connect(pan);
        [-P.det, P.det].forEach((det, k) => {
          const o = new Osc(this, P.types[k], fr);
          o.detune.value = det + (rand() - 0.5) * 4;
          const og = new Gain(this, P.gains[k]);
          o.connect(og).connect(env);
          o.start(when); o.stop(when + dur + 9);
          oscs.push(o);
        });
        envs.push(env);
        this.voice(pan, when, oscs.slice(-2));
      });
      this.pads.push({ envs, oscs, end: when + dur + 9 });
    }
    releasePads(seconds){
      const now = this.now;
      this.pads.forEach(p => {
        p.envs.forEach(e => { e.gain.cancelAndHoldAtTime(now); e.gain.linearRampToValueAtTime(0, now + seconds); });
        p.oscs.forEach(o => o.stop(now + seconds + 0.2));
      });
      this.pads = [];
      this.nextChordAt = now + 0.8;
    }
    // a voice: the pan at its end, alive from its first source's start to its last source's stop (+ a short ring)
    voice(pan, when, srcs){ this.voices.push({ pan, srcs, startF: Math.floor(when * this.sr) }); }

    // ------------------------------------------------------------ plucked strings (Karplus–Strong, as in audio.js)
    string(kind, m){
      const key = kind + m + (this.p.a432 ? 'a' : 'b');
      if(this.strings.has(key)) return this.strings.get(key);
      const res = seeded(hashStr(key), () => this._string(kind, m));
      this.strings.set(key, res);
      return res;
    }
    _string(kind, m){
      const sr = this.sr, freq = this.mtof(m);
      const harp = kind === 'harp';
      const s = harp ? 0.5 : 0.1;
      const t60 = harp ? Math.min(7, 5.5 * Math.sqrt(220 / freq)) : 9;
      const dur = harp ? Math.min(6, t60 + 0.5) : 7;
      const N = Math.max(4, Math.floor(sr / freq - s));
      const rho = Math.pow(10, -3 / (t60 * freq));
      const len = Math.floor(sr * dur);
      const out = new Float32Array(len);
      const d = new Float32Array(N);
      let lp = 0;
      const bright = harp ? 0.35 : 0.8;
      for(let i = 0; i < N; i++){ lp += bright * ((rand() * 2 - 1) - lp); d[i] = lp; }
      const P = Math.max(1, Math.round(N * (harp ? 0.18 : 0.08)));
      const e = d.slice();
      let mean = 0;
      for(let i = 0; i < N; i++){ d[i] = e[i] - 0.9 * e[(i + P) % N]; mean += d[i]; }
      mean /= N;
      for(let i = 0; i < N; i++) d[i] -= mean;
      let p = 0, lastOld = 0, peak = 0;
      for(let i = 0; i < len; i++){
        const old = d[p];
        out[i] = old;
        d[p] = rho * ((1 - s) * old + s * lastOld);
        lastOld = old;
        p = p + 1 === N ? 0 : p + 1;
        const a = Math.abs(old); if(a > peak) peak = a;
      }
      const fade = Math.floor(sr * 0.3);
      for(let i = 0; i < len; i++){
        out[i] /= peak || 1;
        if(i > len - fade) out[i] *= (len - i) / fade;
      }
      return { buf: out, rate: freq / (sr / (N + s)) };
    }
    pluck(kind, m, when, gain, panAmt, bus, into){
      const { buf, rate } = this.string(kind, m);
      const src = new BufSrc(this, buf); src.rate = rate;
      const g = new Gain(this, gain);
      src.connect(g);
      src.start(when); src.stop(when + buf.length / this.sr / rate + 0.05);
      if(into){ g.connect(into); return src; }
      const pan = new Pan(this, bus, panAmt);
      g.connect(pan);
      this.voice(pan, when, [src]);
      return src;
    }

    // ------------------------------------------------------------ melody voices (as in audio.js)
    note(voice, m, when, vel, path){
      seeded(hash(this.seed, Math.round(when * 1000), m, 2), () => this._note(voice, m, when, vel, path));
    }
    _note(voice, m, when, vel, path){
      const fr = this.mtof(m), srcs = [];
      const out = new Gain(this);
      const pan = new Pan(this, this.melBus, (rand() * 2 - 1) * 0.7);
      out.connect(pan);
      const osc = (type, f) => { const o = new Osc(this, type, f); srcs.push(o); return o; };
      const env = (a, t0, attack, end) => {
        const g = new Gain(this);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(a, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        return g;
      };
      const noise = () => { const n = new BufSrc(this, this.noise); srcs.push(n); return n; };
      const thump = (freq, q, amp, len, type) => {
        const nz = noise();
        const f = new Biquad(this, type || 'bandpass', freq, q);
        const g = new Gain(this);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(amp, when + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, when + len);
        nz.connect(f).connect(g).connect(out);
        nz.start(when, rand() * 1.5); nz.stop(when + len + 0.02);
      };

      if(voice === 'wood'){
        out.gain.value = 0.085 * vel;
        const warm = new Biquad(this, 'lowpass', 1800 + 900 * vel, 0.4);
        const inner = new Gain(this); inner.connect(warm).connect(out);
        [[1.0, 1.0, 2.6], [3.98, 0.20 * vel, 0.45], [9.85, 0.05 * vel, 0.12]].forEach(([ratio, amp, decay], i) => {
          const o = osc('sine', fr * ratio);
          o.frequency.setValueAtTime(fr * ratio * (i === 0 ? 1.012 : 1), when);
          o.frequency.exponentialRampToValueAtTime(fr * ratio, when + 0.06);
          const g = env(amp, when, 0.004, when + decay);
          o.connect(g).connect(inner);
          o.start(when); o.stop(when + decay + 0.1);
        });
        const nz = noise();
        const bp = new Biquad(this, 'bandpass', Math.min(fr * 2.2, 2500), 1.2);
        const ng = new Gain(this);
        ng.gain.setValueAtTime(0.0001, when);
        ng.gain.linearRampToValueAtTime(0.10 * vel, when + 0.002);
        ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
        nz.connect(bp).connect(ng).connect(inner);
        nz.start(when, rand() * 1.5); nz.stop(when + 0.06);
      }
      else if(voice === 'bowl'){
        out.gain.value = 0.05 * vel;
        [[1, 1, 11], [2.76, 0.42, 7.5], [5.4, 0.2, 4.2], [8.93, 0.08, 2.4]].forEach(([ratio, amp, decay], i) => {
          [-1, 1].forEach(s => {
            const o = osc('sine', fr * ratio + s * (0.35 + i * 0.4));
            const g = env(amp * 0.55, when, 0.006 + i * 0.002, when + decay);
            o.connect(g).connect(out);
            o.start(when); o.stop(when + decay + 0.1);
          });
        });
        thump(Math.min(fr * 1.5, 900), 0.7, 0.25 * vel, 0.05, 'lowpass');
      }
      else if(voice === 'kalimba'){
        out.gain.value = 0.085 * vel;
        [[1, 1, 2.4, 0.003], [2.0, 0.05, 0.9, 0.003], [5.95, 0.16 * vel, 0.22, 0.001]].forEach(([ratio, amp, decay, att]) => {
          const o = osc('sine', fr * ratio);
          const g = env(amp, when, att, when + decay);
          o.connect(g).connect(out);
          o.start(when); o.stop(when + decay + 0.1);
        });
        thump(Math.min(fr * 4, 4000), 2, 0.06 * vel, 0.012);
      }
      else if(voice === 'harp'){
        out.gain.value = 0.11 * vel;
        const warm = new Biquad(this, 'lowpass', 2400 + 1600 * vel);
        warm.connect(out);
        srcs.push(this.pluck('harp', m, when, 1, 0, null, warm));
      }
      else if(voice === 'handpan'){
        out.gain.value = 0.075 * vel;
        [[1, 1, 4.6, 0.008], [2.003, 0.42, 3.0, 0.006], [2.997, 0.16, 1.7, 0.005], [4.01, 0.05, 0.7, 0.004]].forEach(([ratio, amp, decay, att], i) => {
          const o = osc('sine', fr * ratio);
          if(i === 0){ o.frequency.setValueAtTime(fr * 1.004, when); o.frequency.exponentialRampToValueAtTime(fr, when + 0.12); }
          const g = env(amp, when, att, when + decay);
          o.connect(g).connect(out);
          o.start(when); o.stop(when + decay + 0.1);
        });
        thump(Math.min(fr * 1.2, 400), 0.8, 0.35 * vel, 0.06, 'lowpass');
      }
      else if(voice === 'flute'){
        const steps = path || [[0, m]];
        const dur = path ? path[path.length - 1][0] + rnd(1.2, 2) : rnd(1.6, 3.2);
        out.gain.value = 0.038 * vel;
        const amp = new Gain(this);
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(1, when + 0.22);
        amp.gain.linearRampToValueAtTime(0.8, when + dur * 0.6);
        amp.gain.setTargetAtTime(0, when + dur, 0.25);
        amp.connect(out);
        const vib = osc('sine', rnd(4.6, 5.2));
        const vg = new Gain(this);
        vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(0, when + 0.5);
        vg.gain.linearRampToValueAtTime(fr * 0.006, when + 1.2);
        vib.connect(vg);
        [[1, 1], [2, 0.22], [3, 0.06]].forEach(([r, a]) => {
          const o = osc('sine', fr * r);
          steps.forEach(([t, n], k) => {
            if(k) o.frequency.setTargetAtTime(this.mtof(n) * r, when + t, 0.07);
          });
          vg.connect(o.frequency);
          const g = new Gain(this, a);
          o.connect(g).connect(amp);
          o.start(when); o.stop(when + dur + 1.6);
        });
        vib.start(when); vib.stop(when + dur + 1.6);
        const nz = noise(); nz.loop = true;
        const bp = new Biquad(this, 'bandpass', fr * 1.6, 1.4);
        const ng = new Gain(this);
        ng.gain.setValueAtTime(0, when);
        ng.gain.linearRampToValueAtTime(0.16, when + 0.06);
        ng.gain.linearRampToValueAtTime(0.05, when + 0.35);
        ng.gain.setTargetAtTime(0, when + dur, 0.2);
        nz.connect(bp).connect(ng).connect(out);
        nz.start(when, rand()); nz.stop(when + dur + 1.6);
      }
      this.voice(pan, when, srcs);
      if(this.onNote) this.onNote(when, { m, rel: m - this.base, voice, vel });
    }

    // ------------------------------------------------------------ the scheduler (as in audio.js)
    melodyNotes(){
      const M = this.mood, V = VOICES[this.p.voice] || VOICES.wood;
      return melodyFor(M).map(n => {
        let m = this.base + n + M.reg + V.reg;
        while(m < 40) m += 12;
        while(m > 93) m -= 12;
        return m;
      });
    }
    tick(now){
      const prev = RNG; RNG = this.rand;
      try { this._tick(now); } finally { RNG = prev; }
    }
    _tick(now){
      const M = this.mood;
      ['nextChordAt', 'nextNoteAt', 'nextBeatAt', 'nextTanpuraAt'].forEach(k => { if(this[k] < now - 1) this[k] = now + 0.3; });

      const bells = this.p.bells || 0;
      if(bells && now + 0.5 >= this.nextBellAt){
        if(this.nextBellAt < now - 1) this.nextBellAt = now + 0.3;
        this.note('bowl', this.base + 12, this.nextBellAt, 0.9);
        this.nextBellAt += bells * 60;
      }

      if(now + 0.5 >= this.nextChordAt){
        const chords = chordsFor(M);
        const dur = (14 + rand() * 4) * 6 / this.p.breath * M.chordLen;
        if(chords && M.pad){
          this.chordIndex %= chords.length;
          this.pad(chords[this.chordIndex], this.nextChordAt, dur);
          this.chordIndex = (this.chordIndex + (rand() < 0.75 || chords.length < 5 ? 1 : 2)) % chords.length;
        }
        this.pattern = null;
        this.nextChordAt += dur;
        this.pads = this.pads.filter(p => p.end > now);
      }

      if(M.drone === 'tanpura' && now + 0.5 >= this.nextTanpuraAt){
        const cycle = 60 / this.p.breath * 0.46, t = this.nextTanpuraAt, b = this.base;
        const drift = 0.985 + rand() * 0.03;
        [[b + 7, 0], [b + 12, 0.25], [b + 12, 0.5], [b, 0.75]].forEach(([n, f], i) => {
          const m = n < 31 ? n + 12 : n;
          const gain = [0.09, 0.075, 0.075, 0.1][i] * (0.92 + rand() * 0.16);
          this.pluck('tanpura', m, t + f * cycle * drift + rnd(-0.02, 0.02), gain, [-0.25, 0.1, 0.2, -0.05][i], this.tanBus);
        });
        if(rand() < 0.22){
          this.pluck('tanpura', b + 12, t + cycle * drift * 0.62 + rnd(-0.01, 0.01), 0.05 + rand() * 0.03, 0.15, this.tanBus);
        }
        this.nextTanpuraAt += cycle * drift;
      }

      const d = this.p.melody, voice = this.p.voice, V = VOICES[voice] || VOICES.wood;
      const vel = () => 0.75 + rand() * 0.25;

      if(M.motion === 'ostinato'){
        if(now + 0.5 >= this.nextBeatAt){
          const beat = 60 / this.p.breath / 8 * (V.slow ? 2 : 1);
          const notes = this.melodyNotes();
          if(!this.pattern){
            const start = Math.floor(rnd(0, Math.max(1, notes.length - 5)));
            const shape = pick([[0, 2, 1, 3], [0, 1, 2, 4, 2, 1], [2, 0, 3, 1], [0, 2, 4, 2], [0, 3, 1, 2, 4, 1]]);
            this.pattern = shape.map(k => notes[Math.min(notes.length - 1, start + k)]);
            this.beatIndex = 0;
          }
          const k = this.beatIndex++ % this.pattern.length;
          if(d >= 0.02 && rand() < 0.2 + 0.75 * d) this.note(voice, this.pattern[k], this.nextBeatAt + rnd(0, 0.02), k === 0 ? 0.8 : rnd(0.45, 0.62));
          this.nextBeatAt += beat;
        }
        return;
      }

      if(now + 0.5 < this.nextNoteAt) return;
      const t = this.nextNoteAt;
      if(d < 0.02){ this.nextNoteAt = now + 1; return; }

      const notes = this.melodyNotes();
      const step = V.step * (M.motion === 'raga' ? 1.4 : 1);
      const r = rand();
      const fig = 0.2 + 0.25 * Math.max(0, d - 0.5) * 2;

      if(M.motion === 'rise' && r < 0.5){
        const len = 3 + Math.floor(rand() * 3);
        let i = Math.floor(rnd(0, Math.max(1, notes.length - len - 1)));
        for(let k = 0; k < len; k++){ this.note(voice, notes[Math.min(notes.length - 1, i)], t + k * step * 0.75, vel() * (1 - k * 0.08)); i += 1 + (rand() < 0.3 ? 1 : 0); }
      }
      else if(M.motion === 'phrase' && r < 0.6){
        const len = 4 + Math.floor(rand() * 3);
        let i = Math.floor(rnd(1, notes.length - 1)), at = t;
        for(let k = 0; k < len; k++){
          this.note(voice, notes[i], at, vel() * (k === len - 1 ? 0.85 : 1));
          at += step * pick([1, 1, 1.5, 2, 0.75]) * 1.2;
          i = Math.max(0, Math.min(notes.length - 1, i + pick([-1, -1, 1, 1, -2, 2, 0])));
        }
      }
      else if(M.motion === 'echo'){
        const n = pick(notes), gap = 60 / this.p.breath * 0.16;
        this.note(voice, n, t, vel());
        this.note(voice, n, t + gap, 0.42);
        this.note(voice, n, t + gap * 2, 0.2);
      }
      else if(M.motion === 'raga'){
        const len = 3 + Math.floor(rand() * 5);
        let i = Math.floor(rnd(0, Math.max(1, notes.length - 3))), dir = 1;
        const line = [];
        let at = 0;
        for(let k = 0; k < len; k++){
          line.push([at, notes[i]]);
          const hold = pick([0.9, 1.1, 1.4, 1.8, 2.4]);
          at += step * hold + rnd(0, 0.05);
          if(k === Math.floor(len / 2) && rand() < 0.65) dir = -1;
          else if(k > 0 && rand() < 0.2) dir = -dir;
          i = Math.max(0, Math.min(notes.length - 1, i + dir));
          if(rand() < 0.2 && k < len - 1){
            const nb = Math.max(0, Math.min(notes.length - 1, i + (rand() < 0.5 ? -1 : 1)));
            line.push([at, notes[nb]]);
            at += step * 0.55 + rnd(0, 0.03);
          }
        }
        if(voice === 'flute') this.note('flute', line[0][1], t, vel(), line);
        else line.forEach(([a, n]) => this.note(voice, n, t + a, vel()));
      }
      else if(r < fig){
        const i0 = 3 + Math.floor(rand() * Math.max(1, notes.length - 3));
        [0, 1, 2].forEach(k => this.note(voice, notes[Math.max(0, Math.min(notes.length - 1, i0 - k * (1 + (rand() < 0.5 ? 1 : 0))))], t + k * step, vel()));
      } else {
        this.note(voice, pick(notes), t, vel());
        if(r < fig + 0.25) this.note(voice, pick(notes), t + step * rnd(1.2, 3.6), vel());
      }

      let gap = (4 + rand() * 9) * Math.pow(4, (0.5 - d) * 2) / M.density;
      if(V.slow) gap = Math.max(gap * 1.25, 3);
      if(M.motion === 'phrase' || M.motion === 'raga') gap *= 1.3;
      this.nextNoteAt += gap;
    }

    breathFreq(b){
      const L = Math.pow(2, (this.p.light - 0.5) * 3.2) * this.mood.bright;
      return Math.min(this.sr * 0.45, 14000, (450 + 1100 * b * b) * L);
    }

    // ------------------------------------------------------------ parameters (as in audio.js)
    set(k, v){
      const prev = this.p[k];
      this.p[k] = v;
      if(prev === v) return;
      const now = this.now;
      if(k === 'pitch' || k === 'a432'){ this.retuneDrone(1.2); this.droneLevel.gain.setTargetAtTime(this.droneGain(), now, 1); this.releasePads(5); this.pattern = null; }
      else if(k === 'mode'){
        this.retuneDrone(2.5); this.releasePads(5); this.chordIndex = 0; this.pattern = null;
        this.padLevel.setTargetAtTime(this.mood.padLevel || 1, now, 1);
        this.applyLight();
        this.nextNoteAt = Math.min(this.nextNoteAt, now + 3);
      }
      else if(k === 'drone') this.droneLevel.gain.setTargetAtTime(this.droneGain(), now, 0.6);
      else if(k === 'light') this.applyLight();
      else if(k === 'space') this.applySpace();
      else if(k === 'melody' && v >= 0.02 && prev < 0.02) this.nextNoteAt = now + 1.5;
      else if(k === 'bells') this.nextBellAt = now + v * 60;
      else if(k === 'voice'){ this.nextNoteAt = Math.min(this.nextNoteAt, now + 1.2); this.pattern = null; }
    }
    applyLight(instant){
      const f = Math.min(this.sr * 0.45, 16000, 9000 * Math.pow(2, (this.p.light - 0.5) * 5.8) * Math.sqrt(this.mood.bright));
      if(instant) this.melFilter.frequency.value = f;
      else this.melFilter.frequency.setTargetAtTime(f, this.now, 0.4);
    }
    applySpace(instant){
      const s = this.p.space;
      const hall = 0.1 + 1.5 * Math.min(s, 0.5);
      const vast = Math.max(0, s - 0.5) * 2 * 0.75;
      const dry = 1 - Math.max(0, s - 0.5) * 1.2;
      const set = (g, v) => instant ? (g.value = v) : g.setTargetAtTime(v, this.now, 0.8);
      set(this.hallWet, hall); set(this.vastWet, vast); set(this.dry, dry);
      // the long room is costly; only feed it while it can be heard (it keeps ringing out after)
      if(vast > 0){ this.vastOn = true; this.rooms.rooms[1].on = true; this.vastOffAt = Infinity; }
      else if(this.vastOn !== false) this.vastOffAt = this.now + (instant ? 0 : 6) + 16;
    }

    // the end of a sitting: three bowls (the facade fades the output)
    closing(){
      const now = this.now;
      this.nextNoteAt = now + 60; this.nextBeatAt = now + 60;
      [0, 7, 14].forEach((d, i) => this.note('bowl', this.base + 12 + (i === 1 ? 7 : 0), now + 1 + d, 1));
      return now;
    }
    afterClosing(){ this.nextNoteAt = this.now + 6; this.nextBeatAt = this.now + 4; }

    // ------------------------------------------------------------ rendering
    // renders n frames (a multiple of BLOCK) of the music (after the compressor) into L, R
    render(L, R, n, off){
      off = off || 0;
      for(let b = 0; b < n; b += BLOCK){ this.block(); L.set(this.mL, off + b); R.set(this.mR, off + b); }
    }
    block(){
      const sr = this.sr, k0 = this.frame, t1 = (k0 + BLOCK) / sr;
      // the score: ticks every 0.2 s of music, exactly as the export did
      while(this.nextTick < t1){ this.tick(this.nextTick); this.nextTick = Math.round(this.nextTick * 5 + 1) / 5; }
      this.blk++;
      const pb = this.padBus, tb = this.tanBus, mb = this.melBus;
      for(const bus of [pb, tb, mb]){ bus.L.fill(0); bus.R.fill(0); }
      // voices
      const live = [];
      for(const v of this.voices){
        if(v.startF >= k0 + BLOCK){ live.push(v); continue; }
        v.pan.mix();
        let end = 0; for(const s of v.srcs) end = Math.max(end, s.stopF);
        if(end + 0.05 * sr > k0 + BLOCK) live.push(v);
      }
      this.voices = live;
      // filters on the stereo buses
      const bf = this.breathFilter(k0);
      this.padFilter.run(pb.L, pb.L, 0, bf, false); this.padFilter.run(pb.R, pb.R, 1, bf, false);
      const pl = this.padLevel.process(), plc = this.padLevel.isConst;
      const tf = this.tanFilter.frequency.process();
      this.tanFilter.run(tb.L, tb.L, 0, tf, true); this.tanFilter.run(tb.R, tb.R, 1, tf, true);
      const mf = this.melFilter.frequency.process(), mfc = this.melFilter.frequency.isConst;
      this.melFilter.run(mb.L, mb.L, 0, mf, mfc); this.melFilter.run(mb.R, mb.R, 1, mf, mfc);
      const dr = this.droneLevel.pull();
      const bL = this.busL, bR = this.busR;
      for(let i = 0; i < BLOCK; i++){
        const p = plc ? pl[0] : pl[i];
        bL[i] = 0.55 * (pb.L[i] * p + tb.L[i] + mb.L[i] + dr[i]);
        bR[i] = 0.55 * (pb.R[i] * p + tb.R[i] + mb.R[i] + dr[i]);
      }
      // rooms
      if(this.vastOffAt !== undefined && this.now > this.vastOffAt){ this.rooms.rooms[1].on = false; this.vastOn = false; this.vastOffAt = undefined; }
      this.rooms.process(bL, bR, this.roomOut);
      const [hL, hR] = this.roomOut[0], [vL, vR] = this.roomOut[1];
      const hw = this.hallWet.process(), vw = this.vastWet.process(), dw = this.dry.process(), ms = this.master.process();
      const oL = this.mL, oR = this.mR;
      for(let i = 0; i < BLOCK; i++){
        oL[i] = (bL[i] * dw[i] + hL[i] * hw[i] + vL[i] * vw[i]) * ms[i];
        oR[i] = (bR[i] * dw[i] + hR[i] * hw[i] + vR[i] * vw[i]) * ms[i];
      }
      this.comp.process(oL, oR, BLOCK);
      // the sources that have finished
      if(this.blk % 16 === 0) this.sources = this.sources.filter(s => s.stopF > k0);
      this.frame += BLOCK;
    }
    // the breath opens and closes the pads' filter; the phase follows the breath slider
    breathFilter(k0){
      const f = this.bfBuf || (this.bfBuf = new Float32Array(BLOCK));
      const rate = this.p.breath / 60 / this.sr;
      for(let i = 0; i < BLOCK; i += 32){
        const b = 0.5 - 0.5 * Math.cos(this.breathPhase * Math.PI * 2);
        f[i] = this.breathFreq(b);
        this.breathPhase += rate * 32;
      }
      for(let i = 0; i < BLOCK; i++) if(i % 32) f[i] = f[i - (i % 32)];
      this.breathPhase -= Math.floor(this.breathPhase);
      return f;
    }
  }

  G.StillSynth = { Synth, BLOCK, MOODS, VOICES, softClip, mulberry, Param };
}
if(typeof window !== 'undefined') StillSynthModule(window);
