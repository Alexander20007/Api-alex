import { BaseProvider } from './base.js';
import { createBrowser, createContext } from '../utils/browser.js';

export class VidSrcProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'vidsrc',
      domain: 'vidsrc.in',
      endpointPattern: '/embed/{type}/{tmdb_id}',
      playerPatterns: ['cloudorchestranova', 'vsembed', 'embed', 'player'],
      ignorePatterns: ['dtscout', 'crwdcntrl', 'google', 'doubleclick', 'facebook'],
      needsClick: true,
      timeoutMs: 40000,
    };
  }

  isPlayerFrame(url) {
    if (!url || url === 'about:blank') return false;
    if (this.config.ignorePatterns.some((b) => url.includes(b))) return false;
    return this.config.playerPatterns.some((p) => url.includes(p));
  }

  buildEmbedUrl(tmdbId, type, season, episode) {
    const domain = this.config.domain;
    const urlType = type === 'tv' ? 'tv' : 'movie';

    if (urlType === 'tv') {
      return `https://${domain}/embed/tv/${tmdbId}/${season || 1}/${episode || 1}`;
    }
    return `https://${domain}/embed/movie/${tmdbId}`;
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
      const embedUrl = this.buildEmbedUrl(tmdbId, type, season, episode);
      console.log(`[*] Navegando: ${embedUrl}`);

      await page.goto(embedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      for (let i = 0; i < 8; i++) {
        if (m3u8Url) break;
        await page.waitForTimeout(2000);
      }

      if (m3u8Url) {
        await browser.close();
        return { hlsUrl: m3u8Url, subtitles };
      }

      if (this.config.needsClick) {
        console.log('[*] Procurando player frame para clicar...');
        const frames = page.frames();

        for (const frame of frames) {
          const frameUrl = frame.url();
          if (!this.isPlayerFrame(frameUrl)) continue;

          console.log(`   [*] Tentando: ${frameUrl.slice(0, 70)}`);

          try {
            const result = await frame.evaluate(() => {
              const el = document.querySelector('video, .play, [class*="play"], button');
              if (el) { el.click(); return el.tagName + '.' + el.className; }
              return null;
            });

            if (result) {
              console.log(`   [+] Cliquei (${result})`);
              break;
            }
          } catch (e) {
            console.log(`   [!] ${e.message.split('\n')[0]}`);
          }
        }

        console.log('[*] Aguardando m3u8...');
        for (let i = 0; i < 20; i++) {
          if (m3u8Url) break;
          await page.waitForTimeout(2000);
        }
      }

      if (m3u8Url) {
        await browser.close();
        return { hlsUrl: m3u8Url, subtitles };
      }

      return null;
    } finally {
      try { await browser.close(); } catch (_) {}
    }
  }
}
