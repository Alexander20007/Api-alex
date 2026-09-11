import 'dotenv/config';
import { createBrowser, createContext } from './src/utils/browser.js';

const browser = await createBrowser();
const context = await createContext(browser);
const page = await context.newPage();

let m3u8Url = null;
const subtitles = [];
const apiCalls = [];

page.on('response', async (r) => {
  const url = r.url();
  const type = r.request().resourceType();
  
  // Loga requisições de API (XHR/Fetch)
  if (type === 'xhr' || type === 'fetch') {
    const contentType = r.headers()['content-type'] || '';
    console.log(`[${type}] ${url.slice(0, 120)}`);
    console.log(`         → ${r.status()} | ${contentType.slice(0, 60)}`);
    
    // Se for JSON, tenta ler
    if (contentType.includes('json')) {
      try {
        const body = await r.text();
        console.log(`         JSON: ${body.slice(0, 200)}`);
        apiCalls.push({ url, body });
      } catch (_) {}
    }
  }
  
  if (url.includes('.m3u8') && !m3u8Url) {
    console.log(`\n[+] 🎯 M3U8 ENCONTRADO: ${url}\n`);
    m3u8Url = url;
  }
  
  if ((url.includes('.vtt') || url.includes('.srt')) && !subtitles.includes(url)) {
    subtitles.push(url);
    console.log(`[+] 📝 Legenda: ${url}`);
  }
});

console.log('[*] Abrindo playerflix.ink/filme/tt22084616...\n');

await page.goto('https://playerflix.ink/filme/tt22084616', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

// Espera 40s
for (let i = 0; i < 20; i++) {
  if (m3u8Url) break;
  await page.waitForTimeout(2000);
}

console.log('\n════════════════════════════════════════════');
console.log('  RESULTADO FINAL');
console.log('════════════════════════════════════════════');
console.log(`Title: ${await page.title()}`);
console.log(`Total frames: ${page.frames().length}`);
page.frames().forEach((f, i) => console.log(`  ${i}: ${f.url().slice(0, 100)}`));
console.log(`\nLegendas: ${subtitles.length}`);
subtitles.forEach(s => console.log(`  ${s}`));
console.log(`\nM3U8: ${m3u8Url || 'NAO ENCONTRADO'}`);

await browser.close();
