#!/bin/bash
set -e
cd /var/www/GurkyNet/laravel
php scripts/verify-deploy-catalog.php

echo "--- CURL topup-digital ---"
curl -sS 'https://gurkynet.my.id/api/v1/products?category=topup-digital&per_page=100' | head -c 3000
echo
echo

for cat in game data pulsa voucher-digital; do
  echo "--- CURL $cat ---"
  curl -sS "https://gurkynet.my.id/api/v1/products?category=${cat}&per_page=5" | php -r '
    $d=json_decode(stream_get_contents(STDIN),true);
    $items=is_array($d["data"]??null)?count($d["data"]):0;
    echo "success=".($d["success"]?"true":"false")." http_items=$items\n";
  '
done

echo "--- CURL providers topup-digital ---"
curl -sS 'https://gurkynet.my.id/api/v1/products/providers?category=topup-digital'
echo

echo "--- CURL providers voucher-digital ---"
curl -sS 'https://gurkynet.my.id/api/v1/products/providers?category=voucher-digital'
echo
