import { getFromCache } from './utils/supabase.js';
import { extractStream } from './orchestrator.js';
import {
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getActionMovies,
  getComedyMovies,
  getFamilyMovies,
  getAnimationMovies,
  getThrillerMovies,
  getTrendingTvShows,
  getPopularTvShows,
} from './utils/tmdb.js';

const CATEGORIAS = [
  { nome: 'Trending', fn: getTrendingMovies, max: 10 },
  { nome: 'Populares', fn: getPopularMovies, max: 10 },
  { nome: 'Top Rated', fn: getTopRatedMovies, max: 10 },
  { nome: 'Acao', fn: getActionMovies, max: 8 },
  { nome: 'Comedia', fn: getComedyMovies, max: 8 },
  { nome: 'Familia', fn: getFamilyMovies, max: 8 },
  { nome: 'Animacao', fn: getAnimationMovies, max: 8 },
  { nome: 'Suspense', fn: getThrillerMovies, max: 8 },
];

const CATEGORIAS_SERIES = [
  { nome: 'Series Trending', fn: getTrendingTvShows, max: 8 },
  { nome: 'Series Populares', fn: getPopularTvShows, max: 8 },
];

const DELAY_MS = 2000;

async function warmItem(tmdbId, type, season = null, episode = null) {
  const cached = await getFromCache(tmdbId, type, season, episode);
  if (cached) return 'skipped';

  try {
    const result = await extractStream(tmdbId, type, season, episode);
    return result.success ? 'success' : 'fail';
  } catch {
    return 'fail';
  }
}

export default async function runWarmCache() {
  console.log('[WARM-CACHE] Iniciando...');
  const inicio = Date.now();
  const stats = { success: 0, skipped: 0, fail: 0 };
  const ids = new Set();

  for (const cat of CATEGORIAS) {
    const filmes = await cat.fn();
    let n = 0;
    for (const f of filmes) {
      if (n >= cat.max) break;
      if (ids.has(`movie-${f.id}`)) continue;
      ids.add(`movie-${f.id}`);
      const r = await warmItem(f.id, 'movie');
      stats[r]++;
      n++;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  for (const cat of CATEGORIAS_SERIES) {
    const series = await cat.fn();
    let n = 0;
    for (const s of series) {
      if (n >= cat.max) break;
      if (ids.has(`tv-${s.id}`)) continue;
      ids.add(`tv-${s.id}`);
      const r = await warmItem(s.id, 'tv', 1, 1);
      stats[r]++;
      n++;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`[WARM-CACHE] Finalizado em ${tempo}s`);
  console.log(`[WARM-CACHE] ✅ ${stats.success} | ⚡ ${stats.skipped} | ❌ ${stats.fail}`);
}
