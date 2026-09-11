#!/bin/bash

BR_SITES=(
  "superflixapi.com"
  "overflix.com.br"
  "topflix.tv"
  "animefire.net"
  "vizer.tv"
  "meusdoramas.com"
  "animesbr.net"
  "seriesflixbr.com"
  "filmflix.online"
  "cineflixhd.com"
)

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo "┌────────────────────┬────────┬─────────────────────────────────┐"
echo "│ DOMÍNIO            │ STATUS │ OBSERVAÇÃO                      │"
echo "├────────────────────┼────────┼─────────────────────────────────┤"

for site in "${BR_SITES[@]}"; do
  response=$(curl -s -o /tmp/br_test.html -w "%{http_code}" --max-time 10 \
    -H "User-Agent: $UA" \
    "https://$site" 2>/dev/null)
  
  size=$(wc -c < /tmp/br_test.html 2>/dev/null || echo 0)
  title=$(grep -oE "<title>[^<]*</title>" /tmp/br_test.html 2>/dev/null | head -1 | sed 's/<[^>]*>//g' | head -c 30)
  
  printf "│ %-18s │ %-6s │ %-31s │\n" "$site" "$response" "$title"
done

echo "└────────────────────┴────────┴─────────────────────────────────┘"
