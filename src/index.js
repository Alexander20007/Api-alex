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
// PROXY AVANÇADO (reescreve m3u8)
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

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const buffer = Buffer.from(response.data);

    // 🔑 SE FOR M3U8: reescreve as URLs internas pra passarem pelo proxy
    if (contentType.includes('mpegurl') || decodedUrl.includes('.m3u8') || buffer.toString('utf-8', 0, 10).includes('#EXTM3U')) {
      const m3u8Text = buffer.toString('utf-8');
      const baseUrl = new URL(decodedUrl);

      console.log(`[PROXY] Reescrevendo m3u8 (${m3u8Text.length} bytes)...`);

      const lines = m3u8Text.split('\n');
      const rewritten = lines.map((line) => {
        const trimmed = line.trim();
        
        // Linha vazia ou comentário → mantém
        if (!trimmed || trimmed.startsWith('#')) {
          // Mas se for uma tag com URL (ex: #EXT-X-KEY:URI="..."), reescreve
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
              let absoluteUrl = uri.startsWith('http') ? uri : new URL(uri, baseUrl).toString();
              return `URI="/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
            });
          }
          return line;
        }

        // Linha com URL (segmento .ts, playlist .m3u8, etc)
        let absoluteUrl;
        try {
          absoluteUrl = new URL(trimmed, baseUrl).toString();
        } catch (_) {
          return line;
        }

        return `/proxy?url=${encodeURIComponent(absoluteUrl)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewritten.join('\n'));
      return;
    }

    // Não é m3u8: repassa direto (segmentos .ts, imagens, etc)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
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
