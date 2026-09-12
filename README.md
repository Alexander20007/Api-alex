# 🎬 Api-alex

API de agregação de streams de vídeo para uso **educacional**.

> ⚠️ **Aviso Legal**: Este projeto é destinado apenas para fins educacionais.

---

## ✨ Features

- ✅ Multi-provider com fallback em cascata
- ✅ Bypass de Cloudflare via Patchright
- ✅ Chromium completo dentro do proot Debian
- ✅ Captura de legendas (.vtt / .srt)
- ✅ Clique automático no player
- ✅ Token JWT preservado nas URLs m3u8
- ✅ Filtro de trackers

---

## 📡 Endpoints

### GET /extract

Parâmetros: tmdb_id (obrigatório), type (movie/tv), season, episode.

```bash
curl "http://localhost:3000/extract?tmdb_id=550&type=movie"
curl "http://localhost:3000/extract?tmdb_id=1396&type=tv&season=1&episode=1"
```

---

## 🗺️ Roadmap

- [x] Provider VidSrc funcional
- [ ] Provider Embed.su
- [ ] Provider VidLink
- [ ] Endpoint /download
- [ ] Cache de resultados
- [ ] Frontend HTML

---

## 👤 Autor

**Alexander** (@Alexander20007)

---

## 🌐 API em Produção

**URL:** https://api-alex-jney.onrender.com

**Status:** ✅ Online 24/7 (monitorado via UptimeRobot)

**Endpoints disponíveis:**
- `GET /` — Health check
- `GET /extract?tmdb_id=550&type=movie` — Extrai stream de filme
- `GET /extract?tmdb_id=1396&type=tv&season=1&episode=1` — Extrai stream de série

**Providers ativos:**
1. `vidsrc` (vidsrc.in)
2. `vidsrcbuzz` (vidsrc.buzz)
3. `vidsrcrip` (stub)
4. `vidlink` (stub)
5. `embedsu` (offline)

**Sistema:** Fallback em cascata + cache no Supabase + métricas
