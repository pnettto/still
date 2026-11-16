// How bright is a sound? Renders the synth with the given settings for 30 s and reports the spectral
// centroid, the share of energy above 1.5 kHz, the crest factor and the level.
//   node test/brightness.js "mode=raga&melody=0&drone=0&space=0"   (padLevel=0 silences the pads)
global.window = global; require('../synth.js'); const { Synth } = window.StillSynth;
const q = new URLSearchParams(process.argv[2] || '');
const P = { mode: 'here', voice: 'wood', nature: 'none', pitch: 7, a432: false, breath: 6, melody: 0.5, drone: 0.5, light: 0.5, space: 0.5, natureLevel: 0.5, volume: 0.8, bells: 0 };
q.forEach((v, k) => { if(k in P) P[k] = typeof P[k] === 'number' ? +v : v; });
const sr = 44100, s = new Synth(P, { seed: +(q.get('seed') || 3), sr });
if(q.has('padLevel')) s.padLevel.value = +q.get('padLevel');
const n = 512 * Math.ceil(sr * 30 / 512), L = new Float32Array(n), R = new Float32Array(n); s.render(L, R, n);
function fft(re, im){ const N = re.length; for(let i = 1, j = 0; i < N; i++){ let b = N >> 1; for(; j & b; b >>= 1) j ^= b; j ^= b; if(i < j){ [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for(let len = 2; len <= N; len <<= 1){ const a = -2 * Math.PI / len; for(let i = 0; i < N; i += len) for(let k = 0; k < len / 2; k++){ const wr = Math.cos(a * k), wi = Math.sin(a * k), p = i + k + len / 2, xr = re[p] * wr - im[p] * wi, xi = re[p] * wi + im[p] * wr; re[p] = re[i + k] - xr; im[p] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } } }
const N = 4096; let tot = 0, hi = 0, cen = 0;
for(let f = 0; f + N <= n; f += N){ const re = new Float64Array(N), im = new Float64Array(N); for(let i = 0; i < N; i++) re[i] = L[f + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im);
  for(let k = 1; k < N / 2; k++){ const e = re[k] ** 2 + im[k] ** 2, hz = k * sr / N; tot += e; cen += e * hz; if(hz > 1500) hi += e; } }
let pk = 0, rm = 0; for(let i = 0; i < n; i++){ pk = Math.max(pk, Math.abs(L[i])); rm += L[i] * L[i]; }
console.log('centroid', (cen / tot).toFixed(0), 'Hz · above 1.5 kHz', (100 * hi / tot).toFixed(2) + '% · crest', (20 * Math.log10(pk / Math.sqrt(rm / n))).toFixed(1), 'dB · rms', (10 * Math.log10(rm / n)).toFixed(1), 'dB');
