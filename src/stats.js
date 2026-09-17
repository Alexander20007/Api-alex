import { supabase } from './utils/supabase.js';

const START_TIME = Date.now();

export async function getStats() {
  const result = {
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    providers: [],
    cache_count: 0,
    requests_24h: 0,
    success_rate: 0,
    popular: [],
    chart_labels: [],
    chart_data: [],
  };

  try {
    // 1. Providers
    const { data: providers } = await supabase
      .from('providers')
      .select('name, display_name, priority, enabled')
      .order('priority');
    if (providers) result.providers = providers;

    // 2. Cache count
    const { count: cacheCount } = await supabase
      .from('cache')
      .select('*', { count: 'exact', head: true });
    if (cacheCount !== null) result.cache_count = cacheCount;

    // 3. Métricas 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: metrics } = await supabase
      .from('metrics')
      .select('*')
      .gte('created_at', since24h);

    if (metrics && metrics.length > 0) {
      result.requests_24h = metrics.length;

      const sucessos = metrics.filter(m => m.success).length;
      result.success_rate = Math.round((sucessos / metrics.length) * 100);

      // Chart: agrupa por hora
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

      // Top 5 filmes mais pedidos (de todos os tempos, últimos 7 dias)
      const counts = {};
      const { data: allMetrics } = await supabase
        .from('metrics')
        .select('tmdb_id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (allMetrics) {
        allMetrics.forEach(m => {
          counts[m.tmdb_id] = (counts[m.tmdb_id] || 0) + 1;
        });

        // Pega os títulos do cache se existirem
        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Tenta buscar títulos do cache
        for (const [tmdbId, count] of top) {
          const { data: cached } = await supabase
            .from('cache')
            .select('tmdb_id')
            .eq('tmdb_id', tmdbId)
            .limit(1)
            .maybeSingle();

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
