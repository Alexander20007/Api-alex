import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { extractStream } from './orchestrator.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

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
      proxy: '/proxy?url=XXX',
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
  try {
    const result = await extractStream(tmdb_id, 'tv', parseInt(season), 1);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/series/:tmdb_id/:season/:episode', async (req, res) => {
  const { tmdb_id, season, episode } = req.params;
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

  if (!tmdbId) return res.status(400).json({ error: 'tmdb_id é obrigatório' });

  try {
    const result = await extractStream(tmdbId, type, season, episode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROXY (resolve bloqueio de Referer dos CDNs)
// =====================================================
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'url é obrigatório' });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    console.log(`[PROXY] ${decodedUrl.slice(0, 120)}...`);

    // Determina o Referer correto baseado no domínio
    let referer = 'https://vidsrc.buzz/';
    if (decodedUrl.includes('vidsrc.in')) referer = 'https://vidsrc.in/';
    else if (decodedUrl.includes('vidsrc.buzz')) referer = 'https://vidsrc.buzz/';

    const response = await axios.get(decodedUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': referer.replace(/\/$/, ''),
        'Accept': '*/*',
      },
    });

    // Repassa os headers relevantes
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Repassa o conteúdo
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('[PROXY] Erro:', err.message);
    res.status(500).json({ error: 'Erro no proxy: ' + err.message });
  }
});

// =====================================================
// WARM CACHE
// =====================================================
app.get('/warm-cache', async (req, res) => {
  const secret = req.query.secret;

  if (process.env.WARM_SECRET && secret !== process.env.WARM_SECRET) {
    return res.status(401).json({ error: 'Secret invalido' });
  }

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

  try {
    const { default: runWarmCache } = await import('./warm-cache-runner.js');
    await runWarmCache();
  } catch (err) {
    console.error('[WARM-CACHE] Erro:', err.message);
  } finally {
    warmCacheRunning = false;
    console.log('[WARM-CACHE] Finalizado.');
  }
});

app.listen(PORT, () => {
  console.log(`🎬 Api-alex rodando em http://localhost:${PORT}`);
});
