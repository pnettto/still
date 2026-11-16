// STILL — the sound engine
// Begins exactly where "here" begins (same drone, chords, woody voice, reverb and breath).
// Each mood is a different way of making music, not just a different scale.

(function(){
  // ------------------------------------------------------------ harmony
  // everything is written relative to the tonic's bass note (D2 = 38 in "here")
  const HERE_CHORDS = [
    [0, 12, 19, 23, 26, 28], [-3, 9, 16, 19, 23, 24], [-7, 5, 12, 16, 19, 23],
    [-5, 7, 14, 21, 23, 26], [2, 14, 17, 21, 24, 28], [-7, 5, 12, 19, 21, 24],
  ];
  const ION = [0, 2, 4, 5, 7, 9, 11], LYD = [0, 2, 4, 6, 7, 9, 11], DOR = [0, 2, 3, 5, 7, 9, 10];
  const AEO = [0, 2, 3, 5, 7, 8, 10], MIX = [0, 2, 4, 5, 7, 9, 10], BHAIRAV = [0, 1, 4, 5, 7, 8, 11];

  // pad timbres: [oscillator types, their gains, detune in cents, attack seconds]
  const PADS = {
    here: { types: ['sawtooth', 'triangle'], gains: [0.35, 0.8], det: 6, attack: 6 },
    air:  { types: ['sine', 'triangle'],     gains: [0.9, 0.55], det: 9, attack: 9 },
    warm: { types: ['sawtooth', 'sawtooth'], gains: [0.42, 0.42], det: 9, attack: 7 },
    soft: { types: ['triangle', 'sine'],     gains: [0.75, 0.6], det: 5, attack: 8 },
    dark: { types: ['triangle', 'triangle'], gains: [0.8, 0.6], det: 7, attack: 11 },
  };

  // drone: four voices, [note relative to the bass tonic, gain]
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
    return [b, b + 12, b + 12 + i(4), b + 12 + i(6), b + 12 + i(8), b + 24 + i(2)];   // the voicing of "here"
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

  // pitch 0..11 → bass tonic G1 … F♯2 (7 = D, as in "here")
  const tonicBase = pitch => 31 + pitch;

  const VOICES = {
    wood:    { reg: 0,   step: 0.42 },
    bowl:    { reg: -12, step: 1.6, slow: true },
    kalimba: { reg: 0,   step: 0.36 },
    harp:    { reg: 0,   step: 0.34 },
    handpan: { reg: -12, step: 0.55 },
    flute:   { reg: 0,   step: 0.75 },
  };

  // Seeded randomness. The scheduler draws from the engine's own sequence; every note and
  // chord draws from a sequence seeded by its moment in time. So the same seed always makes
  // the same music, which lets an export be rendered in overlapping chunks that agree exactly.
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

  // decoded nature recordings, shared by every engine (live, and each export chunk)
  // the recordings arrive as scripts (so the app also works from a file); decoded per sample rate
  const SOUNDS = {}, SCRIPTS = {};
  function natureScript(name){
    if(SCRIPTS[name]) return SCRIPTS[name];
    return SCRIPTS[name] = new Promise((resolve, reject) => {
      const have = () => window.STILL_SOUNDS && window.STILL_SOUNDS[name];
      if(have()) return resolve(have());
      const s = document.createElement('script');
      s.src = 'sounds/' + name + '.js';
      s.onload = () => have() ? resolve(have()) : reject(new Error('empty ' + name));
      s.onerror = () => reject(new Error('could not load ' + name));
      document.head.appendChild(s);
    }).catch(e => { delete SCRIPTS[name]; throw e; });
  }
  function decodeNature(name, ctx){
    return natureScript(name).then(uri => {
      const bin = atob(uri.slice(uri.indexOf(',') + 1));
      const bytes = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Promise((res, rej) => ctx.decodeAudioData(bytes.buffer, res, rej));
    }).then(loopable);
  }
  function loadNature(name, ctx){
    const key = name + '@' + ctx.sampleRate;
    if(SOUNDS[key]) return SOUNDS[key];
    return SOUNDS[key] = decodeNature(name, ctx).catch(e => { delete SOUNDS[key]; throw e; });
  }
  // for the synth: 16-bit samples at a given rate, not kept here (the worker holds the only copy)
  function loadNatureData(name, rate){
    return decodeNature(name, new OfflineAudioContext(2, 1, rate)).then(buf => [0, 1].map(c => {
      const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), o = new Int16Array(d.length);
      for(let i = 0; i < d.length; i++){ const x = Math.max(-1, Math.min(1, d[i])); o[i] = x < 0 ? x * 32768 : x * 32767; }
      return o;
    }));
  }
  // fold the last seconds over the first (equal power), so the recording loops without a seam
  function loopable(buf){
    const X = Math.floor(Math.min(4, buf.duration / 6) * buf.sampleRate), L = buf.length - X;
    const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: L, sampleRate: buf.sampleRate });
    for(let ch = 0; ch < buf.numberOfChannels; ch++){
      const a = buf.getChannelData(ch), o = out.getChannelData(ch);
      o.set(a.subarray(0, L));
      for(let i = 0; i < X; i++){
        const t = i / X;
        o[i] = a[i] * Math.sin(t * Math.PI / 2) + a[L + i] * Math.cos(t * Math.PI / 2);
      }
    }
    return out;
  }

  // live playback asks for big buffers: latency doesn't matter for this music, and with the
  // default tiny ones (4 ms on Android) slower phones miss deadlines and play mostly silence
  function liveContext(){
    const AC = window.AudioContext || window.webkitAudioContext;
    try { return new AC({ latencyHint: 'playback' }); } catch(e) { return new AC(); }
  }

  // phones: no bass to carry the music, but nature (broadband hiss) comes through whole, so it
  // sits lower and arrives slowly. Android: the convolution rooms are too heavy, so none at all.
  const UA = navigator.userAgent;
  const ANDROID = /Android/i.test(UA);
  const MOBILE = ANDROID || /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);

  // ------------------------------------------------------------ engine
  class Engine {
    // opts: seed (same seed → same music), G0 (global time at this context's 0, for export chunks),
    //       cutoff (local time before which nothing is actually made: it only advances the score)
    constructor(p, opts){
      opts = opts || {};
      this.p = Object.assign({}, p);
      this.seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 2 ** 31);
      this.rand = mulberry(this.seed);
      this.G0 = opts.G0 || 0;
      this.cutoff = opts.cutoff !== undefined ? opts.cutoff : -Infinity;
      this.ctx = null;
      this.onNote = null;
      this.chordIndex = 0;
      this.pads = [];
      this.paused = false;
      this.strings = new Map();
      this.sounds = {};
    }

    mtof(m){ return (this.p.a432 ? 432 : 440) * Math.pow(2, (m - 69) / 12); }
    get base(){ return tonicBase(this.p.pitch); }
    get mood(){ return MOODS[this.p.mode] || MOODS.here; }

    start(ctx, opts){
      if(this.ctx) return;
      opts = opts || {};
      this.exporting = !!opts.export;
      ctx = this.ctx = ctx || this.preCtx || liveContext();
      if(!this.exporting) this.unlock();
      const now = ctx.currentTime;
      const prevRng = RNG; RNG = mulberry(this.seed);   // the rooms and noise are the same in every chunk

      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.volume = ctx.createGain();
      this.volume.gain.value = this.volumeGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.05; comp.release.value = 0.6;
      // a soft-clip curve: perfectly linear below −4.5 dBFS, so it never colours normal levels
      const limit = ctx.createWaveShaper(), N = 4096, curve = new Float32Array(N), K = 0.6;
      for(let i = 0; i < N; i++){
        const x = i / (N - 1) * 2 - 1, a = Math.abs(x);
        curve[i] = Math.sign(x) * (a <= K ? a : K + (1 - K) * Math.tanh((a - K) / (1 - K)));
      }
      limit.curve = curve;
      this.master.connect(comp).connect(this.volume).connect(limit).connect(ctx.destination);

      // two rooms: the hall of "here", and a much longer one that opens with space
      // the rooms are long and slow to build: live, build them just after the tap, so the
      // context starts cleanly (old phones stall otherwise); export needs them at once, seeded
      this.hall = ctx.createConvolver(); this.vast = ctx.createConvolver();
      const rooms = () => { this.hall.buffer = this.impulse(9, 2.6); this.vast.buffer = this.impulse(16, 2.2); };
      this.noRooms = !this.exporting && ANDROID;
      if(this.exporting) rooms(); else if(!this.noRooms) setTimeout(() => seeded(this.seed, rooms), 300);
      this.hallWet = ctx.createGain(); this.vastWet = ctx.createGain(); this.dry = ctx.createGain();
      this.hall.connect(this.hallWet).connect(this.master);
      this.vast.connect(this.vastWet).connect(this.master);

      this.bus = ctx.createGain(); this.bus.gain.value = 0.55;
      this.bus.connect(this.dry).connect(this.master);
      if(!this.noRooms){ this.bus.connect(this.hall); this.bus.connect(this.vast); this.vastOn = true; }
      else this.vastOn = false;

      this.padFilter = ctx.createBiquadFilter();
      this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 700; this.padFilter.Q.value = 0.4;
      this.padLevel = ctx.createGain(); this.padLevel.gain.value = this.mood.padLevel || 1;
      this.padFilter.connect(this.padLevel).connect(this.bus);

      this.tanpuraBus = ctx.createBiquadFilter();
      this.tanpuraBus.type = 'lowpass'; this.tanpuraBus.frequency.value = 1600;
      this.tanpuraBus.connect(this.bus);

      this.melFilter = ctx.createBiquadFilter();
      this.melFilter.type = 'lowpass'; this.melFilter.Q.value = 0.3;
      this.melFilter.connect(this.bus);

      // nature: its highs (hiss, splashes) lowered, a little of it in the music's hall, and into the
      // same compressor as the music, so the two are glued together. low + shelf · (all − low)
      this.natBus = ctx.createGain(); this.natBus.gain.value = this.natureGain();
      const natLow = ctx.createBiquadFilter(); natLow.type = 'lowpass'; natLow.frequency.value = 2000; natLow.Q.value = -3.0103;
      this.natHigh = ctx.createGain(); this.natNeg = ctx.createGain();
      const natOut = ctx.createGain();
      this.natBus.connect(natLow).connect(natOut);
      this.natBus.connect(this.natHigh).connect(natOut);
      natLow.connect(this.natNeg).connect(natOut);
      natOut.connect(comp);
      if(!this.noRooms){ const send = ctx.createGain(); send.gain.value = 0.35; natOut.connect(send); send.connect(this.hall); send.connect(this.vast); }

      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for(let i = 0; i < len; i++) nd[i] = rand() * 2 - 1;

      RNG = prevRng;

      this.drone();
      this.applySpace(true);
      this.applyLight(true);

      // the score begins at global time 0; t0 is that moment in this context's own time
      const t0 = this.exporting ? -this.G0 : now;
      this.nextChordAt = t0 + 0.5;
      this.nextNoteAt = t0 + 7;
      this.nextBeatAt = t0 + 4;
      this.nextTanpuraAt = t0 + 0.3;
      this.nextBellAt = t0 + (this.p.bells || 0) * 60;
      if(this.exporting){ this.master.gain.value = 1; return; }   // the exporter shapes the fades itself

      if(this.p.nature !== 'none') this.setNature(this.p.nature);
      this.master.gain.setValueAtTime(0, now);
      this.master.gain.linearRampToValueAtTime(1.0, now + 10);
      if(!this.offline) this.timer = setInterval(() => this.tick(), 200);
      if(!this.offline) this.watch = setInterval(() => this.watchdog(), 1000);
    }

    impulse(seconds, decay){
      const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, len, rate);
      for(let ch = 0; ch < 2; ch++){
        const d = buf.getChannelData(ch);
        let lp = 0;
        for(let i = 0; i < len; i++){
          const x = i / len;
          lp = lp * 0.6 + (rand() * 2 - 1) * 0.4;
          d[i] = lp * Math.pow(1 - x, decay) * (i < rate * 0.02 ? i / (rate * 0.02) : 1);
        }
      }
      return buf;
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
      const ctx = this.ctx;
      const g = ctx.createGain();
      if(this.exporting && this.G0 > 0) g.gain.value = 0.10;
      else {
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 14);
      }
      this.droneLevel = ctx.createGain();
      this.droneLevel.gain.value = this.droneGain();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      g.connect(f).connect(this.droneLevel).connect(this.bus);
      // the overtones of the lowest voice, between about 200 and 700 Hz: phone speakers can't play the
      // drone's fundamental, but the ear hears it in its overtones (as in synth.js)
      const [m0, g0] = this.droneSpec()[0];
      const fade = ctx.createGain();
      if(this.exporting && this.G0 > 0) fade.gain.value = 0.10;
      else { fade.gain.setValueAtTime(0, ctx.currentTime); fade.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 14); }
      this.ovOsc = ctx.createOscillator(); this.ovOsc.type = 'sawtooth'; this.ovOsc.frequency.value = this.mtof(m0);
      this.ovGain = ctx.createGain(); this.ovGain.gain.value = 0.8 * g0;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0;
      this.ovOsc.connect(this.ovGain).connect(fade).connect(bp).connect(lp).connect(this.droneLevel);
      this.ovOsc.start(0);
      this.droneVoices = this.droneSpec().map(([m, gain], i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = this.mtof(m); o.detune.value = [0, 3, -4, 2][i];
        const og = ctx.createGain(); og.gain.value = gain;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + i * 0.011;
        const lg = ctx.createGain(); lg.gain.value = 0.15;
        lfo.connect(lg).connect(og.gain);
        o.connect(og).connect(g);
        // when exporting in chunks, start each oscillator in phase with the whole piece
        const at = f => this.exporting ? Math.ceil(this.G0 * f - 1e-9) / f - this.G0 : 0;
        o.start(at(o.frequency.value * Math.pow(2, o.detune.value / 1200))); lfo.start(at(lfo.frequency.value));
        return { o, og };
      });
    }
    droneGain(){
      const d = this.p.drone, low = 1 - 0.045 * Math.max(0, 7 - this.p.pitch);   // very low drones fill a room; ease them
      return (d < 0.01 ? 0 : d <= 0.5 ? 2 * d : 1 + (d - 0.5) * 1.1) * low;
    }
    retuneDrone(tc){
      const now = this.ctx.currentTime;
      this.droneSpec().forEach(([m, gain], i) => {
        this.droneVoices[i].o.frequency.setTargetAtTime(this.mtof(m), now, tc);
        this.droneVoices[i].og.gain.setTargetAtTime(gain, now, tc);
        if(i === 0){ this.ovOsc.frequency.setTargetAtTime(this.mtof(m), now, tc); this.ovGain.gain.setTargetAtTime(0.8 * gain, now, tc); }
      });
    }

    // ------------------------------------------------------------ chords
    pad(chord, when, dur){
      if(when < this.cutoff) return;
      seeded(hash(this.seed, Math.round((when + this.G0) * 1000), 1), () => this._pad(chord, when, dur));
    }
    _pad(chord, when, dur){
      const ctx = this.ctx, base = this.base, envs = [], oscs = [];
      const P = PADS[this.mood.pad] || PADS.here;
      chord.forEach((rel, i) => {
        const m = base + rel, fr = this.mtof(m);
        const env = ctx.createGain();
        const peak = (i === 0 ? 0.05 : 0.035) * (m > 60 ? 0.7 : 1) * (m > 72 ? 0.7 : 1);
        env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(peak, when + P.attack + rand() * 2);
        env.gain.setValueAtTime(peak, when + dur - 1);
        env.gain.linearRampToValueAtTime(0, when + dur + 8);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (rand() * 2 - 1) * 0.6;
        env.connect(pan).connect(this.padFilter);
        [-P.det, P.det].forEach((det, k) => {
          const o = ctx.createOscillator();
          o.type = P.types[k];
          o.frequency.value = fr;
          o.detune.value = det + (rand() - 0.5) * 4;
          const og = ctx.createGain(); og.gain.value = P.gains[k];
          o.connect(og).connect(env);
          o.start(when); o.stop(when + dur + 9);
          oscs.push(o);
        });
        envs.push(env);
      });
      this.pads.push({ envs, oscs, end: when + dur + 9 });
    }

    // let what is sounding melt away, so a new mood or pitch arrives without clashing
    releasePads(seconds){
      const now = this.ctx.currentTime;
      this.pads.forEach(p => {
        p.envs.forEach(e => {
          const g = e.gain;
          if(g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
          else { const v = g.value; g.cancelScheduledValues(now); g.setValueAtTime(v, now); }
          g.linearRampToValueAtTime(0, now + seconds);
        });
        p.oscs.forEach(o => { try { o.stop(now + seconds + 0.2); } catch(e) {} });
      });
      this.pads = [];
      this.nextChordAt = now + 0.8;
    }

    // ------------------------------------------------------------ plucked strings
    // Karplus–Strong, rendered once per pitch: a real vibrating-string model, so the
    // harp and the tanpura decay the way strings do.
    string(kind, m){
      const key = kind + m + (this.p.a432 ? 'a' : 'b');
      if(this.strings.has(key)) return this.strings.get(key);
      const res = seeded(hashStr(key), () => this._string(kind, m));
      this.strings.set(key, res);
      return res;
    }
    _string(kind, m){
      const ctx = this.ctx, sr = ctx.sampleRate, freq = this.mtof(m);
      const harp = kind === 'harp';
      const s = harp ? 0.5 : 0.22;                        // tanpura: its jawari buzz rings, then mellows
      const t60 = harp ? Math.min(7, 5.5 * Math.sqrt(220 / freq)) : 9;
      const dur = harp ? Math.min(6, t60 + 0.5) : 7;
      const N = Math.max(4, Math.floor(sr / freq - s));
      const rho = Math.pow(10, -3 / (t60 * freq));
      const len = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
      const d = new Float32Array(N);
      let lp = 0;
      const bright = harp ? 0.15 : 0.3;                  // harp: the soft pad of a finger, few highs in the pluck
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
      const fade = Math.floor(sr * 0.3), rise = Math.floor(sr * (harp ? 0.012 : 0.005));
      for(let i = 0; i < len; i++){
        out[i] /= peak || 1;
        if(i < rise) out[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / rise);   // no click as the finger leaves the string
        if(i > len - fade) out[i] *= (len - i) / fade;
      }
      return { buf, rate: freq / (sr / (N + s)) };
    }
    pluck(kind, m, when, gain, panAmt, dest){
      if(when < this.cutoff) return;
      const ctx = this.ctx, { buf, rate } = this.string(kind, m);
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = gain;
      const pan = ctx.createStereoPanner(); pan.pan.value = panAmt;
      src.connect(g).connect(pan).connect(dest);
      src.start(when);
    }

    // ------------------------------------------------------------ melody voices
    note(voice, m, when, vel, path){
      if(when < this.cutoff) return;
      seeded(hash(this.seed, Math.round((when + this.G0) * 1000), m, 2), () => this._note(voice, m, when, vel, path));
    }
    _note(voice, m, when, vel, path){
      const ctx = this.ctx, fr = this.mtof(m);
      const out = ctx.createGain();
      const pan = ctx.createStereoPanner(); pan.pan.value = (rand() * 2 - 1) * 0.7;
      out.connect(pan).connect(this.melFilter);
      const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
      const env = (a, t0, attack, end) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(a, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        return g;
      };
      const thump = (freq, q, amp, len, type) => {
        const nz = ctx.createBufferSource(); nz.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(amp, when + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, when + len);
        nz.connect(f).connect(g).connect(out);
        nz.start(when, rand() * 1.5); nz.stop(when + len + 0.02);
      };

      if(voice === 'wood'){
        // a soft mallet on a wooden bar (the voice of "here"): partials 1 : 4 : 10
        out.gain.value = 0.085 * vel;
        const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 1800 + 900 * vel; warm.Q.value = 0.4;
        const inner = ctx.createGain(); inner.connect(warm).connect(out);
        [[1.0, 1.0, 2.6], [3.98, 0.20 * vel, 0.45], [9.85, 0.05 * vel, 0.12]].forEach(([ratio, amp, decay], i) => {
          const o = osc('sine', fr * ratio);
          o.frequency.setValueAtTime(fr * ratio * (i === 0 ? 1.012 : 1), when);
          o.frequency.exponentialRampToValueAtTime(fr * ratio, when + 0.06);
          const g = env(amp, when, 0.004, when + decay);
          o.connect(g).connect(inner);
          o.start(when); o.stop(when + decay + 0.1);
        });
        const nz = ctx.createBufferSource(); nz.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(fr * 2.2, 2500); bp.Q.value = 1.2;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, when);
        ng.gain.linearRampToValueAtTime(0.10 * vel, when + 0.002);
        ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
        nz.connect(bp).connect(ng).connect(inner);
        nz.start(when, rand() * 1.5); nz.stop(when + 0.06);
      }

      else if(voice === 'bowl'){
        // a struck singing bowl: inharmonic partials, each a slowly beating pair
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
        // a thumb piano tine: a round fundamental, a bright brief overtone, a tiny click
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
        // a plucked gut string (physically modelled), softened a little by the hand
        out.gain.value = 0.092 * vel;
        const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 1300 + 600 * vel; warm.Q.value = 0;
        warm.connect(out);
        this.pluck('harp', m, when, 1, 0, warm);
      }

      else if(voice === 'handpan'){
        // a steel handpan: fundamental, octave and compound fifth, touched with the fingertips
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
        // a breathy bamboo flute; given a path, it glides between notes (meend)
        const steps = path || [[0, m]];
        const dur = path ? path[path.length - 1][0] + rnd(1.2, 2) : rnd(1.6, 3.2);
        out.gain.value = 0.038 * vel;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(1, when + 0.22);
        amp.gain.linearRampToValueAtTime(0.8, when + dur * 0.6);
        amp.gain.setTargetAtTime(0, when + dur, 0.25);
        amp.connect(out);
        const vib = osc('sine', rnd(4.6, 5.2));
        const vg = ctx.createGain();
        vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(0, when + 0.5);
        vg.gain.linearRampToValueAtTime(fr * 0.006, when + 1.2);
        vib.connect(vg);
        [[1, 1], [2, 0.22], [3, 0.06]].forEach(([r, a]) => {
          const o = osc('sine', fr * r);
          steps.forEach(([t, n], k) => {
            if(k) o.frequency.setTargetAtTime(this.mtof(n) * r, when + t, 0.07);
          });
          vg.connect(o.frequency);
          const g = ctx.createGain(); g.gain.value = a;
          o.connect(g).connect(amp);
          o.start(when); o.stop(when + dur + 1.6);
        });
        vib.start(when); vib.stop(when + dur + 1.6);
        const nz = ctx.createBufferSource(); nz.buffer = this.noiseBuf; nz.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr * 1.6; bp.Q.value = 1.4;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0, when);
        ng.gain.linearRampToValueAtTime(0.16, when + 0.06);
        ng.gain.linearRampToValueAtTime(0.05, when + 0.35);
        ng.gain.setTargetAtTime(0, when + dur, 0.2);
        nz.connect(bp).connect(ng).connect(out);
        nz.start(when, rand()); nz.stop(when + dur + 1.6);
      }

      if(this.onNote){
        const info = { m, rel: m - this.base, voice, vel };
        const delay = Math.max(0, (when - this.ctx.currentTime) * 1000);
        setTimeout(() => this.onNote && this.onNote(info), delay);
      }
    }

    // ------------------------------------------------------------ the scheduler
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
      if(!this.ctx) return;
      if(now === undefined) now = this.ctx.currentTime;
      const prev = RNG; RNG = this.rand;
      try { this._tick(now); } finally { RNG = prev; }
    }
    _tick(now){
      const ctx = this.ctx;
      const M = this.mood;
      ['nextChordAt', 'nextNoteAt', 'nextBeatAt', 'nextTanpuraAt'].forEach(k => { if(this[k] < now - 1) this[k] = now + 0.3; });

      // interval bells: one soft bowl every few minutes of music, for coming back to the breath
      const bells = this.p.bells || 0;
      if(bells && now + 0.5 >= this.nextBellAt){
        if(this.nextBellAt < now - 1) this.nextBellAt = now + 0.3;
        this.note('bowl', this.base + 12, this.nextBellAt, 0.9);
        this.nextBellAt += bells * 60;
      }

      // chords
      if(now + 0.5 >= this.nextChordAt){
        const chords = chordsFor(M);
        const dur = (14 + rand() * 4) * 6 / this.p.breath * M.chordLen;
        if(chords && M.pad){
          this.chordIndex %= chords.length;
          this.pad(chords[this.chordIndex], this.nextChordAt, dur);
          this.chordIndex = (this.chordIndex + (rand() < 0.75 || chords.length < 5 ? 1 : 2)) % chords.length;
        }
        this.pattern = null;      // the ostinato finds a new shape with each chord
        this.nextChordAt += dur;
        this.pads = this.pads.filter(p => p.end > now);
      }

      // tanpura: Pa, Sa, Sa, low Sa, round and round, at the pace of the breath.
      // The plucks are humanized — tiny timing and loudness drift — so the drone feels
      // like a hand, not a metronome, and now and then it lingers or adds a note.
      if(M.drone === 'tanpura' && now + 0.5 >= this.nextTanpuraAt){
        const cycle = 60 / this.p.breath * 0.46, t = this.nextTanpuraAt, b = this.base;
        const drift = 0.985 + rand() * 0.03;                       // the breath itself wanders
        [[b + 7, 0], [b + 12, 0.25], [b + 12, 0.5], [b, 0.75]].forEach(([n, f], i) => {
          const m = n < 31 ? n + 12 : n;
          const gain = [0.09, 0.075, 0.075, 0.1][i] * (0.92 + rand() * 0.16) * 0.87;   // 0.87: the mellower strings at the old level
          this.pluck('tanpura', m, t + f * cycle * drift + rnd(-0.02, 0.02), gain, [-0.25, 0.1, 0.2, -0.05][i], this.tanpuraBus);
        });
        // an occasional extra Sa, as if the hand lingers on the string
        if(rand() < 0.22){
          this.pluck('tanpura', b + 12, t + cycle * drift * 0.62 + rnd(-0.01, 0.01), (0.05 + rand() * 0.03) * 0.87, 0.15, this.tanpuraBus);
        }
        this.nextTanpuraAt += cycle * drift;
      }

      const d = this.p.melody, voice = this.p.voice, V = VOICES[voice] || VOICES.wood;
      const vel = () => 0.75 + rand() * 0.25;

      // earth: a gentle repeating figure, at eight beats per breath
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
        return this.natureTick(now);
      }

      if(now + 0.5 < this.nextNoteAt) return this.natureTick(now);
      const t = this.nextNoteAt;
      if(d < 0.02){ this.nextNoteAt = now + 1; return this.natureTick(now); }

      const notes = this.melodyNotes();
      const step = V.step * (M.motion === 'raga' ? 1.4 : 1);
      const r = rand();
      const fig = 0.2 + 0.25 * Math.max(0, d - 0.5) * 2;

      if(M.motion === 'rise' && r < 0.5){
        // dawn: light arpeggios climbing upward
        const len = 3 + Math.floor(rand() * 3);
        let i = Math.floor(rnd(0, Math.max(1, notes.length - len - 1)));
        for(let k = 0; k < len; k++){ this.note(voice, notes[Math.min(notes.length - 1, i)], t + k * step * 0.75, vel() * (1 - k * 0.08)); i += 1 + (rand() < 0.3 ? 1 : 0); }
      }
      else if(M.motion === 'phrase' && r < 0.6){
        // soulful: a sung phrase, stepwise, with breath in its rhythm
        const len = 4 + Math.floor(rand() * 3);
        let i = Math.floor(rnd(1, notes.length - 1)), at = t;
        for(let k = 0; k < len; k++){
          this.note(voice, notes[i], at, vel() * (k === len - 1 ? 0.85 : 1));
          at += step * pick([1, 1, 1.5, 2, 0.75]) * 1.2;
          i = Math.max(0, Math.min(notes.length - 1, i + pick([-1, -1, 1, 1, -2, 2, 0])));
        }
      }
      else if(M.motion === 'echo'){
        // tender: single notes, answered by their own fading echoes
        const n = pick(notes), gap = 60 / this.p.breath * 0.16;
        this.note(voice, n, t, vel());
        this.note(voice, n, t + gap, 0.42);
        this.note(voice, n, t + gap * 2, 0.2);
      }
      else if(M.motion === 'raga'){
        // raga: an alaap-like line that rises, lingers, turns and settles — uneven note
        // lengths and small ornaments so it breathes instead of repeating
        const len = 3 + Math.floor(rand() * 5);
        let i = Math.floor(rnd(0, Math.max(1, notes.length - 3))), dir = 1;
        const line = [];
        let at = 0;
        for(let k = 0; k < len; k++){
          line.push([at, notes[i]]);
          // the phrase lingers unevenly on each note, then moves on
          const hold = pick([0.9, 1.1, 1.4, 1.8, 2.4]);
          at += step * hold + rnd(0, 0.05);
          if(k === Math.floor(len / 2) && rand() < 0.65) dir = -1;
          else if(k > 0 && rand() < 0.2) dir = -dir;          // a small turn
          i = Math.max(0, Math.min(notes.length - 1, i + dir));
          // a brief ornament: the voice dips to a neighbour and back
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
        // here: a small falling figure
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
      this.natureTick(now);
    }
    natureTick(){}

    // called every frame with the shared breath, 0..1
    breathe(b){
      if(!this.ctx) return;
      this.padFilter.frequency.setTargetAtTime(this.breathFreq(b), this.ctx.currentTime, 0.3);
    }
    breathFreq(b){
      const L = Math.pow(2, (this.p.light - 0.5) * 3.2) * this.mood.bright;
      return Math.min(this.ctx.sampleRate * 0.45, 14000, (450 + 1100 * b * b) * L);
    }

    // ------------------------------------------------------------ parameters
    set(k, v){
      const prev = this.p[k];
      this.p[k] = v;
      if(!this.ctx || prev === v) return;
      const now = this.ctx.currentTime;
      if(k === 'pitch' || k === 'a432'){ this.retuneDrone(1.2); this.droneLevel.gain.setTargetAtTime(this.droneGain(), now, 1); this.releasePads(5); this.pattern = null; }
      else if(k === 'mode'){
        this.retuneDrone(2.5); this.releasePads(5); this.chordIndex = 0; this.pattern = null;
        this.padLevel.gain.setTargetAtTime(this.mood.padLevel || 1, now, 1);
        this.applyLight();
        this.nextNoteAt = Math.min(this.nextNoteAt, now + 3);
      }
      else if(k === 'drone') this.droneLevel.gain.setTargetAtTime(this.droneGain(), now, 0.6);
      else if(k === 'light') this.applyLight();
      else if(k === 'space') this.applySpace();
      else if(k === 'nature') this.setNature(v);
      else if(k === 'natureLevel') this.natBus.gain.setTargetAtTime(this.natureGain(), now, 0.4);
      else if(k === 'volume') this.volume.gain.setTargetAtTime(this.volumeGain(), now, 0.15);
      else if(k === 'melody' && v >= 0.02 && prev < 0.02) this.nextNoteAt = now + 1.5;
      else if(k === 'bells') this.nextBellAt = now + v * 60;
      else if(k === 'voice'){ this.nextNoteAt = Math.min(this.nextNoteAt, now + 1.2); this.pattern = null; }
    }

    volumeGain(){ return Math.pow(this.p.volume / 0.8, 2); }
    natureGain(){ return 0.12 * Math.pow(this.p.natureLevel / 0.5, 2) * (MOBILE && !this.exporting ? 0.35 : 1); }   // default: 60% of the previous level; up to 4× closer

    applyLight(instant){
      const f = Math.min(this.ctx.sampleRate * 0.45, 16000, 9000 * Math.pow(2, (this.p.light - 0.5) * 5.8) * Math.sqrt(this.mood.bright));
      if(instant) this.melFilter.frequency.value = f;
      else this.melFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
      // nature's highs: 6 dB lower at the middle of light, 10 dB at dusk, 2 dB when radiant
      const shelf = Math.pow(10, (-6 + 8 * (this.p.light - 0.5)) / 20);
      [[this.natHigh, shelf], [this.natNeg, -shelf]].forEach(([g, v]) => instant ? (g.gain.value = v) : g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4));
    }

    applySpace(instant){
      const s = this.p.space;
      const hall = 0.1 + 1.5 * Math.min(s, 0.5);
      const vast = Math.max(0, s - 0.5) * 2 * 0.75;
      const dry = this.noRooms ? 1 : 1 - Math.max(0, s - 0.5) * 1.2;   // no rooms: nothing to trade the dry for
      const set = (g, v) => instant ? (g.gain.value = v) : g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8);
      set(this.hallWet, hall); set(this.vastWet, vast); set(this.dry, dry);
      // the long room is costly; only feed it while it can be heard
      clearTimeout(this.vastT);
      if(vast > 0 && !this.vastOn && !this.noRooms){ this.bus.connect(this.vast); this.vastOn = true; }
      else if(vast === 0 && this.vastOn){
        const off = () => { this.bus.disconnect(this.vast); this.vastOn = false; };
        if(instant) off(); else this.vastT = setTimeout(off, 6000);
      }
    }

    // ------------------------------------------------------------ nature: real field recordings
    loadSound(name){ return loadNature(name, this.ctx); }
    setNature(kind){
      const ctx = this.ctx, now = ctx.currentTime;
      if(this.nat){
        const old = this.nat;
        old.g.gain.cancelScheduledValues(now);
        old.g.gain.setValueAtTime(old.g.gain.value, now);
        old.g.gain.linearRampToValueAtTime(0, now + 4);
        setTimeout(() => { try { old.src && old.src.stop(); } catch(e) {} old.g.disconnect(); }, 4500);
        this.nat = null;
      }
      if(!kind || kind === 'none') return;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.natBus);
      const nat = this.nat = { kind, g, src: null };
      this.loadSound(kind).then(buf => {
        if(this.nat !== nat) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        src.connect(g);
        const t = ctx.currentTime;
        src.start(t, rand() * buf.duration * 0.8);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + (MOBILE ? 20 : 5));
        nat.src = src;
      }).catch(e => console.warn(e));
    }

    // if the device can't render in real time (audio time falls behind the clock), it plays
    // mostly silence: drop the long room, then shorten the hall, then drop it too
    watchdog(){
      const c = this.ctx, w = performance.now() / 1000, t = c.currentTime, last = this.wd;
      this.wd = c.state === 'running' && !this.paused ? { t, w } : null;
      if(!last || !this.wd) return;
      const speed = (t - last.t) / (w - last.w);
      this.lag = speed < 0.95 ? (this.lag || 0) + 1 : 0;
      if(this.lag < 2 || (this.lighter || 0) >= 3 || this.noRooms) return;
      this.lag = 0; this.lighter = (this.lighter || 0) + 1;
      // costs measured offline: both rooms 26%, hall 4 s 7%, hall 2.5 s 5%, no rooms 2%
      if(this.lighter === 1){ this.vast.buffer = null; this.hall.buffer = seeded(this.seed, () => this.impulse(4, 2.6)); }
      else if(this.lighter === 2) this.hall.buffer = seeded(this.seed, () => this.impulse(2.5, 2.6));
      else this.hall.buffer = null;
      console.warn('still: audio falling behind (speed ' + speed.toFixed(2) + '), lighter rooms: step ' + this.lighter);
    }

    // ------------------------------------------------------------ transport
    // Mobile browsers only let audio start inside a tap. Call this from every gesture: it makes
    // (or wakes) the context there, plays one silent sample (the old iOS unlock), and asks iOS
    // to treat this as media playback so the silent switch doesn't mute it.
    unlock(){
      try { if(navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
      // only make the context inside a real activation (on Android a touch's pointerdown isn't one)
      const active = !navigator.userActivation || navigator.userActivation.isActive;
      if(!this.ctx && !this.preCtx && !active) return false;
      const ctx = this.ctx || (this.preCtx = this.preCtx || liveContext());
      if(this.paused || ctx.state === 'running') return false;
      ctx.resume().catch(() => {});
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination); src.start(0);
      } catch(e) {}
      return true;
    }
    pause(){
      if(!this.ctx || this.paused) return;
      this.paused = true;
      const now = this.ctx.currentTime, g = this.master.gain, n = this.natBus.gain;
      [g, n].forEach(p => { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(0, now + 2.5); });
      clearTimeout(this.suspendT);
      this.suspendT = setTimeout(() => { if(this.paused) this.ctx.suspend(); }, 2700);
    }
    resume(){
      if(!this.ctx) return;
      clearTimeout(this.suspendT);
      this.paused = false;
      this.ctx.resume().then(() => {
        const now = this.ctx.currentTime;
        [[this.master.gain, 1], [this.natBus.gain, this.natureGain()]].forEach(([p, v]) => {
          p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(v, now + 3);
        });
      });
    }

    // the end of a sitting: three bowls, then everything fades into silence
    closing(onDone){
      if(!this.ctx) return;
      const now = this.ctx.currentTime;
      this.nextNoteAt = now + 60; this.nextBeatAt = now + 60;
      [0, 7, 14].forEach((d, i) => this.note('bowl', this.base + 12 + (i === 1 ? 7 : 0), now + 1 + d, 1));
      [this.master.gain, this.natBus.gain].forEach(g => {
        g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
        g.setValueAtTime(g.value, now + 15);
        g.linearRampToValueAtTime(0, now + 34);
      });
      setTimeout(() => {
        this.paused = true; this.ctx.suspend();
        this.nextNoteAt = this.ctx.currentTime + 6; this.nextBeatAt = this.ctx.currentTime + 4;
        onDone && onDone();
      }, 35000);
    }
  }

  window.Still = { Engine, MOODS, VOICES, loadNature, loadNatureData };
})();
