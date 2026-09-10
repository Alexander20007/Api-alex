export class BaseProvider {
  async extract(tmdbId, type, season, episode) {
    throw new Error('Método extract() não implementado');
  }
}
