# GurkyNet — Staging Environment Readiness

**SRS:** Bagian 10.2, 25 (dev / staging / production separation)  
**Sprint:** 19 Operational Readiness  
**Date:** 2026-08-28  
**Status:** PLAN — staging not provisioned yet

---

## 1. Purpose

Staging is required before SRS Bagian 24 manual go-live tests and before any production financial feature enablement. Staging must use **sandbox/test** credentials only.

---

## 2. Architecture (recommended)

```
                    ┌─────────────────────────────────────┐
                    │  staging.gurkynet.my.id (or equiv)  │
                    │  Nginx → static dist/ (Vite build)  │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────────────┐
                    │  staging-api.gurkynet.my.id           │
                    │  Nginx → laravel/public (PHP 8.4)   │
                    │  Supervisor: queue + scheduler      │
                    └──────────────┬──────────────────────┘
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
    ┌──────▼──────┐        ┌───────▼───────┐      ┌────────▼────────┐
    │ MySQL 8     │        │ Redis (opt.)  │      │ storage/app     │
    │ staging DB  │        │ cache/queue   │      │ public media    │
    └─────────────┘        └───────────────┘      └─────────────────┘
           │
    Sandbox: Midtrans, Digiflazz test, VIP test, Partner sandbox
```

**Separation from production:** Separate VPS or separate DB + vhost; never share production DB or production API keys.

---

## 3. Hosts (to be confirmed by Owner/Ops)

| Role | Suggested hostname | Notes |
|------|-------------------|-------|
| **Frontend (SPA)** | `https://staging.gurkynet.my.id` | Serves `dist/` after `npm run build` |
| **API (Laravel)** | `https://staging-api.gurkynet.my.id` | Document root: `laravel/public` |
| **DB** | Private host only | MySQL 8 — not publicly exposed |

Adjust hostnames to match DNS actually provisioned. Document final URLs in Owner decision register when approved.

---

## 4. Environment variables (staging template)

Copy `laravel/.env.example` → `laravel/.env` on staging server. **Never commit `.env`.**

### Application

| Variable | Staging value |
|----------|---------------|
| `APP_ENV` | `staging` |
| `APP_DEBUG` | `false` (use `true` only for short-lived debugging) |
| `APP_URL` | `https://staging-api.gurkynet.my.id` |
| `APP_KEY` | Generate per staging: `php artisan key:generate` |

### Database

| Variable | Staging value |
|----------|---------------|
| `DB_CONNECTION` | `mysql` |
| `DB_HOST` | Staging DB private IP/hostname |
| `DB_DATABASE` | `gurkynet_staging` (suggested) |
| `DB_USERNAME` / `DB_PASSWORD` | Staging-only credentials (vault) |

### Frontend (build-time)

| Variable | Staging value |
|----------|---------------|
| `VITE_API_BASE_URL` | `https://staging-api.gurkynet.my.id/api/v1` |

### CORS & Sanctum

| Variable | Staging value |
|----------|---------------|
| `CORS_ALLOWED_ORIGINS` | `https://staging.gurkynet.my.id` |
| `SANCTUM_STATEFUL_DOMAINS` | `staging.gurkynet.my.id` |

### Financial feature flags (default — safe)

| Variable | Staging default | Notes |
|----------|-----------------|-------|
| `PURCHASE_ENABLED` | **`false`** | Enable only after Owner written approval for SRS 24 manual tests |
| `WITHDRAW_ENABLED` | **`false`** | Same |
| `AUTO_TOPUP_ENABLED` | **`false`** | Same |
| `PARTNER_API_ENABLED` | **`false`** | Production partner path stays off |
| `PARTNER_API_SANDBOX_ENABLED` | `true` | Sandbox partner API allowed |

### Payment — Midtrans (sandbox)

| Variable | Staging value |
|----------|---------------|
| `MIDTRANS_IS_PRODUCTION` | **`false`** |
| `MIDTRANS_SERVER_KEY` | Midtrans **sandbox** server key (vault) |
| `MIDTRANS_CLIENT_KEY` | Midtrans **sandbox** client key (vault) |

### Providers — Digiflazz / VIP (test)

