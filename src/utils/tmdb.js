import 'dotenv/config';
import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function tmdbGet(path, params = {}) {
  try {
    const res = await axios.get(`${TMDB_BASE}${path}`, {
      params: { api_key: TMDB_API_KEY, language: 'pt-BR', ...params },
      timeout: 10000,
    });
    return res.data.results || [];
  } catch (err) {
    console.error(`[TMDB] Erro ${path}:`, err.message);
    return [];
  }
}

// =====================================================
// TRENDING
// =====================================================
export async function getTrendingMovies(period = 'day') {
  const r = await tmdbGet(`/trending/movie/${period}`);
  return r.map((m) => ({ id: m.id, title: m.title }));
}

export async function getTrendingTvShows(period = 'day') {
  const r = await tmdbGet(`/trending/tv/${period}`);
  return r.map((m) => ({ id: m.id, title: m.name }));
}

// =====================================================
// POPULAR / TOP RATED / NOVIDADES
// =====================================================
export async function getPopularMovies(page = 1) {
  const r = await tmdbGet('/movie/popular', { page });
  return r.map((m) => ({ id: m.id, title: m.title }));
}

export async function getTopRatedMovies(page = 1) {
  const r = await tmdbGet('/movie/top_rated', { page });
  return r.map((m) => ({ id: m.id, title: m.title }));
}

export async function getNowPlayingMovies() {
  const r = await tmdbGet('/movie/now_playing');
  return r.map((m) => ({ id: m.id, title: m.title }));
}

export async function getUpcomingMovies() {
  const r = await tmdbGet('/movie/upcoming');
  return r.map((m) => ({ id: m.id, title: m.title }));
}

export async function getPopularTvShows(page = 1) {
  const r = await tmdbGet('/tv/popular', { page });
  return r.map((m) => ({ id: m.id, title: m.name }));
}

export async function getTopRatedTvShows(page = 1) {
  const r = await tmdbGet('/tv/top_rated', { page });
  return r.map((m) => ({ id: m.id, title: m.name }));
}

export async function getOnTheAirTvShows() {
  const r = await tmdbGet('/tv/on_the_air');
  return r.map((m) => ({ id: m.id, title: m.name }));
}

// =====================================================
// POR GENERO (todos os principais)
// =====================================================
const GENRES = {
  28: 'acao',
  12: 'aventura',
  16: 'animacao',
  35: 'comedia',
  80: 'crime',
  99: 'documentario',
  18: 'drama',
  10751: 'familia',
  14: 'fantasia',
  36: 'historia',
  27: 'terror',
  10402: 'musica',
  9648: 'misterio',
  10749: 'romance',
  878: 'ficcao',
  53: 'suspense',
  10752: 'guerra',
  37: 'faroeste',
};

export async function getMoviesByGenre(genreId, page = 1) {
  const r = await tmdbGet('/discover/movie', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    page,
    'vote_count.gte': 100,
  });
  return r.map((m) => ({ id: m.id, title: m.title }));
}

// Atalhos
export const getActionMovies = () => getMoviesByGenre(28);
export const getAdventureMovies = () => getMoviesByGenre(12);
export const getAnimationMovies = () => getMoviesByGenre(16);
export const getComedyMovies = () => getMoviesByGenre(35);
export const getCrimeMovies = () => getMoviesByGenre(80);
export const getDocumentaryMovies = () => getMoviesByGenre(99);
export const getDramaMovies = () => getMoviesByGenre(18);
export const getFamilyMovies = () => getMoviesByGenre(10751);
export const getFantasyMovies = () => getMoviesByGenre(14);
export const getHistoryMovies = () => getMoviesByGenre(36);
export const getHorrorMovies = () => getMoviesByGenre(27);
export const getMusicMovies = () => getMoviesByGenre(10402);
export const getMysteryMovies = () => getMoviesByGenre(9648);
export const getRomanceMovies = () => getMoviesByGenre(10749);
export const getSciFiMovies = () => getMoviesByGenre(878);
export const getThrillerMovies = () => getMoviesByGenre(53);
export const getWarMovies = () => getMoviesByGenre(10752);
export const getWesternMovies = () => getMoviesByGenre(37);

// =====================================================
// POR ANO
// =====================================================
export async function getMoviesByYear(year, page = 1) {
  const r = await tmdbGet('/discover/movie', {
    primary_release_year: year,
    sort_by: 'popularity.desc',
    page,
    'vote_count.gte': 50,
  });
  return r.map((m) => ({ id: m.id, title: m.title }));
}

// =====================================================
// IDIOMA / REGIAO
// =====================================================
export async function getPortugueseMovies() {
  const r = await tmdbGet('/discover/movie', {
    with_original_language: 'pt',
    sort_by: 'popularity.desc',
  });
  return r.map((m) => ({ id: m.id, title: m.title }));
}

// =====================================================
// COMBINACOES
// =====================================================
export async function getFamilyAnimationMovies() {
  const r = await tmdbGet('/discover/movie', {
    with_genres: '16,10751',
    sort_by: 'popularity.desc',
  });
  return r.map((m) => ({ id: m.id, title: m.title }));
}

// =====================================================
// METADADOS
// =====================================================
export { GENRES };
