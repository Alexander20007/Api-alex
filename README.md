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
