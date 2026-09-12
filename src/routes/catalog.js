import express from 'express';
import {
  getTrendingMovies,
  getTrendingTvShows,
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  getPopularTvShows,
  getTopRatedTvShows,
  getOnTheAirTvShows,
  getActionMovies,
  getAdventureMovies,
  getAnimationMovies,
  getComedyMovies,
  getCrimeMovies,
  getDocumentaryMovies,
  getDramaMovies,
  getFamilyMovies,
  getFantasyMovies,
  getHistoryMovies,
  getHorrorMovies,
  getMusicMovies,
  getMysteryMovies,
  getRomanceMovies,
  getSciFiMovies,
  getThrillerMovies,
  getWarMovies,
  getWesternMovies,
  getFamilyAnimationMovies,
  getPortugueseMovies,
  getMoviesByYear,
} from '../utils/tmdb.js';

const router = express.Router();

// =====================================================
// Helper: executa uma função de busca e retorna JSON
// =====================================================
function makeRoute(fn, params = {}) {
  return async (req, res) => {
    try {
      const filmes = await fn(req.query);
      res.json({
        success: true,
        count: filmes.length,
        results: filmes,
      });
    } catch (err) {
      console.error('[Catalog] Erro:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

// =====================================================
// TRENDING
// =====================================================
router.get('/trending/movies', async (req, res) => {
  const period = req.query.period === 'week' ? 'week' : 'day';
  const filmes = await getTrendingMovies(period);
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/trending/tv', async (req, res) => {
  const period = req.query.period === 'week' ? 'week' : 'day';
  const series = await getTrendingTvShows(period);
  res.json({ success: true, count: series.length, results: series });
});

// =====================================================
// POPULARES / TOP RATED
// =====================================================
router.get('/populares/filmes', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const filmes = await getPopularMovies(page);
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/populares/series', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const series = await getPopularTvShows(page);
  res.json({ success: true, count: series.length, results: series });
});

router.get('/top/filmes', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const filmes = await getTopRatedMovies(page);
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/top/series', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const series = await getTopRatedTvShows(page);
  res.json({ success: true, count: series.length, results: series });
});

// =====================================================
// NOVIDADES / EM CARTAZ
// =====================================================
router.get('/cartaz', async (req, res) => {
  const filmes = await getNowPlayingMovies();
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/em-breve', async (req, res) => {
  const filmes = await getUpcomingMovies();
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/series/no-ar', async (req, res) => {
  const series = await getOnTheAirTvShows();
  res.json({ success: true, count: series.length, results: series });
});

// =====================================================
// GENEROS
// =====================================================
const GENEROS = {
  'acao': getActionMovies,
  'aventura': getAdventureMovies,
  'animacao': getAnimationMovies,
  'comedia': getComedyMovies,
  'crime': getCrimeMovies,
  'documentario': getDocumentaryMovies,
  'drama': getDramaMovies,
  'familia': getFamilyMovies,
  'fantasia': getFantasyMovies,
  'historia': getHistoryMovies,
  'terror': getHorrorMovies,
  'musica': getMusicMovies,
  'misterio': getMysteryMovies,
  'romance': getRomanceMovies,
  'ficcao': getSciFiMovies,
  'suspense': getThrillerMovies,
  'guerra': getWarMovies,
  'faroeste': getWesternMovies,
};

router.get('/generos', (req, res) => {
  res.json({
    success: true,
    generos: Object.keys(GENEROS),
  });
});

router.get('/genero/:nome', async (req, res) => {
  const { nome } = req.params;
  const fn = GENEROS[nome];

  if (!fn) {
    return res.status(404).json({
      success: false,
      error: `Genero "${nome}" nao encontrado`,
      disponiveis: Object.keys(GENEROS),
    });
  }

  const filmes = await fn();
  res.json({ success: true, genero: nome, count: filmes.length, results: filmes });
});

// =====================================================
// COMBINACOES
// =====================================================
router.get('/familia-animacao', async (req, res) => {
  const filmes = await getFamilyAnimationMovies();
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/portugueses', async (req, res) => {
  const filmes = await getPortugueseMovies();
  res.json({ success: true, count: filmes.length, results: filmes });
});

router.get('/ano/:ano', async (req, res) => {
  const { ano } = req.params;
  const page = parseInt(req.query.page) || 1;
  const filmes = await getMoviesByYear(parseInt(ano), page);
  res.json({ success: true, ano, count: filmes.length, results: filmes });
});

export default router;
