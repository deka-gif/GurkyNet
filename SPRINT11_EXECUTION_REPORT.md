# SPRINT 11 EXECUTION REPORT
## Midtrans + Saldo Real-Time (SRS v2.2 CLEAN — Bagian 16)

**Status:** READY FOR VERIFICATION (not claimed COMPLETE)  
**Date:** 2026-08-27  

---

## 1. Scope

Implement / close Sprint 11 gaps for:
- Midtrans credential resolution (System Settings → env)
- Snap sandbox/prod client bootstrap (no hardcoded sandbox key)
- Explicit Midtrans status mapping (`challenge`, `failure`)
- Wallet realtime via **SSE** `balance_updated` on `wallet.{userId}`
- ~3s poll fallback when SSE unhealthy
- Wallet cache bypass after settlement

**Locked decisions applied:** SSE primary (no WebSocket/Reverb); `AUTO_TOPUP_ENABLED=false`; IP allowlist out of scope.

---

## 2. SRS references

| Ref | Coverage |
|-----|----------|
| 16.1 E2E top-up | Reused Snap + webhook + credit path |
| 16.2 Signature / amount | Reused SHA512 + gross_amount check |
| 16.3 Realtime 3–5s | SSE publish + FE subscribe + 3s floor fallback |
| 16.4 Escrow / recon | Reused Sprint 7 Midtrans daily + 15m pending poll |
| 16.5 Idempotency | Reused order_id / success short-circuit / lockForUpdate |
| FR-USR03 / FR-FIN-04 | Top-up UI + Finance Midtrans history (gated auto path) |

---

## 3. Credential resolver

**New:** `App\Services\Payment\MidtransCredentialResolver`

- Keys: `payment_midtrans_server_key`, `payment_midtrans_client_key`, `payment_midtrans_is_production`
- Priority: encrypted System Settings → env/config
- `publicConfig()` exposes client_key + snap_js_url only (never server_key)
- Wired into `MidtransService` + webhook signature verification

---

## 4. Snap configuration

- Removed hardcoded sandbox Snap script/key from `index.html`
- Dynamic load via `src/utils/midtransSnap.ts` using backend `payment-config` / top-up response `midtrans`
- Endpoint: `GET /api/v1/wallet/payment-config`

---

## 5. Top-up E2E

Unchanged credit path:
`TopUpWalletAction` → Midtrans Snap → webhook SHA512 → `ProcessMidtransCallback` → lock + amount check → ledger credit → `WalletCredited` → **SSE `balance_updated`**

No second credit path. `AUTO_TOPUP` remains **OFF**.

---

## 6. Webhook security

Preserved:
- SHA512 required
- Invalid signature → 401
- Duplicate settlement → one credit
- Amount mismatch → no credit + `MIDTRANS_AMOUNT_MISMATCH` audit

---

## 7. Status mapping (Sprint 11)

| Midtrans | Local |
|----------|--------|
| settlement / capture+accept | SUCCESS |
| pending / challenge | PENDING (never SUCCESS) |
| expire | EXPIRED |
| cancel | CANCELED |
| deny / failure | FAILED |
| refund / partial_refund | FAILED (existing safe semantics) |

---

## 8. Pending poll & daily recon

**Reused** Sprint 7:
- `MidtransReconciliationService::pollPendingDeposits` (age ≥5m)
- Schedule `finance:reconcile midtrans-pending` every 15 minutes
- Daily `finance:reconcile midtrans`

No second poller / recon engine.

---

## 9. Wallet realtime

**New listener:** `PublishWalletBalanceUpdated`

On `WalletCredited`:
- publish `balance_updated` to `wallet.{userId}` via `SseRealtimeTransport`
- payload: balance, delta, reason, transaction_id, wallet_number, at
- DB wallet remains source of truth

---

## 10. Channel authorization

`RealtimeChannelAuthorizer`:
- user may subscribe only `wallet.{ownId}`
- Owner / Super Admin / Finance may monitor (ops)
- User A cannot subscribe User B (tested)

---

## 11. Frontend

- `WalletPage` subscribes `wallet.{userId}` via `useRealtimeChannel`
- On `balance_updated`: `applyRealtimeBalance` + `fetchWallet({ force: true })`
- `RefreshPolicy.realtimeFloor` / `walletBalance` = **3000ms** (SSE fallback poll)
- `fetchWallet({ force })` invalidates `wallet:overview` cache so 10-minute TTL cannot hide settlement

---

## 12. Tests

**New:** `tests/Feature/Sprint11MidtransRealtimeTest.php` (23 cases)

Targeted regression (this session):
- Sprint11 + MidtransIntegration + Sprint3 + Sprint7 + Sprint8 + Sprint10 → **108 OK**

Full suite (this session):
```
Tests: 1 failed, 705 passed (4791 assertions)
```
Only failure (pre-existing): `FinanceTest::finance_user_can_list_settlements` (`meta.pagination`).

---

## 14. Findings

1. Workspace still contains multi-sprint uncommitted files; Sprint 11 delta is Midtrans/realtime/wallet FE focused.
2. `BroadcastEvent` still logs “Reverb prep” — wallet push uses dedicated SSE listener (not Reverb).
3. Manual deposit path unchanged (Finance approval).
4. No migration required for Sprint 11.

---

## 15. Out of scope (not done)

- WebSocket / Reverb
- IP allowlist
- Production AUTO_TOPUP / purchase / withdraw go-live
- Sprint 12 KYC
- DIFF / H2H / legal/tax
- Reconciliation rebuild
- Wallet/idempotency rebuild

---

## 16. Completion gate (self-check)

- [x] Midtrans settings credentials
- [x] env fallback
- [x] Snap sandbox/prod config
- [x] SHA512 signature
- [x] gross_amount validation
- [x] duplicate webhook protection
- [x] one-credit-only
- [x] explicit challenge mapping
- [x] explicit failure mapping
- [x] pending poll >5m
- [x] 10–15m polling
- [x] Sprint 7 reconciliation reused
- [x] WalletCredited realtime publish
- [x] wallet.{userId} channel
- [x] server-side authorization
- [x] SSE works
- [x] ~3s fallback polling floor
- [x] reconnect cursor drain
- [x] duplicate event safe (no financial mutation)
- [x] cache stale issue fixed (force fetch)
- [x] AUTO_TOPUP remains OFF
- [x] manual deposit intact
- [x] Sprint11 tests PASS
- [x] regression checked (known Finance failure only)
- [x] no Sprint 12+

---

## 17. Files (Sprint 11)

**New**
- `laravel/app/Services/Payment/MidtransCredentialResolver.php`
- `laravel/app/Listeners/PublishWalletBalanceUpdated.php`
- `laravel/tests/Feature/Sprint11MidtransRealtimeTest.php`
- `src/utils/midtransSnap.ts`
- `SPRINT11_EXECUTION_REPORT.md`

**Modified**
- `laravel/app/Services/MidtransService.php`
- `laravel/app/Http/Controllers/Api/v1/TransactionController.php`
- `laravel/app/Http/Controllers/Api/v1/WalletController.php`
- `laravel/app/Jobs/ProcessMidtransCallback.php`
- `laravel/app/Services/Realtime/RealtimeChannelAuthorizer.php`
- `laravel/app/Providers/AppServiceProvider.php`
- `laravel/routes/api.php`
- `index.html`
- `src/pages/dashboard/WalletPage.tsx`
- `src/store/wallet.store.ts`
- `src/services/wallet/wallet.service.ts`
- `src/lib/refreshPolicy.ts`

---

**SPRINT 11 READY FOR VERIFICATION**
