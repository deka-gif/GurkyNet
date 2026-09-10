#!/usr/bin/env bash
# READ/OPS helper — fix file-cache writability for www-data (queue workers).
# Does not modify application code or database.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/GurkyNet}"
CACHE_DATA="$APP_DIR/laravel/storage/framework/cache/data"

sudo mkdir -p "$CACHE_DATA"
sudo mkdir -p "$APP_DIR/laravel/storage/framework/sessions"
sudo mkdir -p "$APP_DIR/laravel/storage/framework/views"
sudo mkdir -p "$APP_DIR/laravel/storage/logs"
sudo mkdir -p "$APP_DIR/laravel/bootstrap/cache"

# Remove non-www-data owned hash shards that block nested mkdir by the worker.
if [ -d "$CACHE_DATA" ]; then
  sudo find "$CACHE_DATA" -mindepth 1 -maxdepth 1 -type d ! -user www-data -exec rm -rf {} + 2>/dev/null || true
fi

sudo chown -R www-data:www-data "$APP_DIR/laravel/storage" "$APP_DIR/laravel/bootstrap/cache"
sudo chmod -R ug+rwx "$APP_DIR/laravel/storage" "$APP_DIR/laravel/bootstrap/cache"
sudo find "$APP_DIR/laravel/storage/framework/cache" -type d -exec chmod g+s {} \;

echo "OK: storage/framework/cache is writable for www-data"
ls -la "$APP_DIR/laravel/storage/framework/cache" | head -20
