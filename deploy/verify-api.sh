#!/bin/bash
cd /var/www/GurkyNet/laravel
sudo -u www-data php artisan cache:clear || true
sudo -u www-data php artisan config:clear || true

echo "=== API topup-digital ==="
curl -sS 'https://gurkynet.my.id/api/v1/products?category=topup-digital&per_page=50' -o /tmp/topup.json
python3 << 'PY'
import json
with open('/tmp/topup.json') as f:
    d = json.load(f)
total = d.get('meta', {}).get('pagination', {}).get('total', 0)
print('total', total)
ops = sorted({(x.get('operatorName') or x.get('provider') or '') for x in d.get('data', []) if x})
print('providers', ops)
PY

echo "=== API voucher-digital telkomsel kuota ==="
curl -sS 'https://gurkynet.my.id/api/v1/products?category=voucher-digital&per_page=100' -o /tmp/voucher.json
python3 << 'PY'
import json
with open('/tmp/voucher.json') as f:
    d = json.load(f)
telco = [x for x in d.get('data', []) if 'telkomsel' in (x.get('operatorName') or x.get('provider') or '').lower() and 'google play' not in (x.get('name') or '').lower()]
print('telkomsel non-google-play', len(telco))
PY

sudo systemctl reload nginx
echo DONE
