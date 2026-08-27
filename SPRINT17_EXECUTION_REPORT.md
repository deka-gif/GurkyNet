# SPRINT 17 EXECUTION REPORT — Partner H2H API (Bagian 30)

**Date:** 2026-08-27  
**Status:** READY FOR VERIFICATION (not COMPLETE)  
**SRS:** Bagian 30 / FR-API-01..11  
**Gates:** `PARTNER_API_ENABLED=false` (default) · `PURCHASE_ENABLED` / `WITHDRAW_ENABLED` / `AUTO_TOPUP_ENABLED` unchanged (OFF)

---

## Summary

Sprint 17 implements Mitra/Reseller H2H API on the existing transaction + ProviderRouter path. Partner wallets, credentials, HMAC auth, price inquiry, execute/status, signed webhooks, rate limits, sandbox, abuse flags, minimal portal API, and OpenAPI are in place. No second transaction/provider engine. Inquiry tagihan Mitra remains out of scope.

---

## FR coverage

| ID | Item | Implementation |
|----|------|----------------|
| FR-API-01 | Application → pending → Ops/Owner approve/reject | `PartnerApplicationService` + portal apply + Ops/Owner admin routes |
| FR-API-02 | API Key + Secret | `PartnerCredentialService`; secret encrypted; **one-time** in approve/rotate response |
| FR-API-03 | HMAC-SHA256(body, secret) | `AuthenticatePartnerApi`; headers `X-API-Key`, `X-Signature`, `X-Timestamp` (±5m); replay cache |
| FR-API-04 | Price/stock | `GET /api/v1/partner/price`; `partner_product_prices` (isolated from agent `product_prices`) |
| FR-API-05 | Execute + idempotency | `POST /api/v1/partner/execute`; `IdempotencyRequestService` scoped `partner_api:execute:{id}` |
| FR-API-06 | Status by partner_ref | `GET/POST /api/v1/partner/status`; partner-scoped |
| FR-API-07 | Signed webhook | `PartnerWebhookService` + `DeliverPartnerWebhookJob`; max 3; delays 60/300/1800s; `event_key` unique |
| FR-API-08 | Rate limit | `PartnerApiRateLimit`; default **60/min/partner**; per-partner `rate_limit_per_minute` |
| FR-API-09 | Minimal portal | `/api/v1/partner-portal/*` + `apps/partner-portal/` stub |
| FR-API-10 | OpenAPI | `GET /api/v1/partner/openapi.json` |
| FR-API-11 | Revoke / rotate | Ops + portal; audit via `ActivityLog` (no plaintext secret) |

---

## Schema (30.3 + additive)

Migration: `laravel/database/migrations/2026_08_27_700001_create_partner_api_tables.php` (reversible `up`/`down`).

- `api_partners`, `api_credentials`, `partner_wallets`, `partner_wallet_mutations`
- `partner_deposit_requests`, `partner_product_prices`
- `api_request_logs`, `api_webhook_deliveries`, `partner_abuse_flags`
- `transactions`: additive `channel`, `partner_id`, `partner_ref`

Secret storage: `secret_encrypted` (APP_KEY Crypt) — required for HMAC verify; not logged; not returned after initial display.

---

## Auth canonical

- Signature = `HMAC-SHA256(raw body, API Secret)` (SRS 30.4)
- Timestamp skew = **300s** (`config/partner_api.php`)
- Replay = cache key `api_key + timestamp + body_hash` within skew window
- Optional IP whitelist only when configured (does not block basic API when empty)

---

## Transaction model

- Reuses `transactions` with `channel=partner_api`, `partner_id`, `partner_ref`
- Debit: **partner_wallets** only (row lock); user wallet untouched
- Fulfillment: `ProcessProductProviderTransaction` → existing `ProductProviderFulfillmentService` / ProviderRouter
- Refunds on partner channel: `WalletRefundService` credits `partner_wallets` (not user wallet)
- Loyalty / referral: excluded for `channel=partner_api`

---

## Partner wallet & deposit

- Separate from user/agent wallets
- Deposit MVP: partner request → Finance approve/reject (manual; no bank API)
- Duplicate Finance approve: safe (mutation `reference_id` guard)

---

## Sandbox

- Sandbox credentials (`pk_test_*`, `is_sandbox=true`)
- No real partner debit; no `ProcessProductProviderTransaction`; no financial webhook side effects
- Production execute still gated by `PARTNER_API_ENABLED` (default false)

---

## Abuse

- Signals: invalid key/signature, timestamp skew, replay
- Status: **FLAGGED** only; `auto_suspend_enabled=false`; no invented numeric thresholds

---

## RBAC

| Actor | Allowed |
|-------|---------|
| Ops | approve/reject, partner pricing, rate limit, revoke/rotate, abuse list |
| Owner | approve/reject via `/admin/executive/partners/*`; monitoring list |
| Finance | partner deposit approve/reject |
| Partner | own portal + H2H API only |
| User/CS/Marketing | no partner mutation |

---

## Tests

`Sprint17PartnerApiTest` — **13/13 PASS** (covers lifecycle, auth, isolation, price, wallet, execute/idempotency, status, webhook, RPM, sandbox, abuse, portal/OpenAPI, gate regression).

### Full suite regression

| Result | Count |
|--------|-------|
| PASS | **815** |
| FAIL | **1** — pre-existing `FinanceTest::finance_user_can_list_settlements` (`pagination` key) |
| Sprint 17 | all green |
| New regression from S17 | **none observed** |

### Frontend

- `npm run lint` / `npm run build`: **pre-existing** TS debt (incl. Sprint 16 `AccountReferralPage`, `RealtimeManager` `../../api`, finance store). **Not fixed** (out of Sprint 17 scope).

---

## Findings

1. Secret uses encryption (not irreversible hash) so HMAC verification can run server-side — intentional.
2. Owner approve is on executive routes (Ops group remains Owner read-only per existing policy).
3. Sandbox SUCCESS does not fire production webhook/loyalty/referral paths.
4. GET price HMAC signs **empty body** (query params unsigned) — matches SRS 30.4 body-only HMAC.

---

## Out of scope (confirmed)

- Inquiry tagihan Mitra
- Mandatory IP whitelist
- Auto-suspend thresholds
- Bank API / Mitra PG for deposit
- User purchase / withdraw / auto-topup go-live
- Digi/VIP/Midtrans/KYC/loyalty/referral/recon rewrites
- Sprint 18+

---

## Completion gate (self-check)

- [x] FR-API-01..08, 11 + FR-API-09/10 minimal  
- [x] HMAC + 5m + replay  
- [x] Partner pricing isolated  
- [x] Execute + idempotency + partner_wallet lock + `channel=partner_api`  
- [x] ProviderRouter reuse (job dispatch)  
- [x] Webhook signed, 3 retries 1m/5m/30m, idempotent  
- [x] 60 RPM default, per-partner  
- [x] Sandbox safe  
- [x] Abuse flag only  
- [x] Migration reversible  
- [x] Tests PASS; regression = known Finance pagination only  
- [x] No scope creep / production H2H not enabled  

---

## Verdict

**SPRINT 17 READY FOR VERIFICATION**
