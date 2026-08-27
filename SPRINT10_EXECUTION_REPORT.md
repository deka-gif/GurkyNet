# SPRINT 10 EXECUTION REPORT
## Digiflazz + VIPayment + Failover (SRS v2.2 CLEAN — Bagian 15 + 9.1)

**Status:** READY FOR VERIFICATION (not claimed COMPLETE)  
**Date:** 2026-08-27  
**Scope:** Gap-closure on existing multi-provider stack — no adapter rewrite, no Sprint 3/7 rebuild, no purchase go-live, no Sprint 11.

---

## 1. SRS requirements covered

| Requirement | Coverage |
|-------------|----------|
| Digiflazz adapter | Reused `DigiflazzProductProviderAdapter` + `DigiflazzService` |
| VIPayment adapter | Reused `VipPulsaProductProviderAdapter` + `VipService` |
| Abstraction / registry | Reused `ProductProviderAdapterInterface`, `ProductProviderRegistry` |
| Product mapping | Reused `product_provider_skus` + routing filters |
| Routing | `ProductRoutingService` + circuit skip |
| Failover (SRS 15.3) | Pre-processed → next provider; post-dispatch timeout → `checkStatus` only |
| Anti dual-dispatch | Claim + `handleDispatchRetry` + ambiguous post-dispatch path |
| Provider health | `ProductProviderHealthService` drives circuit |
| Circuit breaker (SRS 15.4) | `ProviderCircuitBreaker` CLOSED / OPEN / HALF_OPEN |
| Credentials | `ProviderCredentialResolver` (System Settings → env) |
| HTTP timeout 10–15s | `config/ppob.php` `provider_http.*` (default 12s) |
| checkStatus | Digi same `ref_id`; VIP same `trxid`/ref |
| Provider logging | Existing `product_provider_logs` (no new `attempted_providers` column) |

---

## 2. Existing implementation reused

- Adapters, registry, selection, fulfillment job path (`ProcessProductProviderTransaction`)
- Sprint 3: idempotency, wallet ledger/`lockForUpdate`, state machine, refund
- Sprint 7: provider reconciliation (untouched)
- Midtrans webhook/signature (untouched)
- Legacy `ProcessDigiflazzTransaction`: **not** on create path (`CreateTransactionAction` dispatches `ProcessProductProviderTransaction`). Documented as legacy; not deleted; not re-wired.

---

## 3. Timeout decision

- **Fulfillment / status:** `PPOB_PROVIDER_TIMEOUT_SECONDS` default **12** (NFR 10–15s window)
- **Connect:** default **5s**
- **HTTP retries on fulfill:** default **1** (wall-clock stays inside window)
- **Health:** separate `health_timeout_seconds` (default 10)
- **Catalog sync:** remains up to **90s** (not failover path)
- Applied in `DigiflazzService::executeRequest` and `VipService::request` (not job timeout alone)

---

## 4. Circuit breaker

- Class: `ProviderCircuitBreaker` (cache-backed)
- States: CLOSED → (threshold failures) → OPEN → (cooldown) → HALF_OPEN → success→CLOSED / fail→OPEN
- Defaults (SRS 15.4 suggestion via config): threshold **5**, window **300s**, cooldown **300s** (tests use threshold **3**)
- HALF_OPEN: fulfillment **not** allowed; health probe uses `tryAcquireHalfOpenProbe` (cache lock)
- OPEN provider skipped in `ProductRoutingService`
- Infrastructure fulfill failures update breaker; customer validation does **not**

---

## 5. Credential resolution

- `ProviderCredentialResolver`: encrypted System Settings first, then env/config
- Digi keys: `ppob_digiflazz_username`, `ppob_digiflazz_api_key`, …
- VIP keys: `ppob_vip_merchant_id`, `ppob_vip_api_key`, …
- Wired into `DigiflazzService` / `VipService` (`refreshCredentials` per request)
- Secrets masked in logs (`sign` / `key`); decrypt failures never log ciphertext/plaintext

---

## 6. Failover

| Scenario | Behaviour |
|----------|-----------|
| A fails before processed (`provider_error`, `provider_offline`, not configured, …) | Failover to B |
| A **timeout** / ambiguous after HTTP dispatch | **No** B; `checkStatus(A)` only; leave pending / reconcile |
| Retry when `provider_dispatch_started_at` set | `handleDispatchRetry` → `checkStatus` only |
| A + B unavailable (confirmed) | FAILED + existing refund path |
| Circuit OPEN on A | Skip A; B may be selected |

