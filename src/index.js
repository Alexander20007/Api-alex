import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { extractStream } from './orchestrator.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =====================================================
// LOCK GLOBAL: impede warm cache duplicado
// =====================================================
let warmCacheRunning = false;

// =====================================================
// ROTA RAIZ
// =====================================================
app.get('/', (req, res) => {
  res.json({
    name: 'Api-alex',
    status: 'online',
    warmCacheRunning,
    routes: {
      filme: '/filmes/:tmdb_id',
      serie: '/series/:tmdb_id',
      serie_episodio: '/series/:tmdb_id/:season/:episode',
      legado: '/extract?tmdb_id=X&type=movie|tv',
      warm_cache: '/warm-cache?secret=XXX',
    },
  });
});

// =====================================================
// STREAMING
// =====================================================
app.get('/filmes/:tmdb_id', async (req, res) => {
  const { tmdb_id } = req.params;
  console.log(`\n[API] Filme tmdb_id=${tmdb_id}`);
  try {
    const result = await extractStream(tmdb_id, 'movie', null, null);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/series/:tmdb_id', async (req, res) => {
  const { tmdb_id } = req.params;
  console.log(`\n[API] Serie tmdb_id=${tmdb_id} (T1E1 padrao)`);
  try {
    const result = await extractStream(tmdb_id, 'tv', 1, 1);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/series/:tmdb_id/:season', async (req, res) => {
  const { tmdb_id, season } = req.params;
  console.log(`\n[API] Serie tmdb_id=${tmdb_id} T${season}E1`);
  try {
    const result = await extractStream(tmdb_id, 'tv', parseInt(season), 1);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/series/:tmdb_id/:season/:episode', async (req, res) => {
  const { tmdb_id, season, episode } = req.params;
  console.log(`\n[API] Serie tmdb_id=${tmdb_id} T${season}E${episode}`);
  try {
    const result = await extractStream(tmdb_id, 'tv', parseInt(season), parseInt(episode));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/extract', async (req, res) => {
  const tmdbId = req.query.tmdb_id;
  const type = req.query.type === 'tv' ? 'tv' : 'movie';
  const season = req.query.season ? parseInt(req.query.season) : null;
  const episode = req.query.episode ? parseInt(req.query.episode) : null;

  console.log(`\n[API legado] tmdb_id=${tmdbId} type=${type}`);
  if (!tmdbId) return res.status(400).json({ error: 'tmdb_id é obrigatório' });

  try {
    const result = await extractStream(tmdbId, type, season, episode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// WARM CACHE (com lock)
// =====================================================
app.get('/warm-cache', async (req, res) => {
  const secret = req.query.secret;

  if (process.env.WARM_SECRET && secret !== process.env.WARM_SECRET) {
    return res.status(401).json({ error: 'Secret invalido' });
  }

  // LOCK: se ja esta rodando, nao dispara de novo
  if (warmCacheRunning) {
    return res.json({
      message: 'Warm cache ja esta rodando',
      running: true,
      timestamp: new Date().toISOString(),
    });
  }

  warmCacheRunning = true;
  console.log('\n[WARM-CACHE] Iniciando aquecimento em background...');

  res.json({
    message: 'Warm cache iniciado em background',
    running: true,
    timestamp: new Date().toISOString(),
  });

  // Roda em background
  try {
    const { default: runWarmCache } = await import('./warm-cache-runner.js');
    await runWarmCache();
  } catch (err) {
    console.error('[WARM-CACHE] Erro:', err.message);
  } finally {
    warmCacheRunning = false;
    console.log('[WARM-CACHE] Finalizado. Lock liberado.');
  }
});

app.listen(PORT, () => {
  console.log(`🎬 Api-alex rodando em http://localhost:${PORT}`);
});
