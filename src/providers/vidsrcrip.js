import { BaseProvider } from './base.js';

const API_URL = 'https://vidsrc.rip';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://vidsrc.rip/',
};

/**
 * Parser manual do window.config (formato não-JSON estrito)
 * Ex: { tmdbId: "550", servers: ["flixhq", "vidsrc"] }
 */
function parseConfig(configString) {
  const content = configString.slice(1, -1).trim();
  const config = {};
  const regex = /(\w+):\s*(?:'([^']*)'|"([^"]*)"|(\[[^\]]*\])|([^,}]+))/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const [, key, singleQuoted, doubleQuoted, arrayValue, unquotedValue] = match;
    let value = singleQuoted || doubleQuoted || unquotedValue;

    if (arrayValue) {
      try {
        value = JSON.parse(arrayValue);
      } catch (_) {
        value = [];
      }
    }

    if (key === 'servers' && typeof value === 'string') {
      value = [value];
    }

    config[key] = value;
  }

  return config;
}

/**
 * XOR encrypt/decrypt (simétrico)
 */
function xorEncryptDecrypt(key, message) {
  const keyCodes = Array.from(key, (c) => c.charCodeAt(0));
  const msgCodes = Array.from(message, (c) => c.charCodeAt(0));

  const result = [];
  for (let i = 0; i < msgCodes.length; i++) {
    result.push(msgCodes[i] ^ keyCodes[i % keyCodes.length]);
  }

  return Buffer.from(result).toString('binary');
}

/**
 * Gera o VRF token a partir do path e da chave
 */
function generateVRF(key, path) {
  const xorResult = xorEncryptDecrypt(key, path);
  return encodeURIComponent(Buffer.from(xorResult, 'binary').toString('base64'));
}

export class VidSrcRipProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'vidsrcrip',
      domain: 'vidsrc.rip',
      endpointPattern: '/embed/{type}/{tmdb_id}',
      playerPatterns: [],
      ignorePatterns: [],
      needsClick: false,
      timeoutMs: 20000,
    };
    this._keyCache = null;
    this._keyCacheTime = 0;
  }

  /**
   * Baixa a "chave" XOR (que está dentro de um PNG falso)
   * Cache de 1 hora para não baixar toda hora
   */
  async getKey() {
    const now = Date.now();
    if (this._keyCache && now - this._keyCacheTime < 3600000) {
      return this._keyCache;
    }

    const url = `${API_URL}/images/skip-button.png`;
    console.log(`[*] VidSrc.rip: baixando chave em ${url}`);

    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(`Key HTTP ${response.status}`);
    }

    // Pega como TEXTO (não como arrayBuffer)
    const key = await response.text();
    this._keyCache = key;
    this._keyCacheTime = now;

    console.log(`[+] VidSrc.rip: chave obtida (${key.length} chars)`);
    return key;
  }

  buildEmbedUrl(tmdbId, type, season, episode) {
    if (type === 'tv' && season && episode) {
      return `${API_URL}/embed/tv/${tmdbId}/${season}/${episode}`;
    }
    return `${API_URL}/embed/movie/${tmdbId}`;
  }

  /**
   * Etapa 1: pega a config (servers disponíveis)
   */
  async getVideoConfig(tmdbId, type, season, episode) {
    const url = this.buildEmbedUrl(tmdbId, type, season, episode);
    console.log(`[*] VidSrc.rip: GET ${url}`);

    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(`Config HTTP ${response.status}`);
    }

    const html = await response.text();

    // Procura window.config = { ... }
    const match = html.match(/window\.config\s*=\s*(\{.*?\});/s);
    if (!match) {
      throw new Error('window.config nao encontrado no HTML');
    }

    const config = parseConfig(match[1]);
    return config;
  }

  /**
   * Etapa 2 + 3: gera VRF e busca stream
   */
  async getStreamUrl(server, tmdbId, type, season, episode) {
    const key = await this.getKey();
    const path = `/api/source/${server}/${tmdbId}`;
    const vrf = generateVRF(key, path);

    let url = `${API_URL}${path}?vrf=${vrf}`;
    if (type === 'tv' && season && episode) {
      url += `&s=${season}&e=${episode}`;
    }

    console.log(`[*] VidSrc.rip: GET ${url.slice(0, 100)}...`);

    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(`Stream HTTP ${response.status}`);
    }

    const data = await response.json();

    // Alguns servidores retornam 500 com erro no JSON
    if (data.error) {
      throw new Error(`Server error: ${data.error}`);
    }

    return data;
  }

  async extract(tmdbId, type, season, episode) {
    // Etapa 1: descobrir servers
    const config = await this.getVideoConfig(tmdbId, type, season, episode);

    const servers = config.servers || [];
    if (servers.length === 0) {
      console.log('[!] VidSrc.rip: nenhum server na config');
      return null;
    }

    console.log(`[+] VidSrc.rip: ${servers.length} server(s): ${servers.join(', ')}`);

    // Etapa 2: tentar cada server
    for (const server of servers) {
      try {
        console.log(`   [*] Tentando server: ${server}`);
        const data = await this.getStreamUrl(server, tmdbId, type, season, episode);

        if (data.sources && data.sources.length > 0) {
          const source = data.sources[0];
          console.log(`   [+] Server ${server}: OK (${source.label || 'unknown'})`);

          return {
            hlsUrl: source.file,
            subtitles: [], // VidSrc.rip não retorna legendas nesse endpoint
          };
        }
      } catch (e) {
        console.log(`   [!] Server ${server} falhou: ${e.message}`);
      }
    }

    console.log('[!] VidSrc.rip: todos os servers falharam');
    return null;
  }
}
