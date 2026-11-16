// STILL — live playback: the synth runs in a Worker, a little ahead of time, and streams into a tiny
// AudioWorklet that only copies samples. A slow phone then just drains the buffer a little instead
// of glitching. Volume, nature and pauses stay native (after the player), so they answer at once.

(function(){
  if(!window.StillSynthModule && typeof StillSynthModule === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC || !window.AudioWorkletNode || !window.Worker) return;     // the old Web Audio engine plays instead

  const UA = navigator.userAgent;
  const MOBILE = /Android|iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  const CHUNK = 2048;

  function workerMain(){
    let synth, port, depth, maxDepth, inFlight = 0, lastUnderrun = 0;
    const send = chunk => {
      const L = chunk ? chunk.L : new Float32Array(CHUNK_), R = chunk ? chunk.R : new Float32Array(CHUNK_);
      const f = synth.frame, phase = synth.breathPhase, breath = synth.p.breath;
      const t0 = performance.now();
      synth.render(L, R, CHUNK_);
      load = load * 0.95 + 0.05 * (performance.now() - t0) / (CHUNK_ / synth.sr * 1000);
      inFlight++;
      port.postMessage({ L, R, f, phase, breath, load }, [L.buffer, R.buffer]);
    };
    let load = 0;
    self.onmessage = e => {
      const m = e.data;
      if(m.type === 'init'){
        depth = m.depth; maxDepth = m.maxDepth;
        synth = new self.StillSynth.Synth(m.p, { seed: m.seed, sr: m.sr, onNote: (t, info) => self.postMessage({ type: 'note', t, info }) });
        port = m.port;
        port.onmessage = ev => {
          const d = ev.data;
          if(d.chunk){ inFlight--; if(inFlight < depth) send(d.chunk); }
          else if(d.underrun){
            // the device fell behind: keep more music ready from now on
            const now = performance.now();
            if(now - lastUnderrun > 1000 && depth < maxDepth){ depth = Math.min(maxDepth, depth + 4); self.postMessage({ type: 'depth', depth }); }
            lastUnderrun = now;
          }
          while(inFlight < depth) send(null);
        };
        while(inFlight < depth) send(null);
      }
      else if(m.type === 'set') synth.set(m.k, m.v);
      else if(m.type === 'closing') self.postMessage({ type: 'closing', t: synth.closing() });
      else if(m.type === 'afterClosing') synth.afterClosing();
    };
  }

  function playerMain(){
    class Player extends AudioWorkletProcessor {
      constructor(){
        super();
        this.q = []; this.cur = null; this.pos = 0; this.starved = false;
        this.port.onmessage = e => { this.wp = e.data.port; this.wp.onmessage = ev => this.q.push(ev.data); };
      }
      process(inputs, outputs){
        const o = outputs[0], L = o[0], R = o[1] || o[0];
        let i = 0;
        while(i < L.length){
          if(!this.cur){
            this.cur = this.q.shift(); this.pos = 0;
            if(!this.cur){
              L.fill(0, i); R.fill(0, i);
              if(!this.starved && this.wp && this.played){ this.wp.postMessage({ underrun: true }); this.port.postMessage({ underrun: true }); }
              this.starved = true;
              break;
            }
            this.starved = false; this.played = true;
            const c = this.cur;
            this.port.postMessage({ f: c.f, time: currentTime + i / sampleRate, phase: c.phase, breath: c.breath, load: c.load });
          }
          const c = this.cur, n = Math.min(L.length - i, c.L.length - this.pos);
          L.set(c.L.subarray(this.pos, this.pos + n), i);
          R.set(c.R.subarray(this.pos, this.pos + n), i);
          i += n; this.pos += n;
          if(this.pos >= c.L.length){ this.wp.postMessage({ chunk: { L: c.L, R: c.R } }, [c.L.buffer, c.R.buffer]); this.cur = null; }
        }
        return true;
      }
    }
    registerProcessor('still-player', Player);
  }

  const blobURL = src => URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
  let workerURL, playerURL;

  function liveContext(){
    try { return new AC({ latencyHint: 'playback' }); } catch(e) { return new AC(); }
  }

  class Engine {
    constructor(p){
      this.p = Object.assign({}, p);
      this.ctx = null; this.onNote = null; this.paused = false;
      this.report = null; this.depth = MOBILE ? 16 : 6;
    }
    natureGain(){ return 0.12 * Math.pow(this.p.natureLevel / 0.5, 2) * (MOBILE ? 0.35 : 1); }
    volumeGain(){ return Math.pow(this.p.volume / 0.8, 2); }

    start(){
      if(this.ctx) return;
      const ctx = this.ctx = this.preCtx || liveContext();
      this.unlock();
      const now = ctx.currentTime;
      this.music = ctx.createGain(); this.music.gain.value = 0;
      this.master = this.music;
      this.volume = ctx.createGain(); this.volume.gain.value = this.volumeGain();
      const limit = ctx.createWaveShaper(), N = 4096, curve = new Float32Array(N), K = 0.6;
      for(let i = 0; i < N; i++){
        const x = i / (N - 1) * 2 - 1, a = Math.abs(x);
        curve[i] = Math.sign(x) * (a <= K ? a : K + (1 - K) * Math.tanh((a - K) / (1 - K)));
      }
      limit.curve = curve;
      this.music.connect(this.volume).connect(limit).connect(ctx.destination);
      this.natBus = ctx.createGain(); this.natBus.gain.value = this.natureGain();
      this.natBus.connect(this.volume);
      this.music.gain.setValueAtTime(0, now);
      this.music.gain.linearRampToValueAtTime(1, now + 10);

      workerURL = workerURL || blobURL(`(${window.StillSynthModule})(self);\nconst CHUNK_ = ${CHUNK};\n(${workerMain})();`);
      playerURL = playerURL || blobURL(`(${playerMain})();`);
      this.worker = new Worker(workerURL);
      this.worker.onmessage = e => this.fromWorker(e.data);
      this.worker.onerror = e => console.warn('still worker:', e.message);
      const ch = new MessageChannel();
      this.worker.postMessage({ type: 'init', p: this.p, seed: Math.floor(Math.random() * 2 ** 31), sr: ctx.sampleRate,
        depth: this.depth, maxDepth: 48, port: ch.port1 }, [ch.port1]);
      ctx.audioWorklet.addModule(playerURL).then(() => {
        const node = this.node = new AudioWorkletNode(ctx, 'still-player', { numberOfInputs: 0, outputChannelCount: [2] });
        node.port.onmessage = e => {
          const d = e.data;
          if(d.underrun){ this.underruns = (this.underruns || 0) + 1; return; }
          this.report = d;
        };
        node.port.postMessage({ port: ch.port2 }, [ch.port2]);
        node.connect(this.music);
      }).catch(e => console.warn('still player:', e));
      if(this.p.nature !== 'none') this.setNature(this.p.nature);
    }

    // the music's own clock: which moment of the music is being heard now
    musicTime(){
      const r = this.report; if(!r || !this.ctx) return null;
      return r.f / this.ctx.sampleRate + Math.max(0, this.ctx.currentTime - r.time);
    }
    toCtxTime(t){
      const r = this.report; if(!r) return this.ctx.currentTime;
      return r.time + (t - r.f / this.ctx.sampleRate);
    }
    // the phase of the breath being heard (0..1), for the light
    breathPhase(){
      const r = this.report; if(!r || !this.ctx || this.paused) return null;
      return r.phase + Math.max(0, this.ctx.currentTime - r.time) * r.breath / 60;
    }
    breathe(){}

    fromWorker(d){
      if(d.type === 'note' && this.onNote){
        const delay = Math.max(0, (this.toCtxTime(d.t) - this.ctx.currentTime) * 1000);
        setTimeout(() => this.onNote && this.onNote(d.info), delay);
      }
      else if(d.type === 'closing' && this.onClosing) this.onClosing(d.t);
      else if(d.type === 'depth') this.depth = d.depth;
    }

    set(k, v){
      const prev = this.p[k];
      this.p[k] = v;
      if(!this.ctx || prev === v) return;
      const now = this.ctx.currentTime;
      if(k === 'nature') this.setNature(v);
      else if(k === 'natureLevel') this.natBus.gain.setTargetAtTime(this.natureGain(), now, 0.4);
      else if(k === 'volume') this.volume.gain.setTargetAtTime(this.volumeGain(), now, 0.15);
      this.worker.postMessage({ type: 'set', k, v });
    }

    // nature: real field recordings, a native loop after the player (as in audio.js)
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
      window.Still.loadNature(kind, ctx).then(buf => {
        if(this.nat !== nat) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        src.connect(g);
        const t = ctx.currentTime;
        src.start(t, Math.random() * buf.duration * 0.8);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + (MOBILE ? 20 : 5));
        nat.src = src;
      }).catch(e => console.warn(e));
    }

    unlock(){
      try { if(navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
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
      const now = this.ctx.currentTime;
      [this.music.gain, this.natBus.gain].forEach(p => { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(0, now + 2.5); });
      clearTimeout(this.suspendT);
      this.suspendT = setTimeout(() => { if(this.paused) this.ctx.suspend(); }, 2700);
    }
    resume(){
      if(!this.ctx) return;
      clearTimeout(this.suspendT);
      this.paused = false;
      this.ctx.resume().then(() => {
        const now = this.ctx.currentTime;
        [[this.music.gain, 1], [this.natBus.gain, this.natureGain()]].forEach(([p, v]) => {
          p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(v, now + 3);
        });
      });
    }
    // the end of a sitting: the synth places three bowls; the fades follow them when they are heard
    closing(onDone){
      if(!this.ctx) return;
      this.onClosing = t => {
        this.onClosing = null;
        const at = Math.max(this.ctx.currentTime, this.toCtxTime(t));
        [this.music.gain, this.natBus.gain].forEach(g => {
          const now = this.ctx.currentTime;
          g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
          g.setValueAtTime(g.value, at + 15);
          g.linearRampToValueAtTime(0, at + 34);
        });
        setTimeout(() => {
          this.paused = true; this.ctx.suspend();
          this.worker.postMessage({ type: 'afterClosing' });
          onDone && onDone();
        }, (at - this.ctx.currentTime + 35) * 1000);
      };
      this.worker.postMessage({ type: 'closing' });
    }
  }

  window.StillLive = { Engine };
})();
