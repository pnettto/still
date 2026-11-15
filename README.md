# still

*Music for sitting quietly.*

A meditation and yoga music maker, grown from the generative music of **here**. Open `index.html` and touch the small light. It begins exactly where *here* begins: the same warm drone, the same slow chords breathing six times a minute, the same soft wooden voice. From there you steer.

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

Also: a sitting timer that ends with three bowls, an optional A = 432 Hz tuning, **surprise**, **here** (back to the beginning) and **share** (copies a link to the exact music). Settings are remembered between visits.

Keys: `space` pause · `h` hide everything · `f` fullscreen · double-click a slider to reset it.

## Files
- `audio.js`: the engine. At its defaults it produces the music of [here](https://github.com/pnettto/here) (`js/audio.js`), at the same level. Moods are described as data (scale, progression, voicing, pad timbre, drone, motion, register, density, brightness) in `MOODS`.
- `main.js`: the controls, the quiet wash of light behind them, the timer, saved settings and share links. `window.__still` exposes the engine for debugging.
- `sounds/*.js`: the nature recordings, loaded only when chosen.
- `?speed=N` fast-forwards the sitting timer for testing.
- Levels were checked offline (`OfflineAudioContext`). Every mood sits within about 4 dB of *here*, and peaks stay below −7 dBFS at the default volume.
