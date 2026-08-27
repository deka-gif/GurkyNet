# Backup & Restore Drill Plan

**SRS:** Bagian 8.3 (backup ≥24h, retention ≥30 days), Bagian 25  
**Database:** MySQL 8  
**Date:** 2026-08-28  
**Status:** PLAN — restore **NOT VERIFIED** (drill not yet executed)

---

## 1. Purpose

Prove that a MySQL backup can be restored to an **isolated** database and that the application can pass smoke tests. Until a drill is executed and logged, **do not claim backup readiness**.

---

## 2. Backup sources

| Source | Location (suggested) | Frequency |
|--------|---------------------|-----------|
| Scheduled MySQL dump | `/var/backups/gurkynet/mysql/daily-*.sql.gz` | Daily (per `deploy/AZURE_VPS_RUNBOOK.md`) |
| Pre-deploy snapshot | `/var/backups/gurkynet/mysql/predeploy-*.sql.gz` | Before each migrate deploy |
| `storage/app` files | `/var/backups/gurkynet/storage/` | Daily or with DB dump |

This drill uses a **recent daily dump** or a **pre-deploy snapshot** — never production live tables as the restore target name.

---

## 3. Drill procedure (isolated restore)

### Phase A — Preparation

1. Schedule drill in maintenance window (staging preferred for first drill).
2. Assign operator + witness.
3. Select backup file: `predeploy-*.sql.gz` or `daily-*.sql.gz`.
4. Record backup metadata (`.meta.json` if present).

### Phase B — Isolated restore database

```bash
# Create isolated DB — never restore over production in-place without explicit approval
mysql -h "${DB_HOST}" -u "${DB_USERNAME}" -p -e \
  "CREATE DATABASE IF NOT EXISTS gurkynet_restore_drill_YYYYMMDD CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

zcat /var/backups/gurkynet/mysql/<chosen-backup>.sql.gz \
  | mysql -h "${DB_HOST}" -u "${DB_USERNAME}" -p gurkynet_restore_drill_YYYYMMDD
```

### Phase C — Integrity verification

```bash
mysql -h "${DB_HOST}" -u "${DB_USERNAME}" -p gurkynet_restore_drill_YYYYMMDD -e "
  SELECT COUNT(*) AS users FROM users;
  SELECT COUNT(*) AS wallets FROM wallets;
  SELECT COUNT(*) AS transactions FROM transactions;
  SELECT COUNT(*) AS wallet_mutations FROM wallet_mutations;
  SELECT MAX(id) AS max_tx_id FROM transactions;
"
```

Compare counts/order-of-magnitude with source environment at backup time. Investigate zero tables or obvious truncation.

### Phase D — Migration / schema verification

Point a **throwaway** Laravel `.env.drill` at `gurkynet_restore_drill_YYYYMMDD`:

```bash
cd laravel
# Use separate env file; do not overwrite production .env
php artisan migrate:status --env=drill
php artisan migrate --pretend --env=drill
```

Expected: either all migrations applied, or `--pretend` shows only safe pending migrations.

### Phase E — Application smoke test (read-only)

Against drill DB (temporary app instance or `APP_ENV=drill`):

| Test | Command / action | Expected |
|------|------------------|----------|
| Health | `curl -fsS https://<drill-host>/api/health` | 200 OK |
| Auth | Login test user (staging credentials) | Token issued |
| Read-only wallet | `GET /api/v1/wallet` | Balance matches DB |
| Read-only tx list | `GET /api/v1/transactions` | No 500 |
| Features | `GET /api/v1/features` | Financial flags `false` |

**Do not** run purchase/withdraw/top-up on drill unless explicitly part of isolated test plan.

### Phase F — Cleanup

```bash
mysql -h "${DB_HOST}" -u "${DB_USERNAME}" -p -e \
  "DROP DATABASE gurkynet_restore_drill_YYYYMMDD;"
```

Remove temporary vhost / `.env.drill`.

---

## 4. Rollback conditions (abort drill)

Stop and escalate if:

- `gzip -t` fails on backup file
- Restore SQL errors or incomplete import
- Row counts wildly inconsistent with backup metadata
- `migrate --pretend` shows destructive DDL on financial tables
- Smoke tests return 5xx on read-only endpoints

---

## 5. Evidence to record

Store in `docs/evidence/restore-drill-YYYYMMDD/` (create when drill runs):

| Artifact | Description |
|----------|-------------|
| `backup-file.txt` | Path, size, sha256 of `.sql.gz` |
| `meta.json` | Git SHA, backup time, operator |
| `row-counts.txt` | Output of Phase C queries |
| `migrate-status.txt` | `migrate:status` output |
| `smoke-test.txt` | curl results / HTTP codes |
| `verdict.txt` | PASS / FAIL + sign-off |

---

## 6. Verification status

| Item | Status |
|------|--------|
| Drill plan documented | ✅ |
| Drill executed | ❌ **NOT VERIFIED** |
| Monthly schedule | ❌ Not started |

---

## 7. References

- `docs/PRE_DEPLOY_SNAPSHOT_RUNBOOK.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `deploy/AZURE_VPS_RUNBOOK.md` — "Test restore monthly"
