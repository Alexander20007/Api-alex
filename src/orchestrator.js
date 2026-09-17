import { VidSrcProvider } from './providers/vidsrc.js';
import { VidSrcBuzzProvider } from './providers/vidsrcbuzz.js';
import { EmbedSuProvider } from './providers/embedsu.js';
import { VidLinkProvider } from './providers/vidlink.js';
import { VidSrcRipProvider } from './providers/vidsrcrip.js';
import { VidSrcMeProvider } from './providers/vidsrcme.js';
import { getProviders, getFromCache, saveToCache, logMetric } from './utils/supabase.js';

const PROVIDER_CLASSES = {
  vidsrc: VidSrcProvider,
  vidsrcbuzz: VidSrcBuzzProvider,
  embedsu: EmbedSuProvider,
  vidlink: VidLinkProvider,
  vidsrcrip: VidSrcRipProvider,
  vidsrcme: VidSrcMeProvider,
};

function buildProviders(providerRows) {
  const instances = [];
  for (const row of providerRows) {
    const ProviderClass = PROVIDER_CLASSES[row.name];
    if (!ProviderClass) {
      console.warn(`[!] Provider "${row.name}" sem classe`);
      continue;
    }
    const instance = new ProviderClass();
    instance.config = {
      ...instance.config,
      name: row.name,
      domain: row.domain,
      endpointPattern: row.endpoint_pattern,
      playerPatterns: row.player_patterns || [],
      ignorePatterns: row.ignore_patterns || [],
      needsClick: row.needs_click,
      timeoutMs: row.timeout_ms || 60000,
    };
    instances.push(instance);
  }
  return instances;
}

export async function extractStream(tmdbId, type, season, episode) {
  const startTime = Date.now();
  const attempts = [];

  console.log(`[*] Checando cache: ${tmdbId} / ${type}`);
  const cached = await getFromCache(tmdbId, type, season, episode);

  if (cached) {
    console.log(`[+] CACHE HIT! Provider: ${cached.provider_name}`);
    return {
      success: true,
      provider: cached.provider_name,
      hlsUrl: cached.hls_url,
      subtitles: cached.subtitles || [],
      cookies: cached.cookies || null,
      fromCache: true,
      attempts: [{ provider: cached.provider_name, success: true, cached: true }],
    };
  }

  console.log('[*] Buscando providers...');
  const providerRows = await getProviders();

  if (providerRows.length === 0) {
    return { success: false, error: 'Nenhum provider ativo', attempts: [] };
  }

  console.log(`[+] ${providerRows.length} provider(s): ${providerRows.map(p => p.name).join(', ')}`);
  const providers = buildProviders(providerRows);

  for (const provider of providers) {
    const name = provider.config.name;
    const providerStart = Date.now();
    console.log(`\n[*] Tentando ${name}...`);

    try {
      const result = await provider.extract(tmdbId, type, season, episode);
      const elapsed = Date.now() - providerStart;

      if (result?.hlsUrl) {
        console.log(`[+] ${name} SUCESSO em ${elapsed}ms`);
        await saveToCache(
          tmdbId, type, season, episode, name,
          result.hlsUrl, result.subtitles || [],
          1,                                    // TTL 1h
          result.cookies || null                // cookies da sessão
        );
        await logMetric(name, tmdbId, type, true, elapsed);
        attempts.push({ provider: name, success: true, elapsed_ms: elapsed });
        return {
          success: true,
          provider: name,
          hlsUrl: result.hlsUrl,
          subtitles: result.subtitles || [],
          cookies: result.cookies || null,
          fromCache: false,
          attempts,
        };
      }

      const elapsed2 = Date.now() - providerStart;
      console.log(`[-] ${name} nao retornou link`);
      await logMetric(name, tmdbId, type, false, elapsed2, 'sem link');
      attempts.push({ provider: name, success: false, reason: 'sem link', elapsed_ms: elapsed2 });
    } catch (err) {
      const elapsed = Date.now() - providerStart;
      console.log(`[-] ${name} ERRO: ${err.message}`);
      await logMetric(name, tmdbId, type, false, elapsed, err.message);
      attempts.push({ provider: name, success: false, reason: err.message, elapsed_ms: elapsed });
    }
  }

  return {
    success: false,
    error: 'Nenhum provider retornou link valido',
    attempts,
    total_time_ms: Date.now() - startTime,
  };
}
