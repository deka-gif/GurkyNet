# Secret Rotation Runbook

**SRS:** Bagian 8.1 (encrypted secret storage)  
**Date:** 2026-08-28  
**Status:** DOCUMENTATION ONLY — no secrets rotated in this execution

> **Never** paste actual secret values in tickets, git, or chat. Use a password manager / vault.

---

## 1. Secret inventory

| Secret | Env var(s) | Owner (role) | Rotation trigger |
|--------|------------|--------------|------------------|
| Application key | `APP_KEY` | **Owner + Ops** | Compromise; annual policy |
| Midtrans server | `MIDTRANS_SERVER_KEY` | **Finance + Ops** | Compromise; Midtrans dashboard rotation |
| Midtrans client | `MIDTRANS_CLIENT_KEY` | **Finance + Ops** | Paired with server key rotation |
| Digiflazz API | `DIGIFLAZZ_API_KEY`, `DIGIFLAZZ_SECRET` | **Ops** | Compromise; vendor rotation |
| Digiflazz webhook | `DIGIFLAZZ_WEBHOOK_SECRET` | **Ops** | Webhook forgery incident |
| VIPayment | `VIP_MERCHANT_ID`, `VIP_API_KEY` | **Ops** | Compromise; vendor rotation |
| Partner API secrets | DB `api_credentials.secret_encrypted` | **Ops + Partner admin** | Scheduled; compromise; partner offboarding |
| Health/metrics | `HEALTH_METRICS_TOKEN` | **Ops** | Exposure in logs; quarterly |
| DB password | `DB_PASSWORD` | **Ops** | Compromise; personnel change |
| FCM | `FCM_SERVER_KEY` | **Ops** | Compromise |

---

## 2. General rotation order

1. **Prepare** new secret in vault (do not delete old yet)
2. **Staging first** — validate full flow
3. **Production maintenance window** — low traffic
4. **Deploy** new env value or credential row
5. **Invalidate** old secret at provider (Midtrans/Digiflazz/VIP) or revoke DB credential
6. **Validate** (Section 4)
7. **Document** rotation in audit log (no secret values)

---

## 3. Per-secret procedures

### 3.1 APP_KEY

**Risk:** Rotating `APP_KEY` breaks Laravel encryption for existing `secret_encrypted` partner credentials and encrypted columns.

**Order:**
1. Export/decrypt dependent secrets using **current** key (Partner credential re-encryption plan)
2. `php artisan key:generate` on staging → re-encrypt partner secrets → full regression
3. Production: maintenance window; re-encrypt partner credentials; deploy new key
4. **Validation:** Partner HMAC auth, encrypted fields readable

**Do not** rotate APP_KEY without Partner API re-encryption plan.

### 3.2 Midtrans

1. Generate new keys in Midtrans dashboard (sandbox first, then production)
2. Update `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` in vault
3. Update staging `.env`; restart php-fpm
4. Test: sandbox top-up + webhook signature validation (`Sprint11` scenarios)
5. Update production `.env`; reload
6. Disable old keys in Midtrans dashboard
7. **Validation:** `POST /webhooks/midtrans` with real sandbox settlement; forged signature still 401

### 3.3 Digiflazz

1. Request new API key/secret from Digiflazz
2. Update env vars on staging
3. Test: price sync, test transaction, webhook with new `DIGIFLAZZ_WEBHOOK_SECRET`
4. Production swap during low traffic
5. Revoke old key at Digiflazz
6. **Validation:** Health probe + one sandbox fulfillment

### 3.4 VIPayment

1. Rotate API ID/key in VIP dashboard
2. Update `VIP_MERCHANT_ID`, `VIP_API_KEY` (signature auto: `md5(id+key)`)
3. Staging catalog sync + test order
4. Production swap
5. **Validation:** VIP health check + status sync job

### 3.5 Partner API

**In-app rotation (preferred):**
- Ops: `POST /api/v1/admin/partner-credentials/{id}/rotate`
- Partner portal: `POST /api/v1/partner-portal/credentials/{id}/rotate`
- New secret shown **once** — partner must update HMAC client
- Old credential revoked via `revoke` endpoint

**Validation:**
- Old key returns 401
- New key: `GET /api/v1/partner/price` succeeds
- Execute sandbox transaction with new secret

### 3.6 HEALTH_METRICS_TOKEN

1. Generate new random token in vault
2. Update env; `php artisan config:clear && php artisan optimize`
3. **Validation:** `GET /api/metrics` with new `X-Health-Token` → 200; old token → 403

---

## 4. Post-rotation validation checklist

- [ ] Health endpoint 200
- [ ] Midtrans webhook accepts valid signature; rejects forged
- [ ] Digiflazz/VIP health probes green
- [ ] Partner sandbox HMAC auth works with new secret
- [ ] No spike in `storage/logs` auth errors
- [ ] Old credentials confirmed disabled at provider

---

## 5. Execution status

| Secret | Last rotated | Verified |
|--------|--------------|----------|
| All | — | ❌ No rotation performed in Sprint 19 ops work |

---

## 6. References

- `laravel/app/Services/PartnerApi/PartnerCredentialService.php`
- `deploy/AZURE_VPS_RUNBOOK.md` — Required production secrets list
- `docs/SECURITY_PRODUCTION_CHECKLIST.md`
