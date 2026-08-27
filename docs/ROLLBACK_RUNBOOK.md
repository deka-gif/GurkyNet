# Rollback Runbook

**SRS:** Bagian 25 — reversible deployment  
**Date:** 2026-08-28  
**Status:** PROCEDURE — not executed on production

---

## 1. When to rollback

Trigger rollback if **any** of the following within 15 minutes of deploy:

- `GET /api/health` non-200
- Migration failure or partial migration
- Wallet balance anomalies detected
- Transaction state machine violations
- Error rate spike on financial endpoints
- Owner/Finance directive

---

## 2. Decision matrix

| Situation | Preferred rollback |
|-----------|-------------------|
| Code bug, DB unchanged | **A — Code rollback** only |
| Bad migration applied | **B — DB restore** from pre-deploy snapshot |
| Unknown / financial impact | **B — DB restore** + **A — Code rollback** to previous SHA |

**Rule:** For tables `wallets`, `wallet_mutations`, `transactions`, `idempotency_requests`, `withdraw_requests`, `deposit_requests` — **prefer snapshot restore** over `migrate:rollback`.

---

## 3. A — Code rollback

### Prerequisites

- Previous known-good git SHA recorded in deploy log
- Pre-deploy snapshot exists (if migrations ran)

### Steps

```bash
cd /var/www/gurkynet

export PREVIOUS_SHA="<recorded-good-sha>"
git fetch origin
git checkout "${PREVIOUS_SHA}"

cd laravel
composer install --no-dev --optimize-autoloader --no-interaction
php artisan config:clear
php artisan optimize

cd ..
npm ci
npm run build

sudo supervisorctl restart gurkynet-worker:* || true
sudo supervisorctl restart gurkynet-scheduler || true
sudo systemctl reload php8.4-fpm || sudo systemctl reload php8.3-fpm
sudo systemctl reload nginx
```

### Verify (Section 5)

---

## 4. B — Database rollback

### B1 — Preferred: restore pre-deploy snapshot

See `docs/PRE_DEPLOY_SNAPSHOT_RUNBOOK.md` for dump format.

```bash
# STOP application workers first to prevent writes
sudo supervisorctl stop gurkynet-worker:*

# Restore to same database name (ONLY with Owner approval)
zcat /var/backups/gurkynet/mysql/predeploy-<tag>-<sha>-<timestamp>.sql.gz \
  | mysql -h "${DB_HOST}" -u "${DB_USERNAME}" -p "${DB_DATABASE}"

sudo supervisorctl start gurkynet-worker:*
```

### B2 — Migration rollback (use with caution)

Only when:

- Migration `down()` reviewed and confirmed non-destructive
- No financial rows created since deploy
- Owner/Finance approved

```bash
cd laravel
php artisan migrate:status
php artisan migrate:rollback --step=1   # repeat only per reviewed plan
```

**Never** rollback migrations that dropped columns or truncated financial data without snapshot restore.

---

## 5. Post-rollback verification

| # | Check | Command / action | Pass criteria |
|---|-------|------------------|---------------|
| 1 | Health | `curl -fsS $APP_URL/api/health` | HTTP 200 |
| 2 | Read-only API | Authenticated `GET /api/v1/wallet` | 200, balance sane |
| 3 | Transaction list | `GET /api/v1/transactions?per_page=5` | 200, no 500 |
| 4 | Feature flags | `GET /api/v1/features` | `purchase_enabled`, `withdraw_enabled`, `auto_topup_enabled` = false (unless staging test window) |
| 5 | Wallet consistency | Spot-check: `SUM` mutations vs wallet balance for 3 random users | No obvious drift |
| 6 | Transaction state | No SUCCESS→FAILED illegal transitions in last hour | Query audit / tx log |
| 7 | Queue | `php artisan queue:failed` | No burst of new failures |
| 8 | Logs | `tail storage/logs/laravel-*.log` | No ongoing exception loop |

Record results in incident log with operator, timestamps, SHAs, snapshot file used.

---

## 6. Communication

1. Notify Owner + Finance if financial tables touched
2. Document root cause before re-attempting deploy
3. Do not re-enable `PURCHASE_ENABLED` / `WITHDRAW_ENABLED` until root cause closed and Owner approves

---

## 7. Verification status

| Item | Status |
|------|--------|
| Runbook documented | ✅ |
| Rollback drill executed | ❌ NOT EXECUTED |
| Production rollback tested | ❌ NOT EXECUTED |

---

## 8. References

- `docs/PRE_DEPLOY_SNAPSHOT_RUNBOOK.md`
- `docs/BACKUP_RESTORE_DRILL.md`
- `docs/RELEASE_BASELINE.md`
