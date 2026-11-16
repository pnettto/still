# still

*Music for sitting quietly.*

**→ [still.pnetto.store](https://still.pnetto.store/)**

A meditation and yoga music maker, grown from the generative music of **here**. Open `index.html` and touch the small light. It begins exactly where *here* begins: the same warm drone, the same slow chords breathing six times a minute, the same soft wooden voice. From there you steer.

**Moments** are ready-made settings: *morning, flow, focus, devotion, savasana, sleep*. One tap, then adjust anything.

**Mood** is the heart of it. Each mood is a different way of making music, not just a different scale:

| mood | what it does |
|---|---|
| here | the music of *here*, note for note |
| dawn | lydian, high and airy pads, little arpeggios climbing upward |
| soulful | dorian, warm pads, sung stepwise phrases |
| tender | aeolian, close and dark, single notes answered by their own echoes |
| earth | mixolydian, open fifths, a gentle repeating figure at eight beats per breath |
| raga | bhairav colours, a plucked tanpura (Pa Sa Sa Sa), lines that rise and fall; the flute glides (meend) |
| deep | low, dark and spacious, sparse, for rest and sleep |

**Voice:** wood (the voice of *here*), singing bowl, kalimba, harp (a physically modelled plucked string), handpan, bamboo flute.
**Nature:** real field recordings (ocean, rain, stream, forest, night), or none. See [sounds/CREDITS.md](sounds/CREDITS.md).
**Sliders:** pitch (lower ↔ higher, no music theory needed), breath (3–10 a minute; the light and the chords follow it), melody, ground (the drone), light, space, nearness (of the nature sound), volume.

**Export** saves an MP3 (10, 20, 30 or 60 minutes) of exactly the current settings, composed fresh, with a soft beginning and three bowls at the end. It renders faster than real time.

**Share** copies a short link (`pingo.pnetto.store/ab3de`) through [Pingo](https://pingo.pnetto.store/llms.txt), the owner's link shortener, and remembers it per set of settings. The key lives in `main.js`, so it is public: Pingo only accepts it from this app's domain, and the worst anyone can do with it is create links within Pingo's limits. If Pingo is unreachable, or the page isn't served over https, share quietly falls back to the long link, which always works.

Also: **bells**, a soft bowl every 5, 10, 15 or 20 minutes of music, for coming back to the breath. A sitting timer that ends with three bowls, an optional A = 432 Hz tuning, **surprise**, **here** (back to the beginning) and **share** (copies a link to the exact music). Settings are remembered between visits.

Keys: `space` pause · `h` hide everything · `f` fullscreen · double-click a slider to reset it.

## Files
- `synth.js`: the engine as plain JS (score, voices, rooms, compressor), run in a Worker. It renders the music a little ahead and streams it to `live.js`'s AudioWorklet player, which only copies samples, so slow phones drain a buffer instead of glitching (the buffer grows by itself if they fall behind). It reproduces `audio.js` closely: `test/compare.html?mode=…&voice=…` renders both from one seed and compares them (every mood within 0.1 dB; the difference is 31–74 dB below the music, mostly the pads' oscillators drifting in phase). Export renders through it too, in one continuous pass.
- `live.js`: live playback through `synth.js`; volume and pause stay native, after the player, so they answer at once. `?legacy` uses the old engine.
- `audio.js`: the old engine (pure Web Audio), kept for browsers without AudioWorklet, and the reference `synth.js` is compared against. At its defaults it produces the music of [here](https://github.com/pnettto/here) (`js/audio.js`), at the same level. Moods are described as data (scale, progression, voicing, pad timbre, drone, motion, register, density, brightness) in `MOODS`.
- `main.js`: the controls, the quiet wash of light behind them, the timer, saved settings and share links. `window.__still` exposes the engine for debugging.
- `export.js`: renders the music through `synth.js` in a Worker, in one continuous pass, and encodes MP3 as it goes, so an hour never has to fit in memory. The engine's randomness is seeded: every note draws from a sequence keyed to its moment in time. (With `?legacy`, the old engine renders in overlapping chunks that replay the same score and meet in short cross-fades.)
- `sounds/*.js`: the nature recordings, loaded only when chosen.
- `vendor/lame.min.js`: [lamejs](https://github.com/zhuker/lamejs) 1.2.1, the MP3 encoder (LGPL, unmodified; see `vendor/lamejs-LICENSE`), loaded only when exporting.
- `?speed=N` fast-forwards the sitting timer for testing.
- Nature is part of the music: its highs (hiss, splashes, chirps) sit 6 dB lower (10 dB at dusk, 2 dB when radiant, following *light*), sudden high peaks are softened, a little of it goes into the music's hall, and it shares the music's compressor. `test/nature.html` measures each recording before and after.
- The drone's lowest voice carries overtones between about 200 and 700 Hz, so the ground is heard on phone speakers that can't play its fundamental; through headphones they add only a little body.
- Phones: nature plays at about a third of its level (−9 dB) and fades in over 20 s, since phone speakers lose the music's low end but not the hiss of nature. Exports are unaffected. Every device gets the full rooms. `?debug` shows an on-screen audio readout (on the new engine: buffer, underruns, synth load).
- Tests (`python3 -m http.server 8123`, then headless Chromium): `node test/run-compare.js "mode=raga&voice=flute"` (old vs new engine), `node test/brightness.js "mode=raga&melody=0"` (how bright a setting is).
- Levels were checked offline (`OfflineAudioContext`). Every mood sits within about 4 dB of *here*, and peaks stay below −7 dBFS at the default volume.

## Deploy
Live at **[still.pnetto.store](https://still.pnetto.store/)**, a custom domain on the Cloudflare Pages project `still` (`still-7xm.pages.dev`). It is a direct upload, not linked to GitHub, so pushing does not deploy. There is no build step: upload the app files as they are. Bump the `?v=` on the script and style links in `index.html` with each deploy, or phones keep the old code. `_headers` also asks browsers to recheck `.js` and `.css` files.

```sh
mkdir -p /tmp/still-dist && cp -r index.html _headers audio.js synth.js live.js main.js export.js style.css sounds vendor /tmp/still-dist/
npx wrangler pages deploy /tmp/still-dist --project-name still --branch main
```
