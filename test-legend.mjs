import 'dotenv/config';
import { createBrowser, createContext } from './src/utils/browser.js';

const browser = await createBrowser();
const context = await createContext(browser);
const page = await context.newPage();

const allSubtitles = new Set();
const m3u8s = new Set();

page.on('response', (r) => {
  const url = r.url();
  if (url.includes('.m3u8')) m3u8s.add(url);
  if (url.includes('.vtt') || url.includes('.srt')) allSubtitles.add(url);
});

console.log('[*] Abrindo vidsrc.in...');
await page.goto('https://vidsrc.in/embed/movie/550', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(2000);
}

if (allSubtitles.size === 0) {
  console.log('[*] Clicando no play...');
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const el = document.querySelector('video, .play, [class*="play"], button');
        if (el) el.click();
      });
    } catch (_) {}
  }
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
  }
}

console.log('\n════════════════════════════════════════════');
console.log('  RESULTADO');
console.log('════════════════════════════════════════════');
console.log(`\nM3U8 encontrados: ${m3u8s.size}`);
m3u8s.forEach(u => console.log(`  ${u.slice(0, 120)}`));

console.log(`\nLegendas encontradas: ${allSubtitles.size}`);
allSubtitles.forEach(u => console.log(`  ${u}`));

await browser.close();
