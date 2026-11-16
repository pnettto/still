// STILL — the controls, a quiet wash of light, the sitting timer

(function(){
  const { Engine } = window.Still;
  const SPEED = parseFloat(new URLSearchParams(location.search).get('speed')) || 1;   // debug: fast-forward the timer

  // ------------------------------------------------------------ state
  // These defaults are "here", note for note.
  const DEFAULTS = {
    mode: 'here', voice: 'wood', nature: 'none', pitch: 7, a432: false,
    breath: 6, melody: 0.5, drone: 0.5, light: 0.5, space: 0.5, natureLevel: 0.5, volume: 0.8, bells: 0,
  };
  // settings that belong to the person, not to the music: presets and "begin" leave them alone
  const PERSONAL = ['volume', 'bells'];

  // presets: ready-made settings for a time of day or a kind of practice.
  // "begin" is the original music; "surprise me" chooses for you.
  const BEGIN = (() => {
    const o = {};
    Object.keys(DEFAULTS).forEach(k => { if(!PERSONAL.includes(k)) o[k] = DEFAULTS[k]; });
    return o;
  })();
  const PRESETS = [
    ['begin', 'the original, as it first was', BEGIN],
    ['morning', 'first light, birdsong, a bright thumb piano',
      { mode: 'dawn', voice: 'kalimba', nature: 'forest', pitch: 8, breath: 6, melody: 0.6, drone: 0.4, light: 0.62, space: 0.5, natureLevel: 0.5 }],
    ['flow', 'for moving practice: a steady, grounded figure',
      { mode: 'earth', voice: 'handpan', nature: 'none', pitch: 6, breath: 6, melody: 0.62, drone: 0.5, light: 0.5, space: 0.42, natureLevel: 0.5 }],
    ['focus', 'for work and study: the music of here, by a stream',
      { mode: 'here', voice: 'wood', nature: 'stream', pitch: 7, breath: 6, melody: 0.4, drone: 0.45, light: 0.5, space: 0.4, natureLevel: 0.45 }],
    ['savasana', 'lying still: slow waves, a singing bowl',
      { mode: 'tender', voice: 'bowl', nature: 'ocean', pitch: 5, breath: 5, melody: 0.3, drone: 0.55, light: 0.38, space: 0.72, natureLevel: 0.5 }],
    ['sleep', 'low and dark, rain, very little happening',
      { mode: 'deep', voice: 'harp', nature: 'rain', pitch: 4, breath: 4, melody: 0.18, drone: 0.6, light: 0.25, space: 0.78, natureLevel: 0.55 }],
    ['surprise me', 'let it choose for you', null],
  ];
  const NOTES = ['G', 'A♭', 'A', 'B♭', 'B', 'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯'];
  const words = list => v => list[Math.min(list.length - 1, Math.floor(v * list.length))];

  const MOODS = [
    ['here', 'here', 'where it began · open, warm, at home'],
    ['dawn', 'dawn', 'first light · weightless, rising, bright'],
    ['soulful', 'soulful', 'a song without words · tender strength'],
    ['tender', 'tender', 'inward · slow, consoling, each note answered'],
    ['earth', 'earth', 'grounded · a gentle figure, round and round'],
    ['raga', 'raga', 'morning devotion · a tanpura and gliding lines'],
    ['deep', 'deep', 'for rest and sleep · low, dark, spacious'],
  ];
  const CHOICES = [
    { k: 'voice', label: 'voice', options: [
      ['wood', 'wood', 'soft mallets on wooden bars'],
      ['bowl', 'bowl', 'a struck singing bowl'],
      ['kalimba', 'kalimba', 'a thumb piano'],
      ['harp', 'harp', 'plucked strings'],
      ['handpan', 'handpan', 'a steel handpan, touched by fingertips'],
      ['flute', 'flute', 'a breathy bamboo flute'],
    ] },
    { k: 'nature', label: 'nature', options: [
      ['none', 'none', 'only the music'],
      ['ocean', 'ocean', 'waves on a tropical beach · recording by J.D. Savanyu, CC0'],
      ['rain', 'rain', 'rain on leaves · recording by Gravity Sound, CC BY 4.0'],
      ['stream', 'stream', 'a small brook · recording by Amada44, CC BY-SA 4.0'],
      ['forest', 'forest', 'birdsong at the edge of a wood, early morning · recording by Matutinho, CC BY-SA 4.0'],
      ['night', 'night', 'crickets on a summer night · recording by Fortunamarco2003, CC BY-SA 4.0'],
    ] },
  ];
  const SLIDERS = [
    { k: 'pitch', label: 'pitch', min: 0, max: 11, step: 1, title: 'lower or higher; everything stays in tune with itself',
      fmt: v => words(['very low', 'low', 'warm', 'middle', 'bright', 'high'])(v / 12) + `<small>${NOTES[v]}</small>` },
    { k: 'breath', label: 'breath', min: 3, max: 10, step: 0.5, title: 'breaths per minute; the light, the swells and the chords follow it',
      fmt: v => (v % 1 ? v.toFixed(1) : v) + ' a minute' },
    { k: 'melody', label: 'melody', min: 0, max: 1, step: 0.01, title: 'how much the voice sings',
      fmt: v => v < 0.02 ? 'silence' : words(['rare', 'sparse', 'gentle', 'flowing', 'abundant'])(v) },
    { k: 'drone', label: 'ground', min: 0, max: 1, step: 0.01, title: 'the low drone beneath everything',
      fmt: v => v < 0.01 ? 'none' : words(['faint', 'soft', 'present', 'deep', 'vast'])(v) },
    { k: 'light', label: 'light', min: 0, max: 1, step: 0.01, title: 'dark and velvet, or bright and airy',
      fmt: words(['dusk', 'soft', 'warm', 'bright', 'radiant']) },
    { k: 'space', label: 'space', min: 0, max: 1, step: 0.01, title: 'how far the sound travels',
      fmt: words(['close', 'room', 'hall', 'temple', 'sky']) },
    { k: 'natureLevel', label: 'nature', min: 0, max: 1, step: 0.01, title: 'how loud the nature sound is',
      fmt: v => state.nature === 'none' ? 'off' : v < 0.02 ? 'silent' : words(['faint', 'soft', 'present', 'full', 'loud'])(v) },
    { k: 'volume', label: 'volume', min: 0, max: 1, step: 0.01, title: 'overall loudness',
      fmt: v => v < 0.01 ? 'silent' : v < 0.2 ? 'whisper' : v < 0.45 ? 'quiet' : v < 0.7 ? 'soft' : v < 0.9 ? 'full' : 'strong' },
  ];

  // colours of each mood: [background, glow]
  const PALETTES = {
    here:    [[22, 12, 8],  [255, 200, 140]],
    dawn:    [[30, 15, 22], [255, 190, 172]],
    soulful: [[17, 12, 30], [205, 184, 255]],
    tender:  [[9, 17, 26],  [168, 212, 236]],
    earth:   [[14, 19, 11], [222, 226, 160]],
    raga:    [[30, 12, 6],  [255, 170, 96]],
    deep:    [[5, 7, 15],   [140, 156, 220]],
  };

  function load(){
    let s = {};
    try { s = JSON.parse(localStorage.getItem('still.v2') || '{}'); } catch(e) {}
    const h = new URLSearchParams(location.hash.slice(1));
    if([...h.keys()].length){ s = {}; h.forEach((v, k) => { s[k] = v; }); }
    const out = Object.assign({}, DEFAULTS);
    Object.keys(DEFAULTS).forEach(k => {
      if(!(k in s)) return;
      const d = DEFAULTS[k];
      let v = s[k];
      if(typeof d === 'number'){ v = parseFloat(v); if(!isFinite(v)) return; }
      if(typeof d === 'boolean') v = v === true || v === 'true' || v === '1';
      out[k] = v;
    });
    if(!PALETTES[out.mode]) out.mode = DEFAULTS.mode;
    if(!CHOICES[0].options.some(o => o[0] === out.voice)) out.voice = DEFAULTS.voice;
    if(!CHOICES[1].options.some(o => o[0] === out.nature)) out.nature = DEFAULTS.nature;
    out.pitch = Math.max(0, Math.min(11, Math.round(out.pitch)));
    return out;
  }
  const state = load();
  function save(){
    try { localStorage.setItem('still.v2', JSON.stringify(state)); } catch(e) {}
    if(location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  function shareURL(){
    const h = new URLSearchParams();
    Object.keys(DEFAULTS).forEach(k => { if(!PERSONAL.includes(k)) h.set(k, typeof state[k] === 'boolean' ? (state[k] ? '1' : '0') : state[k]); });
    return location.origin + location.pathname + '#' + h.toString();
  }

  const engine = new Engine(state);
  window.__still = { engine, state };   // for debugging from the console

  // ------------------------------------------------------------ building the controls
  const $ = id => document.getElementById(id);
  const controls = {};
  const body = document.body;

  function set(k, v){
    begin();
    if(state[k] === v) return;
    state[k] = v;
    engine.set(k, v);
    sync(k);
    if(k === 'nature') sync('natureLevel');
    save();
  }


  // moods
  const moodBtns = MOODS.map(([v, text, line]) => {
    const b = document.createElement('button');
    b.textContent = text; b.dataset.v = v;
    b.addEventListener('click', () => set('mode', v));
    $('moods').appendChild(b);
    return b;
  });
  controls.mode = { sync(){ moodBtns.forEach(b => b.classList.toggle('on', b.dataset.v === state.mode)); } };

  // voice and nature
  CHOICES.forEach(p => {
    const row = document.createElement('div'); row.className = 'row';
    const label = document.createElement('label'); label.textContent = p.label;
    const box = document.createElement('div'); box.className = 'opts';
    const btns = p.options.map(([v, text, title]) => {
      const b = document.createElement('button');
      b.textContent = text; b.dataset.v = v;
      b.addEventListener('click', () => set(p.k, v));
      box.appendChild(b);
      return b;
    });
    row.append(label, box);
    $('choices').appendChild(row);
    controls[p.k] = { btns, sync(){ btns.forEach(b => b.classList.toggle('on', b.dataset.v === String(state[p.k]))); } };
  });

  // presets — the same quiet style as voice and nature, so moods stay the main thing
  const presetsRow = document.createElement('div'); presetsRow.className = 'row';
  const presetsLabel = document.createElement('label'); presetsLabel.textContent = 'presets';
  const presetsBox = document.createElement('div'); presetsBox.className = 'opts';
  presetsRow.append(presetsLabel, presetsBox);
  $('choices').appendChild(presetsRow);

  const presetBtns = PRESETS.map(([name, title, values]) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => applyPreset(name, values, b));
    presetsBox.appendChild(b);
    return b;
  });
  function applyPreset(name, values, btn){
    if(name === 'surprise me') return surprise(btn);
    const v = name === 'begin' ? BEGIN : values;
    Object.keys(v).forEach(k => set(k, v[k]));
  }
  function syncPresets(){
    presetBtns.forEach((b, i) => {
      const [name] = PRESETS[i];
      if(name === 'surprise me'){ b.classList.remove('on'); return; }
      const v = name === 'begin' ? BEGIN : PRESETS[i][2];
      b.classList.toggle('on', Object.keys(v).every(k => state[k] === v[k]));
    });
  }

  // sliders
  SLIDERS.forEach(p => {
    const row = document.createElement('div'); row.className = 'slider';
    const label = document.createElement('label'); label.textContent = p.label;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: p.min, max: p.max, step: p.step });
    input.setAttribute('aria-label', p.label);
    const out = document.createElement('output');
    input.addEventListener('input', () => set(p.k, parseFloat(input.value)));
    input.addEventListener('dblclick', () => set(p.k, DEFAULTS[p.k]));
    row.append(label, input, out);
    $('sliders').appendChild(row);
    controls[p.k] = { sync(){
      if(parseFloat(input.value) !== state[p.k]) input.value = state[p.k];
      input.style.setProperty('--fill', ((state[p.k] - p.min) / (p.max - p.min) * 100) + '%');
      out.innerHTML = p.fmt(state[p.k]);
      if(p.k === 'natureLevel') row.classList.toggle('idle', state.nature === 'none');
    } };
  });

  // the top bar
  const a432Btn = $('a432');
  controls.a432 = { sync(){ a432Btn.classList.toggle('on', state.a432); } };
  a432Btn.addEventListener('click', () => { set('a432', !state.a432); feedback(a432Btn, state.a432 ? 'tuned to 432 hz' : 'tuned to 440 hz'); });

  function sync(k){
    if(k){ controls[k] && controls[k].sync(); }
    else Object.values(controls).forEach(c => c.sync());
    if(!k || k === 'mode') document.documentElement.style.setProperty('--glow', PALETTES[state.mode][1].join(', '));
    syncPresets();
  }
  sync();

  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const tipEl = $('tip'), feedbackEl = $('feedback');
  let feedbackT;

  function place(el, bubble, below){
    bubble.style.left = '0px'; bubble.style.top = '0px';
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let x, y;
    if(el){
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2 - bw / 2;
      y = below ? r.bottom + 10 : r.top - bh - 10;
      if(!below && y < 8) y = r.bottom + 10;
      if(below && y + bh > window.innerHeight - 8) y = r.top - bh - 10;
    } else {
      x = window.innerWidth / 2 - bw / 2;
      y = 96;
    }
    x = Math.max(8, Math.min(window.innerWidth - bw - 8, x));
    bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // feedback appears right beside the control you touched — never at the bottom
  function feedback(anchor, html, ms){
    hideTip();
    feedbackEl.innerHTML = html; place(anchor, feedbackEl, false); feedbackEl.classList.add('on');
    clearTimeout(feedbackT); feedbackT = setTimeout(() => feedbackEl.classList.remove('on'), ms || 2600);
  }

  // tooltips: the same quiet copy as before, but immediate and styled
  document.querySelectorAll('#top [title]').forEach(el => { el.dataset.tip = el.title; el.removeAttribute('title'); });
  function showTip(el){ if(feedbackEl.classList.contains('on')) return; const t = el.dataset.tip; if(!t) return; tipEl.textContent = t; place(el, tipEl, false); tipEl.classList.add('on'); }
  function hideTip(){ tipEl.classList.remove('on'); }
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if(el) showTip(el); else hideTip(); });
  document.addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if(el && !el.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if(el) showTip(el); });
  document.addEventListener('focusout', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if(el && !el.contains(e.relatedTarget)) hideTip(); });

  function surprise(btn){
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const r = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
    const mode = pick(MOODS.filter(m => m[0] !== state.mode))[0];
    set('mode', mode);
    set('voice', pick(CHOICES[0].options)[0]);
    set('nature', Math.random() < 0.45 ? 'none' : pick(CHOICES[1].options.slice(1))[0]);
    set('pitch', 3 + Math.floor(Math.random() * 7));
    set('breath', pick([4, 5, 5.5, 6, 6, 6.5, 7]));
    set('melody', r(0.3, 0.7)); set('drone', r(0.3, 0.7)); set('light', r(0.35, 0.65)); set('space', r(0.4, 0.8));
    feedback(btn, MOODS.find(m => m[0] === mode)[2].split(' · ')[0]);
  }
  // sharing, through Pingo (https://pingo.pnetto.store/llms.txt), a private link shortener.
  // The key is in this file, so it is public: Pingo only accepts it from this app's domains, and
  // the worst anyone can do with it is make links, within Pingo's limits.
  const PINGO = { base: 'https://pingo.pnetto.store', key: 'pingo_877d19aede96eaf154de5b097e6811e25be8c671959121f2' };
  const timeout = ms => (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(ms) : undefined;
  const fnv = text => 'h' + Array.from(text).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

  // one small helper: shorten, or give up quietly and let the caller use the long link
  async function pingo(url){
    try {
      const r = await fetch(PINGO.base + '/api/links', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + PINGO.key, 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: timeout(5000),
      });
      const data = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(r.status + ' ' + (data.error || ''));
      if(!data.short) throw new Error('no link returned');
      return data.short;
    } catch(e){
      // the page may be offline, opened from a file, or Pingo may be down: the long link still works
      console.warn('pingo:', e.message);
      return null;
    }
  }
  const shortLinks = (() => { try { return JSON.parse(localStorage.getItem('still.short') || '{}'); } catch(e) { return {}; } })();
  function rememberShort(url, short){
    shortLinks[fnv(url)] = short;
    const keys = Object.keys(shortLinks);
    if(keys.length > 50) delete shortLinks[keys[0]];
    try { localStorage.setItem('still.short', JSON.stringify(shortLinks)); } catch(e) {}
  }
  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch(e){
      // older browsers, or a page not served over https
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch(e2) {}
      t.remove();
      return ok;
    }
  }

  $('share').addEventListener('click', async () => {
    const url = shareURL();
    let short = shortLinks[fnv(url)];
    if(!short){
      short = await pingo(url);
      if(short) rememberShort(url, short);
    }
    const link = short || url;
    if(await copy(link)){
      feedback($('share'), 'link copied · ' + escapeHtml(link.replace(/^https?:\/\//, '')));
    } else {
      history.replaceState(null, '', url);
      feedback($('share'), 'copy blocked · the link is in the address bar');
    }
  });
  function fullscreen(){
    const el = document.documentElement;
    if(!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if(document.fullscreenElement) document.exitFullscreen();
  }

  // about
  const aboutEl = $('about');
  function openAbout(){ aboutEl.classList.add('open'); aboutEl.setAttribute('aria-hidden', 'false'); }
  function closeAbout(){ aboutEl.classList.remove('open'); aboutEl.setAttribute('aria-hidden', 'true'); }
  $('about-btn').addEventListener('click', openAbout);
  $('about-close').addEventListener('click', closeAbout);
  aboutEl.addEventListener('click', e => { if(e.target === aboutEl) closeAbout(); });

  // the sitting timer: ∞, or a fixed length closed by three bowls.
  // It runs on wall-clock time, so it keeps counting while the tab is out of focus.
  const LENGTHS = [0, 5, 10, 20, 30, 45, 60];
  let lengthIdx = 0, remaining = 0, closing = false;
  let timerLast = Date.now(), timerEnd = null;
  const timerBtn = $('timer'), timerVal = timerBtn.querySelector('span');
  function showTimer(){
    if(!LENGTHS[lengthIdx]){ timerVal.textContent = '∞'; timerBtn.classList.remove('on'); return; }
    const s = Math.max(0, Math.ceil(remaining));
    timerVal.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    timerBtn.classList.add('on');
  }
  function finishSitting(){
    if(!started || !playing || closing || !LENGTHS[lengthIdx]) return;
    clearTimeout(timerEnd);
    remaining = 0; closing = true;
    status('closing');
    engine.closing(() => {
      closing = false; playing = false;
      status('welcome back');
      remaining = LENGTHS[lengthIdx] * 60; showTimer();
    });
  }
  function armTimerEnd(){
    clearTimeout(timerEnd);
    if(started && playing && !closing && LENGTHS[lengthIdx]){
      timerEnd = setTimeout(finishSitting, remaining * 1000 / SPEED);
    }
  }
  timerBtn.addEventListener('click', () => {
    if(closing) return;
    lengthIdx = (lengthIdx + 1) % LENGTHS.length;
    remaining = LENGTHS[lengthIdx] * 60;
    timerLast = Date.now(); armTimerEnd();
    showTimer();
    feedback(timerBtn, LENGTHS[lengthIdx] ? 'a sitting of ' + LENGTHS[lengthIdx] + ' minutes, closed by three bowls' : 'no end');
  });
  showTimer();

  // interval bells
  const BELLS = [0, 5, 10, 15, 20];
  const bellsBtn = $('bells'), bellsVal = bellsBtn.querySelector('span');
  controls.bells = { sync(){
    bellsVal.textContent = state.bells ? state.bells + ' min' : 'off';
    bellsBtn.classList.toggle('on', !!state.bells);
  } };
  controls.bells.sync();
  bellsBtn.addEventListener('click', () => {
    const next = BELLS[(BELLS.indexOf(state.bells) + 1) % BELLS.length];
    set('bells', next);
    feedback(bellsBtn, next ? 'a soft bowl every ' + next + ' minutes' : 'no bells');
  });

  // export: assemble an mp3 of the current settings, faster than real time
  const sheet = $('sheet'), lengthsEl = $('lengths'), progressBar = sheet.querySelector('.bar i'), progressText = sheet.querySelector('#progress p');
  const EXPORT_LENGTHS = [10, 20, 30, 60];
  let exportMinutes = 20, exporting = false, cancelled = false, lastURL = null;
  const exportChip = $('exportchip'), exportChipText = exportChip.querySelector('span'), exportChipCancel = exportChip.querySelector('button');
  const lengthBtns = EXPORT_LENGTHS.map(m => {
    const b = document.createElement('button');
    b.textContent = m + ' min';
    b.addEventListener('click', () => { exportMinutes = m; lengthBtns.forEach((x, i) => x.classList.toggle('on', EXPORT_LENGTHS[i] === m)); });
    lengthsEl.appendChild(b);
    return b;
  });
  lengthBtns[1].classList.add('on');

  function setProgress(html){ progressText.innerHTML = html; }
  function syncExportChip(){
    if(exporting && !sheet.classList.contains('open')){
      exportChip.classList.add('on'); place($('export'), exportChip, true);
    } else exportChip.classList.remove('on');
  }
  function openSheet(){ sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); syncExportChip(); }
  function closeSheet(){
    // leaving the sheet keeps the render going in the background
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    syncExportChip();
  }
  function cancelExport(){ if(exporting) cancelled = true; }
  $('export').addEventListener('click', openSheet);
  $('sheet-close').addEventListener('click', closeSheet);
  $('sheet-cancel').addEventListener('click', cancelExport);
  exportChipCancel.addEventListener('click', cancelExport);
  sheet.addEventListener('click', e => { if(e.target === sheet) closeSheet(); });
  $('sheet-go').addEventListener('click', async () => {
    if(exporting) return;
    exporting = true; cancelled = false;
    sheet.classList.add('busy'); sheet.classList.remove('done');
    progressBar.style.width = '0%'; setProgress('assembling…');
    exportChipText.textContent = 'assembling…';
    syncExportChip();
    const started = performance.now();
    try {
      const blob = await window.StillExport.render(state, exportMinutes, f => {
        const pct = Math.floor(f * 100);
        progressBar.style.width = (f * 100).toFixed(1) + '%';
        const el = (performance.now() - started) / 1000;
        const left = f > 0.03 ? Math.max(0, el / f - el) : null;
        const line = 'assembling · ' + pct + '%' + (left !== null ? ' · about ' + (left > 90 ? Math.round(left / 60) + ' min' : Math.ceil(left / 5) * 5 + ' s') + ' left' : '');
        setProgress(line);
        exportChipText.textContent = 'assembling · ' + pct + '%';
      }, () => cancelled);
      if(blob){
        const name = `still-${state.mode}-${state.voice}${state.nature !== 'none' ? '-' + state.nature : ''}-${exportMinutes}min.mp3`;
        if(lastURL) URL.revokeObjectURL(lastURL);
        lastURL = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = lastURL; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        progressBar.style.width = '100%';
        setProgress(`saved · <a href="${lastURL}" download="${name}">${name}</a> · ${(blob.size / 1048576).toFixed(0)} MB`);
        sheet.classList.add('done');
        feedback($('export'), `saved · <a href="${lastURL}" download="${name}">${name}</a>`);
      } else if(cancelled){
        setProgress('cancelled');
      }
    } catch(e){
      console.error(e);
      setProgress('something went wrong · ' + e.message);
    }
    exporting = false;
    sheet.classList.remove('busy');
    syncExportChip();
  });

  // ------------------------------------------------------------ begin, pause
  const playBtn = $('play'), statusEl = $('status');
  let started = false, playing = false;

  async function wake(){ try { if('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch(e) {} }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && playing) wake(); });

  function status(text){ statusEl.textContent = text; }
  function begin(){
    if(started) return;
    started = playing = true;
    body.classList.add('started');
    engine.onNote = glimmer;
    engine.start();
    wake();
    status('');
    playBtn.setAttribute('aria-label', 'pause');
    timerLast = Date.now(); armTimerEnd();
  }
  // unlock audio on every real gesture (sliders' 'input' doesn't count on iOS); if the context
  // was asleep (never allowed to start, or interrupted by a call / the lock screen), a tap on
  // play should wake it rather than pause
  let wokeAt = 0;
  const unlock = () => { if(engine.unlock() && started) wokeAt = Date.now(); };
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, unlock, true));

  function togglePlay(){
    if(!started) return begin();
    if(closing) return;
    if(playing && (Date.now() - wokeAt < 1500 || (engine.ctx && engine.ctx.state !== 'running'))){
      wokeAt = 0; engine.unlock(); return;
    }
    playing = !playing;
    if(playing){
      engine.resume(); status('');
      if(LENGTHS[lengthIdx] && remaining <= 0) remaining = LENGTHS[lengthIdx] * 60;
      timerLast = Date.now(); armTimerEnd();
    } else { engine.pause(); status('resting'); clearTimeout(timerEnd); }
    playBtn.setAttribute('aria-label', playing ? 'pause' : 'continue');
  }
  playBtn.addEventListener('click', togglePlay);

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(e.target.tagName === 'INPUT' && e.key.startsWith('Arrow')) return;
    if(k === ' ' || (k === 'enter' && !started)){ e.preventDefault(); togglePlay(); }
    else if(k === 'f') fullscreen();
    else if(k === 'escape'){
      if(aboutEl.classList.contains('open')) closeAbout();
      else if(sheet.classList.contains('open')) closeSheet();
    }
    else if(k === 'h'){ body.classList.toggle('hidden'); if(body.classList.contains('hidden')) feedback(null, 'h · to return', 1800); }
  });

  // ------------------------------------------------------------ the sky: a quiet wash of colour
  const canvas = $('sky'), g = canvas.getContext('2d');
  let W = 0, H = 0;
  function resize(){
    // the wash is soft; rendering it at half resolution keeps it smooth and cheap
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.max(1, Math.round(W / 2)); canvas.height = Math.max(1, Math.round(H / 2));
  }
  window.addEventListener('resize', resize); resize();

  const dust = Array.from({ length: 48 }, () => ({
    x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8,
    v: 0.003 + Math.random() * 0.006, ph: Math.random() * 6.28, tw: 0.15 + Math.random() * 0.4,
  }));
  const glints = [];
  let pulse = 0;
  function glimmer(info){
    if(document.hidden) return;
    pulse = Math.min(1, pulse + 0.5 * info.vel);
    // a faint point of light, placed left-to-right by pitch, somewhere in the room
    glints.push({ x: Math.min(0.95, Math.max(0.05, 0.5 + (info.rel - 26) / 50 + (Math.random() - 0.5) * 0.25)),
      y: 0.12 + Math.random() * 0.76, age: 0, life: 4 + Math.random() * 3, a: info.vel });
  }

  const col = PALETTES[state.mode].map(c => c.slice());
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(4)})`;
  const dot = playBtn.querySelector('.dot');

  let phase = 0, last = performance.now(), bright = 0.6, t = 0;
  function frame(now){
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if(playing) { phase += dt * state.breath / 60; t += dt; }
    const breath = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    engine.breathe(breath);
    bright += ((playing ? 1 : started ? 0.45 : 0.6) - bright) * Math.min(1, dt / 2);
    pulse *= Math.pow(0.5, dt / 0.8);

    // the one small light: breathes, and brightens when a note sounds
    if(started){
      dot.style.setProperty('--b', (0.7 + 0.75 * breath + 0.25 * pulse).toFixed(3));
      dot.style.setProperty('--o', ((0.45 + 0.4 * breath + 0.3 * pulse) * (playing ? 1 : 0.5)).toFixed(3));
    }

    // the sitting timer: wall-clock, so it stays honest across pauses and background tabs
    if(started && playing && !closing && LENGTHS[lengthIdx]){
      const nowMs = Date.now();
      remaining -= (nowMs - timerLast) / 1000 * SPEED;
      timerLast = nowMs;
      if(remaining <= 0) finishSitting();
      else showTimer();
    } else {
      timerLast = Date.now();
    }

    const target = PALETTES[state.mode];
    for(let i = 0; i < 2; i++) for(let j = 0; j < 3; j++) col[i][j] += (target[i][j] - col[i][j]) * Math.min(1, dt / 3);
    const [bg, glow] = col;
    const L = (0.7 + state.light * 0.6) * bright;
    const w = canvas.width, h = canvas.height, m = Math.max(w, h);

    g.globalCompositeOperation = 'source-over';
    g.fillStyle = rgba(bg, 1);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';

    // two slow pools of light that drift and breathe
    const pools = [
      [0.28 + 0.06 * Math.sin(t * 0.021), 0.3 + 0.05 * Math.cos(t * 0.017), 0.75, 0.085],
      [0.74 + 0.05 * Math.cos(t * 0.019), 0.74 + 0.05 * Math.sin(t * 0.023), 0.65, 0.06],
    ];
    pools.forEach(([x, y, r, a]) => {
      const grd = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * m);
      grd.addColorStop(0, rgba(glow, a * (0.75 + 0.35 * breath) * L));
      grd.addColorStop(1, rgba(glow, 0));
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });

    dust.forEach(d => {
      if(playing){ d.y -= d.v * dt; d.ph += dt * d.tw; }
      if(d.y < -0.02){ d.y = 1.02; d.x = Math.random(); }
      g.fillStyle = rgba(glow, (0.07 + 0.07 * Math.sin(d.ph)) * bright);
      g.beginPath(); g.arc(d.x * w, d.y * h, d.s, 0, 6.283); g.fill();
    });

    for(let i = glints.length - 1; i >= 0; i--){
      const p = glints[i];
      p.age += dt;
      if(p.age > p.life){ glints.splice(i, 1); continue; }
      const k = p.age / p.life, a = Math.min(1, p.age / 0.5) * Math.pow(1 - k, 2) * p.a * 0.22;
      const x = p.x * w, y = (p.y - k * 0.03) * h, r = 3 + 9 * k;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(glow, a));
      grd.addColorStop(1, rgba(glow, 0));
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// ------------------------------------------------------------ ?debug: an on-screen audio readout, for phones without devtools
if(/[?&]debug\b/.test(location.search)) (() => {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  window.addEventListener('unhandledrejection', e => errs.push(String(e.reason)));
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:6px;right:6px;bottom:6px;z-index:99999;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.4 monospace;padding:6px;white-space:pre-wrap;pointer-events:auto';
  const out = document.createElement('div'); box.appendChild(out);
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'margin:6px 6px 0 0;padding:10px 12px;font:14px monospace;color:#000;background:#0f0;border:0;border-radius:6px;-webkit-appearance:none;appearance:none'; b.onclick = e => { e.stopPropagation(); try { fn(); } catch(err) { errs.push(err.message); } }; box.appendChild(b); };
  const E = () => window.__still.engine;
  const AC = window.AudioContext || window.webkitAudioContext;
  btn('beep (new ctx)', () => { const c = new AC(); const o = c.createOscillator(); o.frequency.value = 660; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4); });
  btn('beep (app ctx)', () => { const c = E().ctx || E().preCtx; const o = c.createOscillator(); o.frequency.value = 660; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4); });
  btn('no rooms', () => { const e = E(); e.bus.disconnect(e.hall); e.bus.disconnect(e.vast); });
  btn('no limiter', () => { const e = E(); e.volume.disconnect(); e.volume.connect(e.ctx.destination); });
  document.body.appendChild(box);
  let an, anFor, lastT = 0, lastW = 0;
  setInterval(() => {
    const e = E(), c = e.ctx || e.preCtx;
    let rms = '-';
    if(e.ctx && e.volume){
      if(anFor !== e.ctx){ an = e.ctx.createAnalyser(); an.fftSize = 2048; e.volume.connect(an); anFor = e.ctx; }
      const d = new Float32Array(2048); an.getFloatTimeDomainData(d);
      let s = 0; for(const x of d) s += x * x; rms = Math.sqrt(s / d.length).toExponential(2);
    }
    const now = performance.now() / 1000, t = c ? c.currentTime : 0;
    const speed = lastW ? ((t - lastT) / (now - lastW)).toFixed(2) : '-'; lastT = t; lastW = now;
    out.textContent = [
      'ctx: ' + (c ? c.state + ' · ' + c.sampleRate + ' Hz · t=' + t.toFixed(2) + ' · speed ' + speed : 'none'),
      c ? 'latency base ' + (c.baseLatency || 0).toFixed(3) + ' out ' + (c.outputLatency || 0).toFixed(3) + ' · ch ' + c.destination.maxChannelCount : '',
      'master ' + (e.master ? e.master.gain.value.toFixed(2) : '-') + ' · vol ' + (e.volume ? e.volume.gain.value.toFixed(2) : '-') + ' · rms ' + rms + ' · paused ' + e.paused,
      'activation ' + (navigator.userActivation ? navigator.userActivation.hasBeenActive : '?') + ' · ' + navigator.userAgent.slice(0, 90),
      'errors: ' + (errs.slice(-4).join(' | ') || 'none'),
    ].join('\n');
  }, 500);
})();
