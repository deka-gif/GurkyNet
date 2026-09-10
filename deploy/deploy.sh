#!/usr/bin/env bash
# GurkyNet production deploy helper (Azure VPS / Ubuntu)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/GurkyNet}"
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

echo "==> Storage permissions (PHP-FPM / queue worker www-data must own writable dirs)"
# File cache (CACHE_STORE=file) creates nested hash dirs under cache/data.
# Missing nested dirs + wrong ownership caused ProcessMidtransCallback settlement crashes.
sudo mkdir -p "$APP_DIR/laravel/storage/framework/cache/data"
sudo mkdir -p "$APP_DIR/laravel/storage/framework/sessions"
sudo mkdir -p "$APP_DIR/laravel/storage/framework/views"
sudo mkdir -p "$APP_DIR/laravel/storage/logs"
sudo mkdir -p "$APP_DIR/laravel/bootstrap/cache"
# Drop azureuser-owned hash shards that www-data cannot extend (e.g. cache/data/5c).
# Safe: file cache is regenerable; do not delete other storage contents.
if [ -d "$APP_DIR/laravel/storage/framework/cache/data" ]; then
  sudo find "$APP_DIR/laravel/storage/framework/cache/data" -mindepth 1 -maxdepth 1 -type d ! -user www-data -exec rm -rf {} + 2>/dev/null || true
fi
sudo chown -R www-data:www-data "$APP_DIR/laravel/storage" "$APP_DIR/laravel/bootstrap/cache"
sudo chmod -R ug+rwx "$APP_DIR/laravel/storage" "$APP_DIR/laravel/bootstrap/cache"
# setgid on cache tree so new nested dirs inherit www-data group
sudo find "$APP_DIR/laravel/storage/framework/cache" -type d -exec chmod g+s {} \;

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
