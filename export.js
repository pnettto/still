// STILL — export: render the music faster than real time and save it as an MP3
//
// An hour of audio doesn't fit in memory at once, so it is rendered in chunks. The music is
// seeded, so every chunk re-plays the same score from the beginning (making nothing until a
// little before its own window) and the chunks agree exactly. Each starts early enough for
// chords already sounding to be present, and they meet in a short cross-fade.

(function(){
  const SR = 44100;
  const CHUNK = 240;       // seconds of music per chunk
  const PREROLL = 90;      // seconds rendered before each chunk, so long chords are already sounding
  const XFADE = 3;         // seconds of overlap between chunks
  const FADE_IN = 10, FADE_OUT = 28;
  const KBPS = 192;

  function loadLame(){
    if(window.lamejs) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/lame.min.js';
      s.onload = () => res(); s.onerror = () => rej(new Error('could not load the mp3 encoder'));
      document.head.appendChild(s);
    });
  }
  const idle = () => new Promise(r => setTimeout(r, 0));

  // params: the current settings; minutes: length; onProgress(0..1); isCancelled()
  async function render(params, minutes, onProgress, isCancelled, fixedSeed){
    await loadLame();
    const { Engine, loadNature } = window.Still;
    const p = Object.assign({}, params, { volume: 0.8 });
    const total = minutes * 60;
    const seed = fixedSeed !== undefined ? fixedSeed : Math.floor(Math.random() * 2 ** 31);

    let nature = null, natOffset = 0;
    if(p.nature && p.nature !== 'none'){
      nature = await loadNature(p.nature, new OfflineAudioContext(2, 1, SR));
      natOffset = (seed % 1000) / 1000 * nature.duration;
    }
    // the shape of the whole piece: a soft beginning, a long fade at the end
    const env = g => Math.min(1, g / FADE_IN) * Math.min(1, Math.max(0, (total - g) / FADE_OUT));

    const enc = new window.lamejs.Mp3Encoder(2, SR, KBPS);
    const parts = [];
    const XN = Math.round(XFADE * SR);
    let tail = null;

    for(let C = 0; C < total; C += CHUNK){
      if(isCancelled()) return null;
      const pre = Math.min(PREROLL, C), G0 = C - pre;
      const len = Math.min(CHUNK, total - C), last = C + len >= total;
      const span = pre + len + (last ? 0 : XFADE);
      const ctx = new OfflineAudioContext(2, Math.ceil(span * SR), SR);
      const e = new Engine(p, { seed, G0, cutoff: 0 });
      e.offline = true;
      e.start(ctx, { export: true });

      // the breath, the swell of the pads, as automation
      const f = e.padFilter.frequency, rate = p.breath / 60;
      for(let t = 0; t <= span; t += 0.1){
        const b = 0.5 - 0.5 * Math.cos((G0 + t) * rate * Math.PI * 2);
        if(t === 0) f.setValueAtTime(e.breathFreq(b), 0); else f.linearRampToValueAtTime(e.breathFreq(b), t);
      }
      // the fades (nature has its own path, outside the music's rooms)
      const ng = e.natureGain();
      [[e.master.gain, 1], [e.natBus.gain, ng]].forEach(([gp, k]) => {
        gp.setValueAtTime(k * env(G0), 0);
        for(let t = 0.5; t <= span + 0.5; t += 0.5) gp.linearRampToValueAtTime(k * env(G0 + t), t);
      });
      if(nature){
        const src = new AudioBufferSourceNode(ctx, { buffer: nature, loop: true });
        src.connect(e.natBus);
        src.start(0, (natOffset + G0) % nature.duration);
      }
      // three bowls to close
      [26, 19, 12].forEach((s, i) => {
        const t = total - s - G0;
        if(t >= 0 && t < span) e.note('bowl', e.base + 12 + (i === 1 ? 7 : 0), t, 1);
      });
      // replay the score from the beginning; nothing is made before this chunk's window
      for(let k = 0; ; k++){
        const g = k * 0.2;
        if(g > G0 + span) break;
        e.tick(g - G0);
        if(k % 4000 === 3999) await idle();
      }

      // report progress while rendering (most of the work), then while encoding
      const chunkShare = len / total, base = C / total;
      for(let t = 5; t < span; t += 5){
        ctx.suspend(t).then(() => { onProgress(base + chunkShare * 0.85 * t / span); ctx.resume(); });
      }
      const buf = await ctx.startRendering();
      if(isCancelled()) return null;
      const s0 = Math.round(pre * SR), n = Math.min(Math.round(len * SR), buf.length - s0);
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      const outL = L.subarray(s0, s0 + n), outR = R.subarray(s0, s0 + n);
      if(tail){
        for(let i = 0; i < XN && i < n; i++){
          const t = i / XN;
          outL[i] = tail[0][i] * (1 - t) + outL[i] * t;
          outR[i] = tail[1][i] * (1 - t) + outR[i] * t;
        }
      }
      tail = last ? null : [L.slice(s0 + n, s0 + n + XN), R.slice(s0 + n, s0 + n + XN)];

      // encode, a little at a time, so the page stays responsive
      const BLOCK = 1152 * 40;
      const l16 = new Int16Array(BLOCK), r16 = new Int16Array(BLOCK);
      for(let i = 0; i < n; i += BLOCK){
        const m = Math.min(BLOCK, n - i);
        for(let j = 0; j < m; j++){
          const a = Math.max(-1, Math.min(1, outL[i + j])), b = Math.max(-1, Math.min(1, outR[i + j]));
          l16[j] = a < 0 ? a * 32768 : a * 32767;
          r16[j] = b < 0 ? b * 32768 : b * 32767;
        }
        const mp3 = enc.encodeBuffer(l16.subarray(0, m), r16.subarray(0, m));
        if(mp3.length) parts.push(new Uint8Array(mp3));
        onProgress(base + chunkShare * (0.85 + 0.15 * (i + m) / n));
        await idle();
        if(isCancelled()) return null;
      }
    }
    const end = enc.flush();
    if(end.length) parts.push(new Uint8Array(end));
    return new Blob(parts, { type: 'audio/mpeg' });
  }

  // ------------------------------------------------------------ the new engine: one continuous render in a Worker
  // The synth runs straight through (no chunks, no seams) while this page encodes what it sends.
  function exportWorker(){
    self.onmessage = e => {
      const { p, total, seed, sr, nature, natOffset } = e.data;
      const S = self.StillSynth, s = new S.Synth(p, { seed, sr });
      const env = g => Math.min(1, g / FADE_IN_) * Math.min(1, Math.max(0, (total - g) / FADE_OUT_));
      s.master.setValueAtTime(env(0), 0);
      for(let t = 0.5; t <= total + 0.5; t += 0.5) s.master.linearRampToValueAtTime(env(t), t);
      [26, 19, 12].forEach((sec, i) => { const t = total - sec; if(t >= 0) s.note('bowl', s.base + 12 + (i === 1 ? 7 : 0), t, 1); });
      const ng = 0.12 * Math.pow(p.natureLevel / 0.5, 2), vol = Math.pow(p.volume / 0.8, 2);
      const N = Math.ceil(total * sr), STEP = S.BLOCK * 64;
      let natPos = nature ? Math.round(natOffset * sr) % nature[0].length : 0;
      for(let f = 0; f < N; f += STEP){
        const n = Math.min(STEP, N - f), m = Math.ceil(n / S.BLOCK) * S.BLOCK;
        const L = new Float32Array(m), R = new Float32Array(m);
        s.render(L, R, m);
        for(let i = 0; i < n; i++){
          let l = L[i], r = R[i];
          if(nature){
            const k = env((f + i) / sr) * ng;
            l += nature[0][natPos] * k; r += nature[1][natPos] * k;
            if(++natPos >= nature[0].length) natPos = 0;
          }
          L[i] = S.softClip(l * vol); R[i] = S.softClip(r * vol);
        }
        const l = L.slice(0, n), r = R.slice(0, n);
        self.postMessage({ L: l, R: r, done: f + n >= N, at: (f + n) / N }, [l.buffer, r.buffer]);
      }
    };
  }
  let workerURL;
  async function renderNew(params, minutes, onProgress, isCancelled, fixedSeed){
    await loadLame();
    const p = Object.assign({}, params, { volume: 0.8 });
    const total = minutes * 60;
    const seed = fixedSeed !== undefined ? fixedSeed : Math.floor(Math.random() * 2 ** 31);
    let nature = null, natOffset = 0;
    if(p.nature && p.nature !== 'none'){
      const buf = await window.Still.loadNature(p.nature, new OfflineAudioContext(2, 1, SR));
      nature = [0, 1].map(c => buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)).slice());
      natOffset = (seed % 1000) / 1000 * buf.duration;
    }
    workerURL = workerURL || URL.createObjectURL(new Blob([`(${window.StillSynthModule})(self);\nconst FADE_IN_ = ${FADE_IN}, FADE_OUT_ = ${FADE_OUT};\n(${exportWorker})();`], { type: 'application/javascript' }));
    const w = new Worker(workerURL);
    const enc = new window.lamejs.Mp3Encoder(2, SR, KBPS), parts = [];
    const queue = []; let wake = null, failed = null;
    w.onmessage = e => { queue.push(e.data); if(wake){ wake(); wake = null; } };
    w.onerror = e => { failed = new Error(e.message || 'export failed'); if(wake){ wake(); wake = null; } };
    w.postMessage({ p, total, seed, sr: SR, nature, natOffset });
    const l16 = new Int16Array(1152 * 40), r16 = new Int16Array(1152 * 40);
    try {
      for(;;){
        if(isCancelled()) return null;
        if(failed) throw failed;
        if(!queue.length){ await new Promise(r => { wake = r; }); continue; }
        const { L, R, done, at } = queue.shift();
        for(let i = 0; i < L.length; i += l16.length){
          const m = Math.min(l16.length, L.length - i);
          for(let j = 0; j < m; j++){
            const a = Math.max(-1, Math.min(1, L[i + j])), b = Math.max(-1, Math.min(1, R[i + j]));
            l16[j] = a < 0 ? a * 32768 : a * 32767; r16[j] = b < 0 ? b * 32768 : b * 32767;
          }
          const mp3 = enc.encodeBuffer(l16.subarray(0, m), r16.subarray(0, m));
          if(mp3.length) parts.push(new Uint8Array(mp3));
        }
        onProgress(at);
        await idle();
        if(done) break;
      }
    } finally { w.terminate(); }
    const end = enc.flush();
    if(end.length) parts.push(new Uint8Array(end));
    return new Blob(parts, { type: 'audio/mpeg' });
  }

  const useNew = window.StillSynthModule && window.Worker && !/[?&]legacy\b/.test(location.search);
  window.StillExport = { render: useNew ? renderNew : render, renderLegacy: render, renderNew };
})();
