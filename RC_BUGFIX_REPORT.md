# GurkyNet — RC Bugfix Report
## Sprint 5.1: Release Candidate Critical Fixes

**Date:** 2026-08-05  
**Commit message:** Sprint 5.1 - Release Candidate Critical Fixes  
**Scope:** Critical blockers C1–C6 only (no new features, no UI redesign)  
**References:** `SYSTEM_VALIDATION_REPORT.md`, `PRODUCTION_READY_REPORT.md`

---

## 1. Executive Summary

All **Critical** issues from the RC system validation are resolved. Automated validation is green: **136 tests passed**, lint PASS, build PASS, `php artisan optimize` PASS.

**Critical open: 0**

**Production readiness: ~95%** (up from ~92%). Remaining gap is High/Medium items and External Dependencies (SMS OTP, FCM, VIP Payment, bank payout rail) — not Critical money/honesty defects.

---

## 2. Critical Fixed

| ID | Issue | Fix |
|---|---|---|
| **C1** | Finance refund not idempotent | Shared `WalletRefundService::refundOnce()` with row locks; wallet credited at most once; Finance returns safe “already processed” message |
| **C2** | Digiflazz job exhausted with no refund | `ProcessDigiflazzTransaction::failed()` marks failed, refunds once, writes audit, notifies customer + finance/owner |
| **C3** | Client controlled `status` / `admin_fee` | FormRequest strips settlement fields; controller ignores them; action always uses server pricing + `pending` |
| **C4** | Transfer posted empty `sku_code` | Bank transfer disabled with honest message; P2P uses real `/wallet/transfer` only |
| **C5** | Tagihan fabricated bill from catalog | Inquiry disabled; UI states **Provider inquiry not available.**; no fabricated bill checkout |
| **C6** | Docs/OpenAPI field mismatch | SDK, playground, and OpenAPI use `pin` / `recipient_wallet_number` matching FormRequests |

Cross-cutting: Digiflazz webhook fail path and CS approve refund also use the same idempotent refund service (prevents double credit across Finance / CS / Digiflazz).

---

## 3. Files Changed

### Backend
- `laravel/app/Services/WalletRefundService.php` *(new)*
- `laravel/app/Repositories/Eloquent/FinanceRepository.php`
- `laravel/app/Repositories/Eloquent/CustomerSupportRepository.php`
- `laravel/app/Actions/Admin/Finance/FinanceRefundAction.php`
- `laravel/app/Http/Controllers/Api/v1/Admin/FinanceController.php`
- `laravel/app/Jobs/ProcessDigiflazzTransaction.php`
- `laravel/app/Http/Controllers/Api/v1/TransactionController.php`
- `laravel/app/Actions/Transaction/CreateTransactionAction.php`
- `laravel/app/Http/Requests/Api/v1/CreateTransactionRequest.php`
- `laravel/tests/Feature/TransactionModuleTest.php`
- `laravel/tests/Feature/DigiflazzIntegrationTest.php`

### Frontend
- `src/pages/dashboard/TransferPage.tsx`
- `src/pages/dashboard/TagihanPage.tsx`
- `src/pages/public/DocsPage.tsx`
- `src/data/openapi.ts`

### Docs
- `RC_BUGFIX_REPORT.md` *(this file)*

---

## 4. Remaining High (not in this sprint)

| ID | Item |
|---|---|
| H1 | OTP not delivered — External Dependency (SMS) |
| H2 | Withdraw has no bank payout rail — External Dependency |
| H3 | Cancel vs in-flight Digiflazz race (mitigated by idempotent refund, still operational risk) |
| H4 | VIP Payment unimplemented — External Dependency / Pending |
| H5 | No in-app PIN set/change UI |
| H6 | Checkout `pinError` UX dead |
| H7 | Staff can deep-link user PPOB routes |
| H8 | Unauthenticated device register/push-token edge cases |
| H9 | CS SoD still can approve refunds (now idempotent, but privilege remains) |

---

## 5. Remaining Medium (selected)

| ID | Item |
|---|---|
| M1 | Client `admin_fee` on wallet transfer/withdraw endpoints |
| M2 | No voucher redeem-on-checkout |
| M3 | Homepage hardcoded fallbacks when CMS empty |
| M4 | `console.log` in transaction store |
| M5 | Top-up soft-success when Snap token missing |
| M6 | CI must `config:clear` before PHPUnit after `optimize` |
| M7 | Register without OTP gate |

---

## 6. Validation Results

| Check | Result |
|---|---|
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `php artisan optimize` | **PASS** |
| `php artisan test` | **PASS — 136 passed (853 assertions)** |
| Critical count | **0** |

---

## 7. Production Readiness %

| Prior (Sprint 5) | After Sprint 5.1 |
|---|---|
| ~92% | **~95%** |

Rationale: Critical money integrity and customer-facing honesty blockers cleared. Remaining ~5% is External Dependencies + High UX/ops items listed above.

---

## 8. Recommended Next Steps

1. Soft-launch SKU checkout (Pulsa/Paket/Token/Voucher) + P2P + Midtrans top-up on staging with real Digiflazz/Midtrans credentials.  
2. Keep Tagihan / bank transfer disabled until provider inquiry / payout exist.  
3. Schedule a High-priority hardening pass (OTP SMS, withdraw rail, PIN UI, SoD).  
4. Re-run system validation checklist; promote RC when High money-adjacent items are accepted or fixed.

---

**Disposition:** Release Candidate Critical blockers **cleared**. Safe to proceed to staging soft-launch with feature gates as documented.
