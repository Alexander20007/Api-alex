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
  try {
    const result = await extractStream(tmdb_id, 'movie', null, null);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/series/:tmdb_id', async (req, res) => {
  const { tmdb_id } = req.params;
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
// PROXY MELHORADO
// =====================================================
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'url é obrigatório' });
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'url inválida' });
  }

  try {
    console.log(`\n[PROXY] → ${decodedUrl.slice(0, 150)}`);

    // Referer sempre vidsrc.buzz (os sub-playlists também exigem)
    const referer = 'https://vidsrc.buzz/';

    let response;
    try {
      response = await axios.get(decodedUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': referer,
          'Origin': referer.replace(/\/$/, ''),
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
        },
      });
    } catch (axiosErr) {
      console.error('[PROXY] Axios erro:', axiosErr.message);
      return res.status(502).json({ error: 'Erro ao buscar CDN: ' + axiosErr.message });
    }

    const contentType = response.headers['content-type'] || '';
    const statusCode = response.status;
    const buffer = Buffer.from(response.data);
    const firstChars = buffer.toString('utf-8', 0, Math.min(30, buffer.length));

    console.log(`[PROXY] ← Status ${statusCode} | CT: ${contentType} | ${buffer.length} bytes | "${firstChars.replace(/\n/g, ' ')}"`);

    if (statusCode >= 400) {
      console.error(`[PROXY] ❌ CDN retornou ${statusCode}`);
      return res.status(statusCode).json({
        error: `CDN retornou ${statusCode}`,
        preview: firstChars.slice(0, 200),
      });
    }

    // Detecta m3u8
    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      decodedUrl.includes('.m3u8') ||
      firstChars.trim().startsWith('#EXTM3U');

    if (isM3u8) {
      const m3u8Text = buffer.toString('utf-8');

      if (!m3u8Text.trim().startsWith('#EXTM3U')) {
        console.error('[PROXY] ❌ Não é m3u8 válido');
        return res.status(502).json({
          error: 'Não é m3u8 válido',
          preview: m3u8Text.slice(0, 200),
        });
      }

      const baseUrl = new URL(decodedUrl);
      const lines = m3u8Text.split('\n');
      let reescritas = 0;

      const rewritten = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Tags com URI (ex: #EXT-X-KEY:URI="...")
        if (trimmed.startsWith('#')) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
              try {
                const abs = uri.startsWith('http') ? uri : new URL(uri, baseUrl).toString();
                return `URI="/proxy?url=${encodeURIComponent(abs)}"`;
              } catch (_) {
                return `URI="${uri}"`;
              }
            });
          }
          return line;
        }

        // URL (segmento .ts, sub-playlist .m3u8, etc)
        try {
          const abs = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).toString();
          reescritas++;
          return `/proxy?url=${encodeURIComponent(abs)}`;
        } catch (_) {
          return line;
        }
      });

      const isMaster = m3u8Text.includes('#EXT-X-STREAM-INF');
      console.log(`[PROXY] 📝 ${isMaster ? 'MASTER' : 'SUB'} m3u8 | ${reescritas} URLs reescritas`);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(rewritten.join('\n'));
    }

    // Binário (segmento .ts, imagem, etc)
    console.log(`[PROXY] 📦 Binário (${buffer.length} bytes)`);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(buffer);

  } catch (err) {
    console.error('[PROXY] ❌ Erro geral:', err.message);
    return res.status(500).json({
      error: 'Erro no proxy',
      message: err.message,
    });
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
    return res.json({ message: 'Warm cache ja esta rodando', running: true });
  }

  warmCacheRunning = true;
  console.log('\n[WARM-CACHE] Iniciando...');

  res.json({ message: 'Warm cache iniciado', running: true, timestamp: new Date().toISOString() });

  try {
    const { default: runWarmCache } = await import('./warm-cache-runner.js');
    await runWarmCache();
  } catch (err) {
    console.error('[WARM-CACHE] Erro:', err.message);
  } finally {
    warmCacheRunning = false;
  }
});

app.listen(PORT, () => {
  console.log(`🎬 Api-alex rodando em http://localhost:${PORT}`);
});
