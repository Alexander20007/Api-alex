import { BaseProvider } from './base.js';
import { createBrowser, createContext } from '../utils/browser.js';

export class VidSrcMeProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'vidsrcme',
      domain: 'vidsrcme.ru',
      endpointPattern: '/embed/movie/{imdb_id}',
      playerPatterns: ['cloudorchestranova', 'edn', 'player'],
      ignorePatterns: ['dtscout', 'crwdcntrl', 'google', 'doubleclick'],
      needsClick: true,
      timeoutMs: 60000,
    };
  }

  async extract(tmdbId, type, season, episode, imdbId = null) {
    // Se não tem IMDB ID, tenta usar TMDB ID mesmo
    const videoId = imdbId || tmdbId;
    const urlType = type === 'tv' ? 'tv' : 'movie';

    const browser = await createBrowser();
    const context = await createContext(browser);
    const page = await context.newPage();

    let m3u8Url = null;
    const subtitles = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.m3u8') && !m3u8Url) {
        console.log(`[+] 🎯 M3U8 CAPTURADO: ${url.slice(0, 120)}...`);
        m3u8Url = url;
      }
      if ((url.includes('.vtt') || url.includes('.srt')) && !subtitles.includes(url)) {
        subtitles.push(url);
      }
    });

    try {
      // Monta a URL
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

      // Espera 15s pro player carregar
      for (let i = 0; i < 8; i++) {
        if (m3u8Url) break;
        await page.waitForTimeout(2000);
      }

      // Se não capturou, clica no #bigPlay
      if (!m3u8Url) {
        console.log('[*] vidsrcme: clicando no #bigPlay...');
        try {
          await page.evaluate(() => {
            const btn = document.querySelector('#bigPlay, .jw-bigplay, .jw-icon-playback, button[aria-label="Play"]');
            if (btn) btn.click();
          });
        } catch (e) {
          console.log(`[!] Erro ao clicar: ${e.message}`);
        }

        // Espera mais 30s
        for (let i = 0; i < 15; i++) {
          if (m3u8Url) break;
          await page.waitForTimeout(2000);
        }
      }

      if (m3u8Url) {
        console.log(`[+] vidsrcme: SUCESSO`);
        await browser.close();
        return { hlsUrl: m3u8Url, subtitles };
      }

      console.log('[-] vidsrcme: m3u8 não encontrado');
      return null;
    } finally {
      try { await browser.close(); } catch (_) {}
    }
  }
}
