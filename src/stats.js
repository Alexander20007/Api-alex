import { supabase } from './utils/supabase.js';

export async function getStats() {
  const result = {
    uptime: 0,
    first_seen: null,
    restart_count: 0,
    cache_count: 0,
    requests_24h: 0,
    success_rate: 0,
    popular: [],
    chart_labels: [],
    chart_data: [],
  };

  try {
    // Uptime persistente
    const { data: status } = await supabase
      .from('api_status')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (status) {
      result.first_seen = status.first_seen;
      result.restart_count = status.restart_count;

      const firstSeen = new Date(status.first_seen).getTime();
      result.uptime = Math.floor((Date.now() - firstSeen) / 1000);

      await supabase
        .from('api_status')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', 1);
    }

    // Cache count
    const { count: cacheCount } = await supabase
      .from('cache')
      .select('*', { count: 'exact', head: true });
    if (cacheCount !== null) result.cache_count = cacheCount;

    // Métricas 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: metrics } = await supabase
      .from('metrics')
      .select('*')
      .gte('created_at', since24h);

    if (metrics && metrics.length > 0) {
      result.requests_24h = metrics.length;
      const sucessos = metrics.filter(m => m.success).length;
      result.success_rate = Math.round((sucessos / metrics.length) * 100);

      const buckets = {};
      for (let i = 23; i >= 0; i--) {
        const h = new Date(Date.now() - i * 60 * 60 * 1000);
        const key = h.getHours().toString().padStart(2, '0');
        buckets[key] = 0;
      }

      metrics.forEach(m => {
        const d = new Date(m.created_at);
        const key = d.getHours().toString().padStart(2, '0');
        if (buckets[key] !== undefined) buckets[key]++;
      });

      result.chart_labels = Object.keys(buckets).map(h => `${h}h`);
      result.chart_data = Object.values(buckets);

      // Top 5 populares (7 dias)
      const counts = {};
      const { data: allMetrics } = await supabase
        .from('metrics')
        .select('tmdb_id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (allMetrics) {
        allMetrics.forEach(m => {
          counts[m.tmdb_id] = (counts[m.tmdb_id] || 0) + 1;
        });

        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        for (const [tmdbId, count] of top) {
          result.popular.push({
            tmdb_id: tmdbId,
            title: `TMDB #${tmdbId}`,
            count: count,
          });
        }
      }
    }
  } catch (err) {
    console.error('[STATS] Erro:', err.message);
  }

  return result;
}

export async function registerBoot() {
  try {
    const { data: status } = await supabase
      .from('api_status')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (status) {
      await supabase
        .from('api_status')
        .update({
          last_seen: new Date().toISOString(),
          restart_count: (status.restart_count || 0) + 1,
        })
        .eq('id', 1);
      console.log(`[STATS] Boot #${(status.restart_count || 0) + 1}`);
    } else {
      await supabase
        .from('api_status')
        .insert({ id: 1, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() });
      console.log('[STATS] Primeiro boot');
    }
  } catch (err) {
    console.error('[STATS] Erro boot:', err.message);
  }
}
