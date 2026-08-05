# GurkyNet Azure VPS Deployment Runbook

## Stack
- Ubuntu 22.04/24.04
- Nginx + PHP 8.4-FPM (production)
- MySQL 8
- Node 20 (build only)
- Supervisor (queue + scheduler)
- Let's Encrypt SSL
- Domain: `https://gurkynet.my.id`

## One-time setup
1. Clone repo to `/var/www/gurkynet`
2. Copy `laravel/.env.example` → `laravel/.env`, fill production secrets
3. `cd laravel && composer install --no-dev && php artisan key:generate`
4. `php artisan migrate --force && php artisan storage:link && php artisan optimize`
5. Install Nginx site from `deploy/nginx/gurkynet.conf` (or `gurkynet-api.conf`)
6. Install PHP upload limits: `cp deploy/php/99-gurkynet-uploads.ini /etc/php/8.4/fpm/conf.d/` then `systemctl reload php8.4-fpm`
7. Install Supervisor programs from `deploy/supervisor/`
8. Cron alternative (if not using supervisor scheduler):
   `* * * * * www-data cd /var/www/gurkynet/laravel && php artisan schedule:run >> /dev/null 2>&1`
9. Permissions:
   `chown -R www-data:www-data storage bootstrap/cache`
   `chmod -R ug+rwx storage bootstrap/cache`

## Upload limits (Media Library / HTTP 413)
HTTP **413 Payload Too Large** is returned by **Nginx** when the request body exceeds `client_max_body_size` (often default `1m`). PHP `upload_max_filesize` does **not** return 413.

Target production values:
- `client_max_body_size 20M` (Nginx)
- `upload_max_filesize = 20M` (PHP-FPM)
- `post_max_size = 25M` (PHP-FPM)
- `max_execution_time = 300`
- `max_input_time = 300`

Repair on the VPS (as root):

```bash
cd /var/www/gurkynet
sudo bash deploy/fix-upload-limits.sh
```

Manual diagnosis:

```bash
# Which PHP-FPM is active?
systemctl status php8.4-fpm
php-fpm8.4 -tt
grep -RInE 'upload_max_filesize|post_max_size' /etc/php/8.4/

# Nginx limits actually loaded
sudo nginx -T | grep -n client_max_body_size
sudo nginx -T | grep -n server_name

# After fix
sudo systemctl reload php8.4-fpm
sudo systemctl reload nginx
php -r "echo ini_get('upload_max_filesize'), PHP_EOL, ini_get('post_max_size'), PHP_EOL;"
```

## Required production secrets
- `APP_KEY`, DB credentials
- `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`
- `DIGIFLAZZ_USERNAME`, `DIGIFLAZZ_API_KEY`, `DIGIFLAZZ_WEBHOOK_SECRET`
- `HEALTH_METRICS_TOKEN`
- `CORS_ALLOWED_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`
- Optional: `FCM_SERVER_KEY`, `CDN_URL`

## Ongoing deploy
Run `deploy/deploy.sh` (or CI equivalent).

## Backups
- Daily MySQL dump + `storage/app` snapshot
- Retain 14 days minimum
- Test restore monthly

## Monitoring
- `GET /api/health` (public liveness)
- `GET /api/metrics` with header `X-Health-Token: $HEALTH_METRICS_TOKEN`
- Watch `storage/logs/laravel-*.log`, `worker.log`
