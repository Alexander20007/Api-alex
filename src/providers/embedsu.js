import { BaseProvider } from './base.js';
import { createBrowser, createContext } from '../utils/browser.js';

export class EmbedSuProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'embedsu',
      domain: 'embed.su',
      endpointPattern: '/embed/{type}/{tmdb_id}',
      playerPatterns: ['embed.su', 'player', 'embed'],
      ignorePatterns: ['dtscout', 'crwdcntrl', 'google', 'doubleclick'],
      needsClick: true,
      timeoutMs: 40000,
    };
  }

  async extract(tmdbId, type, season, episode) {
    // TODO: implementar fluxo do Embed.su
    // 1. Chamar API interna para obter o hash do servidor
    // 2. Usar hash para montar URL do stream
    // 3. Ou interceptar m3u8 no navegador
    return null;
  }
}
