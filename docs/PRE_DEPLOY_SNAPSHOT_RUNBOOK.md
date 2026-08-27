# Pre-Deploy Database Snapshot Runbook

**SRS:** Bagian 25 — snapshot/backup before major deployment  
**Database:** MySQL 8 (repository baseline per `laravel/.env.example`)  
**Date:** 2026-08-28  
**Status:** PROCEDURE — not executed against production

---

## 1. When to run

- Before **every** staging or production deploy that includes `php artisan migrate --force`
- Before enabling any financial feature flag on an environment with real or semi-real data
- Before schema changes touching `transactions`, `wallets`, `wallet_mutations`, `idempotency_requests`

**Do not** run against production from a developer workstation without Ops authorization and VPN/bastion access.

---

## 2. Roles

| Role | Responsibility |
|------|----------------|
| **Deploy operator** | Executes dump, records metadata |
| **Reviewer** | Verifies gzip integrity and file size |
| **Owner/Finance** | Approves deploy if financial tables affected |

---

## 3. T-30 procedure (minimum)

Perform at **T-30 minutes** (or earlier) before `migrate --force`.

### Step 1 — Record release metadata

```bash
cd /var/www/gurkynet   # adjust path

export RELEASE_SHA="$(git rev-parse HEAD)"
export RELEASE_TAG="${RELEASE_TAG:-manual-$(date +%Y%m%d-%H%M)}"
export DUMP_DIR="/var/backups/gurkynet/mysql"
mkdir -p "$DUMP_DIR"

# Migration batch (before migrate)
cd laravel
export MIGRATION_BATCH_BEFORE="$(php artisan migrate:status | tail -n 5)"
cd ..
```

Record in deploy log: operator name, environment (`staging`/`production`), `RELEASE_SHA`, `RELEASE_TAG`.

### Step 2 — Database dump (MySQL 8)

```bash
export DUMP_FILE="${DUMP_DIR}/predeploy-${RELEASE_TAG}-${RELEASE_SHA:0:7}-$(date +%Y%m%d-%H%M%S).sql"

mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --hex-blob \
  --default-character-set=utf8mb4 \
  -h "${DB_HOST}" \
  -u "${DB_USERNAME}" \
  -p"${DB_PASSWORD}" \
  "${DB_DATABASE}" \
  > "${DUMP_FILE}"
```

**Security:** Prefer `.my.cnf` or credential file with `chmod 600` instead of password on command line in shared history. **Do not** store passwords in this document or in git.

### Step 3 — Compress

```bash
gzip -9 "${DUMP_FILE}"
export DUMP_GZ="${DUMP_FILE}.gz"
```

### Step 4 — Integrity check

```bash
# Must exit 0
gzip -t "${DUMP_GZ}"

# Non-zero size
ls -lh "${DUMP_GZ}"

# Optional: row count spot-check from dump header
zcat "${DUMP_GZ}" | head -n 30
```

### Step 5 — Filename convention

```
predeploy-{RELEASE_TAG}-{GIT_SHA_7}-{YYYYMMDD-HHMMSS}.sql.gz
```

Example: `predeploy-sprint19-staging-8429c67-20260828-143000.sql.gz`

### Step 6 — Store metadata sidecar

Create `${DUMP_GZ}.meta.json` (no secrets):

```json
{
  "environment": "staging",
  "git_sha": "abc1234",
  "release_tag": "sprint19-staging",
  "database": "gurkynet_staging",
  "created_at_utc": "2026-08-28T07:30:00Z",
  "operator": "ops-handle",
  "migration_status_snippet": "see deploy log",
  "gzip_integrity": "pass"
}
```

### Step 7 — Retention

- Staging: retain minimum **14 days** (align with `deploy/AZURE_VPS_RUNBOOK.md`)
- Production: retain per Finance/compliance policy (financial data ≥10 years in application; dumps are operational, not legal archive)

---

## 4. Post-snapshot deploy gate

Only proceed if:

- [ ] `gzip -t` passed
- [ ] File size reasonable vs previous dump
- [ ] `RELEASE_SHA` matches code about to deploy
- [ ] `migrate --pretend` reviewed (staging) — see `docs/STAGING_READINESS.md`

Then:

```bash
cd laravel
php artisan migrate --force
php artisan migrate:status   # record MIGRATION_BATCH_AFTER
```

---

## 5. What this runbook does NOT do

- Does not backup `storage/app` (see `deploy/AZURE_VPS_RUNBOOK.md` for file snapshot)
- Does not replace legal 10-year financial retention policy
- Does not run automatically from `deploy/deploy.sh` today — **manual gate** until CI integration

---

## 6. Verification status

| Check | Status |
|-------|--------|
| Procedure documented | ✅ |
| Executed on production | ❌ NOT EXECUTED |
| Executed on staging | ❌ NOT EXECUTED (no staging yet) |
