# Security Production Readiness Checklist

**SRS:** Bagian 8.1, 17  
**Date:** 2026-08-28  
**Mode:** READ-ONLY audit template — live host **NOT VERIFIED** unless checked on server

Mark each item: ✅ VERIFIED | ⚠️ PARTIAL | ❌ NOT VERIFIED | N/A

---

## 1. CORS

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 1.1 | `CORS_ALLOWED_ORIGINS` lists only trusted SPA origins | `laravel/config/cors.php`, `.env.example` | ❌ NOT VERIFIED |
| 1.2 | No wildcard `*` with credentials on production | `supports_credentials: true` | ❌ NOT VERIFIED |
| 1.3 | Staging origins separate from production | `docs/STAGING_READINESS.md` | ❌ NOT VERIFIED |
| 1.4 | Preflight `OPTIONS` returns correct headers | — | ❌ NOT VERIFIED |

---

## 2. HTTPS & TLS

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 2.1 | HTTP redirects to HTTPS | `deploy/nginx/gurkynet.conf` | ❌ NOT VERIFIED |
| 2.2 | TLS 1.2+ (Let's Encrypt options) | Nginx template comments | ❌ NOT VERIFIED |
| 2.3 | API base URL uses `https://` in production FE env | `VITE_API_BASE_URL` | ❌ NOT VERIFIED |

---

## 3. HSTS

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 3.1 | `Strict-Transport-Security` header present | **Not in nginx template** | ❌ NOT CONFIGURED in repo |
| 3.2 | `max-age` ≥ 31536000 after soak period | — | ❌ NOT VERIFIED |

---

## 4. CSP (Content Security Policy)

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 4.1 | CSP header defined | **Not in nginx template** | ❌ NOT CONFIGURED |
| 4.2 | Midtrans Snap script allowlist (if used) | Sprint 11 removed hardcoded sandbox script | ⚠️ Review at deploy |

---

## 5. Security headers (nginx template)

| Header | In `deploy/nginx/gurkynet.conf` | Live status |
|--------|--------------------------------|-------------|
| `X-Frame-Options: DENY` | ✅ | ❌ NOT VERIFIED |
| `X-Content-Type-Options: nosniff` | ✅ | ❌ NOT VERIFIED |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ | ❌ NOT VERIFIED |

---

## 6. Authentication & session

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 6.1 | SPA uses Bearer token (`sanctum_token`) | `src/services/api.ts` | ✅ Code |
| 6.2 | Finance/Owner 2FA enforced | `Sprint12SecurityKycTest` | ✅ Automated |
| 6.3 | `SANCTUM_STATEFUL_DOMAINS` matches SPA host | `.env.example` | ❌ NOT VERIFIED live |
| 6.4 | Session lifetime configured | `SESSION_LIFETIME=120` | ❌ NOT VERIFIED live |
| 6.5 | Session revoke works | Sprint 12 test | ✅ Automated |

---

## 7. API exposure

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 7.1 | Admin routes behind auth + RBAC | `routes/api.php` | ✅ Code |
| 7.2 | Webhooks public but signature-checked | Midtrans/Digiflazz/VIP middleware | ✅ Tests |
| 7.3 | `/api/metrics` requires `HEALTH_METRICS_TOKEN` | Runbook | ❌ NOT VERIFIED live |
| 7.4 | Debug off in production | `APP_DEBUG=false` in example | ❌ NOT VERIFIED live |

---

## 8. Secret loading

| # | Check | Repo evidence | Live status |
|---|-------|---------------|-------------|
| 8.1 | Secrets in `.env` only, not in git | `.gitignore` | ✅ |
| 8.2 | Partner secrets encrypted at rest | `secret_encrypted` | ✅ Code |
| 8.3 | Midtrans server key not exposed to FE | `WalletController` comment | ✅ Code |
| 8.4 | Rotation runbook exists | `docs/SECRET_ROTATION_RUNBOOK.md` | ✅ Doc |

---

## 9. Webhook endpoints

| Endpoint | Throttle | Signature | Live status |
|----------|----------|-----------|-------------|
| `POST /api/v1/webhooks/midtrans` | 120/min | HMAC `signature_key` | ✅ Tests; ❌ live |
| `POST /api/v1/webhooks/digiflazz` | 120/min | Webhook secret | ✅ Tests; ❌ live |
| `POST /api/v1/webhooks/vip` | 120/min | Provider-specific | ✅ Tests; ❌ live |

---

## 10. Rate limiting

| Limiter | Limit | Scope | Evidence |
|---------|-------|-------|----------|
| `login` | 20/min | credential/IP | `AppServiceProvider` |
| `otp` | 5/min | identifier | ✅ |
| `financial` | 30/min | user id | ✅ |
| `POST /transactions` | 15/min | route | `routes/api.php` |
| Partner API | per-partner RPM | `PartnerApiRateLimit` | Sprint 17 tests |

Live enforcement: ❌ NOT VERIFIED

---

## 11. Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Ops | | | Live nginx/env audit |
| Owner | | | Accept residual risk |

**Overall live security posture:** ❌ **NOT VERIFIED** (template + code evidence only)