| Variable | Staging value |
|----------|---------------|
| `DIGIFLAZZ_USERNAME` / `DIGIFLAZZ_API_KEY` / `DIGIFLAZZ_SECRET` | Digiflazz **test/dev** credentials (vault) |
| `DIGIFLAZZ_WEBHOOK_SECRET` | Staging webhook secret |
| `VIP_MERCHANT_ID` / `VIP_API_KEY` | VIP **test** credentials (vault) |
| `VIP_PRODUCT_PROVIDER_ENABLED` | `true` (if failover tests needed) |

### Queue, cache, scheduler

| Variable | Staging value |
|----------|---------------|
| `QUEUE_CONNECTION` | `database` (or `redis` if provisioned) |
| `CACHE_STORE` | `database` |
| Supervisor | `deploy/supervisor/gurkynet-worker.conf` |
| Cron / scheduler | `deploy/supervisor/gurkynet-scheduler.conf` or cron `* * * * * php artisan schedule:run` |

### Storage

| Variable | Staging value |
|----------|---------------|
| `FILESYSTEM_DISK` | `public` |
| Run once | `php artisan storage:link` |

### Observability

| Variable | Staging value |
|----------|---------------|
| `HEALTH_METRICS_TOKEN` | Staging-only token (vault) |
| Health | `GET /api/health` |

### HTTPS

- Let's Encrypt (or equivalent) on staging vhosts
- Force HTTP → HTTPS (see `deploy/nginx/gurkynet.conf` template)

---

## 5. Staging deploy procedure (high level)

1. Provision server + MySQL + DNS
2. Clone repo at release SHA (see `docs/RELEASE_BASELINE.md`)
3. Configure `laravel/.env` and root `.env` for Vite
4. `cd laravel && composer install --no-dev && php artisan key:generate`
5. **Migration dry-run:** `php artisan migrate --pretend` (review output)
6. **Pre-deploy snapshot** if upgrading existing staging DB (see `docs/PRE_DEPLOY_SNAPSHOT_RUNBOOK.md`)
7. `php artisan migrate --force`
8. `php artisan storage:link && php artisan optimize`
9. `npm ci && npm run build` at repo root
10. Configure Nginx + Supervisor; reload services
11. Smoke: `curl -fsS https://staging-api.../api/health`
12. Verify feature flags via `GET /api/v1/features` — all financial gates `false`

---

## 6. Migration dry-run (staging only)

**Never run on production without snapshot.**

```bash
cd /var/www/gurkynet/laravel   # or staging app path

# Review pending migrations without applying
php artisan migrate --pretend

# Record output in deploy log:
# - migration filenames
# - SQL statements (if shown)
# - git SHA
# - date/time
```

If `--pretend` shows destructive operations on financial tables, **stop** and escalate to Owner/Finance before applying.

**Apply (staging only, after snapshot if DB not empty):**

```bash
php artisan migrate --force
php artisan migrate:status   # record batch numbers
```

---

## 7. Manual SRS 24 — staging flag policy

SRS Bagian 24 tests require purchase/withdraw paths. On staging **only**, after Owner written approval recorded in `docs/OWNER_GO_LIVE_DECISIONS.md`:

| Flag | Allowed on staging for manual test? |
|------|-----------------------------------|
| `PURCHASE_ENABLED` | Yes — **staging only**, time-boxed, with test accounts |
| `WITHDRAW_ENABLED` | Yes — **staging only**, Tier-2 test agent |
| `AUTO_TOPUP_ENABLED` | Optional — Midtrans sandbox only |
| `PARTNER_API_ENABLED` | Prefer sandbox (`PARTNER_API_SANDBOX_ENABLED=true`) without enabling production partner path |

**Not enabled in this Sprint 19 execution.** Revert flags to `false` after manual test window.

---

## 8. Current status

| Item | Status |
|------|--------|
| Staging VPS | **NOT PROVISIONED** |
| Staging DNS | **NOT CONFIGURED** |
| Staging `.env` | **NOT DEPLOYED** |
| Staging DB | **NOT CREATED** |
| CORS live verification | **NOT VERIFIED** |
| Feature flags on staging | **N/A** — no staging yet |

---

## 9. References

- `deploy/AZURE_VPS_RUNBOOK.md` — production-oriented; adapt for staging
- `deploy/deploy.sh` — deploy sequence
- `docs/PRE_DEPLOY_SNAPSHOT_RUNBOOK.md`
- `docs/SRS24_MANUAL_TEST_KIT.md`
- `docs/OWNER_GO_LIVE_DECISIONS.md`
