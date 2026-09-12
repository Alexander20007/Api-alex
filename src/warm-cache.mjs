import 'dotenv/config';
import { getFromCache } from './utils/supabase.js';
import { extractStream } from './orchestrator.js';
import {
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  getActionMovies,
  getAdventureMovies,
  getAnimationMovies,
  getComedyMovies,
  getCrimeMovies,
  getDramaMovies,
  getFamilyMovies,
  getFantasyMovies,
  getHorrorMovies,
  getMysteryMovies,
  getRomanceMovies,
  getSciFiMovies,
  getThrillerMovies,
  getWarMovies,
  getWesternMovies,
  getFamilyAnimationMovies,
  getMoviesByYear,
  getPortugueseMovies,
  getTrendingTvShows,
  getPopularTvShows,
  getTopRatedTvShows,
  getOnTheAirTvShows,
} from './utils/tmdb.js';

// =====================================================
// CATEGORIAS DE FILMES
// =====================================================
const CATEGORIAS_FILMES = [
  { nome: 'Trending', fn: getTrendingMovies, max: 10 },
  { nome: 'Populares', fn: getPopularMovies, max: 10 },
  { nome: 'Top Rated', fn: getTopRatedMovies, max: 10 },
  { nome: 'Em Cartaz', fn: getNowPlayingMovies, max: 8 },
  { nome: 'Proximos', fn: getUpcomingMovies, max: 8 },
  { nome: 'Acao', fn: getActionMovies, max: 8 },
  { nome: 'Aventura', fn: getAdventureMovies, max: 6 },
  { nome: 'Comedia', fn: getComedyMovies, max: 8 },
  { nome: 'Crime', fn: getCrimeMovies, max: 6 },
  { nome: 'Drama', fn: getDramaMovies, max: 8 },
  { nome: 'Familia', fn: getFamilyMovies, max: 8 },
  { nome: 'Animacao', fn: getAnimationMovies, max: 8 },
  { nome: 'Familia+Animacao', fn: getFamilyAnimationMovies, max: 6 },
  { nome: 'Fantasia', fn: getFantasyMovies, max: 5 },
  { nome: 'Terror', fn: getHorrorMovies, max: 5 },
  { nome: 'Misterio', fn: getMysteryMovies, max: 5 },
  { nome: 'Romance', fn: getRomanceMovies, max: 5 },
  { nome: 'Ficcao', fn: getSciFiMovies, max: 6 },
  { nome: 'Suspense', fn: getThrillerMovies, max: 8 },
  { nome: 'Guerra', fn: getWarMovies, max: 3 },
  { nome: 'Faroeste', fn: getWesternMovies, max: 3 },
  { nome: 'Portugueses', fn: getPortugueseMovies, max: 5 },
];

// =====================================================
// CATEGORIAS DE SERIES
// =====================================================
const CATEGORIAS_SERIES = [
  { nome: 'Series Trending', fn: getTrendingTvShows, max: 8 },
  { nome: 'Series Populares', fn: getPopularTvShows, max: 8 },
  { nome: 'Series Top Rated', fn: getTopRatedTvShows, max: 6 },
  { nome: 'Series No Ar', fn: getOnTheAirTvShows, max: 6 },
];

const DELAY_MS = 2000;

async function warmItem(tmdbId, type, season = null, episode = null) {
  const chave = `[${type}] ${tmdbId}${season ? ` T${season}E${episode}` : ''}`;

  const cached = await getFromCache(tmdbId, type, season, episode);
  if (cached) {
    console.log(`  ⚡ ${chave} → ja em cache`);
    return 'skipped';
  }

  console.log(`  🔍 ${chave} → extraindo...`);
  const inicio = Date.now();

  try {
    const result = await extractStream(tmdbId, type, season, episode);
    const tempo = Date.now() - inicio;

    if (result.success) {
      console.log(`  ✅ ${chave} → OK em ${tempo}ms (${result.provider})`);
      return 'success';
    } else {
      console.log(`  ❌ ${chave} → falhou em ${tempo}ms`);
      return 'fail';
    }
  } catch (err) {
    console.log(`  ❌ ${chave} → erro: ${err.message}`);
    return 'fail';
  }
}

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  🔥 WARM CACHE MEGA - Todas as categorias');
  console.log('════════════════════════════════════════════');
  console.log(`  Data: ${new Date().toISOString()}\n`);

  const inicio = Date.now();
  const stats = { success: 0, skipped: 0, fail: 0, total: 0 };
  const idsProcessados = new Set();

  // FILMES
  for (const cat of CATEGORIAS_FILMES) {
    console.log(`\n📂 ${cat.nome}`);
    const filmes = await cat.fn();

    let processados = 0;
    for (const filme of filmes) {
      if (processados >= cat.max) break;
      if (idsProcessados.has(`movie-${filme.id}`)) continue;

      idsProcessados.add(`movie-${filme.id}`);
      const r = await warmItem(filme.id, 'movie');
      stats[r]++;
      stats.total++;
      processados++;

      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
  }

  // SERIES
  for (const cat of CATEGORIAS_SERIES) {
    console.log(`\n📺 ${cat.nome}`);
    const series = await cat.fn();

    let processados = 0;
    for (const serie of series) {
      if (processados >= cat.max) break;
      if (idsProcessados.has(`tv-${serie.id}`)) continue;

      idsProcessados.add(`tv-${serie.id}`);
      const r = await warmItem(serie.id, 'tv', 1, 1);
      stats[r]++;
      stats.total++;
      processados++;

      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
  }

  const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log('\n════════════════════════════════════════════');
  console.log('  📊 RESUMO FINAL');
  console.log('════════════════════════════════════════════');
  console.log(`  ✅ Sucessos:   ${stats.success}`);
  console.log(`  ⚡ Ja em cache: ${stats.skipped}`);
  console.log(`  ❌ Falhas:     ${stats.fail}`);
  console.log(`  📦 Total:      ${stats.total}`);
  console.log(`  ⏱️ Tempo:      ${tempoTotal}s`);
  console.log('════════════════════════════════════════════');
}

main().catch(console.error);
