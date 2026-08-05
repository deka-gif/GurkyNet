# GurkyNet Azure VPS Deployment Runbook

## Stack
- Ubuntu 22.04/24.04
- Nginx + PHP 8.3-FPM
- MySQL 8
- Node 20 (build only)
- Supervisor (queue + scheduler)
- Let's Encrypt SSL

## One-time setup
1. Clone repo to `/var/www/gurkynet`
2. Copy `laravel/.env.example` → `laravel/.env`, fill production secrets
3. `cd laravel && composer install --no-dev && php artisan key:generate`
4. `php artisan migrate --force && php artisan storage:link && php artisan optimize`
5. Install Nginx site from `deploy/nginx/gurkynet-api.conf`
6. Install Supervisor programs from `deploy/supervisor/`
7. Cron alternative (if not using supervisor scheduler):
   `* * * * * www-data cd /var/www/gurkynet/laravel && php artisan schedule:run >> /dev/null 2>&1`
8. Permissions:
   `chown -R www-data:www-data storage bootstrap/cache`
   `chmod -R ug+rwx storage bootstrap/cache`

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
