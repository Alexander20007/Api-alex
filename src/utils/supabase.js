import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[!] SUPABASE_URL ou SUPABASE_ANON_KEY nao configurados');
}

globalThis.WebSocket = ws;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { transport: ws },
});

export async function getProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true });
  if (error) {
    console.error('[Supabase] Erro providers:', error.message);
    return [];
  }
  return data || [];
}

export async function getFromCache(tmdbId, type, season, episode) {
  let query = supabase
    .from('cache')
    .select('*')
    .eq('tmdb_id', String(tmdbId))
    .eq('type', type)
    .gt('expires_at', new Date().toISOString());

  if (season !== null && season !== undefined) {
    query = query.eq('season', season);
  } else {
    query = query.is('season', null);
  }

  if (episode !== null && episode !== undefined) {
    query = query.eq('episode', episode);
  } else {
    query = query.is('episode', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function saveToCache(tmdbId, type, season, episode, providerName, hlsUrl, subtitles, ttlHours = 1, cookies = null) {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('cache')
    .upsert({
      tmdb_id: String(tmdbId),
      type,
      season: season ?? null,
      episode: episode ?? null,
      provider_name: providerName,
      hls_url: hlsUrl,
      subtitles: subtitles || [],
      expires_at: expiresAt,
      cookies: cookies,
    }, {
      onConflict: 'tmdb_id,type,season,episode',
    });

  if (error) console.error('[Supabase] Erro cache:', error.message);
}

export async function logMetric(providerName, tmdbId, type, success, responseTimeMs, errorMessage = null) {
  const { error } = await supabase
    .from('metrics')
    .insert({
      provider_name: providerName,
      tmdb_id: String(tmdbId),
      type,
      success,
      response_time_ms: responseTimeMs,
      error_message: errorMessage,
    });
  if (error) console.error('[Supabase] Erro metrica:', error.message);
}
