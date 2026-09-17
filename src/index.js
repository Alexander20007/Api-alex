import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { extractStream } from './orchestrator.js';

const app = express();

// =====================================================
// CORS RESTRITIVO
// =====================================================
const ALLOWED_ORIGINS = [
  'https://alxmovies.netlify.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições SEM origin (curl, apps, UptimeRobot, etc)
    if (!origin) return callback(null, true);

    // Permite só os domínios da lista
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] ❌ Bloqueado: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

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
      legado: '/extract?tmdb_id=X&type=movie|tv',
      proxy: '/proxy?url=XXX&cookies=YYY',
      warm_cache: '/warm-cache?secret=XXX',
    },
  });
});

// =====================================================
// STREAMING
// =====================================================
app.get('/filmes/:tmdb_id', async (req, res) => {
  try {
    const result = await extractStream(req.params.tmdb_id, 'movie', null, null);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/series/:tmdb_id', async (req, res) => {
  try {
    const result = await extractStream(req.params.tmdb_id, 'tv', 1, 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/series/:tmdb_id/:season/:episode', async (req, res) => {
  try {
    const result = await extractStream(
      req.params.tmdb_id, 'tv',
      parseInt(req.params.season), parseInt(req.params.episode)
    );
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/extract', async (req, res) => {
  const tmdbId = req.query.tmdb_id;
  const type = req.query.type === 'tv' ? 'tv' : 'movie';
  const season = req.query.season ? parseInt(req.query.season) : null;
  const episode = req.query.episode ? parseInt(req.query.episode) : null;

  if (!tmdbId) return res.status(400).json({ error: 'tmdb_id obrigatorio' });

  try {
    const result = await extractStream(tmdbId, type, season, episode);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================
// PROXY
// =====================================================
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  const cookieStr = req.query.cookies || '';

  if (!targetUrl) return res.status(400).json({ error: 'url obrigatorio' });

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'url invalida' });
  }

  try {
    console.log(`\n[PROXY] -> ${decodedUrl.slice(0, 150)}`);

    let referer = 'https://cloudorchestranova.com/';
    if (decodedUrl.includes('vidsrcme.ru')) referer = 'https://vidsrcme.ru/';
    if (decodedUrl.includes('vidsrc.buzz')) referer = 'https://vidsrc.buzz/';

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': referer.replace(/\/$/, ''),
      'Referer': referer,
      'sec-ch-ua': '"Not?A_Brand";v="24", "Chromium";v="152"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    if (cookieStr) {
      try {
        headers['Cookie'] = decodeURIComponent(cookieStr);
      } catch (_) {
        headers['Cookie'] = cookieStr;
      }
    }

    const response = await axios.get(decodedUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers,
    });

    const contentType = response.headers['content-type'] || '';
    const statusCode = response.status;
    const buffer = Buffer.from(response.data);
    const firstChars = buffer.toString('utf-8', 0, Math.min(30, buffer.length));

    console.log(`[PROXY] <- ${statusCode} | ${contentType} | ${buffer.length}b`);

    if (statusCode >= 400) {
      return res.status(statusCode).json({
        error: `CDN retornou ${statusCode}`,
        preview: firstChars.slice(0, 200),
      });
    }

    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      decodedUrl.includes('.m3u8') ||
      firstChars.trim().startsWith('#EXTM3U');

    if (isM3u8) {
      const m3u8Text = buffer.toString('utf-8');
      if (!m3u8Text.trim().startsWith('#EXTM3U')) {
        return res.status(502).json({ error: 'Nao e m3u8', preview: m3u8Text.slice(0, 200) });
      }

      const baseUrl = new URL(decodedUrl);
      const lines = m3u8Text.split('\n');
      const cookieParam = cookieStr ? `&cookies=${encodeURIComponent(cookieStr)}` : '';

      const rewritten = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
              try {
                const abs = uri.startsWith('http') ? uri : new URL(uri, baseUrl).toString();
                return `URI="/proxy?url=${encodeURIComponent(abs)}${cookieParam}"`;
              } catch (_) {
                return `URI="${uri}"`;
              }
            });
          }
          return line;
        }

        try {
          const abs = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).toString();
          return `/proxy?url=${encodeURIComponent(abs)}${cookieParam}`;
        } catch (_) {
          return line;
        }
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(rewritten.join('\n'));
    }

    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(buffer);

  } catch (err) {
    console.error('[PROXY] erro:', err.message);
    return res.status(500).json({ error: 'Erro no proxy', message: err.message });
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
  if (warmCacheRunning) return res.json({ message: 'Ja rodando', running: true });
  warmCacheRunning = true;
  res.json({ message: 'Warm cache iniciado', running: true });
  try {
    const { default: runWarmCache } = await import('./warm-cache-runner.js');
    await runWarmCache();
  } catch (err) {
    console.error('[WARM-CACHE] erro:', err.message);
  } finally {
    warmCacheRunning = false;
  }
});

app.listen(PORT, () => {
  console.log(`🎬 Api-alex rodando em http://localhost:${PORT}`);
  console.log(`🔒 CORS permitido para: ${ALLOWED_ORIGINS.join(', ')}`);
});
