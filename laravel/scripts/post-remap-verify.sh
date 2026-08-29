#!/bin/bash
set -e

echo "=== CURL regression ==="
for cat in pulsa international; do
  code=$(curl -sS -o /tmp/curl-${cat}.json -w "%{http_code}" "https://gurkynet.my.id/api/v1/products?category=${cat}&per_page=5")
  items=$(php -r '$d=json_decode(file_get_contents("/tmp/curl-'"${cat}"'.json"),true); echo count($d["data"]??[]);')
  success=$(php -r '$d=json_decode(file_get_contents("/tmp/curl-'"${cat}"'.json"),true); echo $d["success"]?"true":"false";')
  echo "${cat}: HTTP ${code} success=${success} items=${items}"
done

echo ""
cd /var/www/GurkyNet/laravel
php scripts/report-tagihan-products.php
