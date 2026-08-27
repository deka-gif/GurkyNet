# Release Candidate Procedure

**SRS:** Bagian 25  
**Sprint:** 19 Final Readiness  
**Date:** 2026-08-28  
**Status:** PROCEDURE — **no release candidate created**

---

## 1. Prerequisites (Owner approval required)

Before creating any release branch or commit:

- [ ] Owner signed `docs/OWNER_GO_LIVE_DECISIONS.md` item **#10** (release baseline / branch)
- [ ] `php artisan test` — 825 pass / 1 known Finance pagination fail only
- [ ] `npm run build` — exit 0
- [ ] Working tree reviewed — no `.env`, `dist/`, or secrets staged
- [ ] Sprint 19 operational docs present in `docs/`
- [ ] **Explicit:** HEAD `8429c67` is Sprint 3 only; release commit will **first** capture Sprint 4–19 uncommitted work

**Do not proceed without Owner written approval.**

---

## 2. Pre-flight audit

```bash
git branch --show-current          # expect: main (or agreed integration branch)
git log -1 --oneline               # record: currently 8429c67 (Sprint 3)
git status --short | wc -l         # record dirty file count
git diff --stat                    # record scope
```

Record in release log:

| Field | Value (fill at execution time) |
|-------|-------------------------------|
| Operator | |
| Date UTC | |
| Source branch | |
| Dirty file count | |
| Diff stat summary | |

---

## 3. Branch creation

```bash
export RELEASE_DATE=$(date +%Y-%m-%d)
git checkout -b release/sprint19-${RELEASE_DATE}
```

Branch naming: `release/sprint19-YYYY-MM-DD` or `release/sprint19-staging-YYYY-MM-DD`.

---

## 4. Stage files (intentional scope)

```bash
# Backend
git add laravel/app laravel/bootstrap laravel/config laravel/database laravel/routes \
        laravel/composer.json laravel/composer.lock laravel/tests

# Frontend
git add src index.html package.json package-lock.json vite.config.ts tsconfig.json

# Deploy & docs
git add deploy docs .env.example laravel/.env.example .cursorrules

# Sprint 19 report (optional but recommended)
git add SPRINT19_EXECUTION_REPORT.md
```

**Never stage:**

- `.env`, `laravel/.env`
- `dist/` (gitignored — verify with `git check-ignore -v dist/`)
- `node_modules/`, `laravel/vendor/`
- `laravel/.phpunit.result.cache`
- Secrets, credentials, dumps

Verify:

```bash
git diff --cached --stat
git diff --cached --name-only | grep -E '\.env$|dist/' && echo "ABORT: secrets or dist staged" && exit 1
```

---

## 5. Commit procedure (only when Owner instructs)

```bash
git commit -m "$(cat <<'EOF'
Release candidate: Sprint 4–19 accumulated work

- First commit capturing implementation since HEAD 8429c67 (Sprint 3)
- Includes Sprint 19 operational readiness documentation
- Financial flags remain default OFF (PURCHASE/WITHDRAW/AUTO_TOPUP/PARTNER_API)
- Not production go-live; staging verification prerequisite

Regression: 825 PHPUnit pass / 1 known Finance pagination fail; npm run build PASS
EOF
)"
```

Record **release commit SHA**:

```bash
git rev-parse HEAD    # → record as RELEASE_CANDIDATE_SHA
```

---

## 6. SHA recording

Store in `docs/evidence/release-candidate-YYYYMMDD.json` (create at commit time):

```json
{
  "release_candidate_sha": "<full-sha>",
  "parent_sha": "8429c67",
  "branch": "release/sprint19-YYYY-MM-DD",
  "operator": "",
  "created_at_utc": "",
  "phpunit": "825 pass / 1 fail (FinanceTest settlements pagination)",
  "npm_build": "pass",
  "financial_flags_default": "all false"
}
```

Tag (optional, Owner approval):

```bash
git tag -a sprint19-rc1 -m "Sprint 19 release candidate 1"
```

**Do not push** until Owner approves remote and target environment.

---

## 7. Artifact verification (post-commit)

On a clean checkout of `RELEASE_CANDIDATE_SHA`:

```bash
cd laravel && composer install && php artisan test
cd .. && npm ci && npm run build
```

Confirm:

- [ ] Build exit 0
- [ ] Test count matches baseline (825/1)
- [ ] `config/features.php` defaults unchanged
- [ ] No `.env` in tree

---

## 8. Rollback reference

If release candidate is bad:

| Action | Reference |
|--------|-----------|
| Abandon branch | `git checkout main`; delete local `release/*` |
| Deploy rollback | `docs/ROLLBACK_RUNBOOK.md` §3 Code rollback |
| DB rollback | `docs/ROLLBACK_RUNBOOK.md` §4 — prefer snapshot restore |
| Pre-deploy snapshot | `docs/PRE_DEPLOY_SNAPSHOT_RUNBOOK.md` |

Previous known-good SHA before first RC: `8429c67` (Sprint 3 only — **not** functionally equivalent to current working tree).

---

## 9. Current status (audit 2026-08-28)

| Item | Status |
|------|--------|
| Release branch | **NOT CREATED** |
| Release commit | **NOT CREATED** |
| HEAD | `8429c67` — Sprint 3 only |
| Working tree | **DIRTY** (~296 paths) |
| False claim check | HEAD does **NOT** include Sprint 4–19 |

---

## 10. Related documents

- `docs/RELEASE_BASELINE.md`
- `docs/OWNER_GO_LIVE_DECISIONS.md` — decision #10
- `docs/STAGING_READINESS.md`
- `SPRINT19_EXECUTION_REPORT.md`
