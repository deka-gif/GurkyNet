#!/usr/bin/env bash
# GurkyNet production deploy helper (Azure VPS / Ubuntu)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/gurkynet}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"

cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Backend dependencies"
cd laravel
$COMPOSER_BIN install --no-dev --optimize-autoloader --no-interaction

echo "==> Environment checks"
test -f .env || { echo "Missing laravel/.env"; exit 1; }
$PHP_BIN artisan config:clear

echo "==> Migrations"
$PHP_BIN artisan migrate --force

echo "==> Storage permissions (PHP-FPM must own writable dirs)"
sudo chown -R www-data:www-data laravel/storage laravel/bootstrap/cache
sudo chmod -R ug+rwx laravel/storage laravel/bootstrap/cache

echo "==> Optimize"
$PHP_BIN artisan optimize
$PHP_BIN artisan storage:link || true

echo "==> Frontend build (repo root)"
cd ..
npm ci
npm run build

echo "==> Reload workers"
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart gurkynet-worker:* || true
sudo supervisorctl restart gurkynet-scheduler || true
# Prefer PHP 8.4 (production); fall back to 8.3
sudo systemctl reload php8.4-fpm 2>/dev/null || sudo systemctl reload php8.3-fpm || true
sudo systemctl reload nginx || true

echo "==> Health check"
curl -fsS "${APP_URL:-https://gurkynet.my.id}/api/health" || true

echo "Deploy complete."
