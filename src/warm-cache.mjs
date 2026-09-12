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

// =====================================================
// CONFIGURACAO OTIMIZADA PARA RENDER FREE (512 MB)
// =====================================================
const MAX_ITENS_POR_EXECUCAO = 40;   // TOTAL de itens por execucao (era 300+)
const DELAY_MS = 3000;                // pausa maior entre itens
const DELAY_ENTRE_CATEGORIAS_MS = 5000;

const CATEGORIAS_FILMES = [
  { nome: 'Trending Dia', fn: () => getTrendingMovies('day'), max: 5 },
  { nome: 'Trending Semana', fn: () => getTrendingMovies('week'), max: 4 },
  { nome: 'Populares', fn: getPopularMovies, max: 5 },
  { nome: 'Top Rated', fn: getTopRatedMovies, max: 4 },
  { nome: 'Em Cartaz', fn: getNowPlayingMovies, max: 3 },
  { nome: 'Em Breve', fn: getUpcomingMovies, max: 3 },
  { nome: 'Acao', fn: getActionMovies, max: 3 },
  { nome: 'Comedia', fn: getComedyMovies, max: 3 },
  { nome: 'Familia', fn: getFamilyMovies, max: 3 },
  { nome: 'Animacao', fn: getAnimationMovies, max: 3 },
  { nome: 'Suspense', fn: getThrillerMovies, max: 3 },
  { nome: 'Terror', fn: getHorrorMovies, max: 2 },
];

const CATEGORIAS_SERIES = [
  { nome: 'Series Trending', fn: () => getTrendingTvShows('day'), max: 3 },
  { nome: 'Series Populares', fn: getPopularTvShows, max: 3 },
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
  console.log('  🔥 WARM CACHE (modo econômico - Render free)');
  console.log('════════════════════════════════════════════');
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log(`  Max itens por execucao: ${MAX_ITENS_POR_EXECUCAO}`);
  console.log('');

  const inicio = Date.now();
  const stats = { success: 0, skipped: 0, fail: 0, total: 0 };
  const idsProcessados = new Set();

  // FILMES
  for (const cat of CATEGORIAS_FILMES) {
    if (stats.total >= MAX_ITENS_POR_EXECUCAO) break;
    console.log(`\n📂 ${cat.nome}`);
    let filmes = [];
    try { filmes = await cat.fn(); } catch (e) { console.log(`  ⚠️ ${e.message}`); continue; }
    
    let processados = 0;
    for (const filme of filmes) {
      if (processados >= cat.max) break;
      if (stats.total >= MAX_ITENS_POR_EXECUCAO) break;
      if (idsProcessados.has(`movie-${filme.id}`)) continue;

      idsProcessados.add(`movie-${filme.id}`);
      const r = await warmItem(filme.id, 'movie');
      stats[r]++; stats.total++; processados++;

      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
    console.log(`  → ${processados} processados | Total: ${stats.total}/${MAX_ITENS_POR_EXECUCAO}`);
    await new Promise((res) => setTimeout(res, DELAY_ENTRE_CATEGORIAS_MS));
  }

  // SERIES
  for (const cat of CATEGORIAS_SERIES) {
    if (stats.total >= MAX_ITENS_POR_EXECUCAO) break;
    console.log(`\n📺 ${cat.nome}`);
    let series = [];
    try { series = await cat.fn(); } catch (e) { console.log(`  ⚠️ ${e.message}`); continue; }
    
    let processados = 0;
    for (const serie of series) {
      if (processados >= cat.max) break;
      if (stats.total >= MAX_ITENS_POR_EXECUCAO) break;
      if (idsProcessados.has(`tv-${serie.id}`)) continue;

      idsProcessados.add(`tv-${serie.id}`);
      const r = await warmItem(serie.id, 'tv', 1, 1);
      stats[r]++; stats.total++; processados++;

      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
    console.log(`  → ${processados} processados | Total: ${stats.total}/${MAX_ITENS_POR_EXECUCAO}`);
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