**Policy change vs older tests:** timeout no longer failovers to VIP (aligns SRS 15.3). Related tests updated.

---

## 7. checkStatus

- Digiflazz: re-Topup / status with **same** `ref_id` (no second GurkyNet invoice)
- VIP: status with same `trxid` / provider ref
- In-flight retry never calls `fulfill()` again

---

## 8. Mapping

- Active SKU mappings selected by priority
- Inactive mapping skipped
- No eligible offers → safe fail / refund (`no_active_provider`)
- OPEN circuit → skipped like offline

---

## 9. Tests

**New:** `tests/Feature/Sprint10ProviderIntegrationTest.php` (cases 1–35 + helpers; regression 36–38 run as separate suites)

**Updated:** `MultiProductProviderRuntimeTest`, `MultiProductProviderControlTest` (timeout / both-down semantics)

Results (targeted):

- Sprint10 + MultiProduct* : **58 OK**
- Sprint3Reliability + Sprint3GapClosure + Sprint7Reconciliation : **29 OK**

---

## 10. Regression

```
cd laravel && php artisan test
→ 682 passed, 1 failed
```

**Only failure (pre-existing, not Sprint 10):**  
`FinanceTest::finance_user_can_list_settlements` — missing `meta.pagination`

Sprint 3 reliability / gap-closure and Sprint 7 reconciliation: **pass**.

---

## 11. Lint / build

- `npm run lint` (`tsc --noEmit`): **fails with known pre-existing frontend TS debt** (dashboard interval types, finance.store, MarketingHomepageSections, RealtimeManager, etc.). No Sprint 10 frontend files changed; not fixed per scope.
- `npm run build`: not required to clear pre-existing TS debt for Sprint 10 gate.

---

## 12. Findings

1. Legacy `ProcessDigiflazzTransaction` remains for older Digi-only tests / ops asserts “not pushed”; create path uses multi-provider job.
2. Sync queue + `scheduleEarlyStatusPoll` (60s delay) can block PHPUnit if `Queue::fake()` is not used when `markPending` runs after timeout→checkStatus; tests now `Queue::fake()`.
3. Circuit cooldown floor in code is `max(30, config)` — tests must use ≥30s elapsed for HALF_OPEN transition.

---

## 13. Out of scope (not done)

- FR-15.5 cheapest-price routing
- Sprint 11 Midtrans realtime / WebSocket / Reverb
- KYC, DIFF, referral, H2H outbound, legal/tax
- Purchase / withdraw production activation
- Third provider
- New `attempted_providers` column
- Deleting legacy Digi job

---

## 14. Completion gate checklist

- [x] Digiflazz adapter works
- [x] VIPayment adapter works
- [x] Provider abstraction works
- [x] Product mapping works
- [x] Provider routing works
- [x] Pre-processed failover works
- [x] In-flight uses checkStatus
- [x] No dual dispatch
- [x] Timeout 10–15s target (default 12)
- [x] Circuit breaker CLOSED/OPEN/HALF_OPEN
- [x] Provider health updates breaker
- [x] System Settings credentials work
- [x] Env fallback works
- [x] Secrets protected
- [x] Provider logging works
- [x] Mapping missing/inactive safe
- [x] Sprint 3 foundation intact
- [x] Sprint 7 reconciliation intact
- [x] Dedicated Sprint 10 tests pass
- [x] Regression checked (1 known pre-existing Finance failure)
- [x] No new Sprint 10 regression
- [x] Git scope limited to provider health/circuit/credentials/timeout/failover/tests/report
- [x] No Sprint 11+

---

## 15. Files touched (Sprint 10)

**New**

- `laravel/app/Services/ProductProviders/ProviderCredentialResolver.php`
- `laravel/app/Services/ProductProviders/ProviderCircuitBreaker.php`
- `laravel/tests/Feature/Sprint10ProviderIntegrationTest.php`
- `SPRINT10_EXECUTION_REPORT.md`

**Modified**

- `laravel/config/ppob.php`
- `laravel/app/Services/DigiflazzService.php`
- `laravel/app/Services/VipService.php`
- `laravel/app/Services/ProductProviders/ProductRoutingService.php`
- `laravel/app/Services/ProductProviders/ProductProviderHealthService.php`
- `laravel/app/Services/ProductProviders/ProductProviderFulfillmentService.php`
- `laravel/app/Services/ProductProviders/ProductProviderControlService.php`
- `laravel/tests/Feature/MultiProductProviderRuntimeTest.php`
- `laravel/tests/Feature/MultiProductProviderControlTest.php`

---

**SPRINT 10 READY FOR VERIFICATION**
