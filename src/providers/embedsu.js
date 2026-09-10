import { BaseProvider } from './base.js';

const API_URL = 'https://embed.su';

/**
 * Decodifica o hash "double-base64-reversed" do Embed.su
 */
function decodeHash(hash) {
  // Camada 1: base64 decode + reverse de cada parte separada por "."
  const firstDecode = Buffer
    .from(hash, 'base64')
    .toString()
    .split('.')
    .map((item) => item.split('').reverse().join(''))
    .join('');

  // Camada 2: reverse do todo + base64 decode
  const reversed = firstDecode.split('').reverse().join('');
  const secondDecode = JSON.parse(Buffer.from(reversed, 'base64').toString());

  return secondDecode;
}

export class EmbedSuProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'embedsu',
      domain: 'embed.su',
      endpointPattern: '/embed/{type}/{tmdb_id}',
      playerPatterns: [],
      ignorePatterns: [],
      needsClick: false,
      timeoutMs: 15000,
    };
  }

  buildEmbedUrl(tmdbId, type, season, episode) {
    if (type === 'tv' && season && episode) {
      return `${API_URL}/embed/tv/${tmdbId}/${season}/${episode}`;
    }
    return `${API_URL}/embed/movie/${tmdbId}`;
  }

  /**
   * Etapa 1: pega os detalhes (servers) do vídeo
   */
  async getVideoDetails(tmdbId, type, season, episode) {
    const url = this.buildEmbedUrl(tmdbId, type, season, episode);
    console.log(`[*] Embed.su: buscando detalhes em ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extrai: window.vConfig = JSON.parse(atob('...'))
    const match = html.match(/window\.vConfig\s*=\s*JSON\.parse\(atob\(`(.+?)`\)\)/);
    if (!match || !match[1]) {
      throw new Error('vConfig nao encontrado no HTML');
    }

    const decodedData = JSON.parse(Buffer.from(match[1], 'base64').toString());

    // Decodifica o hash para obter servers
    const serversDecoded = decodeHash(decodedData.hash);
    const servers = serversDecoded.map((s) => ({ name: s.name, hash: s.hash }));

    return { ...decodedData, servers };
  }

  /**
   * Etapa 2: pega a URL do stream a partir do hash do server
   */
  async getStreamUrl(hash) {
    const url = `${API_URL}/api/e/${hash}`;
    console.log(`[*] Embed.su: buscando stream em ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': `${API_URL}/`,
      },
    });

    if (response.status === 404) {
      const data = await response.json();
      throw new Error(`Stream nao encontrado: ${data.error || '404'}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async extract(tmdbId, type, season, episode) {
    // Etapa 1: detalhes
    const details = await this.getVideoDetails(tmdbId, type, season, episode);

    if (!details.servers || details.servers.length === 0) {
      console.log('[!] Embed.su: nenhum server encontrado');
      return null;
    }

    console.log(`[+] Embed.su: ${details.servers.length} server(s): ${details.servers.map(s => s.name).join(', ')}`);

    // Etapa 2: tenta cada server até achar um stream válido
    for (const server of details.servers) {
      try {
        console.log(`   [*] Tentando server: ${server.name}`);
        const stream = await this.getStreamUrl(server.hash);

        if (stream.source) {
          console.log(`   [+] Server ${server.name}: OK`);

          // Formata legendas para array de URLs
          const subtitles = (stream.subtitles || []).map((s) => s.file);

          return {
            hlsUrl: stream.source,
            subtitles,
          };
        }
      } catch (e) {
        console.log(`   [!] Server ${server.name} falhou: ${e.message}`);
        // Continua para o próximo server
      }
    }

    console.log('[!] Embed.su: todos os servers falharam');
    return null;
  }
}
