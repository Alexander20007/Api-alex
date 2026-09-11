#!/bin/bash
# Testa quais domínios do VidSrc estão online E usam o mesmo software

DOMAINS=(
  "vidsrc.in"
  "vidsrc.buzz"
  "vidsrc.to"
  "vidsrc.cc"
  "vidsrc.me"
  "vidsrc.net"
  "vidsrc.pm"
  "vidsrc.xyz"
  "vidsrc.stream"
  "vidsrc.io"
)

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo "┌────────────────────┬────────┬──────────┬──────────────────────┐"
echo "│ DOMÍNIO            │ STATUS │ VIDSRC?  │ NOTAS                │"
echo "├────────────────────┼────────┼──────────┼──────────────────────┤"

for domain in "${DOMAINS[@]}"; do
  url="https://${domain}/embed/movie/550"
  
  # Faz request com headers
  response=$(curl -s --max-time 10 "$url" \
    -H "User-Agent: $UA" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
    -w "\n%{http_code}" 2>/dev/null)
  
  status_code=$(echo "$response" | tail -1)
  html=$(echo "$response" | head -n -1)
  html_size=$(echo -n "$html" | wc -c)
  
  # Verifica se é VidSrc de verdade
  if echo "$html" | grep -q "window.EMBED_URL\|VidSrc\|vidsrc"; then
    vidsrc_ok="✅ SIM"
    nota="Player VidSrc detectado"
  elif [ "$status_code" = "200" ]; then
    vidsrc_ok="⚠️ TALVEZ"
    nota="200 mas padrao diferente"
  else
    vidsrc_ok="❌ NAO"
    nota="HTTP $status_code"
  fi
  
  printf "│ %-18s │ %-6s │ %-8s │ %-20s │\n" "$domain" "$status_code" "$vidsrc_ok" "$nota"
done

echo "└────────────────────┴────────┴──────────┴──────────────────────┘"
