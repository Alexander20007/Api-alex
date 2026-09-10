import { BaseProvider } from './base.js';
import { createBrowser, createContext } from '../utils/browser.js';

const IGNORE_FRAMES = ['dtscout', 'crwdcntrl', 'google', 'doubleclick', 'facebook'];
const PLAYER_PATTERNS = ['cloudorchestranova', 'vsembed', 'embed', 'player'];

export class VidSrcProvider extends BaseProvider {
  constructor() {
    super();
    this.domains = ['vidsrc.in', 'vidsrc.pm'];
  }

  isPlayerFrame(url) {
    if (!url || url === 'about:blank') return false;
    if (IGNORE_FRAMES.some((b) => url.includes(b))) return false;
    return PLAYER_PATTERNS.some((p) => url.includes(p));
  }

  async extract(tmdbId, type, season, episode) {
    const browser = await createBrowser();
    const context = await createContext(browser);
    const page = await context.newPage();

    let m3u8Url = null;
    const subtitles = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.m3u8') && !m3u8Url) {
        console.log(`[+] M3U8: ${url.slice(0, 120)}`);
        m3u8Url = url;
      }
      if ((url.includes('.vtt') || url.includes('.srt')) && !subtitles.includes(url)) {
        subtitles.push(url);
      }
    });

    try {
      for (const domain of this.domains) {
        const embedUrl =
          type === 'movie'
            ? `https://${domain}/embed/movie/${tmdbId}`
            : `https://${domain}/embed/tv/${tmdbId}/${season || 1}/${episode || 1}`;

        console.log(`\n[*] Testando: ${embedUrl}`);

        try {
          await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

          for (let i = 0; i < 8; i++) {
            if (m3u8Url) break;
            await page.waitForTimeout(2000);
          }

          if (m3u8Url) {
            console.log(`\n[+] SUCESSO via ${domain}!`);
            await browser.close();
            return { hlsUrl: m3u8Url, subtitles };
          }

          console.log('[*] Procurando player frame...');
          const frames = page.frames();
          let clicked = false;

          for (const frame of frames) {
            const frameUrl = frame.url();
            if (!this.isPlayerFrame(frameUrl)) continue;

            console.log(`   [*] Tentando clicar em: ${frameUrl.slice(0, 70)}`);

            try {
              const result = await frame.evaluate(() => {
                const el = document.querySelector('video, .play, [class*="play"], button');
                if (el) { el.click(); return el.tagName + '.' + el.className; }
                return null;
              });

              if (result) {
                console.log(`   [+] Cliquei (${result})`);
                clicked = true;
                break;
              } else {
                console.log(`   [!] Nenhum seletor no frame`);
              }
            } catch (e) {
              console.log(`   [!] Erro: ${e.message.split('\n')[0]}`);
            }
          }

          if (clicked || !m3u8Url) {
            console.log('[*] Aguardando m3u8 após clique...');
            for (let i = 0; i < 20; i++) {
              if (m3u8Url) break;
              await page.waitForTimeout(2000);
              console.log(`   ... ${(i + 1) * 2}s`);
            }
          }

          if (m3u8Url) {
            console.log(`\n[+] SUCESSO via ${domain}!`);
            await browser.close();
            return { hlsUrl: m3u8Url, subtitles };
          }
        } catch (e) {
          console.log(`   [!] ${domain}: ${e.message.split('\n')[0]}`);
        }
      }

      return null;
    } finally {
      try { await browser.close(); } catch (_) {}
    }
  }
}
