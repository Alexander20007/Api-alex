import 'dotenv/config';
import { getFromCache } from './utils/supabase.js';
import { extractStream } from './orchestrator.js';
import {
  getTrendingMovies, getPopularMovies, getTopRatedMovies,
  getNowPlayingMovies, getUpcomingMovies, getActionMovies,
  getAdventureMovies, getAnimationMovies, getComedyMovies,
  getCrimeMovies, getDocumentaryMovies, getDramaMovies,
  getFamilyMovies, getFantasyMovies, getHistoryMovies,
  getHorrorMovies, getMusicMovies, getMysteryMovies,
  getRomanceMovies, getSciFiMovies, getThrillerMovies,
  getWarMovies, getWesternMovies, getFamilyAnimationMovies,
  getPortugueseMovies, getMoviesByYear,
  getTrendingTvShows, getPopularTvShows,
  getTopRatedTvShows, getOnTheAirTvShows,
} from './utils/tmdb.js';

const ITENS_POR_CATEGORIA = 20;
const SERIES_POR_CATEGORIA = 15;
const DELAY_MS = 1500;

const CATEGORIAS_FILMES = [
  { nome: 'Trending Dia', fn: () => getTrendingMovies('day'), max: ITENS_POR_CATEGORIA },
  { nome: 'Trending Semana', fn: () => getTrendingMovies('week'), max: ITENS_POR_CATEGORIA },
  { nome: 'Populares', fn: getPopularMovies, max: ITENS_POR_CATEGORIA },
  { nome: 'Top Rated', fn: getTopRatedMovies, max: ITENS_POR_CATEGORIA },
  { nome: 'Em Cartaz', fn: getNowPlayingMovies, max: ITENS_POR_CATEGORIA },
  { nome: 'Em Breve', fn: getUpcomingMovies, max: ITENS_POR_CATEGORIA },
  { nome: 'Acao', fn: getActionMovies, max: 15 },
  { nome: 'Aventura', fn: getAdventureMovies, max: 15 },
  { nome: 'Animacao', fn: getAnimationMovies, max: 15 },
  { nome: 'Comedia', fn: getComedyMovies, max: 15 },
  { nome: 'Crime', fn: getCrimeMovies, max: 10 },
  { nome: 'Documentario', fn: getDocumentaryMovies, max: 5 },
  { nome: 'Drama', fn: getDramaMovies, max: 15 },
  { nome: 'Familia', fn: getFamilyMovies, max: 15 },
  { nome: 'Fantasia', fn: getFantasyMovies, max: 10 },
  { nome: 'Historia', fn: getHistoryMovies, max: 5 },
  { nome: 'Terror', fn: getHorrorMovies, max: 10 },
  { nome: 'Musica', fn: getMusicMovies, max: 5 },
  { nome: 'Misterio', fn: getMysteryMovies, max: 10 },
  { nome: 'Romance', fn: getRomanceMovies, max: 10 },
  { nome: 'Ficcao', fn: getSciFiMovies, max: 10 },
  { nome: 'Suspense', fn: getThrillerMovies, max: 15 },
  { nome: 'Guerra', fn: getWarMovies, max: 5 },
  { nome: 'Faroeste', fn: getWesternMovies, max: 5 },
  { nome: 'Familia+Animacao', fn: getFamilyAnimationMovies, max: 10 },
  { nome: 'Portugueses', fn: getPortugueseMovies, max: 10 },
  { nome: '2026', fn: () => getMoviesByYear(2026), max: 15 },
  { nome: '2025', fn: () => getMoviesByYear(2025), max: 15 },
  { nome: '2024', fn: () => getMoviesByYear(2024), max: 15 },
  { nome: '2023', fn: () => getMoviesByYear(2023), max: 15 },
  { nome: '2022', fn: () => getMoviesByYear(2022), max: 10 },
  { nome: '2020', fn: () => getMoviesByYear(2020), max: 10 },
  { nome: '2015', fn: () => getMoviesByYear(2015), max: 10 },
  { nome: '2010', fn: () => getMoviesByYear(2010), max: 10 },
  { nome: '2005', fn: () => getMoviesByYear(2005), max: 5 },
  { nome: '2000', fn: () => getMoviesByYear(2000), max: 5 },
];

const CATEGORIAS_SERIES = [
  { nome: 'Series Trending', fn: () => getTrendingTvShows('day'), max: SERIES_POR_CATEGORIA },
  { nome: 'Series Trending Semana', fn: () => getTrendingTvShows('week'), max: SERIES_POR_CATEGORIA },
  { nome: 'Series Populares', fn: getPopularTvShows, max: SERIES_POR_CATEGORIA },
  { nome: 'Series Top Rated', fn: getTopRatedTvShows, max: SERIES_POR_CATEGORIA },
  { nome: 'Series No Ar', fn: getOnTheAirTvShows, max: SERIES_POR_CATEGORIA },
];

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
  console.log('  🔥 WARM CACHE MEGA ULTRA');
  console.log('════════════════════════════════════════════');
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log(`  Categorias filmes: ${CATEGORIAS_FILMES.length}`);
  console.log(`  Categorias series: ${CATEGORIAS_SERIES.length}`);
  console.log('');

  const inicio = Date.now();
  const stats = { success: 0, skipped: 0, fail: 0, total: 0 };
  const idsProcessados = new Set();

  for (const cat of CATEGORIAS_FILMES) {
    console.log(`\n📂 ${cat.nome}`);
    let filmes = [];
    try { filmes = await cat.fn(); } catch (e) { console.log(`  ⚠️ ${e.message}`); continue; }
    let processados = 0;
    for (const filme of filmes) {
      if (processados >= cat.max) break;
      if (idsProcessados.has(`movie-${filme.id}`)) continue;
      idsProcessados.add(`movie-${filme.id}`);
      const r = await warmItem(filme.id, 'movie');
      stats[r]++; stats.total++; processados++;
      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
    console.log(`  → ${processados} processados`);
  }

  for (const cat of CATEGORIAS_SERIES) {
    console.log(`\n📺 ${cat.nome}`);
    let series = [];
    try { series = await cat.fn(); } catch (e) { console.log(`  ⚠️ ${e.message}`); continue; }
    let processados = 0;
    for (const serie of series) {
      if (processados >= cat.max) break;
      if (idsProcessados.has(`tv-${serie.id}`)) continue;
      idsProcessados.add(`tv-${serie.id}`);
      const r = await warmItem(serie.id, 'tv', 1, 1);
      stats[r]++; stats.total++; processados++;
      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
    console.log(`  → ${processados} processados`);
  }

  const t = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log('\n════════════════════════════════════════════');
  console.log('  📊 RESUMO');
  console.log('════════════════════════════════════════════');
  console.log(`  ✅ ${stats.success} | ⚡ ${stats.skipped} | ❌ ${stats.fail} | 📦 ${stats.total}`);
  console.log(`  ⏱️ ${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`);
  console.log('════════════════════════════════════════════');
}

main().catch(console.error);
