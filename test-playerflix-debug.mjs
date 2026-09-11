import 'dotenv/config';
import { createBrowser, createContext } from './src/utils/browser.js';

const browser = await createBrowser();
const context = await createContext(browser);
const page = await context.newPage();

// LOG DE TUDO
page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error' || type === 'warning' || text.length < 200) {
    console.log(`[${type}] ${text}`);
  }
});

page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));

page.on('requestfailed', (req) => {
  console.log(`[FAILED] ${req.url().slice(0, 100)} - ${req.failure()?.errorText}`);
});

page.on('response', (r) => {
  const url = r.url();
  const status = r.status();
  const type = r.request().resourceType();
  if (status >= 400 || type === 'xhr' || type === 'fetch' || type === 'script') {
    console.log(`[${status}] [${type}] ${url.slice(0, 120)}`);
  }
});

console.log('[*] Abrindo playerflix.ink...\n');
await page.goto('https://playerflix.ink/filme/tt22084616', {
  waitUntil: 'networkidle',   // ← espera a rede parar
  timeout: 60000,
});

console.log(`\n[+] Título: "${await page.title()}"`);
console.log(`[+] URL atual: ${page.url()}`);

// Ver o HTML atual
const html = await page.content();
console.log(`[+] Tamanho do HTML: ${html.length} bytes`);

// Procura erros no console
const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
console.log(`\n[+] Texto visível na página:\n${bodyText}`);

// Salva HTML completo
import { writeFileSync } from 'fs';
writeFileSync('/tmp/playerflix_rendered.html', html);
console.log(`\n[+] HTML salvo em /tmp/playerflix_rendered.html`);

await browser.close();
