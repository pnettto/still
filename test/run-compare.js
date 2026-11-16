// Runs test/compare.html in headless Chromium for each query string given:
//   python3 -m http.server 8123 &   node test/run-compare.js "mode=raga&voice=flute" "mode=deep&voice=harp"
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message));
  for (const qs of process.argv.slice(2)) {
    await pg.goto('http://localhost:8123/test/compare.html?' + qs);
    await pg.waitForFunction(() => window.DONE, null, { timeout: 180000 });
    console.log(await pg.evaluate(() => window.RESULT), '\n');
  }
  await b.close();
})();
