import { VidSrcProvider } from './providers/vidsrc.js';

const providers = [new VidSrcProvider()];

export async function extractStream(tmdbId, type, season, episode) {
  const attempts = [];

  for (const provider of providers) {
    const name = provider.constructor.name;
    console.log(`[*] Tentando ${name}...`);

    try {
      const result = await provider.extract(tmdbId, type, season, episode);

      if (result?.hlsUrl) {
        attempts.push({ provider: name, success: true });
        return {
          success: true,
          provider: name,
          hlsUrl: result.hlsUrl,
          subtitles: result.subtitles || [],
          attempts,
        };
      }

      attempts.push({ provider: name, success: false, reason: 'sem link' });
    } catch (err) {
      attempts.push({ provider: name, success: false, reason: err.message });
      console.log(`[-] ${name}: ${err.message}`);
    }
  }

  return { success: false, error: 'Nenhum provider retornou link válido', attempts };
}
