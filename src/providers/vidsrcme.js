import { BaseProvider } from './base.js';
import { createBrowser, createContext } from '../utils/browser.js';

export class VidSrcMeProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'vidsrcme',
      domain: 'vidsrcme.ru',
      endpointPattern: '/embed/movie/{imdb_id}',
      playerPatterns: ['cloudorchestranova', 'edn', 'jw', 'player'],
      ignorePatterns: ['dtscout', 'crwdcntrl', 'google', 'doubleclick'],
      needsClick: true,
      timeoutMs: 120000,
    };
  }

  async extract(tmdbId, type, season, episode) {
    const videoId = tmdbId;
    const urlType = type === 'tv' ? 'tv' : 'movie';

    const browser = await createBrowser();
    const context = await createContext(browser);
    const page = await context.newPage();

    let m3u8Url = null;
    const subtitles = [];
    const inicio = Date.now();

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.m3u8') && !m3u8Url) {
        const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
        console.log(`[+] vidsrcme M3U8 (${tempo}s): ${url.slice(0, 120)}...`);
        m3u8Url = url;
      }
      if ((url.includes('.vtt') || url.includes('.srt')) && !subtitles.includes(url)) {
        subtitles.push(url);
      }
    });

    try {
      let embedUrl;
      if (urlType === 'tv' && season && episode) {
        embedUrl = `https://vidsrcme.ru/embed/tv/${videoId}/${season}/${episode}`;
      } else {
        embedUrl = `https://vidsrcme.ru/embed/movie/${videoId}`;
      }

      console.log(`[*] vidsrcme: navegando ${embedUrl}`);
      await page.goto(embedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      console.log('[*] vidsrcme: aguardando player (20s)...');
      for (let i = 0; i < 10; i++) {
        if (m3u8Url) break;
        await page.waitForTimeout(2000);
      }

      if (!m3u8Url) {
        console.log('[*] vidsrcme: clicando no #bigPlay...');
        const frames = page.frames();
        for (const frame of frames) {
          try {
            const clicked = await frame.evaluate(() => {
              const selectors = [
                '#bigPlay', '.jw-bigplay', '.jw-icon-playback',
                'button[aria-label="Play"]', '[class*="play" i]', 'video',
              ];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) { el.click(); return sel; }
              }
              return null;
            });
            if (clicked) console.log(`   [+] Cliquei (${clicked})`);
          } catch (_) {}
        }

        console.log('[*] vidsrcme: aguardando m3u8 (até 80s)...');
        for (let i = 0; i < 40; i++) {
          if (m3u8Url) break;
          await page.waitForTimeout(2000);
          if (i % 5 === 0) console.log(`   ... ${(i + 1) * 2}s`);
        }
      }

      const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(1);

      const cookies = await context.cookies();
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      console.log(`[+] vidsrcme: ${cookies.length} cookies capturados`);

      if (m3u8Url) {
        console.log(`[+] vidsrcme: SUCESSO em ${tempoTotal}s`);
        await browser.close();
        return { hlsUrl: m3u8Url, subtitles, cookies: cookieStr };
      }

      console.log(`[-] vidsrcme: m3u8 não encontrado após ${tempoTotal}s`);
      return null;
    } finally {
      try { await browser.close(); } catch (_) {}
    }
  }
}
