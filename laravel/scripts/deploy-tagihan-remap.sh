#!/bin/bash
set -e
cd /var/www/GurkyNet
git pull origin main
cd laravel
php artisan optimize:clear
php artisan config:cache

echo "=== PRE-EXEC verify scope (expect 14 moves) ==="
php scripts/verify-tagihan-remap-scope.php

echo ""
echo "=== DRY-RUN ==="
php artisan catalog:remap-categories --dry-run 2>&1 | tee /tmp/remap-tagihan-dry.txt

echo ""
echo "=== EXECUTE (only if scope script showed 14) ==="
MOVES=$(php scripts/verify-tagihan-remap-scope.php | head -1 | grep -o '[0-9]*')
if [ "$MOVES" = "14" ]; then
  php artisan catalog:remap-categories 2>&1 | tee /tmp/remap-tagihan-exec.txt
else
  echo "STOP: total_slug_moves=$MOVES (expected 14) — not executing"
  exit 1
fi

echo ""
echo "=== POST-EXEC verify ==="
php scripts/verify-tagihan-remap-scope.php

echo ""
echo "=== CURL ==="
for cat in internet-pascabayar tv-pascabayar multifinance pbb gas tagihan game data pulsa topup-digital; do
  code=$(curl -sS -o /tmp/c-${cat}.json -w "%{http_code}" "https://gurkynet.my.id/api/v1/products?category=${cat}&per_page=100")
  items=$(php -r '$d=json_decode(file_get_contents("/tmp/c-'"${cat}"'.json"),true); echo is_array($d["data"]??null)?count($d["data"]):0;')
  echo "${cat}: HTTP ${code} items=${items}"
done
