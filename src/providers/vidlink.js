import { BaseProvider } from './base.js';
import { createBrowser, createContext } from '../utils/browser.js';

export class VidLinkProvider extends BaseProvider {
  constructor() {
    super();
    this.config = {
      name: 'vidlink',
      domain: 'vidlink.pro',
      endpointPattern: '/api/vidlink/watch',
      playerPatterns: ['vidlink', 'player'],
      ignorePatterns: ['dtscout', 'crwdcntrl', 'google'],
      needsClick: false,
      timeoutMs: 40000,
    };
  }

  async extract(tmdbId, type, season, episode) {
    // TODO: implementar fluxo do VidLink
    // 1. Descriptografar AES-256-CBC do ID
    // 2. Chamar /api/vidlink/watch?isMovie=X&id=Y
    // 3. Retornar URL do stream
    return null;
  }
}
