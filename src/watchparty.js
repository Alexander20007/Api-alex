import { supabase } from './utils/supabase.js';
import { extractStream } from './orchestrator.js';

// =====================================================
// Gera código único de 6 caracteres
// =====================================================
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// =====================================================
// Cria uma nova sala de Watch Party
// =====================================================
export async function createWatchRoom(tmdbId, type, season, episode, hostId) {
  // Verifica se já existe sala ativa pro mesmo conteúdo
  const { data: existing } = await supabase
    .from('watch_rooms')
    .select('*')
    .eq('tmdb_id', String(tmdbId))
    .eq('type', type || 'movie')
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`[WATCH-PARTY] Reutilizando sala ${existing.code}`);
    return existing;
  }

  // Extrai o stream
  console.log(`[WATCH-PARTY] Extraindo stream: tmdb=${tmdbId} type=${type}`);
  const stream = await extractStream(
    tmdbId,
    type || 'movie',
    season || null,
    episode || null
  );

  if (!stream.success) {
    throw new Error('Falha ao extrair stream: ' + (stream.error || 'sem link'));
  }

  // Gera código único (tenta até 5 vezes)
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateRoomCode();
    const { data: check } = await supabase
      .from('watch_rooms')
      .select('code')
      .eq('code', code)
      .maybeSingle();
    if (!check) break;
  }

  // Salva no Supabase
  const { data, error } = await supabase
    .from('watch_rooms')
    .insert({
      code,
      host_id: hostId || 'anonymous',
      tmdb_id: String(tmdbId),
      type: type || 'movie',
      season: season || null,
      episode: episode || null,
      hls_url: stream.hlsUrl,
      cookies: stream.cookies || null,
    })
    .select()
    .single();

  if (error) throw new Error('Erro ao salvar sala: ' + error.message);

  console.log(`[WATCH-PARTY] Sala criada: ${code}`);
  return data;
}

// =====================================================
// Busca sala por código
// =====================================================
export async function getWatchRoom(code) {
  if (!code) return null;

  const { data, error } = await supabase
    .from('watch_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// =====================================================
// Encerra sala
// =====================================================
export async function closeWatchRoom(code) {
  const { error } = await supabase
    .from('watch_rooms')
    .update({ is_active: false })
    .eq('code', code.toUpperCase());

  if (error) throw new Error('Erro ao encerrar: ' + error.message);
  return true;
}

// =====================================================
// Limpa salas expiradas (chamada periódica)
// =====================================================
export async function cleanupExpiredRooms() {
  const { data, error } = await supabase
    .from('watch_rooms')
    .update({ is_active: false })
    .lt('expires_at', new Date().toISOString())
    .eq('is_active', true)
    .select('id');

  if (error) {
    console.error('[WATCH-PARTY] Erro cleanup:', error.message);
    return 0;
  }

  const count = data?.length || 0;
  if (count > 0) console.log(`[WATCH-PARTY] ${count} sala(s) expirada(s) limpa(s)`);
  return count;
}
