#!/bin/bash
set -e
echo "=== dist index.html asset hash ==="
grep -o 'assets/index-[^"]*' /var/www/GurkyNet/dist/index.html | head -1

echo "=== clear cache ==="
cd /var/www/GurkyNet/laravel
sudo -u www-data php artisan cache:clear
sudo -u www-data php artisan config:clear

echo "=== API topup-digital ==="
curl -sS 'https://gurkynet.my.id/api/v1/products?category=topup-digital&per_page=50' > /tmp/topup.json
python3 << 'PY'
import json
with open('/tmp/topup.json') as f:
    d = json.load(f)
total = d.get('meta', {}).get('pagination', {}).get('total', 0)
print('total', total)
ops = sorted({(x.get('operatorName') or x.get('provider') or '') for x in d.get('data', []) if x})
print('providers', ops)
PY

echo "=== API voucher-digital telkomsel check ==="
curl -sS 'https://gurkynet.my.id/api/v1/products?category=voucher-digital&per_page=100' > /tmp/voucher.json
python3 << 'PY'
import json
with open('/tmp/voucher.json') as f:
    d = json.load(f)
telco = [x for x in d.get('data', []) if 'telkomsel' in (x.get('operatorName') or x.get('provider') or '').lower() and 'google play' not in (x.get('name') or '').lower()]
print('telkomsel non-google-play count', len(telco))
for x in telco[:5]:
    print(' -', x.get('operatorName'), '|', x.get('name'))
PY

echo "=== DB topup-digital active ==="
php /tmp/audit-category-mismatch.php 2>/dev/null | tail -8 || true

sudo systemctl reload nginx
echo "=== nginx reloaded ==="
