import 'dotenv/config';
import { createBrowser, createContext } from './src/utils/browser.js';

const browser = await createBrowser();
const context = await createContext(browser);
const page = await context.newPage();

let m3u8Url = null;
const subtitles = [];

page.on('response', (r) => {
  const url = r.url();
  if (url.includes('.m3u8') && !m3u8Url) {
    console.log(`\n[+] M3U8 CAPTURADO: ${url}\n`);
    m3u8Url = url;
  }
  if ((url.includes('.vtt') || url.includes('.srt')) && !subtitles.includes(url)) {
    subtitles.push(url);
    console.log(`[+] Legenda: ${url}`);
  }
});

page.on('frameattached', (frame) => {
  const url = frame.url();
  if (url && url !== 'about:blank') console.log(`[iframe] ${url}`);
});

console.log('[*] Abrindo myembed.biz...');
await page.goto('https://myembed.biz/filme/tt22084616', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

for (let i = 0; i < 30; i++) {
  if (m3u8Url) break;
  await page.waitForTimeout(2000);
  console.log(`   ... ${(i + 1) * 2}s`);
}

if (!m3u8Url) {
  console.log('\n[*] Tentando clicar no play...');
  for (const frame of page.frames()) {
    try {
      const clicked = await frame.evaluate(() => {
        const el = document.querySelector('video, .play, [class*="play"], button');
        if (el) { el.click(); return true; }
        return false;
      });
      if (clicked) console.log(`   [+] Cliquei em ${frame.url().slice(0, 60)}`);
    } catch (_) {}
  }
  for (let i = 0; i < 20; i++) {
    if (m3u8Url) break;
    await page.waitForTimeout(2000);
  }
}

console.log('\n═══════════════════════════════════');
console.log('RESULTADO FINAL');
console.log('═══════════════════════════════════');
console.log(`Title: "${await page.title()}"`);
console.log(`Frames: ${page.frames().length}`);
page.frames().forEach((f, i) => console.log(`  ${i}: ${f.url()}`));
console.log(`Legendas: ${subtitles.length}`);
console.log(`M3U8: ${m3u8Url || 'NAO ENCONTRADO'}`);

await browser.close();
